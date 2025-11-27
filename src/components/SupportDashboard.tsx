import { useState } from 'react';
import { X, Search, MessageCircle } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { ScrollArea } from './ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { useSupportConversations } from '@/hooks/useSupportConversations';
import { SupportConversationView } from './SupportConversationView';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface SupportDashboardProps {
  onClose: () => void;
}

export const SupportDashboard = ({ onClose }: SupportDashboardProps) => {
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const {
    conversations,
    loading,
    filter,
    setFilter,
    getTotalUnreadCount
  } = useSupportConversations();

  const filteredConversations = conversations.filter((conv) =>
    conv.user?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    conv.user?.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (selectedConversationId) {
    return (
      <SupportConversationView
        conversationId={selectedConversationId}
        onBack={() => setSelectedConversationId(null)}
      />
    );
  }

  return (
    <div className="fixed inset-0 md:inset-auto md:bottom-6 md:right-24 md:w-[500px] md:h-[700px] bg-background border md:rounded-lg shadow-xl z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-3">
          <MessageCircle className="h-6 w-6 text-primary" />
          <div>
            <h2 className="font-semibold text-lg">Suporte</h2>
            <p className="text-xs text-muted-foreground">
              {getTotalUnreadCount()} mensagens não lidas
            </p>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-5 w-5" />
        </Button>
      </div>

      {/* Search */}
      <div className="p-4 border-b">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por nome ou email..."
            className="pl-10"
          />
        </div>
      </div>

      {/* Filters */}
      <Tabs value={filter} onValueChange={(v) => setFilter(v as any)} className="flex-1 flex flex-col">
        <TabsList className="mx-4 mt-2">
          <TabsTrigger value="all">Todas</TabsTrigger>
          <TabsTrigger value="open">Abertas</TabsTrigger>
          <TabsTrigger value="closed">Fechadas</TabsTrigger>
        </TabsList>

        {/* Conversations List */}
        <TabsContent value={filter} className="flex-1 m-0">
          <ScrollArea className="h-full">
            {loading ? (
              <div className="flex items-center justify-center h-32">
                <p className="text-muted-foreground">Carregando...</p>
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="flex items-center justify-center h-32">
                <p className="text-muted-foreground">
                  {searchQuery ? 'Nenhuma conversa encontrada' : 'Nenhuma conversa ainda'}
                </p>
              </div>
            ) : (
              <div className="divide-y">
                {filteredConversations.map((conv) => (
                  <button
                    key={conv.id}
                    onClick={() => setSelectedConversationId(conv.id)}
                    className="w-full p-4 hover:bg-muted/50 transition-colors text-left"
                  >
                    <div className="flex gap-3">
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={conv.user?.avatar_url} />
                        <AvatarFallback>
                          {conv.user?.full_name?.[0] || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <p className="font-semibold truncate">
                            {conv.user?.full_name || 'Usuário'}
                          </p>
                          <span className="text-xs text-muted-foreground whitespace-nowrap ml-2">
                            {formatDistanceToNow(new Date(conv.last_message_at), {
                              addSuffix: true,
                              locale: ptBR
                            })}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground truncate mb-1">
                          {conv.user?.email || ''}
                        </p>
                        {conv.last_message && (
                          <p className="text-sm text-muted-foreground truncate">
                            {conv.last_message.content}
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-2">
                          <Badge variant={conv.status === 'open' ? 'default' : 'secondary'}>
                            {conv.status === 'open' ? 'Aberta' : 'Fechada'}
                          </Badge>
                          {(conv.unread_count || 0) > 0 && (
                            <Badge variant="destructive">
                              {conv.unread_count} nova{conv.unread_count > 1 ? 's' : ''}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
};
