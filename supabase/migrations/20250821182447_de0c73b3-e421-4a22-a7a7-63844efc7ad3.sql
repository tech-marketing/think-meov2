-- Criar empresa Think Company se não existir
INSERT INTO companies (name) 
VALUES ('Think Company')
ON CONFLICT (name) DO NOTHING;