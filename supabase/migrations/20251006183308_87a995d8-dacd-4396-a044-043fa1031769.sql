-- Criar política para permitir que participantes de projetos vejam perfis de outros participantes
CREATE POLICY "Users can view profiles of project participants"
ON public.profiles
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.project_participants pp1
    INNER JOIN public.project_participants pp2 
      ON pp1.project_id = pp2.project_id
    WHERE pp1.user_id = auth.uid()
      AND pp2.user_id = profiles.user_id
  )
);