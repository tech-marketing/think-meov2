-- Fix the recursive policy issue by simplifying the policies
DROP POLICY IF EXISTS "Users can view project participants from accessible projects" ON public.project_participants;
DROP POLICY IF EXISTS "Project owners and admins can manage participants" ON public.project_participants;

-- Create simpler, non-recursive policies
CREATE POLICY "Users can view project participants from accessible projects" 
ON public.project_participants 
FOR SELECT 
USING (
  get_current_user_role() = 'admin'::user_role 
  OR EXISTS (
    SELECT 1 FROM public.projects p 
    WHERE p.id = project_id 
    AND (
      p.company_id = get_current_user_company() 
      OR p.company_id = ANY(get_current_user_allowed_companies())
    )
  )
);

CREATE POLICY "Admins can manage all project participants" 
ON public.project_participants 
FOR ALL 
USING (get_current_user_role() = 'admin'::user_role)
WITH CHECK (get_current_user_role() = 'admin'::user_role);

CREATE POLICY "Project creators can manage participants" 
ON public.project_participants 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.projects p 
    WHERE p.id = project_id 
    AND p.created_by = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  )
) 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.projects p 
    WHERE p.id = project_id 
    AND p.created_by = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  )
);