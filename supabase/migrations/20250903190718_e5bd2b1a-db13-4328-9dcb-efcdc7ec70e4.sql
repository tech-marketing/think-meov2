-- Atualizar RLS policies para implementar permissões corretas de aprovação

-- Remover a política existente de update em materials que é muito permissiva
DROP POLICY IF EXISTS "Users can update materials (restricted)" ON public.materials;

-- Criar políticas mais específicas para diferentes tipos de ações
CREATE POLICY "Admins can update all materials"
ON public.materials
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.user_id = auth.uid() 
    AND profiles.role = 'admin'
  )
);

CREATE POLICY "Collaborators can approve internally and update materials from their companies"
ON public.materials  
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.user_id = auth.uid() 
    AND profiles.role = 'collaborator'
    AND (
      materials.company_id = profiles.company_id 
      OR materials.company_id = ANY(profiles.allowed_companies)
    )
  )
);

CREATE POLICY "Clients can approve materials and update status (limited)"
ON public.materials
FOR UPDATE  
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.user_id = auth.uid() 
    AND profiles.role = 'client'
    AND (
      materials.company_id = profiles.company_id 
      OR materials.company_id = ANY(profiles.allowed_companies)
    )
  )
) 
WITH CHECK (
  -- Clientes só podem aprovar materiais que já foram aprovados internamente
  (status = 'client_approval' AND 
   (SELECT status FROM materials WHERE id = materials.id) = 'internal_approval') 
  OR 
  -- Ou podem solicitar ajustes/reprovar em qualquer material de sua empresa
  status IN ('needs_adjustment', 'rejected')
  OR
  -- Podem atualizar briefing_approved_by_client quando aprovam
  briefing_approved_by_client = true
);

CREATE POLICY "Material creators can update their own materials"
ON public.materials
FOR UPDATE
USING (
  created_by = (
    SELECT profiles.id 
    FROM public.profiles 
    WHERE profiles.user_id = auth.uid()
  )
);