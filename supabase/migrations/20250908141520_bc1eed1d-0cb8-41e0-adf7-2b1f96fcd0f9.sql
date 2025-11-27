-- Atualizar constraint para incluir status 'taxonomized'
ALTER TABLE public.materials DROP CONSTRAINT IF EXISTS materials_status_check;

ALTER TABLE public.materials 
ADD CONSTRAINT materials_status_check 
CHECK (status IN ('pending', 'approved', 'rejected', 'revision', 'client_approval', 'internal_approval', 'taxonomized'));