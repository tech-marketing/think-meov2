-- Corrigir problemas de segurança identificados pelo linter

-- 1. Corrigir a função sync_profile_with_authorized_email para ter search_path seguro
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

-- 2. Melhorar a função handle_new_user com logging e correções
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  authorized_email_record RECORD;
  default_company_id UUID;
BEGIN
  -- Log do início da função
  RAISE LOG 'handle_new_user: Processando usuário % com email %', NEW.id, NEW.email;
  
  -- Verificar se o email está autorizado e não usado
  SELECT * INTO authorized_email_record 
  FROM public.authorized_emails 
  WHERE email = NEW.email AND used_at IS NULL;
  
  IF authorized_email_record IS NOT NULL THEN
    RAISE LOG 'handle_new_user: Email autorizado encontrado para %', NEW.email;
    
    -- Criar perfil baseado no email autorizado
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
      COALESCE(NEW.raw_user_meta_data ->> 'full_name', authorized_email_record.email),
      authorized_email_record.role,
      authorized_email_record.company_id,
      authorized_email_record.allowed_companies,
      false
    );
    
    -- Marcar email como usado
    UPDATE public.authorized_emails 
    SET used_at = now() 
    WHERE id = authorized_email_record.id;
    
    RAISE LOG 'handle_new_user: Perfil criado com sucesso para %', NEW.email;
    
  ELSE
    -- Verificar se existe email autorizado já usado
    SELECT * INTO authorized_email_record 
    FROM public.authorized_emails 
    WHERE email = NEW.email;
    
    IF authorized_email_record IS NOT NULL THEN
      RAISE LOG 'handle_new_user: Email autorizado já usado encontrado para %', NEW.email;
      
      -- Criar perfil baseado no email autorizado existente
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
        COALESCE(NEW.raw_user_meta_data ->> 'full_name', authorized_email_record.email),
        authorized_email_record.role,
        authorized_email_record.company_id,
        authorized_email_record.allowed_companies,
        false
      );
      
      -- Garantir que está marcado como usado
      UPDATE public.authorized_emails 
      SET used_at = COALESCE(used_at, now()) 
      WHERE id = authorized_email_record.id;
      
    ELSE
      RAISE LOG 'handle_new_user: Email não autorizado %, criando perfil básico', NEW.email;
      
      -- Buscar uma empresa padrão se não estiver autorizado
      SELECT id INTO default_company_id 
      FROM public.companies 
      ORDER BY created_at ASC 
      LIMIT 1;
      
      -- Criar perfil básico se não estiver na lista autorizada
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
        COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email),
        'client',
        default_company_id,
        false
      );
    END IF;
  END IF;
  
  RAISE LOG 'handle_new_user: Processamento concluído para %', NEW.email;
  RETURN NEW;
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE LOG 'handle_new_user: ERRO para %: % - %', NEW.email, SQLSTATE, SQLERRM;
    -- Re-raise o erro para evitar criação parcial
    RAISE;
END;
$$;