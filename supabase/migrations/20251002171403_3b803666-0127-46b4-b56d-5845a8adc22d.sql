-- 1. Recriar a função handle_new_user com melhor tratamento
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  authorized_email_record RECORD;
  default_company_id UUID;
BEGIN
  RAISE LOG 'handle_new_user: Iniciando para usuário % com email %', NEW.id, NEW.email;
  
  -- Buscar email autorizado (não usado ainda)
  SELECT * INTO authorized_email_record 
  FROM public.authorized_emails 
  WHERE email = NEW.email 
    AND used_at IS NULL
  LIMIT 1;
  
  IF authorized_email_record IS NOT NULL THEN
    -- Email autorizado encontrado - criar perfil com role correto
    RAISE LOG 'handle_new_user: Email autorizado encontrado - role: %, company: %', 
              authorized_email_record.role, authorized_email_record.company_id;
    
    INSERT INTO public.profiles (
      user_id, 
      email, 
      full_name, 
      role, 
      company_id, 
      allowed_companies,
      first_login_required
    ) VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
      authorized_email_record.role,  -- Usar role do authorized_emails
      authorized_email_record.company_id,
      COALESCE(authorized_email_record.allowed_companies, '[]'::jsonb),
      false
    );
    
    -- Marcar email como usado
    UPDATE public.authorized_emails 
    SET used_at = now() 
    WHERE id = authorized_email_record.id;
    
    RAISE LOG 'handle_new_user: Perfil criado com role %', authorized_email_record.role;
    
  ELSE
    -- Verificar se email já foi usado anteriormente
    SELECT * INTO authorized_email_record 
    FROM public.authorized_emails 
    WHERE email = NEW.email
    LIMIT 1;
    
    IF authorized_email_record IS NOT NULL THEN
      -- Email já usado - recriar perfil com mesmo role
      RAISE LOG 'handle_new_user: Email já autorizado - role: %', authorized_email_record.role;
      
      INSERT INTO public.profiles (
        user_id, 
        email, 
        full_name, 
        role, 
        company_id, 
        allowed_companies,
        first_login_required
      ) VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
        authorized_email_record.role,  -- Usar role do authorized_emails
        authorized_email_record.company_id,
        COALESCE(authorized_email_record.allowed_companies, '[]'::jsonb),
        false
      );
      
    ELSE
      -- Email não autorizado - criar como client
      RAISE LOG 'handle_new_user: Email NÃO autorizado - criando como client';
      
      SELECT id INTO default_company_id 
      FROM public.companies 
      ORDER BY created_at ASC 
      LIMIT 1;
      
      INSERT INTO public.profiles (
        user_id, 
        email, 
        full_name, 
        role,
        company_id,
        first_login_required
      ) VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
        'client',
        default_company_id,
        false
      );
    END IF;
  END IF;
  
  RETURN NEW;
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE LOG 'handle_new_user: ERRO - % - %', SQLSTATE, SQLERRM;
    RAISE;
END;
$function$;

-- 2. Garantir que o trigger existe
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW 
  EXECUTE FUNCTION public.handle_new_user();

-- 3. Backfill: Corrigir roles de perfis existentes que estão errados
UPDATE public.profiles p
SET 
  role = ae.role,
  company_id = COALESCE(p.company_id, ae.company_id),
  allowed_companies = COALESCE(p.allowed_companies, ae.allowed_companies)
FROM public.authorized_emails ae
WHERE p.email = ae.email
  AND p.role != ae.role
  AND ae.used_at IS NOT NULL;