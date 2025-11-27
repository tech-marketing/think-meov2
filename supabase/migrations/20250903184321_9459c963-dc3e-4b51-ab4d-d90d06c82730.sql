-- Corrigir funções sem search_path definido
-- Estas correções são para os warnings de segurança do linter

-- Atualizar função auto_approve_briefing_by_client para ter search_path seguro
DROP FUNCTION IF EXISTS public.auto_approve_briefing_by_client() CASCADE;

CREATE OR REPLACE FUNCTION public.auto_approve_briefing_by_client()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Se é um briefing e foi aprovado pelo cliente, marcar como approved_by_client
  IF NEW.is_briefing = true AND NEW.status = 'client_approval' THEN
    NEW.briefing_approved_by_client = true;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Recriar o trigger
CREATE TRIGGER trigger_auto_approve_briefing_by_client
    BEFORE INSERT OR UPDATE ON public.materials
    FOR EACH ROW
    EXECUTE FUNCTION public.auto_approve_briefing_by_client();

-- Atualizar função handle_new_user para ter search_path seguro
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

-- Recriar o trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();