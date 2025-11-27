-- Corrigir os dados dos usuários existentes

-- 1. Corrigir o perfil do tech@thinkcompany.com.br
UPDATE profiles 
SET role = 'admin', 
    invitation_status = 'completed',
    updated_at = now()
WHERE email = 'tech@thinkcompany.com.br';

-- 2. Marcar o email do tech@thinkcompany.com.br como usado
UPDATE authorized_emails 
SET used_at = now() 
WHERE email = 'tech@thinkcompany.com.br' AND used_at IS NULL;

-- 3. Corrigir o status do joao.vyctor@thinkcompany.com.br
UPDATE profiles 
SET invitation_status = 'completed',
    updated_at = now()
WHERE email = 'joao.vyctor@thinkcompany.com.br';

-- 4. Marcar o email do joao.vyctor@thinkcompany.com.br como usado se ainda não foi
UPDATE authorized_emails 
SET used_at = now() 
WHERE email = 'joao.vyctor@thinkcompany.com.br' AND used_at IS NULL;