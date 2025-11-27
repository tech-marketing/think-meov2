import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { History, Eye, RotateCcw, Clock, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface MaterialVersion {
  id: string;
  version_number: number;
  file_url: string;
  thumbnail_url: string | null;
  wireframe_data: any;
  created_at: string;
  notes: string | null;
  author_name: string;
}

interface MaterialVersionsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  materialId: string;
  materialName: string;
  materialType: string;
  currentFileUrl: string;
  onRestore: () => void;
}

export const MaterialVersionsModal = ({
  open,
  onOpenChange,
  materialId,
  materialName,
  materialType,
  currentFileUrl,
  onRestore
}: MaterialVersionsModalProps) => {
  const [versions, setVersions] = useState<MaterialVersion[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<MaterialVersion | null>(null);
  const [restoring, setRestoring] = useState(false);
  const { toast } = useToast();

  const loadVersions = async () => {
    setLoading(true);
    try {
      const { data: versionsData, error } = await supabase
        .from('material_versions')
        .select('*')
        .eq('material_id', materialId)
        .order('version_number', { ascending: false });

      if (error) throw error;

      // Buscar profiles separadamente
      if (versionsData && versionsData.length > 0) {
        const creatorIds = [...new Set(versionsData.map(v => v.created_by))];
        
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', creatorIds);

        if (profilesError) throw profilesError;

        const formattedVersions = versionsData.map(v => ({
          ...v,
          author_name: profilesData?.find(p => p.id === v.created_by)?.full_name || 'Usuário desconhecido'
        }));

        setVersions(formattedVersions);
      } else {
        setVersions([]);
      }
    } catch (error) {
      console.error('Erro ao carregar versões:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar versões do material",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      loadVersions();
    }
  }, [open, materialId]);

  const handleRestore = async (version: MaterialVersion) => {
    setRestoring(true);
    try {
      // Atualizar material com a versão selecionada
      const { error: updateError } = await supabase
        .from('materials')
        .update({
          file_url: version.file_url,
          thumbnail_url: version.thumbnail_url,
          wireframe_data: version.wireframe_data,
          updated_at: new Date().toISOString()
        })
        .eq('id', materialId);

      if (updateError) throw updateError;

      toast({
        title: "Sucesso!",
        description: `Material restaurado para versão ${version.version_number}`
      });

      onOpenChange(false);
      onRestore();
    } catch (error) {
      console.error('Erro ao restaurar versão:', error);
      toast({
        title: "Erro",
        description: "Erro ao restaurar versão",
        variant: "destructive"
      });
    } finally {
      setRestoring(false);
    }
  };

  const renderPreview = (version: MaterialVersion | null, isCurrent = false) => {
    const fileUrl = isCurrent ? currentFileUrl : version?.file_url;
    
    if (!fileUrl) return null;

    if (materialType === 'image') {
      return (
        <img 
          src={fileUrl} 
          alt={`Versão ${version?.version_number || 'atual'}`}
          className="w-full h-auto rounded-lg border"
        />
      );
    }

    if (materialType === 'video') {
      return (
        <video 
          src={fileUrl} 
          controls
          className="w-full rounded-lg border"
        />
      );
    }

    if (materialType === 'pdf') {
      return (
        <div className="flex flex-col items-center gap-4 p-8 border rounded-lg">
          <FileText className="h-16 w-16 text-muted-foreground" />
          <a 
            href={fileUrl} 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            Visualizar PDF
          </a>
        </div>
      );
    }

    return (
      <div className="flex items-center justify-center p-8 border rounded-lg">
        <p className="text-muted-foreground">Pré-visualização não disponível</p>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Histórico de Versões
          </DialogTitle>
          <p className="text-sm text-muted-foreground">{materialName}</p>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-[70vh]">
          {/* Lista de versões */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-medium">Versões anteriores</h3>
              <Badge variant="secondary">{versions.length} {versions.length === 1 ? 'versão' : 'versões'}</Badge>
            </div>

            <ScrollArea className="h-[calc(70vh-4rem)]">
              <div className="space-y-2 pr-4">
                {/* Versão atual */}
                <div
                  className={`p-4 rounded-lg border-2 transition-colors cursor-pointer ${
                    !selectedVersion ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                  }`}
                  onClick={() => setSelectedVersion(null)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="default">Versão Atual</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        Versão em uso no momento
                      </p>
                    </div>
                    <Eye className="h-5 w-5 text-muted-foreground shrink-0" />
                  </div>
                </div>

                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : versions.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <History className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>Nenhuma versão anterior encontrada</p>
                  </div>
                ) : (
                  versions.map((version) => (
                    <div
                      key={version.id}
                      className={`p-4 rounded-lg border-2 transition-colors cursor-pointer ${
                        selectedVersion?.id === version.id 
                          ? 'border-primary bg-primary/5' 
                          : 'border-border hover:border-primary/50'
                      }`}
                      onClick={() => setSelectedVersion(version)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline">Versão {version.version_number}</Badge>
                          </div>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
                            <Clock className="h-3 w-3" />
                            {format(new Date(version.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Por: {version.author_name}
                          </p>
                          {version.notes && (
                            <p className="text-sm mt-2 p-2 bg-muted rounded">
                              {version.notes}
                            </p>
                          )}
                        </div>
                        <Eye className="h-5 w-5 text-muted-foreground shrink-0" />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>

          {/* Pré-visualização */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-medium">
                {selectedVersion 
                  ? `Versão ${selectedVersion.version_number}` 
                  : 'Versão Atual'}
              </h3>
              {selectedVersion && (
                <Button
                  size="sm"
                  onClick={() => handleRestore(selectedVersion)}
                  disabled={restoring}
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Restaurar Versão
                </Button>
              )}
            </div>

            <ScrollArea className="h-[calc(70vh-4rem)]">
              <div className="pr-4">
                {renderPreview(selectedVersion, !selectedVersion)}
              </div>
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
