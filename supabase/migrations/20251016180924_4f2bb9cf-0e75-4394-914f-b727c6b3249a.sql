-- Create trigger to update conversation timestamp on new message
CREATE TRIGGER update_conversation_timestamp
  AFTER INSERT ON public.support_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_conversation_last_message();