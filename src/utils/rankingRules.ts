// Regras de ranking e ordenação para criativos Meta Ads
export interface MetricDirection {
  direction: 'desc' | 'asc'; // desc = quanto maior melhor, asc = quanto menor melhor
  type: 'rate' | 'cost' | 'count' | 'value' | 'roas';
}

export interface SampleGate {
  impressions?: number;
  clicks?: number;
  spend?: number;
  conversions?: number;
  results?: number;
}

export interface ObjectiveConfig {
  name: string;
  metrics: string[]; // 6 métricas para exibir no card
  defaultPrimary: string;
  defaultSecondary: string;
  gates: SampleGate;
}

// Direções padrão das métricas
export const METRIC_DIRECTIONS: Record<string, MetricDirection> = {
  // Quanto maior, melhor (ordem decrescente)
  'roas': { direction: 'desc', type: 'roas' },
  'revenue': { direction: 'desc', type: 'value' },
  'results': { direction: 'desc', type: 'count' },
  'conversions': { direction: 'desc', type: 'count' },
  'purchases': { direction: 'desc', type: 'count' },
  'leads': { direction: 'desc', type: 'count' },
  'messages': { direction: 'desc', type: 'count' },
  'thruplays': { direction: 'desc', type: 'count' },
  'video_views': { direction: 'desc', type: 'count' },
  'lpv': { direction: 'desc', type: 'count' },
  'link_clicks': { direction: 'desc', type: 'count' },
  'clicks': { direction: 'desc', type: 'count' },
  'ctr': { direction: 'desc', type: 'rate' },
  'conversion_rate': { direction: 'desc', type: 'rate' },
  'reach': { direction: 'desc', type: 'count' },
  'impressions': { direction: 'desc', type: 'count' },
  'engagements': { direction: 'desc', type: 'count' },
  'engagement_rate': { direction: 'desc', type: 'rate' },
  'thruplay_rate': { direction: 'desc', type: 'rate' },
  'installations': { direction: 'desc', type: 'count' },
  'store_visits': { direction: 'desc', type: 'count' },
  
  // Quanto menor, melhor (ordem crescente)
  'cpc': { direction: 'asc', type: 'cost' },
  'cpa': { direction: 'asc', type: 'cost' },
  'cost_per_result': { direction: 'asc', type: 'cost' },
  'cpl': { direction: 'asc', type: 'cost' },
  'cpp': { direction: 'asc', type: 'cost' },
  'cpi': { direction: 'asc', type: 'cost' },
  'cpm': { direction: 'asc', type: 'cost' },
  'cost_per_lpv': { direction: 'asc', type: 'cost' },
  'cost_per_thruplay': { direction: 'asc', type: 'cost' },
  'cost_per_engagement': { direction: 'asc', type: 'cost' },
  'cost_per_message': { direction: 'asc', type: 'cost' },
  'cost_per_visit': { direction: 'asc', type: 'cost' },
  'frequency': { direction: 'asc', type: 'rate' }, // Idealmente entre 1-3
  'spend': { direction: 'desc', type: 'value' } // Para desempate
};

// Configurações por objetivo
export const OBJECTIVE_CONFIGS: Record<string, ObjectiveConfig> = {
  'sales': {
    name: 'Vendas',
    metrics: ['roas', 'revenue', 'purchases', 'cpa', 'conversion_rate', 'spend'],
    defaultPrimary: 'roas',
    defaultSecondary: 'revenue',
    gates: { spend: 100, conversions: 3 }
  },
  'leads': {
    name: 'Geração de Leads',
    metrics: ['results', 'cost_per_result', 'conversion_rate', 'clicks', 'ctr', 'spend'],
    defaultPrimary: 'results',
    defaultSecondary: 'cost_per_result',
    gates: { results: 3, spend: 50, impressions: 1000, clicks: 20 }
  },
  'traffic': {
    name: 'Tráfego',
    metrics: ['results', 'cost_per_result', 'clicks', 'cpc', 'ctr', 'spend'],
    defaultPrimary: 'results',
    defaultSecondary: 'cost_per_result',
    gates: { results: 50, impressions: 1000, clicks: 20 }
  },
  'engagement': {
    name: 'Engajamento',
    metrics: ['results', 'cost_per_result', 'impressions', 'clicks', 'ctr', 'spend'],
    defaultPrimary: 'results',
    defaultSecondary: 'cost_per_result',
    gates: { results: 50, impressions: 2000 }
  },
  'video_views': {
    name: 'Visualizações de Vídeo',
    metrics: ['results', 'cost_per_result', 'impressions', 'reach', 'cpm', 'spend'],
    defaultPrimary: 'results',
    defaultSecondary: 'cost_per_result',
    gates: { results: 100, impressions: 3000 }
  },
  'awareness': {
    name: 'Reconhecimento',
    metrics: ['reach', 'impressions', 'frequency', 'cpm', 'ctr', 'spend'],
    defaultPrimary: 'reach',
    defaultSecondary: 'cpm',
    gates: { impressions: 3000 }
  }
};

