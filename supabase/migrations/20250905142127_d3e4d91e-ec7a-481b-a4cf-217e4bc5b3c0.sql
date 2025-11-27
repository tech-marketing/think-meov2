-- Corrigir recursão infinita nas políticas RLS da tabela profiles

-- Primeiro, remover as políticas problemáticas
DROP POLICY IF EXISTS "Users can view profiles from their company" ON public.profiles;
DROP POLICY IF EXISTS "Admins can manage companies" ON public.companies;
DROP POLICY IF EXISTS "Admins can manage authorized emails" ON public.authorized_emails;
DROP POLICY IF EXISTS "Users can view projects from their company" ON public.projects;
DROP POLICY IF EXISTS "Users can create projects" ON public.projects;
DROP POLICY IF EXISTS "Users can update projects from their company" ON public.projects;
DROP POLICY IF EXISTS "Project creators can delete projects" ON public.projects;
DROP POLICY IF EXISTS "Users can view project participants" ON public.project_participants;
DROP POLICY IF EXISTS "Users can manage project participants" ON public.project_participants;
DROP POLICY IF EXISTS "Users can view materials from their company" ON public.materials;
DROP POLICY IF EXISTS "Users can create materials" ON public.materials;
DROP POLICY IF EXISTS "Users can update materials from their company" ON public.materials;
DROP POLICY IF EXISTS "Users can delete materials they created" ON public.materials;
DROP POLICY IF EXISTS "Users can view comments from their company materials" ON public.comments;
DROP POLICY IF EXISTS "Users can create comments" ON public.comments;
DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;

-- Criar funções security definer para evitar recursão
CREATE OR REPLACE FUNCTION public.get_current_user_profile()
RETURNS public.profiles AS $$
  SELECT * FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
$$ LANGUAGE SQL SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS TEXT AS $$
  SELECT role FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
$$ LANGUAGE SQL SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION public.get_current_user_company_id()
RETURNS UUID AS $$
  SELECT company_id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
$$ LANGUAGE SQL SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION public.get_current_user_profile_id()
RETURNS UUID AS $$
  SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
$$ LANGUAGE SQL SECURITY DEFINER STABLE SET search_path = public;

-- Recriar políticas usando as funções security definer

-- Políticas para companies
CREATE POLICY "Users can view their company" ON public.companies 
FOR SELECT USING (
  id = public.get_current_user_company_id()
);

CREATE POLICY "Admins can manage companies" ON public.companies 
FOR ALL USING (
  public.get_current_user_role() = 'admin'
);

-- Políticas para authorized_emails  
CREATE POLICY "Admins can manage authorized emails" ON public.authorized_emails 
FOR ALL USING (
  public.get_current_user_role() = 'admin'
);

-- Políticas para profiles (sem recursão)
CREATE POLICY "Users can view their own profile" ON public.profiles 
FOR SELECT USING (
  auth.uid() = user_id
);

CREATE POLICY "Users with same company can view profiles" ON public.profiles 
FOR SELECT USING (
  company_id = public.get_current_user_company_id() AND 
  public.get_current_user_company_id() IS NOT NULL
);

CREATE POLICY "Users can update their own profile" ON public.profiles 
FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "System can insert profiles" ON public.profiles 
FOR INSERT WITH CHECK (true);

-- Políticas para projects
CREATE POLICY "Users can view projects from their company" ON public.projects 
FOR SELECT USING (
  company_id = public.get_current_user_company_id()
);

CREATE POLICY "Users can create projects" ON public.projects 
FOR INSERT WITH CHECK (
  company_id = public.get_current_user_company_id()
);

CREATE POLICY "Users can update projects from their company" ON public.projects 
FOR UPDATE USING (
  company_id = public.get_current_user_company_id()
);

CREATE POLICY "Project creators can delete projects" ON public.projects 
FOR DELETE USING (
  created_by = public.get_current_user_profile_id()
);

-- Políticas para project_participants
CREATE POLICY "Users can view project participants" ON public.project_participants 
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.projects 
    WHERE id = project_participants.project_id 
    AND company_id = public.get_current_user_company_id()
  )
);

CREATE POLICY "Users can manage project participants" ON public.project_participants 
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.projects 
    WHERE id = project_participants.project_id 
    AND company_id = public.get_current_user_company_id()
  )
);

-- Políticas para materials
CREATE POLICY "Users can view materials from their company" ON public.materials 
FOR SELECT USING (
  company_id = public.get_current_user_company_id()
);

CREATE POLICY "Users can create materials" ON public.materials 
FOR INSERT WITH CHECK (
  company_id = public.get_current_user_company_id()
);

CREATE POLICY "Users can update materials from their company" ON public.materials 
FOR UPDATE USING (
  company_id = public.get_current_user_company_id()
);

CREATE POLICY "Users can delete materials they created" ON public.materials 
FOR DELETE USING (
  created_by = public.get_current_user_profile_id()
);

-- Políticas para comments
CREATE POLICY "Users can view comments from their company materials" ON public.comments 
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.materials 
    WHERE id = comments.material_id 
    AND company_id = public.get_current_user_company_id()
  )
);

CREATE POLICY "Users can create comments" ON public.comments 
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.materials 
    WHERE id = comments.material_id 
    AND company_id = public.get_current_user_company_id()
  )
);

-- Políticas para notifications
CREATE POLICY "Users can view their own notifications" ON public.notifications 
FOR SELECT USING (
  user_id = public.get_current_user_profile_id()
);

CREATE POLICY "System can create notifications" ON public.notifications 
FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update their own notifications" ON public.notifications 
FOR UPDATE USING (
  user_id = public.get_current_user_profile_id()
);