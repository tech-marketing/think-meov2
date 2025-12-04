import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface MetaAccount {
  id: string;
  account_id: string;
  name: string;
  currency: string;
  timezone: string;
  status: string;
}

interface MetaCampaign {
  id: string;
  campaign_id: string;
  name: string;
  status: string;
  objective: string;
  created_at: string;
}

interface MetaAdMetrics {
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  spend: number;
  results: number;
  cost_per_result: number;
  conversions: number;
  conversion_rate: number;
  roas: number;
  reach: number;
  frequency: number;
  cpm: number;
  cpp: number;
  lpv: number;
  cost_per_lpv: number;
  thruplays: number;
  cost_per_thruplay: number;
  engagements: number;
}

interface MetaAd {
  id: string;
  ad_id: string;
  ad_name: string;
  status: string;
  campaign_id: string;
  campaign_name: string;
  campaign_objective: string;
  adset_id: string | null;
  adset_name: string | null;
  creative_id: string | null;
  image_url: string | null;
  video_url: string | null;
  local_material_id: string | null;
  taxonomy_status: string;
  metrics: MetaAdMetrics;
}

interface AdsData {
  campaigns: MetaCampaign[];
  ads: MetaAd[];
  top_creatives: MetaAd[];
  summary: {
    total_impressions: number;
    total_reach: number;
    total_clicks: number;
    average_ctr: number;
    total_results: number;
    average_cpa: number;
    average_conversion_rate: number;
    average_frequency: number;
    average_roas: number;
    total_spend: number;
  };
}

interface CompetitorAd {
  id: string;
  ad_id: string;
  ad_name: string;
  page_name: string;
  image_urls: string[] | null;
  video_url: string | null;
  ad_copy: string | null;
  cta_text: string | null;
  ad_format: string;
  platform_positions: string[] | null;
  started_running_date: string | null;
  scraped_at: string;
}

interface LoadingStatus {
  phase: 'idle' | 'fetching-ads' | 'processing-metrics' | 'calculating' | 'enriching-taxonomy' | 'finalizing' | 'complete';
  message: string;
  description: string;
  progress: number;
}

interface MetaAdsDirectContextType {
  // Data
  accounts: MetaAccount[];
  campaigns: MetaCampaign[];
  adsData: AdsData | null;

  // Meta Connection
  metaConnected: boolean;
  metaLoading: boolean;
  checkMetaConnection: () => Promise<void>;

  // Competitor Analysis
  competitorKeyword: string;
  competitorAds: CompetitorAd[] | null;
  competitorSearchPhase: 'idle' | 'searching' | 'completed' | 'error';

  // Loading states
  loadingAccounts: boolean;
  loadingCampaigns: boolean;
  loadingAds: boolean;
  loadingCompetitors: boolean;
  loadingStatus: LoadingStatus;

  // Filters
  selectedAccount: string;
  selectedCampaigns: string[];
  startDate: string;
  endDate: string;
  platform: string;
  format: string;
  objective: string;

  // Actions
  setSelectedAccount: (accountId: string) => void;
  setSelectedCampaigns: (campaignIds: string[]) => void;
  setStartDate: (date: string) => void;
  setEndDate: (date: string) => void;
  setPlatform: (platform: string) => void;
  setFormat: (format: string) => void;
  setObjective: (objective: string) => void;
  setCompetitorKeyword: (keyword: string) => void;

  fetchData: () => Promise<void>;
  loadAccounts: () => Promise<void>;
  loadCampaigns: (accountId: string) => Promise<void>;
  fetchCompetitorAds: (keyword: string, forceRefresh?: boolean) => Promise<void>;

  // Utilities
  isValidDateRange: () => boolean;
  resetFilters: () => void;
}

export type { LoadingStatus, CompetitorAd };

const MetaAdsDirectContext = createContext<MetaAdsDirectContextType | null>(null);

export const useMetaAdsDirect = () => {
  const context = useContext(MetaAdsDirectContext);
  if (!context) {
    throw new Error('useMetaAdsDirect must be used within a MetaAdsDirectProvider');
  }
  return context;
};

interface MetaAdsDirectProviderProps {
  children: React.ReactNode;
}

