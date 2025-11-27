-- Update handle_new_user trigger to insert into user_roles table
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  authorized_email_record RECORD;
  default_company_id UUID;
  user_role app_role;
BEGIN
  RAISE LOG 'handle_new_user: Iniciando para usuário % com email %', NEW.id, NEW.email;
  
  -- Buscar email autorizado (não usado ainda)
  SELECT * INTO authorized_email_record 
  FROM public.authorized_emails 
  WHERE email = NEW.email 
    AND used_at IS NULL
  LIMIT 1;
  
  IF authorized_email_record IS NOT NULL THEN
    -- Email autorizado encontrado - usar role correto
    RAISE LOG 'handle_new_user: Email autorizado encontrado - role: %, company: %', 
              authorized_email_record.role, authorized_email_record.company_id;
    
    -- Determinar role como app_role enum
    user_role := CASE 
      WHEN authorized_email_record.role = 'admin' THEN 'admin'::app_role
      WHEN authorized_email_record.role = 'collaborator' THEN 'collaborator'::app_role
      ELSE 'client'::app_role
    END;
    
    -- Inserir em user_roles (nova tabela segura)
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, user_role)
    ON CONFLICT (user_id, role) DO NOTHING;
    
    -- Criar perfil (mantém role por compatibilidade)
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
      authorized_email_record.role,
      authorized_email_record.company_id,
      COALESCE(authorized_email_record.allowed_companies, '[]'::jsonb),
      false
    );
    
    -- Marcar email como usado
    UPDATE public.authorized_emails 
    SET used_at = now() 
    WHERE id = authorized_email_record.id;
    
    RAISE LOG 'handle_new_user: Perfil e role criados com role %', user_role;
    
  ELSE
    -- Verificar se email já foi usado anteriormente
    SELECT * INTO authorized_email_record 
    FROM public.authorized_emails 
    WHERE email = NEW.email
    LIMIT 1;
    
    IF authorized_email_record IS NOT NULL THEN
      -- Email já usado - recriar perfil com mesmo role
      RAISE LOG 'handle_new_user: Email já autorizado - role: %', authorized_email_record.role;
      
      user_role := CASE 
        WHEN authorized_email_record.role = 'admin' THEN 'admin'::app_role
        WHEN authorized_email_record.role = 'collaborator' THEN 'collaborator'::app_role
        ELSE 'client'::app_role
      END;
      
      -- Inserir em user_roles
      INSERT INTO public.user_roles (user_id, role)
      VALUES (NEW.id, user_role)
      ON CONFLICT (user_id, role) DO NOTHING;
      
      -- Criar perfil
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
        authorized_email_record.role,
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
      
      -- Inserir role client
      INSERT INTO public.user_roles (user_id, role)
      VALUES (NEW.id, 'client'::app_role)
      ON CONFLICT (user_id, role) DO NOTHING;
      
      -- Criar perfil
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
$$;