-- Criar política para permitir verificação de email autorizado durante o cadastro
-- Usuários não autenticados podem verificar se um email está autorizado
CREATE POLICY "Allow email authorization check during signup" ON authorized_emails
FOR SELECT 
TO anon
USING (
  -- Permitir apenas verificar se o email existe e não foi usado
  used_at IS NULL
);