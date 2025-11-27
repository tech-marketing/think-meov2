import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { Badge } from "@/components/ui/badge";
import { useMetaAdsDirect } from "@/contexts/MetaAdsDirectContext";
import { CreativeComparisonOverlay } from "@/components/CreativeComparisonOverlay";
import { GitCompare, Target, Plus, Calendar, Loader2, BarChart3 } from "lucide-react";
import { CreativeDisplay } from "@/components/CreativeDisplay";
import { HistoricalAnalysisSection } from "@/components/HistoricalAnalysisSection";

export const CreativeComparison: React.FC = () => {
  const { 
    adsData, 
    startDate, 
    endDate, 
    setStartDate, 
    setEndDate, 
    fetchData, 
    loadingAds 
  } = useMetaAdsDirect();
  const [activeSection, setActiveSection] = useState<'comparison' | 'historical-analysis'>('comparison');
  const [selectedCreatives, setSelectedCreatives] = useState<any[]>([]);
  const [showComparison, setShowComparison] = useState(false);
  const [customStartDate, setCustomStartDate] = useState<string>(startDate || '');
  const [customEndDate, setCustomEndDate] = useState<string>(endDate || '');

  useEffect(() => {
    setCustomStartDate(startDate || '');
    setCustomEndDate(endDate || '');
  }, [startDate, endDate]);

  if (!adsData) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-64">
          <div className="text-center">
            <p className="text-muted-foreground mb-2">Nenhum dado carregado</p>
            <p className="text-sm text-muted-foreground">
              Aplique os filtros no Dashboard para carregar dados para comparação
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ... keep existing code (data validation and campaign/objectives extraction)

  // Filter creatives based on loaded data (no manual filters)
  let filteredCreatives = adsData.top_creatives;

  const handleCreativeSelect = (creative: any) => {
    if (selectedCreatives.find(c => c.ad_id === creative.ad_id)) {
      setSelectedCreatives(selectedCreatives.filter(c => c.ad_id !== creative.ad_id));
    } else if (selectedCreatives.length < 3) {
      setSelectedCreatives([...selectedCreatives, creative]);
    }
  };

  const handleCompare = () => {
    if (selectedCreatives.length >= 2) {
      setShowComparison(true);
    }
  };

  const handleApplyPeriod = () => {
    setStartDate(customStartDate);
    setEndDate(customEndDate);
    fetchData();
  };

  return (
    <div className="flex gap-6">
      {/* Sidebar Navigation */}
      <div className="w-80 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Navegação</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button
              variant={activeSection === 'comparison' ? 'default' : 'ghost'}
              className="w-full justify-start"
              onClick={() => setActiveSection('comparison')}
            >
              <GitCompare className="h-4 w-4 mr-2" />
              Comparação
            </Button>
            <Button
              variant={activeSection === 'historical-analysis' ? 'default' : 'ghost'}
              className="w-full justify-start"
              onClick={() => setActiveSection('historical-analysis')}
            >
              <BarChart3 className="h-4 w-4 mr-2" />
              Análise de Histórico
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <div className="flex-1">
        {activeSection === 'comparison' && (
          <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold flex items-center gap-2">
                  <GitCompare className="h-6 w-6" />
                  Comparação de Criativos
                </h2>
                <p className="text-muted-foreground">Compare até 3 criativos lado a lado</p>
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
              <CardContent className="space-y-4">
                <DateRangePicker
                  startDate={customStartDate}
                  endDate={customEndDate}
                  onDateChange={(start, end) => {
                    setCustomStartDate(start);
                    setCustomEndDate(end);
                  }}
                  placeholder="Selecionar período para comparação"
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
              </CardContent>
            </Card>

            {/* Creative Selection */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <GitCompare className="h-5 w-5" />
                  Selecionar Criativos ({selectedCreatives.length}/3)
                </h3>
                {selectedCreatives.length >= 2 && (
                  <p className="text-sm text-muted-foreground">
                    Selecione no mínimo 2 criativos
                  </p>
                )}
              </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {filteredCreatives.map(creative => {
            const isSelected = selectedCreatives.find(c => c.ad_id === creative.ad_id);
            const canSelect = selectedCreatives.length < 3 || isSelected;
            
            return (
              <Card 
                key={creative.ad_id}
                className={`relative group cursor-pointer transition-all border-2 ${
                  isSelected ? 'border-primary bg-primary/5 shadow-lg' : 
                  canSelect ? 'border-border hover:border-primary/50 hover:shadow-md' : 'opacity-50 cursor-not-allowed border-muted'
                }`}
                onClick={() => canSelect && handleCreativeSelect(creative)}
              >
                {/* Add Button */}
                <div className={`absolute top-2 right-2 z-10 ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                    isSelected ? 'bg-primary text-primary-foreground' : 'bg-background border border-border'
                  }`}>
                    {isSelected ? '✓' : <Plus className="h-3 w-3" />}
                  </div>
                </div>

                <CardContent className="p-0">
                  {/* Creative Title */}
                  <div className="p-3 pb-2">
                    <h4 className="font-medium text-sm line-clamp-2 mb-1">
                      {creative.ad_name}
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      {creative.campaign_name}
                    </p>
                  </div>

                  {/* Creative Image */}
                  <div className="aspect-square mx-3 mb-3 rounded-lg overflow-hidden bg-muted">
                    <CreativeDisplay 
                      adName={creative.ad_name}
                      imageUrl={creative.image_url}
                      videoUrl={creative.video_url}
                      localMaterialId={creative.local_material_id}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  {/* Metrics */}
                  <div className="p-3 pt-0 space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">CTR:</span>
                      <span className="font-medium">{(creative.metrics.ctr || 0).toFixed(2)}%</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Resultados:</span>
                      <span className="font-medium">{creative.metrics.results || creative.metrics.conversions || 0}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {filteredCreatives.length === 0 && (
          <div className="text-center py-12">
            <Target className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              Nenhum criativo encontrado com os filtros selecionados
            </p>
          </div>
        )}
      </div>

      {/* Floating Compare Button */}
      {selectedCreatives.length >= 2 && (
        <div className="fixed bottom-6 right-6 z-[200]">
          <Button 
            type="button"
            size="lg"
            onClick={handleCompare}
            className="shadow-lg hover:shadow-xl transition-all pointer-events-auto"
          >
            <GitCompare className="h-5 w-5 mr-2" />
            Comparar ({selectedCreatives.length}) Criativos
          </Button>
        </div>
      )}

            {/* Comparison Overlay */}
            <CreativeComparisonOverlay
              creatives={selectedCreatives}
              compareBy="ctr"
              isOpen={showComparison}
              onClose={() => setShowComparison(false)}
            />
          </div>
        )}

        {activeSection === 'historical-analysis' && (
          <HistoricalAnalysisSection />
        )}
      </div>
    </div>
  );
};