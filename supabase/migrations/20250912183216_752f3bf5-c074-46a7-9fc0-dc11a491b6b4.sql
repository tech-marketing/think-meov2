-- Enable deletion of AI-generated briefings by creator, admins, and collaborators within the same company
DROP POLICY IF EXISTS "Users can delete briefings they created or admin/collab" ON public.ai_generated_briefings;
CREATE POLICY "Users can delete briefings they created or admin/collab"
ON public.ai_generated_briefings
FOR DELETE
USING (
  company_id = get_current_user_company_id() AND
  (created_by = get_current_user_profile_id() OR get_current_user_role() IN ('admin','collaborator'))
);

-- Allow admins and collaborators to delete any materials in their company (creators already allowed by existing policy)
DROP POLICY IF EXISTS "Admins and collaborators can delete company materials" ON public.materials;
CREATE POLICY "Admins and collaborators can delete company materials"
ON public.materials
FOR DELETE
USING (
  company_id = get_current_user_company_id() AND
  get_current_user_role() IN ('admin','collaborator')
);

-- Allow deletion of comments by their authors, material creators, or company admins/collaborators
DROP POLICY IF EXISTS "Authors, material creators, admins and collaborators can delete comments" ON public.comments;
CREATE POLICY "Authors, material creators, admins and collaborators can delete comments"
ON public.comments
FOR DELETE
USING (
  -- Must belong to the user's company
  EXISTS (
    SELECT 1 FROM materials 
    WHERE materials.id = comments.material_id 
      AND materials.company_id = get_current_user_company_id()
  )
  AND (
    -- Comment author can delete their own comment
    comments.author_id = get_current_user_profile_id()
    -- Material creator can delete comments on their material
    OR EXISTS (
      SELECT 1 FROM materials 
      WHERE materials.id = comments.material_id 
        AND materials.created_by = get_current_user_profile_id()
    )
    -- Admins and collaborators can delete any company comments
    OR get_current_user_role() IN ('admin','collaborator')
  )
);