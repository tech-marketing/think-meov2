-- Limpar registro problemático do usuário joao.vyctor@thinkcompany.com.br
-- que está marcado como usado mas não tem perfil correspondente
DELETE FROM public.authorized_emails 
WHERE email = 'joao.vyctor@thinkcompany.com.br' 
AND used_at IS NOT NULL;