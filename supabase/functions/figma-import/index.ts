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

function getDefaultRedirectUri() {
  try {
    const url = new URL(supabaseUrl);
    const hostnameParts = url.hostname.split(".");
    if (hostnameParts.length < 2) return null;
    const projectId = hostnameParts[0];
    const domain = hostnameParts.slice(1).join(".");
    return `${url.protocol}//${projectId}.functions.${domain}/figma-oauth-callback`;
  } catch {
    return null;
  }
}

const FIGMA_CLIENT_ID = Deno.env.get("FIGMA_OAUTH_CLIENT_ID");
const FIGMA_CLIENT_SECRET = Deno.env.get("FIGMA_OAUTH_CLIENT_SECRET");
const FIGMA_REDIRECT_URI = Deno.env.get("FIGMA_OAUTH_REDIRECT_URI") || getDefaultRedirectUri();

interface FigmaTokenRow {
  user_id: string;
  access_token: string;
  refresh_token?: string | null;
  expires_at?: string | null;
}

function respond(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

async function fetchFromFigma(endpoint: string, accessToken: string) {
  const response = await fetch(`https://api.figma.com/v1/${endpoint}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "Erro ao chamar API do Figma");
  }

  return response.json();
}

function isTokenExpired(token?: FigmaTokenRow) {
  if (!token?.expires_at) return false;
  const expiresAt = new Date(token.expires_at).getTime();
  return Date.now() > expiresAt - 60_000;
}

async function saveToken(userId: string, accessToken: string, refreshToken?: string | null, expiresIn?: number) {
  const expiresAt = expiresIn ? new Date(Date.now() + expiresIn * 1000).toISOString() : null;
  await supabaseAdmin
    .from("figma_tokens")
    .upsert({
      user_id: userId,
      access_token: accessToken,
      refresh_token: refreshToken || null,
      expires_at: expiresAt,
    });
}

async function refreshAccessToken(userId: string, refreshToken?: string | null) {
  if (!refreshToken || !FIGMA_CLIENT_ID || !FIGMA_CLIENT_SECRET || !FIGMA_REDIRECT_URI) {
    return null;
  }

  const response = await fetch("https://www.figma.com/api/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: FIGMA_CLIENT_ID,
      client_secret: FIGMA_CLIENT_SECRET,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      redirect_uri: FIGMA_REDIRECT_URI,
    }),
  });

  if (!response.ok) {
    console.error("Erro ao atualizar token do Figma:", await response.text());
    await supabaseAdmin.from("figma_tokens").delete().eq("user_id", userId);
    return null;
  }

  const data = await response.json();
  await saveToken(userId, data.access_token, data.refresh_token || refreshToken, data.expires_in);
  return data.access_token;
}

async function getValidToken(userId: string) {
  const { data: tokenRow } = await supabaseAdmin
    .from("figma_tokens")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (!tokenRow) return null;

  if (isTokenExpired(tokenRow)) {
    return await refreshAccessToken(userId, tokenRow.refresh_token || undefined);
  }

  return tokenRow.access_token;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const action = body?.action;
    const userId = body?.userId as string | undefined;

    if (!action) {
      throw new Error("Ação não informada");
    }

    if (["list-files", "list-frames", "import-frames", "logout"].includes(action) && !userId) {
      throw new Error("userId é obrigatório para esta ação");
    }

    if (action === "start-auth") {
      if (!FIGMA_CLIENT_ID || !FIGMA_REDIRECT_URI) {
        throw new Error("Configurações de OAuth do Figma ausentes");
      }

      if (!userId) {
        throw new Error("userId é obrigatório para autenticação");
      }

      const state = userId;
      const scopes = ["files:read"].join(" ");
      const authUrl =
        `https://www.figma.com/oauth?client_id=${encodeURIComponent(FIGMA_CLIENT_ID)}` +
        `&redirect_uri=${encodeURIComponent(FIGMA_REDIRECT_URI)}` +
        `&scope=${encodeURIComponent(scopes)}` +
        `&response_type=code&state=${state}`;

      return respond({ authUrl });
    }

    if (action === "logout") {
      await supabaseAdmin.from("figma_tokens").delete().eq("user_id", userId);
      return respond({ success: true });
    }

    if (action === "list-files") {
      const accessToken = await getValidToken(userId!);
      if (!accessToken) {
        return respond({ files: [], authenticated: false });
      }

      const data = await fetchFromFigma("me/files", accessToken);
      return respond({ files: data?.files || [], authenticated: true });
    }

    if (action === "list-frames") {
      const accessToken = await getValidToken(userId!);
      if (!accessToken) {
        return respond({ pages: [], authenticated: false });
      }

      const fileKey = body?.fileKey as string | undefined;
      if (!fileKey) throw new Error("fileKey é obrigatório");

      const fileData = await fetchFromFigma(`files/${fileKey}`, accessToken);
      const pages = fileData?.document?.children || [];

      const pagesWithFrames = pages.map((page: any) => {
        const frames: Array<{ id: string; name: string }> = [];
        extractFrames(page, page.name, frames);
        return {
          id: page.id,
          name: page.name,
          frames: frames.map((frame) => ({ id: frame.id, name: frame.name })),
        };
      });

      return respond({ pages: pagesWithFrames, authenticated: true });
    }

    if (action === "import-frames") {
      const accessToken = await getValidToken(userId!);
      if (!accessToken) {
        return respond({ authenticated: false, assets: [] });
      }

      if (!GCS_SERVICE_ACCOUNT_KEY || !GCS_BUCKET_NAME) {
        throw new Error("Credenciais do GCS não configuradas");
      }

      const serviceAccount = JSON.parse(GCS_SERVICE_ACCOUNT_KEY);
      const gcsAccessToken = await getAccessToken(serviceAccount);

      const { fileKey, frames } = body;
      if (!fileKey || !frames?.length) {
        throw new Error("fileKey e frames são obrigatórios");
      }

      const ids = frames.map((frame: any) => frame.id).join(",");
      const imagesResponse = await fetchFromFigma(
        `images/${fileKey}?ids=${encodeURIComponent(ids)}&format=png&scale=2`,
        accessToken,
      );
      const imageMap = imagesResponse?.images || {};

      const assets: Array<{ name: string; url: string; type: "image" }> = [];

      for (const frame of frames) {
        const url = imageMap[frame.id];
        if (!url) continue;

        const imageResp = await fetch(url);
        if (!imageResp.ok) {
          console.warn(`Falha ao baixar frame ${frame.id}`);
          continue;
        }

        const buffer = new Uint8Array(await imageResp.arrayBuffer());
        const path = `materials/${userId || "figma"}/figma/${frame.id}-${Date.now()}.png`;
        const publicUrl = await uploadToGCS(GCS_BUCKET_NAME, path, buffer, "image/png", gcsAccessToken);

        assets.push({
          name: frame.name || frame.id,
          url: publicUrl,
          type: "image",
        });
      }

      return respond({ assets, authenticated: true });
    }

    throw new Error(`Ação desconhecida: ${action}`);
  } catch (error) {
    console.error("Erro na função figma-import:", error);
    return respond({ error: (error as Error).message }, 400);
  }
});

function extractFrames(node: any, pageName: string, frames: Array<{ id: string; name: string; pageName: string }>) {
  if (!node) return;

  if (node.type === "FRAME") {
    frames.push({
      id: node.id,
      name: node.name,
      pageName,
    });
  }

  if (node.children && Array.isArray(node.children)) {
    node.children.forEach((child: any) => extractFrames(child, pageName, frames));
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
  const header = {
    alg: "RS256",
    typ: "JWT",
  };

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

async function getAccessToken(serviceAccount: any): Promise<string> {
  const jwt = await signJWT(serviceAccount);

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get access token: ${error}`);
  }

  const data = await response.json();
  return data.access_token;
}

async function uploadToGCS(
  bucketName: string,
  filePath: string,
  fileData: Uint8Array,
  contentType: string,
  accessToken: string,
) {
  const url = `https://storage.googleapis.com/upload/storage/v1/b/${bucketName}/o?uploadType=media&name=${encodeURIComponent(filePath)}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": contentType,
    },
    body: fileData as any,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to upload to GCS: ${error}`);
  }

  return `https://storage.googleapis.com/${bucketName}/${filePath}`;
}
