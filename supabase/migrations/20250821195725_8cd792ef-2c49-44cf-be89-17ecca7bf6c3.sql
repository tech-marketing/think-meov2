-- Criar políticas de storage para o bucket materials
-- Permitir que usuários autenticados visualizem materiais de suas empresas

-- Policy para SELECT (visualizar arquivos)
CREATE POLICY "Users can view materials from their companies" ON storage.objects
FOR SELECT USING (
  bucket_id = 'materials' AND 
  (
    -- Admins podem ver tudo
    (EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.user_id = auth.uid() AND profiles.role = 'admin'
    )) OR
    -- Usuários podem ver arquivos de suas empresas ou empresas permitidas
    (EXISTS (
      SELECT 1 FROM public.materials m
      JOIN public.profiles p ON p.user_id = auth.uid()
      WHERE m.file_url LIKE '%' || (storage.foldername(name))[1] || '%'
      AND (
        m.company_id = p.company_id OR 
        m.company_id = ANY(p.allowed_companies)
      )
    ))
  )
);

-- Policy para INSERT (upload de arquivos)  
CREATE POLICY "Users can upload materials" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'materials' AND
  (EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.user_id = auth.uid() 
    AND profiles.role IN ('admin', 'collaborator')
  ))
);

-- Policy para UPDATE (atualizar arquivos)
CREATE POLICY "Users can update their materials" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'materials' AND
  (
    -- Admins podem atualizar tudo
    (EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.user_id = auth.uid() AND profiles.role = 'admin'
    )) OR
    -- Colaboradores podem atualizar arquivos que criaram
    (EXISTS (
      SELECT 1 FROM public.materials m
      JOIN public.profiles p ON p.user_id = auth.uid()
      WHERE m.file_url LIKE '%' || (storage.foldername(name))[1] || '%'
      AND m.created_by = p.id
    ))
  )
);

-- Policy para DELETE (deletar arquivos)
CREATE POLICY "Users can delete their materials" ON storage.objects
FOR DELETE USING (
  bucket_id = 'materials' AND
  (
    -- Admins podem deletar tudo
    (EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.user_id = auth.uid() AND profiles.role = 'admin'
    )) OR
    -- Colaboradores podem deletar arquivos que criaram
    (EXISTS (
      SELECT 1 FROM public.materials m
      JOIN public.profiles p ON p.user_id = auth.uid()
      WHERE m.file_url LIKE '%' || (storage.foldername(name))[1] || '%'
      AND m.created_by = p.id
    ))
  )
);