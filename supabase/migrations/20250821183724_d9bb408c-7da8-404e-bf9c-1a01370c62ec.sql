-- Permitir que colaboradores e administradores excluam projetos
CREATE POLICY "Admins and collaborators can delete projects" 
ON public.projects 
FOR DELETE 
USING (
  (get_current_user_role() = 'admin'::user_role) OR 
  (
    get_current_user_role() = 'collaborator'::user_role AND 
    (
      company_id = get_current_user_company() OR 
      company_id = ANY (get_current_user_allowed_companies())
    )
  ) OR
  (created_by = (SELECT id FROM profiles WHERE user_id = auth.uid()))
);

-- Permitir que colaboradores e administradores excluam materiais
CREATE POLICY "Admins and collaborators can delete materials" 
ON public.materials 
FOR DELETE 
USING (
  (get_current_user_role() = 'admin'::user_role) OR 
  (
    get_current_user_role() = 'collaborator'::user_role AND 
    (
      company_id = get_current_user_company() OR 
      company_id = ANY (get_current_user_allowed_companies())
    )
  ) OR
  (created_by = (SELECT id FROM profiles WHERE user_id = auth.uid()))
);