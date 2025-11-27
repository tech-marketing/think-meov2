-- =====================================================
-- CRITICAL SECURITY FIX: Migrate Roles to Separate Table
-- =====================================================

-- 1. Create app_role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'client', 'collaborator');

-- 2. Create user_roles table with proper security
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  UNIQUE (user_id, role)
);

-- 3. Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 4. Create RLS policies for user_roles
CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
  ON public.user_roles FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  ));

CREATE POLICY "Only system can insert roles"
  ON public.user_roles FOR INSERT
  WITH CHECK (false);

CREATE POLICY "Only system can update roles"
  ON public.user_roles FOR UPDATE
  USING (false);

CREATE POLICY "Only system can delete roles"
  ON public.user_roles FOR DELETE
  USING (false);

-- 5. Create SECURITY DEFINER function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- 6. Migrate existing role data from profiles to user_roles
INSERT INTO public.user_roles (user_id, role)
SELECT 
  user_id,
  CASE 
    WHEN role = 'admin' THEN 'admin'::app_role
    WHEN role = 'client' THEN 'client'::app_role
    WHEN role = 'collaborator' THEN 'collaborator'::app_role
  END
FROM public.profiles
WHERE role IS NOT NULL
ON CONFLICT (user_id, role) DO NOTHING;

-- 7. Update get_current_user_role() to use new table
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role::text 
  FROM public.user_roles 
  WHERE user_id = auth.uid() 
  ORDER BY 
    CASE role
      WHEN 'admin' THEN 1
      WHEN 'collaborator' THEN 2
      WHEN 'client' THEN 3
    END
  LIMIT 1
$$;

-- 8. Create helper function to get primary role
CREATE OR REPLACE FUNCTION public.get_user_primary_role(_user_id UUID)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role 
  FROM public.user_roles 
  WHERE user_id = _user_id
  ORDER BY 
    CASE role
      WHEN 'admin' THEN 1
      WHEN 'collaborator' THEN 2
      WHEN 'client' THEN 3
    END
  LIMIT 1
$$;

-- 9. Add trigger to keep user_roles updated_at current
CREATE TRIGGER update_user_roles_updated_at
  BEFORE UPDATE ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 10. Add index for performance
CREATE INDEX idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX idx_user_roles_role ON public.user_roles(role);

-- Note: profiles.role column is kept for backward compatibility
-- It should be removed in a future migration after all code is updated