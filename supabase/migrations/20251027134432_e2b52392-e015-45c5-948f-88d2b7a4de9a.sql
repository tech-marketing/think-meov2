-- Add Meta OAuth columns to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS meta_access_token text,
ADD COLUMN IF NOT EXISTS meta_token_expires_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS meta_user_id text;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_meta_user_id ON public.profiles(meta_user_id);

-- Add comment for documentation
COMMENT ON COLUMN public.profiles.meta_access_token IS 'Encrypted Meta (Facebook) access token for user';
COMMENT ON COLUMN public.profiles.meta_token_expires_at IS 'Expiration timestamp for Meta access token';
COMMENT ON COLUMN public.profiles.meta_user_id IS 'Meta user ID associated with this profile';