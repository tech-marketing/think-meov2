-- Criar bucket público para assets do sistema
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'system-assets',
  'system-assets',
  true,
  5242880, -- 5MB
  ARRAY['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp']
);

-- Política para permitir qualquer um visualizar os assets
CREATE POLICY "Assets públicos são visíveis para todos"
ON storage.objects FOR SELECT
USING (bucket_id = 'system-assets');

-- Política para admins fazerem upload
CREATE POLICY "Admins podem fazer upload de assets"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'system-assets' 
  AND (SELECT role FROM public.profiles WHERE user_id = auth.uid()) = 'admin'
);

-- Política para admins atualizarem assets
CREATE POLICY "Admins podem atualizar assets"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'system-assets' 
  AND (SELECT role FROM public.profiles WHERE user_id = auth.uid()) = 'admin'
);

-- Política para admins deletarem assets
CREATE POLICY "Admins podem deletar assets"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'system-assets' 
  AND (SELECT role FROM public.profiles WHERE user_id = auth.uid()) = 'admin'
);