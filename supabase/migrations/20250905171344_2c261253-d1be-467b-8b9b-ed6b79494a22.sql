-- Criar tabelas para sistema de análise de anúncios Meta

-- Tabela para armazenar contas de anúncios do Meta
CREATE TABLE public.meta_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id TEXT NOT NULL UNIQUE,
  account_name TEXT NOT NULL,
  company_id UUID NOT NULL,
  access_token TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela para campanhas do Meta
CREATE TABLE public.meta_campaigns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  account_id TEXT NOT NULL,
  campaign_name TEXT NOT NULL,
  objective TEXT,
  status TEXT,
  company_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(campaign_id, account_id)
);

-- Tabela para adsets do Meta
CREATE TABLE public.meta_adsets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  adset_id TEXT NOT NULL,
  campaign_id TEXT NOT NULL,
  account_id TEXT NOT NULL,
  adset_name TEXT NOT NULL,
  status TEXT,
  company_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(adset_id, campaign_id, account_id)
);

-- Tabela para anúncios do Meta
CREATE TABLE public.meta_ads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ad_id TEXT NOT NULL,
  adset_id TEXT NOT NULL,
  campaign_id TEXT NOT NULL,
  account_id TEXT NOT NULL,
  ad_name TEXT NOT NULL,
  status TEXT,
  creative_id TEXT,
  company_id UUID NOT NULL,
  local_material_id UUID, -- Referência ao material local em alta qualidade
  taxonomy_status TEXT DEFAULT 'pending', -- 'approved', 'pending', 'needs_review'
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(ad_id, adset_id, campaign_id, account_id)
);

-- Tabela para métricas dos anúncios
CREATE TABLE public.meta_ad_metrics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ad_id TEXT NOT NULL,
  account_id TEXT NOT NULL,
  date_start DATE NOT NULL,
  date_stop DATE NOT NULL,
  impressions BIGINT DEFAULT 0,
  clicks BIGINT DEFAULT 0,
  spend DECIMAL(10,2) DEFAULT 0,
  reach BIGINT DEFAULT 0,
  frequency DECIMAL(10,2) DEFAULT 0,
  ctr DECIMAL(10,4) DEFAULT 0,
  cpc DECIMAL(10,2) DEFAULT 0,
  cpm DECIMAL(10,2) DEFAULT 0,
  cpp DECIMAL(10,2) DEFAULT 0,
  actions JSONB DEFAULT '[]',
  conversions BIGINT DEFAULT 0,
  conversion_rate DECIMAL(10,4) DEFAULT 0,
  cost_per_conversion DECIMAL(10,2) DEFAULT 0,
  roas DECIMAL(10,4) DEFAULT 0,
  company_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(ad_id, account_id, date_start, date_stop)
);

-- Tabela para análises de IA dos criativos
CREATE TABLE public.ai_creative_analysis (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ad_id TEXT NOT NULL,
  account_id TEXT NOT NULL,
  material_id UUID, -- Referência ao material local
  visual_analysis JSONB, -- Análise visual: layout, cores, hierarquia, etc.
  metrics_analysis JSONB, -- Análise das métricas e hipóteses
  recommendations JSONB, -- Recomendações de variações
  performance_insights JSONB, -- Insights de performance
  analysis_version TEXT DEFAULT '1.0',
  company_id UUID NOT NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela para briefings gerados por IA
CREATE TABLE public.ai_generated_briefings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source_ad_id TEXT NOT NULL,
  source_account_id TEXT NOT NULL,
  project_id UUID, -- Projeto onde o briefing será enviado
  briefing_data JSONB NOT NULL, -- Estrutura completa do briefing
  status TEXT DEFAULT 'draft', -- 'draft', 'approved', 'sent_to_flow'
  variations JSONB DEFAULT '[]', -- Variações A/B sugeridas
  metadata JSONB, -- Metadados: criativo-base, período, métricas-chave
  company_id UUID NOT NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela para padrões de taxonomia
CREATE TABLE public.taxonomy_patterns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  pattern_name TEXT NOT NULL,
  pattern_rules JSONB NOT NULL, -- Regras: separador, slug, limites, valores válidos
  is_default BOOLEAN DEFAULT false,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela para taxonomias aplicadas
CREATE TABLE public.applied_taxonomies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ad_id TEXT NOT NULL,
  account_id TEXT NOT NULL,
  pattern_id UUID NOT NULL,
  generated_taxonomy TEXT NOT NULL,
  is_approved BOOLEAN DEFAULT false,
  local_material_id UUID, -- Material local associado
  company_id UUID NOT NULL,
  created_by UUID NOT NULL,
  approved_by UUID,
  approved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(ad_id, account_id, pattern_id)
);

-- Habilitar RLS em todas as tabelas
ALTER TABLE public.meta_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meta_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meta_adsets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meta_ads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meta_ad_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_creative_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_generated_briefings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.taxonomy_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applied_taxonomies ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para meta_accounts
CREATE POLICY "Users can view accounts from their company" 
ON public.meta_accounts 
FOR SELECT 
USING (company_id = get_current_user_company_id());

