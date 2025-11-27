import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Send, Loader2, Lock, Unlock } from 'lucide-react';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { ScrollArea } from './ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Badge } from './ui/badge';
import { useSupportChat } from '@/hooks/useSupportChat';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

interface SupportConversationViewProps {
  conversationId: string;
  onBack: () => void;
}

export const SupportConversationView = ({
  conversationId,
  onBack
}: SupportConversationViewProps) => {
  const { user } = useAuth();
  const [message, setMessage] = useState('');
  const [conversationDetails, setConversationDetails] = useState<any>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const {
    messages,
    conversation,
    sending,
    sendMessage: sendSupportMessage,
    markMessagesAsRead
  } = useSupportChat(conversationId);

  // Fetch conversation details
  useEffect(() => {
    const fetchDetails = async () => {
      // Fetch conversation without join to avoid RLS issues
      const { data: conv, error: convErr } = await supabase
        .from('support_conversations')
        .select('*')
        .eq('id', conversationId)
        .maybeSingle();

      if (convErr || !conv) {
        console.error('Error fetching conversation:', convErr);
        toast.error('Erro ao carregar conversa');
        // Set fallback to prevent infinite loading
        setConversationDetails({
          id: conversationId,
          status: 'open',
          user: { full_name: 'Usuário', email: '', avatar_url: null }
        });
        return;
      }

      // Fetch user profile via RPC to bypass RLS
      const { data: profile } = await supabase
        .rpc('get_conversation_user_profile', { _conversation_id: conversationId });

      setConversationDetails({
        ...conv,
        user: profile?.[0] ?? { full_name: 'Usuário', email: '', avatar_url: null }
      });
    };

    fetchDetails();
  }, [conversationId]);

  // Mark messages as read
  useEffect(() => {
    if (conversationId) {
      markMessagesAsRead(conversationId);
    }
  }, [conversationId, messages.length]);

  // Auto scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const handleSend = async () => {
    if (!message.trim() || sending) return;

    await sendSupportMessage(message);
    setMessage('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const toggleConversationStatus = async () => {
    if (!conversationId) return;

    const newStatus = conversationDetails.status === 'open' ? 'closed' : 'open';

    try {
      const { error } = await supabase
        .from('support_conversations')
        .update({ status: newStatus })
        .eq('id', conversationId);

      if (error) throw error;

      toast.success(
        newStatus === 'closed' ? 'Conversa fechada' : 'Conversa reaberta'
      );

      setConversationDetails({ ...conversationDetails, status: newStatus });
    } catch (error) {
      console.error('Error toggling conversation status:', error);
      toast.error('Erro ao alterar status da conversa');
    }
  };

  if (!conversationDetails) {
    return (
      <div className="fixed inset-0 md:inset-auto md:bottom-6 md:right-24 md:w-[500px] md:h-[700px] bg-background border md:rounded-lg shadow-xl z-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 md:inset-auto md:bottom-6 md:right-24 md:w-[500px] md:h-[700px] bg-background border md:rounded-lg shadow-xl z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-3 flex-1">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <Avatar className="h-10 w-10">
            <AvatarImage src={conversationDetails.user?.avatar_url} />
            <AvatarFallback>
              {conversationDetails.user?.full_name?.[0] || 'U'}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="font-semibold truncate">
              {conversationDetails.user?.full_name || 'Usuário'}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {conversationDetails.user?.email || ''}
            </p>
          </div>
          <Badge variant={conversationDetails.status === 'open' ? 'default' : 'secondary'}>
            {conversationDetails.status === 'open' ? 'Aberta' : 'Fechada'}
          </Badge>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-center">
            <p className="text-muted-foreground">Nenhuma mensagem ainda</p>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg) => {
              const isOwn = msg.sender_id === user?.id;
              return (
                <div
                  key={msg.id}
                  className={`flex gap-2 ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}
                >
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={msg.sender?.avatar_url} />
                    <AvatarFallback>
                      {msg.sender?.full_name?.[0] || '?'}
                    </AvatarFallback>
                  </Avatar>
                  <div className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'} max-w-[75%]`}>
                    <div
                      className={`px-3 py-2 rounded-lg ${
                        isOwn
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted'
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap break-words">
                        {msg.content}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground mt-1">
                      {formatDistanceToNow(new Date(msg.created_at), {
                        addSuffix: true,
                        locale: ptBR
                      })}
                    </span>
                  </div>
                </div>
              );
            })}
            <div ref={scrollRef} />
          </div>
        )}
      </ScrollArea>

      {/* Actions */}
      <div className="p-4 border-t space-y-2">
        <Button
          onClick={toggleConversationStatus}
          variant="outline"
          className="w-full"
        >
          {conversationDetails.status === 'open' ? (
            <>
              <Lock className="h-4 w-4 mr-2" />
              Fechar Conversa
            </>
          ) : (
            <>
              <Unlock className="h-4 w-4 mr-2" />
              Reabrir Conversa
            </>
          )}
        </Button>

        <div className="flex gap-2">
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={conversationDetails.status === 'closed' ? 'Conversa fechada' : 'Digite sua mensagem... (Enter para enviar)'}
            disabled={sending || conversationDetails.status === 'closed'}
            className="min-h-[80px] max-h-[200px] resize-none"
          />
          <Button
            onClick={handleSend}
            disabled={!message.trim() || sending || conversationDetails.status === 'closed'}
            size="icon"
            className="self-end"
          >
            {sending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};
