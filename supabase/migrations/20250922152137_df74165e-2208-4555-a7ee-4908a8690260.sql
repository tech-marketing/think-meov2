-- Corrigir status de convite inconsistentes
-- Usuários que já estão usando o sistema mas ainda aparecem como pendentes

-- 1. Atualizar profiles que têm authorized_emails com used_at preenchido para 'accepted'
UPDATE public.profiles 
SET 
  invitation_status = 'accepted',
  invitation_sent_at = COALESCE(invitation_sent_at, now())
WHERE email IN (
  SELECT ae.email 
  FROM public.authorized_emails ae 
  WHERE ae.used_at IS NOT NULL
) 
AND invitation_status != 'accepted';

-- 2. Para usuários que não têm entrada em authorized_emails mas já existem (caso do tech@thinkcompany.com.br),
-- vamos marcar como accepted também já que conseguiram se cadastrar
UPDATE public.profiles 
SET 
  invitation_status = 'accepted',
  invitation_sent_at = COALESCE(invitation_sent_at, now())
WHERE email NOT IN (
  SELECT ae.email 
  FROM public.authorized_emails ae
) 
AND invitation_status != 'accepted';