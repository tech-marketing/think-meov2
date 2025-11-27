-- Criar empresa padrão Think Company
INSERT INTO companies (id, name, created_at, updated_at) 
VALUES (gen_random_uuid(), 'Think Company', now(), now())
ON CONFLICT DO NOTHING;

-- Obter o ID da empresa criada
DO $$
DECLARE
    company_uuid UUID;
BEGIN
    -- Buscar o ID da empresa Think Company
    SELECT id INTO company_uuid FROM companies WHERE name = 'Think Company' LIMIT 1;
    
    -- Atualizar todos os usuários administradores para pertencerem à Think Company
    UPDATE profiles 
    SET company_id = company_uuid,
        updated_at = now()
    WHERE role = 'admin' AND company_id IS NULL;
    
    -- Atualizar authorized_emails para referenciar a empresa
    UPDATE authorized_emails 
    SET company_id = company_uuid 
    WHERE company_id IS NULL;
END $$;