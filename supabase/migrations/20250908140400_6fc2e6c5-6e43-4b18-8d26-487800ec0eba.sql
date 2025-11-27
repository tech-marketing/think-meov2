-- Adicionar colunas de review para controle de aprovação de materiais
ALTER TABLE public.materials 
ADD COLUMN reviewed_by uuid REFERENCES public.profiles(id),
ADD COLUMN reviewed_at timestamp with time zone;