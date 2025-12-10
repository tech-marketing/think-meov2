import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "npm:resend@4.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("🔐 Request Password Reset - Iniciando...");

    const { email } = await req.json();

    if (!email) {
      throw new Error("Email é obrigatório");
    }

    const normalizedEmail = email.toLowerCase().trim();
    console.log(`📧 Processando solicitação para: ${normalizedEmail}`);

    // Create Supabase client with service role for full access
    // Try both possible secret names as fallback
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SERVICE_ROLE_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    
    console.log(`🔑 Service Role Key encontrada: ${serviceRoleKey ? "SIM" : "NÃO"}`);
    console.log(`🌐 Supabase URL: ${supabaseUrl}`);
    
    if (!serviceRoleKey || !supabaseUrl) {
      console.error("❌ Variáveis de ambiente não configuradas corretamente");
      throw new Error("Configuração do servidor inválida");
    }
    
    const supabaseAdmin = createClient(
      supabaseUrl,
      serviceRoleKey,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Check if email exists in profiles - use eq instead of ilike for exact match
    const { data: profiles, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("id, email, full_name")
      .eq("email", normalizedEmail);

    if (profileError) {
      console.error("❌ Erro na query de profiles:", profileError.message, profileError.details);
    }
    
    console.log(`📊 Resultado da busca: ${profiles?.length || 0} perfis encontrados`);
    
    const profile = profiles?.[0];

    if (!profile) {
      console.log("❌ Email não encontrado no sistema");
      // Return success anyway to prevent email enumeration
      return new Response(
        JSON.stringify({ success: true, message: "Se o email existir, você receberá um link de redefinição." }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
    
    console.log(`✅ Usuário encontrado: ${profile.full_name} (${profile.email})`)

    // Generate unique token
    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Delete any existing unused tokens for this email
    await supabaseAdmin
      .from("password_reset_tokens")
      .delete()
      .eq("email", normalizedEmail)
      .is("used_at", null);

    // Insert new token
    const { error: insertError } = await supabaseAdmin
      .from("password_reset_tokens")
      .insert({
        email: normalizedEmail,
        token,
        expires_at: expiresAt.toISOString(),
      });

    if (insertError) {
      console.error("❌ Erro ao salvar token:", insertError);
      throw new Error("Erro ao processar solicitação");
    }

    // Build reset link
    let appUrl = Deno.env.get("APP_URL") || "https://lovable.dev";
    // Remove /auth suffix if present
    appUrl = appUrl.replace(/\/auth\/?$/, "");
    const resetLink = `${appUrl}/auth/reset-password?token=${token}`;

    console.log(`🔗 Link de reset gerado: ${resetLink}`);

    // Send email
    const logoUrl = "https://storage.googleapis.com/armazenamento_think-meo/avatars/7bbe8dba-1b46-4319-9032-52cb94aff4d6/avatar.jpg";

    const emailHtml = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@300;800&display=swap" rel="stylesheet">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Redefinição de Senha - think•meo</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;700&family=Wix+Madefor+Display:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Wix Madefor Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background-color: #f8f9fa;
      padding: 40px 20px;
      color: #1e293b;
      line-height: 1.6;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background: white;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
    }
    .header {
      background: linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%);
      padding: 32px 40px;
      text-align: center;
      color: white;
    }
    .logo-container { margin-bottom: 16px; }
    .logo { width: 80px; height: auto; border-radius: 8px; }
    .app-name { font-size: 28px; margin: 0; letter-spacing: -0.5px; }
    .logo-think { font-family: 'Montserrat', sans-serif; font-weight: 800; }
    .logo-meo { font-family: 'Montserrat', sans-serif; font-weight: 300; }
    .content { padding: 40px; }
    h1 {
      font-family: 'Montserrat', sans-serif;
      font-size: 24px;
      font-weight: 700;
      color: #1e293b;
      margin-bottom: 16px;
      text-align: center;
    }
    .greeting { font-size: 18px; font-weight: 600; color: #1e293b; margin-bottom: 16px; }
    .body-text { color: #475569; font-size: 15px; line-height: 1.7; margin: 16px 0; }
    .warning-box {
      background: #fef3c7;
      border-left: 4px solid #f59e0b;
      padding: 20px;
      margin: 24px 0;
      border-radius: 8px;
    }
    .warning-text { color: #92400e; font-size: 15px; line-height: 1.6; margin: 0; }
    .info-box {
      background: #f1f5f9;
      border-left: 4px solid #8B5CF6;
      padding: 20px;
      margin: 24px 0;
      border-radius: 8px;
    }
    .info-text { color: #475569; font-size: 15px; line-height: 1.6; margin: 0; }
    .cta-button {
      display: inline-block;
      background: linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%);
      color: #FFFFFF !important;
      text-decoration: none;
      padding: 16px 32px;
      border-radius: 8px;
      font-weight: 600;
      font-size: 16px;
      margin: 24px 0;
      box-shadow: 0 2px 4px rgba(139, 92, 246, 0.2);
    }
    .footer {
      background: #f8fafc;
      padding: 32px 40px;
      text-align: center;
      border-top: 1px solid #e2e8f0;
    }
    .footer-text { color: #64748b; font-size: 14px; line-height: 1.6; }
    .footer-brand { font-family: 'Montserrat', sans-serif; font-weight: 700; color: #8B5CF6; margin-top: 8px; }
    .validity-text { color: #64748b; font-size: 13px; text-align: center; margin-top: 16px; }
    @media only screen and (max-width: 600px) {
      body { padding: 20px 10px; }
      .content { padding: 24px; }
      .header { padding: 24px; }
      .app-name { font-size: 24px; }
      h1 { font-size: 20px; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo-container" style="font-size:0; line-height:0;">
        <img src="cid:app-logo" alt="think•meo" width="80" style="display:inline-block;width:80px;height:auto;border-radius:8px;" />
      </div>
      <h2 class="app-name">
        <span class="logo-think">think•</span><span class="logo-meo">meo</span>
      </h2>
    </div>
    
    <div class="content">
      <h1>Redefinição de Senha 🔐</h1>
      
      <p class="greeting">Olá${profile.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}!</p>
      
      <p class="body-text">
        Recebemos uma solicitação para redefinir a senha da sua conta no <span class="logo-think">think•</span><span class="logo-meo">meo</span>.
      </p>
      
      <div class="warning-box">
        <p class="warning-text">
          ⚠️ <strong>Importante:</strong> Se você não solicitou esta redefinição, ignore este email. Sua senha permanecerá inalterada.
        </p>
      </div>
      
      <p class="body-text">
        Para criar uma nova senha, clique no botão abaixo:
      </p>
      
      <center>
        <a href="${resetLink}" class="cta-button">Redefinir minha senha</a>
      </center>
      
      <div class="info-box">
        <p class="info-text">
          🔒 <strong>Dica de segurança:</strong> Use uma senha forte com pelo menos 12 caracteres, incluindo letras maiúsculas, minúsculas, números e caracteres especiais.
        </p>
      </div>
      
      <p class="validity-text">
        Este link é válido por <strong>1 hora</strong>. Após esse período, você precisará solicitar um novo link.
      </p>
    </div>
    
    <div class="footer">
      <p class="footer-text">
        Este é um email automático do sistema de gestão de materiais.
      </p>
      <p class="footer-brand">
        <span class="logo-think">think•</span><span class="logo-meo">meo</span> © 2025
      </p>
    </div>
  </div>
</body>
</html>
    `;

    const { data: emailData, error: emailError } = await resend.emails.send({
      from: "think•meo <noreply@thinkmeo.com>",
      to: [normalizedEmail],
      subject: "Redefinição de Senha - think•meo 🔐",
      html: emailHtml,
      attachments: [
        {
          path: logoUrl,
          filename: "logo-email.png",
          content_id: "app-logo",
        },
      ],
    });

    if (emailError) {
      console.error("❌ Erro ao enviar email:", emailError);
      throw new Error("Erro ao enviar email de redefinição");
    }

    console.log("✅ Email de redefinição enviado com sucesso:", emailData?.id);

    return new Response(
      JSON.stringify({ success: true, message: "Email de redefinição enviado com sucesso" }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("❌ Erro na função request-password-reset:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
