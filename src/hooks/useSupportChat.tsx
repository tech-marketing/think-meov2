import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface SupportMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  is_read: boolean;
  created_at: string;
  sender?: {
    full_name: string;
    avatar_url?: string;
  };
}

export interface SupportConversation {
  id: string;
  user_id: string;
  support_user_id: string;
  status: 'open' | 'closed';
  last_message_at: string;
  created_at: string;
}

export const useSupportChat = (conversationId?: string) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [conversation, setConversation] = useState<SupportConversation | null>(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  const fetchMessages = async (convId: string) => {
    try {
      const { data, error } = await supabase
        .from('support_messages')
        .select('*')
        .eq('conversation_id', convId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Fetch sender details for each message
      const messagesWithSender = await Promise.all(
        (data || []).map(async (msg) => {
          const { data: sender } = await supabase
            .from('profiles')
            .select('full_name, avatar_url')
            .eq('user_id', msg.sender_id)
            .maybeSingle();

          return {
            ...msg,
            sender: sender || undefined
          };
        })
      );

      setMessages(messagesWithSender);
    } catch (error) {
      console.error('Error fetching messages:', error);
      toast.error('Erro ao carregar mensagens');
    }
  };

  const getOrCreateConversation = async (supportUserId: string) => {
    if (!user) {
      console.log('getOrCreateConversation: user não disponível');
      return null;
    }

    console.log('getOrCreateConversation:', { user_id: user.id, support_user_id: supportUserId });

    setLoading(true);
    try {
      // Use upsert to handle race conditions
      const { data: conv, error } = await supabase
        .from('support_conversations')
        .upsert(
          {
            user_id: user.id,
            support_user_id: supportUserId,
            status: 'open'
          },
          { 
            onConflict: 'user_id,support_user_id',
            ignoreDuplicates: false 
          }
        )
        .select()
        .single();

      if (error) {
        console.error('Erro ao criar/buscar conversa:', error);
        throw error;
      }

      console.log('Conversa obtida:', conv.id);
      setConversation(conv as SupportConversation);
      await fetchMessages(conv.id);
      return conv as SupportConversation;
    } catch (error) {
      console.error('Error getting/creating conversation:', error);
      toast.error('Erro ao iniciar conversa');
      return null;
    } finally {
      setLoading(false);
    }
  };

  const checkAndSendAutoReply = async (convId: string, messageId?: string) => {
    if (!user) return;
    
    try {
      console.log('Chamando edge function support-auto-reply...');
      
      const { data, error } = await supabase.functions.invoke('support-auto-reply', {
        body: {
          conversation_id: convId,
          sender_id: user.id,
          message_id: messageId || ''
        }
      });

      if (error) {
        console.error('Erro na edge function support-auto-reply:', error);
        return;
      }

      console.log('Resultado support-auto-reply:', data);

      // Se a função enviou auto-reply, recarregar mensagens para exibir
      if (data?.message_sent) {
        console.log('Auto-reply enviada! Recarregando mensagens...');
        await fetchMessages(convId);
      }
    } catch (error) {
      console.error('Erro no checkAndSendAutoReply:', error);
    }
  };

  const sendMessage = async (content: string) => {
    const targetConvId = conversation?.id || conversationId;
    
    if (!user || !targetConvId) {
      console.log('sendMessage: Não é possível enviar - user:', !!user, 'conversationId:', !!targetConvId);
      return;
    }
    if (content.trim().length === 0) {
      toast.error('Mensagem não pode estar vazia');
      return;
    }

    console.log('Enviando mensagem...', { 
      conversation_id: targetConvId, 
      sender_id: user.id, 
      content_length: content.length 
    });

    setSending(true);
    try {
      const { data: inserted, error } = await supabase
        .from('support_messages')
        .insert({
          conversation_id: targetConvId,
          sender_id: user.id,
          content: content.trim()
        })
        .select('id')
        .single();

      if (error) {
        console.error('Erro ao inserir mensagem:', error);
        throw error;
      }
      
      console.log('Mensagem enviada com sucesso!');
      
      // Fetch messages to ensure sender sees their message even if realtime is delayed
      await fetchMessages(targetConvId);
      
      // Verificar e enviar auto-reply se necessário
      await checkAndSendAutoReply(targetConvId, inserted?.id);
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Erro ao enviar mensagem');
    } finally {
      setSending(false);
    }
  };

  const markMessagesAsRead = async (convId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('support_messages')
        .update({ is_read: true })
        .eq('conversation_id', convId)
        .neq('sender_id', user.id)
        .eq('is_read', false);

      if (error) throw error;
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  };

  const getUnreadCount = async () => {
    const targetConvId = conversation?.id || conversationId;
    if (!user || !targetConvId) return 0;

    try {
      const { count, error } = await supabase
        .from('support_messages')
        .select('*', { count: 'exact', head: true })
        .eq('conversation_id', targetConvId)
        .neq('sender_id', user.id)
        .eq('is_read', false);

      if (error) throw error;
      return count || 0;
    } catch (error) {
      console.error('Error getting unread count:', error);
      return 0;
    }
  };

  // Fetch conversation details when conversationId is provided
  useEffect(() => {
    if (conversationId) {
      const loadConversation = async () => {
        const { data } = await supabase
          .from('support_conversations')
          .select('*')
          .eq('id', conversationId)
          .single();
        
        if (data) {
          setConversation(data as SupportConversation);
        }
      };
      
      loadConversation();
      fetchMessages(conversationId);
      markMessagesAsRead(conversationId);
    }
  }, [conversationId]);

  // Subscribe to new messages
  useEffect(() => {
    if (!conversationId) return;

    const channel = supabase
      .channel(`support_messages:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'support_messages',
          filter: `conversation_id=eq.${conversationId}`
        },
        async (payload) => {
          const newMessage = payload.new as SupportMessage;
          
          // Fetch sender details
          const { data: sender } = await supabase
            .from('profiles')
            .select('full_name, avatar_url')
            .eq('user_id', newMessage.sender_id)
            .maybeSingle();

          setMessages(prev => [...prev, { ...newMessage, sender: sender || undefined }]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId]);

  return {
    messages,
    conversation,
    loading,
    sending,
    getOrCreateConversation,
    sendMessage,
    markMessagesAsRead,
    getUnreadCount
  };
};
