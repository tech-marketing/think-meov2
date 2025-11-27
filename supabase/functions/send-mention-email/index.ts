import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { Resend } from "https://esm.sh/resend@4.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

interface NotificationPayload {
  notification_id: string;
  user_id: string;
  mentioned_by: string;
  material_id?: string;
  project_id?: string;
  comment_id?: string;
  message?: string;
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("📧 Send Mention Email - Iniciando...");

    const payload: NotificationPayload = await req.json();
    console.log("📧 Payload recebido:", JSON.stringify(payload, null, 2));

    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Buscar dados do usuário mencionado
    const { data: mentionedUser, error: userError } = await supabase
      .from("profiles")
      .select("email, full_name, avatar_url")
      .eq("user_id", payload.user_id)
      .single();

    if (userError || !mentionedUser) {
      console.error("❌ Erro ao buscar usuário mencionado:", userError);
      throw new Error("Usuário mencionado não encontrado");
    }

    console.log("✅ Usuário mencionado encontrado:", mentionedUser.email);

    // 2. Buscar dados de quem mencionou
    const { data: mentioner, error: mentionerError } = await supabase
      .from("profiles")
      .select("full_name, avatar_url, email")
      .eq("user_id", payload.mentioned_by)
      .single();

    if (mentionerError || !mentioner) {
      console.error("❌ Erro ao buscar quem mencionou:", mentionerError);
      throw new Error("Autor da menção não encontrado");
    }

    console.log("✅ Autor da menção encontrado:", mentioner.full_name);

    // 3. Buscar dados do material e projeto
    let materialName = "Material";
    let projectName = "Projeto";
    let materialLink = "";

    if (payload.material_id) {
      const { data: material, error: materialError } = await supabase
        .from("materials")
        .select("name, project_id, projects(name)")
        .eq("id", payload.material_id)
        .single();

      if (!materialError && material) {
        materialName = material.name;
        projectName = (material.projects as any)?.name || "Projeto";

        // Usar APP_URL configurada ou fallback para supabaseUrl
        const appUrl = Deno.env.get("APP_URL") || supabaseUrl;
        materialLink = `${appUrl}/material/${payload.material_id}`;

        // Adicionar hash do comentário se existir
        if (payload.comment_id) {
          materialLink += `#comment-${payload.comment_id}`;
        }
      }
    }

    console.log("✅ Dados do contexto carregados:", { projectName, materialName, materialLink });

    // 4. Configurar URL da logo com fallbacks
    const appUrl = Deno.env.get("APP_URL") || supabaseUrl;
    const logoUrlFromSecret = Deno.env.get("APP_LOGO_URL");
    const logoUrl = logoUrlFromSecret || `${appUrl}/branding/logo-email.png`;

    console.log("🖼️ URL da logo para anexo:", logoUrl);

    // 5. Preparar prévia do comentário
    const commentPreview = payload.message
      ? payload.message.substring(0, 200) + (payload.message.length > 200 ? "..." : "")
      : "Você foi mencionado em um comentário.";

