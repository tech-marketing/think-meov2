-- Verificar a constraint atual
SELECT conname, consrc 
FROM pg_constraint 
WHERE conname = 'materials_type_check';

-- Remover a constraint atual se existir
ALTER TABLE public.materials DROP CONSTRAINT IF EXISTS materials_type_check;

-- Adicionar a nova constraint que inclui 'copy'
ALTER TABLE public.materials 
ADD CONSTRAINT materials_type_check 
CHECK (type IN ('image', 'video', 'pdf', 'copy'));

-- Verificar se a constraint foi aplicada corretamente
SELECT conname, consrc 
FROM pg_constraint 
WHERE conname = 'materials_type_check';