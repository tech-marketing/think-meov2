-- Verificar e ajustar políticas RLS para projetos
-- Admins devem ver todos os projetos, não apenas os de sua empresa

-- Primeiro, dropar a política existente e recriar com lógica correta
DROP POLICY IF EXISTS "Users can view projects from their company" ON projects;

-- Recriar a política para permitir que admins vejam todos os projetos
CREATE POLICY "Users can view projects from accessible companies" 
ON projects 
FOR SELECT 
USING (
  get_current_user_role() = 'admin'::user_role OR 
  company_id = get_current_user_company() OR 
  company_id = ANY (get_current_user_allowed_companies())
);