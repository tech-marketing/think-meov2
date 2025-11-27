-- Inserir algumas empresas de exemplo para teste
INSERT INTO public.companies (name) 
VALUES 
  ('Mandic'),
  ('Hyster'),
  ('Yale'),
  ('Água Doce')
ON CONFLICT DO NOTHING;