import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MessageSquare, Send, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { MentionInput } from "./MentionInput";

interface Comment {
  id: string;
  content: string;
  created_at: string;
  author_id: string;
  author?: {
    full_name: string;
    avatar_url: string | null;
    email: string;
  };
}

interface BriefingCommentsProps {
  briefingId: string;
  projectId: string;
  noCard?: boolean;
  readOnly?: boolean;
}

export const BriefingComments = ({ briefingId, projectId, noCard = false, readOnly = false }: BriefingCommentsProps) => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { profile } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    loadComments();

    // Subscribe to real-time updates
    const channel = supabase
      .channel(`briefing-comments-${briefingId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'comments',
          filter: `material_id=eq.${briefingId}`
        },
        () => {
          loadComments();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [briefingId]);

  const loadComments = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('comments')
        .select(`
          id,
          content,
          created_at,
          author_id
        `)
        .eq('material_id', briefingId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Buscar perfis dos autores separadamente
      if (data && data.length > 0) {
        const authorIds = [...new Set(data.map(c => c.author_id))];
        
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url, email')
          .in('id', authorIds);

        if (profilesError) throw profilesError;

        // Mapear profiles para os comentários
        const commentsWithAuthors = data.map(comment => ({
          ...comment,
          author: profiles?.find(p => p.id === comment.author_id)
        }));

        setComments(commentsWithAuthors as Comment[]);
      } else {
        setComments([]);
      }
    } catch (error) {
      console.error('Erro ao carregar comentários:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitComment = async () => {
    if (!newComment.trim() || !profile) return;

    try {
      setSubmitting(true);

      const { error } = await supabase
        .from('comments')
        .insert({
          material_id: briefingId,
          author_id: profile.id,
          content: newComment.trim()
        });

      if (error) throw error;

      setNewComment("");
      
      toast({
        title: "Comentário adicionado",
        description: "Seu comentário foi publicado com sucesso"
      });
    } catch (error) {
      console.error('Erro ao adicionar comentário:', error);
      toast({
        title: "Erro",
        description: "Erro ao adicionar comentário",
        variant: "destructive"
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      const { error } = await supabase
        .from('comments')
        .delete()
        .eq('id', commentId);

      if (error) throw error;

      toast({
        title: "Comentário removido",
        description: "O comentário foi excluído"
      });
    } catch (error) {
      console.error('Erro ao deletar comentário:', error);
      toast({
        title: "Erro",
        description: "Erro ao deletar comentário",
        variant: "destructive"
      });
    }
  };

  const commentsContent = (
    <div className="space-y-4">
      {/* New Comment Form - Only show if not readOnly */}
      {!readOnly && (
        <div className="space-y-2">
          <MentionInput
            value={newComment}
            onChange={setNewComment}
            projectId={projectId}
            placeholder="Adicione um comentário..."
            className="min-h-[80px]"
          />
          <div className="flex justify-end">
            <Button
              onClick={handleSubmitComment}
              disabled={!newComment.trim() || submitting}
              size="sm"
            >
              <Send className="h-4 w-4 mr-2" />
              {submitting ? "Enviando..." : "Comentar"}
            </Button>
          </div>
        </div>
      )}

      {/* Comments List */}
      {loading ? (
        <div className="text-center py-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto"></div>
        </div>
      ) : comments.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          Nenhum comentário ainda
        </div>
      ) : (
        <div className="space-y-4">
          {comments.map((comment) => (
            <div key={comment.id} className="flex gap-3 group">
              <Avatar className="h-8 w-8">
                <AvatarImage src={comment.author?.avatar_url || undefined} />
                <AvatarFallback>
                  {comment.author?.full_name?.substring(0, 2).toUpperCase() || "??"}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">
                      {comment.author?.full_name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(comment.created_at), {
                        addSuffix: true,
                        locale: ptBR
                      })}
                    </span>
                  </div>
                  {(profile?.id === comment.author_id || profile?.role === 'admin' || profile?.role === 'collaborator') && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteComment(comment.id)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {comment.content}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  if (noCard) {
    return commentsContent;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Comentários ({comments.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {commentsContent}
      </CardContent>
    </Card>
  );
};
