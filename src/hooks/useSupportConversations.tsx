import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface ConversationWithUser {
  id: string;
  user_id: string;
  support_user_id: string;
  status: 'open' | 'closed';
  last_message_at: string;
  created_at: string;
  user: {
    full_name: string;
    email: string;
    avatar_url?: string;
  };
  unread_count?: number;
  last_message?: {
    content: string;
    sender_id: string;
  };
}

export const useSupportConversations = () => {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<ConversationWithUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<'all' | 'open' | 'closed'>('open');

  const fetchConversations = async () => {
    if (!user) return;

    setLoading(true);
    try {
      let query = supabase
        .from('support_conversations')
        .select('*')
        .eq('support_user_id', user.id)
        .order('last_message_at', { ascending: false });

      if (filter !== 'all') {
        query = query.eq('status', filter);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Fetch unread count, last message, and user details for each conversation
      const conversationsWithDetails = await Promise.all(
        (data || []).map(async (conv) => {
          // Get user details via RPC to bypass RLS
          const { data: userProfile } = await supabase
            .rpc('get_conversation_user_profile', { _conversation_id: conv.id });

          // Get unread count
          const { count } = await supabase
            .from('support_messages')
            .select('*', { count: 'exact', head: true })
            .eq('conversation_id', conv.id)
            .neq('sender_id', user.id)
            .eq('is_read', false);

          // Get last message
          const { data: lastMsg } = await supabase
            .from('support_messages')
            .select('content, sender_id')
            .eq('conversation_id', conv.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          return {
            ...conv,
            user: userProfile?.[0] || { full_name: 'Unknown', email: '', avatar_url: undefined },
            unread_count: count || 0,
            last_message: lastMsg || undefined
          } as ConversationWithUser;
        })
      );

      setConversations(conversationsWithDetails);
    } catch (error) {
      console.error('Error fetching conversations:', error);
      toast.error('Erro ao carregar conversas');
    } finally {
      setLoading(false);
    }
  };

  const closeConversation = async (conversationId: string) => {
    try {
      const { error } = await supabase
        .from('support_conversations')
        .update({ status: 'closed' })
        .eq('id', conversationId);

      if (error) throw error;
      toast.success('Conversa fechada');
      fetchConversations();
    } catch (error) {
      console.error('Error closing conversation:', error);
      toast.error('Erro ao fechar conversa');
    }
  };

  const reopenConversation = async (conversationId: string) => {
    try {
      const { error } = await supabase
        .from('support_conversations')
        .update({ status: 'open' })
        .eq('id', conversationId);

      if (error) throw error;
      toast.success('Conversa reaberta');
      fetchConversations();
    } catch (error) {
      console.error('Error reopening conversation:', error);
      toast.error('Erro ao reabrir conversa');
    }
  };

  const getTotalUnreadCount = () => {
    return conversations.reduce((acc, conv) => acc + (conv.unread_count || 0), 0);
  };

  // Subscribe to conversation changes
  useEffect(() => {
    if (!user) return;

    fetchConversations();

    const channel = supabase
      .channel('support_conversations_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'support_conversations',
          filter: `support_user_id=eq.${user.id}`
        },
        () => {
          fetchConversations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, filter]);

  return {
    conversations,
    loading,
    filter,
    setFilter,
    closeConversation,
    reopenConversation,
    getTotalUnreadCount,
    refreshConversations: fetchConversations
  };
};
