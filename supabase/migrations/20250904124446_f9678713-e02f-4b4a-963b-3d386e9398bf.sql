-- Alterar o usuário joao.vyctor@thinkcompany.com.br para administrador
UPDATE public.profiles 
SET role = 'admin'
WHERE email = 'joao.vyctor@thinkcompany.com.br';