-- Corrigir RLS policies para Materials - permitir aprovações corretas

-- Primeiro, remover todas as políticas de update existentes
DROP POLICY IF EXISTS "Admins can update all materials" ON public.materials;
DROP POLICY IF EXISTS "Collaborators can approve internally and update materials from their companies" ON public.materials;
DROP POLICY IF EXISTS "Clients can approve materials and update status (limited)" ON public.materials;
DROP POLICY IF EXISTS "Material creators can update their own materials" ON public.materials;
DROP POLICY IF EXISTS "Collaborators can approve internally and update materials from  " ON public.materials;

-- Verificar e atualizar constraint de status se necessário
DO $$
BEGIN
    -- Remover constraint existente se houver problema
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'materials_status_check' 
        AND table_name = 'materials'
    ) THEN
        ALTER TABLE public.materials DROP CONSTRAINT materials_status_check;
    END IF;
    
    -- Recriar constraint com todos os status válidos
    ALTER TABLE public.materials ADD CONSTRAINT materials_status_check 
    CHECK (status IN ('pending', 'internal_approval', 'client_approval', 'approved', 'needs_adjustment', 'rejected'));
END $$;

-- Criar políticas de update mais permissivas e corretas

-- Admins podem atualizar qualquer material
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

-- Colaboradores podem atualizar materiais de suas empresas
CREATE POLICY "Collaborators can update materials from their companies"
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

-- Clientes podem atualizar status de materiais de suas empresas (com restrições)
CREATE POLICY "Clients can update materials from their companies"
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
);

-- Criadores podem atualizar seus próprios materiais
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