-- Fix Security Issue: Remove public access to authorized_emails table
-- This prevents attackers from scraping email addresses and mapping organizational structure

-- Drop the insecure public SELECT policy
DROP POLICY IF EXISTS "Anyone can check if email is authorized for signup" ON public.authorized_emails;

-- Add secure policy: Only admins can view authorized emails
CREATE POLICY "Only admins can view authorized emails"
ON public.authorized_emails
FOR SELECT
TO authenticated
USING (
  (SELECT role FROM public.profiles WHERE user_id = auth.uid()) = 'admin'
);

-- Create edge function helper for email validation (to be implemented separately)
-- This will allow signup flow to check email authorization without exposing the data