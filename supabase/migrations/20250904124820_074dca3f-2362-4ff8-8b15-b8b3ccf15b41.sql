-- Temporariamente tornar created_by nullable para permitir a criação
ALTER TABLE public.authorized_emails ALTER COLUMN created_by DROP NOT NULL;

-- Autorizar o email
INSERT INTO public.authorized_emails (email, role, company_id)
VALUES (
  'joao.vyctor@thinkcompany.com.br',
  'admin',
  (SELECT id FROM public.companies WHERE name = 'Think Company' LIMIT 1)
)
ON CONFLICT (email) DO NOTHING;