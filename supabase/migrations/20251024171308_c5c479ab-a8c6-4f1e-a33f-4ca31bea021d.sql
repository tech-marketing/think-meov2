-- Criar trigger para enviar email quando houver menção
-- Este trigger chama a edge function send-mention-email automaticamente

-- 1. Criar função que dispara o envio de email
CREATE OR REPLACE FUNCTION public.trigger_mention_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  notification_payload jsonb;
  supabase_url text;
  service_role_key text;
BEGIN
  -- Apenas processar notificações do tipo 'mention'
  IF NEW.type != 'mention' THEN
    RETURN NEW;
  END IF;

  -- Obter configurações do Supabase (do ambiente)
  supabase_url := current_setting('app.settings.supabase_url', true);
  service_role_key := current_setting('app.settings.service_role_key', true);

  -- Se não configurado, usar valores padrão (serão substituídos pela edge function)
  IF supabase_url IS NULL THEN
    supabase_url := 'https://oprscgxsfldzydbrbioz.supabase.co';
  END IF;

  -- Construir payload para a edge function
  notification_payload := jsonb_build_object(
    'notification_id', NEW.id,
    'user_id', NEW.user_id,
    'mentioned_by', NEW.mentioned_by,
    'material_id', NEW.material_id,
    'project_id', NEW.project_id,
    'comment_id', NEW.comment_id,
    'message', NEW.message
  );

  -- Chamar edge function de forma assíncrona via pg_net
  -- Nota: pg_net precisa estar habilitado no Supabase
  PERFORM net.http_post(
    url := supabase_url || '/functions/v1/send-mention-email',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || COALESCE(service_role_key, '')
    ),
    body := notification_payload::text::jsonb
  );

  -- Log para debugging
  RAISE LOG 'Email de menção disparado para user_id: %, notification_id: %', NEW.user_id, NEW.id;

  RETURN NEW;

EXCEPTION
  WHEN OTHERS THEN
    -- Em caso de erro, logar mas não falhar a transação
    RAISE WARNING 'Erro ao disparar email de menção (notification_id: %): %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

-- 2. Criar trigger na tabela notifications
DROP TRIGGER IF EXISTS on_mention_notification_send_email ON public.notifications;

CREATE TRIGGER on_mention_notification_send_email
  AFTER INSERT ON public.notifications
  FOR EACH ROW
  WHEN (NEW.type = 'mention')
  EXECUTE FUNCTION public.trigger_mention_email();

-- 3. Adicionar comentário para documentação
COMMENT ON FUNCTION public.trigger_mention_email() IS 
  'Dispara envio de email automático via edge function quando uma notificação de menção é criada';

COMMENT ON TRIGGER on_mention_notification_send_email ON public.notifications IS 
  'Trigger que envia email automaticamente quando um usuário é mencionado em um comentário';
