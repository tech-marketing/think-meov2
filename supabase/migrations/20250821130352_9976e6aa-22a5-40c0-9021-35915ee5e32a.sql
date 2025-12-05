CREATE TABLE IF NOT EXISTS public.companies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user roles enum
DO $$
BEGIN
  CREATE TYPE public.user_role AS ENUM ('admin', 'client', 'collaborator');
EXCEPTION
  WHEN duplicate_object THEN
    NULL;
END;
$$;

-- Create profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'client',
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  allowed_companies UUID[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create projects table
CREATE TABLE IF NOT EXISTS public.projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived')),
  due_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create materials table
CREATE TABLE IF NOT EXISTS public.materials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('image', 'video', 'pdf')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'changes_requested')),
  file_url TEXT,
  thumbnail_url TEXT,
  caption TEXT,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create comments table
CREATE TABLE IF NOT EXISTS public.comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  material_id UUID NOT NULL REFERENCES public.materials(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Ensure company names remain unique even on existing databases
CREATE UNIQUE INDEX IF NOT EXISTS idx_companies_name_unique ON public.companies(name);

-- Insert companies
INSERT INTO public.companies (name) VALUES
('Mandic'),
('Hyster'),
('Yale'),
('Água Doce')
ON CONFLICT (name) DO NOTHING;

-- Enable Row Level Security
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS text AS $$
  SELECT role::text FROM public.profiles WHERE user_id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.get_current_user_company()
RETURNS UUID AS $$
  SELECT company_id FROM public.profiles WHERE user_id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.get_current_user_allowed_companies()
RETURNS UUID[] AS $$
  SELECT COALESCE(allowed_companies, ARRAY[]::UUID[]) FROM public.profiles WHERE user_id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- RLS Policies for companies
DROP POLICY IF EXISTS "Everyone can view companies" ON public.companies;
CREATE POLICY "Everyone can view companies" ON public.companies
FOR SELECT USING (true);

DROP POLICY IF EXISTS "Only admins can modify companies" ON public.companies;
CREATE POLICY "Only admins can modify companies" ON public.companies
FOR ALL USING (public.get_current_user_role() = 'admin');

-- RLS Policies for profiles
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile" ON public.profiles
FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles" ON public.profiles
FOR SELECT USING (public.get_current_user_role() = 'admin');

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile" ON public.profiles
FOR UPDATE USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins can manage all profiles" ON public.profiles;
CREATE POLICY "Admins can manage all profiles" ON public.profiles
FOR ALL USING (public.get_current_user_role() = 'admin');

-- RLS Policies for projects
DROP POLICY IF EXISTS "Users can view projects from their company" ON public.projects;
CREATE POLICY "Users can view projects from their company" ON public.projects
FOR SELECT USING (
  public.get_current_user_role() = 'admin' OR
  company_id = public.get_current_user_company() OR
  company_id = ANY(public.get_current_user_allowed_companies())
);

DROP POLICY IF EXISTS "Admins and collaborators can create projects" ON public.projects;
CREATE POLICY "Admins and collaborators can create projects" ON public.projects
FOR INSERT WITH CHECK (
  public.get_current_user_role() IN ('admin', 'collaborator') AND
  (public.get_current_user_role() = 'admin' OR
   company_id = public.get_current_user_company() OR
   company_id = ANY(public.get_current_user_allowed_companies()))
);

DROP POLICY IF EXISTS "Admins and project creators can update projects" ON public.projects;
CREATE POLICY "Admins and project creators can update projects" ON public.projects
FOR UPDATE USING (
  public.get_current_user_role() = 'admin' OR
  created_by = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
);

-- RLS Policies for materials
DROP POLICY IF EXISTS "Users can view materials from accessible companies" ON public.materials;
CREATE POLICY "Users can view materials from accessible companies" ON public.materials
FOR SELECT USING (
  public.get_current_user_role() = 'admin' OR
  company_id = public.get_current_user_company() OR
  company_id = ANY(public.get_current_user_allowed_companies())
);

DROP POLICY IF EXISTS "Admins and collaborators can create materials" ON public.materials;
CREATE POLICY "Admins and collaborators can create materials" ON public.materials
FOR INSERT WITH CHECK (
  public.get_current_user_role() IN ('admin', 'collaborator') AND
  (public.get_current_user_role() = 'admin' OR
   company_id = public.get_current_user_company() OR
   company_id = ANY(public.get_current_user_allowed_companies()))
);

DROP POLICY IF EXISTS "Users can update materials they created or review" ON public.materials;
CREATE POLICY "Users can update materials they created or review" ON public.materials
FOR UPDATE USING (
  public.get_current_user_role() = 'admin' OR
  created_by = (SELECT id FROM public.profiles WHERE user_id = auth.uid()) OR
  (public.get_current_user_role() IN ('client', 'collaborator') AND 
   (company_id = public.get_current_user_company() OR
    company_id = ANY(public.get_current_user_allowed_companies())))
);

-- RLS Policies for comments
DROP POLICY IF EXISTS "Users can view comments on accessible materials" ON public.comments;
CREATE POLICY "Users can view comments on accessible materials" ON public.comments
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.materials m 
    WHERE m.id = material_id AND (
      public.get_current_user_role() = 'admin' OR
      m.company_id = public.get_current_user_company() OR
      m.company_id = ANY(public.get_current_user_allowed_companies())
    )
  )
);

DROP POLICY IF EXISTS "Users can create comments on accessible materials" ON public.comments;
CREATE POLICY "Users can create comments on accessible materials" ON public.comments
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.materials m 
    WHERE m.id = material_id AND (
      public.get_current_user_role() = 'admin' OR
      m.company_id = public.get_current_user_company() OR
      m.company_id = ANY(public.get_current_user_allowed_companies())
    )
  )
);

-- Create triggers for updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_companies_updated_at ON public.companies;
CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON public.companies FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_projects_updated_at ON public.projects;
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_materials_updated_at ON public.materials;
CREATE TRIGGER update_materials_updated_at BEFORE UPDATE ON public.materials FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'User'),
    'client'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
