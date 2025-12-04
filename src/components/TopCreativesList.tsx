import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { MetaAdsGrid } from './MetaAdsGrid';
import { TrendingUp, TrendingDown, Sparkles, Loader2, AlertTriangle, Target } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { AnalysisDisplay } from "@/components/AnalysisDisplay";
import { ProgressLoader, LoadingPhase } from '@/components/ProgressLoader';
import { useMetaAdsDirect } from "@/contexts/MetaAdsDirectContext";

import { 
  OBJECTIVE_CONFIGS, 
  METRIC_LABELS, 
  compareAds, 
  filterByMinimumSample,
  meetsMinimumSample 
} from "@/utils/rankingRules";

// Mensagens dinâmicas para fase de análise IA
const AI_ANALYSIS_MESSAGES = [
  {
    message: 'Analisando com IA',
    description: 'Identificando padrões visuais nos criativos...',
    progress: 60
  },
  {
    message: 'Analisando com IA',
    description: 'Avaliando elementos de copy e mensagem...',
    progress: 62
  },
  {
    message: 'Analisando com IA',
    description: 'Processando paletas de cores predominantes...',
    progress: 64
  },
  {
    message: 'Analisando com IA',
    description: 'Identificando CTAs e elementos de conversão...',
    progress: 66
  },
  {
    message: 'Analisando com IA',
    description: 'Correlacionando performance com elementos visuais...',
    progress: 68
  },
  {
    message: 'Analisando com IA',
    description: 'Detectando tendências de design e composição...',
    progress: 70
  },
  {
    message: 'Analisando com IA',
    description: 'Analisando hierarquia visual e pontos focais...',
    progress: 72
  },
  {
    message: 'Analisando com IA',
    description: 'Avaliando consistência de marca e identidade...',
    progress: 74
  },
  {
    message: 'Analisando com IA',
    description: 'Gerando insights sobre otimizações possíveis...',
    progress: 76
  },
  {
    message: 'Analisando com IA',
    description: 'Compilando recomendações estratégicas...',
    progress: 78
  },
];

interface MetaAd {
  id: string;
  ad_id: string;
  ad_name: string;
  status: string;
  taxonomy_status: string;
  local_material_id: string | null;
  campaign_id: string;
  campaign_name?: string;
  creative_id?: string;
  image_url?: string;
  video_url?: string;
  metrics?: {
    impressions: number;
    clicks: number;
    ctr: number;
    cpc: number;
    spend: number;
    conversions: number;
    conversion_rate: number;
    roas: number;
  };
}

interface TopCreativesListProps {
  ads: MetaAd[];
  primaryMetric: string;
  secondaryMetric: string;
  onMetricChange: (primary: string, secondary: string) => void;
  onViewDetails?: (ad: MetaAd) => void;
}

