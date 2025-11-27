-- Atualizar o usuário João Vyctor para a empresa Hyster
UPDATE public.profiles 
SET company_id = (SELECT id FROM companies WHERE name = 'Hyster')
WHERE email = 'joao.vyctor@thinkcompany.com.br';

-- Verificar se o admin tem acesso global ou precisa de empresa
UPDATE public.profiles 
SET company_id = (SELECT id FROM companies WHERE name = 'Think Company')
WHERE email = 'tech@thinkcompany.com.br' AND company_id IS NULL;