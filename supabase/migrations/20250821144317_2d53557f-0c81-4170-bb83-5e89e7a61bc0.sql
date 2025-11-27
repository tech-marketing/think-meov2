-- Verificar se o bucket materials existe e torná-lo público se necessário
UPDATE storage.buckets 
SET public = true 
WHERE id = 'materials';

-- Criar políticas mais permissivas para visualizar os arquivos
DROP POLICY IF EXISTS "materials_select_policy" ON storage.objects;

-- Política para permitir que todos vejam arquivos do bucket materials
CREATE POLICY "Public Access" ON storage.objects
FOR SELECT USING (bucket_id = 'materials');