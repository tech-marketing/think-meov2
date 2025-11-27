-- 1. Criar política de UPDATE para admins
CREATE POLICY "Admins can update all profiles"
ON public.profiles
FOR UPDATE
USING (get_current_user_role() = 'admin')
WITH CHECK (get_current_user_role() = 'admin');

-- 2. Normalizar allowed_companies existentes (converter strings JSON para JSONB arrays)
UPDATE public.profiles
SET allowed_companies = 
  CASE 
    WHEN jsonb_typeof(allowed_companies) = 'string' THEN 
      (trim(both '"' from allowed_companies::text))::jsonb
    ELSE 
      allowed_companies
  END
WHERE allowed_companies IS NOT NULL;