export const MetaAdsDirectProvider: React.FC<MetaAdsDirectProviderProps> = ({ children }) => {
  // Data state
  const [accounts, setAccounts] = useState<MetaAccount[]>([]);
  const [campaigns, setCampaigns] = useState<MetaCampaign[]>([]);
  const [adsData, setAdsData] = useState<AdsData | null>(null);
  const [error, setError] = useState<string>('');

  // Meta Connection state
  const [metaConnected, setMetaConnected] = useState(false);
  const [metaLoading, setMetaLoading] = useState(true);

  // Competitor Analysis state
  const [competitorKeyword, setCompetitorKeyword] = useState('');
  const [competitorAds, setCompetitorAds] = useState<CompetitorAd[] | null>(null);
  const [competitorSearchPhase, setCompetitorSearchPhase] = useState<'idle' | 'searching' | 'completed' | 'error'>('idle');

  // Loading states
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [loadingCampaigns, setLoadingCampaigns] = useState(false);
  const [loadingAds, setLoadingAds] = useState(false);
  const [loadingCompetitors, setLoadingCompetitors] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState<LoadingStatus>({
    phase: 'idle',
    message: '',
    description: '',
    progress: 0
  });

  // Filter state
  const [selectedAccount, setSelectedAccount] = useState('');
  const [selectedCampaigns, setSelectedCampaigns] = useState<string[]>([]);
  const [platform, setPlatform] = useState('all');
  const [format, setFormat] = useState('all');
  const [objective, setObjective] = useState('all');

  // Date state - default to last 30 days
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 30);
    return date.toISOString().split('T')[0];
  });

  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });

  // Load accounts on mount
  useEffect(() => {
    console.log('🚀 MetaAdsDirectContext montado, verificando conexão Meta...');
    checkMetaConnection();
  }, []);

  // Check Meta connection on mount
  const checkMetaConnection = useCallback(async () => {
    try {
      setMetaLoading(true);
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        setMetaConnected(false);
        setMetaLoading(false);
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('meta_access_token, meta_token_expires_at')
        .eq('user_id', user.id)
        .single();

      const hasValidToken = profile?.meta_access_token &&
        new Date(profile.meta_token_expires_at) > new Date();

      setMetaConnected(hasValidToken);

      // Se conectado, carregar contas
      if (hasValidToken) {
        await loadAccounts();
      }
    } catch (error) {
      console.error('Erro ao verificar conexão Meta:', error);
      setMetaConnected(false);
    } finally {
      setMetaLoading(false);
    }
  }, []);

  // Load campaigns when account is selected
  useEffect(() => {
    if (selectedAccount && selectedAccount !== 'all') {
      loadCampaigns(selectedAccount);
    } else {
      setCampaigns([]);
      setSelectedCampaigns([]);
    }
  }, [selectedAccount]);

  const loadAccounts = useCallback(async () => {
    console.log('🔄 loadAccounts iniciando...');
    setLoadingAccounts(true);
    setError(''); // Clear any previous errors

    try {
      console.log('🔄 Chamando edge function para carregar contas...');

      const { data, error } = await supabase.functions.invoke('metrics-direct', {
        body: { action: 'accounts' }
      });

      console.log('📋 Resposta da edge function:', { data, error });

      if (error) {
        console.error('❌ Erro na invocação da edge function:', error);

        // Check for ad blocker related errors
        if (error.message && error.message.includes('Failed to send a request to the Edge Function')) {
          throw new Error('Erro de bloqueador de anúncios detectado. Tente desabilitar seu ad blocker ou usar modo incógnito.');
        }

        throw new Error(`Edge Function Error: ${error.message}`);
      }

      if (data && data.success) {
        const accounts = data.data || [];
        console.log('✅ Contas recebidas:', accounts.length, accounts);
        setAccounts(accounts);

        toast({
          title: "Contas carregadas",
          description: `${accounts.length} contas encontradas.`,
        });
      } else {
        const errorMsg = data?.error || 'Erro desconhecido ao carregar contas';
        console.error('❌ Erro nos dados:', errorMsg);
        throw new Error(errorMsg);
      }
    } catch (error) {
      console.error('❌ Erro completo em loadAccounts:', error);

      toast({
        title: "Erro ao carregar contas",
        description: error.message || "Não foi possível carregar as contas do Meta.",
        variant: "destructive",
      });
      setAccounts([]);
      setError(error.message);
    } finally {
      console.log('🏁 loadAccounts finalizando');
      setLoadingAccounts(false);
    }
  }, []);

  const loadCampaigns = useCallback(async (accountId: string) => {
    setLoadingCampaigns(true);
    try {
      console.log(`🔄 Loading campaigns for account: ${accountId}`);

      const { data, error } = await supabase.functions.invoke('metrics-direct', {
        body: {
          action: 'campaigns',
          accountId,
          startDate,
          endDate
        }
      });

      if (error) throw error;

      if (data.success) {
        setCampaigns(data.data);
        console.log(`✅ Loaded ${data.data.length} campaigns`);
      } else {
        throw new Error(data.error || 'Failed to load campaigns');
      }
    } catch (error) {
      console.error('❌ Error loading campaigns:', error);
      toast({
        title: "Erro ao carregar campanhas",
        description: "Não foi possível carregar as campanhas. Tente novamente.",
        variant: "destructive",
      });
      setCampaigns([]);
    } finally {
      setLoadingCampaigns(false);
    }
  }, [startDate, endDate]);

  const fetchData = useCallback(async () => {
    if (!selectedAccount || selectedAccount === 'all') {
      toast({
        title: "Conta obrigatória",
        description: "Selecione uma conta de anúncios antes de aplicar os filtros.",
        variant: "destructive",
      });
      return;
    }

    if (!isValidDateRange()) {
      toast({
        title: "Intervalo de datas inválido",
        description: "A data de fim deve ser posterior à data de início e não pode ser no futuro.",
        variant: "destructive",
      });
      return;
    }

    setLoadingAds(true);

    // Phase 1: Fetching ads
    setLoadingStatus({
      phase: 'fetching-ads',
      message: 'Coletando dados da conta',
      description: 'Buscando anúncios ativos...',
      progress: 15
    });

    try {
      console.log('🔄 Fetching ads data with filters:', {
        selectedAccount,
        selectedCampaigns: selectedCampaigns.length,
        startDate,
        endDate,
        platform,
        format,
        objective
      });

      const { data, error } = await supabase.functions.invoke('metrics-direct', {
        body: {
          action: 'ads',
          accountId: selectedAccount,
          startDate,
          endDate,
          selectedCampaigns,
          platform,
          format,
          objective
        }
      });

      if (error) throw error;

      // Phase 2: Processing metrics
      setLoadingStatus({
        phase: 'processing-metrics',
        message: 'Processando campanhas',
        description: 'Analisando métricas de performance...',
        progress: 35
      });

      if (data.success) {
        // Handle both response formats: AdsData object or simple array
        let normalizedData: AdsData;

        if (Array.isArray(data.data)) {
          // Edge function returned simple array - normalize to AdsData format
          const adsArray = data.data.map((ad: any) => ({
            id: ad.id,
            ad_id: ad.id,
            ad_name: ad.name,
            status: ad.status,
            campaign_id: ad.campaign_id,
            campaign_name: ad.campaign_name,
            campaign_objective: ad.campaign_objective,
            adset_id: ad.adset_id,
            adset_name: ad.adset_name,
            creative_id: ad.creative_id,
            image_url: ad.image_url,
            video_url: ad.video_url,
            taxonomy_status: 'pending',
            local_material_id: null,
            metrics: {
              impressions: Number(ad.metrics?.impressions ?? 0),
              clicks: Number(ad.metrics?.clicks ?? 0),
              ctr: Number(ad.metrics?.ctr ?? 0),
              cpc: Number(ad.metrics?.cpc ?? 0),
              spend: Number(ad.metrics?.spend ?? 0),
              results: Number(ad.metrics?.results ?? 0),
              cost_per_result: Number(ad.metrics?.cost_per_result ?? 0),
              conversions: Number(ad.metrics?.conversions ?? 0),
              conversion_rate: Number(ad.metrics?.conversion_rate ?? 0),
              roas: Number(ad.metrics?.roas ?? 0),
              reach: Number(ad.metrics?.reach ?? 0),
              frequency: Number(ad.metrics?.frequency ?? 0),
              cpm: Number(ad.metrics?.cpm ?? 0),
              cpp: Number(ad.metrics?.cpp ?? 0),
              lpv: Number(ad.metrics?.lpv ?? 0),
              cost_per_lpv: Number(ad.metrics?.cost_per_lpv ?? 0),
              thruplays: Number(ad.metrics?.thruplays ?? 0),
              cost_per_thruplay: Number(ad.metrics?.cost_per_thruplay ?? 0),
              engagements: Number(ad.metrics?.engagements ?? 0)
            }
          }));

          // Phase 3: Calculating statistics
          setLoadingStatus({
            phase: 'calculating',
            message: 'Calculando estatísticas',
            description: 'Agregando dados de CTR, ROAS, conversões...',
            progress: 55
          });

          const totals = adsArray.reduce((acc, ad) => {
            const m = ad.metrics || ({} as any);
            acc.impressions += m.impressions || 0;
            acc.reach += m.reach || 0;
            acc.clicks += m.clicks || 0;
            acc.results += m.results || 0;
            acc.conversions += m.conversions || 0;
            acc.spend += m.spend || 0;
            acc.roasWeightedSum += (m.roas || 0) * (m.spend || 0);
            return acc;
          }, { impressions: 0, reach: 0, clicks: 0, results: 0, conversions: 0, spend: 0, roasWeightedSum: 0 });

          const average_ctr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;
          const average_conversion_rate = totals.clicks > 0 ? (totals.conversions / totals.clicks) * 100 : 0;
          const average_frequency = totals.reach > 0 ? totals.impressions / totals.reach : 0;
          const average_cpa = totals.results > 0 ? totals.spend / totals.results : 0;
          const average_roas = totals.spend > 0 ? (totals.roasWeightedSum / totals.spend) : 0;

          // Phase 4: Enriching with taxonomy
          setLoadingStatus({
            phase: 'enriching-taxonomy',
            message: 'Enriquecendo dados',
            description: 'Vinculando taxonomia e materiais...',
            progress: 75
          });

          // Enrich ads with taxonomy information
          await enrichAdsWithTaxonomy(adsArray, selectedAccount);

          normalizedData = {
            campaigns: [],
            ads: adsArray,
            top_creatives: adsArray,
            summary: {
              total_impressions: totals.impressions,
              total_reach: totals.reach,
              total_clicks: totals.clicks,
              average_ctr,
              total_results: totals.results,
              average_cpa,
              average_conversion_rate,
              average_frequency,
              average_roas,
              total_spend: totals.spend
            }
          };
        } else {
          // Already in AdsData format
          normalizedData = data.data;

          // Phase 4: Enriching with taxonomy
          setLoadingStatus({
            phase: 'enriching-taxonomy',
            message: 'Enriquecendo dados',
            description: 'Vinculando taxonomia e materiais...',
            progress: 75
          });

          // Enrich ads with taxonomy information even when API returns AdsData
          await enrichAdsWithTaxonomy(normalizedData.ads, selectedAccount);
        }

        // Phase 5: Finalizing
        setLoadingStatus({
          phase: 'finalizing',
          message: 'Finalizando análise',
          description: 'Preparando dashboard...',
          progress: 95
        });

        setAdsData(normalizedData);
        // Trigger materials refresh to update components that depend on local_material_id
        console.log('🔄 Triggering materials refresh after ads data update');
        console.log(`✅ Loaded ${normalizedData.ads.length} ads`);

        // Complete
        setLoadingStatus({
          phase: 'complete',
          message: 'Análise concluída',
          description: `${normalizedData.ads.length} anúncios carregados com sucesso`,
          progress: 100
        });

        toast({
          title: "Dados carregados com sucesso",
          description: `${normalizedData.ads.length} anúncios encontrados no período selecionado.`,
        });
      } else {
        throw new Error(data.error || 'Failed to fetch ads data');
      }
    } catch (error) {
      console.error('❌ Error fetching ads data:', error);
      toast({
        title: "Erro ao carregar dados",
        description: "Não foi possível carregar os dados dos anúncios. Tente novamente.",
        variant: "destructive",
      });
      setAdsData(null);
      setLoadingStatus({
        phase: 'idle',
        message: '',
        description: '',
        progress: 0
      });
    } finally {
      setLoadingAds(false);
      // Reset loading status after a short delay
      setTimeout(() => {
        setLoadingStatus({
          phase: 'idle',
          message: '',
          description: '',
          progress: 0
        });
      }, 1000);
    }
  }, [selectedAccount, selectedCampaigns, startDate, endDate, platform, format, objective]);

  const isValidDateRange = useCallback(() => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const today = new Date();
    today.setHours(23, 59, 59, 999); // End of today

    return start <= end && end <= today;
  }, [startDate, endDate]);

  // Helper function to find matching material by name
  const findMatchingMaterial = async (adName: string) => {
    try {
      // Normalize the ad name for better matching
      const normalizedAdName = adName.toLowerCase().trim();

      // Extract key parts from the ad name (remove copy suffixes, special chars)
      const cleanAdName = normalizedAdName
        .replace(/\s*—\s*cópia.*$/i, '') // Remove "— Cópia" and variants
        .replace(/\s*-\s*copy.*$/i, '') // Remove "- Copy" and variants
        .replace(/[|—-]/g, ' ') // Replace separators with spaces
        .replace(/\s+/g, ' ') // Normalize multiple spaces
        .trim();

      // Extract meaningful parts (numbers, keywords)
      const parts = cleanAdName.split(' ').filter(part =>
        part.length > 2 && !['and', 'the', 'of', 'in', 'on', 'at', 'to', 'for'].includes(part)
      );

      // Try multiple search strategies with expanded status filter
      let materials = null;
      let error = null;

      // Strategy 1: Exact match with original name
      ({ data: materials, error } = await supabase
        .from('materials')
        .select('*')
        .ilike('name', `%${normalizedAdName}%`)
        .in('status', ['taxonomized', 'client_approval', 'approved', 'internal_approval'])
        .limit(1));

      // Strategy 2: Match without copy suffixes
      if ((!materials || materials.length === 0) && cleanAdName !== normalizedAdName) {
        ({ data: materials, error } = await supabase
          .from('materials')
          .select('*')
          .ilike('name', `%${cleanAdName}%`)
          .in('status', ['taxonomized', 'client_approval', 'approved', 'internal_approval'])
          .limit(1));
      }

      // Strategy 3: Match key parts
      if ((!materials || materials.length === 0) && parts.length > 0) {
        const keyPart = parts[0]; // Use the first meaningful part
        ({ data: materials, error } = await supabase
          .from('materials')
          .select('*')
          .ilike('name', `%${keyPart}%`)
          .in('status', ['taxonomized', 'client_approval', 'approved', 'internal_approval'])
          .limit(1));
      }

      // Strategy 4: Match by number pattern (001, 002, etc)
      if (!materials || materials.length === 0) {
        const numberMatch = normalizedAdName.match(/\b(\d{3})\b/);
        if (numberMatch) {
          ({ data: materials, error } = await supabase
            .from('materials')
            .select('*')
            .ilike('name', `%${numberMatch[1]}%`)
            .in('status', ['taxonomized', 'client_approval', 'approved', 'internal_approval'])
            .limit(1));
        }
      }

      // Strategy 5: Broad search without status filter (fallback)
      if ((!materials || materials.length === 0)) {
        ({ data: materials, error } = await supabase
          .from('materials')
          .select('*')
          .ilike('name', `%${cleanAdName}%`)
          .limit(1));
      }

      // Strategy 6: Fallback by key part without status filter
      if ((!materials || materials.length === 0) && parts.length > 0) {
        const keyPart = parts[0];
        ({ data: materials, error } = await supabase
          .from('materials')
          .select('*')
          .ilike('name', `%${keyPart}%`)
          .limit(1));
      }

      if (!error && materials && materials.length > 0) {
        console.log('Material correspondente encontrado:', materials[0].name, 'para anúncio:', adName);
        return materials[0];
      } else {
        console.log('Nenhum material correspondente encontrado para:', adName);
        console.log('Tentativas de busca:', { normalizedAdName, cleanAdName, parts });
        return null;
      }
    } catch (error) {
      console.error('Error finding matching material:', error);
      return null;
    }
  };

  // Helper function to enrich ads with taxonomy information
  const enrichAdsWithTaxonomy = async (adsArray: MetaAd[], accountId: string) => {
    try {
      console.log('🔍 Iniciando enriquecimento de taxonomia para', adsArray.length, 'anúncios...');

      // Get current user's company_id and profile_id
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.error('❌ User not authenticated');
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id, id, role')
        .eq('user_id', user.id)
        .single();

      if (!profile) {
        console.error('❌ Profile not found');
        return;
      }

      console.log('👤 Profile encontrado:', { role: profile.role, company_id: profile.company_id, profile_id: profile.id });

      // For admin users, try to get company_id from account or project
      let operationCompanyId = profile.company_id;
      if (!operationCompanyId && profile.role === 'admin') {
        console.log('🔧 Admin sem company_id, tentando obter via get_company_id_for_operation...');

        const { data: companyIdResult, error: companyIdError } = await supabase
          .rpc('get_company_id_for_operation', {
            _account_id: accountId
          });

        if (companyIdError) {
          console.error('❌ Erro ao obter company_id para admin:', companyIdError);
        } else {
          operationCompanyId = companyIdResult;
          console.log('✅ Company_id obtido para admin:', operationCompanyId);
        }
      }

      if (!operationCompanyId) {
        console.warn('⚠️ Nenhum company_id disponível, pulando enriquecimento de taxonomia');
        return;
      }

      // First, try to get existing applied taxonomies
      console.log('🔍 Buscando taxonomias aplicadas existentes para account:', accountId);
      const { data: existingTaxonomies, error: taxonomyError } = await supabase
        .from('applied_taxonomies')
        .select('ad_id, local_material_id, is_approved')
        .eq('account_id', accountId)
        .eq('company_id', operationCompanyId);

      if (taxonomyError) {
        console.error('❌ Error fetching applied taxonomies:', taxonomyError);
        return;
      }

      console.log('📊 Taxonomias existentes encontradas:', existingTaxonomies?.length || 0);

      // Create a lookup map for existing taxonomies
      const existingTaxonomyMap = new Map(
        existingTaxonomies?.map(t => [
          t.ad_id,
          {
            local_material_id: t.local_material_id,
            taxonomy_status: t.is_approved ? 'approved' : 'pending'
          }
        ]) || []
      );

      let newTaxonomiesCreated = 0;

      // For each ad, try to find a matching material and create/update taxonomy entry
      console.log('🔄 Processando', adsArray.length, 'anúncios para enriquecimento...');

      for (const ad of adsArray) {
        // Check if we already have a taxonomy for this ad
        const existingTaxonomy = existingTaxonomyMap.get(ad.ad_id);

        if (existingTaxonomy) {
          // Use existing taxonomy
          ad.local_material_id = existingTaxonomy.local_material_id;
          ad.taxonomy_status = existingTaxonomy.taxonomy_status;
          console.log(`♻️ Usando taxonomia existente: ${ad.ad_name} -> ${existingTaxonomy.local_material_id} (${existingTaxonomy.taxonomy_status})`);
        } else {
          // Try to find a matching material by name
          console.log(`🔍 Buscando material correspondente para: "${ad.ad_name}"`);
          const matchingMaterial = await findMatchingMaterial(ad.ad_name);

          if (matchingMaterial) {
            try {
              console.log(`📝 Criando nova entrada de taxonomia: ${ad.ad_name} -> ${matchingMaterial.name}`);
              // Create a new applied_taxonomy entry
              const { error: insertError } = await supabase
                .from('applied_taxonomies')
                .insert({
                  ad_id: ad.ad_id,
                  account_id: accountId,
                  local_material_id: matchingMaterial.id,
                  generated_taxonomy: matchingMaterial.name,
                  company_id: operationCompanyId, // Use the correct company_id
                  created_by: profile.id,
                  pattern_id: null, // No pattern used for automatic matching
                  is_approved: false // Starts as pending approval
                });

              if (!insertError) {
                ad.local_material_id = matchingMaterial.id;
                ad.taxonomy_status = 'pending';
                newTaxonomiesCreated++;
                console.log(`✅ Taxonomia criada com sucesso: ${ad.ad_name} -> ${matchingMaterial.name}`);
              } else {
                console.error('❌ Erro ao criar entrada de taxonomia:', insertError);
              }
            } catch (error) {
              console.error('❌ Erro ao criar entrada de taxonomia:', error);
            }
          } else {
            console.log(`❌ Nenhum material correspondente encontrado para: "${ad.ad_name}"`);
            // Set default values for ads without matching materials
            ad.local_material_id = null;
            ad.taxonomy_status = 'pending';
          }
        }
      }

      console.log(`✅ Enriched ${adsArray.length} ads with taxonomy data, ${existingTaxonomies?.length || 0} existing taxonomies found, ${newTaxonomiesCreated} new taxonomies created`);
    } catch (error) {
      console.error('Error enriching ads with taxonomy:', error);
    }
  };

  const resetFilters = useCallback(() => {
    setSelectedAccount('');
    setSelectedCampaigns([]);
    setPlatform('all');
    setFormat('all');
    setObjective('all');
    setCompetitorKeyword('');
    setCompetitorAds(null);

    // Reset to last 30 days
    const date = new Date();
    setEndDate(date.toISOString().split('T')[0]);
    date.setDate(date.getDate() - 30);
    setStartDate(date.toISOString().split('T')[0]);

    setAdsData(null);
  }, []);

  const fetchCompetitorAds = useCallback(async (keyword: string, forceRefresh = false) => {
    const normalizedKeyword = keyword?.trim().toLowerCase();

    if (!normalizedKeyword) {
      setCompetitorAds(null);
      return;
    }

    setLoadingCompetitors(true);
    try {
      console.log(`🔄 Buscando anúncios competitivos para: "${keyword}" (normalizado: ${normalizedKeyword})`);

      const { data, error } = await supabase.functions.invoke('scrape-competitor-ads', {
        body: {
          keyword: normalizedKeyword,
          niche: null,
          forceRefresh
        }
      });

      if (error) throw error;

      if (data.success) {
        // Caso 1: Dados disponíveis imediatamente (cache hit)
        if (data.ads && Array.isArray(data.ads)) {
          const ads = data.ads.map((ad: any) => ({
            id: ad.id,
            ad_id: ad.ad_id,
            ad_name: ad.ad_name,
            page_name: ad.page_name,
            image_urls: ad.image_urls ? JSON.parse(ad.image_urls) : null,
            video_url: ad.video_url,
            ad_copy: ad.ad_copy,
            cta_text: ad.cta_text,
            ad_format: ad.ad_format,
            platform_positions: ad.platform_positions ? JSON.parse(ad.platform_positions) : null,
            started_running_date: ad.started_running_date,
            scraped_at: ad.scraped_at
          }));

          setCompetitorAds(ads);
          console.log(`✅ ${ads.length} anúncios competitivos carregados (fonte: ${data.source})`);

          toast({
            title: "Análise competitiva carregada",
            description: `${ads.length} anúncios de concorrentes encontrados${data.source === 'cache' ? ' (cache)' : ''}.`,
          });
        }
        // Caso 2: Busca em andamento (primeira vez sem cache) - usar polling inteligente
        else if (data.status === 'processing') {
          console.log(`⏳ Busca iniciada (searchId: ${data.searchId}, runId: ${data.runId}). Iniciando polling inteligente...`);

          setCompetitorSearchPhase('searching');

          toast({
            title: "Buscando anúncios competitivos",
            description: data.message || "Analisando milhares de anúncios da concorrência...",
          });

          // Polling inteligente usando poll-competitor-search
          const maxAttempts = 24; // 24 * 5s = 2 minutos
          let attempts = 0;

          const pollWithBackend = async () => {
            if (attempts >= maxAttempts) {
              console.error('⏱️ Timeout: polling excedeu 2 minutos');
              setCompetitorSearchPhase('error');
              toast({
                title: "Tempo esgotado",
                description: "A busca está demorando mais que o esperado. Tente novamente.",
                variant: "destructive",
              });
              setLoadingCompetitors(false);
              return;
            }

            attempts++;
            console.log(`🔄 Tentativa ${attempts}/${maxAttempts} de polling...`);

            try {
              const { data: pollResult, error: pollError } = await supabase.functions.invoke('poll-competitor-search', {
                body: {
                  runId: data.runId,
                  searchId: data.searchId
                }
              });

              if (pollError) {
                console.error('❌ Erro no polling:', pollError);
                throw pollError;
              }

              if (pollResult.status === 'completed') {
                // Sucesso! Dados prontos
                const ads = pollResult.ads.map((ad: any) => ({
                  id: ad.id,
                  ad_id: ad.ad_id,
                  ad_name: ad.ad_name,
                  page_name: ad.page_name,
                  image_urls: ad.image_urls ? JSON.parse(ad.image_urls) : null,
                  video_url: ad.video_url,
                  ad_copy: ad.ad_copy,
                  cta_text: ad.cta_text,
                  ad_format: ad.ad_format,
                  platform_positions: ad.platform_positions ? JSON.parse(ad.platform_positions) : null,
                  started_running_date: ad.started_running_date,
                  scraped_at: ad.scraped_at
                }));

                setCompetitorAds(ads);
                setCompetitorSearchPhase('completed');
                setLoadingCompetitors(false);

                console.log(`✅ ${ads.length} anúncios competitivos carregados via polling`);

                toast({
                  title: "Análise competitiva concluída",
                  description: `${ads.length} anúncios de concorrentes encontrados.`,
                });

                return;
              }

              if (pollResult.status === 'failed') {
                throw new Error(pollResult.error || 'Busca falhou no Apify');
              }

              // Ainda processando, tentar novamente em 5 segundos
              if (pollResult.status === 'processing') {
                console.log(`⏳ Ainda processando... tentativa ${attempts}/${maxAttempts}`);
                setTimeout(pollWithBackend, 5000);
              }

            } catch (error) {
              console.error('❌ Erro no polling:', error);
              setCompetitorSearchPhase('error');
              setLoadingCompetitors(false);

              toast({
                title: "Erro na busca competitiva",
                description: error.message || "Não foi possível completar a busca.",
                variant: "destructive",
              });
            }
          };

          // Iniciar polling
          pollWithBackend();
        } else {
          throw new Error('Resposta inesperada do servidor');
        }
      } else {
        throw new Error(data.error || 'Failed to fetch competitor ads');
      }
    } catch (error) {
      console.error('❌ Error fetching competitor ads:', error);
      console.log('🔍 Error details:', JSON.stringify(error, null, 2));

      let errorMessage = "Não foi possível carregar os anúncios de concorrentes. Tente novamente.";

      if (error instanceof Error) {
        // Check for specific known errors
        if (error.message.includes('APIFY_API_TOKEN not configured')) {
          errorMessage = "Token do Apify não configurado. Por favor, configure a variável APIFY_API_TOKEN no Supabase.";
        } else if (error.message.includes('Apify API error')) {
          errorMessage = `Erro no serviço de busca (Apify): ${error.message}`;
        } else {
          errorMessage = error.message;
        }
      }

      toast({
        title: "Erro ao buscar anúncios competitivos",
        description: errorMessage,
        variant: "destructive",
      });
      setCompetitorAds(null);
    } finally {
      setLoadingCompetitors(false);
    }
  }, []);

  // NÃO buscar automaticamente - só quando usuário aplicar filtros
  // Removido o useEffect que dispara fetchCompetitorAds automaticamente

  const contextValue: MetaAdsDirectContextType = {
    // Data
    accounts,
    campaigns,
    adsData,

    // Meta Connection
    metaConnected,
    metaLoading,
    checkMetaConnection,

    // Competitor Analysis
    competitorKeyword,
    competitorAds,
    competitorSearchPhase,

    // Loading states
    loadingAccounts,
    loadingCampaigns,
    loadingAds,
    loadingCompetitors,
    loadingStatus,

    // Filters
    selectedAccount,
    selectedCampaigns,
    startDate,
    endDate,
    platform,
    format,
    objective,

    // Actions
    setSelectedAccount,
    setSelectedCampaigns,
    setStartDate,
    setEndDate,
    setPlatform,
    setFormat,
    setObjective,
    setCompetitorKeyword,

    fetchData,
    loadAccounts,
    loadCampaigns,
    fetchCompetitorAds,

    // Utilities
    isValidDateRange,
    resetFilters,
  };

  return (
    <MetaAdsDirectContext.Provider value={contextValue}>
      {children}
    </MetaAdsDirectContext.Provider>
  );
};
