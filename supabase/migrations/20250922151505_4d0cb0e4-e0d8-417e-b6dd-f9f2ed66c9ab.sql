-- Corrigir dados inconsistentes existentes

-- 1. Corrigir o perfil do joao.vyctor@thinkcompany.com.br
UPDATE public.profiles 
SET 
  role = 'admin',
  company_id = (SELECT id FROM public.companies ORDER BY created_at ASC LIMIT 1)
WHERE email = 'joao.vyctor@thinkcompany.com.br' 
  AND role = 'client' 
  AND company_id IS NULL;

-- 2. Marcar emails autorizados como usados quando já existe perfil
UPDATE public.authorized_emails 
SET used_at = now()
WHERE email IN (
  SELECT p.email 
  FROM public.profiles p 
  WHERE p.email = authorized_emails.email
) AND used_at IS NULL;

-- 3. Corrigir profiles que têm authorized_email correspondente mas dados incorretos
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
  );

-- 4. Criar função para sincronizar dados inconsistentes
CREATE OR REPLACE FUNCTION public.sync_profile_with_authorized_email()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Atualizar profiles baseado em authorized_emails
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
    );

  -- Marcar authorized_emails como usados quando profile existe
  UPDATE public.authorized_emails 
  SET used_at = COALESCE(used_at, now())
  WHERE email IN (
    SELECT p.email 
    FROM public.profiles p 
    WHERE p.email = authorized_emails.email
  ) AND used_at IS NULL;
END;
$$;