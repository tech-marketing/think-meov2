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
const FIGMA_AUTH_SUCCESS_URL = Deno.env.get("FIGMA_AUTH_SUCCESS_URL") || Deno.env.get("APP_URL") || "https://app.thinkmeo.com.br";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state"); // userId
    const errorParam = url.searchParams.get("error");

    if (errorParam) {
      console.error("Erro retornado pelo Figma:", errorParam);
      return htmlResponse("Ocorreu um erro ao conectar com o Figma. Você já pode fechar esta janela.");
    }

    if (!code || !state) {
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
      user_id: state,
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token || null,
      expires_at: expiresAt,
    });

    const redirectHtml = `
      <html>
        <body style="font-family: sans-serif; display:flex; flex-direction:column; align-items:center; justify-content:center; min-height:100vh;">
          <p>Autenticação concluída! Você já pode fechar esta janela.</p>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'FIGMA_AUTH_SUCCESS' }, '*');
            }
            setTimeout(() => {
              window.close();
            }, 1000);
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
