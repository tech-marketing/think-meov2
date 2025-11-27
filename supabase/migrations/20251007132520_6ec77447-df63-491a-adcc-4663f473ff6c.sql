-- Drop the old INSERT policy for comments
DROP POLICY IF EXISTS "Users can create comments" ON public.comments;

-- Create new INSERT policy that uses get_user_allowed_companies()
CREATE POLICY "Users can create comments" ON public.comments
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM materials
    WHERE materials.id = comments.material_id 
      AND (
        materials.company_id = ANY (get_user_allowed_companies()) 
        OR get_current_user_role() = 'admin'
      )
  )
);