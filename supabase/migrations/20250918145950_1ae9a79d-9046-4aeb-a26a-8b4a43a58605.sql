-- Corrigir usuários que não têm company_id definido
-- Atribuir para a empresa Think Company por padrão

UPDATE public.profiles 
SET company_id = '029fed76-73e5-4058-85d5-3f505cc02ad4'
WHERE company_id IS NULL AND user_id IS NOT NULL;

-- Garantir que todos os usuários tenham role definido
UPDATE public.profiles 
SET role = 'client' 
WHERE role IS NULL;