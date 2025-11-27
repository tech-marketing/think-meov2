-- Adicionar coluna copy para separar copy de legenda
ALTER TABLE public.materials 
ADD COLUMN copy TEXT;