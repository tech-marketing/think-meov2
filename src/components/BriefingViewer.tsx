import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  ArrowLeft, 
  ThumbsUp, 
  MessageSquare, 
  User, 
  Clock, 
  Check, 
  X,
  Pencil,
  Send
} from "lucide-react";
import { BriefingEditorLayout } from "@/components/briefing-editor/BriefingEditorLayout";
import { DeleteBriefingModal } from "@/components/DeleteBriefingModal";
import { CompetitiveInsightsDisplay } from "@/components/CompetitiveInsightsDisplay";
import { BriefingComments } from "@/components/BriefingComments";
import { StatusBadge } from "@/components/StatusBadge";
import { MentionInput } from "@/components/MentionInput";
import { CarouselGallery } from "@/components/CarouselGallery";
import { VideoPlayerWithCaption } from "@/components/VideoPlayerWithCaption";
import { VideoGenerationProgress } from "@/components/VideoGenerationProgress";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

interface BriefingViewerProps {
  briefingId: string;
  projectId: string;
  onBack: () => void;
  onNavigate?: (briefingId: string) => void;
  allBriefingIds?: string[];
  searchTerm?: string;
}

export const BriefingViewer = ({ 
  briefingId, 
  projectId, 
  onBack
}: BriefingViewerProps) => {
  const [briefing, setBriefing] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState(false);
  const [companyName, setCompanyName] = useState<string>('');
  const [projectName, setProjectName] = useState<string>('');
  const [commentsCount, setCommentsCount] = useState<number>(0);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [isProjectParticipant, setIsProjectParticipant] = useState(false);
  const [participantCheckLoading, setParticipantCheckLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [mentionedUsers, setMentionedUsers] = useState<string[]>([]);
  const [visualizationContent, setVisualizationContent] = useState<string>('');
  const { toast } = useToast();
  const { profile } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    loadBriefing();
  }, [briefingId]);

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Data não disponível';
    
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
      });
    } catch {
      return 'Data inválida';
    }
  };

  // Convert wireframe_data to HTML for initial visualization
  const convertWireframeToHTML = (wireframeData: any): string => {
    if (!wireframeData) {
      return '<p>Digite o conteúdo da visualização aqui...</p>';
    }
    
    let html = '<div>';
    
    // Extract content from wireframe_data structure
    if (wireframeData.content) {
      const content = wireframeData.content;
      
      if (content.newsTitle) {
        html += `<h2>${content.newsTitle}</h2>`;
      }
      
      if (content.persona) {
        html += `<p><strong>Persona:</strong> ${content.persona}</p>`;
      }
      
      if (content.product) {
        html += `<p><strong>Produto:</strong> ${content.product}</p>`;
      }
      
      if (content.sourceLabel) {
        html += `<p><em>${content.sourceLabel}</em></p>`;
      }
      
      if (content.ctaText) {
        html += `<p><strong>CTA:</strong> ${content.ctaText}</p>`;
      }
    }
    
    html += '</div>';
    
    return html;
  };

  const loadBriefing = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('materials')
        .select('*')
        .eq('id', briefingId)
        .maybeSingle();

      if (error) throw error;
      
      if (data) {
        setBriefing(data);
        setEditedName(data.name);
        
        // Priorizar canvas_data (novo formato Canvas) sobre wireframe_data (formato antigo)
        if (data.canvas_data) {
          // Briefing usa Canvas do Fabric.js
          setVisualizationContent(data.canvas_data);
        } else if (data.visualization_html) {
          // Briefing já tem HTML salvo (formato antigo)
          setVisualizationContent(data.visualization_html);
        } else if (data.wireframe_data) {
          // Converter wireframe_data antigo para HTML
          const visualizationHtml = convertWireframeToHTML(data.wireframe_data);
          
          // Salvar HTML convertido
          await supabase
            .from('materials')
            .update({ visualization_html: visualizationHtml })
            .eq('id', briefingId);
          
          setVisualizationContent(visualizationHtml);
        } else {
          setVisualizationContent('<p>Digite o conteúdo da visualização aqui...</p>');
        }
        
        // Buscar nome da empresa
        if (data.company_id) {
          const { data: companyData } = await supabase
            .from('companies')
            .select('name')
            .eq('id', data.company_id)
            .single();
          
          if (companyData) setCompanyName(companyData.name);
        }
        
        // Buscar nome do projeto
        if (data.project_id) {
          const { data: projectData } = await supabase
            .from('projects')
            .select('name')
            .eq('id', data.project_id)
            .single();
          
          if (projectData) setProjectName(projectData.name);
        }
        
        // Contar comentários
        const { count } = await supabase
          .from('comments')
          .select('*', { count: 'exact', head: true })
          .eq('material_id', briefingId);
        
        setCommentsCount(count || 0);
        
        // Verificar se usuário é participante do projeto
        if (profile && data.project_id) {
          setParticipantCheckLoading(true);
          const { data: participantData } = await supabase
            .from('project_participants')
            .select('id')
            .eq('project_id', data.project_id)
            .eq('user_id', profile.id)
            .maybeSingle();
          
          setIsProjectParticipant(!!participantData);
          setParticipantCheckLoading(false);
        } else {
          setParticipantCheckLoading(false);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar briefing:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar briefing",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Gerar thumbnail automaticamente para briefings aprovados sem thumbnail
  useEffect(() => {
    if (briefing?.status === 'approved' && briefing?.canvas_data && !briefing?.thumbnail_url) {
      generateMissingThumbnail();
    }
  }, [briefing]);

  const generateMissingThumbnail = async () => {
    if (!briefing?.canvas_data) return;
    
    try {
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = 700;
      tempCanvas.height = 550;
      
      const { Canvas: FabricCanvas } = await import('fabric');
      const fabricCanvas = new FabricCanvas(tempCanvas);
      await fabricCanvas.loadFromJSON(JSON.parse(briefing.canvas_data));
      fabricCanvas.renderAll();
      
      const thumbnailDataUrl = fabricCanvas.toDataURL({
        format: 'png',
        quality: 0.8,
        multiplier: 0.5,
      });
      
      fabricCanvas.dispose();
      
      // Salvar no banco
      await supabase
        .from('materials')
        .update({ thumbnail_url: thumbnailDataUrl })
        .eq('id', briefingId);
      
      // Atualizar estado local
      setBriefing((prev: any) => ({ ...prev, thumbnail_url: thumbnailDataUrl }));
      
    } catch (error) {
      console.error('Erro ao gerar thumbnail:', error);
    }
  };

  const handleInternalApproval = async () => {
    try {
      setApproving(true);
      
      const { error } = await supabase
        .from('materials')
        .update({
          internal_approval: true,
          internal_approved_by: profile?.id,
          internal_approved_at: new Date().toISOString(),
          status: 'internal_approval'
        })
        .eq('id', briefingId);

      if (error) throw error;

      toast({
        title: "Sucesso!",
        description: "Briefing aprovado internamente"
      });

      loadBriefing();
      
    } catch (error) {
      console.error('Erro ao aprovar briefing internamente:', error);
      toast({
        title: "Erro",
        description: "Erro ao aprovar briefing internamente",
        variant: "destructive"
      });
    } finally {
      setApproving(false);
    }
  };

  const handleClientApproval = async () => {
    try {
      setApproving(true);
      
      // Gerar thumbnail do Canvas antes de aprovar
      let thumbnailDataUrl = null;
      if (briefing.canvas_data) {
        try {
          const tempCanvas = document.createElement('canvas');
          tempCanvas.width = 700;
          tempCanvas.height = 550;
          
          const { Canvas: FabricCanvas } = await import('fabric');
          const fabricCanvas = new FabricCanvas(tempCanvas);
          await fabricCanvas.loadFromJSON(JSON.parse(briefing.canvas_data));
          fabricCanvas.renderAll();
          
          thumbnailDataUrl = fabricCanvas.toDataURL({
            format: 'png',
            quality: 0.8,
            multiplier: 0.5,
          });
          
          fabricCanvas.dispose();
        } catch (error) {
          console.error('Erro ao gerar thumbnail:', error);
        }
      }
      
      const { error } = await supabase
        .from('materials')
        .update({
          briefing_approved_by_client: true,
          status: 'approved',
          thumbnail_url: thumbnailDataUrl
        })
        .eq('id', briefingId);

      if (error) throw error;

      // Toast mais claro com feedback
      toast({
        title: "✅ Briefing Aprovado!",
        description: "O briefing foi movido para Briefings Aprovados. Redirecionando...",
        duration: 2000
      });

      // Delay de 1.5 segundos para o usuário ver o feedback
      setTimeout(() => {
        navigate(`/project/${projectId}?section=briefing-approved`);
      }, 1500);
      
    } catch (error) {
      console.error('Erro ao aprovar briefing:', error);
      toast({
        title: "Erro",
        description: "Erro ao aprovar briefing",
        variant: "destructive"
      });
      setApproving(false);
    }
  };

  const handleRenameBriefing = async () => {
    if (!editedName.trim()) return;
    
    try {
      const { error } = await supabase
        .from('materials')
        .update({ name: editedName.trim() })
        .eq('id', briefingId);
      
      if (error) throw error;
      
      toast({
        title: "Sucesso!",
        description: "Nome do briefing atualizado"
      });
      
      setIsEditingName(false);
      loadBriefing();
    } catch (error) {
      console.error('Erro ao renomear briefing:', error);
      toast({
        title: "Erro",
        description: "Erro ao renomear briefing",
        variant: "destructive"
      });
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim() || !profile) return;

    try {
      const { error } = await supabase
        .from('comments')
        .insert({
          material_id: briefingId,
          author_id: profile.id,
          content: newComment.trim()
        });

      if (error) throw error;

      // Criar notificações para usuários mencionados
      if (mentionedUsers.length > 0) {
        const notifications = mentionedUsers.map(userId => ({
          user_id: userId,
          type: 'mention' as const,
          title: 'Menção em comentário',
          message: `${profile.full_name} mencionou você em um comentário`,
          material_id: briefingId,
          project_id: projectId,
          mentioned_by: profile.id,
          comment_id: null
        }));

        await supabase.from('notifications').insert(notifications);
      }

      setNewComment('');
      setMentionedUsers([]);
      
      toast({
        title: "Comentário adicionado",
        description: "Seu comentário foi publicado com sucesso"
      });
      
      // Recarregar contagem de comentários
      loadBriefing();
      
    } catch (error) {
      console.error('Erro ao adicionar comentário:', error);
      toast({
        title: "Erro",
        description: "Erro ao adicionar comentário",
        variant: "destructive"
      });
    }
  };

  const handleBriefingDeleted = () => {
    navigate(`/project/${projectId}?section=briefing`);
  };

  const handleVisualizationChange = async (htmlContent: string) => {
    setVisualizationContent(htmlContent);
    
    // Auto-save with debounce (optional - can be added later)
    try {
      const { error } = await supabase
        .from('materials')
        .update({ 
          visualization_html: htmlContent,
          updated_at: new Date().toISOString()
        })
        .eq('id', briefingId);

      if (error) throw error;
      
    } catch (error) {
      console.error('Erro ao salvar visualização:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!briefing) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Briefing não encontrado</p>
        <Button onClick={onBack} className="mt-4">
          Voltar
        </Button>
      </div>
    );
  }

  return (
    <div className={cn("container mx-auto px-4 lg:px-8 py-8")}>
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* ========== HEADER ========== */}
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              {isEditingName ? (
                <>
                  <Input
                    value={editedName}
                    onChange={(e) => setEditedName(e.target.value)}
                    className="h-9 text-2xl font-bold"
                  />
                  <Button size="sm" onClick={handleRenameBriefing} disabled={!editedName.trim()}>
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    onClick={() => { 
                      setIsEditingName(false); 
                      setEditedName(briefing.name); 
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </>
              ) : (
                <>
                  <h1 className="text-2xl font-bold">{briefing.name}</h1>
                  {(profile?.role === 'admin' || profile?.role === 'collaborator' || isProjectParticipant) && (
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => setIsEditingName(true)}
                      aria-label="Renomear briefing"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  )}
                </>
              )}
            </div>
            <div className="flex items-center space-x-4 text-sm text-muted-foreground">
              <div className="flex items-center space-x-2">
                <User className="h-4 w-4" />
                <span>{companyName || 'Carregando...'}</span>
              </div>
              <div className="flex items-center space-x-2">
                <Clock className="h-4 w-4" />
                <span>Criado em {formatDate(briefing.created_at)}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <StatusBadge status={briefing.status} />
            <DeleteBriefingModal
              briefingId={briefingId}
              briefingName={briefing.name}
              onDeleted={handleBriefingDeleted}
              redirectAfterDelete={false}
              projectId={projectId}
            />
            <Button variant="outline" size="sm" onClick={onBack}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* ========== PROJECT INFO ========== */}
        {projectName && (
          <Card className="border-info/20 bg-info-light/30">
            <CardContent className="pt-4">
              <div className="flex items-center space-x-2 text-info">
                <Clock className="h-4 w-4" />
                <span className="text-sm font-medium">
                  Projeto: {projectName}
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ========== CAPTION/DESCRIPTION ========== */}
        {briefing.caption && (
          <Card className="border-primary/20 bg-primary-light/30">
            <CardHeader className="pb-3">
              <h3 className="font-semibold text-primary">Descrição</h3>
            </CardHeader>
            <CardContent>
              <p className="text-foreground leading-relaxed">{briefing.caption}</p>
            </CardContent>
          </Card>
        )}

        {/* ========== COMPETITIVE INSIGHTS ========== */}
        {briefing.wireframe_data?.competitive_insights && (
          <CompetitiveInsightsDisplay 
            insights={briefing.wireframe_data.competitive_insights} 
          />
        )}

        {/* ========== VISUALIZAÇÃO DO BRIEFING ========== */}
        {(() => {
          const slidesFromWireframe = briefing.wireframe_data?.slides;
          const derivedSingleSlide = (!slidesFromWireframe || slidesFromWireframe.length === 0) && briefing.file_url && !briefing.file_url.match(/\.(mp4|mov|avi|webm)(\?.*)?$/i)
            ? [{ imageUrl: briefing.file_url, index: 0 }]
            : undefined;
          const effectiveSlides = slidesFromWireframe?.length ? slidesFromWireframe : derivedSingleSlide;

          // Galeria para carrossel ou quando há mais de um slide
          if (briefing.type === 'carousel' && effectiveSlides) {
            return <CarouselGallery slides={effectiveSlides} />;
          }
          if (effectiveSlides && effectiveSlides.length > 1) {
            return <CarouselGallery slides={effectiveSlides} />;
          }

          if (briefing.type === 'video' && briefing.status === 'processing') {
            return (
              <VideoGenerationProgress
                materialId={briefingId}
                projectId={projectId}
                onComplete={loadBriefing}
              />
            );
          }

          if (briefing.type === 'video' && briefing.file_url) {
            return (
              <VideoPlayerWithCaption
                videoUrl={briefing.file_url}
                caption={briefing.caption}
                thumbnailUrl={briefing.thumbnail_url}
              />
            );
          }

          if (briefing.type === 'wireframe' || briefing.type === 'image') {
            // Se não houver slides, voltar para o editor (canvas)
            return (
              <BriefingEditorLayout
                briefingId={briefingId}
                projectId={projectId}
                visualizationContent={visualizationContent}
                onVisualizationChange={handleVisualizationChange}
                wireframeData={effectiveSlides ? { slides: effectiveSlides, isCarousel: false } : briefing.wireframe_data}
                materialType={briefing.type}
                fileUrl={briefing.file_url}
                thumbnailUrl={briefing.thumbnail_url}
                caption={briefing.caption}
              />
            );
          }

          return (
            <Card>
              <CardContent className="flex items-center justify-center min-h-[400px]">
                <p className="text-muted-foreground">Conteúdo ainda não disponível.</p>
              </CardContent>
            </Card>
          );
        })()}

        {/* ========== AÇÕES DE APROVAÇÃO ========== */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            {participantCheckLoading ? (
              <Card>
                <CardHeader>
                  <h3 className="font-semibold">Ações de Aprovação</h3>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-center py-8">
                    <div className="text-muted-foreground">Verificando permissões...</div>
                  </div>
                </CardContent>
              </Card>
            ) : (isProjectParticipant || profile?.role === 'admin') ? (
              <Card className="ml-[210px]">
                <CardHeader>
                  <h3 className="font-semibold">Ações de Aprovação</h3>
                </CardHeader>
              <CardContent className="space-y-4">
                {/* Botões de Aprovação */}
                <div className="flex gap-3 flex-wrap">
                  <Button 
                    onClick={handleInternalApproval}
                    variant={briefing.status === 'internal_approval' ? 'success' : 'default'}
                    className="flex-1 h-11 items-center justify-center"
                    disabled={approving}
                  >
                    <ThumbsUp className="h-4 w-4 mr-2" />
                    {briefing.status === 'internal_approval' ? 'Aprovado - Interno' : 'Aprovar - Interno'}
                  </Button>
                  
                  <Button 
                    onClick={handleClientApproval}
                    variant={briefing.status === 'approved' ? 'success' : 'default'}
                    className="flex-1 h-11 items-center justify-center"
                    disabled={approving || participantCheckLoading}
                  >
                    <Check className="h-4 w-4 mr-2" />
                    {approving ? "Aprovando e redirecionando..." : (briefing.status === 'approved' ? 'Aprovado - Cliente' : 'Aprovar Cliente')}
                  </Button>
                </div>
                
                {/* Formulário de Comentário */}
                <div className="space-y-2">
                  <label className="text-sm font-medium block">
                    Comentários com Menções (opcional)
                  </label>
                  <MentionInput
                    value={newComment}
                    onChange={setNewComment}
                    onMentionUsers={(users) => setMentionedUsers(users.map(u => u.id))}
                    placeholder="Adicione seus comentários... Use @ para mencionar alguém"
                    className="min-h-[100px] w-full"
                    projectId={projectId}
                  />
                  <Button onClick={handleAddComment} size="sm" className="w-full h-11 items-center justify-center">
                    <Send className="h-4 w-4 mr-2" />
                    Enviar Comentário
                  </Button>
                </div>
              </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <h3 className="font-semibold">Ações de Aprovação</h3>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-center py-8">
                    <div className="text-center space-y-2">
                      <div className="text-muted-foreground">🔒</div>
                      <p className="text-muted-foreground">
                        Apenas participantes do projeto podem aprovar briefings
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
            </div>
          </div>

      </div>
    </div>
  );
};
