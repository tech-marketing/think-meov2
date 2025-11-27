-- Autorizar o email joao.vyctor@thinkcompany.com.br para cadastro
-- Usar um UUID fixo como created_by já que não temos admin ainda
INSERT INTO public.authorized_emails (email, role, created_by, company_id)
VALUES (
  'joao.vyctor@thinkcompany.com.br',
  'admin',
  '00000000-0000-0000-0000-000000000000'::uuid, -- UUID temporário
  (SELECT id FROM public.companies WHERE name = 'Think Company' LIMIT 1)
)
ON CONFLICT (email) DO NOTHING;