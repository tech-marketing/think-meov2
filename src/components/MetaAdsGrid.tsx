import React, { useState } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Eye, TrendingUp, MousePointer, DollarSign, Target, Play, Image as ImageIcon, Brain, Loader2, Plus, AlertTriangle, Search, Settings, CheckCircle, Sparkles, Video, LayoutGrid } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { CreativeDisplay } from "./CreativeDisplay";
import { CreateProjectModal } from "./CreateProjectModal";
import { useNavigate } from 'react-router-dom';
import { useMetaAdsDirect } from "@/contexts/MetaAdsDirectContext";
import { OBJECTIVE_CONFIGS, METRIC_LABELS } from "@/utils/rankingRules";
import { AnalysisDisplay } from "@/components/AnalysisDisplay";
import { Progress } from "@/components/ui/progress";
import FloatingActionMenu from "@/components/ui/floating-action-menu";
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
  carousel_child_count?: number;
  hasSmallSample?: boolean;
  ad_copy?: string;
  message?: string;
  call_to_action?: string;
  headline?: string;
  link_url?: string;
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
interface MetaAdsGridProps {
  ads: MetaAd[];
  loading?: boolean;
  primaryMetric?: string;
  secondaryMetric?: string;
  objective?: string;
}
interface AnalysisLoadingStatus {
  phase: 'idle' | 'fetching-material' | 'preparing-context' | 'ai-analyzing' | 'ai-correlating' | 'generating-insights' | 'finalizing' | 'complete';
  message: string;
  description: string;
  progress: number;
}
export const MetaAdsGrid: React.FC<MetaAdsGridProps> = ({
  ads,
  loading,
  primaryMetric = 'ctr',
  secondaryMetric = 'roas',
  objective = 'sales'
}) => {
  const {
    toast
  } = useToast();
  const navigate = useNavigate();
  const {
    selectedAccount,
    competitorAds,
    competitorKeyword,
    accounts
  } = useMetaAdsDirect();
  const [analyzingAd, setAnalyzingAd] = useState<string | null>(null);
  const [analysisResults, setAnalysisResults] = useState<{
    [key: string]: {
      performance: string;
      marketTrends: string | null;
    };
  }>({});
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>(['spend', 'impressions', 'clicks', 'ctr', 'results', 'cost_per_result']);
  const [generatingBriefing, setGeneratingBriefing] = useState<string | null>(null);
  const [projectSelectionOpen, setProjectSelectionOpen] = useState<string | null>(null);
  const [createProjectOpen, setCreateProjectOpen] = useState(false);
  const [projects, setProjects] = useState<any[]>([]);
  const [materialCaption, setMaterialCaption] = useState<{
    [key: string]: string;
  }>({});
  const [analysisLoadingStatus, setAnalysisLoadingStatus] = useState<AnalysisLoadingStatus>({
    phase: 'idle',
    message: '',
    description: '',
    progress: 0
  });
  const [formatMenuOpen, setFormatMenuOpen] = useState<string | null>(null);
  const [trendMenuOpen, setTrendMenuOpen] = useState<string | null>(null);
  const [isTransforming, setIsTransforming] = useState(false);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [carouselDialogOpen, setCarouselDialogOpen] = useState(false);
  const [pendingTransformAd, setPendingTransformAd] = useState<MetaAd | null>(null);

  React.useEffect(() => {
    loadProjects();
  }, []);

  // Fetch material caption when needed
  const fetchMaterialCaption = async (ad: MetaAd) => {
    if (materialCaption[ad.id]) return; // Already fetched

    try {
      let materialData = null;
      if (ad.local_material_id) {
        const {
          data: material
        } = await supabase.from('materials').select('caption, copy').eq('id', ad.local_material_id).maybeSingle();
        materialData = material;
      } else {
        // Try exact name match first
        const {
          data: exactMatch
        } = await supabase.from('materials').select('caption, copy').eq('name', ad.ad_name).maybeSingle();
        if (exactMatch) {
          materialData = exactMatch;
        } else {
          // Fallback to partial name match
          const {
            data: partialMatch
          } = await supabase.from('materials').select('caption, copy').ilike('name', `%${ad.ad_name}%`).limit(1).maybeSingle();
          materialData = partialMatch;
        }
      }
      if (materialData?.caption || materialData?.copy) {
        setMaterialCaption(prev => ({
          ...prev,
          [ad.id]: materialData.caption || materialData.copy
        }));
      }
    } catch (error) {
      console.error('Erro ao buscar legenda do material:', error);
    }
  };
  const availableMetrics = [{
    key: 'impressions',
    label: 'Impressões',
    icon: Eye
  }, {
    key: 'clicks',
    label: 'Cliques',
    icon: MousePointer
  }, {
    key: 'ctr',
    label: 'CTR',
    icon: TrendingUp
  }, {
    key: 'cpc',
    label: 'CPC',
    icon: DollarSign
  }, {
    key: 'cpm',
    label: 'CPM',
    icon: DollarSign
  }, {
    key: 'cpp',
    label: 'CPP',
    icon: DollarSign
  }, {
    key: 'spend',
    label: 'Gasto',
    icon: DollarSign
  }, {
    key: 'reach',
    label: 'Alcance',
    icon: Target
  }, {
    key: 'frequency',
    label: 'Frequência',
    icon: TrendingUp
  }, {
    key: 'results',
    label: 'Resultados',
    icon: Target
  }, {
    key: 'conversion_rate',
    label: 'Taxa de Conversão',
    icon: TrendingUp
  }, {
    key: 'cost_per_result',
    label: 'Custo p/Resultado',
    icon: DollarSign
  }, {
    key: 'roas',
    label: 'ROAS',
    icon: TrendingUp
  }, {
    key: 'actions',
    label: 'Ações',
    icon: Target
  }, {
    key: 'video_views',
    label: 'Visualizações de Vídeo',
    icon: Play
  }];
  const analyzeCreative = async (ad: MetaAd) => {
    try {
      setAnalyzingAd(ad.id);

      // Fase 1: Coletando dados do criativo
      setAnalysisLoadingStatus({
        phase: 'fetching-material',
        message: 'Coletando dados do criativo',
        description: 'Buscando imagem, copy e métricas de performance...',
        progress: 15
      });

      // Buscar material local completo (file_url + caption + copy)
      let materialData = null;
      let localFileUrl = null;
      if (ad.local_material_id) {
        const {
          data: material
        } = await supabase.from('materials').select('file_url, caption, copy').eq('id', ad.local_material_id).maybeSingle();
        materialData = material;
        localFileUrl = material?.file_url;
      } else {
        // Buscar material pelo nome do anúncio
        const {
          data: material
        } = await supabase.from('materials').select('file_url, caption, copy').ilike('name', `%${ad.ad_name}%`).limit(1).maybeSingle();
        materialData = material;
        localFileUrl = material?.file_url;
      }

      // Pequeno delay para mostrar a fase
      await new Promise(resolve => setTimeout(resolve, 1200));

      // Validar se material local existe
      if (!localFileUrl) {
        toast({
          title: "Material local não encontrado",
          description: "Este anúncio precisa ter um material local vinculado para análise de qualidade.",
          variant: "destructive"
        });
        setAnalyzingAd(null);
        return;
      }
      console.log(`🖼️ Material local encontrado para análise: ${localFileUrl}`);

      // Fase 2: Preparando análise visual
      setAnalysisLoadingStatus({
        phase: 'preparing-context',
        message: 'Preparando análise visual',
        description: 'Processando elementos visuais e textuais do material...',
        progress: 35
      });

      // Preparar métricas selecionadas e seus valores
      const selectedMetricsData = selectedMetrics.map(metricKey => {
        const metric = availableMetrics.find(m => m.key === metricKey);
        const rawValue = ad.metrics ? (ad.metrics as any)[metricKey] : null;
        let formattedValue = '---';
        if (typeof rawValue !== 'undefined' && rawValue !== null) {
          switch (metricKey) {
            case 'ctr':
            case 'conversion_rate':
              formattedValue = `${rawValue.toFixed(2)}%`;
              break;
            case 'cpc':
            case 'cpm':
            case 'cpp':
            case 'spend':
            case 'cost_per_conversion':
              formattedValue = formatCurrency(rawValue);
              break;
            case 'roas':
              formattedValue = `${rawValue.toFixed(1)}x`;
              break;
            case 'frequency':
              formattedValue = rawValue.toFixed(2);
              break;
            case 'actions':
              formattedValue = Array.isArray(rawValue) ? rawValue.length.toString() : rawValue.toString();
              break;
            default:
              formattedValue = formatNumber(rawValue);
          }
        }
        return {
          key: metricKey,
          label: metric?.label || metricKey,
          value: formattedValue,
          rawValue: rawValue
        };
      });
      const metricsText = selectedMetricsData.map(m => `${m.label}: ${m.value}`).join(', ');

      // Pequeno delay para mostrar a fase
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Fase 3: Analisando composição visual (com 12 sub-fases sequenciais)
      const visualAnalysisSteps = [{
        message: 'Analisando composição visual',
        description: 'IA identificando cores dominantes e paleta cromática...',
        progress: 55
      }, {
        message: 'Processando elementos textuais',
        description: 'Extraindo headlines, CTAs e copy principal...',
        progress: 58
      }, {
        message: 'Mapeando hierarquia visual',
        description: 'Detectando fluxo de leitura e pontos focais...',
        progress: 61
      }, {
        message: 'Identificando pessoas e rostos',
        description: 'Analisando expressões faciais e linguagem corporal...',
        progress: 64
      }, {
        message: 'Detectando produtos e objetos',
        description: 'Reconhecendo elementos de marca e produtos...',
        progress: 67
      }, {
        message: 'Avaliando storytelling visual',
        description: 'Interpretando narrativa e apelo emocional...',
        progress: 70
      }, {
        message: 'Analisando contexto e cenário',
        description: 'Identificando ambiente, luz e atmosfera...',
        progress: 73
      }, {
        message: 'Processando elementos gráficos',
        description: 'Detectando ícones, ilustrações e overlays...',
        progress: 76
      }, {
        message: 'Correlacionando com copy',
        description: 'Verificando alinhamento visual-textual...',
        progress: 79
      }, {
        message: 'Validando consistência de marca',
        description: 'Checando guidelines e identidade visual...',
        progress: 82
      }, {
        message: 'Gerando insights preliminares',
        description: 'IA compilando análise visual completa...',
        progress: 85
      }, {
        message: 'Finalizando análise criativa',
        description: 'Preparando relatório de insights...',
        progress: 88
      }];

      // Fases para análise de mercado (se houver)
      const marketTrendsSteps = [{
        message: 'Analisando mercado',
        description: 'Carregando dados de competidores...',
        progress: 40
      }, {
        message: 'Processando padrões visuais',
        description: 'Identificando paletas e layouts comuns...',
        progress: 50
      }, {
        message: 'Analisando copywriting',
        description: 'Detectando apelos e CTAs frequentes...',
        progress: 60
      }, {
        message: 'Mapeando tendências',
        description: 'Correlacionando sazonalidade e contexto...',
        progress: 70
      }, {
        message: 'Gerando insights de mercado',
        description: 'Compilando análise competitiva...',
        progress: 80
      }, {
        message: 'Finalizando análise de mercado',
        description: 'Preparando recomendações estratégicas...',
        progress: 90
      }];
      let currentStepIndex = 0;
      let analysisComplete = false;

      // Iniciar progressão de sub-fases (muda a cada 1.5 segundos, SEM loop)
      const rotationInterval = setInterval(() => {
        if (!analysisComplete && currentStepIndex < visualAnalysisSteps.length) {
          setAnalysisLoadingStatus({
            phase: 'ai-analyzing',
            ...visualAnalysisSteps[currentStepIndex]
          });
          currentStepIndex++;
        } else if (currentStepIndex >= visualAnalysisSteps.length) {
          // Se terminar as 12 etapas mas IA ainda não respondeu, mantém a última
          clearInterval(rotationInterval);
        }
      }, 1500);

      // Definir primeira mensagem
      setAnalysisLoadingStatus({
        phase: 'ai-analyzing',
        ...visualAnalysisSteps[0]
      });

      // Preparar métricas de TODOS os anúncios para calcular média
      const allAdsMetrics = ads?.map((adItem: any) => ({
        ad_id: adItem.id,
        ad_name: adItem.ad_name,
        metrics: adItem.metrics || {}
      })) || [];

      // Extrair video_url do material ou do ad
      const videoFileUrl = materialData?.file_url?.includes('.mp4') ? materialData.file_url : ad.video_url || null;

      // Executar chamada da IA em paralelo
      console.log('🎯 Enviando para análise:', {
        adName: ad.ad_name,
        hasImage: !!localFileUrl,
        hasVideo: !!videoFileUrl,
        competitorCount: competitorAds?.length || 0,
        totalAdsForAverage: allAdsMetrics.length,
        selectedMetricsCount: selectedMetrics.length
      });
      console.log('🚀 Parâmetros enviados para analyze-creative:', {
        adName: ad.ad_name,
        campaignName: ad.campaign_name,
        hasMetrics: !!ad.metrics,
        metricsKeys: ad.metrics ? Object.keys(ad.metrics) : [],
        hasImageUrl: !!localFileUrl,
        hasVideoUrl: !!videoFileUrl,
        competitorKeyword: competitorKeyword || 'não fornecido',
        allAdsCount: allAdsMetrics.length,
        selectedMetricsCount: selectedMetrics.length
      });
      const {
        data,
        error
      } = await supabase.functions.invoke('analyze-creative', {
        body: {
          ad_name: ad.ad_name,
          campaign_name: ad.campaign_name,
          metrics: ad.metrics,
          image_url: localFileUrl,
          video_url: videoFileUrl,
          competitor_keyword: competitorKeyword,
          all_ads_metrics: allAdsMetrics,
          selected_metrics: selectedMetrics
          // ✅ NÃO incluir: creatives, analysisType, custom_prompt
        }
      });
      console.log('📦 Resposta bruta da edge function:', {
        hasData: !!data,
        hasError: !!error,
        dataType: typeof data,
        dataKeys: data ? Object.keys(data) : [],
        firstChars: typeof data?.performance_analysis === 'string' ? data.performance_analysis.substring(0, 100) : 'N/A'
      });

      // Parar rotação quando IA terminar
      analysisComplete = true;
      clearInterval(rotationInterval);
      if (error) {
        console.error('❌ Erro retornado pela edge function:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
          fullError: error
        });
        throw error;
      }

      // Fase 4: Correlacionando com performance
      setAnalysisLoadingStatus({
        phase: 'ai-correlating',
        message: 'Correlacionando com performance',
        description: 'Associando elementos visuais às métricas de resultado...',
        progress: 90
      });

      // Pequeno delay para mostrar a fase
      await new Promise(resolve => setTimeout(resolve, 1800));

      // Fase 5: Gerando recomendações
      setAnalysisLoadingStatus({
        phase: 'generating-insights',
        message: 'Gerando recomendações',
        description: 'IA criando insights acionáveis para otimização...',
        progress: 93
      });

      // Pequeno delay para mostrar a fase
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Fase 6: Finalizando relatório
      setAnalysisLoadingStatus({
        phase: 'finalizing',
        message: 'Finalizando relatório',
        description: 'Compilando análise completa...',
        progress: 97
      });

      // Pequeno delay para mostrar a fase
      await new Promise(resolve => setTimeout(resolve, 800));
      console.log('✅ Análise recebida:', {
        success: data?.success,
        hasPerformanceAnalysis: !!data?.performance_analysis,
        performanceLength: data?.performance_analysis?.length || 0,
        hasMarketTrends: !!data?.market_trends_analysis,
        marketTrendsLength: data?.market_trends_analysis?.length || 0,
        metadata: data?.metadata || null,
        fullResponse: data
      });
      if (data?.success && data?.performance_analysis) {
        setAnalysisResults(prev => ({
          ...prev,
          [ad.id]: {
            performance: data.performance_analysis,
            marketTrends: data.market_trends_analysis || null
          }
        }));

        // Salvar legenda se encontrada
        if (materialData?.caption) {
          setMaterialCaption(prev => ({
            ...prev,
            [ad.id]: materialData.caption
          }));
        }

        // Fase 5: Completo
        setAnalysisLoadingStatus({
          phase: 'complete',
          message: 'Análise concluída',
          description: data.market_trends_analysis ? 'Performance e tendências de mercado analisadas!' : 'Análise de performance concluída!',
          progress: 100
        });
        toast({
          title: "Análise concluída!",
          description: data.market_trends_analysis ? "Performance e tendências de mercado analisadas com sucesso." : "Análise de performance concluída. (Mínimo de 10 competidores necessário para análise de mercado)"
        });
      } else {
        const errorDetails = {
          hasSuccess: !!data?.success,
          hasPerformance: !!data?.performance_analysis,
          hasData: !!data,
          error: data?.error || 'Resposta inválida da API',
          receivedKeys: data ? Object.keys(data) : []
        };
        console.error('❌ Validação da resposta falhou:', errorDetails);
        throw new Error(data?.error || `Análise falhou: ${JSON.stringify(errorDetails)}`);
      }
    } catch (error) {
      console.error('Erro ao analisar criativo:', error);
      let errorTitle = "Erro na análise";
      let errorDescription = "Não foi possível analisar o criativo. Tente novamente.";
      if (error && typeof error === 'object') {
        if (error.message) {
          const message = error.message.toLowerCase();
          if (message.includes('quota') || message.includes('limite')) {
            errorTitle = "Limite de IA atingido";
            errorDescription = "O limite de uso da IA foi atingido. Tente novamente mais tarde ou entre em contato com o administrador.";
          } else if (message.includes('rate limit') || message.includes('muitas solicitações')) {
            errorTitle = "Muitas solicitações";
            errorDescription = "Aguarde um momento antes de tentar novamente.";
          } else if (message.includes('material') || message.includes('arquivo')) {
            errorTitle = "Material não encontrado";
            errorDescription = "Não foi possível encontrar o material para análise. Verifique se o upload foi concluído.";
          } else if (message.includes('configurada') || message.includes('chave')) {
            errorTitle = "Configuração necessária";
            errorDescription = "Serviço de IA não configurado. Entre em contato com o administrador.";
          } else {
            errorDescription = error.message;
          }
        }
      }
      toast({
        title: errorTitle,
        description: errorDescription,
        variant: "destructive"
      });
    } finally {
      setAnalyzingAd(null);
      setAnalysisLoadingStatus({
        phase: 'idle',
        message: '',
        description: '',
        progress: 0
      });
    }
  };
  const loadProjects = async () => {
    try {
      const {
        data,
        error
      } = await supabase.from('projects').select('id, name, description').eq('status', 'active').order('name');
      if (error) throw error;
      setProjects(data || []);
    } catch (error) {
      console.error('Erro ao carregar projetos:', error);
      toast({
        title: "Erro ao carregar projetos",
        description: "Não foi possível carregar a lista de projetos.",
        variant: "destructive"
      });
    }
  };
  const generateNewVersion = async (ad: MetaAd, projectId: string) => {
    try {
      // Garantir que a geração usa a ANÁLISE IA existente
      if (!analysisResults[ad.id]) {
        toast({
          title: "Análise necessária",
          description: "Gere a análise de IA deste criativo antes de criar a nova versão.",
          variant: "destructive"
        });
        return;
      }
      setGeneratingBriefing(ad.id);

      // Combinar ambas análises em uma string
      const combinedAnalysis = analysisResults[ad.id].marketTrends ? `${analysisResults[ad.id].performance}\n\n---\n\n## Tendências de Mercado\n\n${analysisResults[ad.id].marketTrends}` : analysisResults[ad.id].performance;
      console.log('🚀 Generating briefing with data:', {
        adId: ad.ad_id,
        adName: ad.ad_name,
        projectId,
        hasPerformanceAnalysis: !!analysisResults[ad.id].performance,
        hasMarketTrendsAnalysis: !!analysisResults[ad.id].marketTrends,
        hasMaterialCaption: !!materialCaption[ad.id]
      });
      toast({
        title: "Gerando briefing...",
        description: "A IA está criando um novo briefing baseado na análise. Aguarde um momento."
      });
      const {
        data,
        error
      } = await supabase.functions.invoke('generate-briefing', {
        body: {
          adId: ad.ad_id,
          accountId: selectedAccount,
          projectId: projectId,
          creativeAnalysis: combinedAnalysis,
          adName: ad.ad_name,
          materialCaption: materialCaption[ad.id],
          materialFileUrl: ad.image_url || ad.video_url,
          competitorAds: competitorAds || []
        }
      });
      console.log('📋 Generate briefing response:', {
        data,
        error
      });
      if (error) {
        console.error('❌ Generate briefing error:', error);
        throw error;
      }
      if (data?.success) {
        toast({
          title: "Briefing criado com sucesso!",
          description: "Abrindo o editor de briefing para ajustes finais."
        });
        setProjectSelectionOpen(null);
        if (data.briefing?.id) {
          navigate(`/briefing-editor/${data.briefing.id}`);
        }
      } else {
        console.error('❌ Generate briefing failed:', data);
        throw new Error(data?.error || 'Erro desconhecido na geração');
      }
    } catch (error) {
      console.error('💥 Erro ao gerar briefing:', error);
      let errorMessage = 'Não foi possível gerar o briefing. Tente novamente.';

      // Tratamento de erros mais específico
      if (error && typeof error === 'object') {
        if (error.message) {
          errorMessage = error.message;
        } else if (error.details) {
          errorMessage = error.details;
        }
      }
      toast({
        title: "Erro na geração do briefing",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setGeneratingBriefing(null);
    }
  };
  const handleGenerateVersion = async (ad: MetaAd, targetFormat?: 'static' | 'carousel' | 'video') => {
    try {
      // Garantir que a análise existe
      if (!analysisResults[ad.id]) {
        toast({
          title: "Análise necessária",
          description: "Gere a análise de IA deste criativo antes de criar a nova versão.",
          variant: "destructive"
        });
        return;
      }

      // Find a default project or use the first active project
      const {
        data: projectsData
      } = await supabase.from('projects').select('id, name, company_id').eq('status', 'active').order('name').limit(1);
      if (!projectsData || projectsData.length === 0) {
        toast({
          title: "Nenhum projeto encontrado",
          description: "Crie um projeto primeiro para gerar wireframes",
          variant: "destructive"
        });
        return;
      }
      const defaultProject = projectsData[0];

      // Get user profile for created_by
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "Erro de autenticação",
          description: "Usuário não autenticado",
          variant: "destructive"
        });
        return;
      }

      const { data: profileData } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!profileData) {
        toast({
          title: "Erro",
          description: "Perfil de usuário não encontrado",
          variant: "destructive"
        });
        return;
      }

      setGeneratingBriefing(ad.id);

      const formatLabel = targetFormat === 'carousel' ? 'carrossel' :
        targetFormat === 'video' ? 'vídeo' :
          'imagem estática';

      // Create pending material first
      const { data: pendingMaterial, error: createError } = await supabase
        .from('materials')
        .insert({
          name: `${ad.ad_name} (Gerando...)`,
          type: targetFormat || 'static',
          status: 'processing',
          is_briefing: true,
          project_id: defaultProject.id,
          company_id: defaultProject.company_id,
          created_by: profileData.id
        })
        .select()
        .single();

      if (createError) {
        console.error('Error creating pending material:', createError);
        toast({
          title: "Erro",
          description: "Não foi possível criar o briefing",
          variant: "destructive"
        });
        return;
      }

      // Show toast - user stays on current page
      toast({
        title: "Gerando briefing...",
        description: `Criando ${formatLabel} baseado na análise. O briefing aparecerá na seção Briefings quando estiver pronto.`
      });

      // Call generate-briefing in background to update the material
      const combinedAnalysis = analysisResults[ad.id].marketTrends
        ? `${analysisResults[ad.id].performance}\n\n---\n\n## Tendências de Mercado\n\n${analysisResults[ad.id].marketTrends}`
        : analysisResults[ad.id].performance;

      const {
        data,
        error
      } = await supabase.functions.invoke('generate-briefing', {
        body: {
          adId: ad.ad_id,
          accountId: selectedAccount,
          projectId: defaultProject.id,
          creativeAnalysis: combinedAnalysis,
          adName: ad.ad_name,
          materialCaption: materialCaption[ad.id],
          materialFileUrl: ad.image_url || ad.video_url,
          competitorAds: competitorAds || [],
          targetFormat: targetFormat || 'static',
          materialId: pendingMaterial.id // Pass the ID to update existing material
        }
      });

      if (error) {
        console.error('Error generating briefing:', error);
        // Material will stay in "processing" state - user can see error in the editor
      }
    } catch (error) {
      console.error('Erro ao gerar briefing:', error);
      toast({
        title: "Erro na geração do briefing",
        description: error.message || "Não foi possível gerar o briefing. Tente novamente.",
        variant: "destructive"
      });
    } finally {
      setGeneratingBriefing(null);
    }
  };

  const saveMaterial = async (
    webhookData: any,
    projectId: string,
    ad: MetaAd,
    format: string
  ) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id, id')
        .eq('user_id', user.id)
        .single();

      if (!profile?.company_id) throw new Error('Empresa não encontrada');

      // Map format to type
      let type = 'image';
      if (format === 'reels' || format === 'video') type = 'video';
      if (format === 'carousel') type = 'carousel';

      const { data: material, error } = await supabase
        .from('materials')
        .insert({
          company_id: profile.company_id,
          project_id: projectId,
          name: webhookData.name || `${ad.ad_name} - ${format}`,
          type: type,
          status: 'pending',
          file_url: webhookData.file_url || webhookData.url || webhookData.criativo_url,
          thumbnail_url: webhookData.thumbnail_url || webhookData.thumbnail,
          caption: webhookData.caption || webhookData.legenda,
          copy: webhookData.copy || webhookData.text,
          created_by: profile.id,
          // ad_id is not in the schema we saw, so skipping it.
          // If needed we can add it to metadata
          metadata: {
            source_ad_id: ad.id,
            source_ad_name: ad.ad_name,
            generated_via: 'webhook'
          }
        })
        .select()
        .single();

      if (error) throw error;
      return material;
    } catch (error) {
      console.error('Erro ao salvar material:', error);
      throw error;
    }
  };


  // Função para criar material pendente e iniciar fluxo assíncrono
  const createPendingMaterial = async (
    payload: any,
    projectId: string,
    ad: MetaAd,
    format: string
  ) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id, id')
        .eq('user_id', user.id)
        .single();

      if (!profile?.company_id) throw new Error('Empresa não encontrada');

      // Map format to type
      let type = 'image';
      if (format === 'reels' || format === 'video') type = 'video';
      if (format === 'carousel') type = 'carousel';

      const { data: material, error } = await supabase
        .from('materials')
        .insert({
          company_id: profile.company_id,
          project_id: projectId,
          name: `${ad.ad_name} - ${format} (Gerando)`,
          type: type,
          status: 'processing', // Status especial para indicar que está gerando
          file_url: ad.image_url || ad.video_url, // URL original como placeholder
          thumbnail_url: ad.image_url,
          caption: payload.legenda,
          created_by: profile.id,
          metadata: {
            source_ad_id: ad.id,
            source_ad_name: ad.ad_name,
            generated_via: 'webhook',
            webhook_payload: payload // Salva o payload para ser usado no frontend
          }
        })
        .select()
        .single();

      if (error) throw error;
      return material;
    } catch (error) {
      console.error('Erro ao criar material pendente:', error);
      throw error;
    }
  };

  // Helper to get the best URL for the creative (local or public)
  const getCreativeUrl = async (ad: MetaAd) => {
    if (ad.local_material_id) {
      const { data } = await supabase.from('materials').select('file_url').eq('id', ad.local_material_id).maybeSingle();
      if (data?.file_url) {
        return data.file_url;
      }
    }
    return ad.image_url || ad.video_url;
  };

  // Função separada para geração de vídeo com tendências
  const handleGenerateVideoWithTrends = async (ad: MetaAd) => {
    if (!selectedProject) {
      toast({
        title: "Selecione um projeto",
        description: "Você precisa selecionar um projeto antes de criar o vídeo",
        variant: "destructive"
      });
      return;
    }

    setIsTransforming(true);

    try {
      const brandName = accounts.find(a => a.account_id === selectedAccount)?.name || '';
      const creativeUrl = await getCreativeUrl(ad);

      const payload = {
        criativo_analisado_url: creativeUrl,
        creative_analyzed_public_url: creativeUrl,
        market_trends: analysisResults[ad.id]?.marketTrends || null,
        legenda: materialCaption[ad.id] || ad.ad_copy || '',
        target_format: 'reels',
        creative_id: ad.creative_id,
        brand_name: brandName,
        creative_url: creativeUrl,
        creative_caption: materialCaption[ad.id] || ad.ad_copy || ''
      };

      // Criar material pendente e redirecionar imediatamente
      const material = await createPendingMaterial(payload, selectedProject, ad, 'reels');

      toast({
        title: "Iniciando geração...",
        description: "Você será redirecionado para acompanhar o progresso."
      });

      navigate(`/briefing-editor/${material.id}`);

    } catch (error) {
      console.error('Erro ao iniciar geração de vídeo:', error);
      toast({
        title: "Erro ao iniciar geração",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive"
      });
      setIsTransforming(false);
    }
  };

  // Função separada para geração de carrossel com tendências
  const handleGenerateCarouselWithTrends = async (ad: MetaAd) => {
    if (!selectedProject) {
      toast({
        title: "Selecione um projeto",
        description: "Você precisa selecionar um projeto antes de criar o carrossel",
        variant: "destructive"
      });
      return;
    }

    setIsTransforming(true);

    try {
      const brandName = accounts.find(a => a.account_id === selectedAccount)?.name || '';
      const creativeUrl = await getCreativeUrl(ad);

      const payload = {
        criativo_analisado_url: creativeUrl,
        creative_analyzed_public_url: creativeUrl,
        market_trends: analysisResults[ad.id]?.marketTrends || null,
        legenda: materialCaption[ad.id] || ad.ad_copy || '',
        target_format: 'carousel',
        creative_id: ad.creative_id,
        brand_name: brandName,
        creative_url: creativeUrl,
        creative_caption: materialCaption[ad.id] || ad.ad_copy || ''
      };

      // Criar material pendente e redirecionar imediatamente
      const material = await createPendingMaterial(payload, selectedProject, ad, 'carousel');

      toast({
        title: "Iniciando geração...",
        description: "Você será redirecionado para acompanhar o progresso."
      });

      navigate(`/briefing-editor/${material.id}`);
    } catch (error) {
      console.error('Erro ao iniciar geração de carrossel:', error);
      toast({
        title: "Erro ao iniciar geração",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive"
      });
      setIsTransforming(false);
    }
  };

  // Função separada para geração de imagem estática com tendências
  const handleGenerateStaticWithTrends = async (ad: MetaAd) => {
    if (!selectedProject) {
      toast({
        title: "Selecione um projeto",
        description: "Você precisa selecionar um projeto antes de criar a imagem estática",
        variant: "destructive"
      });
      return;
    }

    setIsTransforming(true);

    try {
      const brandName = accounts.find(a => a.account_id === selectedAccount)?.name || '';
      const creativeUrl = await getCreativeUrl(ad);

      const payload = {
        criativo_analisado_url: creativeUrl,
        creative_analyzed_public_url: creativeUrl,
        market_trends: analysisResults[ad.id]?.marketTrends || null,
        legenda: materialCaption[ad.id] || ad.ad_copy || '',
        target_format: 'feed',
        creative_id: ad.creative_id,
        brand_name: brandName,
        creative_url: creativeUrl,
        creative_caption: materialCaption[ad.id] || ad.ad_copy || ''
      };

      // Criar material pendente e redirecionar imediatamente
      const material = await createPendingMaterial(payload, selectedProject, ad, 'feed');

      toast({
        title: "Iniciando geração...",
        description: "Você será redirecionado para acompanhar o progresso."
      });

      navigate(`/briefing-editor/${material.id}`);
    } catch (error) {
      console.error('Erro ao iniciar geração de imagem estática:', error);
      toast({
        title: "Erro ao iniciar geração",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive"
      });
      setIsTransforming(false);
    }
  };
  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toFixed(0);
  };
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };
  if (loading) {
    return <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {[...Array(6)].map((_, i) => <Card key={i} className="overflow-hidden">
        <div className="aspect-video bg-muted animate-pulse" />
        <CardContent className="p-3 space-y-2">
          <div className="h-4 bg-muted animate-pulse rounded" />
          <div className="h-3 bg-muted animate-pulse rounded w-3/4" />
          <div className="grid grid-cols-3 gap-2">
            <div className="h-8 bg-muted animate-pulse rounded" />
            <div className="h-8 bg-muted animate-pulse rounded" />
            <div className="h-8 bg-muted animate-pulse rounded" />
          </div>
        </CardContent>
      </Card>)}
    </div>;
  }
  if (ads.length === 0) {
    return <div className="text-center py-12">
      <h3 className="text-lg font-semibold mb-2">Nenhum anúncio encontrado</h3>
      <p className="text-muted-foreground">
        Ajuste os filtros ou selecione diferentes campanhas para ver os anúncios.
      </p>
    </div>;
  }
  return <TooltipProvider>
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {ads.map(ad => <Card key={ad.id} className="overflow-hidden hover:shadow-lg transition-all duration-300 group">
        {/* Creative Preview */}
        <div className="aspect-video relative bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900">
          <CreativeDisplay imageUrl={ad.image_url} videoUrl={ad.video_url} creativeId={ad.creative_id} adName={ad.ad_name} localMaterialId={ad.local_material_id} className="rounded-none" />

          {/* Status Badges */}
          <div className="absolute top-2 right-2 flex flex-col gap-1">
            <Badge variant={ad.status === 'ACTIVE' ? 'default' : 'secondary'} className={ad.status === 'ACTIVE' ? 'bg-success text-success-foreground hover:bg-success/90' : 'bg-muted text-muted-foreground'}>
              {ad.status === 'ACTIVE' ? 'Ativo' : 'Pausado'}
            </Badge>

            {/* Small Sample Warning Badge */}
            {ad.hasSmallSample && <Badge variant="outline" className="bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/50 text-xs">
              <AlertTriangle className="h-3 w-3 mr-1" />
              Amostra pequena
            </Badge>}
          </div>

          {/* Action Buttons Overlay */}
          <div className="absolute inset-0 bg-slate-900/80 opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center gap-2">
            <Dialog>
              <DialogTrigger asChild>
                <Button size="sm" className="bg-card/90 hover:bg-card text-foreground shadow-lg border border-border/50" onClick={() => fetchMaterialCaption(ad)}>
                  <Eye className="w-4 h-4 mr-2" />
                  Ver Detalhes
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-6xl max-h-[85vh] overflow-y-auto bg-card border-border">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 text-xl text-foreground">
                    <Eye className="w-6 h-6 text-primary" />
                    Detalhes do Anúncio
                  </DialogTitle>
                  <DialogDescription className="text-base text-muted-foreground">
                    Informações completas e análise detalhada do anúncio "{ad.ad_name}"
                  </DialogDescription>
                </DialogHeader>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Coluna Esquerda - Criativo */}
                  <div className="space-y-4">
                    <div className="border border-border rounded-lg p-4 bg-card">
                      <h4 className="font-semibold mb-3 text-lg text-foreground">Criativo do Anúncio</h4>
                      <div className="aspect-square bg-muted/50 rounded-lg flex items-center justify-center overflow-hidden border border-border">
                        <CreativeDisplay imageUrl={ad.image_url} videoUrl={ad.video_url} creativeId={ad.creative_id} adName={ad.ad_name} localMaterialId={ad.local_material_id} showControls={true} className="rounded-lg" />
                      </div>

                      {/* Legenda/Descrição do Criativo */}
                      <div className="mt-4 pt-4 border-t border-border">
                        <span className="text-sm font-medium text-muted-foreground">Legenda/Descrição:</span>
                        {materialCaption[ad.id] ? <p className="text-sm text-foreground mt-1 leading-relaxed">{materialCaption[ad.id]}</p> : <p className="text-sm text-muted-foreground mt-1 italic">Sem legenda/descrição disponível</p>}
                      </div>
                    </div>
                  </div>


                  {/* Coluna Direita - Informações e Métricas */}
                  <div className="space-y-4">
                    {/* Informações do Anúncio */}
                    <div className="border border-border rounded-lg p-4 bg-card">
                      <h4 className="font-semibold mb-3 text-lg text-foreground">Informações do Anúncio</h4>
                      <div className="space-y-3">
                        <div>
                          <span className="text-sm font-medium text-muted-foreground">Nome:</span>
                          <p className="text-sm font-medium text-foreground">{ad.ad_name}</p>
                        </div>
                        <div>
                          <span className="text-sm font-medium text-muted-foreground">Campanha:</span>
                          <p className="text-sm font-medium text-foreground">{ad.campaign_name}</p>
                        </div>
                        {materialCaption[ad.id] && <div>
                          <span className="text-sm font-medium text-muted-foreground">Legenda/Descrição:</span>
                          <p className="text-sm text-foreground mt-1">{materialCaption[ad.id]}</p>
                        </div>}
                        <div className="flex justify-between items-center flex-wrap gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-muted-foreground">Status:</span>
                            <Badge variant={ad.status === 'ACTIVE' ? 'default' : 'secondary'} className={ad.status === 'ACTIVE' ? 'bg-success text-success-foreground hover:bg-success/90' : ''}>
                              {ad.status === 'ACTIVE' ? 'Ativo' : 'Pausado'}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Métricas de Performance */}
                    {ad.metrics && <div className="border border-border rounded-lg p-4 bg-card">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="font-semibold text-lg text-foreground">Métricas de Performance</h4>
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button size="sm" variant="outline" className="text-xs">
                              Personalizar
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="bg-card border-border">
                            <DialogHeader>
                              <DialogTitle className="text-foreground">Selecionar Métricas</DialogTitle>
                              <DialogDescription className="text-muted-foreground">
                                Escolha até 6 métricas para exibir
                              </DialogDescription>
                            </DialogHeader>
                            <div className="grid grid-cols-2 gap-3 max-h-60 overflow-y-auto">
                              {availableMetrics.map(metric => {
                                if (!metric || !metric.icon) return null;
                                const IconComponent = metric.icon;
                                const isSelected = selectedMetrics.includes(metric.key);
                                return <Button key={metric.key} variant="outline" size="sm" className={`justify-start gap-2 ${isSelected ? 'bg-primary/20 border-primary text-primary hover:bg-primary/30 shadow-[0_0_10px_hsl(var(--primary)/0.4)]' : 'hover:bg-muted'}`} onClick={() => {
                                  if (isSelected) {
                                    if (selectedMetrics.length > 1) {
                                      setSelectedMetrics(prev => prev.filter(m => m !== metric.key));
                                    }
                                  } else {
                                    if (selectedMetrics.length < 6) {
                                      setSelectedMetrics(prev => [...prev, metric.key]);
                                    }
                                  }
                                }} disabled={!isSelected && selectedMetrics.length >= 6}>
                                  <IconComponent className="w-4 h-4" />
                                  {metric.label}
                                </Button>;
                              })}
                            </div>
                          </DialogContent>
                        </Dialog>
                      </div>
                      <div className="grid grid-cols-3 gap-4">
                        {selectedMetrics.slice(0, 6).map((metricKey, index) => {
                          const metric = availableMetrics.find(m => m.key === metricKey);
                          if (!metric || !metric.icon || !ad.metrics) return null;
                          const getMetricValue = (key: string) => {
                            const value = (ad.metrics as any)[key];
                            if (typeof value === 'undefined' || value === null) return '---';
                            switch (key) {
                              case 'ctr':
                              case 'conversion_rate':
                                return `${value.toFixed(2)}%`;
                              case 'cpc':
                              case 'cpm':
                              case 'cpp':
                              case 'spend':
                              case 'cost_per_result':
                                return formatCurrency(value);
                              case 'roas':
                                return `${value.toFixed(1)}x`;
                              case 'frequency':
                                return value.toFixed(2);
                              case 'actions':
                                return Array.isArray(value) ? value.length : value;
                              default:
                                return formatNumber(value);
                            }
                          };
                          const IconComponent = metric.icon;
                          return <div key={metricKey} className="bg-card border border-border rounded-lg p-4 relative hover:shadow-md transition-shadow">
                            <div className="absolute top-3 right-3">
                              <IconComponent className="w-5 h-5 text-primary opacity-70" />
                            </div>
                            <div className="space-y-1">
                              <p className="text-xs text-muted-foreground font-medium">{metric.label}</p>
                              <p className="text-2xl font-extrabold text-primary font-brand">{getMetricValue(metricKey)}</p>
                            </div>
                          </div>;
                        })}
                      </div>
                    </div>}
                  </div>
                </div>

                {/* Análise IA - Full Width Section */}
                <div className="mt-6 rounded-lg p-6 bg-card">
                  <h4 className="font-semibold mb-4 text-xl text-foreground flex items-center gap-2">
                    <Brain className="w-6 h-6 text-primary" />
                    Análise Inteligente
                  </h4>

                  {!analysisResults[ad.id] && <div className="space-y-4">
                    <div className="text-center py-12">
                      <Brain className="w-20 h-20 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground mb-6 text-lg">
                        Este criativo ainda não foi analisado pela IA
                      </p>
                    </div>
                    <Button onClick={() => analyzeCreative(ad)} disabled={analyzingAd === ad.id} className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 py-4">
                      {analyzingAd === ad.id ? <div className="flex flex-col items-center gap-3 w-full py-3 animate-in fade-in duration-300">
                        <div className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-blue-600 backdrop-blur-sm px-4 py-2 rounded-lg border border-white/20 shadow-lg transition-all duration-300">
                          {analysisLoadingStatus.phase === 'fetching-material' && <Search className="w-4 h-4 animate-pulse text-white/90 drop-shadow-lg transition-transform duration-300" />}
                          {analysisLoadingStatus.phase === 'preparing-context' && <Settings className="w-4 h-4 animate-spin text-white/90 drop-shadow-lg transition-transform duration-300" />}
                          {analysisLoadingStatus.phase === 'ai-analyzing' && <Brain className="w-4 h-4 animate-pulse text-white/90 drop-shadow-lg transition-transform duration-300" />}
                          {analysisLoadingStatus.phase === 'ai-correlating' && <TrendingUp className="w-4 h-4 animate-pulse text-white/90 drop-shadow-lg transition-transform duration-300" />}
                          {analysisLoadingStatus.phase === 'generating-insights' && <Sparkles className="w-4 h-4 animate-pulse text-white/90 drop-shadow-lg transition-transform duration-300" />}
                          {analysisLoadingStatus.phase === 'finalizing' && <CheckCircle className="w-4 h-4 animate-pulse text-white/90 drop-shadow-lg transition-transform duration-300" />}
                          <span className="font-semibold text-white text-sm drop-shadow-lg">
                            {analysisLoadingStatus.message}
                          </span>
                        </div>

                        <div className="w-full px-2">
                          <Progress value={analysisLoadingStatus.progress} className="h-1.5 w-full bg-white/20 transition-all duration-300" />
                        </div>

                        <span className="text-xs text-white/90 font-medium px-3 py-1 text-center bg-white/10 backdrop-blur-md rounded-full border border-white/20 transition-all duration-300">
                          {analysisLoadingStatus.description}
                        </span>
                      </div> : <>
                        <Brain className="w-5 h-5 mr-2" />
                        Gerar análise com IA
                      </>}
                    </Button>
                  </div>}

                  {analysisResults[ad.id] && <div className="space-y-6">
                    {/* Grid responsivo para os dois cards de análise */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {/* Análise de Performance */}
                      <AnalysisDisplay analysis={analysisResults[ad.id].performance} compact />

                      {/* Análise de Tendências (se disponível) */}
                      {analysisResults[ad.id].marketTrends && (
                        <div className="space-y-4">
                          {/* Aviso se análise for apenas textual */}
                          {analysisResults[ad.id].marketTrends.includes('ANÁLISE BASEADA APENAS') && (
                            <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                              <div className="flex items-center gap-2">
                                <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                                <p className="text-xs text-amber-800 dark:text-amber-300 font-medium">
                                  Análise baseada apenas em dados textuais
                                </p>
                              </div>
                            </div>
                          )}
                          <AnalysisDisplay analysis={analysisResults[ad.id].marketTrends} compact />
                        </div>
                      )}
                    </div>

                    <div className="mb-4">
                      <Select value={selectedProject || ''} onValueChange={setSelectedProject}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione um projeto para salvar os briefings" />
                        </SelectTrigger>
                        <SelectContent>
                          {projects.map(project => (
                            <SelectItem key={project.id} value={project.id}>
                              {project.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex gap-3 pt-4 border-t border-border justify-center">
                      <FloatingActionMenu
                        isOpen={trendMenuOpen === ad.id}
                        onToggle={(isOpen) => setTrendMenuOpen(isOpen ? ad.id : null)}
                        triggerButton={
                          <Button
                            variant="outline"
                            className="border-primary/30 hover:bg-primary/10 hover:border-primary/50 transition-all relative group flex-1"
                            disabled={generatingBriefing === ad.id || !selectedProject}
                          >
                            {generatingBriefing === ad.id ? (
                              <>
                                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                Criando...
                              </>
                            ) : (
                              <>
                                <TrendingUp className="w-5 h-5 mr-2 text-primary group-hover:scale-110 transition-transform" />
                                Criar com base nas tendências do mercado
                              </>
                            )}
                          </Button>
                        }
                        options={[
                          {
                            label: "Imagem estática",
                            Icon: <ImageIcon className="w-4 h-4" />,
                            onClick: () => handleGenerateStaticWithTrends(ad)
                          },
                          {
                            label: "Carrossel",
                            Icon: <LayoutGrid className="w-4 h-4" />,
                            onClick: () => handleGenerateCarouselWithTrends(ad)
                          },
                          {
                            label: "Vídeo",
                            Icon: <Video className="w-4 h-4" />,
                            onClick: () => handleGenerateVideoWithTrends(ad)
                          }
                        ]}
                      />
                      <FloatingActionMenu
                        isOpen={formatMenuOpen === ad.id}
                        onToggle={(isOpen) => setFormatMenuOpen(isOpen ? ad.id : null)}
                        triggerButton={
                          <Button
                            variant="outline"
                            className="border-primary/30 hover:bg-primary/10 hover:border-primary/50 transition-all relative group"
                            disabled={analyzingAd === ad.id}
                          >
                            <Brain className="w-5 h-5 mr-2 text-primary group-hover:scale-110 transition-transform" />
                            Criar em um novo formato
                          </Button>
                        }
                        options={(() => {
                          const isVideo = !!ad.video_url;
                          const isCarousel = (ad.carousel_child_count || 0) > 1;
                          const isStaticImage = !!ad.image_url && !isVideo;

                          const handleTransformCreative = async (targetFormat: 'carousel' | 'static' | 'video') => {
                            if (!selectedProject) {
                              toast({
                                title: "Selecione um projeto",
                                description: "Você precisa selecionar um projeto antes de transformar o criativo",
                                variant: "destructive"
                              });
                              return;
                            }

                            setIsTransforming(true);

                            try {
                              const brandName = accounts.find(a => a.account_id === selectedAccount)?.name || '';
                              const creativeUrl = await getCreativeUrl(ad);

                              // Map format to Webhook expected format
                              let webhookFormat = 'feed';
                              if (targetFormat === 'video') webhookFormat = 'reels';
                              if (targetFormat === 'carousel') webhookFormat = 'carousel';
                              if (targetFormat === 'static') webhookFormat = 'feed';

                              const payload = {
                                criativo_analisado_url: creativeUrl,
                                creative_analyzed_public_url: creativeUrl,
                                market_trends: null, // "Se for 'Novo formato', envie null"
                                legenda: materialCaption[ad.id] || ad.ad_copy || '',
                                target_format: webhookFormat,
                                creative_id: ad.creative_id,
                                brand_name: brandName,
                                creative_url: creativeUrl,
                                creative_caption: materialCaption[ad.id] || ad.ad_copy || ''
                              };

                              // Criar material pendente e redirecionar imediatamente
                              const material = await createPendingMaterial(payload, selectedProject, ad, webhookFormat);

                              toast({
                                title: "Iniciando transformação...",
                                description: "Você será redirecionado para acompanhar o progresso."
                              });

                              // Redirecionar para o editor do novo briefing
                              navigate(`/briefing-editor/${material.id}`);
                            } catch (error: any) {
                              console.error('Erro ao iniciar transformação:', error);
                              toast({
                                title: "Erro ao iniciar transformação",
                                description: error.message || error.error || "Erro desconhecido",
                                variant: "destructive"
                              });
                              setIsTransforming(false);
                            }
                          };

                          if (isVideo) {
                            return [
                              {
                                label: "Imagem estática",
                                Icon: <ImageIcon className="w-4 h-4" />,
                                onClick: () => handleTransformCreative('static')
                              },
                              {
                                label: "Carrossel",
                                Icon: <LayoutGrid className="w-4 h-4" />,
                                onClick: () => handleTransformCreative('carousel')
                              }
                            ];
                          } else if (isCarousel) {
                            return [
                              {
                                label: "Imagem estática",
                                Icon: <ImageIcon className="w-4 h-4" />,
                                onClick: () => handleTransformCreative('static')
                              },
                              {
                                label: "Vídeo",
                                Icon: <Video className="w-4 h-4" />,
                                onClick: () => handleTransformCreative('video')
                              }
                            ];
                          } else {
                            return [
                              {
                                label: "Vídeo",
                                Icon: <Video className="w-4 h-4" />,
                                onClick: () => handleTransformCreative('video')
                              },
                              {
                                label: "Carrossel",
                                Icon: <LayoutGrid className="w-4 h-4" />,
                                onClick: () => handleTransformCreative('carousel')
                              }
                            ];
                          }
                        })()}
                      />
                    </div>
                  </div>}
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Basic Info */}
        <CardContent className="p-3 space-y-2">
          <div className="flex justify-between items-start gap-2">
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold text-sm leading-tight line-clamp-2 group-hover:text-primary transition-colors">
                {ad.ad_name}
              </h3>
              <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                {ad.campaign_name}
              </p>
            </div>
          </div>

          {/* Performance Metrics */}
          <div className="grid grid-cols-3 gap-2">
            {(() => {
              const currentObjective = OBJECTIVE_CONFIGS[objective];
              const metricsToShow = currentObjective?.metrics || ['ctr', 'roas', 'clicks', 'cpc', 'impressions', 'spend'];
              const getVal = (key: string) => {
                const m: any = (ad as any).metrics || {};
                return Number(m?.[key] ?? (ad as any)[key] ?? 0);
              };
              const formatMetricValue = (value: number, metric: string) => {
                if (value === 0) return '0';
                if (metric.includes('rate') || metric === 'ctr') {
                  return `${value.toFixed(2)}%`;
                }
                if (metric === 'roas') {
                  return `${value.toFixed(1)}x`;
                }
                if (metric === 'frequency') {
                  return value.toFixed(2);
                }
                if (metric.includes('cost') || metric.includes('cpc') || metric.includes('cpa') || metric.includes('cpm') || metric === 'spend') {
                  return formatCurrency(value);
                }
                if (value >= 1000000) {
                  return `${(value / 1000000).toFixed(1)}M`;
                }
                if (value >= 1000) {
                  return `${(value / 1000).toFixed(1)}K`;
                }
                return value.toFixed(0);
              };
              const colorClasses = [{
                bg: 'bg-gradient-to-br from-blue-50 to-blue-100 dark:from-slate-800 dark:to-slate-900',
                border: 'border-blue-200/50 dark:border-blue-400/30',
                text: 'text-blue-700 dark:text-blue-300',
                textSecondary: 'text-blue-600 dark:text-blue-200'
              }, {
                bg: 'bg-gradient-to-br from-green-50 to-green-100 dark:from-slate-800 dark:to-slate-900',
                border: 'border-green-200/50 dark:border-green-400/30',
                text: 'text-green-700 dark:text-green-300',
                textSecondary: 'text-green-600 dark:text-green-200'
              }, {
                bg: 'bg-gradient-to-br from-purple-50 to-purple-100 dark:from-slate-800 dark:to-slate-900',
                border: 'border-purple-200/50 dark:border-purple-400/30',
                text: 'text-purple-700 dark:text-purple-300',
                textSecondary: 'text-purple-600 dark:text-purple-200'
              }, {
                bg: 'bg-gradient-to-br from-orange-50 to-orange-100 dark:from-slate-800 dark:to-slate-900',
                border: 'border-orange-200/50 dark:border-orange-400/30',
                text: 'text-orange-700 dark:text-orange-300',
                textSecondary: 'text-orange-600 dark:text-orange-200'
              }, {
                bg: 'bg-gradient-to-br from-red-50 to-red-100 dark:from-slate-800 dark:to-slate-900',
                border: 'border-red-200/50 dark:border-red-400/30',
                text: 'text-red-700 dark:text-red-300',
                textSecondary: 'text-red-600 dark:text-red-200'
              }, {
                bg: 'bg-gradient-to-br from-cyan-50 to-cyan-100 dark:from-slate-800 dark:to-slate-900',
                border: 'border-cyan-200/50 dark:border-cyan-400/30',
                text: 'text-cyan-700 dark:text-cyan-300',
                textSecondary: 'text-cyan-600 dark:text-cyan-200'
              }];
              return metricsToShow.slice(0, 6).map((metric, index) => {
                const value = getVal(metric);
                const label = METRIC_LABELS[metric] || metric;
                const colorClass = colorClasses[index % colorClasses.length];
                return <div key={metric} className={`text-center p-2 bg-purple-50 dark:bg-purple-950/80 rounded-lg border border-purple-200 dark:border-purple-800/50`}>
                  <div className={`text-sm font-bold text-purple-800 dark:text-purple-300`}>
                    <span className="text-purple-900 dark:text-purple-200 dark:drop-shadow-[0_0_3px_rgba(196,181,253,0.8)]">{formatMetricValue(value, metric)}</span>
                  </div>
                  <div className={`text-xs text-purple-700 dark:text-purple-400`}>
                    <span className="text-purple-600 dark:text-purple-300 dark:drop-shadow-[0_0_2px_rgba(196,181,253,0.6)]">{label}</span>
                  </div>
                </div>;
              });
            })()}
          </div>
        </CardContent>
      </Card>)}

      {/* Project Selection Modal */}
      <Dialog open={!!projectSelectionOpen} onOpenChange={open => !open && setProjectSelectionOpen(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Selecionar Projeto</DialogTitle>
            <DialogDescription>
              Escolha um projeto para criar o novo briefing ou crie um novo projeto.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Select onValueChange={value => {
                if (projectSelectionOpen) {
                  const ad = ads.find(a => a.id === projectSelectionOpen);
                  if (ad) {
                    generateNewVersion(ad, value);
                  }
                }
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um projeto existente" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map(project => <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="text-center">
              <span className="text-sm text-muted-foreground">ou</span>
            </div>

            <Button variant="outline" className="w-full" onClick={() => {
              setProjectSelectionOpen(null);
              setCreateProjectOpen(true);
            }}>
              <Plus className="w-4 h-4 mr-2" />
              Criar novo projeto
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Project Modal */}
      <CreateProjectModal open={createProjectOpen} onOpenChange={setCreateProjectOpen} onProjectCreated={() => {
        setCreateProjectOpen(false);
        loadProjects();
      }} />

      {/* Carousel Slides Selection Dialog */}
      <Dialog open={carouselDialogOpen} onOpenChange={setCarouselDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Quantos slides para o carrossel?</DialogTitle>
            <DialogDescription>
              Selecione o número de slides que deseja gerar para o carrossel
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
            {[3, 4, 5, 6].map((count) => (
              <Button
                key={count}
                variant="outline"
                className="h-20 text-lg hover:bg-primary hover:text-primary-foreground transition-all"
                onClick={async () => {
                  setCarouselDialogOpen(false);
                  if (pendingTransformAd && selectedProject) {
                    setIsTransforming(true);
                    toast({
                      title: "Gerando carrossel...",
                      description: `Criando ${count} slides. Isso pode levar alguns minutos.`
                    });

                    try {
                      const sourceFormat = pendingTransformAd.video_url ? 'video' : (pendingTransformAd.carousel_child_count || 0) > 1 ? 'carousel' : 'static';

                      const { data, error } = await supabase.functions.invoke('transform-creative', {
                        body: {
                          adId: pendingTransformAd.ad_id,
                          accountId: selectedAccount,
                          targetFormat: 'carousel' as const,
                          sourceFormat,
                          projectId: selectedProject,
                          carouselSlides: count,
                          adData: {
                            ad_name: pendingTransformAd.ad_name,
                            ad_copy: pendingTransformAd.ad_copy,
                            message: pendingTransformAd.message,
                            call_to_action: pendingTransformAd.call_to_action,
                            headline: pendingTransformAd.headline,
                            link_url: pendingTransformAd.link_url,
                            image_url: pendingTransformAd.image_url,
                            video_url: pendingTransformAd.video_url
                          }
                        }
                      });

                      if (error) throw error;

                      toast({
                        title: "Carrossel criado!",
                        description: data.message || "Carrossel criado com sucesso!",
                      });

                      if (data.materialId) {
                        navigate(`/briefing-editor/${data.materialId}`);
                      }
                    } catch (error: any) {
                      console.error('Transform error:', error);
                      toast({
                        title: "Erro ao criar carrossel",
                        description: error.message || "Tente novamente",
                        variant: "destructive"
                      });
                    } finally {
                      setIsTransforming(false);
                      setPendingTransformAd(null);
                    }
                  }
                }}
              >
                <LayoutGrid className="w-6 h-6 mr-2" />
                {count} slides
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  </TooltipProvider>;
};