-- Corrigir função sem search_path definido
CREATE OR REPLACE FUNCTION public.ensure_updated_at_trigger(_tbl regclass, _trigger_name text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgrelid = _tbl AND tgname = _trigger_name
  ) THEN
    EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE ON %s FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();', _trigger_name, _tbl);
  END IF;
END;
$function$;