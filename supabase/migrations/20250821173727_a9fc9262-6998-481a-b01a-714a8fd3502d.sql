-- Permitir que administradores deletem usuários
CREATE POLICY "Admins can delete profiles" 
ON public.profiles 
FOR DELETE 
TO authenticated
USING (get_current_user_role() = 'admin');