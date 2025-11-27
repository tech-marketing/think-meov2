-- Remover constraint antiga de status
ALTER TABLE materials DROP CONSTRAINT IF EXISTS materials_status_check;

-- Adicionar nova constraint com todos os status necessários
ALTER TABLE materials 
ADD CONSTRAINT materials_status_check 
CHECK (status IN ('pending', 'approved', 'rejected', 'client_approval', 'internal_approval', 'processing', 'failed'));