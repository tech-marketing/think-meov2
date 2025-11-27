-- Tornar o bucket materials público para resolver problema de acesso 404
UPDATE storage.buckets SET public = true WHERE id = 'materials';