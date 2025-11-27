-- Allow admins to view all projects across companies
CREATE POLICY IF NOT EXISTS "Admins can view all projects"
ON public.projects
FOR SELECT
USING (get_current_user_role() = 'admin');