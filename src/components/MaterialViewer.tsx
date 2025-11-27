import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { StatusBadge, MaterialStatus } from "./StatusBadge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ThumbsUp, MessageSquare, Download, Clock, User, Send, AlertTriangle, X, Reply, ChevronRight, RefreshCw, History, Pencil, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { DeleteMaterialModal } from "./DeleteMaterialModal";
import { MaterialCarousel } from "./MaterialCarousel";
import { MentionInput } from "./MentionInput";
import { ChangeMaterialModal } from "./ChangeMaterialModal";
import { MaterialVersionsModal } from "./MaterialVersionsModal";
import { WireframeViewer } from "./WireframeViewer";
import { WireframeEditor } from "./WireframeEditor";
import { WireframePreview } from "./WireframePreview";
import { WireframeHTMLPreview } from "./WireframeHTMLPreview";
import { CommentWithMentions } from "./CommentWithMentions";
import { VideoGenerationProgress } from "./VideoGenerationProgress";
import { VideoPlayerWithCaption } from "./VideoPlayerWithCaption";
interface Comment {
  id: string;
  author: string;
  author_avatar?: string | null;
  content: string;
  timestamp: string;
  isClient?: boolean;
  replies?: Comment[];
}
interface MaterialViewerProps {
  id: string;
  name: string;
  type: 'image' | 'video' | 'pdf' | 'wireframe' | 'carousel';
  status: MaterialStatus;
  client: string;
  project?: string;
  projectId?: string;
  uploadDate: string;
  comments?: Comment[];
  fileUrl?: string;
  caption?: string;
  reference?: string;
  isRunning?: boolean;
  wireframeData?: any;
  className?: string;
  onStatusUpdate?: () => void;
}
export const MaterialViewer = ({
  id,
  name,
  type,
  status,
  client,
  project,
  projectId,
  uploadDate,
  comments = [],
  fileUrl,
  caption,
  reference,
  isRunning = true,
  wireframeData,
  className,
  onStatusUpdate
}: MaterialViewerProps) => {
  const [newComment, setNewComment] = useState("");
  const [currentStatus, setCurrentStatus] = useState<MaterialStatus>(status);
  const [loading, setLoading] = useState(false);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState("");
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [mentionedUsers, setMentionedUsers] = useState<any[]>([]);
  const [isProjectParticipant, setIsProjectParticipant] = useState<boolean>(false);
  const [participantCheckLoading, setParticipantCheckLoading] = useState(true);
  const [versionCount, setVersionCount] = useState(0);
  const [showChangeModal, setShowChangeModal] = useState(false);
  const [showVersionsModal, setShowVersionsModal] = useState(false);
  const [currentIsRunning, setCurrentIsRunning] = useState(isRunning);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(name);
  const {
    toast
  } = useToast();
  const {
    profile
  } = useAuth();
  const navigate = useNavigate();
  const [highlightedCommentId, setHighlightedCommentId] = useState<string | null>(null);

  // Scroll automático para comentário quando há hash na URL
  useEffect(() => {
    const hash = window.location.hash;
    if (!hash.startsWith('#comment-')) return;
    const commentId = hash.replace('#comment-', '');

    // Verificar se o comentário é uma resposta e precisa expandir o pai
    let isReply = false;
    let parentCommentId: string | null = null;
    comments.forEach(comment => {
      const reply = comment.replies?.find(r => r.id === commentId);
      if (reply) {
        isReply = true;
        parentCommentId = comment.id;
      }
    });

    // Se for resposta, expandir o comentário pai primeiro
    if (isReply && parentCommentId) {
      setShowAllReplies(prev => ({
        ...prev,
        [parentCommentId]: true
      }));
    }

    // Aguardar renderização completa
    const timeoutId = setTimeout(() => {
      const commentElement = document.getElementById(`comment-${commentId}`);
      if (commentElement) {
        commentElement.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
          inline: 'nearest'
        });
        setHighlightedCommentId(commentId);
        const highlightTimeout = setTimeout(() => {
          setHighlightedCommentId(null);
        }, 3000);
        return () => clearTimeout(highlightTimeout);
      }
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }, 500);
    return () => clearTimeout(timeoutId);
  }, [comments]);

  // Verificar se o usuário é participante do projeto
  useEffect(() => {
    const checkProjectParticipation = async () => {
      if (!projectId || !profile?.user_id) {
        setIsProjectParticipant(false);
        setParticipantCheckLoading(false);
        return;
      }
      try {
        const {
          data,
          error
        } = await supabase.from('project_participants').select('id').eq('project_id', projectId).eq('user_id', profile.user_id).maybeSingle();
        if (error) {
          console.error('Erro ao verificar participação no projeto:', error);
          setIsProjectParticipant(false);
        } else {
          setIsProjectParticipant(!!data);
        }
      } catch (error) {
        console.error('Erro ao verificar participação no projeto:', error);
        setIsProjectParticipant(false);
      } finally {
        setParticipantCheckLoading(false);
      }
    };
    checkProjectParticipation();
  }, [projectId, profile?.user_id]);
  useEffect(() => {
    setCurrentStatus(status);
  }, [status]);
  useEffect(() => {
    setCurrentIsRunning(isRunning);
  }, [isRunning]);
  useEffect(() => {
    setEditedName(name);
  }, [name]);
  useEffect(() => {
    console.log('MaterialViewer recebeu comentários:', comments);
    console.log('DEBUG - MaterialViewer:', {
      profile: profile,
      profileRole: profile?.role,
      currentStatus: currentStatus,
      loading: loading
    });
  }, [comments, profile, currentStatus, loading]);

  // Para URLs do Google Cloud Storage, usar diretamente
  useEffect(() => {
    if (fileUrl) {
      console.log('MaterialViewer - fileUrl detectada:', fileUrl);

      // Verificar se é um JSON com múltiplos arquivos (carrossel)
      try {
        const parsedFiles = JSON.parse(fileUrl);
        if (Array.isArray(parsedFiles)) {
          console.log('MaterialViewer - Múltiplos arquivos detectados para carrossel:', parsedFiles);
          // Usar o primeiro arquivo como URL principal para compatibilidade
          setSignedUrl(parsedFiles[0]?.url || fileUrl);
          return;
        }
      } catch (e) {
        // Se não for JSON válido, continuar com lógica normal
      }

      // Se for URL do Google Cloud Storage, usar diretamente
      if (fileUrl.includes('storage.googleapis.com')) {
        console.log('MaterialViewer - URL do Google Cloud Storage detectada');
        setSignedUrl(fileUrl);
      } else if (fileUrl.includes('supabase.co/storage')) {
        // Se for URL do Supabase, gerar URL assinada
        const generateSignedUrl = async () => {
          try {
            const urlParts = fileUrl.split('/storage/v1/object/public/materials/');
            if (urlParts.length < 2) {
              console.error('URL do arquivo inválida:', fileUrl);
              return;
            }
            const filePath = urlParts[1];
            console.log('Gerando URL assinada para:', filePath);
            const {
              data,
              error
            } = await supabase.storage.from('materials').createSignedUrl(filePath, 3600);
            if (error) {
              console.error('Erro ao gerar URL assinada:', error);
              return;
            }
            console.log('URL assinada gerada:', data.signedUrl);
            setSignedUrl(data.signedUrl);
          } catch (error) {
            console.error('Erro ao processar URL do arquivo:', error);
          }
        };
        generateSignedUrl();
      }
    }
  }, [fileUrl]);

  // Carregar version_count do material
  useEffect(() => {
    const loadVersionCount = async () => {
      try {
        const {
          data,
          error
        } = await supabase.from('materials').select('version_count').eq('id', id).single();
        if (error) throw error;
        setVersionCount(data.version_count || 0);
      } catch (error) {
        console.error('Erro ao carregar version_count:', error);
      }
    };
    loadVersionCount();
  }, [id]);
  const updateMaterialStatus = async (newStatus: MaterialStatus, comment?: string) => {
    if (!profile?.id) {
      console.error('updateMaterialStatus: Usuário não autenticado, profile.id não encontrado');
      return;
    }

    // Verificar se o usuário tem permissão (admins sempre têm, ou participantes do projeto)
    if (projectId && !isProjectParticipant && profile.role !== 'admin') {
      toast({
        title: "Acesso negado",
        description: "Apenas participantes do projeto podem alterar status de materiais",
        variant: "destructive"
      });
      return;
    }
    console.log('updateMaterialStatus: Iniciando atualização', {
      materialId: id,
      newStatus,
      comment,
      profileId: profile.id
    });
    setLoading(true);
    try {
      // Buscar o ID do profile primeiro
      const {
        data: profileData,
        error: profileError
      } = await supabase.from('profiles').select('id').eq('user_id', profile.user_id).single();
      if (profileError || !profileData) {
        console.error('updateMaterialStatus: Erro ao buscar profile:', profileError);
        throw new Error('Profile não encontrado');
      }

      // Buscar dados do material para notificações
      const {
        data: materialData,
        error: materialDataError
      } = await supabase.from('materials').select('created_by, project_id, name').eq('id', id).single();
      if (materialDataError) {
        console.error('Erro ao buscar dados do material:', materialDataError);
      }

      // Atualizar status do material e briefing se aplicável
      const updateData: any = {
        status: newStatus,
        reviewed_by: profileData.id,
        reviewed_at: new Date().toISOString()
      };

      // Se for aprovação de cliente em um briefing, marcar como aprovado pelo cliente
      if (newStatus === 'client_approval') {
        const {
          data: materialInfo,
          error: materialInfoError
        } = await supabase.from('materials').select('is_briefing').eq('id', id).single();
        if (!materialInfoError && materialInfo?.is_briefing) {
          updateData.briefing_approved_by_client = true;
        }
      }
      const {
        error: materialError
      } = await supabase.from('materials').update(updateData).eq('id', id);
      if (materialError) {
        console.error('updateMaterialStatus: Erro ao atualizar material:', materialError);
        throw materialError;
      }
      console.log('updateMaterialStatus: Material atualizado com sucesso');

      // Enviar notificação ao criador do material se não for ele mesmo
      if (materialData && materialData.created_by !== profileData.id) {
        const {
          data: creatorProfile,
          error: creatorError
        } = await supabase.from('profiles').select('user_id, full_name').eq('id', materialData.created_by).single();
        if (!creatorError && creatorProfile) {
          const notificationMessages = {
            'internal_approval': `Seu material "${materialData.name}" foi aprovado internamente por ${profile.full_name}`,
            'client_approval': `Seu material "${materialData.name}" foi aprovado pelo cliente`,
            'needs_adjustment': `Seu material "${materialData.name}" precisa de ajustes - ${profile.full_name}`,
            'rejected': `Seu material "${materialData.name}" foi reprovado por ${profile.full_name}`
          };
          await supabase.from('notifications').insert({
            user_id: creatorProfile.user_id,
            material_id: id,
            project_id: materialData.project_id,
            type: 'status_update',
            title: 'Status do Material Atualizado',
            message: notificationMessages[newStatus] || `Status do material "${materialData.name}" foi atualizado`
          });
        }
      }

      // Adicionar comentário se fornecido
      if (comment && comment.trim()) {
        console.log('updateMaterialStatus: Adicionando comentário:', comment.trim());
        const {
          error: commentError
        } = await supabase.from('comments').insert({
          material_id: id,
          content: comment.trim(),
          author_id: profileData.id
        });
        if (commentError) {
          console.error('updateMaterialStatus: Erro ao adicionar comentário:', commentError);
          throw commentError;
        }
        console.log('updateMaterialStatus: Comentário adicionado com sucesso');
      }
      setCurrentStatus(newStatus);
      setNewComment("");

      // Mensagens de sucesso baseadas na ação
      const statusMessages = {
        'internal_approval': 'Material aprovado internamente!',
        'client_approval': 'Material aprovado pelo cliente!',
        'needs_adjustment': 'Solicitação de ajustes enviada!',
        'rejected': 'Material reprovado!'
      };
      toast({
        title: "Sucesso!",
        description: statusMessages[newStatus] || 'Status atualizado!'
      });

      // Callback para recarregar dados
      onStatusUpdate?.();

      // Redirecionar para seção de materiais do projeto após aprovação
      if ((newStatus === 'internal_approval' || newStatus === 'client_approval') && projectId) {
        setTimeout(() => {
          navigate(`/project/${projectId}?section=materials`);
        }, 1500);
      } else {
        // Atualizar página para refletir mudanças
        setTimeout(() => window.location.reload(), 500);
      }
    } catch (error) {
      console.error('Erro ao atualizar material:', error);
      toast({
        title: "Erro",
        description: "Erro ao atualizar material. Verifique suas permissões.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };
  const handleInternalApproval = () => {
    updateMaterialStatus('internal_approval', newComment);
  };
  const handleClientApproval = () => {
    updateMaterialStatus('client_approval', newComment);
  };
  const handleRequestChanges = () => {
    console.log('handleRequestChanges: Iniciando solicitação de ajustes');
    console.log('handleRequestChanges: newComment:', newComment);
    console.log('handleRequestChanges: profile:', profile);
    console.log('handleRequestChanges: materialId:', id);
    if (!newComment.trim()) {
      toast({
        title: "Comentário obrigatório",
        description: "Por favor, adicione um comentário explicando os ajustes necessários",
        variant: "destructive"
      });
      return;
    }
    updateMaterialStatus('needs_adjustment', newComment);
  };
  const handleReject = () => {
    updateMaterialStatus('rejected', newComment);
  };
  const handleRenameMaterial = async () => {
    if (!editedName || !editedName.trim()) return;

    // Verificar permissão (admins sempre têm, ou participantes do projeto)
    if (projectId && !isProjectParticipant && profile?.role !== 'admin') {
      toast({
        title: "Acesso negado",
        description: "Apenas participantes do projeto podem renomear materiais",
        variant: "destructive"
      });
      return;
    }
    try {
      setLoading(true);
      const {
        error
      } = await supabase.from('materials').update({
        name: editedName.trim()
      }).eq('id', id);
      if (error) throw error;
      toast({
        title: "Nome atualizado",
        description: "O material foi renomeado com sucesso."
      });
      setIsEditingName(false);
      onStatusUpdate?.();
    } catch (error) {
      console.error('Erro ao renomear material:', error);
      toast({
        title: "Erro",
        description: "Não foi possível renomear o material.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };
  const handleAddComment = async () => {
    if (!newComment.trim() || !profile?.id) return;

    // Verificar se o usuário tem permissão (admins sempre têm, ou participantes do projeto)
    if (projectId && !isProjectParticipant && profile.role !== 'admin') {
      toast({
        title: "Acesso negado",
        description: "Apenas participantes do projeto podem comentar",
        variant: "destructive"
      });
      return;
    }
    setLoading(true);
    try {
      const {
        data: newCommentData,
        error
      } = await supabase.from('comments').insert({
        material_id: id,
        content: newComment.trim(),
        author_id: profile.id
      }).select().single();
      if (error) throw error;
      if (!newCommentData?.id) {
        console.error('Comentário criado mas ID não foi retornado');
        return;
      }

      // Criar notificações para usuários mencionados
      for (const user of mentionedUsers) {
        try {
          await supabase.from('notifications').insert({
            user_id: user.id,
            material_id: id,
            project_id: projectId || null,
            comment_id: newCommentData.id,
            type: 'mention',
            title: 'Você foi mencionado',
            message: `${profile.full_name} mencionou você em um comentário: "${newComment.trim().substring(0, 100)}${newComment.length > 100 ? '...' : ''}"`,
            mentioned_by: profile.user_id
          });
        } catch (mentionError) {
          console.error('Erro ao criar notificação de menção:', mentionError);
        }
      }
      setNewComment("");
      setMentionedUsers([]);
      toast({
        title: "Sucesso!",
        description: "Comentário adicionado!"
      });
      onStatusUpdate?.();
    } catch (error) {
      console.error('Erro ao adicionar comentário:', error);
      toast({
        title: "Erro",
        description: "Erro ao adicionar comentário",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };
  const handleAddReply = async (parentId: string) => {
    if (!replyContent.trim() || !profile?.id) return;

    // Verificar se o usuário tem permissão (admins sempre têm, ou participantes do projeto)
    if (projectId && !isProjectParticipant && profile.role !== 'admin') {
      toast({
        title: "Acesso negado",
        description: "Apenas participantes do projeto podem responder comentários",
        variant: "destructive"
      });
      return;
    }
    setLoading(true);
    try {
      const {
        data: newReplyData,
        error
      } = await supabase.from('comments').insert({
        material_id: id,
        content: replyContent.trim(),
        author_id: profile.id,
        parent_id: parentId
      }).select().single();
      if (error) throw error;
      if (!newReplyData?.id) {
        console.error('Resposta criada mas ID não foi retornado');
        return;
      }

      // Criar notificações para usuários mencionados na resposta
      for (const user of mentionedUsers) {
        try {
          await supabase.from('notifications').insert({
            user_id: user.id,
            material_id: id,
            project_id: projectId || null,
            comment_id: newReplyData.id,
            type: 'mention',
            title: 'Você foi mencionado',
            message: `${profile.full_name} mencionou você em uma resposta: "${replyContent.trim().substring(0, 100)}${replyContent.length > 100 ? '...' : ''}"`,
            mentioned_by: profile.user_id
          });
        } catch (mentionError) {
          console.error('Erro ao criar notificação de menção:', mentionError);
        }
      }
      setReplyContent("");
      setReplyingTo(null);
      setMentionedUsers([]);
      toast({
        title: "Sucesso!",
        description: "Resposta adicionada!"
      });
      onStatusUpdate?.();
    } catch (error) {
      console.error('Erro ao adicionar resposta:', error);
      toast({
        title: "Erro",
        description: "Erro ao adicionar resposta",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };
  const downloadFile = async () => {
    const urlToUse = signedUrl || fileUrl;
    if (urlToUse) {
      console.log('Fazendo download do arquivo:', urlToUse);
      try {
        // Fetch o arquivo como blob
        const response = await fetch(urlToUse);
        const blob = await response.blob();

        // Criar URL temporária para o blob
        const blobUrl = URL.createObjectURL(blob);

        // Criar um elemento <a> temporário para forçar o download
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = name || 'arquivo'; // Define o nome do arquivo para download

        // Adicionar ao DOM temporariamente, clicar e remover
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // Limpar a URL temporária
        URL.revokeObjectURL(blobUrl);
      } catch (error) {
        console.error('Erro ao fazer download:', error);
        // Fallback para o método anterior
        const link = document.createElement('a');
        link.href = urlToUse;
        link.download = name || 'arquivo';
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    }
  };
  const [showAllReplies, setShowAllReplies] = useState<{
    [key: string]: boolean;
  }>({});
  const renderComment = (comment: Comment, isReply = false) => {
    const totalReplies = comment.replies?.length || 0;
    const shouldShowViewAll = totalReplies > 3;
    const showingAll = showAllReplies[comment.id] || false;
    const repliesToShow = shouldShowViewAll && !showingAll ? comment.replies?.slice(0, 3) : comment.replies;
    return <div key={comment.id} id={`comment-${comment.id}`} className={cn("space-y-2 transition-all duration-500", isReply && "ml-8 border-l-2 border-muted pl-4", highlightedCommentId === comment.id && ["bg-primary/10", "p-3", "rounded-lg", "border-2", "border-primary/50", "shadow-lg", "scale-[1.02]"].join(' '))}>
        <div className="flex items-start space-x-3">
          <Avatar className="h-8 w-8">
            {comment.author_avatar ? <AvatarImage src={comment.author_avatar} alt={comment.author} /> : <AvatarFallback className="text-xs">
                {comment.author.substring(0, 2).toUpperCase()}
              </AvatarFallback>}
          </Avatar>
          <div className="flex-1 space-y-1">
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium">
                {comment.author}
              </span>
              {comment.isClient && <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                  Cliente
                </span>}
              <span className="text-xs text-muted-foreground">
                {comment.timestamp}
              </span>
            </div>
            <CommentWithMentions content={comment.content} className="text-sm text-muted-foreground" />
            
            {/* Reply button */}
            {!isReply && <Button variant="ghost" size="sm" onClick={() => setReplyingTo(replyingTo === comment.id ? null : comment.id)} className="h-6 px-2 text-xs text-muted-foreground hover:text-primary">
                <Reply className="h-3 w-3 mr-1" />
                Responder
              </Button>}
          </div>
        </div>

        {/* Reply form */}
        {replyingTo === comment.id && <div className="ml-11 space-y-2">
            <MentionInput value={replyContent} onChange={setReplyContent} onMentionUsers={users => {
          setMentionedUsers(users);
        }} placeholder="Escreva sua resposta... Use @ para mencionar alguém" className="min-h-[80px] text-sm" projectId={projectId || undefined} />
            <div className="flex gap-2">
              <Button size="sm" onClick={() => handleAddReply(comment.id)} disabled={!replyContent.trim() || loading}>
                <Send className="h-3 w-3 mr-1" />
                Responder
              </Button>
              <Button variant="ghost" size="sm" onClick={() => {
            setReplyingTo(null);
            setReplyContent("");
          }}>
                Cancelar
              </Button>
            </div>
          </div>}

        {/* Render replies with limit */}
        {repliesToShow && repliesToShow.length > 0 && <div className="space-y-2">
            {repliesToShow.map(reply => renderComment(reply, true))}
            
            {/* Show "Ver tudo" button if there are more than 3 replies */}
            {shouldShowViewAll && !showingAll && <div className="ml-11">
                <Button variant="ghost" size="sm" onClick={() => setShowAllReplies(prev => ({
            ...prev,
            [comment.id]: true
          }))} className="text-xs text-primary hover:text-primary/80">
                  <ChevronRight className="h-3 w-3 mr-1" />
                  Ver tudo ({totalReplies - 3} mais respostas)
                </Button>
              </div>}
            
            {/* Show "Ver menos" button if showing all */}
            {shouldShowViewAll && showingAll && <div className="ml-11">
                <Button variant="ghost" size="sm" onClick={() => setShowAllReplies(prev => ({
            ...prev,
            [comment.id]: false
          }))} className="text-xs text-muted-foreground hover:text-foreground">
                  Ver menos
                </Button>
              </div>}
          </div>}
      </div>;
  };
  const renderMediaPreview = () => {
    // Log para debug da URL do arquivo
    console.log('MaterialViewer - renderMediaPreview:', {
      type,
      fileUrl,
      name,
      id
    });
    const urlToUse = signedUrl || fileUrl;

    // CRITICAL: Check for video processing status BEFORE checking for urlToUse
    // This ensures the loading screen shows instead of "Arquivo não disponível"
    if (type === 'video' && currentStatus === 'processing') {
      return <VideoGenerationProgress materialId={id} projectId={projectId} />;
    }

    // Special handling for wireframes - show WireframePreview if no file but has wireframe data
    if (type === 'wireframe' && !urlToUse) {
      // For backward compatibility, only check wireframeData field
      let wireframeToRender = wireframeData;
      if (wireframeToRender) {
        // Se o wireframe está aprovado, mostrar a versão HTML estilizada
        if (currentStatus === 'approved') {
          return <div className="w-full">
              <WireframeHTMLPreview wireframe_data={wireframeToRender} className="min-h-[500px]" />
            </div>;
        }

        // Caso contrário, mostrar a pré-visualização simples
        return <div className="w-full">
            <WireframePreview wireframe_data={wireframeToRender} className="min-h-[384px]" />
          </div>;
      } else {
        // Se não há dados de wireframe, mostrar mensagem amigável
        return <div className="w-full h-96 bg-muted/30 rounded-lg flex items-center justify-center border-2 border-dashed border-muted">
            <div className="text-center space-y-4">
              <div className="text-4xl">📐</div>
              <div>
                <p className="font-medium text-muted-foreground">Wireframe não disponível</p>
                <p className="text-sm text-muted-foreground/70">Este material ainda não possui dados de wireframe</p>
              </div>
            </div>
          </div>;
      }
    }
    if (!urlToUse) {
      return <div className="w-full h-96 bg-muted/50 rounded-lg flex items-center justify-center border-2 border-dashed border-muted">
          <div className="text-center space-y-4">
            <div className="text-5xl opacity-50">📁</div>
            <div>
              <p className="font-medium text-muted-foreground">Arquivo não disponível</p>
              <p className="text-sm text-muted-foreground/70">URL do arquivo não encontrada</p>
            </div>
          </div>
        </div>;
    }

    // Verificar se há múltiplos arquivos (JSON array)
    if (fileUrl && fileUrl.trim().startsWith('[')) {
      try {
        const parsedFiles = JSON.parse(fileUrl || '');
        if (Array.isArray(parsedFiles) && parsedFiles.length >= 1) {
          console.log('MaterialViewer - Detectado múltiplos arquivos:', parsedFiles);
          const carouselFiles = parsedFiles.map((file, index) => ({
            id: `${id}-${index}`,
            url: file.url,
            name: file.name || `Arquivo ${index + 1}`,
            type: file.type as 'image' | 'video' | 'pdf' | 'wireframe'
          }));
          console.log('MaterialViewer - Renderizando carrossel com', carouselFiles.length, 'arquivos');
          return <MaterialCarousel files={carouselFiles} className="w-full" />;
        }
      } catch (e) {
        console.log('MaterialViewer - Erro ao processar múltiplos arquivos:', e);
        // Se não for JSON válido, continuar com lógica normal
      }
    }
    switch (type) {
      case 'image':
        return <div className="w-full h-96 bg-muted/30 rounded-lg flex items-center justify-center overflow-hidden border">
            <img src={urlToUse} alt={name} className="max-w-full max-h-full object-contain rounded transition-opacity duration-200" onLoad={e => {
            e.currentTarget.style.opacity = '1';
            console.log('Imagem carregada com sucesso:', urlToUse);
          }} onError={async e => {
            console.error('Erro ao carregar imagem:', urlToUse);
            const target = e.currentTarget;

            // Se é uma URL do GCS e falhou, tentar configurar o bucket
            if (urlToUse.includes('storage.googleapis.com')) {
              console.log('Tentando configurar bucket GCS...');
              try {
                const {
                  error
                } = await supabase.functions.invoke('setup-gcs-bucket');
                if (!error) {
                  console.log('Bucket configurado, tentando recarregar imagem...');
                  // Tentar recarregar a imagem após 2 segundos
                  setTimeout(() => {
                    target.src = urlToUse + '?v=' + Date.now();
                  }, 2000);
                  return;
                }
              } catch (setupError) {
                console.error('Erro ao configurar bucket:', setupError);
              }
            }
            target.style.display = 'none';
            const parent = target.parentElement;
            if (parent) {
              const errorDiv = document.createElement('div');
              errorDiv.className = 'text-center space-y-4';
              const icon = document.createElement('div');
              icon.className = 'text-4xl';
              icon.textContent = '🖼️';
              const contentDiv = document.createElement('div');
              const errorMsg = document.createElement('p');
              errorMsg.className = 'font-medium text-muted-foreground';
              errorMsg.textContent = 'Erro ao carregar imagem';
              const subMsg = document.createElement('p');
              subMsg.className = 'text-sm text-muted-foreground/70';
              subMsg.textContent = 'A imagem pode estar sendo processada ou ter um problema de acesso';
              const openBtn = document.createElement('button');
              openBtn.className = 'mt-2 mr-2 px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors';
              openBtn.textContent = 'Abrir Imagem';
              openBtn.onclick = () => window.open(urlToUse, '_blank');
              const retryBtn = document.createElement('button');
              retryBtn.className = 'mt-2 px-4 py-2 bg-secondary text-secondary-foreground rounded hover:bg-secondary/90 transition-colors';
              retryBtn.textContent = 'Tentar Novamente';
              retryBtn.onclick = () => location.reload();
              contentDiv.appendChild(errorMsg);
              contentDiv.appendChild(subMsg);
              contentDiv.appendChild(openBtn);
              contentDiv.appendChild(retryBtn);
              errorDiv.appendChild(icon);
              errorDiv.appendChild(contentDiv);
              parent.replaceChildren(errorDiv);
            }
          }} style={{
            opacity: 0
          }} />
          </div>;
      case 'video':
        // Verificar se o vídeo está sendo gerado
        if (currentStatus === 'processing') {
          return <VideoGenerationProgress materialId={id} projectId={projectId || ''} />;
        }

        // Se o vídeo está pronto, mostrar player customizado
        if (fileUrl) {
          return <VideoPlayerWithCaption videoUrl={fileUrl} caption={caption} thumbnailUrl={signedUrl || undefined} />;
        }

        // Fallback: player padrão
        return <div className="w-full h-96 bg-muted/30 rounded-lg overflow-hidden border">
            <video controls className="w-full h-full object-contain rounded" preload="metadata" onLoadStart={() => {
            console.log('Iniciando carregamento do vídeo:', urlToUse);
          }} onCanPlay={() => {
            console.log('Vídeo pronto para reprodução:', urlToUse);
          }} onError={e => {
            console.error('Erro ao carregar vídeo:', urlToUse, e);
            const target = e.currentTarget;
            target.style.display = 'none';
            const parent = target.parentElement;
            if (parent) {
              const errorDiv = document.createElement('div');
              errorDiv.className = 'flex items-center justify-center h-full';
              const contentDiv = document.createElement('div');
              contentDiv.className = 'text-center space-y-4';
              const icon = document.createElement('div');
              icon.className = 'text-4xl';
              icon.textContent = '🎥';
              const innerDiv = document.createElement('div');
              const errorMsg = document.createElement('p');
              errorMsg.className = 'font-medium text-muted-foreground';
              errorMsg.textContent = 'Erro ao carregar vídeo';
              const subMsg = document.createElement('p');
              subMsg.className = 'text-sm text-muted-foreground/70';
              subMsg.textContent = 'Clique para abrir em nova aba';
              const openBtn = document.createElement('button');
              openBtn.className = 'mt-2 px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors';
              openBtn.textContent = 'Abrir Vídeo';
              openBtn.onclick = () => window.open(urlToUse, '_blank');
              innerDiv.appendChild(errorMsg);
              innerDiv.appendChild(subMsg);
              innerDiv.appendChild(openBtn);
              contentDiv.appendChild(icon);
              contentDiv.appendChild(innerDiv);
              errorDiv.appendChild(contentDiv);
              parent.replaceChildren(errorDiv);
            }
          }}>
              <source src={urlToUse} type="video/mp4" />
              <source src={urlToUse} type="video/mov" />
              <source src={urlToUse} type="video/avi" />
              Seu navegador não suporta este formato de vídeo.
            </video>
          </div>;
      case 'pdf':
        return <div className="w-full h-96 bg-muted/30 rounded-lg flex items-center justify-center border">
            <div className="text-center space-y-4">
              <div className="text-5xl">📄</div>
              <div>
                <p className="font-medium">Documento PDF</p>
                <p className="text-sm text-muted-foreground">Visualize o documento completo</p>
              </div>
              <div className="flex gap-2 justify-center">
                <Button variant="outline" onClick={downloadFile}>
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
                <Button onClick={() => window.open(urlToUse, '_blank')}>
                  Visualizar
                </Button>
              </div>
            </div>
          </div>;
      default:
        return <div className="w-full h-96 bg-muted/30 rounded-lg flex items-center justify-center border-2 border-dashed border-muted">
            <div className="text-center space-y-4">
              <div className="text-4xl">❓</div>
              <div>
                <p className="font-medium text-muted-foreground">Formato não suportado</p>
                <p className="text-sm text-muted-foreground/70">Tipo: {type}</p>
                <Button variant="outline" onClick={downloadFile} className="mt-2">
                  <Download className="h-4 w-4 mr-2" />
                  Download Arquivo
                </Button>
              </div>
            </div>
          </div>;
    }
  };
  return <div className={cn("container mx-auto px-4 lg:px-8 py-8", className)}>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              {isEditingName ? <>
                  <Input value={editedName} onChange={e => setEditedName(e.target.value)} className="h-9 text-2xl font-bold" />
                  <Button size="sm" onClick={handleRenameMaterial} disabled={!editedName.trim()}>
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => {
                setIsEditingName(false);
                setEditedName(name);
              }}>
                    <X className="h-4 w-4" />
                  </Button>
                </> : <>
                  <h1 className="text-2xl font-bold">{name}</h1>
                  {(!projectId || isProjectParticipant || profile?.role === 'admin') && <Button variant="ghost" size="icon" onClick={() => setIsEditingName(true)} aria-label="Renomear material">
                      <Pencil className="h-4 w-4" />
                    </Button>}
                </>}
            </div>
            <div className="flex items-center space-x-4 text-sm text-muted-foreground">
              <div className="flex items-center space-x-2">
                <User className="h-4 w-4" />
                <span>{client}</span>
              </div>
              <div className="flex items-center space-x-2">
                <Clock className="h-4 w-4" />
                <span>Enviado em {uploadDate}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <StatusBadge status={currentStatus} isRunning={currentIsRunning} />
            {/* Botão de exclusão para criadores, admins e colaboradores */}
            {profile && (profile.role === 'admin' || profile.role === 'collaborator' || profile.id === profile?.id // Criador (usar created_by quando disponível)
          ) && <DeleteMaterialModal materialId={id} materialName={name} onDeleted={onStatusUpdate} redirectAfterDelete={true} projectId={projectId} />}
            <Button variant="outline" size="sm" onClick={downloadFile} disabled={!fileUrl}>
              <Download className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Project Info */}
        {project && <Card className="border-info/20 bg-info-light/30">
            <CardContent className="pt-4">
              <div className="flex items-center space-x-2 text-info">
                <Clock className="h-4 w-4" />
                <span className="text-sm font-medium">
                  Projeto: {project}
                </span>
              </div>
            </CardContent>
          </Card>}


        {/* Reference - Hidden as per user request */}

        {/* Caption/Legend */}
        {caption && <Card className="border-primary/20 bg-primary-light/30">
            <CardHeader className="pb-3">
              <h3 className="font-semibold text-primary">Legenda/Descrição</h3>
            </CardHeader>
            <CardContent>
              <p className="text-foreground leading-relaxed">{caption}</p>
            </CardContent>
          </Card>}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Media Preview */}
          <div className="lg:col-span-2 space-y-4">
            {/* Media Preview */}
            {<Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                  <h3 className="font-semibold">Pré-visualização</h3>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => setShowVersionsModal(true)} disabled={versionCount === 0}>
                      <History className="h-4 w-4 mr-2" />
                      Ver outras versões
                    </Button>
                    <Button variant="default" size="sm" onClick={() => setShowChangeModal(true)} disabled={versionCount >= 3}>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Alterar Material
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {/* Render wireframe if type is wireframe */}
                  {type === 'wireframe' && wireframeData ? <div className="w-full">
                      {currentStatus === 'approved' ? <WireframeHTMLPreview wireframe_data={wireframeData} className="min-h-[500px]" /> : <WireframeEditor wireframe={wireframeData} creativeId={id} aspectRatio="1:1" onSave={async layout => {
                  try {
                    const {
                      error
                    } = await supabase.from('materials').update({
                      wireframe_data: layout as any
                    }).eq('id', id);
                    if (error) {
                      console.error('Erro ao salvar wireframe:', error);
                      toast({
                        title: "Erro ao salvar",
                        description: "Não foi possível salvar as alterações do wireframe.",
                        variant: "destructive"
                      });
                    } else {
                      toast({
                        title: "Wireframe salvo",
                        description: "As alterações do wireframe foram salvas com sucesso."
                      });
                      if (onStatusUpdate) onStatusUpdate();
                    }
                  } catch (error) {
                    console.error('Erro ao salvar wireframe:', error);
                    toast({
                      title: "Erro ao salvar",
                      description: "Ocorreu um erro inesperado.",
                      variant: "destructive"
                    });
                  }
                }} />}
                    </div> : (/* Media Preview for other types */
              renderMediaPreview())}
                </CardContent>
              </Card>}

            {/* Approval Actions - Admins sempre têm acesso, participantes do projeto também */}
            {participantCheckLoading ? <Card>
                <CardHeader>
                  <h3 className="font-semibold">Ações de Aprovação</h3>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-center py-8">
                    <div className="text-muted-foreground">Verificando permissões...</div>
                  </div>
                </CardContent>
              </Card> : !projectId || isProjectParticipant || profile?.role === 'admin' ? <Card>
                <CardHeader>
                  <h3 className="font-semibold">Ações de Aprovação</h3>
                </CardHeader>
                 <CardContent className="space-y-4">
                  <div className="flex flex-col gap-3">
                    <div className="flex gap-3">
                      {/* Aprovação Interna */}
                      <Button onClick={handleInternalApproval} variant={currentStatus === 'internal_approval' ? 'success' : 'default'} className="flex-1" disabled={loading}>
                        <ThumbsUp className="h-4 w-4 mr-2" />
                        {currentStatus === 'internal_approval' ? 'Aprovado - Interno' : 'Aprovar - Interno'}
                      </Button>
                      
                      {/* Aprovação Cliente */}
                      <Button onClick={handleClientApproval} variant={currentStatus === 'client_approval' ? 'success' : 'default'} className="flex-1" disabled={loading}>
                        <ThumbsUp className="h-4 w-4 mr-2" />
                        {currentStatus === 'client_approval' ? 'Aprovado - Cliente' : 'Aprovar - Cliente'}
                      </Button>
                    </div>
                    
                    {/* Toggle de Em Veiculação quando status for client_approval */}
                    {currentStatus === 'client_approval' && <div className="flex items-center justify-center gap-2 p-3 bg-muted/30 rounded-md border">
                        <span className="text-sm font-medium">
                          {currentIsRunning ? 'Em Veiculação' : 'Disponível'}
                        </span>
                        <Button variant="outline" size="sm" onClick={async () => {
                    try {
                      const newIsRunning = !currentIsRunning;
                      const {
                        error
                      } = await supabase.from('materials').update({
                        is_running: newIsRunning
                      }).eq('id', id);
                      if (error) throw error;
                      setCurrentIsRunning(newIsRunning);
                      toast({
                        title: "Status atualizado",
                        description: `Material marcado como ${newIsRunning ? 'Em Veiculação' : 'Disponível'}`
                      });
                    } catch (error) {
                      console.error('Erro ao atualizar is_running:', error);
                      toast({
                        title: "Erro",
                        description: "Erro ao atualizar status do material",
                        variant: "destructive"
                      });
                    }
                  }}>
                          {currentIsRunning ? 'Marcar como Disponível' : 'Marcar como Em Veiculação'}
                        </Button>
                      </div>}
              <Button variant={currentStatus === 'rejected' ? 'outline' : 'destructive'} onClick={handleReject} className={`w-full ${currentStatus === 'rejected' ? 'border-destructive text-destructive bg-destructive/10' : ''}`} disabled={loading}>
                <X className="h-4 w-4 mr-2" />
                {currentStatus === 'rejected' ? 'Material Reprovado' : 'Reprovar Material'}
              </Button>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      Comentários com Menções (opcional)
                    </label>
                    <MentionInput value={newComment} onChange={setNewComment} onMentionUsers={setMentionedUsers} placeholder="Adicione seus comentários... Use @ para mencionar alguém" className="min-h-[100px]" projectId={projectId || undefined} />
                    <Button onClick={handleAddComment} size="sm" variant="gradient" className="w-full">
                      <Send className="h-4 w-4 mr-2" />
                      Enviar Comentário
                    </Button>
                  </div>
                </CardContent>
              </Card> : <Card>
                <CardHeader>
                  <h3 className="font-semibold">Ações de Aprovação</h3>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-center py-8">
                    <div className="text-center space-y-2">
                      <div className="text-muted-foreground">🔒</div>
                      <p className="text-muted-foreground">
                        Apenas participantes do projeto podem aprovar materiais e comentar
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>}
          </div>

          {/* Comments Section */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">Comentários</h3>
                  <div className="flex items-center space-x-1 text-sm text-muted-foreground">
                    <MessageSquare className="h-4 w-4" />
                    <span>{comments.length}</span>
                  </div>
                </div>
              </CardHeader>
               <CardContent className="space-y-4">
                 {comments.length === 0 ? <p className="text-center text-muted-foreground py-8">
                     Nenhum comentário ainda
                   </p> : comments.map(comment => renderComment(comment))}
                </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Modais de versionamento */}
      <ChangeMaterialModal open={showChangeModal} onOpenChange={setShowChangeModal} materialId={id} materialName={name} currentVersionCount={versionCount} onSuccess={() => {
      onStatusUpdate?.();
      // Recarregar version_count
      supabase.from('materials').select('version_count').eq('id', id).single().then(({
        data
      }) => {
        if (data) setVersionCount(data.version_count || 0);
      });
    }} />

      <MaterialVersionsModal open={showVersionsModal} onOpenChange={setShowVersionsModal} materialId={id} materialName={name} materialType={type} currentFileUrl={fileUrl || ''} onRestore={() => {
      onStatusUpdate?.();
    }} />
    </div>;
};