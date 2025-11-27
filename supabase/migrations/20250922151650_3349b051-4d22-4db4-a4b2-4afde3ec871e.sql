-- Correção final dos dados inconsistentes

-- 1. Corrigir company_id do João Vyctor
UPDATE public.profiles 
SET company_id = (SELECT id FROM public.companies ORDER BY created_at ASC LIMIT 1)
WHERE email = 'joao.vyctor@thinkcompany.com.br' 
  AND company_id IS NULL;

-- 2. Marcar tech@thinkcompany.com.br como usado se já existe perfil
UPDATE public.authorized_emails 
SET used_at = now()
WHERE email = 'tech@thinkcompany.com.br' 
  AND used_at IS NULL
  AND EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE email = 'tech@thinkcompany.com.br'
  );

-- 3. Verificar e corrigir todos os perfis que têm authorized_email correspondente
UPDATE public.profiles 
SET 
  company_id = ae.company_id,
  role = ae.role,
  allowed_companies = ae.allowed_companies
FROM public.authorized_emails ae
WHERE profiles.email = ae.email 
  AND (
    profiles.company_id IS NULL 
    OR profiles.role != ae.role 
    OR profiles.allowed_companies IS DISTINCT FROM ae.allowed_companies
  );

-- 4. Marcar todos os authorized_emails como usados quando já existe perfil
UPDATE public.authorized_emails 
SET used_at = COALESCE(used_at, now())
WHERE email IN (
  SELECT email 
  FROM public.profiles 
  WHERE email = authorized_emails.email
) AND used_at IS NULL;