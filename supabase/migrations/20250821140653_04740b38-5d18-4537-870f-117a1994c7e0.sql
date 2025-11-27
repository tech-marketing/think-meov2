-- Remover as políticas problemáticas do storage
DROP POLICY IF EXISTS "Authenticated users can upload materials" ON storage.objects;
DROP POLICY IF EXISTS "Users can view accessible materials" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their materials" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their materials" ON storage.objects;

-- Criar políticas mais simples e funcionais para o storage
-- Política para upload: usuários autenticados podem fazer upload
CREATE POLICY "Allow authenticated uploads" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'materials' AND 
  auth.role() = 'authenticated'
);

-- Política para visualização: usuários autenticados podem ver seus próprios arquivos ou se forem admin
CREATE POLICY "Allow authenticated downloads" 
ON storage.objects 
FOR SELECT 
USING (
  bucket_id = 'materials' AND 
  auth.role() = 'authenticated' AND (
    get_current_user_role() = 'admin'::user_role OR
    (storage.foldername(name))[1] = auth.uid()::text
  )
);

-- Política para atualização: usuários podem atualizar seus próprios arquivos ou se forem admin
CREATE POLICY "Allow authenticated updates" 
ON storage.objects 
FOR UPDATE 
USING (
  bucket_id = 'materials' AND 
  auth.role() = 'authenticated' AND (
    get_current_user_role() = 'admin'::user_role OR
    (storage.foldername(name))[1] = auth.uid()::text
  )
);

-- Política para exclusão: usuários podem deletar seus próprios arquivos ou se forem admin
CREATE POLICY "Allow authenticated deletes" 
ON storage.objects 
FOR DELETE 
USING (
  bucket_id = 'materials' AND 
  auth.role() = 'authenticated' AND (
    get_current_user_role() = 'admin'::user_role OR
    (storage.foldername(name))[1] = auth.uid()::text
  )
);