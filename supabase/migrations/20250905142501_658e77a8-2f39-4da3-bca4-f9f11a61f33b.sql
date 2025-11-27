-- Criar política para permitir verificação de emails autorizados durante cadastro
CREATE POLICY "Anyone can check if email is authorized for signup" ON public.authorized_emails 
FOR SELECT USING (
  -- Permite verificar se um email está autorizado (apenas para validação de cadastro)
  used_at IS NULL
);