-- 1) Garantir trigger para criar perfil ao cadastrar usuário
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created'
  ) THEN
    CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
  END IF;
END $$;

-- 2) Backfill: criar perfis ausentes com base em auth.users e authorized_emails
WITH missing_profiles AS (
  SELECT 
    u.id        AS user_id,
    u.email     AS email,
    COALESCE(u.raw_user_meta_data->>'full_name', u.email) AS full_name,
    COALESCE(ae.role, 'client') AS role,
    ae.company_id,
    ae.allowed_companies
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.user_id = u.id
  LEFT JOIN public.authorized_emails ae ON ae.email = u.email
  WHERE p.user_id IS NULL
)
INSERT INTO public.profiles (
  user_id, email, full_name, role, company_id, allowed_companies, first_login_required
)
SELECT 
  user_id, email, full_name, role, company_id, COALESCE(allowed_companies, '[]'::jsonb), false
FROM missing_profiles;

-- 3) Backfill: marcar authorized_emails.used_at quando usuário existir
UPDATE public.authorized_emails ae
SET used_at = COALESCE(ae.used_at, now())
WHERE ae.email IN (SELECT email FROM auth.users);

-- 4) Triggers de updated_at nas tabelas principais
-- Helper para criar trigger se não existir
CREATE OR REPLACE FUNCTION public.ensure_updated_at_trigger(_tbl regclass, _trigger_name text)
RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgrelid = _tbl AND tgname = _trigger_name
  ) THEN
    EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE ON %s FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();', _trigger_name, _tbl);
  END IF;
END;$$;

-- Aplicar em tabelas que possuem updated_at
SELECT public.ensure_updated_at_trigger('public.profiles', 'trg_profiles_updated_at');
SELECT public.ensure_updated_at_trigger('public.projects', 'trg_projects_updated_at');
SELECT public.ensure_updated_at_trigger('public.materials', 'trg_materials_updated_at');
SELECT public.ensure_updated_at_trigger('public.companies', 'trg_companies_updated_at');
SELECT public.ensure_updated_at_trigger('public.meta_ad_accounts', 'trg_meta_ad_accounts_updated_at');
SELECT public.ensure_updated_at_trigger('public.meta_adsets', 'trg_meta_adsets_updated_at');
SELECT public.ensure_updated_at_trigger('public.ai_generated_briefings', 'trg_ai_generated_briefings_updated_at');
SELECT public.ensure_updated_at_trigger('public.ai_creative_analysis', 'trg_ai_creative_analysis_updated_at');
SELECT public.ensure_updated_at_trigger('public.applied_taxonomies', 'trg_applied_taxonomies_updated_at');
SELECT public.ensure_updated_at_trigger('public.taxonomy_patterns', 'trg_taxonomy_patterns_updated_at');
SELECT public.ensure_updated_at_trigger('public.project_participants', 'trg_project_participants_updated_at');
SELECT public.ensure_updated_at_trigger('public.notifications', 'trg_notifications_updated_at');

-- 5) Garantir bucket avatars e políticas (idempotente)
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

DO $$
BEGIN
  -- SELECT
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Avatar images are publicly accessible'
  ) THEN
    CREATE POLICY "Avatar images are publicly accessible"
    ON storage.objects
    FOR SELECT
    USING (bucket_id = 'avatars');
  END IF;

  -- INSERT
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Users can upload their own avatar'
  ) THEN
    CREATE POLICY "Users can upload their own avatar"
    ON storage.objects
    FOR INSERT
    WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;

  -- UPDATE
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Users can update their own avatar'
  ) THEN
    CREATE POLICY "Users can update their own avatar"
    ON storage.objects
    FOR UPDATE
    USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;

  -- DELETE
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Users can delete their own avatar'
  ) THEN
    CREATE POLICY "Users can delete their own avatar"
    ON storage.objects
    FOR DELETE
    USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;
END $$;