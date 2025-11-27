-- Temporariamente desabilitar RLS para testar
ALTER TABLE public.project_participants DISABLE ROW LEVEL SECURITY;

-- Reabilitar RLS
ALTER TABLE public.project_participants ENABLE ROW LEVEL SECURITY;

-- Remover políticas existentes problemáticas
DROP POLICY IF EXISTS "Admins can manage all project participants" ON public.project_participants;
DROP POLICY IF EXISTS "Project creators can manage participants" ON public.project_participants;

-- Criar nova política simplificada para admins
CREATE POLICY "Admins can manage project participants"
ON public.project_participants
FOR ALL
TO public
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() 
    AND role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() 
    AND role = 'admin'
  )
);

-- Criar política para criadores de projeto
CREATE POLICY "Project creators can manage participants"
ON public.project_participants
FOR ALL
TO public
USING (
  EXISTS (
    SELECT 1 FROM public.projects p
    JOIN public.profiles pr ON p.created_by = pr.id
    WHERE p.id = project_participants.project_id
    AND pr.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.projects p
    JOIN public.profiles pr ON p.created_by = pr.id
    WHERE p.id = project_participants.project_id
    AND pr.user_id = auth.uid()
  )
);