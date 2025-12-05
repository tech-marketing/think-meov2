import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const APP_URL = Deno.env.get("APP_URL") || "https://statuesque-rugelach-635698.netlify.app";
const FIGMA_CLIENT_ID = Deno.env.get("FIGMA_OAUTH_CLIENT_ID");
const FIGMA_REDIRECT_URI = Deno.env.get("FIGMA_OAUTH_REDIRECT_URI");

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders,
    },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = req.method === "POST" ? await req.json() : {};
    const profileId = body?.userId ?? body?.profileId;
    const origin = body?.origin || req.headers.get("origin") || APP_URL;

    if (!profileId) {
      throw new Error("Perfil não informado");
    }

    if (!FIGMA_CLIENT_ID || !FIGMA_REDIRECT_URI) {
      throw new Error("Configurações de OAuth do Figma ausentes");
    }

    const statePayload = {
      profileId,
      origin,
      ts: Date.now(),
    };

    const scopes = [
      "current_user:read",
      "file_content:read",
      "file_metadata:read",
      "projects:read",
    ].join(" ");

    const authUrl =
      `https://www.figma.com/oauth?client_id=${encodeURIComponent(FIGMA_CLIENT_ID)}` +
      `&redirect_uri=${encodeURIComponent(FIGMA_REDIRECT_URI)}` +
      `&scope=${encodeURIComponent(scopes)}` +
      `&response_type=code&state=${encodeURIComponent(JSON.stringify(statePayload))}`;

    return jsonResponse({ success: true, authUrl });
  } catch (error) {
    console.error("Erro em figma-oauth-init:", error);
    return jsonResponse({ success: false, error: (error as Error).message }, 400);
  }
});
