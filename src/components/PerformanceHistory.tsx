import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useMetaAdsDirect } from "@/contexts/MetaAdsDirectContext";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { History, TrendingUp, TrendingDown, Calendar } from "lucide-react";

export const PerformanceHistory: React.FC = () => {
  const { adsData } = useMetaAdsDirect();
  const [selectedMetric, setSelectedMetric] = useState('impressions');
  const [chartType, setChartType] = useState<'line' | 'bar'>('line');
  const [selectedCreatives, setSelectedCreatives] = useState<string[]>([]);

  // Generate mock daily data based on current metrics
  const dailyData = useMemo(() => {
    if (!adsData) return [];

    const days = [];
    const today = new Date();
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      
      // Generate mock data with some variation
      const dayData: any = {
        date: date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
        fullDate: date.toISOString().split('T')[0]
      };

      // Add general metrics with variation
      const variation = 0.7 + Math.random() * 0.6; // 0.7 to 1.3 multiplier
      dayData.impressions = Math.round((adsData.summary.total_impressions / 7) * variation);
      dayData.clicks = Math.round((adsData.summary.total_clicks / 7) * variation);
      dayData.conversions = Math.round((adsData.summary.total_results / 7) * variation);
      dayData.spend = Number(((adsData.summary.total_spend / 7) * variation).toFixed(2));
      dayData.ctr = Number((dayData.clicks / dayData.impressions * 100).toFixed(2));
      dayData.roas = dayData.spend > 0 ? Number((dayData.conversions * 50 / dayData.spend).toFixed(2)) : 0;

      // Add top creatives data
      selectedCreatives.forEach(creativeId => {
        const creative = adsData.top_creatives.find(c => c.ad_id === creativeId);
        if (creative) {
          const creativeVariation = 0.6 + Math.random() * 0.8;
          dayData[`${creative.ad_name}_${selectedMetric}`] = Math.round(
            (creative.metrics[selectedMetric as keyof typeof creative.metrics] / 7) * creativeVariation
          );
        }
      });

      days.push(dayData);
    }

    return days;
  }, [adsData, selectedCreatives, selectedMetric]);

  // Calculate insights
  const insights = useMemo(() => {
    if (dailyData.length === 0) return null;

    const values = dailyData.map(d => d[selectedMetric]);
    const total = values.reduce((sum, val) => sum + val, 0);
    const average = total / values.length;
    const bestDay = dailyData[values.indexOf(Math.max(...values))];
    const trend = values[values.length - 1] > values[0] ? 'up' : 'down';

    return {
      bestDay: bestDay.date,
      bestValue: Math.max(...values),
      average: Math.round(average),
      trend
    };
  }, [dailyData, selectedMetric]);

  if (!adsData) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-64">
          <div className="text-center">
            <p className="text-muted-foreground mb-2">Nenhum dado carregado</p>
            <p className="text-sm text-muted-foreground">
              Aplique os filtros no Dashboard para visualizar o histórico
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const handleCreativeToggle = (creativeId: string) => {
    if (selectedCreatives.includes(creativeId)) {
      setSelectedCreatives(selectedCreatives.filter(id => id !== creativeId));
    } else if (selectedCreatives.length < 3) {
      setSelectedCreatives([...selectedCreatives, creativeId]);
    }
  };

  const formatMetricValue = (value: number, metric: string) => {
    switch (metric) {
      case 'spend':
        return `$${value.toFixed(2)}`;
      case 'ctr':
      case 'roas':
        return value.toFixed(2);
      default:
        return value.toLocaleString();
    }
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-background border rounded-lg shadow-lg p-3">
          <p className="font-medium mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ color: entry.color }} className="text-sm">
              {entry.name}: {formatMetricValue(entry.value, selectedMetric)}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <History className="h-6 w-6" />
            Histórico de Performance
          </h2>
          <p className="text-muted-foreground">Tendência das métricas ao longo dos últimos 7 dias</p>
        </div>
      </div>

      {/* Controls */}
      <Card>
        <CardHeader>
          <CardTitle>Controles de Visualização</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Métrica</label>
            <Select value={selectedMetric} onValueChange={setSelectedMetric}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="impressions">Impressões</SelectItem>
                <SelectItem value="clicks">Cliques</SelectItem>
                <SelectItem value="conversions">Resultados</SelectItem>
                <SelectItem value="spend">Investimento</SelectItem>
                <SelectItem value="ctr">CTR</SelectItem>
                <SelectItem value="roas">ROAS</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Tipo de Gráfico</label>
            <Select value={chartType} onValueChange={(value: 'line' | 'bar') => setChartType(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="line">Linha</SelectItem>
                <SelectItem value="bar">Barra</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Criativos ({selectedCreatives.length}/3)</label>
            <Select onValueChange={handleCreativeToggle}>
              <SelectTrigger>
                <SelectValue placeholder="Adicionar criativo" />
              </SelectTrigger>
              <SelectContent>
                {adsData.top_creatives.slice(0, 10).map(creative => (
                  <SelectItem 
                    key={creative.ad_id} 
                    value={creative.ad_id}
                    disabled={selectedCreatives.includes(creative.ad_id) || selectedCreatives.length >= 3}
                  >
                    {creative.ad_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Insights Cards */}
      {insights && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Melhor Dia
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{insights.bestDay}</div>
              <p className="text-sm text-muted-foreground">
                {formatMetricValue(insights.bestValue, selectedMetric)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Média do Período</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatMetricValue(insights.average, selectedMetric)}
              </div>
              <p className="text-sm text-muted-foreground">Últimos 7 dias</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                {insights.trend === 'up' ? (
                  <TrendingUp className="h-4 w-4 text-green-500" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-red-500" />
                )}
                Tendência
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${insights.trend === 'up' ? 'text-green-500' : 'text-red-500'}`}>
                {insights.trend === 'up' ? 'Alta' : 'Baixa'}
              </div>
              <p className="text-sm text-muted-foreground">Últimos 7 dias</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Histórico - {selectedMetric}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-96">
            <ResponsiveContainer width="100%" height="100%">
              {chartType === 'line' ? (
                <LineChart data={dailyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey={selectedMetric} 
                    stroke="hsl(var(--primary))" 
                    strokeWidth={2}
                    name="Geral"
                  />
                  {selectedCreatives.map((creativeId, index) => {
                    const creative = adsData.top_creatives.find(c => c.ad_id === creativeId);
                    const colors = ['#8884d8', '#82ca9d', '#ffc658'];
                    return (
                      <Line
                        key={creativeId}
                        type="monotone"
                        dataKey={`${creative?.ad_name}_${selectedMetric}`}
                        stroke={colors[index]}
                        strokeWidth={2}
                        name={creative?.ad_name || ''}
                      />
                    );
                  })}
                </LineChart>
              ) : (
                <BarChart data={dailyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Bar 
                    dataKey={selectedMetric} 
                    fill="hsl(var(--primary))" 
                    name="Geral"
                  />
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Selected Creatives */}
      {selectedCreatives.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Criativos Selecionados</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {selectedCreatives.map(creativeId => {
                const creative = adsData.top_creatives.find(c => c.ad_id === creativeId);
                return (
                  <Button
                    key={creativeId}
                    variant="outline"
                    size="sm"
                    onClick={() => handleCreativeToggle(creativeId)}
                  >
                    {creative?.ad_name}
                    <span className="ml-2">×</span>
                  </Button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};