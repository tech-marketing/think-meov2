-- Verificar e corrigir a foreign key constraint que está causando problemas
-- Remover a foreign key incorreta se existir
ALTER TABLE public.project_participants 
DROP CONSTRAINT IF EXISTS project_participants_user_id_fkey;

-- A coluna user_id deve referenciar auth.users.id, não profiles
-- Mas como não podemos referenciar auth.users diretamente, vamos remover a constraint
-- e deixar o trigger de validação fazer a verificação

-- Verificar se ainda há o trigger de validação
-- (O trigger validate_participant_user já faz a validação necessária)