// Verifica se um anúncio atende aos gates de amostra mínima
export const meetsMinimumSample = (ad: any, objective: string): boolean => {
  const config = OBJECTIVE_CONFIGS[objective];
  if (!config || !ad.metrics) return true;

  const gates = config.gates;
  const metrics = ad.metrics;

  // Verifica cada gate definido
  if (gates.impressions && (metrics.impressions || 0) < gates.impressions) {
    return false;
  }
  
  if (gates.clicks && (metrics.clicks || 0) < gates.clicks) {
    return false;
  }
  
  if (gates.spend && (metrics.spend || 0) < gates.spend) {
    return false;
  }
  
  if (gates.conversions && (metrics.conversions || 0) < gates.conversions) {
    return false;
  }
  
  if (gates.results) {
    // Para "results", usa a métrica principal do objetivo
    const primaryMetric = config.defaultPrimary;
    const resultValue = metrics[primaryMetric] || 0;
    if (resultValue < gates.results) {
      return false;
    }
  }

  return true;
};

// Função de comparação para ordenação
export const compareAds = (
  a: any, 
  b: any, 
  primaryMetric: string, 
  secondaryMetric: string
): number => {
  const primaryDirection = METRIC_DIRECTIONS[primaryMetric];
  const secondaryDirection = METRIC_DIRECTIONS[secondaryMetric];

  // Obter valores das métricas
  const aPrimary = getMetricValue(a, primaryMetric);
  const bPrimary = getMetricValue(b, primaryMetric);
  const aSecondary = getMetricValue(a, secondaryMetric);
  const bSecondary = getMetricValue(b, secondaryMetric);

  // Comparar métrica principal
  if (aPrimary !== bPrimary) {
    if (primaryDirection?.direction === 'desc') {
      return bPrimary - aPrimary; // Maior primeiro
    } else {
      return aPrimary - bPrimary; // Menor primeiro
    }
  }

  // Comparar métrica secundária
  if (aSecondary !== bSecondary) {
    if (secondaryDirection?.direction === 'desc') {
      return bSecondary - aSecondary;
    } else {
      return aSecondary - bSecondary;
    }
  }

  // Critérios de desempate
  const aSpend = a.metrics?.spend || 0;
  const bSpend = b.metrics?.spend || 0;
  if (aSpend !== bSpend) {
    return bSpend - aSpend; // Maior spend primeiro
  }

  const aImpressions = a.metrics?.impressions || 0;
  const bImpressions = b.metrics?.impressions || 0;
  if (aImpressions !== bImpressions) {
    return bImpressions - aImpressions; // Maior impressões primeiro
  }

  // Por último, nome do anúncio (alfabético)
  return (a.ad_name || '').localeCompare(b.ad_name || '');
};

// Obter valor da métrica com fallbacks
export const getMetricValue = (ad: any, metric: string): number => {
  if (!ad.metrics) return 0;

  const value = ad.metrics[metric];
  
  // Tratar casos especiais (divisão por zero, etc.)
  if (value === undefined || value === null) return 0;
  if (typeof value === 'string') {
    if (value === 'inf' || value === 'Infinity') return metric.startsWith('cost') ? 999999 : 0;
    return parseFloat(value) || 0;
  }
  
  return Number(value) || 0;
};

// Filtrar anúncios por amostra mínima
export const filterByMinimumSample = (
  ads: any[], 
  objective: string, 
  includeSmallSamples: boolean = true
): { validAds: any[], smallSampleAds: any[] } => {
  const validAds: any[] = [];
  const smallSampleAds: any[] = [];

  ads.forEach(ad => {
    if (meetsMinimumSample(ad, objective)) {
      validAds.push(ad);
    } else {
      smallSampleAds.push(ad);
    }
  });

  if (includeSmallSamples) {
    return { validAds: [...validAds, ...smallSampleAds], smallSampleAds };
  }

  return { validAds, smallSampleAds };
};

// Labels amigáveis para métricas
export const METRIC_LABELS: Record<string, string> = {
  'roas': 'ROAS',
  'revenue': 'Receita',
  'results': 'Resultados',
  'conversions': 'Conversões',
  'purchases': 'Compras',
  'leads': 'Leads',
  'messages': 'Mensagens',
  'thruplays': 'ThruPlays',
  'video_views': 'Visualizações',
'lpv': 'LPVs',
  'clicks': 'Cliques (Link)',
  'ctr': 'CTR (%)',
  'conversion_rate': 'Taxa de Conversão (%)',
  'reach': 'Alcance',
  'impressions': 'Impressões',
  'engagements': 'Engajamentos',
  'cpc': 'CPC',
  'cpa': 'CPA',
  'cost_per_result': 'Custo por Resultado',
  'cpl': 'CPL',
  'cpp': 'CPP',
  'cpm': 'CPM',
  'cost_per_lpv': 'Custo por LPV',
  'cost_per_thruplay': 'Custo por ThruPlay',
  'frequency': 'Frequência',
  'spend': 'Investimento'
};