    // 6. Construir HTML do email com design do think•meo
    const emailHtml = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Você foi mencionado - think•meo</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;700&family=Wix+Madefor+Display:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
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
    .logo-container {
      margin-bottom: 16px;
    }
    .logo {
      width: 80px;
      height: auto;
      border-radius: 8px;
    }
    .app-name {
      font-family: 'Montserrat', sans-serif;
      font-size: 28px;
      font-weight: 700;
      margin: 0;
      letter-spacing: -0.5px;
    }
    .content {
      padding: 40px;
    }
    .notification-badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: #f1f5f9;
      padding: 8px 16px;
      border-radius: 20px;
      font-size: 14px;
      font-weight: 600;
      color: #64748b;
      margin-bottom: 24px;
    }
    .notification-icon {
      width: 20px;
      height: 20px;
    }
    h1 {
      font-family: 'Montserrat', sans-serif;
      font-size: 24px;
      font-weight: 700;
      color: #1e293b;
      margin-bottom: 16px;
    }
    .mentioner {
      display: flex;
      align-items: center;
      gap: 12px;
      margin: 24px 0;
      padding: 16px;
      background: #f8fafc;
      border-radius: 8px;
      border-left: 4px solid #8B5CF6;
    }
    .avatar {
      width: 48px;
      height: 48px;
      border-radius: 50%;
      background: #e2e8f0;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 600;
      color: #64748b;
      font-size: 18px;
      flex-shrink: 0;
    }
    .avatar img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      border-radius: 50%;
    }
    .mentioner-info {
      flex: 1;
    }
    .mentioner-name {
      font-weight: 600;
      color: #1e293b;
      font-size: 16px;
      margin-bottom: 2px;
    }
    .mentioner-action {
      color: #64748b;
      font-size: 14px;
    }
    .context {
      margin: 24px 0;
    }
    .context-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 0;
      color: #475569;
      font-size: 15px;
    }
    .context-icon {
      color: #8B5CF6;
      font-size: 18px;
    }
    .comment-preview {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 20px;
      margin: 24px 0;
      font-size: 15px;
      color: #475569;
      font-style: italic;
      line-height: 1.7;
    }
    .cta-button {
      display: inline-block;
      background: #f1f5f9;
      color: white;
      text-decoration: none;
      padding: 16px 32px;
      border-radius: 8px;
      font-weight: 600;
      font-size: 16px;
      margin: 24px 0;
      transition: background 0.2s;
      box-shadow: 0 2px 4px rgba(139, 92, 246, 0.2);
    }
    .cta-button:hover {
      background: #00000;
    }
    .footer {
      background: #f8fafc;
      padding: 32px 40px;
      text-align: center;
      border-top: 1px solid #e2e8f0;
    }
    .footer-text {
      color: #64748b;
      font-size: 14px;
      line-height: 1.6;
    }
    .footer-brand {
      font-family: 'Montserrat', sans-serif;
      font-weight: 700;
      color: #8B5CF6;
      margin-top: 8px;
    }
    @media only screen and (max-width: 600px) {
      body {
        padding: 20px 10px;
      }
      .content {
        padding: 24px;
      }
      .header {
        padding: 24px;
      }
      .app-name {
        font-size: 24px;
      }
      h1 {
        font-size: 20px;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo-container" style="font-size:0; line-height:0;">
        <img 
          src="cid:app-logo" 
          alt="think•meo" 
          width="80"
          style="display:inline-block;width:80px;height:auto;border-radius:8px;"
        />
      </div>
      <h2 class="app-name">think•meo</h2>
    </div>
    
    <div class="content">
      <div class="notification-badge">
        <span class="notification-icon">🔔</span>
        Nova Menção
      </div>
      
      <h1>Você foi mencionado</h1>
      
      <div class="mentioner">
        
        </div>
        <div class="mentioner-info">
          <div class="mentioner-name">${mentioner.full_name}</div>
          <div class="mentioner-action">mencionou você</div>
        </div>
      </div>
      
      <div class="context">
        <div class="context-item">
          <span class="context-icon">📁</span>
          <span><strong>Projeto:</strong> ${projectName}</span>
        </div>
        <div class="context-item">
          <span class="context-icon">📄</span>
          <span><strong>Material:</strong> ${materialName}</span>
        </div>
      </div>
      
      <div class="comment-preview">
        "${commentPreview}"
      </div>
      
      <center>
        <a href="${materialLink}" class="cta-button">Ver Menção</a>
      </center>
      
      <p style="color: #64748b; font-size: 14px; margin-top: 24px;">
        Clique no botão acima para visualizar o comentário completo e responder diretamente na plataforma.
      </p>
    </div>
    
    <div class="footer">
      <p class="footer-text">
        Este é um email automático do sistema de aprovação de materiais.
      </p>
      <p class="footer-brand">think•meo © 2025</p>
      <p class="footer-text" style="margin-top: 16px; font-size: 12px;">
        Sistema de Gestão de Projetos e Materiais
      </p>
    </div>
  </div>
</body>
</html>
    `;

    // 7. Enviar email via Resend com logo inline (CID)
    console.log("📧 Enviando email para:", mentionedUser.email);

    const { data: emailData, error: emailError } = await resend.emails.send({
      from: "think•meo <noreply@thinkmeo.com>",
      to: [mentionedUser.email],
      subject: `🔔 ${mentioner.full_name} mencionou você em ${projectName}`,
      html: emailHtml,
      attachments: [
        {
          path: logoUrl,
          filename: "logo-email.png",
          content: "app-logo",
        },
      ],
    });

    console.log("📎 Anexo inline enviado:", { logoUrl, emailId: emailData?.id });

    if (emailError) {
      console.error("❌ Erro ao enviar email:", emailError);
      throw emailError;
    }

    console.log("✅ Email enviado com sucesso:", emailData?.id);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Email de menção enviado com sucesso",
        email_id: emailData?.id,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error: any) {
    console.error("❌ Erro ao processar email de menção:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "Erro ao enviar email de menção",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
