-- Create security definer function to get support user ID
-- This allows all authenticated users to get the support user ID without RLS issues
CREATE OR REPLACE FUNCTION public.get_support_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT user_id 
  FROM public.profiles 
  WHERE email = 'tech@thinkcompany.com.br' 
  LIMIT 1;
$$;

-- Grant execute permission to all authenticated users
GRANT EXECUTE ON FUNCTION public.get_support_user_id() TO anon, authenticated;

-- Optional: Add policy to allow viewing support profile
CREATE POLICY "Allow select of support profile row"
ON public.profiles 
FOR SELECT
USING (email = 'tech@thinkcompany.com.br');

-- Add unique constraint on support_conversations to prevent duplicates
-- This will be used with upsert to handle race conditions
ALTER TABLE public.support_conversations 
DROP CONSTRAINT IF EXISTS support_conversations_user_id_support_user_id_key;

ALTER TABLE public.support_conversations 
ADD CONSTRAINT support_conversations_user_id_support_user_id_key 
UNIQUE (user_id, support_user_id);