-- Criar bucket para materiais criativos
INSERT INTO storage.buckets (id, name, public) VALUES ('materials', 'materials', false);

-- Criar políticas para o bucket de materiais
-- Usuários autenticados podem fazer upload de materiais
CREATE POLICY "Authenticated users can upload materials" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'materials' AND 
  auth.role() = 'authenticated' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Usuários podem visualizar materiais de suas empresas ou se for admin
CREATE POLICY "Users can view accessible materials" 
ON storage.objects 
FOR SELECT 
USING (
  bucket_id = 'materials' AND (
    get_current_user_role() = 'admin'::user_role OR
    EXISTS (
      SELECT 1 FROM materials m 
      WHERE m.file_url LIKE '%' || name || '%' AND (
        m.company_id = get_current_user_company() OR 
        m.company_id = ANY(get_current_user_allowed_companies())
      )
    )
  )
);

-- Usuários podem atualizar materiais que criaram ou se for admin
CREATE POLICY "Users can update their materials" 
ON storage.objects 
FOR UPDATE 
USING (
  bucket_id = 'materials' AND (
    get_current_user_role() = 'admin'::user_role OR
    (storage.foldername(name))[1] = auth.uid()::text
  )
);

-- Usuários podem deletar materiais que criaram ou se for admin
CREATE POLICY "Users can delete their materials" 
ON storage.objects 
FOR DELETE 
USING (
  bucket_id = 'materials' AND (
    get_current_user_role() = 'admin'::user_role OR
    (storage.foldername(name))[1] = auth.uid()::text
  )
);