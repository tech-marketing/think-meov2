import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CreativeDisplay } from "@/components/CreativeDisplay";
import { Button } from "@/components/ui/button";
import { Trophy, Award, Target } from "lucide-react";

interface CreativeComparisonOverlayProps {
  creatives: any[];
  compareBy: string;
  isOpen: boolean;
  onClose: () => void;
}

export const CreativeComparisonOverlay: React.FC<CreativeComparisonOverlayProps> = ({
  creatives,
  compareBy,
  isOpen,
  onClose
}) => {
  if (creatives.length < 2) {
    return null;
  }

  // Determine best and worst based on metric
  const getMetricValue = (creative: any, metric: string) => {
    return creative.metrics[metric] || 0;
  };

  // For metrics where lower is better (CPC, CPA)
  const isLowerBetter = ['cpc', 'cpa'].includes(compareBy);
  
  const sortedCreatives = [...creatives].sort((a, b) => {
    const aValue = getMetricValue(a, compareBy);
    const bValue = getMetricValue(b, compareBy);
    return isLowerBetter ? aValue - bValue : bValue - aValue;
  });

  const bestCreative = sortedCreatives[0];
  const worstCreative = sortedCreatives[sortedCreatives.length - 1];

  const formatMetricValue = (value: number, metric: string) => {
    switch (metric) {
      case 'ctr':
      case 'conversion_rate':
        return `${value.toFixed(2)}%`;
      case 'cpc':
      case 'spend':
        return `$${value.toFixed(2)}`;
      case 'roas':
        return value.toFixed(2);
      default:
        return value.toLocaleString();
    }
  };

  const getMetricLabel = (metric: string) => {
    const labels: Record<string, string> = {
      ctr: 'CTR',
      cpc: 'CPC',
      conversions: 'Resultados',
      roas: 'ROAS',
      spend: 'Investimento',
      clicks: 'Cliques',
      impressions: 'Impressões'
    };
    return labels[metric] || metric;
  };

  const getPerformanceSummary = (creative: any) => {
    const cpc = creative.metrics.cpc || 0;
    const ctr = creative.metrics.ctr || 0;
    const roas = creative.metrics.roas || 0;
    
    return {
      cpcStatus: cpc < 1 ? 'good' : 'poor',
      ctrStatus: ctr > 2 ? 'good' : 'poor',
      roasStatus: roas > 3 ? 'good' : 'poor'
    };
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">
            Comparação Detalhada - {getMetricLabel(compareBy)}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Creative Cards Grid */}
          <div className={`grid gap-6 ${
            creatives.length === 2 ? 'grid-cols-2' : 
            creatives.length === 3 ? 'grid-cols-3' : 'grid-cols-1'
          }`}>
            {creatives.map((creative, index) => {
              const isBest = creative.ad_id === bestCreative?.ad_id;
              const isWorst = creative.ad_id === worstCreative?.ad_id;
              
              return (
                <Card 
                  key={creative.ad_id} 
                  className={`relative overflow-hidden transition-all duration-300 ${
                    isBest ? 'ring-2 ring-green-500 bg-green-500/5' :
                    isWorst ? 'ring-2 ring-red-500 bg-red-500/5' : 
                    'ring-1 ring-border'
                  }`}
                >
                  {/* Best/Worst Badge */}
                  {(isBest || isWorst) && (
                    <div className={`absolute top-4 right-4 z-10 px-3 py-1 rounded-full text-xs font-bold animate-pulse ${
                      isBest ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
                    }`}>
                      {isBest ? 'Melhor Performance' : 'Pior Performance'}
                    </div>
                  )}

                  <CardContent className="p-6 space-y-4">
                    {/* Creative Info */}
                    <div>
                      <h3 className="font-bold text-lg mb-2 line-clamp-2">{creative.ad_name}</h3>
                      <p className="text-sm text-muted-foreground">{creative.campaign_name}</p>
                    </div>

                    {/* Media */}
                    <div className="aspect-square bg-gradient-to-br from-muted to-muted/50 rounded-xl overflow-hidden border-2 border-border/50 shadow-inner">
                      <CreativeDisplay 
                        adName={creative.ad_name}
                        imageUrl={creative.image_url}
                        videoUrl={creative.video_url}
                        localMaterialId={creative.local_material_id}
                        className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                      />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Comparison Table */}
          <Card className="overflow-hidden">
            <CardHeader className="pb-4">
              <CardTitle className="text-xl">Comparação Detalhada</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left p-4 font-medium text-muted-foreground bg-muted/30">
                        Métrica
                      </th>
                      {creatives.map((creative, index) => (
                        <th key={creative.ad_id} className="text-center p-4 font-medium bg-muted/10">
                          {creative.ad_name.length > 30 ? 
                            creative.ad_name.substring(0, 30) + '...' : 
                            creative.ad_name
                          }
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { key: 'ctr', label: 'CTR', format: (val: number) => `${val.toFixed(2)}%` },
                      { key: 'cpc', label: 'CPC', format: (val: number) => `R$ ${val.toFixed(2)}` },
                      { key: 'clicks', label: 'Cliques', format: (val: number) => val.toLocaleString() },
                      { key: 'impressions', label: 'Impressões', format: (val: number) => val.toLocaleString() },
                      { key: 'results', label: 'Resultados', format: (val: number) => val.toString() },
                      { key: 'cpr', label: 'CPR', format: (val: number) => `R$ ${val.toFixed(2)}` },
                      { key: 'spend', label: 'Investimento', format: (val: number) => `R$ ${val.toFixed(2)}` },
                      { key: 'roas', label: 'ROAS', format: (val: number) => `${val.toFixed(2)}x` },
                    ].map((metric, metricIndex) => {
                      // Find best and worst values for this metric
                      const values = creatives.map(c => getMetricValue(c, metric.key));
                      const maxValue = Math.max(...values);
                      const minValue = Math.min(...values);
                      const isLowerBetter = ['cpc', 'cpr', 'spend'].includes(metric.key);
                      
                      return (
                        <tr key={metric.key} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                          <td className="p-4 font-medium bg-muted/20">
                            {metric.label}
                          </td>
                          {creatives.map((creative, creativeIndex) => {
                            const value = getMetricValue(creative, metric.key);
                            const isBestValue = isLowerBetter ? value === minValue : value === maxValue;
                            const isWorstValue = isLowerBetter ? value === maxValue : value === minValue;
                            
                            return (
                              <td key={creative.ad_id} className="p-4 text-center">
                                <div className={`inline-flex items-center justify-center px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                                  isBestValue && creatives.length > 1 ? 
                                    'bg-green-500/20 text-green-400 ring-1 ring-green-500/30' :
                                  isWorstValue && creatives.length > 1 ? 
                                    'bg-red-500/20 text-red-400 ring-1 ring-red-500/30' :
                                    'bg-muted/30 text-foreground'
                                }`}>
                                  {metric.format(value)}
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Performance Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {creatives.map((creative) => {
              const summary = getPerformanceSummary(creative);
              return (
                <Card key={creative.ad_id} className="p-4">
                  <h4 className="font-medium mb-2 line-clamp-1">{creative.ad_name}</h4>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">CPC:</span>
                      <span className={summary.cpcStatus === 'good' ? 'text-green-400' : 'text-yellow-400'}>
                        {summary.cpcStatus === 'good' ? 'Baixo' : 'Alto'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">CTR:</span>
                      <span className={summary.ctrStatus === 'good' ? 'text-green-400' : 'text-red-400'}>
                        {summary.ctrStatus === 'good' ? 'Alto' : 'Baixo'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">ROAS:</span>
                      <span className={summary.roasStatus === 'good' ? 'text-green-400' : 'text-red-400'}>
                        {summary.roasStatus === 'good' ? 'Alto' : 'Baixo'}
                      </span>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>

        <div className="flex justify-end mt-6">
          <Button onClick={onClose} variant="outline">
            Fechar Comparação
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};