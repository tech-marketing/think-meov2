-- Criar políticas para permitir upload de logos de empresa no bucket avatars
-- (O bucket já existe como 'avatars' que está sendo usado para logos também)

-- Permitir que admins façam upload de arquivos
CREATE POLICY "Admins can upload company logos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars' 
  AND (
    SELECT role FROM public.profiles WHERE user_id = auth.uid()
  ) = 'admin'
);

-- Permitir que admins atualizem arquivos
CREATE POLICY "Admins can update company logos"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars' 
  AND (
    SELECT role FROM public.profiles WHERE user_id = auth.uid()
  ) = 'admin'
);

-- Permitir que admins deletem arquivos
CREATE POLICY "Admins can delete company logos"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars' 
  AND (
    SELECT role FROM public.profiles WHERE user_id = auth.uid()
  ) = 'admin'
);