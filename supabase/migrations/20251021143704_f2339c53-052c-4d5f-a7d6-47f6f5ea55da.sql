-- Remover constraint antiga que inclui company_id
ALTER TABLE competitor_ads_cache 
DROP CONSTRAINT IF EXISTS unique_ad_per_keyword;

-- Criar nova constraint global sem company_id
-- Cache competitivo é compartilhado entre todas as empresas
ALTER TABLE competitor_ads_cache 
ADD CONSTRAINT unique_ad_per_keyword_global 
UNIQUE (ad_id, search_keyword);