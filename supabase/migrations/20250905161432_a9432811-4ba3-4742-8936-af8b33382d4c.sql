-- Atualizar status dos usuários que já fizeram login
-- Usuários com user_id preenchido devem ter status 'accepted' ao invés de 'pending'
UPDATE profiles 
SET invitation_status = 'accepted',
    updated_at = now()
WHERE user_id IS NOT NULL 
  AND invitation_status = 'pending';