-- Criar uma versão RPC acessível da função de sincronização
CREATE OR REPLACE FUNCTION sync_profile_with_authorized_email()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  updated_profiles INTEGER := 0;
  updated_emails INTEGER := 0;
  result JSON;
BEGIN
  -- Atualizar profiles baseado em authorized_emails
  WITH profile_updates AS (
    UPDATE public.profiles 
    SET 
      role = ae.role,
      company_id = ae.company_id,
      allowed_companies = ae.allowed_companies
    FROM public.authorized_emails ae
    WHERE profiles.email = ae.email 
      AND ae.used_at IS NOT NULL
      AND (
        profiles.role != ae.role 
        OR profiles.company_id IS DISTINCT FROM ae.company_id
        OR profiles.allowed_companies IS DISTINCT FROM ae.allowed_companies
      )
    RETURNING 1
  )
  SELECT COUNT(*) INTO updated_profiles FROM profile_updates;

  -- Marcar authorized_emails como usados quando profile existe
  WITH email_updates AS (
    UPDATE public.authorized_emails 
    SET used_at = COALESCE(used_at, now())
    WHERE email IN (
      SELECT p.email 
      FROM public.profiles p 
      WHERE p.email = authorized_emails.email
    ) AND used_at IS NULL
    RETURNING 1
  )
  SELECT COUNT(*) INTO updated_emails FROM email_updates;

  -- Construir resultado
  result := json_build_object(
    'success', true,
    'updated_profiles', updated_profiles,
    'updated_emails', updated_emails,
    'message', format('Atualizados %s perfis e %s emails autorizados', updated_profiles, updated_emails)
  );

  RAISE LOG 'sync_profile_with_authorized_email: %', result;
  
  RETURN result;
END;
$$;