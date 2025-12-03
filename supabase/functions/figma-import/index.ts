import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FIGMA_TOKEN = Deno.env.get("FIGMA_PERSONAL_ACCESS_TOKEN") || Deno.env.get("FIGMA_ACCESS_TOKEN");
const GCS_SERVICE_ACCOUNT_KEY = Deno.env.get("GCS_SERVICE_ACCOUNT_KEY");
const GCS_BUCKET_NAME = Deno.env.get("GCS_BUCKET_NAME");

function respond(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

async function fetchFromFigma(endpoint: string) {
  if (!FIGMA_TOKEN) {
    throw new Error("FIGMA_PERSONAL_ACCESS_TOKEN não configurado");
  }

  const response = await fetch(`https://api.figma.com/v1/${endpoint}`, {
    headers: {
      Authorization: `Bearer ${FIGMA_TOKEN}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Erro na API do Figma: ${errorText}`);
  }

  return response.json();
}

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
    throw new Error(`Falha ao obter token do GCS: ${error}`);
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
    const errorText = await response.text();
    throw new Error(`Falha ao enviar para o GCS: ${errorText}`);
  }

  return `https://storage.googleapis.com/${bucketName}/${filePath}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const action = body?.action;

    if (!action) {
      throw new Error("Ação não informada");
    }

    if (action === "list-files") {
      const data = await fetchFromFigma("me/files");
      return respond({ files: data?.files || [], authenticated: true });
    }

    if (action === "list-frames") {
      const fileKey = body?.fileKey;
      if (!fileKey) throw new Error("fileKey é obrigatório");

      const fileData = await fetchFromFigma(`files/${fileKey}`);
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

      return respond({ pages: pagesWithFrames });
    }

    if (action === "import-frames") {
      if (!GCS_SERVICE_ACCOUNT_KEY || !GCS_BUCKET_NAME) {
        throw new Error("Credenciais do GCS não configuradas");
      }

      const serviceAccount = JSON.parse(GCS_SERVICE_ACCOUNT_KEY);
      const accessToken = await getAccessToken(serviceAccount);

      const { fileKey, frames, userId } = body;
      if (!fileKey || !frames?.length) {
        throw new Error("fileKey e frames são obrigatórios");
      }

      const ids = frames.map((frame: any) => frame.id).join(",");
      const imagesResponse = await fetchFromFigma(`images/${fileKey}?ids=${encodeURIComponent(ids)}&format=png&scale=2`);
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
        const publicUrl = await uploadToGCS(GCS_BUCKET_NAME, path, buffer, "image/png", accessToken);

        assets.push({
          name: frame.name || frame.id,
          url: publicUrl,
          type: "image",
        });
      }

      return respond({ assets });
    }

    throw new Error(`Ação desconhecida: ${action}`);
  } catch (error) {
    console.error("Erro na função figma-import:", error);
    return respond({ error: (error as Error).message }, 400);
  }
});
    if (action === "start-auth") {
      const clientId = Deno.env.get("FIGMA_OAUTH_CLIENT_ID");
      const redirectUri = Deno.env.get("FIGMA_OAUTH_REDIRECT_URI");
      if (!clientId || !redirectUri) {
        throw new Error("FIGMA_OAUTH_CLIENT_ID ou FIGMA_OAUTH_REDIRECT_URI não configurados");
      }

      const state = crypto.randomUUID();
      const scopes = ["files:read"].join(" ");
      const authUrl =
        `https://www.figma.com/oauth?client_id=${encodeURIComponent(clientId)}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&scope=${encodeURIComponent(scopes)}` +
        `&state=${state}&response_type=code`;

      return respond({ authUrl });
    }

    if (action === "logout") {
      // Caso haja lógica de sessão futura, pode ser adicionada aqui.
      return respond({ success: true });
    }
