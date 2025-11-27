-- Permitir que qualquer usuário autenticado veja emails autorizados (para verificação no cadastro)
DROP POLICY IF EXISTS "Users can view their own authorized email" ON public.authorized_emails;

CREATE POLICY "Anyone can view authorized emails for signup" 
ON public.authorized_emails 
FOR SELECT 
TO authenticated, anon
USING (true);