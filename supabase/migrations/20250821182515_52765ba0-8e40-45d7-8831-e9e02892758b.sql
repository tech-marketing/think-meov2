-- Atualizar trigger para automaticamente atribuir usuários à Think Company quando não tiverem empresa
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  authorized_record RECORD;
  think_company_id uuid;
BEGIN
  -- Buscar o ID da Think Company
  SELECT id INTO think_company_id FROM public.companies WHERE name = 'Think Company' LIMIT 1;
  
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
      COALESCE(authorized_record.company_id, think_company_id), -- Usar Think Company se não tiver empresa definida
      COALESCE(authorized_record.allowed_companies, ARRAY[]::uuid[]),
      'active'  -- Definir como ativo quando o usuário se registra
    );
    
    -- Marcar o email autorizado como usado
    UPDATE public.authorized_emails
    SET used_at = now()
    WHERE id = authorized_record.id;
    
  ELSE
    -- Fallback para usuários sem autorização prévia (sempre atribuir à Think Company)
    INSERT INTO public.profiles (user_id, email, full_name, role, company_id, invitation_status)
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'full_name', 'User'),
      'client',
      think_company_id, -- Automaticamente atribuir à Think Company
      'active'  -- Definir como ativo por padrão
    );
  END IF;
  
  RETURN NEW;
END;
$function$;