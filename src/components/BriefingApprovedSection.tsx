import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { 
  Search, 
  Grid3X3, 
  List, 
  FileText,
  Upload,
  Plus,
  Eye
} from "lucide-react";
import { MaterialsGrid } from "@/components/MaterialsGrid";
import { WireframePreview } from "@/components/WireframePreview";
import { WireframeHTMLPreview } from "@/components/WireframeHTMLPreview";
import { WireframeCompactPreview } from "@/components/WireframeCompactPreview";
import { ApprovedBriefingViewer } from "@/components/ApprovedBriefingViewer";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

interface ApprovedBriefing {
  id: string;
  name: string;
  type: 'wireframe' | 'carousel' | 'video';
  status: 'approved';
  comments: number;
  caption?: string;
  wireframe_data?: any;
  canvas_data?: string;
  thumbnail_url?: string;
}

interface BriefingApprovedSectionProps {
  projectId: string;
  onMaterialCreated?: () => void;
}

type ViewMode = 'grid' | 'list';

export const BriefingApprovedSection = ({ projectId, onMaterialCreated }: BriefingApprovedSectionProps) => {
  const [approvedBriefings, setApprovedBriefings] = useState<ApprovedBriefing[]>([]);
  const [filteredBriefings, setFilteredBriefings] = useState<ApprovedBriefing[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBriefing, setSelectedBriefing] = useState<ApprovedBriefing | null>(null);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [reference, setReference] = useState("");
  const [uploading, setUploading] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [viewingBriefing, setViewingBriefing] = useState<string | null>(null);
  const [allBriefingIds, setAllBriefingIds] = useState<string[]>([]);
  const { toast } = useToast();
  const { profile } = useAuth();

  // Função para gerar thumbnail automaticamente
  const generateThumbnailForBriefing = async (briefingId: string, canvasData: string) => {
    try {
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = 700;
      tempCanvas.height = 550;
      
      const { Canvas: FabricCanvas } = await import('fabric');
      const fabricCanvas = new FabricCanvas(tempCanvas);
      await fabricCanvas.loadFromJSON(JSON.parse(canvasData));
      fabricCanvas.renderAll();
      
      const thumbnailDataUrl = fabricCanvas.toDataURL({
        format: 'png',
        quality: 0.8,
        multiplier: 0.5,
      });
      
      fabricCanvas.dispose();
      
      // Salvar thumbnail no banco
      await supabase
        .from('materials')
        .update({ thumbnail_url: thumbnailDataUrl })
        .eq('id', briefingId);
      
      return thumbnailDataUrl;
    } catch (error) {
      console.error('Erro ao gerar thumbnail:', error);
      return null;
    }
  };

  const loadApprovedBriefings = async () => {
    try {
      setLoading(true);
      
      const { data: briefingData, error } = await supabase
        .from('materials')
        .select('id, name, type, status, caption, wireframe_data, canvas_data, thumbnail_url, briefing_approved_by_client, updated_at')
        .eq('project_id', projectId)
        .in('type', ['wireframe', 'carousel', 'video'])
        .eq('is_briefing', true)
        .eq('briefing_approved_by_client', true)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Usar diretamente os dados do wireframe salvos no material
      // Não buscar de ai_generated_briefings pois isso pode conter dados antigos
      const briefingsWithoutFiles: ApprovedBriefing[] = (briefingData || []).map(briefing => {
        // Se tem canvas_data mas não tem thumbnail, gerar em background
        const needsThumbnail = briefing.canvas_data && !briefing.thumbnail_url;
        
        if (needsThumbnail) {
          // Gerar thumbnail em background (não bloqueia renderização)
          generateThumbnailForBriefing(briefing.id, briefing.canvas_data)
            .then(thumbnail => {
              if (thumbnail) {
                // Atualizar estado para re-renderizar com nova thumbnail
                setApprovedBriefings(prev => 
                  prev.map(b => b.id === briefing.id 
                    ? { ...b, thumbnail_url: thumbnail } 
                    : b
                  )
                );
                setFilteredBriefings(prev => 
                  prev.map(b => b.id === briefing.id 
                    ? { ...b, thumbnail_url: thumbnail } 
                    : b
                  )
                );
              }
            });
        }
        
        return {
          id: briefing.id,
          name: briefing.name,
          type: briefing.type as 'wireframe',
          status: 'approved',
          comments: 0,
          caption: briefing.caption || undefined,
          wireframe_data: briefing.wireframe_data || undefined,
          canvas_data: briefing.canvas_data || undefined,
          thumbnail_url: briefing.thumbnail_url || undefined
        };
      });

      setApprovedBriefings(briefingsWithoutFiles);
      setFilteredBriefings(briefingsWithoutFiles);
      setAllBriefingIds(briefingsWithoutFiles.map(b => b.id));

    } catch (error) {
      console.error('Erro ao carregar briefings aprovados:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar briefings aprovados",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Verificar role do usuário no projeto
  const checkUserRoleInProject = async () => {
    if (!profile?.user_id || !projectId) return;
    
    try {
      // Verificar se é participante do projeto
      const { data: participant } = await supabase
        .from('project_participants')
        .select('role')
        .eq('project_id', projectId)
        .eq('user_id', profile.user_id)
        .maybeSingle();
      
      if (participant) {
        setUserRole(participant.role);
        return;
      }
      
      // Verificar se é o criador do projeto
      const { data: project } = await supabase
        .from('projects')
        .select('created_by')
        .eq('id', projectId)
        .maybeSingle();
      
      if (project?.created_by === profile.id) {
        setUserRole('owner');
        return;
      }
      
      // Se não é participante nem criador, verificar se é admin
      setUserRole(profile.role === 'admin' ? 'admin' : null);
      
    } catch (error) {
      console.error('Erro ao verificar role do usuário no projeto:', error);
      setUserRole(null);
    }
  };

  useEffect(() => {
    loadApprovedBriefings();
    checkUserRoleInProject();

    // Setup realtime subscription
    const channel = supabase
      .channel('approved-briefings-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'materials',
          filter: `project_id=eq.${projectId}`
        },
        (payload) => {
          console.log('Approved briefing change detected:', payload);
          loadApprovedBriefings();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId]);

  useEffect(() => {
    const filtered = approvedBriefings.filter(briefing => {
      return briefing.name.toLowerCase().includes(searchTerm.toLowerCase());
    });
    setFilteredBriefings(filtered);
  }, [approvedBriefings, searchTerm]);

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

  const handleSendToMaterials = async () => {
    if (!selectedBriefing || files.length === 0 || !profile?.id) {
      toast({
        title: "Erro",
        description: "Selecione arquivos para enviar",
        variant: "destructive"
      });
      return;
    }

    // Verificar se usuário pode fazer upload
    if (userRole === 'viewer') {
      toast({
        title: "Acesso Negado",
        description: "Visualizadores não podem fazer upload de arquivos",
        variant: "destructive"
      });
      return;
    }

    setUploading(true);
    try {
      // Buscar o company_id do projeto
      const { data: projectData, error: projectError } = await supabase
        .from('projects')
        .select('company_id')
        .eq('id', projectId)
        .single();

      if (projectError) throw projectError;

      // Se há múltiplos arquivos, fazer upload de todos e criar um material com carrossel
      const fileUrls = [];
      
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        const timestamp = Date.now();
        const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
        const filename = `${timestamp}-${sanitizedName}`;

        console.log(`Fazendo upload para Google Cloud Storage: ${file.name}`);
        
        // Create FormData with file
        const formData = new FormData();
        formData.append('file', file);
        formData.append('path', `materials/${profile.id}`);

        // Upload through edge function (bypasses CORS)
        const { data: uploadData, error: uploadError } = await supabase.functions.invoke(
          'gcs-upload-file',
          {
            body: formData,
          }
        );

        if (uploadError) throw uploadError;
        if (!uploadData?.publicUrl) {
          throw new Error('No public URL returned from upload');
        }

        console.log('File uploaded successfully:', uploadData);

        // URL pública do arquivo no GCS
        const publicUrl = uploadData.publicUrl;
        
        // Determinar o tipo baseado no arquivo
        let type = 'image';
        if (file.type.startsWith('video/')) {
          type = 'video';
        } else if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
          type = 'pdf';
        }
        
        fileUrls.push({
          url: publicUrl,
          name: file.name,
          type: type
        });
      }

      // Criar um único material com todos os arquivos (carrossel)
      const { error: materialError } = await supabase
        .from("materials")
        .insert({
          name: `${selectedBriefing.name} - Material`,
          type: fileUrls[0].type,
          status: 'pending',
          project_id: projectId,
          created_by: profile.id,
          company_id: projectData.company_id,
          caption: selectedBriefing.caption,
          reference: reference.trim() || null,
          wireframe_data: selectedBriefing.wireframe_data,
          canvas_data: selectedBriefing.canvas_data,
          file_url: files.length > 1 ? JSON.stringify(fileUrls) : fileUrls[0].url,
          thumbnail_url: selectedBriefing.thumbnail_url,
          is_briefing: false,
          briefing_approved_by_client: false,
        });

      if (materialError) throw materialError;

      // Marcar o briefing original como já convertido em material
      await supabase
        .from('materials')
        .update({ briefing_approved_by_client: false })
        .eq('id', selectedBriefing.id);

      toast({
        title: "Sucesso!",
        description: `Material com ${files.length} arquivo(s) enviado para aprovação!`
      });
      
      // Recarregar a lista após enviar para materiais
      loadApprovedBriefings();
      
      // Notificar que um material foi criado para atualizar contadores
      onMaterialCreated?.();
      
      // Reset do estado
      setFiles([]);
      setReference("");
      setSelectedBriefing(null);
      setUploadModalOpen(false);
      
    } catch (error) {
      console.error("Erro ao enviar para materiais:", error);
      
      // Log mais detalhado para debug
      if (error instanceof Error) {
        console.error("Erro detalhado:", {
          message: error.message,
          stack: error.stack
        });
      }
      
      toast({
        title: "Erro ao enviar materiais",
        description: error instanceof Error ? error.message : "Erro desconhecido. Verifique o console.",
        variant: "destructive"
      });
    } finally {
      setUploading(false);
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  // Se está visualizando um briefing específico
  if (viewingBriefing) {
    return (
      <ApprovedBriefingViewer 
        briefingId={viewingBriefing}
        projectId={projectId}
        onBack={() => {
          setViewingBriefing(null);
          loadApprovedBriefings();
        }}
        allBriefingIds={filteredBriefings.map(b => b.id)}
        searchTerm={searchTerm}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-semibold">Briefing Aprovados</h3>
          <p className="text-sm text-muted-foreground">
            Briefings aprovados pelo cliente - Adicione arquivos e envie para Materiais
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={viewMode === 'grid' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('grid')}
          >
            <Grid3X3 className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === 'list' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('list')}
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Stats Card */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-success/10 rounded-lg">
              <FileText className="h-4 w-4 text-success" />
            </div>
            <div>
              <p className="text-2xl font-bold">{approvedBriefings.length || 0}</p>
              <p className="text-xs text-muted-foreground">Briefings Aprovados</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Search */}
      <div className="relative w-64">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
        <Input
          placeholder="Buscar briefings aprovados..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Briefings Grid com ação customizada */}
      {loading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando briefings aprovados...</p>
        </div>
      ) : filteredBriefings.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredBriefings.map((briefing) => (
            <Card key={briefing.id} className="p-4 space-y-4 bg-slate-900 border-slate-700 hover:shadow-lg transition-shadow">
              {/* Header com nome e badge */}
              <div className="flex items-start justify-between">
                <h3 className="font-montserrat font-bold text-lg text-white">
                  {briefing.name}
                </h3>
                <Badge className="bg-emerald-500 text-white hover:bg-emerald-600">
                  Aprovado pelo Cliente
                </Badge>
              </div>

              {/* Ícone e tipo do wireframe */}
              <div className="flex items-center gap-3 text-slate-400">
                <div className="w-8 h-8 bg-slate-700 rounded flex items-center justify-center">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M3 3h6v6H3V3zm8 0h6v6h-6V3zm8 0h2v6h-2V3zM3 11h6v6H3v-6zm8 0h6v6h-6v-6zm8 0h2v6h-2v-6zM3 19h6v2H3v-2zm8 0h6v2h-6v-2zm8 0h2v2h-2v-2z"/>
                  </svg>
                </div>
                <span className="text-sm font-medium">WIREFRAME APROVADO</span>
              </div>

              {/* Visualização do Canvas editado ou wireframe antigo */}
              {briefing.type === 'wireframe' && (
                <div className="flex justify-center mt-4">
                  {briefing.canvas_data && briefing.thumbnail_url ? (
                    // Tem Canvas E thumbnail - renderizar imagem
                    <img 
                      src={briefing.thumbnail_url} 
                      alt="Canvas Preview"
                      className="w-full max-w-xs rounded-lg border-2 border-slate-600 shadow-lg"
                    />
                  ) : briefing.canvas_data && !briefing.thumbnail_url ? (
                    // Tem Canvas mas NÃO tem thumbnail - gerando...
                    <div className="w-full max-w-xs h-48 rounded-lg border-2 border-slate-600 bg-slate-800 flex items-center justify-center">
                      <div className="text-center space-y-2">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500 mx-auto"></div>
                        <p className="text-slate-400 text-xs">Gerando visualização...</p>
                      </div>
                    </div>
                  ) : briefing.wireframe_data ? (
                    // Não tem Canvas, usar wireframe antigo
                    <WireframeCompactPreview wireframe_data={briefing.wireframe_data} />
                  ) : (
                    // Não tem nada
                    <p className="text-slate-400 text-sm">Visualização não disponível</p>
                  )}
                </div>
              )}


              {/* Descrição */}
              <p className="text-slate-400 text-sm italic">
                Wireframe com layout estrutural definido
              </p>

              {/* Botões de ação */}
              <div className="flex gap-2">
                <Button 
                  className="flex-1 bg-transparent border border-slate-600 text-white hover:bg-slate-800" 
                  variant="outline"
                  onClick={() => setViewingBriefing(briefing.id)}
                >
                  <Eye className="h-4 w-4 mr-2" />
                  Visualizar Briefing
                </Button>
              </div>

              {/* Botão de adicionar arquivo */}
              <Dialog open={uploadModalOpen && selectedBriefing?.id === briefing.id} onOpenChange={(open) => {
                setUploadModalOpen(open);
                if (!open) {
                  setSelectedBriefing(null);
                  setFiles([]);
                }
              }}>
                <DialogTrigger asChild>
                  <Button 
                    className="w-full bg-transparent border border-slate-600 text-white hover:bg-slate-800" 
                    variant="outline"
                    disabled={userRole === 'viewer'}
                    onClick={() => {
                      if (userRole === 'viewer') {
                        toast({
                          title: "Acesso Negado",
                          description: "Visualizadores não podem fazer upload de arquivos",
                          variant: "destructive"
                        });
                        return;
                      }
                      setSelectedBriefing(briefing);
                      setUploadModalOpen(true);
                    }}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    {userRole === 'viewer' ? 'Sem Permissão para Upload' : 'Adicionar Arquivo'}
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle className="font-montserrat font-bold">Adicionar Arquivo - {briefing.name}</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Referência (opcional)</Label>
                      <Input
                        value={reference}
                        onChange={(e) => setReference(e.target.value)}
                        placeholder="Link ou texto de referência..."
                      />
                      <p className="text-xs text-muted-foreground">
                        Adicione um link ou texto de referência que aparecerá acima do material
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label className="font-montserrat font-bold">Selecionar Arquivo</Label>
                      <div className="relative">
                        <input
                          type="file"
                          multiple
                          accept="image/*,video/*,.pdf"
                          onChange={(e) => e.target.files && handleFiles(Array.from(e.target.files))}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                          id={`file-upload-${briefing.id}`}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          className="w-full h-10 border-2 border-dashed border-primary/50 hover:border-primary hover:bg-primary/5 transition-colors font-montserrat"
                          onClick={() => document.getElementById(`file-upload-${briefing.id}`)?.click()}
                        >
                          <Upload className="h-4 w-4 mr-2" />
                          Escolher Arquivos
                        </Button>
                      </div>
                    </div>
                    
                    {files.length > 0 && (
                      <div className="space-y-2">
                        <Label className="font-montserrat font-bold">Arquivos Selecionados ({files.length})</Label>
                        <div className="max-h-32 overflow-y-auto space-y-2">
                          {files.map((file, index) => (
                            <div key={index} className="flex items-center justify-between p-2 bg-accent/50 rounded">
                              <span className="text-sm truncate font-montserrat">{file.name}</span>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => removeFile(index)}
                              >
                                ×
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        onClick={() => {
                          setUploadModalOpen(false);
                          setFiles([]);
                          setSelectedBriefing(null);
                        }}
                      >
                        Cancelar
                      </Button>
                      <Button 
                        onClick={handleSendToMaterials}
                        disabled={files.length === 0 || uploading || userRole === 'viewer'}
                        className="flex-1"
                      >
                        {uploading ? "Enviando..." : userRole === 'viewer' ? "Não Permitido" : "Enviar para Materiais"}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-muted-foreground">
          Nenhum briefing aprovado encontrado
        </div>
      )}
    </div>
  );
};