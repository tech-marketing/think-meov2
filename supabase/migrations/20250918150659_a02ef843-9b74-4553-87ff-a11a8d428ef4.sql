-- Corrigir usuário João Vyctor que foi alterado para admin mas perdeu company_id
UPDATE public.profiles 
SET 
  role = 'admin',
  company_id = '029fed76-73e5-4058-85d5-3f505cc02ad4'
WHERE email = 'joao.vyctor@thinkcompany.com.br';