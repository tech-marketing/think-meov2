-- Remover a constraint antiga de status
ALTER TABLE public.materials DROP CONSTRAINT materials_status_check;

-- Adicionar nova constraint com todos os status necessários
ALTER TABLE public.materials ADD CONSTRAINT materials_status_check 
CHECK (status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'revision'::text, 'client_approval'::text, 'internal_approval'::text]));