import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { 
  ArrowLeft, 
  TrendingUp, 
  Eye, 
  MousePointer, 
  DollarSign, 
  Target,
  BarChart3,
  Lightbulb,
  Palette,
  FileText
} from 'lucide-react';
import { SafeErrorBoundary } from '@/components/SafeErrorBoundary';
import { AnalysisDisplay } from '@/components/AnalysisDisplay';

interface AdDetail {
  ad_id: string;
  ad_name: string;
  account_id: string;
  status: string;
  taxonomy_status: string;
  campaign_name: string;
  material?: {
    caption?: string;
    copy?: string;
    name?: string;
  };
  metrics: {
    impressions: number;
    clicks: number;
    ctr: number;
    cpc: number;
    spend: number;
    conversions: number;
    conversion_rate: number;
    roas: number;
    reach: number;
    frequency: number;
  };
  performance_insights?: any;
  visual_analysis?: any;
  recommendations?: any;
}

interface Analysis {
  visual_analysis?: any;
  metrics_analysis?: any;
  recommendations?: any;
  performance_insights?: any;
}

const CreativeDetail = () => {
  const { adId } = useParams<{ adId: string }>();
  const { toast } = useToast();
  const [ad, setAd] = useState<AdDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);

  const formatAnalysisForDisplay = (analysis: Analysis): string => {
    let text = '';
    
    if (analysis.visual_analysis) {
      text += typeof analysis.visual_analysis === 'string' 
        ? analysis.visual_analysis 
        : JSON.stringify(analysis.visual_analysis, null, 2);
    }
    
    if (analysis.performance_insights) {
      text += '\n\n## Insights de Performance\n';
      text += typeof analysis.performance_insights === 'string'
        ? analysis.performance_insights
        : JSON.stringify(analysis.performance_insights, null, 2);
    }
    
    if (analysis.recommendations) {
      text += '\n\n## Recomendações\n';
      text += typeof analysis.recommendations === 'string'
        ? analysis.recommendations
        : JSON.stringify(analysis.recommendations, null, 2);
    }
    
    return text;
  };

  const loadAdDetails = async () => {
    try {
      setLoading(true);

      // Load ad details from ai_creative_analysis table
      const { data: adData, error: adError } = await supabase
        .from('ai_creative_analysis')
        .select('*')
        .eq('ad_id', adId)
        .maybeSingle();

      if (adError) throw adError;
      
      if (!adData) {
        // Se não encontrou na análise, criar um placeholder
        const processedAd: AdDetail = {
          ad_id: adId || '',
          ad_name: `Criativo ${adId}`,
          account_id: '',
          status: 'active',
          taxonomy_status: 'pending',
          campaign_name: 'Campaign Name',
          material: {
            caption: '',
            copy: '',
            name: ''
          },
          metrics: {
            impressions: 0,
            clicks: 0,
            ctr: 0,
            cpc: 0,
            spend: 0,
            conversions: 0,
            conversion_rate: 0,
            roas: 0,
            reach: 0,
            frequency: 0
          }
        };
        setAd(processedAd);
        setLoading(false);
        return;
      }

      // Buscar Material vinculado se existir material_id
      let materialData: { caption?: string; copy?: string; name?: string } | null = null;

      if (adData.material_id) {
        const { data: byId } = await supabase
          .from('materials')
          .select('caption, copy, name')
          .eq('id', adData.material_id)
          .maybeSingle();
        materialData = byId;
      }

      const processedAd: AdDetail = {
        ad_id: adData.ad_id,
        ad_name: `Criativo ${adData.ad_id}`,
        account_id: adData.account_id,
        status: 'active',
        taxonomy_status: 'pending',
        campaign_name: 'Campaign Name',
        material: materialData ? {
          caption: materialData.caption || '',
          copy: materialData.copy || '',
          name: materialData.name || ''
        } : {
          caption: '',
          copy: '',
          name: ''
        },
        metrics: {
          impressions: 1250000,
          clicks: 12500,
          ctr: 1.2,
          cpc: 0.85,
          spend: 10625.50,
          conversions: 425,
          conversion_rate: 3.4,
          roas: 4.2,
          reach: 980000,
          frequency: 1.3
        },
        performance_insights: adData.performance_insights || null,
        visual_analysis: adData.visual_analysis || null,
        recommendations: adData.recommendations || null
      };

      setAd(processedAd);

      // Set analysis from existing data
      if (adData.performance_insights || adData.visual_analysis || adData.recommendations) {
        setAnalysis({
          performance_insights: adData.performance_insights,
          visual_analysis: adData.visual_analysis,
          recommendations: adData.recommendations,
          metrics_analysis: adData.metrics_analysis
        });
      }

    } catch (error) {
      console.error('Error loading ad detail:', error);
      toast({
        title: "Erro",
        description: "Falha ao carregar detalhes do anúncio",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (adId) {
      loadAdDetails();
    }
  }, [adId]);

  if (loading) {
    return (
      <SafeErrorBoundary>
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </SafeErrorBoundary>
    );
  }

  if (!ad) {
    return (
      <SafeErrorBoundary>
        <div className="container mx-auto py-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Anúncio não encontrado</h1>
            <p className="text-gray-600 mb-8">O anúncio solicitado não foi encontrado.</p>
            <Button 
              onClick={() => window.history.back()}
              variant="outline"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar
            </Button>
          </div>
        </div>
      </SafeErrorBoundary>
    );
  }

  return (
    <SafeErrorBoundary>
      <div className="w-full max-w-7xl mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button 
              onClick={() => window.history.back()}
              variant="outline"
              size="sm"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{ad.ad_name}</h1>
              <p className="text-gray-600">ID: {ad.ad_id}</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Badge variant={ad.status === 'active' ? 'default' : 'secondary'}>
              {ad.status}
            </Badge>
            <Badge variant="outline">
              {ad.taxonomy_status}
            </Badge>
          </div>
        </div>

        {/* Metrics Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Eye className="h-4 w-4 text-blue-500" />
                <div>
                  <p className="text-xs text-gray-600">Impressões</p>
                  <p className="text-lg font-semibold">{ad.metrics.impressions.toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <MousePointer className="h-4 w-4 text-green-500" />
                <div>
                  <p className="text-xs text-gray-600">Cliques</p>
                  <p className="text-lg font-semibold">{ad.metrics.clicks.toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <TrendingUp className="h-4 w-4 text-purple-500" />
                <div>
                  <p className="text-xs text-gray-600">CTR</p>
                  <p className="text-lg font-semibold">{ad.metrics.ctr}%</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <DollarSign className="h-4 w-4 text-red-500" />
                <div>
                  <p className="text-xs text-gray-600">Gasto</p>
                  <p className="text-lg font-semibold">R$ {ad.metrics.spend.toFixed(2)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Target className="h-4 w-4 text-orange-500" />
                <div>
                  <p className="text-xs text-gray-600">ROAS</p>
                  <p className="text-lg font-semibold">{ad.metrics.roas.toFixed(1)}x</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

      {/* Desktop: Seção de Material Compacta */}
      <Card className="hidden md:block">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Informações do Material
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {ad.material?.name && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">Nome</label>
                <p className="mt-1 text-sm">{ad.material.name}</p>
              </div>
            )}
            {ad.material?.caption && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">Caption</label>
                <p className="mt-1 text-sm line-clamp-2">{ad.material.caption}</p>
              </div>
            )}
            {ad.material?.copy && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">Copy</label>
                <p className="mt-1 text-sm line-clamp-2">{ad.material.copy}</p>
              </div>
            )}
          </div>
          {!ad.material?.name && !ad.material?.caption && !ad.material?.copy && (
            <p className="text-muted-foreground text-center py-4">
              Nenhum material associado encontrado.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Desktop: Seção de Análise IA - Largura Completa */}
      <div className="hidden md:block w-full">
        {analysis ? (
          <AnalysisDisplay analysis={formatAnalysisForDisplay(analysis)} />
        ) : (
          <Card>
            <CardContent className="text-center py-8">
              <p className="text-muted-foreground">
                Nenhuma análise de IA disponível para este criativo.
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Mobile/Tablet: Tabs */}
      <Tabs defaultValue="material" className="md:hidden">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="material">Material</TabsTrigger>
          <TabsTrigger value="analysis">Análise IA</TabsTrigger>
        </TabsList>

        <TabsContent value="material" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Informações do Material</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {ad.material?.name && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Nome</label>
                  <p className="mt-1 text-sm">{ad.material.name}</p>
                </div>
              )}
              
              {ad.material?.caption && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Caption</label>
                  <p className="mt-1 text-sm">{ad.material.caption}</p>
                </div>
              )}
              
              {ad.material?.copy && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Copy</label>
                  <p className="mt-1 text-sm">{ad.material.copy}</p>
                </div>
              )}

              {!ad.material?.name && !ad.material?.caption && !ad.material?.copy && (
                <p className="text-muted-foreground text-center py-8">
                  Nenhum material associado encontrado.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analysis" className="space-y-4 -mx-4 px-4 max-w-full">
          <div className="w-full max-w-none">
            {analysis ? (
              <AnalysisDisplay analysis={formatAnalysisForDisplay(analysis)} />
            ) : (
              <Card>
                <CardContent className="text-center py-8">
                  <p className="text-muted-foreground">
                    Nenhuma análise de IA disponível para este criativo.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>
      </div>
    </SafeErrorBoundary>
  );
};

export default CreativeDetail;