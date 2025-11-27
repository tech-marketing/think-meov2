-- Update companies SELECT policy to allow clients with allowed_companies to view companies
DROP POLICY IF EXISTS "Users can view their company or admins can view all" ON companies;

CREATE POLICY "Users can view their company or allowed companies or admin"
ON companies FOR SELECT
TO authenticated
USING (
  (id = ANY(get_user_allowed_companies()))
  OR get_current_user_role() = 'admin'
);