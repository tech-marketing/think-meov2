-- Permitir que usuários não autenticados marquem o email como usado após o cadastro
CREATE POLICY "Allow marking email as used during signup" ON authorized_emails
FOR UPDATE 
TO anon
USING (used_at IS NULL)
WITH CHECK (used_at IS NOT NULL);