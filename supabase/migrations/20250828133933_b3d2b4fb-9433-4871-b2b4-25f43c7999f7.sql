-- Function to automatically update authorized email status when user signs up
CREATE OR REPLACE FUNCTION public.update_authorized_email_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Update the authorized_emails table to mark email as used
  UPDATE public.authorized_emails 
  SET used_at = now()
  WHERE email = NEW.email AND used_at IS NULL;
  
  RETURN NEW;
END;
$$;

-- Create trigger to run when a new profile is created
DROP TRIGGER IF EXISTS on_profile_created_update_authorized_email ON public.profiles;
CREATE TRIGGER on_profile_created_update_authorized_email
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_authorized_email_status();