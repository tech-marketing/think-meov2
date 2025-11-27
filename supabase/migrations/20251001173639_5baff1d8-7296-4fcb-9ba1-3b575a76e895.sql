-- Adicionar coluna reference na tabela materials
ALTER TABLE public.materials 
ADD COLUMN IF NOT EXISTS reference TEXT;