-- Corrigir os perfis e emails autorizados

-- 1. Atualizar o perfil do tech@thinkcompany.com.br para admin
UPDATE profiles 
SET role = 'admin', 
    updated_at = now()
WHERE email = 'tech@thinkcompany.com.br' AND user_id = '4e20894a-f849-4288-8e63-20f0a73916ea';

-- 2. Marcar os emails como usados para remover do "Aguardando cadastro"
UPDATE authorized_emails 
SET used_at = now() 
WHERE email IN ('tech@thinkcompany.com.br', 'joao.vyctor@thinkcompany.com.br') AND used_at IS NULL;