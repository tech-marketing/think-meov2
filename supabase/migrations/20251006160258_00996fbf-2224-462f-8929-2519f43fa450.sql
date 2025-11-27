-- Create function to get user's allowed companies (including company_id and allowed_companies array)
CREATE OR REPLACE FUNCTION public.get_user_allowed_companies()
RETURNS uuid[]
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  user_company_id uuid;
  user_allowed_companies jsonb;
  result_array uuid[];
BEGIN
  -- Get user's company_id and allowed_companies
  SELECT company_id, allowed_companies 
  INTO user_company_id, user_allowed_companies
  FROM public.profiles
  WHERE user_id = auth.uid()
  LIMIT 1;
  
  -- If user has company_id, return it as array
  IF user_company_id IS NOT NULL THEN
    RETURN ARRAY[user_company_id];
  END IF;
  
  -- If user has allowed_companies, convert jsonb array to uuid array
  IF user_allowed_companies IS NOT NULL AND jsonb_array_length(user_allowed_companies) > 0 THEN
    SELECT ARRAY_AGG(value::text::uuid)
    INTO result_array
    FROM jsonb_array_elements_text(user_allowed_companies);
    RETURN COALESCE(result_array, ARRAY[]::uuid[]);
  END IF;
  
  -- Return empty array if neither exists
  RETURN ARRAY[]::uuid[];
END;
$$;

-- Update projects SELECT policy to use allowed_companies
DROP POLICY IF EXISTS "Users can view projects from their company or admins can view a" ON public.projects;

CREATE POLICY "Users can view projects from their company or allowed companies"
ON public.projects FOR SELECT
TO authenticated
USING (
  company_id = ANY(public.get_user_allowed_companies())
  OR public.get_current_user_role() = 'admin'
);

-- Update materials SELECT policy
DROP POLICY IF EXISTS "Users can view materials from their company or admins can view " ON public.materials;

CREATE POLICY "Users can view materials from their company or allowed companies"
ON public.materials FOR SELECT
TO authenticated
USING (
  company_id = ANY(public.get_user_allowed_companies())
  OR public.get_current_user_role() = 'admin'
);

-- Update materials UPDATE policy
DROP POLICY IF EXISTS "Users can update materials from their company or admins can upd" ON public.materials;

CREATE POLICY "Users can update materials from their company or allowed companies"
ON public.materials FOR UPDATE
TO authenticated
USING (
  company_id = ANY(public.get_user_allowed_companies())
  OR public.get_current_user_role() = 'admin'
);

-- Update materials INSERT policy
DROP POLICY IF EXISTS "Users can create materials in their company or admins can creat" ON public.materials;

CREATE POLICY "Users can create materials in their company or allowed companies"
ON public.materials FOR INSERT
TO authenticated
WITH CHECK (
  company_id = ANY(public.get_user_allowed_companies())
  OR public.get_current_user_role() = 'admin'
);