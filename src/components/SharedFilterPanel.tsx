import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { Search, Filter } from "lucide-react";
import { format } from "date-fns";

interface SharedFilterPanelProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  accountFilter: string;
  onAccountChange: (value: string) => void;
  campaignFilter: string[];
  onCampaignChange: (value: string[]) => void;
  statusFilter: string;
  onStatusChange: (value: string) => void;
  dateRange: string;
  onDateRangeChange: (value: string) => void;
  accounts: any[];
  campaigns: any[];
  onApplyFilters: () => void;
}

export const SharedFilterPanel: React.FC<SharedFilterPanelProps> = ({
  searchTerm,
  onSearchChange,
  accountFilter,
  onAccountChange,
  campaignFilter,
  onCampaignChange,
  statusFilter,
  onStatusChange,
  dateRange,
  onDateRangeChange,
  accounts,
  campaigns,
  onApplyFilters
}) => {
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [platformFilter, setPlatformFilter] = useState('all');
  const [formatFilter, setFormatFilter] = useState('all');
  const [campaignSearch, setCampaignSearch] = useState('');

  // Initialize dates based on dateRange
  React.useEffect(() => {
    const now = new Date();
    let start: Date;
    
    switch (dateRange) {
      case 'last_7_days':
        start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'last_30_days':
        start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case 'last_90_days':
        start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case 'last_6_months':
        start = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
        break;
      case 'last_year':
        start = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      default:
        start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }
    
    setStartDate(start);
    setEndDate(now);
  }, [dateRange]);

  const periodButtons = [
    { value: 'last_7_days', label: 'Últimos 7 dias' },
    { value: 'last_30_days', label: 'Últimos 30 dias' },
    { value: 'last_90_days', label: 'Últimos 90 dias' },
    { value: 'last_6_months', label: 'Últimos 6 meses' },
    { value: 'last_year', label: 'Último ano' },
  ];

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
            <Select value={accountFilter} onValueChange={onAccountChange}>
              <SelectTrigger>
                <SelectValue placeholder={accounts.length > 0 ? "Selecionar conta" : "Nenhuma conta encontrada"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as contas</SelectItem>
                {accounts.map((account) => (
                  <SelectItem key={account.account_id} value={account.account_id}>
                    {account.account_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Plataforma</label>
            <Select value={platformFilter} onValueChange={setPlatformFilter}>
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
            <Select value={formatFilter} onValueChange={setFormatFilter}>
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

        {/* Period Analysis Section */}
        <div>
          <h3 className="text-sm font-medium mb-4">Período de Análise</h3>
          <DateRangePicker
            startDate={startDate ? startDate.toISOString().split('T')[0] : undefined}
            endDate={endDate ? endDate.toISOString().split('T')[0] : undefined}
            onDateChange={(start, end) => {
              setStartDate(new Date(start));
              setEndDate(new Date(end));
            }}
            placeholder="Selecionar período"
            className="mb-4"
          />

          {/* Period Buttons */}
          <div className="flex flex-wrap gap-2">
            {periodButtons.map((period) => (
              <Button
                key={period.value}
                variant={dateRange === period.value ? "default" : "outline"}
                size="sm"
                onClick={() => onDateRangeChange(period.value)}
              >
                {period.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Campaigns Section */}
        <div>
          <label className="text-sm font-medium mb-3 block">
            Campanhas (Seleção Múltipla)
          </label>
          {accountFilter !== 'all' ? (
            campaigns.length > 0 ? (
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
                    {campaigns
                      .filter(campaign => 
                        campaignSearch === '' || 
                        campaign.campaign_name.toLowerCase().includes(campaignSearch.toLowerCase())
                      )
                      .sort((a, b) => {
                        // Sort by status (ACTIVE first) then by creation date
                        if (a.status === 'ACTIVE' && b.status !== 'ACTIVE') return -1;
                        if (b.status === 'ACTIVE' && a.status !== 'ACTIVE') return 1;
                        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
                      })
                      .map((campaign, index, filteredArray) => (
                      <label 
                        key={campaign.campaign_id} 
                        className={`flex items-center space-x-4 p-4 hover:bg-gradient-to-r hover:from-primary/5 hover:to-accent/5 transition-all duration-300 cursor-pointer group border-l-4 hover:border-l-primary ${
                          index !== filteredArray.length - 1 ? 'border-b border-border/20' : ''
                        } ${campaignFilter.includes(campaign.campaign_id) ? 'bg-gradient-to-r from-primary/10 to-accent/10 border-l-primary' : 'border-l-transparent'}`}
                      >
                        <div className="relative flex-shrink-0 w-6 h-6 flex items-center justify-center">
                          <input
                            type="checkbox"
                            checked={campaignFilter.includes(campaign.campaign_id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                onCampaignChange([...campaignFilter, campaign.campaign_id]);
                              } else {
                                onCampaignChange(campaignFilter.filter(id => id !== campaign.campaign_id));
                              }
                            }}
                            className="sr-only"
                          />
                          {campaignFilter.includes(campaign.campaign_id) && (
                            <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                              <svg className="w-4 h-4 text-primary-foreground" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between">
                            <div className="flex-1 min-w-0 pr-4">
                              <div className="font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-2 leading-snug text-base mb-2">
                                {campaign.campaign_name}
                              </div>
                              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                <div className="flex items-center gap-1">
                                  <div className="w-2 h-2 rounded-full bg-primary"></div>
                                  <span className="font-medium">
                                    {campaign.objective?.replace('OUTCOME_', '')?.toLowerCase()?.replace('_', ' ') || 'Objetivo não definido'}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
                
                <div className="flex items-center justify-between text-xs px-1">
                  <span className="text-muted-foreground">
                    {campaigns.filter(campaign => 
                      campaignSearch === '' || 
                      campaign.campaign_name.toLowerCase().includes(campaignSearch.toLowerCase())
                    ).length} de {campaigns.length} campanha(s)
                  </span>
                  <span className="font-medium text-primary">
                    {campaignFilter.length} selecionada(s)
                  </span>
                </div>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground p-6 border rounded-lg bg-muted/30 text-center">
                <div className="text-lg mb-2">Carregando campanhas...</div>
                <div className="text-xs">Aguarde um momento</div>
              </div>
            )
          ) : (
            <div className="text-sm text-muted-foreground p-6 border rounded-lg bg-muted/30 text-center">
              <div className="text-lg mb-2">Selecione uma conta</div>
              <div className="text-xs">Escolha uma conta para ver as campanhas disponíveis</div>
            </div>
          )}
        </div>


        {/* Action Buttons */}
        <div className="flex justify-end items-center pt-4 border-t">
          <div className="flex gap-2">
            <Button 
              className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white shadow-lg transform transition-all duration-300 hover:scale-105 active:scale-95 active:shadow-[0_0_25px_hsl(262,83%,58%,0.4)]"
              onClick={onApplyFilters}
              disabled={accountFilter === 'all' || (accountFilter !== 'all' && campaignFilter.length === 0)}
            >
              {accountFilter === 'all' ? 'Selecione uma Conta' : 
               campaignFilter.length === 0 ? 'Selecione Campanhas' : 
               'Aplicar Filtros'}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};