import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AutoReplyRequest {
  message_id: string;
  conversation_id: string;
  sender_id: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🤖 Support Auto-Reply Function iniciada');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Parse request body
    const { message_id, conversation_id, sender_id }: AutoReplyRequest = await req.json();
    
    console.log(`📨 Nova mensagem detectada:`, {
      message_id,
      conversation_id,
      sender_id
    });

    // Get conversation details including support user
    const { data: conversation, error: convError } = await supabase
      .from('support_conversations')
      .select('support_user_id, last_auto_reply_sent_at')
      .eq('id', conversation_id)
      .single();

    if (convError || !conversation) {
      console.error('❌ Erro ao buscar conversa:', convError);
      return new Response(
        JSON.stringify({ success: false, error: 'Conversation not found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    console.log('📋 Conversa encontrada:', {
      support_user_id: conversation.support_user_id,
      last_auto_reply_sent_at: conversation.last_auto_reply_sent_at
    });

    // Check if sender is the support user (if so, don't send auto-reply)
    if (sender_id === conversation.support_user_id) {
      console.log('⏭️ Mensagem enviada pelo suporte, ignorando auto-reply');
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: 'Message from support' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if 24 hours have passed since last auto-reply
    const now = new Date();
    const lastReply = conversation.last_auto_reply_sent_at 
      ? new Date(conversation.last_auto_reply_sent_at) 
      : null;

    const hoursElapsed = lastReply 
      ? (now.getTime() - lastReply.getTime()) / (1000 * 60 * 60)
      : Infinity;

    console.log(`⏰ Verificação de throttling:`, {
      last_auto_reply: lastReply?.toISOString() || 'nunca',
      hours_elapsed: hoursElapsed === Infinity ? 'primeira mensagem' : hoursElapsed.toFixed(2),
      should_send: hoursElapsed >= 24 || !lastReply
    });

    // If less than 24 hours, skip
    if (lastReply && hoursElapsed < 24) {
      console.log('⏸️ Throttling ativo, auto-reply bloqueada');
      console.log(`⏰ Próxima auto-reply permitida em: ${(24 - hoursElapsed).toFixed(2)} horas`);
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          skipped: true, 
          reason: 'Throttled (24h not elapsed)',
          next_allowed_in_hours: 24 - hoursElapsed
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Send auto-reply message
    console.log('✅ Enviando mensagem automática...');

    const autoReplyContent = `Olá! 👋

Recebemos sua mensagem e nossa equipe de suporte responderá em até 2 horas com atendimento humano.

Enquanto isso, descreva sua dúvida com o máximo de detalhes possível para que possamos ajudá-lo da melhor forma! 😊

Equipe think•`;

    const { data: newMessage, error: messageError } = await supabase
      .from('support_messages')
      .insert({
        conversation_id,
        sender_id: conversation.support_user_id,
        content: autoReplyContent,
        is_read: false
      })
      .select()
      .single();

    if (messageError) {
      console.error('❌ Erro ao enviar mensagem automática:', messageError);
      return new Response(
        JSON.stringify({ success: false, error: messageError.message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    console.log('✅ Mensagem automática enviada:', newMessage.id);

    // Update last_auto_reply_sent_at
    const { error: updateError } = await supabase
      .from('support_conversations')
      .update({ last_auto_reply_sent_at: now.toISOString() })
      .eq('id', conversation_id);

    if (updateError) {
      console.error('⚠️ Erro ao atualizar last_auto_reply_sent_at:', updateError);
      // Don't fail the request, message was sent successfully
    } else {
      console.log('✅ Campo last_auto_reply_sent_at atualizado');
    }

    console.log('🎉 Auto-reply processada com sucesso');

    return new Response(
      JSON.stringify({ 
        success: true, 
        message_sent: true,
        auto_reply_id: newMessage.id,
        next_allowed_at: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Erro geral na função:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
