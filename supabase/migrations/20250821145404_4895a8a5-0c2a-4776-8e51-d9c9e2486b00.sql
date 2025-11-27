-- Verificar se há foreign key entre comments.author_id e profiles.id
-- Se não houver, vamos criar
DO $$ 
BEGIN
    -- Verificar se a foreign key existe
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'comments_author_id_fkey' 
        AND table_name = 'comments'
    ) THEN
        -- Adicionar foreign key constraint
        ALTER TABLE public.comments 
        ADD CONSTRAINT comments_author_id_fkey 
        FOREIGN KEY (author_id) REFERENCES public.profiles(id);
    END IF;
END $$;