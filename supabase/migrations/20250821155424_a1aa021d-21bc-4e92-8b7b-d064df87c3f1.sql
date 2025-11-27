-- Add invitation tracking fields to profiles table
ALTER TABLE public.profiles 
ADD COLUMN invitation_status TEXT DEFAULT 'pending' CHECK (invitation_status IN ('pending', 'completed')),
ADD COLUMN invitation_sent_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
ADD COLUMN temp_password_hash TEXT DEFAULT NULL,
ADD COLUMN first_login_required BOOLEAN DEFAULT FALSE;

-- Create index for better performance on invitation queries
CREATE INDEX idx_profiles_invitation_status ON public.profiles(invitation_status);

-- Add RLS policy for admins to view invitation status
CREATE POLICY "Admins can view invitation status" 
ON public.profiles 
FOR SELECT 
USING (
  get_current_user_role() = 'admin'::user_role OR 
  user_id = auth.uid()
);