-- Atualizar o perfil do usuário joao.vyctor@thinkcompany.com.br para administrador
UPDATE profiles 
SET role = 'admin', 
    first_login_required = false,
    updated_at = now()
WHERE email = 'joao.vyctor@thinkcompany.com.br';