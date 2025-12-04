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
const FIGMA_AUTH_SUCCESS_URL = Deno.env.get("FIGMA_AUTH_SUCCESS_URL") || Deno.env.get("APP_URL") || "https://statuesque-rugelach-635698.netlify.app";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const rawState = url.searchParams.get("state");
    let stateProfileId: string | null = null;
    let stateOrigin: string | null = null;

    if (rawState) {
      try {
        const decoded = JSON.parse(decodeURIComponent(rawState));
        stateProfileId = decoded?.profileId || null;
        stateOrigin = decoded?.origin || null;
      } catch {
        stateProfileId = rawState;
      }
    }
    const errorParam = url.searchParams.get("error");

    if (errorParam) {
      console.error("Erro retornado pelo Figma:", errorParam);
      return htmlResponse("Ocorreu um erro ao conectar com o Figma. Você já pode fechar esta janela.");
    }

    if (!code || !stateProfileId) {
      return htmlResponse("Requisição inválida.");
    }

    if (!FIGMA_CLIENT_ID || !FIGMA_CLIENT_SECRET || !FIGMA_REDIRECT_URI) {
      return htmlResponse("Configurações de OAuth não encontradas.");
    }

    const tokenResponse = await fetch("https://www.figma.com/api/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: FIGMA_CLIENT_ID,
        client_secret: FIGMA_CLIENT_SECRET,
        redirect_uri: FIGMA_REDIRECT_URI,
        code,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenResponse.ok) {
      console.error("Falha ao trocar código por token:", await tokenResponse.text());
      return htmlResponse("Erro ao finalizar autenticação com o Figma.");
    }

    const tokenData = await tokenResponse.json();
    const expiresAt = tokenData.expires_in
      ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
      : null;

    await supabaseAdmin.from("figma_tokens").upsert({
      user_id: stateProfileId,
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token || null,
      expires_at: expiresAt,
    });

    const postMessageOrigin = stateOrigin || "*";
    const fallbackUrl = FIGMA_AUTH_SUCCESS_URL || "";

    const redirectHtml = `
      <html>
        <body style="font-family: sans-serif; display:flex; flex-direction:column; align-items:center; justify-content:center; min-height:100vh;">
          <p>Autenticação concluída! Você já pode fechar esta janela.</p>
          <script>
            if (window.opener) {
              try {
                window.opener.postMessage({ type: 'FIGMA_AUTH_SUCCESS' }, ${JSON.stringify(postMessageOrigin)});
              } catch (postMessageError) {
                console.warn('Falha ao enviar mensagem para janela principal:', postMessageError);
              }
            }
            setTimeout(() => {
              window.close();
              setTimeout(() => {
                var redirectUrl = ${JSON.stringify(fallbackUrl)};
                if (!window.closed && redirectUrl) {
                  window.location.href = redirectUrl;
                }
              }, 600);
            }, 600);
          </script>
        </body>
      </html>
    `;

    return new Response(redirectHtml, {
      headers: {
        "Content-Type": "text/html",
        ...corsHeaders,
      },
    });
  } catch (error) {
    console.error("Erro na função figma-oauth-callback:", error);
    return htmlResponse("Ocorreu um erro ao processar sua autenticação.");
  }
});

function htmlResponse(message: string) {
  return new Response(
    `<html><body style="font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;">${message}</body></html>`,
    { headers: { "Content-Type": "text/html", ...corsHeaders } },
  );
}
