-- Ensure admins can create projects regardless of company and can view all companies
DO $$ BEGIN
  -- Policy: Admins can create projects for any company
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'projects' AND policyname = 'Admins can create projects for any company'
  ) THEN
    CREATE POLICY "Admins can create projects for any company"
    ON public.projects
    FOR INSERT
    WITH CHECK (public.get_current_user_role() = 'admin');
  END IF;

  -- Policy: Admins can view all companies
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'companies' AND policyname = 'Admins can view all companies'
  ) THEN
    CREATE POLICY "Admins can view all companies"
    ON public.companies
    FOR SELECT
    USING (public.get_current_user_role() = 'admin');
  END IF;
END $$;