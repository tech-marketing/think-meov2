-- Criar trigger para automaticamente marcar briefings aprovados pelo cliente
-- Quando um briefing (is_briefing = true) for aprovado pelo cliente (status = 'client_approval'),
-- automaticamente definir briefing_approved_by_client = true

CREATE OR REPLACE FUNCTION public.auto_approve_briefing_by_client()
RETURNS TRIGGER AS $$
BEGIN
  -- Se é um briefing e foi aprovado pelo cliente, marcar como approved_by_client
  IF NEW.is_briefing = true AND NEW.status = 'client_approval' THEN
    NEW.briefing_approved_by_client = true;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger para INSERT e UPDATE
CREATE TRIGGER trigger_auto_approve_briefing_by_client
    BEFORE INSERT OR UPDATE ON public.materials
    FOR EACH ROW
    EXECUTE FUNCTION public.auto_approve_briefing_by_client();