-- Tabela para armazenar anúncios de concorrentes scraped do Meta Ads Library
CREATE TABLE public.competitor_ads_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Chave de busca
  search_keyword TEXT NOT NULL,
  search_niche TEXT,
  
  -- Dados do anúncio
  ad_id TEXT NOT NULL,
  ad_name TEXT,
  page_name TEXT NOT NULL,
  page_id TEXT,
  
  -- Mídia
  image_urls JSONB,
  video_url TEXT,
  thumbnail_url TEXT,
  
  -- Conteúdo
  ad_copy TEXT,
  cta_text TEXT,
  link_url TEXT,
  
  -- Metadados
  started_running_date TIMESTAMP WITH TIME ZONE,
  platform_positions JSONB,
  ad_format TEXT,
  
  -- Contexto
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  
  -- Controle
  scraped_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true,
  last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  
  -- Constraint única por anúncio/keyword/empresa
  CONSTRAINT unique_ad_per_keyword UNIQUE (ad_id, search_keyword, company_id)
);

-- Índices para busca rápida
CREATE INDEX idx_competitor_ads_keyword ON public.competitor_ads_cache(search_keyword, company_id);
CREATE INDEX idx_competitor_ads_niche ON public.competitor_ads_cache(search_niche, company_id);
CREATE INDEX idx_competitor_ads_scraped ON public.competitor_ads_cache(scraped_at DESC);

-- RLS Policies para competitor_ads_cache
ALTER TABLE public.competitor_ads_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view competitor ads from their company"
  ON public.competitor_ads_cache FOR SELECT
  USING (
    company_id = (SELECT company_id FROM public.profiles WHERE user_id = auth.uid()) 
    OR (SELECT role FROM public.profiles WHERE user_id = auth.uid()) = 'admin'
  );

CREATE POLICY "System can insert competitor ads"
  ON public.competitor_ads_cache FOR INSERT
  WITH CHECK (
    company_id = (SELECT company_id FROM public.profiles WHERE user_id = auth.uid()) 
    OR (SELECT role FROM public.profiles WHERE user_id = auth.uid()) = 'admin'
  );

-- Tabela para histórico de buscas competitivas
CREATE TABLE public.competitor_search_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  search_keyword TEXT NOT NULL,
  search_niche TEXT,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  
  -- Resultados
  total_ads_found INTEGER DEFAULT 0,
  search_status TEXT DEFAULT 'pending',
  error_message TEXT,
  
  -- Cache
  cache_expires_at TIMESTAMP WITH TIME ZONE,
  should_refresh BOOLEAN DEFAULT false,
  
  -- Metadados
  searched_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  searched_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  
  -- Constraint para status válidos
  CONSTRAINT valid_search_status CHECK (search_status IN ('pending', 'processing', 'completed', 'failed'))
);

-- Índices para histórico
CREATE INDEX idx_search_history_company ON public.competitor_search_history(company_id, search_keyword);
CREATE INDEX idx_search_history_status ON public.competitor_search_history(search_status, searched_at DESC);

-- RLS Policies para competitor_search_history
ALTER TABLE public.competitor_search_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view search history from their company"
  ON public.competitor_search_history FOR SELECT
  USING (
    company_id = (SELECT company_id FROM public.profiles WHERE user_id = auth.uid()) 
    OR (SELECT role FROM public.profiles WHERE user_id = auth.uid()) = 'admin'
  );

CREATE POLICY "Users can create search history"
  ON public.competitor_search_history FOR INSERT
  WITH CHECK (
    company_id = (SELECT company_id FROM public.profiles WHERE user_id = auth.uid()) 
    OR (SELECT role FROM public.profiles WHERE user_id = auth.uid()) = 'admin'
  );

-- Trigger para updated_at em competitor_ads_cache
CREATE TRIGGER update_competitor_ads_cache_updated_at
  BEFORE UPDATE ON public.competitor_ads_cache
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger para updated_at em competitor_search_history
CREATE TRIGGER update_competitor_search_history_updated_at
  BEFORE UPDATE ON public.competitor_search_history
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();