-- Fix CRITICAL security issues (step 1: Database policies)

-- 1. Fix profiles UPDATE policy to prevent privilege escalation
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

CREATE POLICY "Users can update their own profile (restricted)"
ON public.profiles
FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (
  user_id = auth.uid() 
  AND role = (SELECT role FROM public.profiles WHERE user_id = auth.uid())
);

-- 2. Fix authorized_emails to remove public read access
DROP POLICY IF EXISTS "Anyone can view authorized emails for signup" ON public.authorized_emails;

CREATE POLICY "Users can view their own authorized email"
ON public.authorized_emails
FOR SELECT
USING (email = (SELECT email FROM public.profiles WHERE user_id = auth.uid()));

-- 3. Restrict materials UPDATE policy to prevent unauthorized changes
DROP POLICY IF EXISTS "Users can update materials they created or review" ON public.materials;

CREATE POLICY "Users can update materials (restricted)"
ON public.materials
FOR UPDATE
USING (
  (get_current_user_role() = 'admin'::user_role) OR
  (created_by = (SELECT profiles.id FROM profiles WHERE profiles.user_id = auth.uid())) OR
  (
    (get_current_user_role() = 'client'::user_role) AND 
    ((company_id = get_current_user_company()) OR (company_id = ANY (get_current_user_allowed_companies()))) AND
    status = 'pending'
  )
);

-- 4. Fix materials storage bucket security
UPDATE storage.buckets 
SET public = false 
WHERE id = 'materials';