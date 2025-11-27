-- Allow admins to view all profiles regardless of company
CREATE POLICY "Admins can view all profiles" 
ON public.profiles 
FOR SELECT 
TO authenticated 
USING (get_current_user_role() = 'admin');