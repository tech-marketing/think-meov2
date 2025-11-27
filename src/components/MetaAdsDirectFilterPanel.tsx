import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { Input } from "@/components/ui/input";
import { useMetaAdsDirect } from "@/contexts/MetaAdsDirectContext";
import { Filter, Search, Loader2, Target } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const MetaAdsDirectFilterPanel: React.FC = () => {
  const {
    accounts,
    campaigns,
    selectedAccount,
    selectedCampaigns,
    startDate,
    endDate,
    platform,
    format: adFormat,
    objective,
    competitorKeyword,
    competitorAds,
    loadingAccounts,
    loadingCampaigns,
    loadingAds,
    loadingCompetitors,
    loadingStatus,
    setSelectedAccount,
    setSelectedCampaigns,
    setStartDate,
    setEndDate,
    setPlatform,
    setFormat,
    setObjective,
    setCompetitorKeyword,
    fetchData,
    fetchCompetitorAds,
    isValidDateRange
  } = useMetaAdsDirect();

  const [campaignSearch, setCampaignSearch] = React.useState('');

  const filteredCampaigns = campaigns.filter(campaign =>
    campaignSearch === '' ||
    campaign.name.toLowerCase().includes(campaignSearch.toLowerCase())
  );

  const canApplyFilters = selectedAccount && selectedAccount !== 'all';

  // Handle apply filters with competitor ads support
  const handleApplyFiltersWithCompetitors = async () => {
    if (!isValidDateRange()) {
      return;
    }

    // Se houver keyword de análise competitiva, buscar primeiro
    if (competitorKeyword && competitorKeyword.trim().length >= 3) {
      console.log(`🎯 Iniciando busca competitiva para: "${competitorKeyword}"`);
      await fetchCompetitorAds(competitorKeyword.trim());
    }

    // Buscar dados normais do Meta
    fetchData();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Filter className="h-5 w-5" />
          Filtros e Controles
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Top Row - Account, Platform, Format */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Conta de Anúncios</label>
            <Select 
              value={selectedAccount} 
              onValueChange={setSelectedAccount}
              disabled={loadingAccounts}
            >
              <SelectTrigger>
                <SelectValue placeholder={
                  loadingAccounts ? "Carregando..." : 
                  accounts.length > 0 ? "Selecionar conta" : "Nenhuma conta encontrada"
                } />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as contas</SelectItem>
                {accounts.map((account) => (
                  <SelectItem key={account.account_id} value={account.account_id}>
                    {account.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Plataforma</label>
            <Select value={platform} onValueChange={setPlatform}>
              <SelectTrigger>
                <SelectValue placeholder="Todas as Plataformas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as Plataformas</SelectItem>
                <SelectItem value="facebook">Facebook</SelectItem>
                <SelectItem value="instagram">Instagram</SelectItem>
                <SelectItem value="messenger">Messenger</SelectItem>
                <SelectItem value="audience_network">Audience Network</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Formato do Anúncio</label>
            <Select value={adFormat} onValueChange={setFormat}>
              <SelectTrigger>
                <SelectValue placeholder="Todos os Formatos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Formatos</SelectItem>
                <SelectItem value="single_image">Imagem única</SelectItem>
                <SelectItem value="single_video">Vídeo único</SelectItem>
                <SelectItem value="carousel">Carrossel</SelectItem>
                <SelectItem value="collection">Coleção</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Análise Competitiva - NOVO */}
        <div>
          <label className="text-sm font-medium mb-2 block flex items-center gap-2">
            <Target className="h-4 w-4" />
            Análise Competitiva (Opcional)
          </label>
          <div className="space-y-2">
            <Input
              placeholder="Ex: moda feminina, cosméticos naturais..."
              value={competitorKeyword}
              onChange={(e) => setCompetitorKeyword(e.target.value)}
              className="w-full"
            />
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                💡 Insira um nicho ou palavra-chave para comparar com anúncios de concorrentes
              </p>
              {loadingCompetitors && (
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
              )}
            </div>
          </div>
        </div>

        {/* Date Range */}
        <div>
          <h3 className="text-sm font-medium mb-4">Período de Análise</h3>
          <DateRangePicker
            startDate={startDate}
            endDate={endDate}
            onDateChange={(start, end) => {
              setStartDate(start);
              setEndDate(end);
            }}
            placeholder="Selecionar período de análise"
          />
        </div>

        {/* Campaigns Section */}
        {selectedAccount && selectedAccount !== 'all' && (
          <div>
            <label className="text-sm font-medium mb-3 block">
              Campanhas (Seleção Múltipla)
            </label>
            {loadingCampaigns ? (
              <div className="text-sm text-muted-foreground p-6 border rounded-lg bg-muted/30 text-center">
                <div className="text-lg mb-2">Carregando campanhas...</div>
                <div className="text-xs">Aguarde um momento</div>
              </div>
            ) : campaigns.length > 0 ? (
              <div className="space-y-4">
                {/* Campaign Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar campanhas por nome..."
                    value={campaignSearch}
                    onChange={(e) => setCampaignSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>

                <div className="bg-card border rounded-lg shadow-sm overflow-hidden">
                  <div className="max-h-64 overflow-y-auto">
                    {filteredCampaigns.map((campaign, index) => (
                      <label 
                        key={campaign.campaign_id} 
                        className={`flex items-center space-x-4 p-4 hover:bg-gradient-to-r hover:from-primary/5 hover:to-accent/5 transition-all duration-300 cursor-pointer group border-l-4 hover:border-l-primary ${
                          index !== filteredCampaigns.length - 1 ? 'border-b border-border/20' : ''
                        } ${selectedCampaigns.includes(campaign.campaign_id) ? 'bg-gradient-to-r from-primary/10 to-accent/10 border-l-primary' : 'border-l-transparent'}`}
                      >
                        <div className="relative flex-shrink-0 w-6 h-6 flex items-center justify-center">
                          <input
                            type="checkbox"
                            checked={selectedCampaigns.includes(campaign.campaign_id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedCampaigns([...selectedCampaigns, campaign.campaign_id]);
                              } else {
                                setSelectedCampaigns(selectedCampaigns.filter(id => id !== campaign.campaign_id));
                              }
                            }}
                            className="sr-only"
                          />
                          {selectedCampaigns.includes(campaign.campaign_id) && (
                            <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                              <svg className="w-4 h-4 text-primary-foreground" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-2 leading-snug text-base mb-2">
                            {campaign.name}
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <div className="w-2 h-2 rounded-full bg-primary"></div>
                              <span className="font-medium">
                                {campaign.objective || 'Objetivo não definido'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
                
                <div className="flex items-center justify-between text-xs px-1">
                  <span className="text-muted-foreground">
                    {filteredCampaigns.length} de {campaigns.length} campanha(s)
                  </span>
                  <span className="font-medium text-primary">
                    {selectedCampaigns.length} selecionada(s)
                  </span>
                </div>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground p-6 border rounded-lg bg-muted/30 text-center">
                <div className="text-lg mb-2">Nenhuma campanha encontrada</div>
                <div className="text-xs">Esta conta não possui campanhas no período selecionado</div>
              </div>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-3 pt-4 border-t">
          {loadingCompetitors && (
            <div className="space-y-2 p-4 bg-muted/30 rounded-lg border border-primary/20">
              <div className="flex items-center gap-3">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <div className="flex-1">
                  <p className="text-sm font-medium">Buscando anúncios de concorrentes</p>
                  <p className="text-xs text-muted-foreground">Analisando anúncios relacionados ao nicho informado</p>
                </div>
              </div>
            </div>
          )}
          {loadingAds && loadingStatus.phase !== 'idle' && (
            <div className="space-y-2 p-4 bg-muted/30 rounded-lg border border-primary/20">
              <div className="flex items-center gap-3">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <div className="flex-1">
                  <p className="text-sm font-medium">{loadingStatus.message}</p>
                  <p className="text-xs text-muted-foreground">{loadingStatus.description}</p>
                </div>
                <span className="text-xs font-medium text-primary">{loadingStatus.progress}%</span>
              </div>
              <Progress value={loadingStatus.progress} className="h-1.5" />
            </div>
          )}
          
          <div className="flex justify-end">
            <Button 
              className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white shadow-lg transform transition-all duration-300 hover:scale-105 active:scale-95"
              onClick={handleApplyFiltersWithCompetitors}
              disabled={!canApplyFilters || loadingAds || !isValidDateRange()}
            >
              {loadingAds ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {loadingStatus.message || 'Carregando...'}
                </>
              ) : !canApplyFilters ? 'Selecione uma Conta' : 'Aplicar Filtros'}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};