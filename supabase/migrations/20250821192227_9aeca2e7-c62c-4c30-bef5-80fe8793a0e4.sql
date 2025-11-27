-- Fix storage bucket security policies

-- Create secure storage policies for materials bucket
CREATE POLICY "Users can view materials from accessible companies"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'materials' AND
  (
    get_current_user_role() = 'admin'::user_role OR
    EXISTS (
      SELECT 1 FROM public.materials m
      WHERE 
        POSITION(m.id::text IN name) > 0 AND
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
    get_current_user_role() = 'admin'::user_role OR
    EXISTS (
      SELECT 1 FROM public.materials m
      WHERE 
        POSITION(m.id::text IN name) > 0 AND
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
    get_current_user_role() = 'admin'::user_role OR
    (
      get_current_user_role() = 'collaborator'::user_role AND
      EXISTS (
        SELECT 1 FROM public.materials m
        WHERE 
          POSITION(m.id::text IN name) > 0 AND
          (
            m.company_id = get_current_user_company() OR
            m.company_id = ANY (get_current_user_allowed_companies())
          )
      )
    )
  )
);