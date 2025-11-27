-- Adicionar campo parent_id para permitir respostas a comentários
ALTER TABLE public.comments 
ADD COLUMN parent_id uuid REFERENCES public.comments(id) ON DELETE CASCADE;

-- Criar índice para melhorar performance nas consultas de comentários aninhados
CREATE INDEX idx_comments_parent_id ON public.comments(parent_id);

-- Adicionar comentário na coluna
COMMENT ON COLUMN public.comments.parent_id IS 'ID do comentário pai para respostas aninhadas. NULL para comentários principais.';