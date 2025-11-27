import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { TrendingUp, TrendingDown, Calendar, BarChart3 } from "lucide-react";

interface HistoricoTabProps {
  ads: any[];
  dateRange: string;
}

export const HistoricoTab: React.FC<HistoricoTabProps> = ({ ads, dateRange }) => {
  const [selectedMetric, setSelectedMetric] = useState('ctr');
  const [selectedAd, setSelectedAd] = useState('all');
  const [chartData, setChartData] = useState<any[]>([]);

  const metricOptions = [
    { value: 'ctr', label: 'CTR (%)', color: '#8884d8' },
    { value: 'roas', label: 'ROAS', color: '#82ca9d' },
    { value: 'conversion_rate', label: 'Taxa de Conversão (%)', color: '#ffc658' },
    { value: 'cpc', label: 'CPC ($)', color: '#ff7300' },
    { value: 'spend', label: 'Gasto ($)', color: '#8dd1e1' },
    { value: 'impressions', label: 'Impressões', color: '#d084d0' }
  ];

  const generateHistoricalData = () => {
    const days = dateRange === 'last_7_days' ? 7 : dateRange === 'last_30_days' ? 30 : 90;
    const data = [];
    
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      
      // Simulate data with some trends
      const baseValue = selectedMetric === 'ctr' ? 2.5 : 
                       selectedMetric === 'roas' ? 3.2 :
                       selectedMetric === 'conversion_rate' ? 5.8 :
                       selectedMetric === 'cpc' ? 1.2 :
                       selectedMetric === 'spend' ? 100 : 10000;
      
      const trend = Math.sin(i / 7) * 0.3; // Weekly pattern
      const randomVariation = (Math.random() - 0.5) * 0.4;
      const value = baseValue * (1 + trend + randomVariation);
      
      data.push({
        date: date.toLocaleDateString('pt-BR', { month: 'short', day: 'numeric' }),
        fullDate: date.toISOString().split('T')[0],
        [selectedMetric]: Number(value.toFixed(2))
      });
    }
    
    return data;
  };

  useEffect(() => {
    setChartData(generateHistoricalData());
  }, [selectedMetric, selectedAd, dateRange]);

  const currentMetric = metricOptions.find(m => m.value === selectedMetric);
  const latestValue = chartData[chartData.length - 1]?.[selectedMetric] || 0;
  const previousValue = chartData[chartData.length - 2]?.[selectedMetric] || 0;
  const trend = latestValue > previousValue ? 'up' : 'down';
  const trendPercentage = previousValue ? ((latestValue - previousValue) / previousValue * 100).toFixed(1) : '0';

  return (
    <div className="space-y-6">
      {/* Header with controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Evolução Histórica
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Métrica para Análise</label>
              <Select value={selectedMetric} onValueChange={setSelectedMetric}>
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
              <label className="text-sm font-medium mb-2 block">Anúncio Específico</label>
              <Select value={selectedAd} onValueChange={setSelectedAd}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Média de Todos os Anúncios</SelectItem>
                  {ads.slice(0, 10).map(ad => (
                    <SelectItem key={ad.id} value={ad.id}>
                      {ad.ad_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Current value and trend */}
          <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg">
            <div>
              <p className="text-sm text-muted-foreground">Valor Atual</p>
              <p className="text-2xl font-bold">{latestValue}</p>
            </div>
            <div className="flex items-center gap-1">
              {trend === 'up' ? (
                <TrendingUp className="h-4 w-4 text-green-500" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-500" />
              )}
              <span className={`text-sm font-medium ${trend === 'up' ? 'text-green-500' : 'text-red-500'}`}>
                {trendPercentage}%
              </span>
              <span className="text-sm text-muted-foreground">vs. ontem</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Historical Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Gráfico de Evolução - {currentMetric?.label}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-96">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis 
                  dataKey="date" 
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                />
                <YAxis 
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                  labelStyle={{ color: 'hsl(var(--foreground))' }}
                />
                <Area
                  type="monotone"
                  dataKey={selectedMetric}
                  stroke={currentMetric?.color}
                  fill={currentMetric?.color}
                  fillOpacity={0.2}
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Performance Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Resumo do Período</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 border rounded-lg">
              <p className="text-sm text-muted-foreground">Valor Máximo</p>
              <p className="text-lg font-semibold">
                {Math.max(...chartData.map(d => d[selectedMetric])).toFixed(2)}
              </p>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <p className="text-sm text-muted-foreground">Valor Mínimo</p>
              <p className="text-lg font-semibold">
                {Math.min(...chartData.map(d => d[selectedMetric])).toFixed(2)}
              </p>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <p className="text-sm text-muted-foreground">Média</p>
              <p className="text-lg font-semibold">
                {(chartData.reduce((acc, d) => acc + d[selectedMetric], 0) / chartData.length).toFixed(2)}
              </p>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <p className="text-sm text-muted-foreground">Variação Total</p>
              <p className="text-lg font-semibold">
                {((latestValue - chartData[0]?.[selectedMetric]) / chartData[0]?.[selectedMetric] * 100).toFixed(1)}%
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};