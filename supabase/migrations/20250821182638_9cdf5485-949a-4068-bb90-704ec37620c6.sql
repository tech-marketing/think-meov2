-- Corrigir constraint do invitation_status para permitir 'active'
ALTER TABLE public.profiles 
DROP CONSTRAINT IF EXISTS profiles_invitation_status_check;

ALTER TABLE public.profiles 
ADD CONSTRAINT profiles_invitation_status_check 
CHECK (invitation_status = ANY (ARRAY['pending'::text, 'completed'::text, 'active'::text]));