export const TopCreativesList: React.FC<TopCreativesListProps> = ({
  ads,
  primaryMetric,
  secondaryMetric,
  onMetricChange,
  onViewDetails
}) => {
  const { competitorKeyword } = useMetaAdsDirect();
  const [topAnalysis, setTopAnalysis] = useState<string | null>(null);
  const [worstAnalysis, setWorstAnalysis] = useState<string | null>(null);
  const [isGeneratingTop, setIsGeneratingTop] = useState(false);
  const [isGeneratingWorst, setIsGeneratingWorst] = useState(false);
  const [selectedObjective, setSelectedObjective] = useState<string>('sales');
  const [creativesCount, setCreativesCount] = useState<number>(6);
  const [includeSmallSamples, setIncludeSmallSamples] = useState<boolean>(true);
  const [analysisLoadingStatus, setAnalysisLoadingStatus] = useState<LoadingPhase>({
    phase: 'idle',
    message: '',
    description: '',
    progress: 0
  });
  // Aplicar filtros de amostra mínima e ordenação inteligente
  const processedAds = useMemo(() => {
    const { validAds, smallSampleAds } = filterByMinimumSample(ads, selectedObjective, includeSmallSamples);
    
    return validAds.map(ad => ({
      ...ad,
      hasSmallSample: !meetsMinimumSample(ad, selectedObjective)
    }));
  }, [ads, selectedObjective, includeSmallSamples]);

  const getTopPerformers = (count: number = 6) => {
    return [...processedAds]
      .sort((a, b) => compareAds(a, b, primaryMetric, secondaryMetric))
      .slice(0, count);
  };

  const getWorstPerformers = (count: number = 6) => {
    return [...processedAds]
      .sort((a, b) => compareAds(b, a, primaryMetric, secondaryMetric)) // Inverter ordem
      .slice(0, count);
  };

  const topPerformers = getTopPerformers(creativesCount);
  const worstPerformers = getWorstPerformers(creativesCount);

  const generateAnalysis = async (type: 'top' | 'worst') => {
    const targetAds = type === 'top' ? topPerformers : worstPerformers;
    
    if (targetAds.length === 0) {
      toast({
        title: "Nenhum anúncio para analisar",
        description: "Não há anúncios suficientes nesta categoria para gerar uma análise.",
        variant: "destructive",
      });
      return;
    }

    const setLoading = type === 'top' ? setIsGeneratingTop : setIsGeneratingWorst;
    const setAnalysis = type === 'top' ? setTopAnalysis : setWorstAnalysis;
    
    // Declarar fora do try para acessar no finally
    let messageInterval: NodeJS.Timeout | null = null;
    
    // Helper para garantir tempo mínimo de exibição de cada fase
    const ensureMinimumDelay = async <T,>(promise: Promise<T>, minimumMs: number): Promise<T> => {
      const startTime = Date.now();
      const result = await promise;
      const elapsed = Date.now() - startTime;
      
      // Se executou mais rápido que o mínimo, esperar o restante
      if (elapsed < minimumMs) {
        await new Promise(resolve => setTimeout(resolve, minimumMs - elapsed));
      }
      
      return result;
    };
    
    try {
      setLoading(true);
      
      // FASE 1: Resolução de Imagens (0-30%)
      setAnalysisLoadingStatus({
        phase: 'resolving-images',
        message: 'Resolvendo imagens dos criativos',
        description: 'Buscando URLs de imagens e materiais vinculados...',
        progress: 10
      });

      // 📌 Priorizar mídias que ESTÃO no anúncio. Se a API não retornar image_url
      // mas houver material local vinculado (local_material_id), usamos esse arquivo
      // como a imagem do anúncio. Nada de busca por nome aqui.

      // Helper para normalizar URLs de storage
      const makeAbsoluteUrl = (url?: string | null) => {
        if (!url) return null;
        if (/^https?:|^data:|^blob:/i.test(url)) return url;
        if (url.startsWith('/storage/') || url.startsWith('storage/')) {
          const supabaseUrl = 'https://oprscgxsfldzydbrbioz.supabase.co';
          const cleanPath = url.startsWith('/') ? url : `/${url}`;
          return `${supabaseUrl}${cleanPath}`;
        }
        return url;
      };

      // Helper para extrair a PRIMEIRA URL válida (quando file_url é JSON com múltiplos arquivos)
      const parseUrl = (val?: string | null): string | null => {
        if (!val) return null;
        try {
          const parsed = JSON.parse(val);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const item = parsed[0];
            if (typeof item === 'string') return item;
            if (item && typeof item === 'object' && 'url' in item) return (item as any).url as string;
          }
          if (parsed && typeof parsed === 'object' && 'url' in parsed) return (parsed as any).url as string;
        } catch {}
        return val;
      };

      // Fallback pelo NOME do anúncio (mesma lógica da pré-visualização/CreativeDisplay)
      const findMaterialByName = async (adName: string): Promise<{ thumb?: string | null; file?: string | null } | null> => {
        try {
          const normalized = adName.toLowerCase().trim();
          const clean = normalized
            .replace(/\s*—\s*cópia.*$/i, '')
            .replace(/\s*-\s*copy.*$/i, '')
            .replace(/[|—-]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();

          // 1) tenta pelo nome “limpo”
          let { data: mats } = await supabase
            .from('materials')
            .select('id, thumbnail_url, file_url')
            .ilike('name', `%${clean}%`)
            .limit(1);

          // 2) se nada, tenta pelo nome original
          if (!mats || mats.length === 0) {
            const { data } = await supabase
              .from('materials')
              .select('id, thumbnail_url, file_url')
              .ilike('name', `%${normalized}%`)
              .limit(1);
            mats = data || [];
          }

          if (mats && mats.length > 0) {
            return { thumb: mats[0].thumbnail_url, file: mats[0].file_url };
          }
        } catch (e) {
          console.warn('findMaterialByName falhou:', e);
        }
        return null;
      };

      // Resolver image_url para TODOS os anúncios (mesma lógica da pré-visualização)
      // Garantir mínimo de 2 segundos de visualização
      const adsWithResolvedImages = await ensureMinimumDelay(
        Promise.all(
          targetAds.map(async (ad) => {
            let finalImageUrl = ad.image_url;

            // 1. Se não tem image_url, tentar material local vinculado
            if (!finalImageUrl || finalImageUrl.trim() === '') {
              const localMatId = (ad as any).local_material_id;
              if (localMatId) {
                const { data: mat } = await supabase
                  .from('materials')
                  .select('thumbnail_url, file_url')
                  .eq('id', localMatId)
                  .single();

                if (mat) {
                  const thumbUrl = parseUrl(mat.thumbnail_url);
                  const fileUrl = parseUrl(mat.file_url);
                  finalImageUrl = thumbUrl || fileUrl || null;
                  if (finalImageUrl) {
                    finalImageUrl = makeAbsoluteUrl(finalImageUrl);
                  }
                }
              }
            }

            // 2. Se ainda não tem, tentar fallback pelo nome do anúncio
            if (!finalImageUrl || finalImageUrl.trim() === '') {
              const matByName = await findMaterialByName(ad.ad_name);
              if (matByName) {
                const thumbUrl = parseUrl(matByName.thumb);
                const fileUrl = parseUrl(matByName.file);
                finalImageUrl = thumbUrl || fileUrl || null;
                if (finalImageUrl) {
                  finalImageUrl = makeAbsoluteUrl(finalImageUrl);
                }
              }
            }

            return { ...ad, image_url: finalImageUrl };
          })
        ),
        2000 // 2 segundos mínimos
      );

      setAnalysisLoadingStatus({
        phase: 'resolving-images',
        message: 'Resolvendo imagens dos criativos',
        description: `${targetAds.length} anúncios processados`,
        progress: 30
      });

      // Delay de transição visual
      await new Promise(resolve => setTimeout(resolve, 500));

      // FASE 2: Categorização (30-50%)
      setAnalysisLoadingStatus({
        phase: 'categorizing-creatives',
        message: 'Categorizando criativos',
        description: 'Separando por tipo de mídia (imagem/vídeo/sem material)...',
        progress: 40
      });

      // Declarar variáveis fora do async wrapper
      let adsWithLocalMaterial: any[] = [];
      let adsWithVideoOnly: any[] = [];
      let adsWithoutMaterial: any[] = [];

      // Garantir mínimo de 2 segundos de visualização
      await ensureMinimumDelay(
        (async () => {
          for (const ad of adsWithResolvedImages) {
            const hasImage = ad.image_url && ad.image_url.trim() !== '';
            const hasVideo = ad.video_url && ad.video_url.trim() !== '';

            // 📋 LOG: Verificação detalhada para cada anúncio
            console.log(`🔍 Verificando criativo: ${ad.ad_name}`, {
              tem_image_url: !!hasImage,
              image_url_valor: ad.image_url || 'null',
              tem_video: !!hasVideo,
              video_url_valor: ad.video_url || 'null'
            });

            if (hasImage) {
              adsWithLocalMaterial.push({
                ad_id: ad.ad_id,
                ad_name: ad.ad_name,
                campaign_name: ad.campaign_name || 'Campanha não identificada',
                image_url: ad.image_url,
                has_visual: true, // ✅ GARANTIDO: só true quando TEM image_url
                impressions: ad.metrics?.impressions ?? 0,
                clicks: ad.metrics?.clicks ?? 0,
                spend: ad.metrics?.spend ?? 0,
                ctr: ad.metrics?.ctr ?? 0,
                cpc: ad.metrics?.cpc ?? 0,
                conversions: ad.metrics?.conversions ?? 0,
                conversion_rate: ad.metrics?.conversion_rate ?? 0,
                roas: ad.metrics?.roas ?? 0,
              });
              console.log(`✅ Categorizado COM MATERIAL: ${ad.ad_name}`);
            } else if (hasVideo) {
              adsWithVideoOnly.push({
                ad_id: ad.ad_id,
                ad_name: ad.ad_name,
                campaign_name: ad.campaign_name || 'Campanha não identificada',
                video_url: ad.video_url,
                has_visual: false, // ✅ GARANTIDO: false para vídeos
                is_video: true,
                impressions: ad.metrics?.impressions ?? 0,
                clicks: ad.metrics?.clicks ?? 0,
                spend: ad.metrics?.spend ?? 0,
                ctr: ad.metrics?.ctr ?? 0,
                cpc: ad.metrics?.cpc ?? 0,
                conversions: ad.metrics?.conversions ?? 0,
                conversion_rate: ad.metrics?.conversion_rate ?? 0,
                roas: ad.metrics?.roas ?? 0,
              });
              console.log(`🎥 Categorizado VÍDEO: ${ad.ad_name}`);
            } else {
              // ⚠️ Sem mídia vinculada ao anúncio
              adsWithoutMaterial.push({
                ad_id: ad.ad_id,
                ad_name: ad.ad_name,
                campaign_name: ad.campaign_name || 'Campanha não identificada',
                has_visual: false, // ✅ GARANTIDO: false quando não tem material
                is_video: false,
                impressions: ad.metrics?.impressions ?? 0,
                clicks: ad.metrics?.clicks ?? 0,
                spend: ad.metrics?.spend ?? 0,
                ctr: ad.metrics?.ctr ?? 0,
                cpc: ad.metrics?.cpc ?? 0,
                conversions: ad.metrics?.conversions ?? 0,
                conversion_rate: ad.metrics?.conversion_rate ?? 0,
                roas: ad.metrics?.roas ?? 0,
              });
              console.log(`⚠️ Categorizado SEM MATERIAL: ${ad.ad_name}`);
            }
          }

          console.log(`📊 Categorização FINAL de ${targetAds.length} anúncios:`, {
            com_material: adsWithLocalMaterial.length,
            videos: adsWithVideoOnly.length,
            sem_material: adsWithoutMaterial.length,
            total_enviado: adsWithLocalMaterial.length + adsWithVideoOnly.length + adsWithoutMaterial.length,
          });
        })(),
        2000 // 2 segundos mínimos
      );

      setAnalysisLoadingStatus({
        phase: 'categorizing-creatives',
        message: 'Categorização concluída',
        description: `${adsWithLocalMaterial.length} com imagem, ${adsWithVideoOnly.length} vídeos, ${adsWithoutMaterial.length} sem material`,
        progress: 50
      });

      // Delay de transição visual
      await new Promise(resolve => setTimeout(resolve, 500));

      // FASE 3: Análise IA (50-80%) com mensagens dinâmicas
      let messageIndex = 0;
      
      // Mensagem inicial
      setAnalysisLoadingStatus({
        phase: 'analyzing-ai',
        ...AI_ANALYSIS_MESSAGES[0]
      });
      
      // Sistema de rotação de mensagens
      messageInterval = setInterval(() => {
        messageIndex = (messageIndex + 1) % AI_ANALYSIS_MESSAGES.length;
        setAnalysisLoadingStatus({
          phase: 'analyzing-ai',
          ...AI_ANALYSIS_MESSAGES[messageIndex]
        });
      }, 2500); // Troca a cada 2.5 segundos

      // Combinar TODOS os anúncios
      const allCreatives = [
        ...adsWithLocalMaterial,
        ...adsWithVideoOnly,
        ...adsWithoutMaterial
      ];

      const normalizedCompetitorKeyword = competitorKeyword?.trim().toLowerCase() || null;

      const { data, error } = await supabase.functions.invoke('analyze-creative', {
        body: {
          creatives: allCreatives,
          analysisType: type,
          primaryMetric,
          secondaryMetric,
          competitor_keyword: normalizedCompetitorKeyword, // Passar keyword normalizada
          context: {
            total_ads: targetAds.length,
            ads_with_visual: adsWithLocalMaterial.length,
            ads_video_only: adsWithVideoOnly.length,
            ads_without_material: adsWithoutMaterial.length
          }
        }
      });

      // Parar rotação de mensagens
      if (messageInterval) {
        clearInterval(messageInterval);
        messageInterval = null;
      }

      if (error) {
        console.error('Error generating visual analysis:', error);
        throw error;
      }

      setAnalysisLoadingStatus({
        phase: 'analyzing-ai',
        message: 'Análise concluída',
        description: 'IA finalizou a análise dos criativos',
        progress: 80
      });

      // FASE 4: Gerando Insights (80-100%)
      setAnalysisLoadingStatus({
        phase: 'generating-insights',
        message: 'Gerando insights finais',
        description: 'Formatando resultados e recomendações...',
        progress: 90
      });

      if (data?.success) {
        // ✅ Validação pós-análise: verificar se IA especulou sobre elementos visuais
        const analysisText = data.analysis.toLowerCase();
        const visualKeywords = ['cor', 'layout', 'composição', 'botão', 'texto visível', 'fundo'];
        
        // Verificar se existem criativos sem material mas com análise visual suspeita
        const suspectAnalysis = adsWithoutMaterial.length > 0 && 
          visualKeywords.some(keyword => analysisText.includes(keyword));
        
        if (suspectAnalysis) {
          console.warn('⚠️ ALERTA: Possível análise visual para criativos sem material!', {
            sem_material: adsWithoutMaterial.map(ad => ad.ad_name),
            keywords_encontradas: visualKeywords.filter(kw => analysisText.includes(kw))
          });
        }
        
        setAnalysis(data.analysis);
        
        // Mensagem contextual baseada na composição
        let description = `Análise detalhada dos ${type === 'top' ? 'anúncios em destaque' : 'criativos que precisam de melhoria'}.`;
        
        if (adsWithLocalMaterial.length > 0) {
          description += ` ${adsWithLocalMaterial.length} criativo(s) com análise visual completa.`;
        }
        
        if (adsWithVideoOnly.length > 0) {
          description += ` ${adsWithVideoOnly.length} vídeo(s) - apenas métricas.`;
        }
        
        if (adsWithoutMaterial.length > 0) {
          description += ` ${adsWithoutMaterial.length} sem material - apenas métricas.`;
        }

        setAnalysisLoadingStatus({
          phase: 'complete',
          message: 'Análise completa!',
          description: 'Todos os insights foram gerados com sucesso',
          progress: 100
        });
        
        toast({
          title: "Análise gerada com sucesso!",
          description,
        });
      } else {
        throw new Error(data?.error || 'Erro desconhecido na geração da análise');
      }
      
    } catch (error) {
      console.error('Error generating visual analysis:', error);
      
      // Limpar intervalo em caso de erro
      if (messageInterval) {
        clearInterval(messageInterval);
        messageInterval = null;
      }
      
      // Reset loading status on error
      setAnalysisLoadingStatus({
        phase: 'idle',
        message: '',
        description: '',
        progress: 0
      });
      
      // Tratar erros específicos da IA
      if (error.message?.includes('429')) {
        toast({
          title: "Limite de requisições excedido",
          description: "Muitas requisições foram feitas. Aguarde alguns momentos antes de tentar novamente.",
          variant: "destructive",
        });
      } else if (error.message?.includes('402')) {
        toast({
          title: "Créditos insuficientes",
          description: "Adicione créditos ao seu workspace Lovable AI para continuar usando a análise visual.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Erro na análise visual",
          description: "Não foi possível gerar a análise visual. Tente novamente.",
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
      
      // Limpar qualquer intervalo que possa estar rodando
      if (messageInterval) {
        clearInterval(messageInterval);
        messageInterval = null;
      }
      
      // Reset após 1 segundo para permitir visualização do "complete"
      setTimeout(() => {
        setAnalysisLoadingStatus({
          phase: 'idle',
          message: '',
          description: '',
          progress: 0
        });
      }, 1000);
    }
  };

  const renderAnalysisBlock = (analysis: string | null, type: 'top' | 'worst') => {
    if (!analysis) return null;

    const isTop = type === 'top';
    const neonClass = isTop ? 'neon-green' : 'neon-red';
    
    // Calcular estatísticas de análise
    const targetAds = type === 'top' ? topPerformers : worstPerformers;
    const stats = {
      total: targetAds.length,
      visual: targetAds.filter(ad => ad.image_url && ad.image_url.trim() !== '').length,
      video: targetAds.filter(ad => !ad.image_url && ad.video_url).length,
      noMaterial: targetAds.filter(ad => !ad.image_url && !ad.video_url).length
    };

    return (
      <div className={`mt-4 p-4 rounded-lg border-2 ${neonClass} bg-background/50 backdrop-blur-sm`}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Sparkles className={`h-4 w-4 ${isTop ? 'text-green-400' : 'text-red-400'}`} />
            <h4 className="font-semibold text-sm">Análise da IA</h4>
          </div>
          {/* Badges indicando tipo de análise */}
          <div className="flex gap-2">
            {stats.visual > 0 && (
              <Badge variant="outline" className="text-xs bg-green-500/10 border-green-500/30">
                {stats.visual} com análise visual
              </Badge>
            )}
            {stats.video > 0 && (
              <Badge variant="outline" className="text-xs bg-blue-500/10 border-blue-500/30">
                {stats.video} vídeo (métricas)
              </Badge>
            )}
            {stats.noMaterial > 0 && (
              <Badge variant="outline" className="text-xs bg-amber-500/10 border-amber-500/30">
                {stats.noMaterial} sem material (métricas)
              </Badge>
            )}
          </div>
        </div>
        <AnalysisDisplay analysis={analysis} compact />
      </div>
    );
  };

  const currentObjective = OBJECTIVE_CONFIGS[selectedObjective];
  const availableMetrics = currentObjective?.metrics || Object.keys(METRIC_LABELS);

  const metricOptions = availableMetrics.map(metric => ({
    value: metric,
    label: METRIC_LABELS[metric] || metric
  }));

  // Auto-ajustar métricas quando objetivo muda (apenas quando objetivo muda)
  useEffect(() => {
    if (currentObjective) {
      onMetricChange(currentObjective.defaultPrimary, currentObjective.defaultSecondary);
    }
  }, [selectedObjective]); // Apenas quando selectedObjective muda

  // Função para aplicar configuração e scroll
  const handleApplyConfiguration = () => {
    // Scroll suave até a seção de anúncios em destaque
    const topPerformersSection = document.querySelector('[data-section="top-performers"]');
    if (topPerformersSection) {
      topPerformersSection.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'start' 
      });
    }
    
    toast({
      title: "Configuração aplicada!",
      description: `Ranking configurado para ${currentObjective?.name} com ${creativesCount} criativos.`,
    });
  };

  return (
    <div className="space-y-6 relative">
      {/* Configuração de Ranking */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Configurar Ranking
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Linha 1: Objetivo e Quantidade */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Objetivo da Campanha</label>
              <Select value={selectedObjective} onValueChange={setSelectedObjective}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(OBJECTIVE_CONFIGS).map(([key, config]) => (
                    <SelectItem key={key} value={key}>
                      {config.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <label className="text-sm font-medium mb-2 block">Quantidade de Criativos</label>
              <Select value={creativesCount.toString()} onValueChange={(value) => setCreativesCount(Number(value))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="3">3 criativos</SelectItem>
                  <SelectItem value="4">4 criativos</SelectItem>
                  <SelectItem value="6">6 criativos</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Linha 2: Métricas */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Métrica Principal</label>
              <Select value={primaryMetric} onValueChange={(value) => onMetricChange(value, secondaryMetric)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {metricOptions.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <label className="text-sm font-medium mb-2 block">Métrica Secundária</label>
              <Select value={secondaryMetric} onValueChange={(value) => onMetricChange(primaryMetric, value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {metricOptions.filter(option => option.value !== primaryMetric).map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Linha 3: Configurações Avançadas */}
          <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <div>
                <p className="text-sm font-medium">Incluir Amostras Pequenas</p>
                <p className="text-xs text-muted-foreground">Criativos que não atingem o mínimo de amostra para análise confiável</p>
              </div>
            </div>
            <Switch 
              checked={includeSmallSamples} 
              onCheckedChange={setIncludeSmallSamples}
            />
          </div>

          {/* Botão Configurar e Info sobre Gates */}
          <div className="flex flex-col gap-4">
            <Button 
              onClick={handleApplyConfiguration}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
              size="lg"
            >
              <Target className="h-4 w-4 mr-2" />
              Configurar
            </Button>

            {currentObjective && (
              <div className="text-xs text-muted-foreground bg-card p-3 rounded-lg border">
                <p className="font-medium mb-1">Gates de Amostra Mínima para {currentObjective.name}:</p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(currentObjective.gates).map(([key, value]) => (
                    <Badge key={key} variant="outline" className="text-xs">
                      {key}: {key === 'spend' ? `R$ ${value}` : value}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Top Performers */}
      <Card data-section="top-performers" className="border-0">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-success" />
              <span>Anúncios em Destaque</span>
              {topPerformers.some(ad => ad.hasSmallSample) && (
                <Badge variant="outline" className="text-xs">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  {topPerformers.filter(ad => ad.hasSmallSample).length} amostra pequena
                </Badge>
              )}
            </div>
            <Button 
              variant="default" 
              size="sm"
              onClick={() => generateAnalysis('top')}
              disabled={isGeneratingTop || topPerformers.length === 0}
              className="bg-muted hover:bg-muted/80 text-success-foreground hover:text-success-foreground animate-fade-in px-3 py-2 sm:px-4 sm:py-2 text-sm sm:text-base shadow-[0_0_8px_rgba(34,197,94,0.3)] dark:shadow-[0_0_8px_rgba(34,197,94,0.4)] transition-all duration-200"
            >
              {isGeneratingTop ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1 sm:mr-2" />
              ) : (
                <Sparkles className="h-4 w-4 mr-1 sm:mr-2" />
              )}
              {isGeneratingTop ? 'Analisando...' : 'Analisar boa performance'}
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isGeneratingTop && analysisLoadingStatus.phase !== 'idle' ? (
            <ProgressLoader status={analysisLoadingStatus} />
          ) : topPerformers.length > 0 ? (
            <>
              <MetaAdsGrid 
                ads={topPerformers}
                primaryMetric={primaryMetric}
                secondaryMetric={secondaryMetric}
                objective={selectedObjective}
              />
              {renderAnalysisBlock(topAnalysis, 'top')}
            </>
          ) : (
            <p className="text-center text-muted-foreground py-8">
              Nenhum anúncio encontrado
            </p>
          )}
        </CardContent>
      </Card>

      {/* Worst Performers */}
      <Card className="border-0">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingDown className="h-5 w-5 text-destructive" />
              <span>Precisam de Melhoria</span>
              {worstPerformers.some(ad => ad.hasSmallSample) && (
                <Badge variant="outline" className="text-xs">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  {worstPerformers.filter(ad => ad.hasSmallSample).length} amostra pequena
                </Badge>
              )}
            </div>
            <Button 
              variant="default" 
              size="sm"
              onClick={() => generateAnalysis('worst')}
              disabled={isGeneratingWorst || worstPerformers.length === 0}
              className="bg-muted hover:bg-muted/80 text-destructive-foreground dark:text-red-300 animate-fade-in px-3 py-2 sm:px-4 sm:py-2 text-sm sm:text-base shadow-[0_0_8px_rgba(248,113,113,0.2)] dark:shadow-[0_0_8px_rgba(248,113,113,0.3)] transition-all duration-200"
            >
              {isGeneratingWorst ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1 sm:mr-2" />
              ) : (
                <Sparkles className="h-4 w-4 mr-1 sm:mr-2" />
              )}
              {isGeneratingWorst ? 'Analisando...' : 'Analisar baixa performance'}
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isGeneratingWorst && analysisLoadingStatus.phase !== 'idle' ? (
            <ProgressLoader status={analysisLoadingStatus} />
          ) : worstPerformers.length > 0 ? (
            <>
              <MetaAdsGrid 
                ads={worstPerformers}
                primaryMetric={primaryMetric}
                secondaryMetric={secondaryMetric}
                objective={selectedObjective}
              />
              {renderAnalysisBlock(worstAnalysis, 'worst')}
            </>
          ) : (
            <p className="text-center text-muted-foreground py-8">
              Nenhum anúncio encontrado
            </p>
          )}
        </CardContent>
      </Card>

    </div>
  );
};
