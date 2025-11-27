-- Atualizar trigger para definir status de convite como ativo quando usuário se registra
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  authorized_record RECORD;
BEGIN
  -- Buscar dados do email autorizado
  SELECT * INTO authorized_record 
  FROM public.authorized_emails 
  WHERE email = NEW.email AND used_at IS NULL;

  -- Se encontrou email autorizado, usar esses dados
  IF authorized_record IS NOT NULL THEN
    INSERT INTO public.profiles (user_id, email, full_name, role, company_id, allowed_companies, invitation_status)
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'full_name', 'User'),
      authorized_record.role,
      authorized_record.company_id,
      COALESCE(authorized_record.allowed_companies, ARRAY[]::uuid[]),
      'active'  -- Definir como ativo quando o usuário se registra
    );
    
    -- Marcar o email autorizado como usado
    UPDATE public.authorized_emails
    SET used_at = now()
    WHERE id = authorized_record.id;
    
  ELSE
    -- Fallback para usuários sem autorização prévia (admins criando contas)
    INSERT INTO public.profiles (user_id, email, full_name, role, invitation_status)
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'full_name', 'User'),
      'client',
      'active'  -- Definir como ativo por padrão
    );
  END IF;
  
  RETURN NEW;
END;
$function$;