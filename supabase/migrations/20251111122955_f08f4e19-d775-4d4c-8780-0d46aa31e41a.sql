-- Normalizar emails existentes na tabela authorized_emails para lowercase
UPDATE authorized_emails 
SET email = LOWER(TRIM(email));

-- Normalizar emails existentes na tabela profiles para lowercase
UPDATE profiles 
SET email = LOWER(TRIM(email));