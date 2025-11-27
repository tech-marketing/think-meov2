-- Adicionar colunas para análise de IA na tabela meta_ads
ALTER TABLE public.meta_ads 
ADD COLUMN IF NOT EXISTS ai_analysis TEXT,
ADD COLUMN IF NOT EXISTS analyzed_at TIMESTAMP WITH TIME ZONE;

-- Criar índice para melhor performance nas consultas de análise
CREATE INDEX IF NOT EXISTS idx_meta_ads_analyzed_at ON public.meta_ads(analyzed_at) WHERE analyzed_at IS NOT NULL;

-- Comentários para documentação
COMMENT ON COLUMN public.meta_ads.ai_analysis IS 'Análise gerada por IA do criativo';
COMMENT ON COLUMN public.meta_ads.analyzed_at IS 'Timestamp de quando a análise de IA foi realizada';