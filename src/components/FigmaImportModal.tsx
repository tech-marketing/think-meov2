import { useEffect, useMemo, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, FileStack, Images, RefreshCw, Figma } from "lucide-react";

interface FigmaFile {
  key: string;
  name: string;
  thumbnail_url?: string | null;
  last_modified?: string;
}

interface FigmaFrame {
  id: string;
  name: string;
  pageName: string;
}

interface FigmaImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: (assets: Array<{ name: string; url: string; type: 'image' | 'video' | 'pdf' }>) => void;
  userId?: string;
}

export const FigmaImportModal = ({
  open,
  onOpenChange,
  onImported,
  userId,
}: FigmaImportModalProps) => {
  const { toast } = useToast();
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [loadingFrames, setLoadingFrames] = useState(false);
  const [importing, setImporting] = useState(false);
  const [authenticating, setAuthenticating] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(true);
  const [files, setFiles] = useState<FigmaFile[]>([]);
  const [frames, setFrames] = useState<FigmaFrame[]>([]);
  const [selectedFile, setSelectedFile] = useState<FigmaFile | null>(null);
  const [selectedFrameIds, setSelectedFrameIds] = useState<string[]>([]);
  const popupRef = useRef<Window | null>(null);

  useEffect(() => {
    if (open) {
      loadFiles();
    } else {
      resetState();
    }
  }, [open]);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.data?.type === 'FIGMA_AUTH_SUCCESS') {
        if (popupRef.current && !popupRef.current.closed) {
          try {
            popupRef.current.close();
          } catch (closeError) {
            console.warn('Não foi possível fechar a janela do Figma:', closeError);
          }
          popupRef.current = null;
        }
        loadFiles();
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [userId]);

  const resetState = () => {
    if (popupRef.current && !popupRef.current.closed) {
      popupRef.current.close();
      popupRef.current = null;
    }
    setLoadingFiles(false);
    setLoadingFrames(false);
    setImporting(false);
    setFiles([]);
    setFrames([]);
    setSelectedFile(null);
    setSelectedFrameIds([]);
  };

  const handleConnectFigma = async () => {
    if (!userId) {
      toast({
        title: "Erro",
        description: "Usuário não identificado",
        variant: "destructive"
      });
      return;
    }

    try {
      setAuthenticating(true);
      const { data, error } = await supabase.functions.invoke('figma-import', {
        body: { action: 'start-auth', userId }
      });

      if (error) throw error;

      if (data?.authUrl) {
        popupRef.current = window.open(data.authUrl, "figmaAuth", "width=480,height=720");
        if (!popupRef.current) {
          throw new Error('Não foi possível abrir a janela de autenticação');
        }
      } else {
        throw new Error('URL de autenticação não encontrada.');
      }
    } catch (error) {
      console.error('Erro ao conectar ao Figma:', error);
      const message = error instanceof Error ? error.message : undefined;
      toast({
        title: "Erro",
        description: message || "Não foi possível iniciar a autenticação com o Figma",
        variant: "destructive"
      });
    } finally {
      setAuthenticating(false);
    }
  };

  const handleDisconnectFigma = async () => {
    if (!userId) {
      return;
    }

    try {
      const { error } = await supabase.functions.invoke('figma-import', {
        body: { action: 'logout', userId }
      });

      if (error) throw error;

      toast({
        title: "Sessão encerrada",
        description: "Sua conta do Figma foi desconectada."
      });

      setIsAuthenticated(false);
      setFiles([]);
    } catch (error) {
      console.error('Erro ao desconectar do Figma:', error);
      toast({
        title: "Erro",
        description: "Não foi possível desconectar do Figma",
        variant: "destructive"
      });
    }
  };

  const loadFiles = async () => {
    try {
      setLoadingFiles(true);
      if (!userId) {
        throw new Error("Usuário não identificado");
      }

      const { data, error } = await supabase.functions.invoke('figma-import', {
        body: { action: 'list-files', userId }
      });

      if (error) throw error;
      if (data?.authenticated === false) {
        setIsAuthenticated(false);
        setFiles([]);
        return;
      }

      setIsAuthenticated(true);
      setFiles(data?.files || []);
    } catch (error) {
      console.error('Erro ao carregar arquivos do Figma:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os arquivos do Figma",
        variant: "destructive"
      });
    } finally {
      setLoadingFiles(false);
    }
  };

  const loadFrames = async (file: FigmaFile) => {
    try {
      setLoadingFrames(true);
      if (!userId) {
        throw new Error("Usuário não identificado");
      }

      const { data, error } = await supabase.functions.invoke('figma-import', {
        body: { action: 'list-frames', fileKey: file.key, userId }
      });

      if (error) throw error;
      if (data?.authenticated === false) {
        setIsAuthenticated(false);
        setFrames([]);
        return;
      }

      const extractedFrames: FigmaFrame[] = [];
      (data?.pages || []).forEach((page: any) => {
        page.frames.forEach((frame: any) => {
          extractedFrames.push({
            id: frame.id,
            name: frame.name,
            pageName: page.name
          });
        });
      });
      setFrames(extractedFrames);
    } catch (error) {
      console.error('Erro ao carregar frames:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os frames do arquivo selecionado",
        variant: "destructive"
      });
    } finally {
      setLoadingFrames(false);
    }
  };

  const handleSelectFile = (file: FigmaFile) => {
    setSelectedFile(file);
    setSelectedFrameIds([]);
    loadFrames(file);
  };

  const toggleFrameSelection = (frameId: string) => {
    setSelectedFrameIds(prev =>
      prev.includes(frameId) ? prev.filter(id => id !== frameId) : [...prev, frameId]
    );
  };

  const handleImportFrames = async () => {
    if (!selectedFile || selectedFrameIds.length === 0) {
      toast({
        title: "Selecione frames",
        description: "Escolha pelo menos um frame para importar",
        variant: "destructive"
      });
      return;
    }

    try {
      setImporting(true);
      const selectedFrames = frames.filter(frame => selectedFrameIds.includes(frame.id));

      if (!userId) {
        throw new Error("Usuário não identificado");
      }

      const { data, error } = await supabase.functions.invoke('figma-import', {
        body: {
          action: 'import-frames',
          fileKey: selectedFile.key,
          frames: selectedFrames,
          userId
        }
      });

      if (error) throw error;

      if (data?.authenticated === false) {
        setIsAuthenticated(false);
        toast({
          title: "Conecte-se ao Figma",
          description: "Sua sessão expirou. Conecte novamente ao Figma para importar frames.",
          variant: "destructive"
        });
        return;
      }

      onImported(data?.assets || []);
      toast({
        title: "Importação concluída",
        description: `${selectedFrames.length} frame(s) importado(s) do Figma.`
      });
      onOpenChange(false);
    } catch (error) {
      console.error('Erro ao importar frames:', error);
      toast({
        title: "Erro",
        description: "Não foi possível importar os frames selecionados",
        variant: "destructive"
      });
    } finally {
      setImporting(false);
    }
  };

  const framesGroupedByPage = useMemo(() => {
    return frames.reduce<Record<string, FigmaFrame[]>>((acc, frame) => {
      if (!acc[frame.pageName]) acc[frame.pageName] = [];
      acc[frame.pageName].push(frame);
      return acc;
    }, {});
  }, [frames]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Selecionar frames do Figma</DialogTitle>
        </DialogHeader>

        <div className="grid gap-6">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label>Arquivos recentes</Label>
                {!isAuthenticated && (
                  <p className="text-xs text-muted-foreground">
                    Conecte-se para ver seus arquivos do Figma.
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                {isAuthenticated && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="gap-2"
                    onClick={handleDisconnectFigma}
                  >
                    Sair
                  </Button>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="gap-2"
                  onClick={loadFiles}
                  disabled={loadingFiles}
                >
                  <RefreshCw className="h-4 w-4" />
                  Atualizar
                </Button>
              </div>
            </div>
            <ScrollArea className="h-40 rounded-md border">
              {loadingFiles ? (
                <div className="flex items-center justify-center py-6 gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Carregando arquivos...
                </div>
              ) : !isAuthenticated ? (
                <div className="py-8 px-4 text-center space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Conecte sua conta do Figma para acessar seus arquivos e frames.
                  </p>
                  <Button
                    type="button"
                    onClick={handleConnectFigma}
                    disabled={authenticating}
                    className="w-full justify-center gap-2"
                  >
                    {authenticating ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Conectando...
                      </>
                    ) : (
                      <>
                        <Figma className="h-4 w-4" />
                        Conectar ao Figma
                      </>
                    )}
                  </Button>
                </div>
              ) : files.length === 0 ? (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  Nenhum arquivo disponível.
                </div>
              ) : (
                <div className="divide-y">
                  {files.map(file => (
                    <button
                      key={file.key}
                      type="button"
                      onClick={() => handleSelectFile(file)}
                      className={`flex w-full items-center justify-between px-4 py-3 text-left transition-colors ${
                        selectedFile?.key === file.key ? 'bg-primary/5 text-primary' : 'hover:bg-muted'
                      }`}
                    >
                      <div>
                        <p className="font-medium">{file.name}</p>
                        {file.last_modified && (
                          <p className="text-xs text-muted-foreground">
                            Atualizado em {new Date(file.last_modified).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                      <FileStack className="h-4 w-4 text-muted-foreground" />
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>

          {selectedFile && (
            <div className="space-y-3">
              <Label>Frames em {selectedFile.name}</Label>
              <ScrollArea className="h-64 rounded-md border p-4">
                {loadingFrames ? (
                  <div className="flex items-center justify-center py-6 gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Carregando frames...
                  </div>
                ) : frames.length === 0 ? (
                  <div className="py-6 text-center text-sm text-muted-foreground">
                    Nenhum frame encontrado neste arquivo.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {Object.entries(framesGroupedByPage).map(([pageName, pageFrames]) => (
                      <div key={pageName} className="space-y-2">
                        <p className="text-xs font-semibold text-muted-foreground uppercase">{pageName}</p>
                        <div className="space-y-2">
                          {pageFrames.map(frame => (
                            <label
                              key={frame.id}
                              className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted cursor-pointer"
                            >
                              <div className="flex items-center space-x-3">
                                <Checkbox
                                  checked={selectedFrameIds.includes(frame.id)}
                                  onCheckedChange={() => toggleFrameSelection(frame.id)}
                                />
                                <div>
                                  <p className="font-medium">{frame.name}</p>
                                  <p className="text-xs text-muted-foreground">{frame.id}</p>
                                </div>
                              </div>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>
          )}

          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground flex items-center gap-2">
              <Images className="h-4 w-4" />
              {selectedFrameIds.length === 0
                ? "Selecione os frames desejados"
                : `${selectedFrameIds.length} frame(s) selecionado(s)`}
            </div>
            <Button
              type="button"
              onClick={handleImportFrames}
              disabled={selectedFrameIds.length === 0 || importing || !selectedFile}
            >
              {importing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Importando...
                </>
              ) : (
                "Importar Frames"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
