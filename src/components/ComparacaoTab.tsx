import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';
import { Plus, X, TrendingUp, TrendingDown, BarChart3, Activity } from "lucide-react";

interface ComparacaoTabProps {
  ads: any[];
}

export const ComparacaoTab: React.FC<ComparacaoTabProps> = ({ ads }) => {
  const [selectedAds, setSelectedAds] = useState<string[]>([]);
  const [comparisonMetric, setComparisonMetric] = useState('ctr');

  const metricOptions = [
    { value: 'ctr', label: 'CTR (%)', color: '#8884d8' },
    { value: 'roas', label: 'ROAS', color: '#82ca9d' },
    { value: 'conversion_rate', label: 'Taxa de Conversão (%)', color: '#ffc658' },
    { value: 'cpc', label: 'CPC ($)', color: '#ff7300' },
    { value: 'spend', label: 'Gasto ($)', color: '#8dd1e1' },
    { value: 'impressions', label: 'Impressões', color: '#d084d0' }
  ];

  const addAdToComparison = (adId: string) => {
    if (selectedAds.length < 3 && !selectedAds.includes(adId)) {
      setSelectedAds([...selectedAds, adId]);
    }
  };

  const removeAdFromComparison = (adId: string) => {
    setSelectedAds(selectedAds.filter(id => id !== adId));
  };

  const getSelectedAdsData = () => {
    return selectedAds.map(adId => {
      const ad = ads.find(a => a.id === adId);
      return ad ? {
        id: ad.id,
        name: ad.ad_name,
        campaign: ad.campaign_name,
        metrics: ad.metrics || {}
      } : null;
    }).filter(Boolean);
  };

  const getComparisonChartData = () => {
    const selectedAdsData = getSelectedAdsData();
    const metrics = ['ctr', 'roas', 'conversion_rate', 'cpc'];
    
    return metrics.map(metric => {
      const dataPoint: any = { metric: metric.toUpperCase() };
      selectedAdsData.forEach((ad, index) => {
        dataPoint[`ad${index + 1}`] = ad?.metrics[metric] || 0;
      });
      return dataPoint;
    });
  };

  const getRadarChartData = () => {
    const selectedAdsData = getSelectedAdsData();
    if (selectedAdsData.length === 0) return [];

    const metrics = ['ctr', 'roas', 'conversion_rate'];
    
    return metrics.map(metric => {
      const dataPoint: any = { 
        metric: metricOptions.find(m => m.value === metric)?.label || metric 
      };
      
      selectedAdsData.forEach((ad, index) => {
        // Normalize values for radar chart (0-100 scale)
        let value = ad?.metrics[metric] || 0;
        if (metric === 'ctr' || metric === 'conversion_rate') {
          value = Math.min(value * 10, 100); // Scale percentage metrics
        } else if (metric === 'roas') {
          value = Math.min(value * 20, 100); // Scale ROAS
        }
        dataPoint[`ad${index + 1}`] = value;
      });
      
      return dataPoint;
    });
  };

  const selectedAdsData = getSelectedAdsData();
  const comparisonChartData = getComparisonChartData();
  const radarChartData = getRadarChartData();

  return (
    <div className="space-y-6">
      {/* Ad Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Seleção de Anúncios para Comparação
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">
              Selecionar Anúncio ({selectedAds.length}/3)
            </label>
            <Select value="" onValueChange={addAdToComparison}>
              <SelectTrigger>
                <SelectValue placeholder="Escolha um anúncio para comparar" />
              </SelectTrigger>
              <SelectContent>
                {ads
                  .filter(ad => !selectedAds.includes(ad.id))
                  .slice(0, 20)
                  .map(ad => (
                    <SelectItem key={ad.id} value={ad.id}>
                      {ad.ad_name} - {ad.campaign_name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          {/* Selected Ads */}
          {selectedAdsData.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Anúncios Selecionados:</h4>
              <div className="flex flex-wrap gap-2">
                {selectedAdsData.map((ad, index) => (
                  <Badge key={ad.id} variant="secondary" className="flex items-center gap-2 py-2 px-3">
                    <span className="text-xs">#{index + 1}</span>
                    <span>{ad.name}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-4 w-4 p-0 hover:bg-destructive hover:text-destructive-foreground"
                      onClick={() => removeAdFromComparison(ad.id)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedAdsData.length > 1 && (
        <>
          {/* Comparison Metrics */}
          <Card>
            <CardHeader>
              <CardTitle>Comparação de Métricas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                {metricOptions.slice(0, 4).map(metric => (
                  <div key={metric.value} className="text-center p-4 border rounded-lg">
                    <h4 className="font-medium text-sm text-muted-foreground mb-2">
                      {metric.label}
                    </h4>
                    <div className="space-y-1">
                      {selectedAdsData.map((ad, index) => (
                        <div key={ad.id} className="flex justify-between items-center">
                          <span className="text-xs">#{index + 1}</span>
                          <span className="font-semibold">
                            {(ad.metrics[metric.value] || 0).toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Bar Chart Comparison */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Comparação Visual - Barras
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-96">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={comparisonChartData}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis dataKey="metric" />
                    <YAxis />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--background))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                    />
                    {selectedAdsData.map((_, index) => (
                      <Bar 
                        key={index}
                        dataKey={`ad${index + 1}`} 
                        fill={metricOptions[index]?.color || '#8884d8'}
                        name={`Anúncio #${index + 1}`}
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Radar Chart Comparison */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Comparação Visual - Radar
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-96">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={radarChartData}>
                    <PolarGrid />
                    <PolarAngleAxis dataKey="metric" tick={{ fontSize: 12 }} />
                    <PolarRadiusAxis tick={{ fontSize: 10 }} domain={[0, 100]} />
                    {selectedAdsData.map((_, index) => (
                      <Radar
                        key={index}
                        name={`Anúncio #${index + 1}`}
                        dataKey={`ad${index + 1}`}
                        stroke={metricOptions[index]?.color || '#8884d8'}
                        fill={metricOptions[index]?.color || '#8884d8'}
                        fillOpacity={0.1}
                        strokeWidth={2}
                      />
                    ))}
                    <Tooltip />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Performance Analysis */}
          <Card>
            <CardHeader>
              <CardTitle>Análise de Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {selectedAdsData.map((ad, index) => {
                  const avgCtr = selectedAdsData.reduce((acc, a) => acc + (a.metrics.ctr || 0), 0) / selectedAdsData.length;
                  const avgRoas = selectedAdsData.reduce((acc, a) => acc + (a.metrics.roas || 0), 0) / selectedAdsData.length;
                  const ctrPerformance = (ad.metrics.ctr || 0) > avgCtr ? 'above' : 'below';
                  const roasPerformance = (ad.metrics.roas || 0) > avgRoas ? 'above' : 'below';
                  
                  return (
                    <div key={ad.id} className="p-4 border rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="outline">#{index + 1}</Badge>
                        <h4 className="font-semibold">{ad.name}</h4>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">{ad.campaign}</p>
                      <div className="flex gap-4 text-sm">
                        <div className="flex items-center gap-1">
                          {ctrPerformance === 'above' ? (
                            <TrendingUp className="h-4 w-4 text-green-500" />
                          ) : (
                            <TrendingDown className="h-4 w-4 text-red-500" />
                          )}
                          <span>CTR {ctrPerformance === 'above' ? 'acima' : 'abaixo'} da média</span>
                        </div>
                        <div className="flex items-center gap-1">
                          {roasPerformance === 'above' ? (
                            <TrendingUp className="h-4 w-4 text-green-500" />
                          ) : (
                            <TrendingDown className="h-4 w-4 text-red-500" />
                          )}
                          <span>ROAS {roasPerformance === 'above' ? 'acima' : 'abaixo'} da média</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {selectedAdsData.length === 0 && (
        <Card>
          <CardContent className="flex items-center justify-center h-32">
            <p className="text-muted-foreground">
              Selecione pelo menos 2 anúncios para começar a comparação
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};