-- =======================
-- COMPETITOR_ADS_CACHE: Cache Global
-- =======================

-- Permitir company_id NULL (cache compartilhado)
ALTER TABLE competitor_ads_cache 
ALTER COLUMN company_id DROP NOT NULL;

-- REMOVER políticas restritivas antigas
DROP POLICY IF EXISTS "Users can view competitor ads from their company" ON competitor_ads_cache;
DROP POLICY IF EXISTS "System can insert competitor ads" ON competitor_ads_cache;

-- NOVA política: TODOS podem ler o cache (dados públicos da Facebook Ad Library)
CREATE POLICY "Anyone can view competitor ads cache"
ON competitor_ads_cache FOR SELECT
USING (true);

-- Sistema pode inserir sem restrições
CREATE POLICY "System can insert competitor ads"
ON competitor_ads_cache FOR INSERT
WITH CHECK (true);

-- Apenas admins podem deletar/atualizar (manutenção)
CREATE POLICY "Admins can manage competitor ads"
ON competitor_ads_cache FOR ALL
USING ((SELECT role FROM profiles WHERE user_id = auth.uid()) = 'admin');


-- =======================
-- COMPETITOR_SEARCH_HISTORY: Histórico Global
-- =======================

-- Permitir company_id NULL
ALTER TABLE competitor_search_history 
ALTER COLUMN company_id DROP NOT NULL;

-- REMOVER políticas restritivas antigas
DROP POLICY IF EXISTS "Users can view search history from their company" ON competitor_search_history;
DROP POLICY IF EXISTS "Users can create search history" ON competitor_search_history;

-- NOVA política: TODOS podem ver histórico (transparência)
CREATE POLICY "Anyone can view search history"
ON competitor_search_history FOR SELECT
USING (true);

-- Qualquer usuário autenticado pode criar busca
CREATE POLICY "Authenticated users can create search history"
ON competitor_search_history FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- Apenas admins podem deletar histórico
CREATE POLICY "Admins can manage search history"
ON competitor_search_history FOR ALL
USING ((SELECT role FROM profiles WHERE user_id = auth.uid()) = 'admin');