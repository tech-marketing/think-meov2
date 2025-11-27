-- Listar e remover TODAS as políticas do bucket materials
DROP POLICY IF EXISTS "Allow authenticated uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated downloads" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated updates" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated deletes" ON storage.objects;

-- Verificar todas as políticas existentes no storage.objects e removê-las
DO $$ 
BEGIN
    -- Remover políticas que podem estar causando conflito
    EXECUTE 'DROP POLICY IF EXISTS "materials_upload_policy" ON storage.objects';
    EXECUTE 'DROP POLICY IF EXISTS "materials_select_policy" ON storage.objects';
    EXECUTE 'DROP POLICY IF EXISTS "materials_update_policy" ON storage.objects';
    EXECUTE 'DROP POLICY IF EXISTS "materials_delete_policy" ON storage.objects';
EXCEPTION WHEN OTHERS THEN
    NULL; -- Ignorar erros se as políticas não existirem
END $$;

-- Criar políticas simples para o bucket materials
CREATE POLICY "materials_upload_policy" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'materials');

CREATE POLICY "materials_select_policy" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'materials');

CREATE POLICY "materials_update_policy" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'materials');

CREATE POLICY "materials_delete_policy" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'materials');