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
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, ArrowLeft, Figma, Link2, ImageIcon, Clock, Trash2, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface FigmaFile {
  key: string;
  name: string;
  thumbnailUrl?: string;
}

interface FigmaFrame {
  id: string;
  name: string;
  type: string;
  pageName: string;
  width?: number;
  height?: number;
  thumbnailUrl?: string;
}

interface RecentFile {
  id: string;
  file_key: string;
  file_name: string;
  file_url: string;
  thumbnail_url: string | null;
  last_used_at: string;
}

interface ImportedFrame {
  nodeId: string;
  url: string;
  name: string;
}

interface FigmaFrameSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onFramesImported: (frames: ImportedFrame[]) => void;
}

export const FigmaFrameSelector = ({ open, onOpenChange, onFramesImported }: FigmaFrameSelectorProps) => {
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [figmaUrl, setFigmaUrl] = useState("");
  const [loadedFile, setLoadedFile] = useState<FigmaFile | null>(null);
  const [frames, setFrames] = useState<FigmaFrame[]>([]);
  const [selectedFrames, setSelectedFrames] = useState<Set<string>>(new Set());
  const [exporting, setExporting] = useState(false);
  const [recentFiles, setRecentFiles] = useState<RecentFile[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const { toast } = useToast();

  // Check if user is connected to Figma
  useEffect(() => {
    if (open) {
      checkConnection();
    }
  }, [open]);

  // Load file history when connected
  useEffect(() => {
    if (open && isConnected) {
      loadFileHistory();
    }
  }, [open, isConnected]);

  // Check URL params for OAuth callback
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('figma_connected') === 'true') {
      toast({
        title: "Figma conectado!",
        description: "Sua conta do Figma foi conectada com sucesso.",
      });
      window.history.replaceState({}, '', window.location.pathname);
      checkConnection();
    } else if (params.get('figma_error')) {
      toast({
        title: "Erro ao conectar Figma",
        description: params.get('figma_error'),
        variant: "destructive",
      });
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const checkConnection = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('figma-api', {
        body: { action: 'get-user' }
      });

      if (error || data?.requiresAuth) {
        setIsConnected(false);
      } else {
        setIsConnected(true);
      }
    } catch (err) {
      console.error('Error checking Figma connection:', err);
      setIsConnected(false);
    } finally {
      setLoading(false);
    }
  };

  const loadFileHistory = async () => {
    setLoadingHistory(true);
    try {
      const { data, error } = await supabase.functions.invoke('figma-api', {
        body: { action: 'get-file-history' }
      });

      if (!error && data?.history) {
        setRecentFiles(data.history);
      }
    } catch (err) {
      console.error('Error loading file history:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const connectFigma = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('figma-oauth-init');

      if (error) throw error;

      if (data?.oauth_url) {
        window.location.href = data.oauth_url;
      } else {
        throw new Error('Failed to get OAuth URL');
      }
    } catch (err) {
      console.error('Error initiating Figma OAuth:', err);
      toast({
        title: "Erro",
        description: "Não foi possível iniciar a conexão com o Figma",
        variant: "destructive",
      });
      setLoading(false);
    }
  };

  const disconnectFigma = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.functions.invoke('figma-api', {
        body: { action: 'disconnect' }
      });

      if (error) throw error;

      toast({
        title: "Figma desconectado",
        description: "Sua conta do Figma foi desconectada com sucesso.",
      });
      
      setIsConnected(false);
      setRecentFiles([]);
      resetState();
    } catch (err) {
      console.error('Error disconnecting Figma:', err);
      toast({
        title: "Erro",
        description: "Não foi possível desconectar sua conta do Figma",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadFileFromUrl = async (url?: string) => {
    const urlToLoad = url || figmaUrl;
    if (!urlToLoad.trim()) {
      toast({
        title: "URL vazia",
        description: "Cole uma URL do Figma para carregar o arquivo",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    setLoadedFile(null);
    setFrames([]);
    setSelectedFrames(new Set());

    try {
      const { data, error } = await supabase.functions.invoke('figma-api', {
        body: { action: 'get-file-from-url', figmaUrl: urlToLoad.trim() }
      });

      if (error) throw error;

      if (data?.requiresAuth) {
        setIsConnected(false);
        toast({
          title: "Reconecte sua conta",
          description: "Sua sessão do Figma expirou. Por favor, reconecte.",
          variant: "destructive",
        });
        return;
      }

      if (data?.file) {
        setLoadedFile(data.file);
        setFrames(data.frames || []);
        
        // Refresh history after loading a file
        loadFileHistory();
        
        if (!data.frames || data.frames.length === 0) {
          toast({
            title: "Nenhum frame encontrado",
            description: "Este arquivo não possui frames no primeiro nível das páginas",
          });
        }
      }
    } catch (err: any) {
      console.error('Error loading Figma file:', err);
      toast({
        title: "Erro ao carregar arquivo",
        description: err.message || "Verifique se a URL está correta e se você tem acesso ao arquivo",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadFromRecentFile = (recentFile: RecentFile) => {
    setFigmaUrl(recentFile.file_url);
    loadFileFromUrl(recentFile.file_url);
  };

  const deleteRecentFile = async (e: React.MouseEvent, fileId: string) => {
    e.stopPropagation();
    // Optimistically remove from UI
    setRecentFiles(prev => prev.filter(f => f.id !== fileId));
    toast({
      title: "Arquivo removido",
      description: "O arquivo foi removido do histórico",
    });
  };

  const toggleFrame = (frameId: string) => {
    setSelectedFrames(prev => {
      const newSet = new Set(prev);
      if (newSet.has(frameId)) {
        newSet.delete(frameId);
      } else {
        newSet.add(frameId);
      }
      return newSet;
    });
  };

  const selectAllFrames = () => {
    if (selectedFrames.size === frames.length) {
      setSelectedFrames(new Set());
    } else {
      setSelectedFrames(new Set(frames.map(f => f.id)));
    }
  };

  const exportFrames = async () => {
    if (!loadedFile || selectedFrames.size === 0) return;

    setExporting(true);
    try {
      const { data, error } = await supabase.functions.invoke('figma-api', {
        body: { 
          action: 'export-frames', 
          fileKey: loadedFile.key,
          nodeIds: Array.from(selectedFrames)
        }
      });

      if (error) throw error;

      if (data?.frames && data.frames.length > 0) {
        toast({
          title: "Frames importados!",
          description: `${data.frames.length} frame(s) importado(s) com sucesso`,
        });
        
        onFramesImported(data.frames);
        onOpenChange(false);
        
        // Reset state
        resetState();
      } else {
        throw new Error('Nenhum frame foi exportado');
      }
    } catch (err) {
      console.error('Error exporting frames:', err);
      toast({
        title: "Erro",
        description: "Não foi possível exportar os frames selecionados",
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  };

  const resetState = () => {
    setFigmaUrl("");
    setLoadedFile(null);
    setFrames([]);
    setSelectedFrames(new Set());
  };

  const goBack = () => {
    setLoadedFile(null);
    setFrames([]);
    setSelectedFrames(new Set());
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && figmaUrl.trim()) {
      loadFileFromUrl();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(open) => { if (!open) resetState(); onOpenChange(open); }}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Figma className="h-5 w-5" />
            {loadedFile ? loadedFile.name : 'Importar do Figma'}
          </DialogTitle>
          <DialogDescription>
            {isConnected 
              ? loadedFile 
                ? 'Selecione os frames que deseja importar'
                : 'Selecione um arquivo recente ou cole uma nova URL'
              : 'Conecte sua conta do Figma para importar frames'
            }
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          {/* Loading state */}
          {loading && !exporting && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          )}

          {/* Not connected state */}
          {!loading && isConnected === false && (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <div className="p-4 rounded-full bg-muted">
                <Figma className="h-12 w-12 text-muted-foreground" />
              </div>
              <div className="text-center space-y-2">
                <h3 className="font-semibold">Conecte sua conta do Figma</h3>
                <p className="text-sm text-muted-foreground max-w-sm">
                  Para importar frames, você precisa conectar sua conta do Figma
                </p>
              </div>
              <Button onClick={connectFigma} className="gap-2">
                <Figma className="h-4 w-4" />
                Conectar ao Figma
              </Button>
            </div>
          )}

          {/* URL input state - no file loaded yet */}
          {!loading && isConnected && !loadedFile && (
            <div className="space-y-6 py-4">
              {/* Recent files section */}
              {recentFiles.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span>Arquivos acessados recentemente</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {recentFiles.map((file) => (
                      <div
                        key={file.id}
                        onClick={() => loadFromRecentFile(file)}
                        className="group relative flex flex-col rounded-lg border border-border bg-card hover:bg-accent/50 cursor-pointer transition-colors overflow-hidden"
                      >
                        {file.thumbnail_url ? (
                          <div className="aspect-video w-full bg-muted">
                            <img
                              src={file.thumbnail_url}
                              alt={file.file_name}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        ) : (
                          <div className="aspect-video w-full bg-muted flex items-center justify-center">
                            <Figma className="h-6 w-6 text-muted-foreground/30" />
                          </div>
                        )}
                        <div className="p-2">
                          <p className="text-sm font-medium truncate">{file.file_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(file.last_used_at), { addSuffix: true, locale: ptBR })}
                          </p>
                        </div>
                        <button
                          onClick={(e) => deleteRecentFile(e, file.id)}
                          className="absolute top-2 right-2 p-1.5 rounded-md bg-background/80 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive hover:text-destructive-foreground"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {loadingHistory && (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              )}

              {/* Divider */}
              {recentFiles.length > 0 && (
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-border" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">ou</span>
                  </div>
                </div>
              )}

              {/* URL input */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Link2 className="h-4 w-4" />
                  <span>Adicionar URL</span>
                </div>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      placeholder="https://www.figma.com/design/..."
                      value={figmaUrl}
                      onChange={(e) => setFigmaUrl(e.target.value)}
                      onKeyDown={handleKeyDown}
                    />
                  </div>
                  <Button 
                    onClick={() => loadFileFromUrl()} 
                    disabled={!figmaUrl.trim()}
                  >
                    Carregar
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Abra o arquivo no Figma e copie a URL da barra de endereços
                </p>
              </div>

              {/* Disconnect button */}
              <div className="pt-4 border-t border-border">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={disconnectFigma}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Desconectar conta do Figma
                </Button>
              </div>
            </div>
          )}

          {/* Frames list - file loaded */}
          {!loading && isConnected && loadedFile && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Button variant="ghost" size="sm" onClick={goBack} className="gap-1">
                  <ArrowLeft className="h-4 w-4" />
                  Outro arquivo
                </Button>
                {frames.length > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                      {selectedFrames.size} de {frames.length} selecionado(s)
                    </span>
                    <Button variant="outline" size="sm" onClick={selectAllFrames}>
                      {selectedFrames.size === frames.length ? 'Desmarcar todos' : 'Selecionar todos'}
                    </Button>
                  </div>
                )}
              </div>

              <ScrollArea className="h-[400px]">
                <div className="grid grid-cols-3 gap-3 pr-4">
                  {frames.length === 0 ? (
                    <div className="col-span-3 text-center py-8 text-muted-foreground">
                      <p>Nenhum frame encontrado</p>
                      <p className="text-sm">Este arquivo não possui frames no primeiro nível das páginas</p>
                    </div>
                  ) : (
                    frames.map((frame) => (
                      <button
                        key={frame.id}
                        onClick={() => toggleFrame(frame.id)}
                        className={cn(
                          "flex flex-col p-2 rounded-lg border text-left transition-colors",
                          selectedFrames.has(frame.id)
                            ? "border-primary bg-primary/5"
                            : "bg-card hover:bg-accent"
                        )}
                      >
                        {/* Thumbnail */}
                        <div className="relative w-full aspect-square mb-2 bg-muted rounded overflow-hidden">
                          {frame.thumbnailUrl ? (
                            <img 
                              src={frame.thumbnailUrl} 
                              alt={frame.name}
                              className="w-full h-full object-contain"
                              loading="lazy"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                              <ImageIcon className="h-8 w-8" />
                            </div>
                          )}
                          <Checkbox 
                            checked={selectedFrames.has(frame.id)}
                            className="absolute top-2 right-2 bg-background/80"
                          />
                        </div>
                        
                        {/* Info */}
                        <p className="font-medium truncate text-xs">{frame.name}</p>
                        <p className="text-[10px] text-muted-foreground truncate">
                          {frame.pageName}
                        </p>
                        {frame.width && frame.height && (
                          <p className="text-[10px] text-muted-foreground">
                            {Math.round(frame.width)} × {Math.round(frame.height)}
                          </p>
                        )}
                      </button>
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>
          )}
        </div>

        {/* Actions */}
        {isConnected && loadedFile && frames.length > 0 && (
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={exportFrames}
              disabled={selectedFrames.size === 0 || exporting}
              className="gap-2"
            >
              {exporting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Exportando...
                </>
              ) : (
                <>
                  Importar {selectedFrames.size} frame(s)
                </>
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
