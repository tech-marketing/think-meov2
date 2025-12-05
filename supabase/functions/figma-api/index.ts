import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { persistSession: false },
});

const FIGMA_CLIENT_ID = Deno.env.get("FIGMA_OAUTH_CLIENT_ID");
const FIGMA_CLIENT_SECRET = Deno.env.get("FIGMA_OAUTH_CLIENT_SECRET");
const FIGMA_REDIRECT_URI = Deno.env.get("FIGMA_OAUTH_REDIRECT_URI");

const GCS_BUCKET_NAME = Deno.env.get("GCS_BUCKET_NAME");
const GCS_SERVICE_ACCOUNT_KEY = Deno.env.get("GCS_SERVICE_ACCOUNT_KEY");

type ProfileRecord = {
  id: string;
  user_id: string;
  figma_access_token: string | null;
  figma_refresh_token: string | null;
  figma_token_expires_at: string | null;
};

type FrameSelection = { id: string; name: string };

const actionsRequiringProfile = new Set([
  "get-user",
  "disconnect",
  "get-file-history",
  "get-file-from-url",
  "export-frames",
]);

function respond(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

function isTokenExpired(record: ProfileRecord) {
  if (!record?.figma_token_expires_at) return false;
  const expires = new Date(record.figma_token_expires_at).getTime();
  return Date.now() > expires - 60_000;
}

async function fetchProfileRecord(profileId: string): Promise<ProfileRecord | null> {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id,user_id,figma_access_token,figma_refresh_token,figma_token_expires_at")
    .eq("id", profileId)
    .maybeSingle();

  if (error) {
    console.error("Erro ao buscar perfil:", error);
    throw new Error("Não foi possível localizar o perfil");
  }

  return data as ProfileRecord | null;
}

async function refreshAccessToken(profile: ProfileRecord): Promise<string | null> {
  if (!profile.figma_refresh_token) return null;
  if (!FIGMA_CLIENT_ID || !FIGMA_CLIENT_SECRET || !FIGMA_REDIRECT_URI) {
    throw new Error("Configurações de OAuth do Figma ausentes");
  }

  const response = await fetch("https://www.figma.com/api/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: FIGMA_CLIENT_ID,
      client_secret: FIGMA_CLIENT_SECRET,
      grant_type: "refresh_token",
      refresh_token: profile.figma_refresh_token,
      redirect_uri: FIGMA_REDIRECT_URI,
    }),
  });

  if (!response.ok) {
    console.error("Erro ao atualizar token do Figma:", await response.text());
    await supabaseAdmin
      .from("profiles")
      .update({
        figma_access_token: null,
        figma_refresh_token: null,
        figma_token_expires_at: null,
      })
      .eq("id", profile.id);
    return null;
  }

  const data = await response.json();
  const expiresAt = data.expires_in
    ? new Date(Date.now() + data.expires_in * 1000).toISOString()
    : null;

  await supabaseAdmin
    .from("profiles")
    .update({
      figma_access_token: data.access_token,
      figma_refresh_token: data.refresh_token || profile.figma_refresh_token,
      figma_token_expires_at: expiresAt,
    })
    .eq("id", profile.id);

  return data.access_token as string;
}

async function getValidAccessToken(profileId: string) {
  const profile = await fetchProfileRecord(profileId);
  if (!profile?.figma_access_token) {
    return { accessToken: null, profile };
  }

  if (isTokenExpired(profile)) {
    const refreshed = await refreshAccessToken(profile);
    return { accessToken: refreshed, profile: refreshed ? await fetchProfileRecord(profileId) : profile };
  }

  return { accessToken: profile.figma_access_token, profile };
}

