import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, X, File, Image, Video, FileText, Newspaper, CreditCard } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { generatePdfThumbnail, generateVideoThumbnail, generateImageThumbnail } from "@/utils/thumbnailGenerator";
import { useMaterials } from "@/contexts/MaterialsContext";
import { createNewsLayoutCanvas, createCardLayoutCanvas, createDefaultLayoutCanvas } from "@/utils/canvasTemplates";

interface UploadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMaterialUploaded?: () => void;
}

interface Project {
  id: string;
  name: string;
  company_name: string;
}

export const UploadModal = ({ open, onOpenChange, onMaterialUploaded }: UploadModalProps) => {
  const { notifyMaterialChange } = useMaterials();
  const [dragActive, setDragActive] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [selectedProject, setSelectedProject] = useState("");
  const [materialName, setMaterialName] = useState("");
  const [description, setDescription] = useState("");
  const [reference, setReference] = useState("");
  const [personaOrProduct, setPersonaOrProduct] = useState<"persona" | "produto" | "">("");
  const [layoutType, setLayoutType] = useState<'default' | 'news' | 'card'>('default');
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [cta, setCta] = useState("");
  const [newsTitle, setNewsTitle] = useState("");
  const [sourceLabel, setSourceLabel] = useState("");
  const [cardText, setCardText] = useState("");
  const [isRunning, setIsRunning] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const { profile } = useAuth();
  const { toast } = useToast();

  // Verificar role do usuário no projeto selecionado
  const checkUserRoleInProject = async (projectId: string) => {
    if (!profile?.user_id || !projectId) return null;

    try {
      // Verificar se é participante do projeto
      const { data: participant } = await supabase
        .from('project_participants')
        .select('role')
        .eq('project_id', projectId)
        .eq('user_id', profile.user_id)
        .maybeSingle();

      if (participant) {
        return participant.role;
      }

      // Verificar se é o criador do projeto
      const { data: project } = await supabase
        .from('projects')
        .select('created_by')
        .eq('id', projectId)
        .maybeSingle();

      if (project?.created_by === profile.id) {
        return 'owner';
      }

      // Se não é participante nem criador, verificar se é admin
      return profile.role === 'admin' ? 'admin' : null;

    } catch (error) {
      console.error('Erro ao verificar role do usuário no projeto:', error);
      return null;
    }
  };

  // Verificar role quando projeto for selecionado
  useEffect(() => {
    if (selectedProject) {
      checkUserRoleInProject(selectedProject).then(role => {
        setUserRole(role);
      });
    } else {
      setUserRole(null);
    }
  }, [selectedProject, profile]);

  // Carregar projetos quando o modal abrir
  useEffect(() => {
    if (open) {
      loadProjects();
    }
  }, [open]);

  const loadProjects = async () => {
    try {
      const { data, error } = await supabase
        .from("projects")
        .select(`
          id,
          name,
          companies!inner(name)
        `)
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formattedProjects = (data || []).map(project => ({
        id: project.id,
        name: project.name,
        company_name: project.companies?.name || 'Empresa não encontrada'
      }));

      setProjects(formattedProjects);
    } catch (error) {
      console.error("Erro ao carregar projetos:", error);
      toast({
        title: "Erro",
        description: "Erro ao carregar projetos",
        variant: "destructive"
      });
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleFiles = (fileList: File[]) => {
    const MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024; // 2GB
    const validFiles = fileList.filter(file => {
      const isValidType = file.type.startsWith('image/') ||
        file.type.startsWith('video/') ||
        file.type === 'application/pdf';
      const isValidSize = file.size <= MAX_FILE_SIZE;
      return isValidType && isValidSize;
    });

    setFiles(prev => [...prev, ...validFiles]);
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Verificar se usuário pode fazer upload
    if (userRole === 'viewer') {
      toast({
        title: "Acesso Negado",
        description: "Visualizadores não podem fazer upload de arquivos",
        variant: "destructive"
      });
      return;
    }

    // Validação: projeto e nome são obrigatórios
    if (!selectedProject || !materialName.trim()) {
      toast({
        title: "Erro",
        description: "Preencha o projeto e o nome do material",
        variant: "destructive"
      });
      return;
    }

    // Validação: verificar se há dados do wireframe ou arquivos
    const hasWireframeData =
      title.trim() ||
      subtitle.trim() ||
      cta.trim() ||
      newsTitle.trim() ||
      sourceLabel.trim() ||
      cardText.trim();

    if (!hasWireframeData && files.length === 0) {
      toast({
        title: "Erro",
        description: "Preencha pelo menos um campo do wireframe ou adicione arquivos",
        variant: "destructive"
      });
      return;
    }

    if (!profile?.id) {
      toast({
        title: "Erro",
        description: "Usuário não identificado",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      // Buscar o company_id do projeto selecionado
      const { data: projectData, error: projectError } = await supabase
        .from('projects')
        .select('company_id')
        .eq('id', selectedProject)
        .single();

      if (projectError) throw projectError;

      // Se há dados de wireframe (sem arquivos), criar material wireframe
      if ((title.trim() || subtitle.trim() || cta.trim() || newsTitle.trim() || cardText.trim()) && files.length === 0) {
        // Gerar wireframe baseado no tipo de layout selecionado
        let wireframeData: any = null;
        let canvasData: string | null = null;

        if (layoutType === 'news') {
          // Novo formato: usar Canvas do Fabric.js
          const canvasJson = createNewsLayoutCanvas(newsTitle.trim() || 'Texto da notícia');
          canvasData = JSON.stringify(canvasJson);
          // Não usar wireframe_data para layouts news
        } else if (layoutType === 'card') {
          // Novo formato: usar Canvas do Fabric.js para layout de card
          const canvasJson = createCardLayoutCanvas(
            cardText.trim() || 'Texto',
            cta.trim() || 'CTA'
          );
          canvasData = JSON.stringify(canvasJson);
          // Não usar wireframe_data para layouts card
        } else {
          // Layout padrão com Canvas do Fabric.js
          const canvasJson = createDefaultLayoutCanvas(
            title.trim() || 'Texto',
            cta.trim() || 'CTA'
          );
          canvasData = JSON.stringify(canvasJson);
          // Não usar wireframe_data para layouts default
        }

        const { error: materialError } = await supabase
          .from("materials")
          .insert({
            name: materialName,
            type: 'wireframe',
            status: 'pending',
            project_id: selectedProject,
            created_by: profile.id,
            company_id: projectData.company_id,
            wireframe_data: wireframeData,
            canvas_data: canvasData,
            caption: description.trim() || null,
            reference: reference.trim() || null,
            file_url: null,
            thumbnail_url: null,
            is_briefing: true,
            briefing_approved_by_client: false,
            is_running: isRunning,
          });

        if (materialError) throw materialError;

        toast({
          title: "Sucesso!",
          description: "Wireframe enviado para aprovação!"
        });
      } else {
        // Se há múltiplos arquivos, fazer upload de todos e criar um material com carrossel
        const fileUrls = [];

        for (let i = 0; i < files.length; i++) {
          const file = files[i];

          console.log(`Fazendo upload para GCS via Edge Function: ${file.name}`);

          // Criar FormData para enviar o arquivo
          const formData = new FormData();
          formData.append('file', file);
          formData.append('path', `materials/${profile.id}`);

          // Chamar Edge Function para upload no GCS
          const { data: uploadResult, error: uploadError } = await supabase.functions
            .invoke('upload-to-storage', {
              body: formData
            });

          if (uploadError || !uploadResult?.path) {
            console.error('Erro no upload via GCS:', uploadError);
            throw uploadError || new Error('Upload falhou - URL não retornada');
          }

          console.log(`Upload realizado com sucesso:`, uploadResult.path);

          // Determinar o tipo baseado no arquivo
          let type = 'image';
          if (file.type.startsWith('video/')) {
            type = 'video';
          } else if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
            type = 'pdf';
          }

          fileUrls.push({
            url: uploadResult.path, // URL do GCS
            name: file.name,
            type: type
          });
        }

        // Criar um único material com todos os arquivos (carrossel)
        const { error: materialError } = await supabase
          .from("materials")
          .insert({
            name: materialName,
            type: files.length > 1 ? 'carousel' : fileUrls[0].type, // Se tiver mais de 1 arquivo, é carrossel
            status: 'pending',
            project_id: selectedProject,
            created_by: profile.id,
            company_id: projectData.company_id,
            caption: description.trim() || null,
            reference: reference.trim() || null,
            file_url: files.length > 1 ? JSON.stringify(fileUrls) : fileUrls[0].url, // JSON para carrossel, URL única para arquivo único
            thumbnail_url: null, // Será gerada separadamente se necessário
            is_briefing: false,
            briefing_approved_by_client: false,
            is_running: isRunning,
          });

        if (materialError) throw materialError;

        toast({
          title: "Sucesso!",
          description: `Material com ${files.length} arquivo(s) enviado para aprovação!`
        });
      }

      // Reset form
      setFiles([]);
      setSelectedProject("");
      setMaterialName("");
      setDescription("");
      setReference("");
      setPersonaOrProduct("");
      setLayoutType('default');
      setTitle("");
      setSubtitle("");
      setCta("");
      setNewsTitle("");
      setSourceLabel("");
      setCardText("");
      setIsRunning(true);

      onOpenChange(false);

      // Notificar mudança para todos os componentes
      notifyMaterialChange('created');

      // Callback para notificar componente pai
      onMaterialUploaded?.();

      // Atualizar página para refletir mudanças
      setTimeout(() => window.location.reload(), 500);
    } catch (error: any) {
      console.error("Erro ao enviar materiais:", error);

      let errorMessage = "Erro ao enviar materiais";
      if (error && typeof error === 'object') {
        if (error.message) {
          errorMessage = error.message;
        } else if (error.error) {
          errorMessage = error.error;
        }
      }

      toast({
        title: "Erro no Upload",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const getFileIcon = (file: File) => {
    if (file.type.startsWith('image/')) return <Image className="h-4 w-4" />;
    if (file.type.startsWith('video/')) return <Video className="h-4 w-4" />;
    return <File className="h-4 w-4" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>Upload de Materiais</DialogTitle>
          <DialogDescription>
            Faça upload dos materiais criativos para aprovação do cliente
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-2">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Project Selection */}
            <div className="space-y-2">
              <Label htmlFor="project">Escolher Projeto *</Label>
              <Select value={selectedProject} onValueChange={setSelectedProject} required>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o projeto" />
                </SelectTrigger>
                <SelectContent className="bg-background border z-50">
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      <div className="flex flex-col">
                        <span className="font-medium">{project.name}</span>
                        <span className="text-xs text-muted-foreground">{project.company_name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {projects.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Nenhum projeto ativo encontrado. Crie um projeto primeiro.
                </p>
              )}
            </div>

            {/* Material Info */}
            <div className="space-y-2">
              <Label htmlFor="material-name">Nome do Material *</Label>
              <Input
                id="material-name"
                value={materialName}
                onChange={(e) => setMaterialName(e.target.value)}
                placeholder="Ex: Banner Principal - Desktop"
                required
              />
            </div>

            {/* Wireframe Fields */}
            <div className="space-y-4 border rounded-lg p-4 bg-accent/20">
              <Label className="text-sm font-semibold">Dados do Wireframe</Label>

              {/* Tipo de Layout */}
              <div className="space-y-2">
                <Label htmlFor="layout-type">Tipo de Layout *</Label>
                <Select value={layoutType} onValueChange={(value: 'default' | 'news' | 'card') => setLayoutType(value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o tipo de layout" />
                  </SelectTrigger>
                  <SelectContent className="bg-background border z-50">
                    <SelectItem value="default">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        <span>Padrão</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="news">
                      <div className="flex items-center gap-2">
                        <Newspaper className="h-4 w-4" />
                        <span>Notícia</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="card">
                      <div className="flex items-center gap-2">
                        <CreditCard className="h-4 w-4" />
                        <span>Card</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Preview do Template */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Preview do Template</Label>
                <div className="border rounded-lg overflow-hidden bg-background">
                  <img
                    src={
                      layoutType === 'news' ? '/wireframe-templates/news.png' :
                        layoutType === 'card' ? '/wireframe-templates/card.png' :
                          '/wireframe-templates/default.png'
                    }
                    alt={`Template ${layoutType}`}
                    className="w-full h-auto"
                  />
                </div>
              </div>


              {/* Campos dinâmicos baseados no tipo de layout */}
              {layoutType === 'news' && (
                <div className="space-y-2">
                  <Label htmlFor="news-text">Notícia</Label>
                  <Textarea
                    id="news-text"
                    value={newsTitle}
                    onChange={(e) => setNewsTitle(e.target.value)}
                    placeholder="Digite o texto principal da notícia..."
                    className="min-h-[100px]"
                  />
                  <p className="text-xs text-muted-foreground">
                    Este texto aparecerá no campo "Texto da notícia" no layout
                  </p>
                </div>
              )}

              {layoutType === 'card' && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="card-text">Texto do Card</Label>
                    <Textarea
                      id="card-text"
                      value={cardText}
                      onChange={(e) => setCardText(e.target.value)}
                      placeholder="Digite o texto que aparecerá no card..."
                      className="min-h-[100px]"
                    />
                    <p className="text-xs text-muted-foreground">
                      Este texto aparecerá na área cinza do card
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cta">Call to Action (CTA)</Label>
                    <Input
                      id="cta"
                      value={cta}
                      onChange={(e) => setCta(e.target.value)}
                      placeholder="Ex: Compre Agora"
                    />
                    <p className="text-xs text-muted-foreground">
                      Texto que aparecerá no botão preto
                    </p>
                  </div>
                </>
              )}

              {layoutType === 'default' && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="title">Texto Principal</Label>
                    <Textarea
                      id="title"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Digite o texto principal..."
                      className="min-h-[100px]"
                    />
                    <p className="text-xs text-muted-foreground">
                      Este texto aparecerá centralizado no layout
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="cta">Call to Action (CTA)</Label>
                    <Input
                      id="cta"
                      value={cta}
                      onChange={(e) => setCta(e.target.value)}
                      placeholder="Ex: Saiba mais, Comprar agora, Fale conosco"
                    />
                    <p className="text-xs text-muted-foreground">
                      Texto que aparecerá no botão
                    </p>
                  </div>
                </>
              )}

              <p className="text-xs text-muted-foreground bg-primary/5 p-3 rounded">
                💡 O wireframe será gerado automaticamente com base no tipo de layout selecionado. A logo será centralizada e o separador será incluído automaticamente.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="reference">Referência (opcional)</Label>
              <Input
                id="reference"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="Link ou texto de referência..."
              />
              <p className="text-xs text-muted-foreground">
                Adicione um link ou texto de referência que aparecerá acima do material
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descrição / Legenda</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descreva o material ou instruções específicas..."
                className="min-h-[80px]"
              />
            </div>

            {/* Toggle Em Veiculação / Disponível */}
            <div className="space-y-2 p-4 bg-muted/20 rounded-lg border">
              <Label className="text-sm font-medium">Status de Veiculação</Label>
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">
                    {isRunning ? 'Material será marcado como "Em Veiculação"' : 'Material será marcado como "Disponível"'}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsRunning(!isRunning)}
                >
                  {isRunning ? 'Marcar como Disponível' : 'Marcar como Em Veiculação'}
                </Button>
              </div>
            </div>

            {/* File Upload */}
            <div className="space-y-4">
              <Label>Arquivos</Label>

              {userRole === 'viewer' && (
                <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
                  <p className="text-sm text-destructive font-medium">
                    Você não tem permissão para fazer upload de arquivos neste projeto.
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Visualizadores só podem ver materiais e fazer comentários.
                  </p>
                </div>
              )}

              <div
                className={cn(
                  "border-2 border-dashed rounded-lg p-8 text-center transition-colors",
                  userRole === 'viewer'
                    ? "border-muted-foreground/10 bg-muted/20"
                    : dragActive
                      ? "border-primary bg-primary/5"
                      : "border-muted-foreground/25 hover:border-primary/50"
                )}
                onDragEnter={userRole !== 'viewer' ? handleDrag : undefined}
                onDragLeave={userRole !== 'viewer' ? handleDrag : undefined}
                onDragOver={userRole !== 'viewer' ? handleDrag : undefined}
                onDrop={userRole !== 'viewer' ? handleDrop : undefined}
              >
                <Upload className={cn("mx-auto h-12 w-12 mb-4", userRole === 'viewer' ? "text-muted-foreground/50" : "text-muted-foreground")} />
                <div className="space-y-2">
                  <p className={cn("text-lg font-medium", userRole === 'viewer' && "text-muted-foreground")}>
                    {userRole === 'viewer' ? 'Upload não permitido para visualizadores' : 'Arraste arquivos aqui ou clique para selecionar'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {userRole === 'viewer' ? 'Apenas colaboradores podem fazer upload' : 'Suporta imagens, vídeos e PDFs até 2GB'}
                  </p>
                  <input
                    type="file"
                    multiple
                    accept="image/*,video/*,.pdf"
                    onChange={(e) => e.target.files && handleFiles(Array.from(e.target.files))}
                    className="hidden"
                    id="file-upload"
                    disabled={userRole === 'viewer'}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => document.getElementById('file-upload')?.click()}
                    disabled={userRole === 'viewer'}
                  >
                    Selecionar Arquivos
                  </Button>
                </div>
              </div>

              {/* File List */}
              {files.length > 0 && (
                <div className="space-y-2">
                  <Label>Arquivos Selecionados ({files.length})</Label>
                  <div className="max-h-32 overflow-y-auto space-y-2">
                    {files.map((file, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 bg-accent/50 rounded-lg"
                      >
                        <div className="flex items-center space-x-3">
                          {getFileIcon(file)}
                          <div>
                            <p className="text-sm font-medium truncate max-w-[200px]">
                              {file.name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatFileSize(file.size)}
                            </p>
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFile(index)}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex justify-end space-x-3 pt-4 border-t bg-background sticky bottom-0">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                variant="gradient"
                disabled={!selectedProject || !materialName.trim() || loading || userRole === 'viewer'}
              >
                {loading ? "Enviando..." : "Enviar para Aprovação"}
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
};