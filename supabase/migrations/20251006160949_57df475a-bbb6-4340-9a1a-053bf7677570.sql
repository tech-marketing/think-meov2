-- Fix RLS policies to support client users with allowed_companies
-- This allows client users to view all content from companies they have access to

-- 1. Update comments policies
DROP POLICY IF EXISTS "Users can view comments from their company materials" ON comments;

CREATE POLICY "Users can view comments from their company materials"
ON comments FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM materials
    WHERE materials.id = comments.material_id
      AND (materials.company_id = ANY(get_user_allowed_companies()) 
           OR get_current_user_role() = 'admin')
  )
);

-- 2. Update ai_generated_briefings policies
DROP POLICY IF EXISTS "Users can view briefings from their company" ON ai_generated_briefings;

CREATE POLICY "Users can view briefings from their company"
ON ai_generated_briefings FOR SELECT
TO authenticated
USING (
  company_id = ANY(get_user_allowed_companies())
  OR get_current_user_role() = 'admin'
);

DROP POLICY IF EXISTS "Users can update briefings from their company" ON ai_generated_briefings;

CREATE POLICY "Users can update briefings from their company"
ON ai_generated_briefings FOR UPDATE
TO authenticated
USING (
  company_id = ANY(get_user_allowed_companies())
  OR get_current_user_role() = 'admin'
);

DROP POLICY IF EXISTS "Users can delete briefings they created or admin/collab" ON ai_generated_briefings;

CREATE POLICY "Users can delete briefings they created or admin/collab"
ON ai_generated_briefings FOR DELETE
TO authenticated
USING (
  (company_id = ANY(get_user_allowed_companies()) OR get_current_user_role() = 'admin')
  AND (created_by = get_current_user_profile_id() OR get_current_user_role() = ANY(ARRAY['admin'::text, 'collaborator'::text]))
);

-- 3. Update material_versions policies
DROP POLICY IF EXISTS "Users can view material versions from their company" ON material_versions;

CREATE POLICY "Users can view material versions from their company"
ON material_versions FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM materials
    WHERE materials.id = material_versions.material_id
      AND (materials.company_id = ANY(get_user_allowed_companies()) 
           OR get_current_user_role() = 'admin')
  )
);

-- 4. Update project_participants policies
DROP POLICY IF EXISTS "Users can view project participants" ON project_participants;

CREATE POLICY "Users can view project participants"
ON project_participants FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = project_participants.project_id
      AND (projects.company_id = ANY(get_user_allowed_companies()) 
           OR get_current_user_role() = 'admin')
  )
);

DROP POLICY IF EXISTS "Users can manage project participants" ON project_participants;

CREATE POLICY "Users can manage project participants"
ON project_participants FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = project_participants.project_id
      AND (projects.company_id = ANY(get_user_allowed_companies()) 
           OR get_current_user_role() = 'admin')
  )
);