async function fetchFromFigma(endpoint: string, token: string) {
  const response = await fetch(`https://api.figma.com/v1/${endpoint}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "Erro ao se comunicar com a API do Figma");
  }

  return response.json();
}

async function resolveProfileId(explicitUserId: string | undefined, authHeader: string | null) {
  if (explicitUserId) {
    const { data: profileById } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("id", explicitUserId)
      .maybeSingle();
    if (profileById?.id) {
      return profileById.id;
    }

    const { data: profileByUser } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("user_id", explicitUserId)
      .maybeSingle();
    if (profileByUser?.id) {
      return profileByUser.id;
    }
  }

  if (!authHeader) return null;
  const token = authHeader.replace("Bearer", "").trim();
  if (!token) return null;

  const {
    data: { user },
  } = await supabaseAdmin.auth.getUser(token);
  if (!user?.id) return null;

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  return profile?.id ?? null;
}

function parseFileKeyFromUrl(url: string) {
  const match = url.match(/figma\.com\/(?:file|design)\/([a-zA-Z0-9]+)[\/?]/i);
  if (match?.[1]) return match[1];
  return null;
}

function extractFrames(document: any) {
  const frames: Array<{ id: string; name: string; pageName: string }> = [];
  if (!document?.children) return frames;

  for (const page of document.children) {
    if (!page?.children) continue;
    for (const child of page.children) {
      if (child?.type === "FRAME") {
        frames.push({
          id: child.id,
          name: child.name,
          pageName: page.name,
        });
      }
    }
  }

  return frames.slice(0, 50);
}

async function upsertHistory(userId: string, fileKey: string, fileName: string, fileUrl: string, thumbnail?: string | null) {
  await supabaseAdmin.from("figma_file_history").upsert({
    user_id: userId,
    file_key: fileKey,
    file_name: fileName,
    file_url: fileUrl,
    thumbnail_url: thumbnail || null,
    last_used_at: new Date().toISOString(),
  }, { onConflict: "user_id,file_key" });
}

function normalizeFileUrl(rawUrl: string, fileKey: string) {
  try {
    const parsed = new URL(rawUrl);
    return `${parsed.origin}/file/${fileKey}`;
  } catch {
    return `https://www.figma.com/file/${fileKey}`;
  }
}

function pemToBinary(pem: string): ArrayBuffer {
  const base64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s/g, "");
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

