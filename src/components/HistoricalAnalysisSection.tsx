import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { useMetaAdsDirect } from "@/contexts/MetaAdsDirectContext";
import { CreativeDisplay } from "@/components/CreativeDisplay";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { BarChart3, LineChart as LineChartIcon, TrendingUp, TrendingDown, Calendar, Target, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO, eachDayOfInterval } from "date-fns";

interface SelectedCreative {
  ad_id: string;
  ad_name: string;
  campaign_name: string;
  image_url?: string;
  video_url?: string;
  local_material_id?: string;
}

export const HistoricalAnalysisSection: React.FC = () => {
  const { 
    adsData, 
    startDate,
    endDate,
    setStartDate,
    setEndDate,
    fetchData,
    loadingAds 
  } = useMetaAdsDirect();

  // Analysis states
  const [selectedCreatives, setSelectedCreatives] = useState<SelectedCreative[]>([]);
  const [selectedMetric, setSelectedMetric] = useState('impressions');
  const [chartType, setChartType] = useState<'line' | 'bar'>('line');
  const [chartData, setChartData] = useState<any[]>([]);
  const [rawAdData, setRawAdData] = useState<Map<string, Map<string, any>>>(new Map());
  const [loadingData, setLoadingData] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [customStartDate, setCustomStartDate] = useState<string>(startDate || '');
  const [customEndDate, setCustomEndDate] = useState<string>(endDate || '');
  const [showAllLegend, setShowAllLegend] = useState(false);

  useEffect(() => {
    setCustomStartDate(startDate || '');
    setCustomEndDate(endDate || '');
  }, [startDate, endDate]);

  // Reset selection when no data
  useEffect(() => {
    if (!adsData) {
      setSelectedCreatives([]);
      setShowResults(false);
    }
  }, [adsData]);

  // Available creatives from ads data
  const availableCreatives = useMemo(() => {
    if (!adsData?.ads) return [];
    
    return adsData.ads.slice(0, 50).map(ad => ({
      ad_id: ad.ad_id,
      ad_name: ad.ad_name,
      campaign_name: ad.campaign_name,
      image_url: ad.image_url,
      video_url: ad.video_url,
      local_material_id: ad.local_material_id
    }));
  }, [adsData]);

  const handleCreativeToggle = (creative: SelectedCreative, checked: boolean) => {
    if (checked && selectedCreatives.length >= 10) return;
    
    setSelectedCreatives(prev => 
      checked 
        ? [...prev, creative]
        : prev.filter(c => c.ad_id !== creative.ad_id)
    );
  };

  const handleApplyPeriod = () => {
    setStartDate(customStartDate);
    setEndDate(customEndDate);
    fetchData();
  };

  const generateHistoricalData = async () => {
    if (selectedCreatives.length === 0 || !customStartDate || !customEndDate) return;
    
    setLoadingData(true);
    try {
      const dateList = eachDayOfInterval({
        start: parseISO(customStartDate),
        end: parseISO(customEndDate)
      });

      // Fetch daily data for each selected ad
      const adDataPromises = selectedCreatives.map(async (creative) => {
        try {
          const resp = await supabase.functions.invoke('meta-ads-direct', {
            body: {
              action: 'daily-insights',
              adId: creative.ad_id,
              startDate: customStartDate,
              endDate: customEndDate
            }
          });

          if (resp.error || !resp.data?.success) {
            console.warn(`Failed to fetch data for ad ${creative.ad_id}:`, resp.error);
            return { adId: creative.ad_id, data: [] };
          }

          return { adId: creative.ad_id, data: resp.data.data || [] };
        } catch (error) {
          console.warn(`Error fetching data for ad ${creative.ad_id}:`, error);
          return { adId: creative.ad_id, data: [] };
        }
      });

      const allAdData = await Promise.all(adDataPromises);
      
      // Build date-keyed maps for each ad
      const adMaps = new Map<string, Map<string, any>>();
      
      allAdData.forEach(({ adId, data }) => {
        const dateMap = new Map<string, any>();
        data.forEach((row: any) => {
          const dateKey = row.date_start;
          const impressions = +row.impressions || 0;
          const clicks = +row.inline_link_clicks || 0;
          const spend = +row.spend || 0;
          
          // Calculate metrics
          const ctr = row.inline_link_click_ctr ? +row.inline_link_click_ctr : (impressions > 0 ? (clicks / impressions) * 100 : 0);
          const cpc = row.cpc ? +row.cpc : (clicks > 0 ? spend / clicks : 0);
          
          // Parse results from actions
          let results = 0;
          if (row.actions) {
            try {
              const actions = JSON.parse(row.actions);
              const resultActions = actions.find((action: any) => 
                ['purchase', 'lead', 'complete_registration', 'contact', 'submit_application'].includes(action.action_type)
              );
              if (resultActions) {
                results = +resultActions.value || 0;
              } else {
                // Fallback to post_engagement
                const engagementAction = actions.find((action: any) => action.action_type === 'post_engagement');
                results = engagementAction ? +engagementAction.value || 0 : 0;
              }
            } catch (e) {
              results = 0;
            }
          }

          // Calculate reach and conversion rate
          const reach = +row.reach || impressions; // Fallback to impressions if reach not available
          const conversionRate = impressions > 0 ? (results / impressions) * 100 : 0;

          dateMap.set(dateKey, {
            impressions,
            clicks,
            results,
            spend,
            ctr,
            cpc,
            reach,
            conversionRate
          });
        });
        
        adMaps.set(adId, dateMap);
      });

      // Generate chart data
      const chartData = dateList.map(date => {
        const dateKey = format(date, 'yyyy-MM-dd');
        const dayData: any = {
          date: format(date, 'MMM dd'),
          dateKey
        };

        selectedCreatives.forEach(creative => {
          const adMap = adMaps.get(creative.ad_id);
          const dayMetrics = adMap?.get(dateKey);
          
          if (dayMetrics) {
            dayData[`ad_${creative.ad_id}`] = dayMetrics[selectedMetric] || 0;
            dayData[`raw_${creative.ad_id}`] = dayMetrics; // Store all raw metrics
          } else {
            dayData[`ad_${creative.ad_id}`] = 0;
            dayData[`raw_${creative.ad_id}`] = {};
          }
        });

        return dayData;
      });

      setChartData(chartData);
      setRawAdData(adMaps);
    } catch (error) {
      console.error('Error generating historical data:', error);
    } finally {
      setLoadingData(false);
    }
  };

  const handleShowHistory = async () => {
    setShowResults(true);
    await generateHistoricalData();
  };

  // Calculate individual stats for each creative
  const individualStats = useMemo(() => {
    if (chartData.length === 0) return {};

    const stats: Record<string, any> = {};

    selectedCreatives.forEach(creative => {
      const values: number[] = [];
      
      // Get values for the currently selected metric from raw data
      chartData.forEach(day => {
        const rawData = day[`raw_${creative.ad_id}`] || {};
        const value = rawData[selectedMetric] || 0;
        values.push(value);
      });

      if (values.length === 0) return;

      const maxValue = Math.max(...values);
      const avgValue = values.reduce((sum, val) => sum + val, 0) / values.length;
      
      // Find best day for this creative based on current metric
      let bestDay = '';
      let bestValue = 0;
      chartData.forEach(day => {
        const rawData = day[`raw_${creative.ad_id}`] || {};
        const value = rawData[selectedMetric] || 0;
        if (value > bestValue) {
          bestValue = value;
          bestDay = day.date;
        }
      });

      // Calculate trend (compare first vs last value) based on current metric
      const firstValue = values[0] || 0;
      const lastValue = values[values.length - 1] || 0;
      
      const trendPercentage = firstValue > 0 ? ((lastValue - firstValue) / firstValue) * 100 : 0;

      stats[creative.ad_id] = {
        bestDay,
        bestValue,
        avgValue,
        trendPercentage,
        adName: creative.ad_name
      };
    });

    return stats;
  }, [chartData, selectedCreatives, selectedMetric]);

  // Generate chart data dynamically based on selected metric
  const displayChartData = useMemo(() => {
    return chartData.map(day => {
      const newDay = {
        date: day.date,
        dateKey: day.dateKey
      };
      
      selectedCreatives.forEach(creative => {
        const rawData = day[`raw_${creative.ad_id}`] || {};
        newDay[`ad_${creative.ad_id}`] = rawData[selectedMetric] || 0;
      });
      
      return newDay;
    });
  }, [chartData, selectedCreatives, selectedMetric]);

  const formatValue = (value: number, metric: string) => {
    switch (metric) {
      case 'spend':
        return `R$ ${value.toFixed(2)}`;
      case 'ctr':
      case 'conversionRate':
        return `${value.toFixed(2)}%`;
      case 'cpc':
        return `R$ ${value.toFixed(2)}`;
      case 'impressions':
      case 'clicks':
      case 'results':
        return Math.round(value).toLocaleString('pt-BR');
      default:
        return value.toLocaleString('pt-BR');
    }
  };

  const getCreativeColor = (index: number) => {
    const colors = [
      '#8884d8', '#82ca9d', '#ffc658', '#ff7c7c', '#8dd1e1', 
      '#d084d0', '#87d068', '#ffb347', '#ff8c42', '#6a5acd'
    ];
    return colors[index % colors.length];
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-card border border-border rounded-lg shadow-lg p-3">
          <p className="font-medium mb-2">{label}</p>
          {payload.map((entry: any, index: number) => {
            const adId = entry.dataKey.replace('ad_', '');
            const creative = selectedCreatives.find(c => c.ad_id === adId);
            return (
              <p key={index} style={{ color: entry.color }} className="text-sm">
                {creative?.ad_name}: {formatValue(entry.value, selectedMetric)}
              </p>
            );
          })}
        </div>
      );
    }
    return null;
  };

  if (!adsData) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-64">
          <div className="text-center">
            <Target className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-2">Nenhum dado histórico disponível</p>
            <p className="text-sm text-muted-foreground">
              Configure os filtros no painel lateral e carregue os dados primeiro
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="h-6 w-6" />
            Análise de Histórico
          </h2>
          <p className="text-muted-foreground">Analise o desempenho histórico dos criativos</p>
        </div>
      </div>

      {/* Period Filter */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Período de Análise
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <DateRangePicker
              startDate={customStartDate}
              endDate={customEndDate}
              onDateChange={(start, end) => {
                setCustomStartDate(start);
                setCustomEndDate(end);
              }}
              placeholder="Selecionar período"
            />
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

      {/* Creative Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Seleção de Criativos ({selectedCreatives.length}/10)
            </span>
            {selectedCreatives.length > 0 && (
              <Button
                onClick={handleShowHistory}
                disabled={loadingData}
                className="ml-4"
              >
                {loadingData ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Carregando...
                  </>
                ) : (
                  <>
                    <Calendar className="h-4 w-4 mr-2" />
                    Ver Histórico
                  </>
                )}
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-96">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {availableCreatives.map(creative => {
                const isSelected = selectedCreatives.some(c => c.ad_id === creative.ad_id);
                const canSelect = selectedCreatives.length < 10 || isSelected;
                
                return (
                  <div 
                    key={creative.ad_id}
                    className={`flex items-center space-x-3 p-3 rounded-lg border transition-all ${
                      isSelected ? 'border-primary bg-primary/5' : 
                      canSelect ? 'border-border hover:border-primary/50' : 'opacity-50 border-muted'
                    }`}
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={(checked) => handleCreativeToggle(creative, checked as boolean)}
                      disabled={!canSelect}
                    />
                    <div className="w-8 h-8 rounded overflow-hidden bg-muted flex-shrink-0">
                      <CreativeDisplay
                        adName={creative.ad_name}
                        imageUrl={creative.image_url}
                        videoUrl={creative.video_url}
                        localMaterialId={creative.local_material_id}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{creative.ad_name}</p>
                      <p className="text-xs text-muted-foreground truncate">{creative.campaign_name}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {showResults && (
        <>
          {/* Controls */}
          <Card>
            <CardHeader>
              <CardTitle>Controles de Visualização</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Métrica</label>
                <Select value={selectedMetric} onValueChange={setSelectedMetric}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="impressions">Impressões</SelectItem>
                    <SelectItem value="clicks">Cliques</SelectItem>
                    <SelectItem value="results">Resultados</SelectItem>
                    <SelectItem value="spend">Investimento</SelectItem>
                    <SelectItem value="ctr">CTR</SelectItem>
                    <SelectItem value="cpc">CPC</SelectItem>
                    <SelectItem value="reach">Alcance</SelectItem>
                    <SelectItem value="conversionRate">Taxa de Resultados</SelectItem>
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
                    <SelectItem value="bar">Barras</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {chartType === 'line' ? <LineChartIcon className="h-5 w-5" /> : <BarChart3 className="h-5 w-5" />}
                Histórico de {selectedMetric === 'impressions' ? 'Impressões' : 
                             selectedMetric === 'clicks' ? 'Cliques' :
                             selectedMetric === 'results' ? 'Resultados' :
                             selectedMetric === 'spend' ? 'Investimento' :
                             selectedMetric === 'ctr' ? 'CTR' :
                             selectedMetric === 'cpc' ? 'CPC' :
                             selectedMetric === 'reach' ? 'Alcance' : 'Taxa de Resultados'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingData ? (
                <div className="flex items-center justify-center h-64">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={400}>
                  {chartType === 'line' ? (
                    <LineChart data={displayChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip content={<CustomTooltip />} />
                       <Legend 
                         content={({ payload }) => (
                           <div className="mt-4">
                             <div className="flex flex-col space-y-2">
                               {(showAllLegend ? payload : payload?.slice(0, 3))?.map((entry: any, index: number) => (
                                 <div key={index} className="flex items-center space-x-2">
                                   <div 
                                     className="w-3 h-3 rounded-full" 
                                     style={{ backgroundColor: entry.color }}
                                   />
                                   <span className="text-sm truncate">{entry.value}</span>
                                 </div>
                               ))}
                               {payload && payload.length > 3 && (
                                 <Button
                                   variant="ghost"
                                   size="sm"
                                   onClick={() => setShowAllLegend(!showAllLegend)}
                                   className="self-start p-0 h-auto text-xs"
                                 >
                                   {showAllLegend ? (
                                     <>
                                       <ChevronUp className="h-3 w-3 mr-1" />
                                       Ver menos
                                     </>
                                   ) : (
                                     <>
                                       <ChevronDown className="h-3 w-3 mr-1" />
                                       Ver mais
                                     </>
                                   )}
                                 </Button>
                               )}
                             </div>
                           </div>
                         )}
                       />
                       {selectedCreatives.map((creative, index) => (
                         <Line
                           key={creative.ad_id}
                           type="monotone"
                           dataKey={`ad_${creative.ad_id}`}
                           stroke={getCreativeColor(index)}
                           strokeWidth={2}
                           name={creative.ad_name}
                         />
                       ))}
                    </LineChart>
                  ) : (
                    <BarChart data={displayChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip content={<CustomTooltip />} />
                       <Legend 
                         content={({ payload }) => (
                           <div className="mt-4">
                             <div className="flex flex-col space-y-2">
                               {(showAllLegend ? payload : payload?.slice(0, 3))?.map((entry: any, index: number) => (
                                 <div key={index} className="flex items-center space-x-2">
                                   <div 
                                     className="w-3 h-3 rounded-full" 
                                     style={{ backgroundColor: entry.color }}
                                   />
                                   <span className="text-sm truncate">{entry.value}</span>
                                 </div>
                               ))}
                               {payload && payload.length > 3 && (
                                 <Button
                                   variant="ghost"
                                   size="sm"
                                   onClick={() => setShowAllLegend(!showAllLegend)}
                                   className="self-start p-0 h-auto text-xs"
                                 >
                                   {showAllLegend ? (
                                     <>
                                       <ChevronUp className="h-3 w-3 mr-1" />
                                       Ver menos
                                     </>
                                   ) : (
                                     <>
                                       <ChevronDown className="h-3 w-3 mr-1" />
                                       Ver mais
                                     </>
                                   )}
                                 </Button>
                               )}
                             </div>
                           </div>
                         )}
                       />
                       {selectedCreatives.map((creative, index) => (
                         <Bar
                           key={creative.ad_id}
                           dataKey={`ad_${creative.ad_id}`}
                           fill={getCreativeColor(index)}
                           name={creative.ad_name}
                         />
                       ))}
                    </BarChart>
                  )}
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-64">
                  <div className="text-center">
                    <Target className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">Nenhum dado encontrado para o período selecionado</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Individual Summary Cards for Each Creative */}
          {Object.keys(individualStats).length > 0 && (
            <div className="space-y-6">
              {selectedCreatives.map((creative, creativeIndex) => {
                const stats = individualStats[creative.ad_id];
                if (!stats) return null;

                return (
                  <div key={creative.ad_id} className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: getCreativeColor(creativeIndex) }}
                      />
                      <h3 className="text-lg font-semibold truncate">{creative.ad_name}</h3>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <Card>
                        <CardContent className="p-6">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm text-muted-foreground">Melhor Dia</p>
                              <p className="text-2xl font-bold">
                                {formatValue(stats.bestValue, selectedMetric)}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {stats.bestDay}
                              </p>
                            </div>
                            <Calendar className="h-8 w-8 text-muted-foreground" />
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardContent className="p-6">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm text-muted-foreground">Média do Período</p>
                              <p className="text-2xl font-bold">
                                {formatValue(stats.avgValue, selectedMetric)}
                              </p>
                            </div>
                            <Target className="h-8 w-8 text-muted-foreground" />
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardContent className="p-6">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm text-muted-foreground">Tendência</p>
                              <p className={`text-2xl font-bold ${stats.trendPercentage >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {stats.trendPercentage >= 0 ? '+' : ''}{stats.trendPercentage.toFixed(1)}%
                              </p>
                              <p className={`text-sm ${stats.trendPercentage >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {stats.trendPercentage >= 0 ? 'Crescimento' : 'Declínio'}
                              </p>
                            </div>
                            {stats.trendPercentage >= 0 ? (
                              <TrendingUp className="h-8 w-8 text-green-600" />
                            ) : (
                              <TrendingDown className="h-8 w-8 text-red-600" />
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
};