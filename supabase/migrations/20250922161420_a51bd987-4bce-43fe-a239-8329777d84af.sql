-- Grant full admin access across all tables
-- This ensures admins can perform all operations regardless of company_id

-- ai_creative_analysis: Add admin policies
CREATE POLICY "Admins can manage all creative analysis" 
ON public.ai_creative_analysis 
FOR ALL 
USING (get_current_user_role() = 'admin');

-- ai_generated_briefings: Add admin policies  
CREATE POLICY "Admins can manage all briefings"
ON public.ai_generated_briefings
FOR ALL
USING (get_current_user_role() = 'admin');

-- applied_taxonomies: Add admin policies
CREATE POLICY "Admins can manage all taxonomies"
ON public.applied_taxonomies  
FOR ALL
USING (get_current_user_role() = 'admin');

-- comments: Add admin policies
CREATE POLICY "Admins can manage all comments"
ON public.comments
FOR ALL  
USING (get_current_user_role() = 'admin');

-- meta_ad_accounts: Add admin policies
CREATE POLICY "Admins can manage all ad accounts"
ON public.meta_ad_accounts
FOR ALL
USING (get_current_user_role() = 'admin');

-- meta_adsets: Add admin policies  
CREATE POLICY "Admins can manage all adsets"
ON public.meta_adsets
FOR ALL
USING (get_current_user_role() = 'admin');

-- notifications: Add admin policies
CREATE POLICY "Admins can manage all notifications" 
ON public.notifications
FOR ALL
USING (get_current_user_role() = 'admin');

-- project_participants: Add admin policies
CREATE POLICY "Admins can manage all project participants"
ON public.project_participants  
FOR ALL
USING (get_current_user_role() = 'admin');

-- taxonomy_patterns: Add admin policies
CREATE POLICY "Admins can manage all taxonomy patterns"
ON public.taxonomy_patterns
FOR ALL  
USING (get_current_user_role() = 'admin');

-- Create helper function to get company_id with admin fallback
CREATE OR REPLACE FUNCTION public.get_company_id_for_operation(
  _project_id uuid DEFAULT NULL,
  _account_id text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_company_id uuid;
  project_company_id uuid;
  account_company_id uuid;
BEGIN
  -- Get user's company_id
  SELECT company_id INTO user_company_id 
  FROM public.profiles 
  WHERE user_id = auth.uid();
  
  -- If user has company_id, use it (non-admin case)
  IF user_company_id IS NOT NULL THEN
    RETURN user_company_id;
  END IF;
  
  -- Admin case: try to get company_id from project
  IF _project_id IS NOT NULL THEN
    SELECT company_id INTO project_company_id
    FROM public.projects 
    WHERE id = _project_id;
    
    IF project_company_id IS NOT NULL THEN
      RETURN project_company_id;
    END IF;
  END IF;
  
  -- Admin case: try to get company_id from account
  IF _account_id IS NOT NULL THEN
    SELECT company_id INTO account_company_id
    FROM public.meta_ad_accounts
    WHERE account_id = _account_id;
    
    IF account_company_id IS NOT NULL THEN
      RETURN account_company_id;
    END IF;
  END IF;
  
  -- Return NULL if no company_id found (admin can still operate)
  RETURN NULL;
END;
$$;