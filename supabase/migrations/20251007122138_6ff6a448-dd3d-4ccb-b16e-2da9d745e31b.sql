-- Adicionar coluna username na tabela profiles
ALTER TABLE public.profiles 
ADD COLUMN username text UNIQUE;

-- Criar índice para busca rápida por username
CREATE INDEX idx_profiles_username ON public.profiles(username);

-- Adicionar constraint para validar formato do username (padrão Instagram: letras, números, pontos e underscores)
ALTER TABLE public.profiles
ADD CONSTRAINT username_format CHECK (username ~* '^[a-z0-9._]+$');

-- Adicionar constraint para tamanho do username (mínimo 3, máximo 30 caracteres)
ALTER TABLE public.profiles
ADD CONSTRAINT username_length CHECK (char_length(username) >= 3 AND char_length(username) <= 30);

-- Comentário explicativo
COMMENT ON COLUMN public.profiles.username IS 'Username único do usuário, formato Instagram (letras minúsculas, números, pontos e underscores)';