-- Fix security warning: Set immutable search_path for trigger function
CREATE OR REPLACE FUNCTION trigger_support_auto_reply()
RETURNS trigger AS $$
DECLARE
  supabase_url text;
  service_role_key text;
  function_url text;
BEGIN
  -- Get Supabase configuration
  supabase_url := current_setting('app.settings.supabase_url', true);
  service_role_key := current_setting('app.settings.service_role_key', true);
  
  -- If settings are not configured, use defaults
  IF supabase_url IS NULL THEN
    supabase_url := 'https://oprscgxsfldzydbrbioz.supabase.co';
  END IF;
  
  -- Build edge function URL
  function_url := supabase_url || '/functions/v1/support-auto-reply';
  
  -- Call edge function asynchronously via pg_net
  PERFORM net.http_post(
    url := function_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_role_key
    ),
    body := jsonb_build_object(
      'message_id', NEW.id,
      'conversation_id', NEW.conversation_id,
      'sender_id', NEW.sender_id
    )
  );
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the insert
    RAISE WARNING 'Failed to trigger auto-reply: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';