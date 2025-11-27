-- Verificar se existe trigger para criar perfil automaticamente
CREATE OR REPLACE TRIGGER trigger_handle_new_user
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Garantir que a função de perfil atual funcione mesmo sem autenticação para debugging
CREATE OR REPLACE FUNCTION public.get_current_user_profile_debug()
RETURNS TABLE (
  user_id uuid,
  email text,
  company_id uuid,
  role text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    p.user_id,
    p.email,
    p.company_id,
    p.role
  FROM public.profiles p 
  WHERE p.user_id = auth.uid() 
  LIMIT 1;
$$;