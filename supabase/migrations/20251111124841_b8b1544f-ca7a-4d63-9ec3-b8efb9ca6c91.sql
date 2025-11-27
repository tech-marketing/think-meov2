-- Criar função SECURITY DEFINER para verificar autorização de email
CREATE OR REPLACE FUNCTION public.check_email_authorization(user_email TEXT)
RETURNS TABLE (
  is_authorized BOOLEAN,
  user_role TEXT,
  user_company_id UUID,
  user_allowed_companies JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Normalizar email (lowercase e trim)
  user_email := LOWER(TRIM(user_email));
  
  -- Buscar email autorizado que ainda não foi usado
  RETURN QUERY
  SELECT 
    true as is_authorized,
    ae.role as user_role,
    ae.company_id as user_company_id,
    ae.allowed_companies as user_allowed_companies
  FROM public.authorized_emails ae
  WHERE ae.email = user_email
    AND ae.used_at IS NULL
  LIMIT 1;
  
  -- Se não encontrou, retornar não autorizado
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::TEXT, NULL::UUID, NULL::JSONB;
  END IF;
END;
$$;

-- Permitir acesso público à função
GRANT EXECUTE ON FUNCTION public.check_email_authorization(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.check_email_authorization(TEXT) TO authenticated;