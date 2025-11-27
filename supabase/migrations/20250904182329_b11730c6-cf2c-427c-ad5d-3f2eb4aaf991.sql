-- Add RLS policy to allow project creators to view their own projects
CREATE POLICY "Project creators can view their own projects" 
ON public.projects 
FOR SELECT 
USING (created_by = (SELECT id FROM public.profiles WHERE user_id = auth.uid()));