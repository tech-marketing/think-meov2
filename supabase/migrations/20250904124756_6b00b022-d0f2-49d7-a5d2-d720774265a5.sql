-- Autorizar o email joao.vyctor@thinkcompany.com.br para cadastro
-- Usando qualquer usuário existente como created_by temporariamente
INSERT INTO public.authorized_emails (email, role, created_by, company_id)
SELECT 
  'joao.vyctor@thinkcompany.com.br',
  'admin',
  (SELECT id FROM public.profiles LIMIT 1), -- Usar qualquer profile existente
  (SELECT id FROM public.companies WHERE name = 'Think Company' LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM public.authorized_emails WHERE email = 'joao.vyctor@thinkcompany.com.br');