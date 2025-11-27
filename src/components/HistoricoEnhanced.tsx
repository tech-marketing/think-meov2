import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts';
import { TrendingUp, TrendingDown, Calendar, BarChart3, Eye, AlertCircle, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useMetaAdsDirect } from "@/contexts/MetaAdsDirectContext";
import { supabase } from "@/integrations/supabase/client";

interface HistoricoEnhancedProps {
  ads: any[];
  dateRange: string;
}

export const HistoricoEnhanced: React.FC<HistoricoEnhancedProps> = ({ ads, dateRange }) => {
  const { 
    startDate, 
    endDate, 
    setStartDate, 
    setEndDate, 
    fetchData, 
    isValidDateRange, 
    loadingAds,
    adsData
  } = useMetaAdsDirect();
  
  const [selectedMetric, setSelectedMetric] = useState('impressions');
  const [selectedAds, setSelectedAds] = useState<string[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [customStartDate, setCustomStartDate] = useState<string>(startDate || '');
  const [customEndDate, setCustomEndDate] = useState<string>(endDate || '');
  const [chartType, setChartType] = useState('line');
  const [loadingDailyData, setLoadingDailyData] = useState(false);

  const metricOptions = [
    { value: 'impressions', label: 'Impressões' },
    { value: 'clicks', label: 'Cliques' },
    { value: 'ctr', label: 'CTR (%)' },
    { value: 'cpc', label: 'CPC' },
    { value: 'spend', label: 'Investimento' },
    { value: 'results', label: 'Resultados' }
  ];

  const chartTypes = [
    { value: 'line', label: 'Linha' },
    { value: 'bar', label: 'Barra' }
  ];

  // Cores predefinidas para múltiplos anúncios
  const adColors = [
    '#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#8dd1e1', '#d084d0'
  ];

  const generateHistoricalData = async () => {
    if (selectedAds.length === 0) return [];
    
    setLoadingDailyData(true);
    
    try {
      // Usa as datas personalizadas se definidas, senão usa as do contexto
      const startDateStr = customStartDate || startDate;
      const endDateStr = customEndDate || endDate;
      
      if (!startDateStr || !endDateStr) {
        setLoadingDailyData(false);
        return [];
      }
      
      const start = new Date(startDateStr);
      const end = new Date(endDateStr);
      const timeDiff = end.getTime() - start.getTime();
      const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1;
      
      // Usa dados reais do contexto
      const selectedAdsData = adsData?.ads.filter(ad => selectedAds.includes(ad.ad_id)) || [];
      
      if (selectedAdsData.length === 0) {
        setLoadingDailyData(false);
        return [];
      }
      
      console.log('Buscando dados históricos para período:', startDateStr, 'até', endDateStr);
      console.log('Anúncios selecionados:', selectedAdsData.map(ad => ad.ad_id));
      
      // Buscar dados de todos os anúncios em paralelo para o período completo
      const adDataPromises = selectedAdsData.map(async (ad) => {
        try {
          const { data: response, error } = await supabase.functions.invoke('meta-ads-direct', {
            body: {
              action: 'daily-insights',
              adId: ad.ad_id,
              startDate: startDateStr,
              endDate: endDateStr
            }
          });
          
          if (error) {
            console.error('Erro ao buscar insights para anúncio', ad.ad_id, ':', error);
            return { adId: ad.ad_id, data: [] };
          }
          
          // Corrigir parsing: resposta vem como { success: true, data: [...] }
          const dailyInsights = response?.data || [];
          console.log(`Dados recebidos para anúncio ${ad.ad_id}:`, dailyInsights.length, 'dias');
          
          return { adId: ad.ad_id, data: dailyInsights };
        } catch (err) {
          console.error('Erro ao processar anúncio', ad.ad_id, ':', err);
          return { adId: ad.ad_id, data: [] };
        }
      });
      
      const adDataResults = await Promise.all(adDataPromises);
      
      // Criar mapa de dados por anúncio e data
      const adDataMaps: { [adId: string]: { [date: string]: any } } = {};
      
      adDataResults.forEach(({ adId, data }) => {
        adDataMaps[adId] = {};
        data.forEach((dayInsight: any) => {
          if (dayInsight.date_start) {
            adDataMaps[adId][dayInsight.date_start] = dayInsight;
          }
        });
      });
      
      // Gerar dados do gráfico para cada dia do período
      const chartData = [];
      
      for (let i = 0; i < daysDiff; i++) {
        const date = new Date(start);
        date.setDate(start.getDate() + i);
        const dateStr = date.toISOString().split('T')[0];
        
        const dayData: any = {
          date: date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }),
          fullDate: dateStr,
        };
        
        // Para cada anúncio selecionado
        selectedAdsData.forEach(ad => {
          const dayInsight = adDataMaps[ad.ad_id]?.[dateStr];
          let value = 0;
          
          if (dayInsight) {
            switch (selectedMetric) {
              case 'impressions':
                value = Math.ceil(parseFloat(dayInsight.impressions || '0'));
                break;
              case 'clicks':
                value = Math.ceil(parseFloat(dayInsight.inline_link_clicks || '0'));
                break;
              case 'results':
                try {
                  const actions = JSON.parse(dayInsight.actions || '[]');
                  const purchaseResult = actions.find((a: any) => 
                    a.action_type === 'offsite_conversion.fb_pixel_purchase' ||
                    a.action_type === 'lead' ||
                    a.action_type === 'complete_registration' ||
                    a.action_type === 'contact' ||
                    a.action_type === 'submit_application'
                  )?.value;
                  
                  const postEngagement = actions.find((a: any) => a.action_type === 'post_engagement')?.value;
                  const resultValue = purchaseResult || postEngagement || '0';
                  value = Math.ceil(parseFloat(resultValue));
                } catch {
                  value = 0;
                }
                break;
              case 'spend':
                value = parseFloat(dayInsight.spend || '0');
                break;
              case 'ctr':
                // Calcular CTR se não estiver disponível
                const ctrValue = dayInsight.inline_link_click_ctr;
                if (ctrValue) {
                  value = parseFloat(ctrValue);
                } else {
                  const impressions = parseFloat(dayInsight.impressions || '0');
                  const clicks = parseFloat(dayInsight.inline_link_clicks || '0');
                  value = impressions > 0 ? (clicks / impressions) * 100 : 0;
                }
                break;
              case 'cpc':
                // Calcular CPC se não estiver disponível
                const cpcValue = dayInsight.cpc;
                if (cpcValue) {
                  value = parseFloat(cpcValue);
                } else {
                  const spend = parseFloat(dayInsight.spend || '0');
                  const clicks = parseFloat(dayInsight.inline_link_clicks || '0');
                  value = clicks > 0 ? spend / clicks : 0;
                }
                break;
              default:
                value = 0;
            }
          }
          
          dayData[`ad_${ad.ad_id}`] = value;
        });
        
        chartData.push(dayData);
      }
      
      console.log('Dados do gráfico gerados:', chartData.length, 'dias');
      console.log('Exemplo de dados:', chartData.slice(0, 3));
      
      setLoadingDailyData(false);
      return chartData;
      
    } catch (error) {
      console.error('Erro ao gerar dados históricos:', error);
      setLoadingDailyData(false);
      return [];
    }
  };

  const handleApplyPeriod = () => {
    setStartDate(customStartDate);
    setEndDate(customEndDate);
    fetchData();
  };

  useEffect(() => {
    const loadData = async () => {
      if (selectedAds.length > 0) {
        const data = await generateHistoricalData();
        setChartData(data);
      } else {
        setChartData([]);
      }
    };
    loadData();
  }, [selectedMetric, selectedAds, customStartDate, customEndDate, startDate, endDate]);

  useEffect(() => {
    setCustomStartDate(startDate || '');
    setCustomEndDate(endDate || '');
  }, [startDate, endDate]);

  const currentMetric = metricOptions.find(m => m.value === selectedMetric);
  
  // Calcular estatísticas para cada anúncio selecionado - usar dados reais do contexto
  const selectedAdsData = adsData?.ads.filter(ad => selectedAds.includes(ad.ad_id)) || [];
  
  const adStats = useMemo(() => {
    return selectedAdsData.map((ad, index) => {
      const adDataKey = `ad_${ad.ad_id}`;
      const validData = chartData.filter(d => d[adDataKey] > 0);
      
      if (validData.length === 0) return null;
      
      const latestValue = chartData[chartData.length - 1]?.[adDataKey] || 0;
      const previousValue = chartData[chartData.length - 2]?.[adDataKey] || 0;
      const trend = latestValue > previousValue ? 'up' : 'down';
      const trendPercentage = previousValue ? Math.abs((latestValue - previousValue) / previousValue * 100).toFixed(1) : '0';
      
      const maxValue = Math.max(...validData.map(d => d[adDataKey]));
      const avgValue = validData.reduce((acc, d) => acc + d[adDataKey], 0) / validData.length;
      const totalChange = validData.length > 1 ? ((latestValue - validData[0][adDataKey]) / validData[0][adDataKey] * 100) : 0;
      
      const bestDay = validData.reduce((prev, current) => {
        return (prev[adDataKey] > current[adDataKey]) ? prev : current;
      });
      
      return {
        ad,
        latestValue,
        trend,
        trendPercentage,
        maxValue,
        avgValue,
        totalChange,
        bestDay,
        color: adColors[index % adColors.length]
      };
    }).filter(Boolean);
  }, [chartData, selectedAdsData, selectedMetric]);

  const handleAdSelection = (adId: string) => {
    if (selectedAds.includes(adId)) {
      setSelectedAds(selectedAds.filter(id => id !== adId));
    } else if (selectedAds.length < 4) {
      setSelectedAds([...selectedAds, adId]);
    }
  };

  const formatValue = (value: number) => {
    if (selectedMetric === 'impressions' || selectedMetric === 'clicks' || selectedMetric === 'results') {
      return Math.ceil(value).toLocaleString('pt-BR');
    } else if (selectedMetric === 'ctr') {
      return `${value.toFixed(2)}%`;
    } else if (selectedMetric === 'cpc' || selectedMetric === 'spend') {
      return `R$ ${value.toFixed(2)}`;
    }
    return value.toFixed(2);
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-background border border-border rounded-lg p-3 shadow-lg">
          <p className="font-medium mb-2">{label}</p>
          {payload.map((entry: any, index: number) => {
            const adId = entry.dataKey.replace('ad_', '');
            const ad = adsData?.ads.find(a => a.ad_id === adId);
            return (
              <div key={index} className="flex items-center gap-2">
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: entry.color }}
                />
                <span className="text-sm">
                  {ad?.ad_name}: {formatValue(entry.value)}
                </span>
              </div>
            );
          })}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Creative Selection Section */}
      <Card className="border-2 border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Selecionar Criativos para Histórico
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Selecione até 4 criativos para analisar o histórico de performance
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 max-h-60 overflow-y-auto">
            {adsData?.ads.slice(0, 6).map(ad => {
              const isSelected = selectedAds.includes(ad.ad_id);
              const canSelect = selectedAds.length < 4 || isSelected;
              
              return (
                <div 
                  key={ad.ad_id}
                  className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                    isSelected ? 'border-primary bg-primary/5' :
                    canSelect ? 'border-border hover:border-primary/50' : 'border-muted opacity-50 cursor-not-allowed'
                  }`}
                  onClick={() => canSelect && handleAdSelection(ad.ad_id)}
                >
                  <div className="flex items-center">
                    <input 
                      type="radio" 
                      checked={isSelected}
                      readOnly
                      className="mr-3"
                    />
                    <div className="w-12 h-12 rounded-md overflow-hidden bg-muted/50 flex-shrink-0">
                      {ad.image_url ? (
                        <img 
                          src={ad.image_url} 
                          alt={ad.ad_name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center">
                          <span className="text-xs text-muted-foreground">IMG</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-sm line-clamp-1">
                      {ad.ad_name}
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      {ad.campaign_name}
                    </p>
                  </div>
                </div>
              );
            }) || []}
          </div>
        </CardContent>
      </Card>

      {/* Custom Period Selector */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Período Personalizado
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Data Início</label>
              <Input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                max={customEndDate || endDate}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Data Fim</label>
              <Input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                min={customStartDate}
                max={new Date().toISOString().split('T')[0]}
              />
            </div>
          </div>
          <div className="mt-4">
            <Button 
              onClick={handleApplyPeriod}
              disabled={loadingAds || !customStartDate || !customEndDate}
              className="w-full"
            >
              {loadingAds ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Carregando...
                </>
              ) : (
                <>
                  <Calendar className="h-4 w-4 mr-2" />
                  Aplicar Período
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium mb-2 block">Métrica</label>
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
          <label className="text-sm font-medium mb-2 block">Tipo de Gráfico</label>
          <Select value={chartType} onValueChange={setChartType}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {chartTypes.map(type => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Chart */}
      {selectedAds.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">Selecione anúncios para ver o histórico</h3>
            <p className="text-muted-foreground">
              Escolha um ou mais anúncios acima para visualizar a evolução das métricas ao longo do tempo.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              {currentMetric?.label} - {customStartDate && customEndDate ? `${new Date(customStartDate).toLocaleDateString('pt-BR')} a ${new Date(customEndDate).toLocaleDateString('pt-BR')}` : 'Período selecionado'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              {loadingDailyData ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">Carregando dados históricos do Meta...</p>
                  </div>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  {chartType === 'bar' ? (
                  <BarChart data={chartData}>
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
                    <Tooltip content={<CustomTooltip />} />
                    <Legend 
                      content={({ payload }) => (
                        <div className="flex flex-wrap gap-4 justify-center mt-4">
                          {payload?.map((entry, index) => {
                            const adId = String(entry.dataKey || '').replace('ad_', '');
                            const ad = ads.find(a => a.id === adId);
                            return (
                              <div key={index} className="flex items-center gap-2">
                                <div 
                                  className="w-3 h-3 rounded-full" 
                                  style={{ backgroundColor: entry.color }}
                                />
                                <span className="text-sm">{ad?.ad_name}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    />
                    {selectedAdsData.map((ad, index) => (
                      <Bar
                        key={ad.id}
                        dataKey={`ad_${ad.id}`}
                        fill={adColors[index % adColors.length]}
                        radius={[4, 4, 0, 0]}
                      />
                    ))}
                  </BarChart>
                ) : (
                  <LineChart data={chartData}>
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
                    <Tooltip content={<CustomTooltip />} />
                    <Legend 
                      content={({ payload }) => (
                        <div className="flex flex-wrap gap-4 justify-center mt-4">
                          {payload?.map((entry, index) => {
                            const adId = String(entry.dataKey || '').replace('ad_', '');
                            const ad = ads.find(a => a.id === adId);
                            return (
                              <div key={index} className="flex items-center gap-2">
                                <div 
                                  className="w-3 h-3 rounded-full" 
                                  style={{ backgroundColor: entry.color }}
                                />
                                <span className="text-sm">{ad?.ad_name}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    />
                    {selectedAdsData.map((ad, index) => (
                      <Line
                        key={ad.id}
                        type="monotone"
                        dataKey={`ad_${ad.id}`}
                        stroke={adColors[index % adColors.length]}
                        strokeWidth={3}
                        dot={{ fill: adColors[index % adColors.length], r: 4 }}
                        activeDot={{ r: 6 }}
                      />
                    ))}
                  </LineChart>
                )}
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary Cards */}
      {selectedAds.length > 0 && (
        <div className="space-y-6">
          {adStats.map((stat, index) => (
            <div key={stat.ad.id} className="space-y-4">
              <div className="flex items-center gap-3">
                <div 
                  className="w-4 h-4 rounded-full" 
                  style={{ backgroundColor: stat.color }}
                />
                <h3 className="font-semibold text-lg">{stat.ad.ad_name}</h3>
                <Badge variant="outline">{stat.ad.campaign_name}</Badge>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="text-center">
                  <CardContent className="p-4">
                    <h4 className="text-sm font-medium text-muted-foreground mb-2">Melhor Dia</h4>
                    <p className="text-2xl font-bold text-green-600">
                      {formatValue(stat.bestDay[`ad_${stat.ad.id}`])}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(stat.bestDay.fullDate).toLocaleDateString('pt-BR')}
                    </p>
                  </CardContent>
                </Card>
                
                <Card className="text-center">
                  <CardContent className="p-4">
                    <h4 className="text-sm font-medium text-muted-foreground mb-2">Média do Período</h4>
                    <p className="text-2xl font-bold">{formatValue(stat.avgValue)}</p>
                    <p className="text-xs text-muted-foreground">
                      {customStartDate && customEndDate ? 
                        `${new Date(customStartDate).toLocaleDateString('pt-BR')} - ${new Date(customEndDate).toLocaleDateString('pt-BR')}` : 
                        'Período selecionado'
                      }
                    </p>
                  </CardContent>
                </Card>
                
                <Card className="text-center">
                  <CardContent className="p-4">
                    <h4 className="text-sm font-medium text-muted-foreground mb-2">Tendência</h4>
                    <div className="flex items-center justify-center gap-2">
                      {stat.trend === 'up' ? (
                        <TrendingUp className="h-5 w-5 text-green-500" />
                      ) : (
                        <TrendingDown className="h-5 w-5 text-red-500" />
                      )}
                      <span className={`text-xl font-bold ${stat.trend === 'up' ? 'text-green-500' : 'text-red-500'}`}>
                        {stat.trendPercentage}%
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {stat.trend === 'up' ? 'Crescimento' : 'Declínio'} no período
                    </p>
                  </CardContent>
                </Card>
                
                <Card className="text-center">
                  <CardContent className="p-4">
                    <h4 className="text-sm font-medium text-muted-foreground mb-2">Variação Total</h4>
                    <p className={`text-2xl font-bold ${stat.totalChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {stat.totalChange >= 0 ? '+' : ''}{stat.totalChange.toFixed(1)}%
                    </p>
                    <p className="text-xs text-muted-foreground">vs início do período</p>
                  </CardContent>
                </Card>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};