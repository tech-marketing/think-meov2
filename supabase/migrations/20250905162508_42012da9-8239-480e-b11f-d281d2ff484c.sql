-- Atualizar used_at para emails que já foram usados para cadastro
UPDATE authorized_emails 
SET used_at = now() 
WHERE used_at IS NULL 
  AND email IN (
    SELECT email 
    FROM profiles 
    WHERE user_id IS NOT NULL
  );