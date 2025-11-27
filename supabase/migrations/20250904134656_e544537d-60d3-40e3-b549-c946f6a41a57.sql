-- Fix critical security issue: Users should only see projects from companies they have access to
-- Remove the overly permissive admin policy and make it more restrictive

-- Drop existing policies for projects
DROP POLICY IF EXISTS "Users can view projects from accessible companies" ON public.projects;
DROP POLICY IF EXISTS "Project participants can view their projects" ON public.projects;

-- Create new, more restrictive policies
-- 1. Users can only view projects from companies they have explicit access to
CREATE POLICY "Users can view projects from their accessible companies only" 
ON public.projects 
FOR SELECT 
USING (
  -- Check if user has access to the project's company
  (company_id = get_current_user_company()) OR 
  (company_id = ANY (get_current_user_allowed_companies()))
);

-- 2. Project participants can view their projects (but only if they also have company access)
CREATE POLICY "Project participants can view their projects with company access" 
ON public.projects 
FOR SELECT 
USING (
  is_project_participant(id) AND 
  (
    (company_id = get_current_user_company()) OR 
    (company_id = ANY (get_current_user_allowed_companies()))
  )
);

-- 3. Super admins (Think Company admins) can view all projects
CREATE POLICY "Think Company admins can view all projects" 
ON public.projects 
FOR SELECT 
USING (
  get_current_user_role() = 'admin' AND 
  get_current_user_company() = (SELECT id FROM public.companies WHERE name = 'Think Company' LIMIT 1)
);