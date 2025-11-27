-- Corrigir tipos de materiais existentes baseado nos nomes e URLs dos arquivos
UPDATE materials 
SET type = 'video' 
WHERE type = 'image' 
  AND (
    LOWER(name) LIKE '%video%' 
    OR LOWER(file_url) LIKE '%.mp4%' 
    OR LOWER(file_url) LIKE '%.mov%' 
    OR LOWER(file_url) LIKE '%.avi%' 
    OR LOWER(file_url) LIKE '%.webm%'
    OR LOWER(name) LIKE '%.mp4%' 
    OR LOWER(name) LIKE '%.mov%' 
    OR LOWER(name) LIKE '%.avi%' 
    OR LOWER(name) LIKE '%.webm%'
  );

UPDATE materials 
SET type = 'pdf' 
WHERE type = 'image' 
  AND (
    LOWER(name) LIKE '%pdf%' 
    OR LOWER(file_url) LIKE '%.pdf%'
    OR LOWER(name) LIKE '%.pdf%'
  );