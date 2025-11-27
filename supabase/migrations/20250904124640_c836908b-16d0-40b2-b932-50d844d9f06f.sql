-- Primeiro, criar um administrador padrão se não existir
INSERT INTO public.profiles (user_id, email, full_name, role, company_id, invitation_status)
SELECT 
  gen_random_uuid(),
  'admin@thinkcompany.com.br',
  'Admin System',
  'admin',
  (SELECT id FROM public.companies WHERE name = 'Think Company' LIMIT 1),
  'active'
WHERE NOT EXISTS (SELECT 1 FROM public.profiles WHERE role = 'admin');

-- Agora autorizar o email joao.vyctor@thinkcompany.com.br
INSERT INTO public.authorized_emails (email, role, created_by, company_id)
SELECT 
  'joao.vyctor@thinkcompany.com.br',
  'admin',
  (SELECT id FROM public.profiles WHERE role = 'admin' LIMIT 1),
  (SELECT id FROM public.companies WHERE name = 'Think Company' LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM public.authorized_emails WHERE email = 'joao.vyctor@thinkcompany.com.br');