-- Remover o trigger duplicado que está causando o erro
DROP TRIGGER IF EXISTS trigger_handle_new_user ON auth.users;

-- Manter apenas o trigger original
-- O trigger on_auth_user_created já existe e é suficiente