-- Remover políticas antigas da tabela materials que limitam admins
DROP POLICY IF EXISTS "Users can view materials from their company" ON public.materials;
DROP POLICY IF EXISTS "Users can create materials" ON public.materials;
DROP POLICY IF EXISTS "Users can update materials from their company" ON public.materials;
DROP POLICY IF EXISTS "Admins and collaborators can delete company materials" ON public.materials;

-- Criar novas políticas que permitem admin acesso total
CREATE POLICY "Users can view materials from their company or admins can view all"
ON public.materials
FOR SELECT
USING (
  company_id = get_current_user_company_id() 
  OR get_current_user_role() = 'admin'
);

CREATE POLICY "Users can create materials in their company or admins can create anywhere"
ON public.materials
FOR INSERT
WITH CHECK (
  company_id = get_current_user_company_id() 
  OR get_current_user_role() = 'admin'
);

CREATE POLICY "Users can update materials from their company or admins can update all"
ON public.materials
FOR UPDATE
USING (
  company_id = get_current_user_company_id() 
  OR get_current_user_role() = 'admin'
);

CREATE POLICY "Admins can delete any material"
ON public.materials
FOR DELETE
USING (get_current_user_role() = 'admin');