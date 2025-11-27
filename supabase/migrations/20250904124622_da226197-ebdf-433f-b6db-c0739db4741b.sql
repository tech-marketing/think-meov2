-- Autorizar o email joao.vyctor@thinkcompany.com.br para cadastro
-- Primeiro verificar se já existe
DO $$
BEGIN
  -- Se não existir, inserir o email autorizado
  IF NOT EXISTS (SELECT 1 FROM public.authorized_emails WHERE email = 'joao.vyctor@thinkcompany.com.br') THEN
    INSERT INTO public.authorized_emails (email, role, created_by, company_id)
    VALUES (
      'joao.vyctor@thinkcompany.com.br',
      'admin',
      (SELECT id FROM public.profiles WHERE role = 'admin' LIMIT 1),
      (SELECT id FROM public.companies WHERE name = 'Think Company' LIMIT 1)
    );
  END IF;
END $$;