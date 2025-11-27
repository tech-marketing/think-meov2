-- Update the existing restrictive policy for projects to allow admins to view all
DROP POLICY IF EXISTS "Users can view projects from their company" ON public.projects;

CREATE POLICY "Users can view projects from their company or admins can view all"
ON public.projects
FOR SELECT
USING (
  (company_id = get_current_user_company_id()) OR 
  (get_current_user_role() = 'admin')
);

-- Update the companies policy to allow admins to view all companies
DROP POLICY IF EXISTS "Users can view their company" ON public.companies;

CREATE POLICY "Users can view their company or admins can view all"
ON public.companies
FOR SELECT
USING (
  (id = get_current_user_company_id()) OR 
  (get_current_user_role() = 'admin')
);