import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { DeleteBriefingModal } from "@/components/DeleteBriefingModal";
import { BriefingEditorLayout } from "@/components/briefing-editor/BriefingEditorLayout";
import { useAuth } from "@/hooks/useAuth";
import { ArrowLeft, Save, Copy } from "lucide-react";
import { LoadingBriefing } from "@/components/LoadingBriefing";

interface WireframeData {
  legenda_section?: {
    legenda_principal: string;
    hashtags_sugeridas: string[];
    mentions_relevantes: string[];
    estrategia_legenda: string;
  };
  metadata?: {
    source_ad: string;
    webhook_payload?: any;
    target_format?: string;
  };
  objective?: string;
  wireframe?: any;
  name?: string;
  caption?: string;
  reference?: string;
  status?: string;
}

const BriefingEditor = () => {
  const { briefingId } = useParams<{ briefingId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { profile } = useAuth();

  const [briefing, setBriefing] = useState<WireframeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [visualizationContent, setVisualizationContent] = useState<string>('');
  const [projectIdForComments, setProjectIdForComments] = useState<string>('');
  const [materialType, setMaterialType] = useState<string>('');

  useEffect(() => {
    if (briefingId) {
      loadBriefing();
    }
  }, [briefingId]);

  useEffect(() => {
    if (briefing?.status === 'processing' && briefing.metadata?.webhook_payload) {
      processGeneration(briefing.metadata.webhook_payload);
    }
  }, [briefing?.status]);

  const processGeneration = async (payload: any) => {
    try {
      const response = await fetch('https://n8n-production-4de3.up.railway.app/webhook/019ef1f6-f44c-47f6-9ab4-49465de13d55', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const responseText = await response.text();
      console.log('Webhook Response:', responseText);

      if (!response.ok) {
        throw new Error(`Erro no webhook: ${response.status} ${response.statusText} - ${responseText}`);
      }

      let data;
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        throw new Error(`A resposta do Webhook não é um JSON válido: "${responseText}". Verifique se o cenário no Make.com possui um módulo "Webhook Response".`);
      }

      // Função para limpar URLs do Google Storage
      const cleanGoogleStorageUrl = (url: string) => {
        if (!url) return url;

        try {
          // Se for uma URL da API do Google Storage, converter para URL pública
          // Ex: https://www.googleapis.com/storage/v1/b/bucket/o/path%2Fto%2Ffile
          if (url.includes('googleapis.com/storage/v1/b/')) {
            const match = url.match(/b\/([^/]+)\/o\/([^?]+)/);
            if (match) {
              const bucket = match[1];
              // Decodificar duas vezes para garantir (algumas URLs vêm duplamente encodadas)
              let path = decodeURIComponent(match[2]);
              try {
                path = decodeURIComponent(path);
              } catch (e) {
                // Ignorar erro se não der para decodificar de novo
              }
              return `https://storage.googleapis.com/${bucket}/${path}`;
            }
          }

          // Se for uma URL autenticada do storage (com query params de assinatura), tentar limpar
          if (url.includes('storage.googleapis.com') && url.includes('X-Goog-Algorithm')) {
            // Manter a URL assinada pois ela é necessária para acesso privado, 
            // ou se for pública, remover os params.
            // Por segurança, vamos tentar usar a URL limpa se for pública
            const cleanUrl = url.split('?')[0];
            return cleanUrl;
          }
        } catch (e) {
          console.error('Erro ao limpar URL:', e);
        }

        return url;
      };

      // Atualizar o material com os dados retornados
      let finalFileUrl = null;
      let slides = [];

      // Processar media_urls para carrossel
      if (data.media_urls) {
        let mediaUrls = [];
        if (Array.isArray(data.media_urls)) {
          mediaUrls = data.media_urls;
        } else if (typeof data.media_urls === 'string') {
          // Tentar fazer parse se for string JSON ou separar por vírgula
          try {
            const parsed = JSON.parse(data.media_urls);
            if (Array.isArray(parsed)) mediaUrls = parsed;
          } catch (e) {
            mediaUrls = data.media_urls.split(',').map((url: string) => url.trim());
          }
        }

        // Limpar URLs e filtrar vazias
        mediaUrls = mediaUrls
          .map(cleanGoogleStorageUrl)
          .filter(url => url && url.length > 0);

        if (mediaUrls.length > 0) {
          // Se for carrossel, salvar array de URLs como JSON string no file_url
          if (data.type === 'carousel' || mediaUrls.length > 1) {
            finalFileUrl = JSON.stringify(mediaUrls);
            slides = mediaUrls.map((url: string, index: number) => ({
              imageUrl: url,
              index: index
            }));
          } else {
            finalFileUrl = mediaUrls[0];
          }
        }
      }

      // Fallback para outros campos se não achou em media_urls
      if (!finalFileUrl) {
        finalFileUrl = data.file_url || data.url || data.criativo_url;
        if (finalFileUrl) {
          finalFileUrl = cleanGoogleStorageUrl(finalFileUrl);
        }
      }

      // Se não encontrou URL direta, tentar construir a partir do creative_id (caminho do GCS)
      if (!finalFileUrl && data.creative_id) {
        const creativeId = Array.isArray(data.creative_id) ? data.creative_id[0] : data.creative_id;
        if (creativeId && typeof creativeId === 'string') {
          // Remover aspas extras se houver
          const cleanPath = creativeId.replace(/['"]/g, '');
          // Se já for uma URL completa, usar ela
          if (cleanPath.startsWith('http')) {
            finalFileUrl = cleanPath;
          } else {
            // Assumir que é um caminho do GCS
            finalFileUrl = `https://storage.googleapis.com/${cleanPath}`;
          }
          console.log('🔗 URL construída a partir do creative_id:', finalFileUrl);
        }
      }

      // Normalizar o tipo de material para satisfazer a constraint do banco
      // Allowed types: 'wireframe', 'video', 'image', 'carousel'
      let normalizedType = data.type?.toLowerCase();

      if (normalizedType === 'static_image' || normalizedType === 'static' || normalizedType === 'image' || normalizedType === 'estatic') {
        normalizedType = 'wireframe';
      } else if (normalizedType === 'reels' || normalizedType === 'reel') {
        normalizedType = 'video';
      }

      // Validar se o tipo está na lista de permitidos
      const allowedTypes = ['wireframe', 'video', 'image', 'carousel'];
      if (!allowedTypes.includes(normalizedType)) {
        // Tentar inferir pelo arquivo ou conteúdo
        if (slides.length > 0) {
          normalizedType = 'carousel';
        } else if (finalFileUrl && typeof finalFileUrl === 'string') {
          if (finalFileUrl.match(/\.mp4$/i)) {
            normalizedType = 'video';
          } else if (finalFileUrl.match(/\.(jpeg|jpg|gif|png)$/i)) {
            normalizedType = 'image';
          } else {
            // Default seguro se não conseguir inferir
            normalizedType = 'image';
          }
        } else {
          normalizedType = 'image';
        }
      }

      // Preparar dados de atualização
      const updateData: any = {
        status: 'pending',
        file_url: finalFileUrl,
        thumbnail_url: data.thumbnail_url || data.thumbnail,
        caption: data.caption || data.legenda || data.legenda_criativo,
        copy: data.ad_copy || data.copy || data.text || data.legenda_criativo,
        name: data.name || briefing?.name || 'Novo Criativo',
        // Garantir que apareça na seção de Briefings
        is_briefing: true,
        briefing_approved_by_client: false,
        // Atualizar o tipo se vier no payload (usando o tipo normalizado)
        ...(normalizedType && { type: normalizedType }),
        // Limpar o payload para não reprocessar
        metadata: {
          ...briefing?.metadata,
          webhook_payload: null
        }
      };

      // Se tiver slides (inclusive 1), atualizar wireframe_data para usar galeria
      if (slides.length > 0) {
        const currentWireframe = briefing?.wireframe || {};
        updateData.wireframe_data = {
          ...currentWireframe,
          slides: slides,
          isCarousel: slides.length > 1,
          slideCount: slides.length
        };
      }

      const { error } = await supabase
        .from('materials')
        .update(updateData)
        .eq('id', briefingId);

      if (error) throw error;

      toast({
        title: "Geração concluída!",
        description: "Seu criativo foi gerado com sucesso."
      });

      // Recarregar o briefing para mostrar o editor
      loadBriefing();

    } catch (error: any) {
      console.error('Erro na geração:', error);
      toast({
        title: "Erro na geração",
        description: error.message || error.details || (typeof error === 'object' ? JSON.stringify(error) : "Erro desconhecido"),
        variant: "destructive"
      });
      // Opcional: Mudar status para 'error' ou permitir tentar novamente
    }
  };

  const loadBriefing = async () => {
    try {
      setLoading(true);

      // Buscar em materials (agora generate-briefing salva tudo em materials)
      const { data, error } = await supabase
        .from('materials')
        .select('*')
        .eq('id', briefingId)
        .single();

      if (error) throw error;

      // Set material type
      setMaterialType(data.type || '');

      setBriefing(data as unknown as WireframeData);

      // Adicionar wireframe_data ao state
      if (data.wireframe_data) {
        setBriefing(prev => ({
          ...prev,
          wireframe: data.wireframe_data
        } as WireframeData));
      }

      if (data.project_id) {
        setProjectIdForComments(data.project_id);
      }

      // Carregar canvas_data se existir, senão usar conteúdo padrão
      if (data.canvas_data) {
        setVisualizationContent(data.canvas_data);
      } else {
        setVisualizationContent('<p>Digite o conteúdo da visualização aqui...</p>');
      }
    } catch (error) {
      console.error('Error loading briefing:', error);
      toast({
        title: "Erro",
        description: "Falha ao carregar briefing",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const saveBriefing = async () => {
    if (!briefing) return;

    try {
      setSaving(true);

      // Gerar thumbnail do Canvas (apenas se não for mídia gerada por IA)
      let thumbnailDataUrl = null;
      const isGeneratedMedia = ['carousel', 'video', 'image'].includes(materialType);

      if (visualizationContent && !isGeneratedMedia) {
        try {
          // Criar canvas temporário off-screen para renderizar a thumbnail
          const tempCanvas = document.createElement('canvas');
          tempCanvas.width = 700;
          tempCanvas.height = 550;
          const ctx = tempCanvas.getContext('2d');

          if (ctx) {
            // Carregar o JSON do Canvas e renderizar como imagem
            const { Canvas: FabricCanvas } = await import('fabric');
            const fabricCanvas = new FabricCanvas(tempCanvas);
            await fabricCanvas.loadFromJSON(JSON.parse(visualizationContent));
            fabricCanvas.renderAll();

            // Gerar thumbnail reduzida
            thumbnailDataUrl = fabricCanvas.toDataURL({
              format: 'png',
              quality: 0.8,
              multiplier: 0.5,
            });

            fabricCanvas.dispose();
          }
        } catch (error) {
          console.error('Erro ao gerar thumbnail:', error);
        }
      }

      const updateData: any = {
        canvas_data: visualizationContent,
        updated_at: new Date().toISOString()
      };

      // Só atualizar thumbnail se foi gerada uma nova (para canvas)
      if (thumbnailDataUrl) {
        updateData.thumbnail_url = thumbnailDataUrl;
      }

      const { error } = await supabase
        .from('materials')
        .update(updateData)
        .eq('id', briefingId);

      if (error) throw error;
      toast({ title: "Salvo com sucesso" });
    } catch (error) {
      toast({ title: "Erro ao salvar", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const formatLegend = (data: WireframeData) => {
    if (data.legenda_section?.legenda_principal) {
      return data.legenda_section.legenda_principal;
    }
    if (data.caption) {
      return data.caption;
    }
    return '';
  };

  if (loading) {
    return <div className="flex items-center justify-center h-screen">Carregando...</div>;
  }

  if (briefing?.status === 'processing') {
    return <LoadingBriefing />;
  }

  if (!briefing) {
    return <div className="flex items-center justify-center h-screen">Briefing não encontrado</div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border bg-card sticky top-0 z-10">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button onClick={() => navigate('/admin')} variant="outline" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Voltar
              </Button>
              <div>
                <h1 className="text-xl font-bold text-foreground">Editor de Briefing</h1>
                <p className="text-sm text-muted-foreground">
                  {briefing.name || briefing.metadata?.source_ad || 'Sem título'}
                  {briefing.objective && ` | ${briefing.objective}`}
                  {briefing.reference && ` | Ref: ${briefing.reference}`}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              {profile && (profile.role === 'admin' || profile.role === 'collaborator') && (
                <DeleteBriefingModal
                  briefingId={briefingId || ''}
                  briefingName={briefing.wireframe?.title?.text || "Briefing"}
                  redirectAfterDelete={true}
                />
              )}
              {materialType !== 'carousel' && (
                <Button onClick={saveBriefing} disabled={saving} size="sm">
                  <Save className="w-4 h-4 mr-2" />
                  {saving ? 'Salvando...' : 'Salvar'}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      <BriefingEditorLayout
        briefingId={briefingId || ''}
        projectId={projectIdForComments}
        visualizationContent={visualizationContent}
        onVisualizationChange={setVisualizationContent}
        materialType={materialType}
        wireframeData={briefing?.wireframe}
        fileUrl={(briefing as any)?.file_url}
        thumbnailUrl={(briefing as any)?.thumbnail_url || (briefing as any)?.thumbnail}
        caption={(briefing as any)?.copy || (briefing as any)?.caption}
      />
    </div>
  );
};

export default BriefingEditor;
