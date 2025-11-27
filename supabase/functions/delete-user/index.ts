import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface DeleteUserRequest {
  userId: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get the authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('Missing or invalid authorization header');
      return new Response(
        JSON.stringify({ 
          error: "Token de autorização não fornecido",
          success: false 
        }),
        {
          status: 401,
          headers: { 
            "Content-Type": "application/json", 
            ...corsHeaders 
          },
        }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    console.log('Token received, length:', token.length);
    
    // Get current user from the token using admin client
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    
    if (userError || !user) {
      console.error('Error getting user from token:', userError);
      return new Response(
        JSON.stringify({ 
          error: "Token de autorização inválido",
          success: false 
        }),
        {
          status: 401,
          headers: { 
            "Content-Type": "application/json", 
            ...corsHeaders 
          },
        }
      );
    }

    // Check if user is admin
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (profileError || !profile || profile.role !== 'admin') {
      console.error('Access denied - user is not admin:', { profileError, profile });
      return new Response(
        JSON.stringify({ 
          error: "Acesso negado. Apenas administradores podem deletar usuários",
          success: false 
        }),
        {
          status: 403,
          headers: { 
            "Content-Type": "application/json", 
            ...corsHeaders 
          },
        }
      );
    }

    const { userId }: DeleteUserRequest = await req.json();

    if (!userId) {
      return new Response(
        JSON.stringify({ 
          error: "ID do usuário é obrigatório",
          success: false 
        }),
        {
          status: 400,
          headers: { 
            "Content-Type": "application/json", 
            ...corsHeaders 
          },
        }
      );
    }

    console.log("Deletando usuário:", userId);

    // Limpar referências que impedem a exclusão (ex.: materials.reviewed_by)
    try {
      const { data: prof } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle();

      if (prof?.id) {
        // Remover vínculo de revisão para não bloquear a deleção por FK
        const { error: clearReviewedError } = await supabaseAdmin
          .from('materials')
          .update({ reviewed_by: null, reviewed_at: null })
          .eq('reviewed_by', prof.id);
        if (clearReviewedError) {
          console.warn('Aviso: não foi possível limpar reviewed_by:', clearReviewedError);
        }
      }
    } catch (cleanupErr) {
      console.warn('Aviso durante limpeza de referências antes da exclusão:', cleanupErr);
    }

    // Deletar usuário do Supabase Auth usando o cliente admin
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);

    if (deleteError) {
      console.error('Error deleting user from auth:', deleteError);
      return new Response(
        JSON.stringify({ 
          error: `Erro ao deletar usuário da auth: ${deleteError.message}`,
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

    console.log("Usuário deletado com sucesso:", userId);

    return new Response(JSON.stringify({ 
      success: true, 
      message: "Usuário deletado com sucesso!" 
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });

  } catch (error: any) {
    console.error("Erro na função delete-user:", error);
    
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