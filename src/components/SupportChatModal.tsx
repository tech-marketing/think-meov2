import { useState, useEffect, useRef } from 'react';
import { X, Send, Loader2 } from 'lucide-react';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { ScrollArea } from './ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { useSupportChat } from '@/hooks/useSupportChat';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ThinkMeoLogo } from "@/components/ThinkMeoLogo";
interface SupportChatModalProps {
  onClose: () => void;
}
export const SupportChatModal = ({
  onClose
}: SupportChatModalProps) => {
  const {
    user,
    profile
  } = useAuth();
  const [message, setMessage] = useState('');
  const [supportUserId, setSupportUserId] = useState<string | null>(null);
  const [supportAvatarUrl, setSupportAvatarUrl] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | undefined>(undefined);
  const scrollRef = useRef<HTMLDivElement>(null);
  const initRef = useRef(false);
  const {
    messages,
    conversation,
    loading,
    sending,
    getOrCreateConversation,
    sendMessage: sendSupportMessage,
    markMessagesAsRead
  } = useSupportChat(conversationId);

  // Get support user ID and avatar using RPC to avoid RLS issues
  useEffect(() => {
    const fetchSupportUser = async () => {
      const {
        data,
        error
      } = await supabase.rpc('get_support_user_id');
      if (error) {
        console.error('Erro ao buscar usuário de suporte:', error);
        return;
      }
      if (data) {
        setSupportUserId(data);

        // Buscar avatar do usuário de suporte
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('avatar_url')
          .eq('user_id', data)
          .single();

        if (!profileError && profileData) {
          setSupportAvatarUrl(profileData.avatar_url);
        }
      }
    };
    fetchSupportUser();
  }, []);

  // Initialize conversation (only once)
  useEffect(() => {
    const initConversation = async () => {
      if (!supportUserId || !user || initRef.current) return;
      initRef.current = true;
      const conv = await getOrCreateConversation(supportUserId);
      if (conv) {
        setConversationId(conv.id);
      }
    };
    initConversation();
  }, [supportUserId, user]);

  // Mark messages as read
  useEffect(() => {
    if (conversation?.id) {
      markMessagesAsRead(conversation.id);
    }
  }, [conversation?.id, messages.length, markMessagesAsRead]);

  // Auto scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({
        behavior: 'smooth'
      });
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
  return <div className="fixed inset-0 md:inset-auto md:bottom-6 md:right-24 md:w-96 md:h-[600px] bg-background border md:rounded-lg shadow-xl z-50 flex flex-col">
    {/* Header */}
    <div className="flex items-center justify-between p-4 border-b">
      <div className="flex items-center gap-3">
        <Avatar className="h-10 w-10">
          <AvatarImage src={supportAvatarUrl || ""} />
          <AvatarFallback>TS</AvatarFallback>
        </Avatar>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-semibold">Suporte</span>
            <ThinkMeoLogo size="sm" />
          </div>
        </div>
      </div>
      <Button variant="ghost" size="icon" onClick={onClose}>
        <X className="h-5 w-5" />
      </Button>
    </div>

    {/* Messages */}
    <ScrollArea className="flex-1 p-4">
      {loading ? <div className="flex items-center justify-center h-full">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div> : messages.length === 0 ? <div className="flex items-center justify-center h-full text-center">
        <div>
          <p className="text-muted-foreground mb-2">
            Nenhuma mensagem ainda
          </p>
          <p className="text-sm text-muted-foreground">
            Envie uma mensagem para iniciar a conversa
          </p>
        </div>
      </div> : <div className="space-y-4">
        {messages.map(msg => {
          const isOwn = msg.sender_id === user?.id;
          return <div key={msg.id} className={`flex gap-2 ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
            <Avatar className="h-8 w-8">
              <AvatarImage src={msg.sender?.avatar_url} />
              <AvatarFallback>
                {msg.sender?.full_name?.[0] || '?'}
              </AvatarFallback>
            </Avatar>
            <div className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'} max-w-[75%]`}>
              <div className={`px-3 py-2 rounded-lg ${isOwn ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
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
          </div>;
        })}
        <div ref={scrollRef} />
      </div>}
    </ScrollArea>

    {/* Input */}
    <div className="p-4 border-t">
      <div className="flex gap-2">
        <Textarea value={message} onChange={e => setMessage(e.target.value)} onKeyDown={handleKeyDown} placeholder="Digite sua dúvida" disabled={sending || loading} className="min-h-[80px] max-h-[200px] resize-none" />
        <Button onClick={handleSend} disabled={!message.trim() || sending || loading} size="icon" className="self-end">
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  </div>;
};