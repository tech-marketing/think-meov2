-- Fix CRITICAL security issues

-- 1. Fix profiles UPDATE policy to prevent privilege escalation
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

CREATE POLICY "Users can update their own profile (restricted)"
ON public.profiles
FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (
  user_id = auth.uid() 
  AND (
    -- Users cannot change their role or user_id
    role = (SELECT role FROM public.profiles WHERE user_id = auth.uid())
    AND user_id = auth.uid()
  )
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
    status = 'pending'  -- Clients can only update pending materials
  )
)
WITH CHECK (
  -- Prevent changing critical fields
  company_id = OLD.company_id AND
  created_by = OLD.created_by AND
  type = OLD.type
);

-- 4. Fix materials storage bucket security
UPDATE storage.buckets 
SET public = false 
WHERE id = 'materials';

-- 5. Create secure storage policies for materials bucket
CREATE POLICY "Users can view materials from accessible companies"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'materials' AND
  (
    (
      SELECT get_current_user_role() = 'admin'::user_role
    ) OR
    EXISTS (
      SELECT 1 FROM public.materials m
      WHERE 
        storage.foldername(name)[1] = m.id::text AND
        (
          m.company_id = get_current_user_company() OR
          m.company_id = ANY (get_current_user_allowed_companies())
        )
    )
  )
);

CREATE POLICY "Admins and collaborators can upload materials"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'materials' AND
  (
    get_current_user_role() = 'admin'::user_role OR
    get_current_user_role() = 'collaborator'::user_role
  )
);

CREATE POLICY "Users can update their own material files"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'materials' AND
  (
    (
      SELECT get_current_user_role() = 'admin'::user_role
    ) OR
    EXISTS (
      SELECT 1 FROM public.materials m
      WHERE 
        storage.foldername(name)[1] = m.id::text AND
        m.created_by = (SELECT profiles.id FROM profiles WHERE profiles.user_id = auth.uid())
    )
  )
);

CREATE POLICY "Admins and collaborators can delete material files"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'materials' AND
  (
    (
      SELECT get_current_user_role() = 'admin'::user_role
    ) OR
    (
      get_current_user_role() = 'collaborator'::user_role AND
      EXISTS (
        SELECT 1 FROM public.materials m
        WHERE 
          storage.foldername(name)[1] = m.id::text AND
          (
            m.company_id = get_current_user_company() OR
            m.company_id = ANY (get_current_user_allowed_companies())
          )
      )
    )
  )
);