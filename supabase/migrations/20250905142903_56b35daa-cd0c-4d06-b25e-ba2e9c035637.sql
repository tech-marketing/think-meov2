-- Atualizar função handle_new_user para não exigir primeiro login quando usuário se cadastra com senha
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  authorized_email_record RECORD;
BEGIN
  -- Verificar se o email está autorizado
  SELECT * INTO authorized_email_record 
  FROM public.authorized_emails 
  WHERE email = NEW.email AND used_at IS NULL;
  
  IF authorized_email_record IS NOT NULL THEN
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
      false  -- Usuário já definiu senha, não precisa de primeiro login
    );
    
    -- Marcar email como usado
    UPDATE public.authorized_emails 
    SET used_at = now() 
    WHERE id = authorized_email_record.id;
  ELSE
    -- Criar perfil básico se não estiver na lista autorizada
    INSERT INTO public.profiles (
      user_id, 
      email, 
      full_name, 
      role,
      first_login_required
    ) VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email),
      'client',
      false  -- Usuário já definiu senha, não precisa de primeiro login
    );
  END IF;
  
  RETURN NEW;
END;
$$;