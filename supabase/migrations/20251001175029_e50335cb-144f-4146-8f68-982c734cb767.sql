-- Atualizar constraint de tipos permitidos na tabela notifications
ALTER TABLE public.notifications 
DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications 
ADD CONSTRAINT notifications_type_check 
CHECK (type IN ('mention', 'comment', 'approval', 'rejection', 'project_update', 'project_invite', 'status_update'));