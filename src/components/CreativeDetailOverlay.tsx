import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ExternalLink, Target, Eye, MousePointer, DollarSign, BarChart3 } from "lucide-react";

interface CreativeDetailOverlayProps {
  creative: any;
  isOpen: boolean;
  onClose: () => void;
}

export const CreativeDetailOverlay: React.FC<CreativeDetailOverlayProps> = ({
  creative,
  isOpen,
  onClose
}) => {
  const [objectiveFilter, setObjectiveFilter] = useState('all');

  if (!creative) return null;

  const formatMetricValue = (value: number, metric: string) => {
    switch (metric) {
      case 'ctr':
      case 'conversion_rate':
        return `${value.toFixed(2)}%`;
      case 'cpc':
      case 'spend':
      case 'cpp':
      case 'cpm':
        return `$${value.toFixed(2)}`;
      case 'roas':
      case 'frequency':
        return value.toFixed(2);
      default:
        return value.toLocaleString();
    }
  };

  // Define metrics by objective
  const getMetricsByObjective = (objective: string) => {
    const baseMetrics = [
      { key: 'ctr', label: 'CTR', icon: BarChart3 },
      { key: 'clicks', label: 'Cliques', icon: MousePointer },
      { key: 'cpc', label: 'CPC', icon: DollarSign },
      { key: 'impressions', label: 'Impressões', icon: Eye },
      { key: 'spend', label: 'Investimento', icon: DollarSign },
      { key: 'cpm', label: 'CPM', icon: DollarSign }
    ];

    const reachMetrics = [
      { key: 'reach', label: 'Alcance', icon: Target },
      { key: 'frequency', label: 'Frequência', icon: BarChart3 }
    ];

    const conversionMetrics = [
      { key: 'conversions', label: 'Conversões', icon: Target },
      { key: 'conversion_rate', label: 'CVR', icon: BarChart3 },
      { key: 'roas', label: 'ROAS', icon: DollarSign }
    ];

    switch (objective) {
      case 'reach':
        return [...baseMetrics, ...reachMetrics];
      case 'conversions':
        return [...baseMetrics, ...conversionMetrics];
      default:
        return [...baseMetrics, ...reachMetrics, ...conversionMetrics];
    }
  };

  const displayMetrics = getMetricsByObjective(objectiveFilter);

  const getPerformanceBadge = (metric: string, value: number) => {
    switch (metric) {
      case 'ctr':
        return value > 2 ? 'default' : value > 1 ? 'secondary' : 'outline';
      case 'cpc':
        return value < 1 ? 'default' : value < 2 ? 'secondary' : 'outline';
      case 'roas':
        return value > 3 ? 'default' : value > 2 ? 'secondary' : 'outline';
      default:
        return 'outline';
    }
  };

  const getPerformanceLabel = (metric: string, value: number) => {
    switch (metric) {
      case 'ctr':
        return value > 2 ? 'Excelente' : value > 1 ? 'Bom' : 'Regular';
      case 'cpc':
        return value < 1 ? 'Excelente' : value < 2 ? 'Bom' : 'Regular';
      case 'roas':
        return value > 3 ? 'Excelente' : value > 2 ? 'Bom' : 'Regular';
      default:
        return 'N/A';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span className="line-clamp-2">{creative.ad_name}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(`https://adsmanager.facebook.com/adsmanager/manage/ads?act=${creative.account_id}&filter_set=SEARCH&search_string=${creative.ad_id}`, '_blank')}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Abrir no Meta
            </Button>
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Creative Info & Media */}
          <div className="space-y-4">
            {/* Creative Info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Informações do Criativo</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-xs text-muted-foreground">Campanha</p>
                  <p className="text-sm font-medium">{creative.campaign_name}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">ID do Anúncio</p>
                  <p className="text-sm font-mono">{creative.ad_id}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Status</p>
                  <Badge variant={creative.status === 'ACTIVE' ? 'default' : 'secondary'}>
                    {creative.status}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Media */}
            {creative.image_url && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Criativo do Anúncio</CardTitle>
                </CardHeader>
                <CardContent>
                  {/* Preserve original aspect ratio */}
                  <div className="relative w-full bg-muted/20 rounded-lg overflow-hidden">
                    <img 
                      src={creative.image_url} 
                      alt={creative.ad_name}
                      className="w-full h-auto object-contain"
                      style={{ maxHeight: '400px' }}
                    />
                  </div>
                  
                  {/* Show caption if available */}
                  {creative.material?.caption && (
                    <div className="mt-3 p-2 bg-muted/30 rounded text-xs">
                      <p className="text-muted-foreground mb-1">Legenda:</p>
                      <p>{creative.material.caption}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right Column - Metrics */}
          <div className="lg:col-span-2 space-y-4">
            {/* Métricas de Performance */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Métricas de Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {displayMetrics.slice(0, 6).map(({ key, label, icon: Icon }) => {
                    const value = creative.metrics[key] || 0;
                    const formattedValue = formatMetricValue(value, key);
                    
                    return (
                      <div 
                        key={key} 
                        className="p-3 rounded-lg border bg-gradient-to-br from-primary/5 to-accent/5 hover:shadow-[0_0_15px_hsl(var(--primary)/0.3)] hover:animate-neon-glow transition-all duration-300 group"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <Icon className="h-4 w-4 text-primary group-hover:drop-shadow-[0_0_8px_hsl(var(--primary)/0.8)]" />
                          <span className="text-xs text-muted-foreground">{label}</span>
                        </div>
                        <div className="text-lg font-semibold group-hover:drop-shadow-[0_0_8px_hsl(var(--primary)/0.8)]">
                          {formattedValue}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Objetivo Filter */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center justify-between">
                  Análise IA
                  <Select value={objectiveFilter} onValueChange={setObjectiveFilter}>
                    <SelectTrigger className="w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      <SelectItem value="traffic">Tráfego</SelectItem>
                      <SelectItem value="reach">Alcance</SelectItem>
                      <SelectItem value="conversions">Conversões</SelectItem>
                    </SelectContent>
                  </Select>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center p-6">
                  <p className="text-sm text-muted-foreground">
                    Análise IA detalhada disponível na visualização completa
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Performance Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Resumo de Performance</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center p-3 rounded-lg border">
                    <DollarSign className="h-5 w-5 mx-auto mb-2 text-green-500" />
                    <p className="text-xs text-muted-foreground mb-1">Eficiência de Gasto</p>
                    <Badge variant={getPerformanceBadge('cpc', creative.metrics.cpc)}>
                      {getPerformanceLabel('cpc', creative.metrics.cpc)}
                    </Badge>
                  </div>
                  
                  <div className="text-center p-3 rounded-lg border">
                    <MousePointer className="h-5 w-5 mx-auto mb-2 text-blue-500" />
                    <p className="text-xs text-muted-foreground mb-1">Engajamento</p>
                    <Badge variant={getPerformanceBadge('ctr', creative.metrics.ctr)}>
                      {getPerformanceLabel('ctr', creative.metrics.ctr)}
                    </Badge>
                  </div>
                  
                  <div className="text-center p-3 rounded-lg border">
                    <Target className="h-5 w-5 mx-auto mb-2 text-purple-500" />
                    <p className="text-xs text-muted-foreground mb-1">ROI</p>
                    <Badge variant={getPerformanceBadge('roas', creative.metrics.roas)}>
                      {getPerformanceLabel('roas', creative.metrics.roas)}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="flex justify-end pt-4">
          <Button onClick={onClose}>Fechar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};