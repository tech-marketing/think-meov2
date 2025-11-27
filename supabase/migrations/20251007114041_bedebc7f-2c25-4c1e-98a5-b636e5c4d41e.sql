-- Adicionar nova política para permitir que participantes de projeto vejam uns aos outros
CREATE POLICY "Project participants can view each other"
ON public.profiles
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM project_participants pp1
    INNER JOIN project_participants pp2 ON pp1.project_id = pp2.project_id
    WHERE pp1.user_id = auth.uid()
      AND pp2.user_id = profiles.user_id
  )
  OR
  -- Também permitir se o projeto foi criado por qualquer um dos dois usuários
  EXISTS (
    SELECT 1
    FROM projects p
    INNER JOIN project_participants pp ON p.id = pp.project_id
    WHERE (p.created_by = get_current_user_profile_id() OR pp.user_id = auth.uid())
      AND (p.created_by = profiles.id OR pp.user_id = profiles.user_id)
  )
);