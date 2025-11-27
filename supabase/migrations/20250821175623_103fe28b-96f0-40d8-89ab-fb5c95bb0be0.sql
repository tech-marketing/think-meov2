-- Atualizar política de criação de projetos para apenas admins e colaboradores
DROP POLICY IF EXISTS "Admins and collaborators can create projects" ON public.projects;

CREATE POLICY "Admins and collaborators can create projects" 
ON public.projects 
FOR INSERT 
TO authenticated
WITH CHECK (
  (get_current_user_role() = ANY (ARRAY['admin'::user_role, 'collaborator'::user_role])) 
  AND 
  ((get_current_user_role() = 'admin'::user_role) OR (company_id = get_current_user_company()) OR (company_id = ANY (get_current_user_allowed_companies())))
);