async function signJWT(serviceAccount: any): Promise<string> {
  const header = { alg: "RS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: serviceAccount.client_email,
    scope: "https://www.googleapis.com/auth/devstorage.full_control",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };

  const encodedHeader = btoa(JSON.stringify(header)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const encodedPayload = btoa(JSON.stringify(payload)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const unsignedToken = `${encodedHeader}.${encodedPayload}`;

  const privateKeyBinary = pemToBinary(serviceAccount.private_key);
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    privateKeyBinary,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(unsignedToken),
  );

  const encodedSignature = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  return `${unsignedToken}.${encodedSignature}`;
}

async function getGcsAccessToken() {
  if (!GCS_SERVICE_ACCOUNT_KEY) {
    throw new Error("Credenciais do GCS não configuradas");
  }

  const serviceAccount = JSON.parse(GCS_SERVICE_ACCOUNT_KEY);
  const jwt = await signJWT(serviceAccount);

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  if (!response.ok) {
    throw new Error(`Falha ao gerar access token do GCS: ${await response.text()}`);
  }

  const data = await response.json();
  return data.access_token as string;
}

async function uploadToGCS(
  bucketName: string,
  path: string,
  fileData: Uint8Array,
  contentType: string,
  accessToken: string,
) {
  const url = `https://storage.googleapis.com/upload/storage/v1/b/${bucketName}/o?uploadType=media&name=${encodeURIComponent(path)}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": contentType,
    },
    body: fileData as any,
  });

  if (!response.ok) {
    throw new Error(`Falha ao fazer upload no GCS: ${await response.text()}`);
  }

  return `https://storage.googleapis.com/${bucketName}/${path}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = req.method === "POST" ? await req.json() : {};
    const action = body?.action as string | undefined;
    const authHeader = req.headers.get("Authorization");
    const profileId = actionsRequiringProfile.has(action || "")
      ? await resolveProfileId(body?.userId, authHeader)
      : null;

    if (!action) {
      throw new Error("Ação não informada");
    }

    if (actionsRequiringProfile.has(action) && !profileId) {
      throw new Error("Usuário não autenticado");
    }

    if (action === "get-user") {
      const { accessToken } = await getValidAccessToken(profileId!);
      if (!accessToken) {
        return respond({ connected: false });
      }

      const me = await fetchFromFigma("me", accessToken);
      return respond({ connected: true, user: me });
    }

    if (action === "disconnect") {
      await supabaseAdmin
        .from("profiles")
        .update({
          figma_access_token: null,
          figma_refresh_token: null,
          figma_token_expires_at: null,
        })
        .eq("id", profileId!);
      return respond({ success: true });
    }

    if (action === "get-file-history") {
      const profile = await fetchProfileRecord(profileId!);
      if (!profile?.user_id) {
        throw new Error("Perfil inválido");
      }

      const { data, error } = await supabaseAdmin
        .from("figma_file_history")
        .select("id,file_key,file_name,file_url,thumbnail_url,last_used_at")
        .eq("user_id", profile.user_id)
        .order("last_used_at", { ascending: false })
        .limit(20);

      if (error) {
        throw error;
      }

      return respond({ files: data || [] });
    }

    if (action === "get-file-from-url") {
      const url = body?.figmaUrl as string | undefined;
      if (!url) {
        throw new Error("URL do Figma não fornecida");
      }

      const fileKey = parseFileKeyFromUrl(url);
      if (!fileKey) {
        throw new Error("Não foi possível identificar o arquivo do Figma");
      }

      const { accessToken, profile } = await getValidAccessToken(profileId!);
      if (!accessToken || !profile?.user_id) {
        throw new Error("Conta do Figma não conectada");
      }

      const fileData = await fetchFromFigma(`files/${fileKey}`, accessToken);
      const frames = extractFrames(fileData?.document);
      const frameIds = frames.map((frame) => frame.id);

      let thumbnails: Record<string, string> = {};
      if (frameIds.length) {
        const thumbResp = await fetchFromFigma(
          `images/${fileKey}?ids=${encodeURIComponent(frameIds.join(","))}&format=png&scale=0.25`,
          accessToken,
        );
        thumbnails = thumbResp?.images || {};
      }

      const framesWithThumb = frames.map((frame) => ({
        id: frame.id,
        name: frame.name,
        pageName: frame.pageName,
        thumbnailUrl: thumbnails[frame.id] || null,
      }));

      const normalizedUrl = normalizeFileUrl(url, fileKey);
      await upsertHistory(profile.user_id, fileKey, fileData?.name || "Arquivo do Figma", normalizedUrl, thumbnails[frameIds[0]]);

      return respond({
        file: {
          key: fileKey,
          name: fileData?.name || "Arquivo do Figma",
          url: normalizedUrl,
        },
        frames: framesWithThumb,
      });
    }

    if (action === "export-frames") {
      const fileKey = body?.fileKey as string | undefined;
      const frames = (body?.frames as FrameSelection[] | undefined) ?? [];

      if (!fileKey || frames.length === 0) {
        throw new Error("Arquivo ou frames não informados");
      }

      if (!GCS_BUCKET_NAME) {
        throw new Error("Bucket do GCS não configurado");
      }

      const { accessToken } = await getValidAccessToken(profileId!);
      if (!accessToken) {
        throw new Error("Conta do Figma não conectada");
      }

      const figmaResponse = await fetchFromFigma(
        `images/${fileKey}?ids=${encodeURIComponent(frames.map((f) => f.id).join(","))}&format=png&scale=2`,
        accessToken,
      );
      const imageMap: Record<string, string> = figmaResponse?.images || {};

      const gcsAccessToken = await getGcsAccessToken();
      const uploaded: Array<{ nodeId: string; name: string; url: string }> = [];

      for (const frame of frames) {
        const imageUrl = imageMap[frame.id];
        if (!imageUrl) continue;

        const imageResp = await fetch(imageUrl);
        if (!imageResp.ok) continue;

        const buffer = new Uint8Array(await imageResp.arrayBuffer());
        const path = `materials/${profileId}/figma/${frame.id}-${Date.now()}.png`;
        const publicUrl = await uploadToGCS(GCS_BUCKET_NAME, path, buffer, "image/png", gcsAccessToken);

        uploaded.push({
          nodeId: frame.id,
          name: frame.name,
          url: publicUrl,
        });
      }

      return respond({ frames: uploaded });
    }

    throw new Error(`Ação desconhecida: ${action}`);
  } catch (error) {
    console.error("Erro na função figma-api:", error);
    return respond({ error: (error as Error).message }, 400);
  }
});
