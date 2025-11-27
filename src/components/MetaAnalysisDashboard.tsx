import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMetaAdsDirect } from "@/contexts/MetaAdsDirectContext";
import { MetaAdsDashboard } from "@/components/MetaAdsDashboard";
import { TopCreativesList } from "@/components/TopCreativesList";
import { ProgressLoader } from "@/components/ProgressLoader";
import { CompetitorSearchProgress } from "@/components/CompetitorSearchProgress";
import { toast } from "sonner";

interface MetaAd {
  id: string;
  ad_id: string;
  ad_name: string;
  status: string;
  campaign_id: string;
  campaign_name: string;
  campaign_objective: string;
  adset_id: string | null;
  adset_name: string | null;
  creative_id: string | null;
  image_url: string | null;
  video_url: string | null;
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
    cpm: number;
    cpp: number;
  };
}
import { MetaAdsDirectFilterPanel } from "@/components/MetaAdsDirectFilterPanel";
import { CreativeDetailOverlay } from "@/components/CreativeDetailOverlay";
import { RefreshCw, Download, Grid, List } from "lucide-react";

export const MetaAnalysisDashboard: React.FC = () => {
  console.log('🎯 MetaAnalysisDashboard rendering...');
  const { adsData, loadingAds, loadingStatus, fetchData, loadingCompetitors, competitorSearchPhase, competitorKeyword } = useMetaAdsDirect();
  console.log('🎯 MetaAnalysisDashboard state:', { adsDataExists: !!adsData, loadingAds });
  const [primaryMetric, setPrimaryMetric] = useState('ctr');
  const [secondaryMetric, setSecondaryMetric] = useState('roas');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortMetric, setSortMetric] = useState('ctr');
  const [selectedCreative, setSelectedCreative] = useState<any>(null);

  // Add effect to log state changes
  useEffect(() => {
    console.log('🎯 Dashboard state changed:', { adsData: !!adsData, loadingAds });
  }, [adsData, loadingAds]);

  const handleExport = (format: 'csv' | 'json' | 'excel') => {
    if (!adsData?.top_creatives) return;

    const data = adsData.top_creatives.map(ad => ({
      campanha: ad.campaign_name,
      nome_anuncio: ad.ad_name,
      ctr: ad.metrics.ctr.toFixed(2),
      cpc: ad.metrics.cpc.toFixed(2),
      impressoes: ad.metrics.impressions,
      cliques: ad.metrics.clicks,
      resultados: ad.metrics.conversions,
      investimento: ad.metrics.spend.toFixed(2),
      cpr: ad.metrics.conversions > 0 ? (ad.metrics.spend / ad.metrics.conversions).toFixed(2) : '0.00',
      roas: ad.metrics.roas.toFixed(2),
      alcance: ad.metrics.reach,
      frequencia: ad.metrics.frequency.toFixed(1)
    }));

    const filename = `meta-creatives-${new Date().toISOString().split('T')[0]}`;
    
    if (format === 'csv') {
      const headers = Object.keys(data[0]).join(',');
      const rows = data.map(row => Object.values(row).join(','));
      const csv = [headers, ...rows].join('\n');
      
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${filename}.csv`;
      a.click();
    } else if (format === 'json') {
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${filename}.json`;
      a.click();
    } else if (format === 'excel') {
      // TSV format (simpler Excel-compatible format)
      const headers = Object.keys(data[0]).join('\t');
      const rows = data.map(row => Object.values(row).join('\t'));
      const tsv = [headers, ...rows].join('\n');
      
      const blob = new Blob([tsv], { type: 'text/tab-separated-values' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${filename}.xlsx`;
      a.click();
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with actions */}
      <div className="flex items-center justify-between">
      <div>
        <h2 className="text-2xl font-bold">Dashboard</h2>
      </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={fetchData}
            disabled={loadingAds}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loadingAds ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          <Select onValueChange={(value) => handleExport(value as any)}>
            <SelectTrigger className="w-32">
              <Download className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Export" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="csv">CSV</SelectItem>
              <SelectItem value="json">JSON</SelectItem>
              <SelectItem value="excel">Excel</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Filter Panel */}
      <MetaAdsDirectFilterPanel />

      {/* Competitor Search Progress */}
      {loadingCompetitors && competitorSearchPhase === 'searching' && competitorKeyword && (
        <CompetitorSearchProgress 
          keyword={competitorKeyword}
          onComplete={(count) => {
            console.log(`✅ Competitor search completed with ${count} ads`);
            toast.success(`${count} anúncios competitivos carregados!`);
          }}
          onError={(error) => {
            console.error('❌ Competitor search error:', error);
            toast.error(error);
          }}
        />
      )}

      {/* Dashboard Metrics */}
      <MetaAdsDashboard 
        metrics={adsData?.summary || null} 
        loading={loadingAds}
      />

      {/* Show loading state if no data */}
      {loadingAds && !adsData && loadingStatus.phase !== 'idle' && (
        <Card>
          <CardContent className="py-8">
            <ProgressLoader status={loadingStatus} />
          </CardContent>
        </Card>
      )}

      {/* Show empty state if no data after loading */}
      {!loadingAds && !adsData && (
        <div className="flex items-center justify-center py-16">
          <div className="text-center">
            <h3 className="text-lg font-semibold mb-2">Nenhum dado carregado</h3>
            <p className="text-muted-foreground mb-4">
              Selecione uma conta e aplique os filtros para visualizar os dados
            </p>
          </div>
        </div>
      )}

      {/* Top Creatives Section */}
      {adsData && (
        <Card className="border-0">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Top Criativos</CardTitle>
              <div className="flex items-center gap-2">
                <Select value={sortMetric} onValueChange={setSortMetric}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ctr">CTR</SelectItem>
                    <SelectItem value="clicks">Cliques</SelectItem>
                    <SelectItem value="impressions">Impressões</SelectItem>
                    <SelectItem value="conversions">Resultados</SelectItem>
                    <SelectItem value="spend">Investimento</SelectItem>
                    <SelectItem value="roas">ROAS</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
                >
                  {viewMode === 'grid' ? <List className="h-4 w-4" /> : <Grid className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <TopCreativesList
              ads={adsData.top_creatives.sort((a, b) => 
                (b.metrics[sortMetric as keyof typeof b.metrics] || 0) - 
                (a.metrics[sortMetric as keyof typeof a.metrics] || 0)
              )}
              primaryMetric={primaryMetric}
              secondaryMetric={secondaryMetric}
              onMetricChange={(primary, secondary) => {
                setPrimaryMetric(primary);
                setSecondaryMetric(secondary);
              }}
              onViewDetails={setSelectedCreative}
            />
          </CardContent>
        </Card>
      )}

      {/* Creative Detail Overlay */}
      {selectedCreative && (
        <CreativeDetailOverlay
          creative={selectedCreative}
          isOpen={!!selectedCreative}
          onClose={() => setSelectedCreative(null)}
        />
      )}
    </div>
  );
};