CREATE POLICY "Users can manage accounts from their company" 
ON public.meta_accounts 
FOR ALL 
USING (company_id = get_current_user_company_id());

-- Políticas RLS para meta_campaigns
CREATE POLICY "Users can view campaigns from their company" 
ON public.meta_campaigns 
FOR SELECT 
USING (company_id = get_current_user_company_id());

CREATE POLICY "Users can manage campaigns from their company" 
ON public.meta_campaigns 
FOR ALL 
USING (company_id = get_current_user_company_id());

-- Políticas RLS para meta_adsets
CREATE POLICY "Users can view adsets from their company" 
ON public.meta_adsets 
FOR SELECT 
USING (company_id = get_current_user_company_id());

CREATE POLICY "Users can manage adsets from their company" 
ON public.meta_adsets 
FOR ALL 
USING (company_id = get_current_user_company_id());

-- Políticas RLS para meta_ads
CREATE POLICY "Users can view ads from their company" 
ON public.meta_ads 
FOR SELECT 
USING (company_id = get_current_user_company_id());

CREATE POLICY "Users can manage ads from their company" 
ON public.meta_ads 
FOR ALL 
USING (company_id = get_current_user_company_id());

-- Políticas RLS para meta_ad_metrics
CREATE POLICY "Users can view metrics from their company" 
ON public.meta_ad_metrics 
FOR SELECT 
USING (company_id = get_current_user_company_id());

CREATE POLICY "Users can manage metrics from their company" 
ON public.meta_ad_metrics 
FOR ALL 
USING (company_id = get_current_user_company_id());

-- Políticas RLS para ai_creative_analysis
CREATE POLICY "Users can view analysis from their company" 
ON public.ai_creative_analysis 
FOR SELECT 
USING (company_id = get_current_user_company_id());

CREATE POLICY "Users can create analysis" 
ON public.ai_creative_analysis 
FOR INSERT 
WITH CHECK (company_id = get_current_user_company_id());

CREATE POLICY "Users can update analysis from their company" 
ON public.ai_creative_analysis 
FOR UPDATE 
USING (company_id = get_current_user_company_id());

-- Políticas RLS para ai_generated_briefings
CREATE POLICY "Users can view briefings from their company" 
ON public.ai_generated_briefings 
FOR SELECT 
USING (company_id = get_current_user_company_id());

CREATE POLICY "Users can create briefings" 
ON public.ai_generated_briefings 
FOR INSERT 
WITH CHECK (company_id = get_current_user_company_id());

CREATE POLICY "Users can update briefings from their company" 
ON public.ai_generated_briefings 
FOR UPDATE 
USING (company_id = get_current_user_company_id());

-- Políticas RLS para taxonomy_patterns
CREATE POLICY "Users can view patterns from their company" 
ON public.taxonomy_patterns 
FOR SELECT 
USING (company_id = get_current_user_company_id());

CREATE POLICY "Users can manage patterns from their company" 
ON public.taxonomy_patterns 
FOR ALL 
USING (company_id = get_current_user_company_id());

-- Políticas RLS para applied_taxonomies
CREATE POLICY "Users can view taxonomies from their company" 
ON public.applied_taxonomies 
FOR SELECT 
USING (company_id = get_current_user_company_id());

CREATE POLICY "Users can manage taxonomies from their company" 
ON public.applied_taxonomies 
FOR ALL 
USING (company_id = get_current_user_company_id());

-- Triggers para updated_at
CREATE TRIGGER update_meta_accounts_updated_at
BEFORE UPDATE ON public.meta_accounts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_meta_campaigns_updated_at
BEFORE UPDATE ON public.meta_campaigns
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_meta_adsets_updated_at
BEFORE UPDATE ON public.meta_adsets
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_meta_ads_updated_at
BEFORE UPDATE ON public.meta_ads
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_meta_ad_metrics_updated_at
BEFORE UPDATE ON public.meta_ad_metrics
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ai_creative_analysis_updated_at
BEFORE UPDATE ON public.ai_creative_analysis
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ai_generated_briefings_updated_at
BEFORE UPDATE ON public.ai_generated_briefings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_taxonomy_patterns_updated_at
BEFORE UPDATE ON public.taxonomy_patterns
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_applied_taxonomies_updated_at
BEFORE UPDATE ON public.applied_taxonomies
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Índices para melhor performance
CREATE INDEX idx_meta_ads_company_status ON public.meta_ads(company_id, status);
CREATE INDEX idx_meta_ads_taxonomy_status ON public.meta_ads(company_id, taxonomy_status);
CREATE INDEX idx_meta_ad_metrics_date_range ON public.meta_ad_metrics(company_id, date_start, date_stop);
CREATE INDEX idx_meta_ad_metrics_ad_id ON public.meta_ad_metrics(ad_id, account_id);
CREATE INDEX idx_ai_creative_analysis_ad ON public.ai_creative_analysis(ad_id, account_id);
CREATE INDEX idx_ai_generated_briefings_status ON public.ai_generated_briefings(company_id, status);
CREATE INDEX idx_applied_taxonomies_approved ON public.applied_taxonomies(company_id, is_approved);