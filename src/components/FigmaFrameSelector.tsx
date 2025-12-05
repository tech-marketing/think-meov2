import { useEffect, useRef, useState } from "react";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Figma, Link2, Loader2, RefreshCw, Unplug, X } from "lucide-react";

export interface ImportedFrame {
  nodeId: string;
  url: string;
  name: string;
}

interface FigmaFrameSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onFramesImported: (frames: ImportedFrame[]) => void;
}

interface FigmaFrame {
  id: string;
  name: string;
  pageName: string;
  thumbnailUrl?: string | null;
}

interface RecentFile {
  id: string;
  file_key: string;
  file_name: string;
  file_url: string;
  thumbnail_url?: string | null;
  last_used_at: string;
}

interface LoadedFile {
  key: string;
  name: string;
  url: string;
}

export const FigmaFrameSelector = ({ open, onOpenChange, onFramesImported }: FigmaFrameSelectorProps) => {
  const { profile } = useAuth();
  const { toast } = useToast();
  const popupRef = useRef<Window | null>(null);

  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [checkingConnection, setCheckingConnection] = useState(false);
  const [figmaUrl, setFigmaUrl] = useState("");
  const [loadedFile, setLoadedFile] = useState<LoadedFile | null>(null);
  const [frames, setFrames] = useState<FigmaFrame[]>([]);
  const [selectedFrames, setSelectedFrames] = useState<Set<string>>(new Set<string>());
  const [recentFiles, setRecentFiles] = useState<RecentFile[]>([]);
  const [loadingFile, setLoadingFile] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [exporting, setExporting] = useState(false);

  const hasSelection = selectedFrames.size > 0;

  useEffect(() => {
    if (!open) {
      setLoadedFile(null);
      setFrames([]);
      setSelectedFrames(new Set<string>());
      setFigmaUrl("");
      return;
    }

    if (!profile?.id) return;
    checkConnection();
    fetchHistory();
  }, [open, profile?.id]);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event?.data?.type === "FIGMA_AUTH_SUCCESS") {
        popupRef.current?.close();
        popupRef.current = null;
        setIsConnected(true);
        toast({
          title: "Conta conectada",
          description: "Sua conta do Figma foi conectada com sucesso.",
        });
        checkConnection();
        fetchHistory();
      }
    };

    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [profile?.id]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has("figma_connected")) {
      params.delete("figma_connected");
      const next = params.toString();
      window.history.replaceState({}, "", `${window.location.pathname}${next ? `?${next}` : ""}`);
      toast({ title: "Conta conectada", description: "A autenticação com o Figma foi concluída." });
      checkConnection();
      fetchHistory();
    }
    if (params.has("figma_error")) {
      params.delete("figma_error");
      const next = params.toString();
      window.history.replaceState({}, "", `${window.location.pathname}${next ? `?${next}` : ""}`);
      toast({
        title: "Erro no Figma",
        description: "Não foi possível concluir a autenticação com o Figma.",
        variant: "destructive",
      });
    }
  }, []);

  const checkConnection = async () => {
    if (!profile?.id) return;
    try {
      setCheckingConnection(true);
      const { data, error } = await supabase.functions.invoke("figma-api", {
        body: { action: "get-user", userId: profile.id },
      });
      if (error) throw error;
      setIsConnected(Boolean(data?.connected));
    } catch (error) {
      console.error("Erro ao verificar conexão com Figma:", error);
      setIsConnected(false);
    } finally {
      setCheckingConnection(false);
    }
  };

  const fetchHistory = async () => {
    if (!profile?.id) return;
    try {
      setLoadingHistory(true);
      const { data, error } = await supabase.functions.invoke("figma-api", {
        body: { action: "get-file-history", userId: profile.id },
      });
      if (error) throw error;
      setRecentFiles(data?.files ?? []);
    } catch (error) {
      console.error("Erro ao carregar histórico do Figma:", error);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleConnect = async () => {
    if (!profile?.id) {
      toast({ title: "Erro", description: "Usuário não identificado", variant: "destructive" });
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke("figma-oauth-init", {
        body: { userId: profile.id, origin: window.location.origin },
      });
      if (error) throw error;
      if (data?.authUrl) {
        popupRef.current = window.open(data.authUrl, "figmaAuth", "width=520,height=720");
        if (!popupRef.current) {
          throw new Error("Não foi possível abrir a janela de autenticação");
        }
      }
    } catch (error) {
      console.error("Erro ao conectar ao Figma:", error);
      toast({
        title: "Erro",
        description: "Não foi possível iniciar a autenticação com o Figma",
        variant: "destructive",
      });
    }
  };

  const handleDisconnect = async () => {
    if (!profile?.id) return;
    try {
      const { error } = await supabase.functions.invoke("figma-api", {
        body: { action: "disconnect", userId: profile.id },
      });
      if (error) throw error;
      setIsConnected(false);
      setLoadedFile(null);
      setFrames([]);
      setSelectedFrames(new Set<string>());
      toast({ title: "Conta desconectada", description: "Os tokens do Figma foram removidos." });
    } catch (error) {
      console.error("Erro ao desconectar do Figma:", error);
      toast({
        title: "Erro",
        description: "Não foi possível desconectar do Figma",
        variant: "destructive",
      });
    }
  };

  const loadFile = async (targetUrl: string) => {
    if (!profile?.id) return;
    try {
      setLoadingFile(true);
      const { data, error } = await supabase.functions.invoke("figma-api", {
        body: { action: "get-file-from-url", figmaUrl: targetUrl, userId: profile.id },
      });
      if (error) throw error;
      setLoadedFile(data?.file || null);
      setFrames(data?.frames || []);
      setSelectedFrames(new Set<string>());
      setFigmaUrl(data?.file?.url || targetUrl);
      if (!data?.frames?.length) {
        toast({
          title: "Sem frames disponíveis",
          description: "Esse arquivo não possui frames ou não pudemos encontrá-los.",
        });
      }
    } catch (error) {
      console.error("Erro ao carregar arquivo do Figma:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar o arquivo informado.",
        variant: "destructive",
      });
    } finally {
      setLoadingFile(false);
    }
  };

  const handleSelectHistory = (file: RecentFile) => {
    setFigmaUrl(file.file_url);
    loadFile(file.file_url);
  };

  const toggleFrameSelection = (frameId: string) => {
    setSelectedFrames((prev) => {
      const next = new Set(prev);
      if (next.has(frameId)) {
        next.delete(frameId);
      } else {
        next.add(frameId);
      }
      return next;
    });
  };

  const handleImport = async () => {
    if (!profile?.id || !loadedFile) return;
    const framesToExport = frames.filter((frame) => selectedFrames.has(frame.id));
    if (!framesToExport.length) {
      toast({
        title: "Selecione frames",
        description: "Escolha pelo menos um frame para importar.",
        variant: "destructive",
      });
      return;
    }

    try {
      setExporting(true);
      const { data, error } = await supabase.functions.invoke("figma-api", {
        body: {
          action: "export-frames",
          fileKey: loadedFile.key,
          frames: framesToExport.map((frame) => ({
            id: frame.id,
            name: `${frame.pageName} / ${frame.name}`,
          })),
          userId: profile.id,
        },
      });

      if (error) throw error;
      if (!data?.frames?.length) {
        throw new Error("Não foi possível exportar os frames selecionados");
      }

      onFramesImported(data.frames);
      toast({
        title: "Frames importados",
        description: `${data.frames.length} frame(s) prontos para uso.`,
      });
      onOpenChange(false);
    } catch (error) {
      console.error("Erro ao importar frames:", error);
      toast({
        title: "Erro",
        description: "Não foi possível importar os frames selecionados.",
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  };

  const selectedCount = selectedFrames.size;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Selecionar frames do Figma</DialogTitle>
          <DialogDescription>
            Conecte sua conta do Figma, escolha um arquivo e importe frames como imagens prontas para uso nos materiais.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <p className="font-medium flex items-center gap-2">
                <Figma className="h-4 w-4" />
                {checkingConnection ? "Verificando conexão..." : isConnected ? "Conta do Figma conectada" : "Conta desconectada"}
              </p>
              {isConnected ? (
                <p className="text-sm text-muted-foreground">Você pode carregar um arquivo e selecionar os frames desejados.</p>
              ) : (
                <p className="text-sm text-muted-foreground">Conecte sua conta para acessar arquivos e frames do Figma.</p>
              )}
            </div>
            <div className="flex gap-2">
              {isConnected ? (
                <Button variant="outline" onClick={handleDisconnect}>
                  <Unplug className="mr-2 h-4 w-4" />
                  Desconectar
                </Button>
              ) : (
                <Button onClick={handleConnect} disabled={checkingConnection}>
                  <Figma className="mr-2 h-4 w-4" />
                  Conectar ao Figma
                </Button>
              )}
            </div>
          </div>

          {isConnected && (
            <div className="grid gap-4">
              <div className="space-y-3">
                <Label>Histórico recente</Label>
                <ScrollArea className="h-28 rounded-lg border p-4">
                  {loadingHistory ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Carregando histórico...
                    </div>
                  ) : recentFiles.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Ainda não há arquivos utilizados.</p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {recentFiles.map((file) => (
                        <button
                          key={file.id}
                          onClick={() => handleSelectHistory(file)}
                          className="flex items-center gap-3 rounded-md border p-2 text-left hover:border-primary transition"
                        >
                          {file.thumbnail_url ? (
                            <img src={file.thumbnail_url} alt={file.file_name} className="h-12 w-12 rounded object-cover" />
                          ) : (
                            <div className="h-12 w-12 rounded bg-muted flex items-center justify-center text-sm text-muted-foreground">No</div>
                          )}
                          <div className="flex-1">
                            <p className="text-sm font-medium line-clamp-1">{file.file_name}</p>
                            <p className="text-xs text-muted-foreground">Clicque para reabrir</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </div>

              <div className="space-y-2">
                <Label>URL do arquivo</Label>
                <div className="flex gap-3">
                  <Input
                    value={figmaUrl}
                    onChange={(e) => setFigmaUrl(e.target.value)}
                    placeholder="https://www.figma.com/file/..."
                  />
                  <Button type="button" variant="outline" onClick={() => loadFile(figmaUrl)} disabled={!figmaUrl || loadingFile}>
                    {loadingFile ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
                    <span className="ml-2">Carregar</span>
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => loadedFile?.url && loadFile(loadedFile.url)}
                    disabled={!loadedFile || loadingFile}
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {loadedFile && (
                <div className="rounded-lg border p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{loadedFile.name}</p>
                      <p className="text-sm text-muted-foreground">Selecione os frames desejados abaixo</p>
                    </div>
                    <span className="text-sm text-muted-foreground">{frames.length} frame(s)</span>
                  </div>
                  <ScrollArea className="mt-4 h-64">
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 pr-4">
                      {frames.map((frame) => (
                        <label
                          key={frame.id}
                          className="relative rounded-lg border p-3 hover:border-primary transition cursor-pointer"
                        >
                          <div className="flex items-start gap-2">
                            <Checkbox checked={selectedFrames.has(frame.id)} onCheckedChange={() => toggleFrameSelection(frame.id)} />
                            <div>
                              <p className="text-sm font-medium leading-tight">{frame.name}</p>
                              <p className="text-xs text-muted-foreground">Página {frame.pageName}</p>
                            </div>
                          </div>
                          {frame.thumbnailUrl && (
                            <img src={frame.thumbnailUrl} alt={frame.name} className="mt-3 h-24 w-full rounded object-cover" />
                          )}
                        </label>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}

              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                <Button onClick={handleImport} disabled={!loadedFile || !hasSelection || exporting}>
                  {exporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Importar {selectedCount > 0 ? `${selectedCount} frame(s)` : ""}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
