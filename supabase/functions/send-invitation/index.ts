import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@4.0.0";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface InvitationRequest {
  email: string;
  role: string;
  companyId?: string;
  companyIds?: string[];
  adminName: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Check authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Token de autorização não fornecido');
    }

    const token = authHeader.replace('Bearer ', '');
    
    // Verify the JWT token and check user role
    const { data: { user: authUser }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !authUser) {
      throw new Error('Token de autorização inválido');
    }

    // Check if user is admin
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('user_id', authUser.id)
      .single();

    if (profileError || !profile || profile.role !== 'admin') {
      throw new Error('Acesso negado. Apenas administradores podem enviar convites');
    }

    const { email, role, companyId, companyIds, adminName }: InvitationRequest = await req.json();

    console.log("Tentando criar usuário para:", email, "com role:", role);

    // Gerar senha temporária
    const tempPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8).toUpperCase();
    
    console.log("Criando usuário para:", email);

    // Criar usuário no Supabase Auth
    const { data: newUser, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true // Auto-confirma o email
    });

    if (createUserError) {
      console.error("Erro de autenticação:", createUserError);
      
      // Verificar se o erro é de email já existente
      if (createUserError.message?.includes('already been registered') || 
          createUserError.message?.includes('email_exists') ||
          createUserError.message?.includes('User already registered')) {
        return new Response(JSON.stringify({ 
          error: "Este email já está cadastrado no sistema",
          success: false 
        }), {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        });
      }
      
      throw new Error(`Erro ao criar usuário: ${createUserError.message}`);
    }

    if (!newUser.user) {
      throw new Error('Usuário não foi criado corretamente');
    }

    // Hash da senha temporária para salvar no perfil
    const tempPasswordHash = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(tempPassword)
    );
    const hashBase64 = btoa(String.fromCharCode(...new Uint8Array(tempPasswordHash)));

    // Atualizar perfil com dados de convite
    const { error: updateProfileError } = await supabaseAdmin
      .from('profiles')
      .update({
        role: role as any,
        company_id: role === 'collaborator' ? null : (companyId || null),
        allowed_companies: role === 'collaborator' ? (companyIds || []) : [],
        invitation_status: 'pending',
        invitation_sent_at: new Date().toISOString(),
        temp_password_hash: hashBase64,
        first_login_required: true
      })
      .eq('user_id', newUser.user.id);

    if (updateProfileError) {
      throw new Error(`Erro ao atualizar perfil: ${updateProfileError.message}`);
    }

    console.log("Enviando email para:", email, "com senha temporária gerada");
    console.log("Resend API Key existe:", !!Deno.env.get("RESEND_API_KEY"));

    // Enviar email de convite
    const emailResponse = await resend.emails.send({
      from: "think•meo <noreply@thinkmeo.com>",
      to: [email],
      subject: "Convite de Acesso ao Sistema",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #2563eb; text-align: center;">Bem-vindo ao Sistema de Materiais</h1>
          
          <p>Olá!</p>
          
          <p><strong>${adminName}</strong> convidou você para acessar o Sistema de Materiais como <strong>${role === 'admin' ? 'Administrador' : role === 'collaborator' ? 'Colaborador' : 'Cliente'}</strong>.</p>
          
          <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #374151;">Suas credenciais de acesso:</h3>
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Senha temporária:</strong> <code style="background: #e5e7eb; padding: 4px 8px; border-radius: 4px;">${tempPassword}</code></p>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="https://6496b393-98dc-492b-9573-92137f2f9968.sandbox.lovable.dev/auth" 
               style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
              Acessar Sistema
            </a>
          </div>
          
          <p style="color: #6b7280; font-size: 14px;">
            <strong>Importante:</strong> Na primeira vez que você fizer login, será solicitado que altere sua senha para uma permanente e segura.
          </p>
          
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
          
          <p style="color: #9ca3af; font-size: 12px; text-align: center;">
            Se você não esperava este convite, pode ignorar este email com segurança.
          </p>
        </div>
      `,
    });

    console.log("Tentativa de envio de email finalizada");
    console.log("Resposta do Resend:", JSON.stringify(emailResponse, null, 2));

    if (emailResponse.error) {
      console.error("Erro específico do Resend:", JSON.stringify(emailResponse.error, null, 2));
      throw new Error(`Erro ao enviar email: ${emailResponse.error.message || JSON.stringify(emailResponse.error)}`);
    }

    if (!emailResponse.data || !emailResponse.data.id) {
      console.error("Resposta inválida do Resend - dados:", JSON.stringify(emailResponse.data, null, 2));
      throw new Error(`Erro ao enviar email: Resposta inválida do Resend`);
    }

    console.log("Convite enviado com sucesso:", {
      userId: newUser.user.id,
      email,
      role,
      emailId: emailResponse.data?.id
    });

    return new Response(JSON.stringify({ 
      success: true, 
      userId: newUser.user.id,
      message: "Convite enviado com sucesso!" 
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });

  } catch (error: any) {
    console.error("Erro na função send-invitation:", error);
    
    return new Response(
      JSON.stringify({ 
        error: error.message || "Erro interno do servidor",
        success: false 
      }),
      {
        status: 500,
        headers: { 
          "Content-Type": "application/json", 
          ...corsHeaders 
        },
      }
    );
  }
};

serve(handler);