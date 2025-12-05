-- 1. Criar tabela de empresas
CREATE TABLE IF NOT EXISTS public.companies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 2. Criar tabela de emails autorizados
CREATE TABLE IF NOT EXISTS public.authorized_emails (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'client', 'collaborator')),
  company_id UUID REFERENCES public.companies(id),
  allowed_companies JSONB DEFAULT '[]',
  created_by UUID,
  used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 3. Criar tabela de perfis de usuários
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'client', 'collaborator')),
  company_id UUID REFERENCES public.companies(id),
  allowed_companies JSONB DEFAULT '[]',
  first_login_required BOOLEAN DEFAULT false,
  invitation_status TEXT DEFAULT 'pending' CHECK (invitation_status IN ('pending', 'accepted', 'expired')),
  invitation_sent_at TIMESTAMP WITH TIME ZONE,
  temp_password_hash TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 4. Criar tabela de projetos
CREATE TABLE IF NOT EXISTS public.projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived', 'paused')),
  company_id UUID NOT NULL REFERENCES public.companies(id),
  created_by UUID NOT NULL,
  due_date DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 5. Criar tabela de participantes do projeto
CREATE TABLE IF NOT EXISTS public.project_participants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner', 'collaborator', 'viewer')),
  added_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(project_id, user_id)
);

-- 6. Criar tabela de materiais
CREATE TABLE IF NOT EXISTS public.materials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('image', 'video', 'pdf', 'copy')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'revision')),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  created_by UUID NOT NULL,
  company_id UUID NOT NULL REFERENCES public.companies(id),
  copy TEXT,
  caption TEXT,
  file_url TEXT,
  thumbnail_url TEXT,
  is_briefing BOOLEAN DEFAULT false,
  briefing_approved_by_client BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 7. Criar tabela de comentários
CREATE TABLE IF NOT EXISTS public.comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  content TEXT NOT NULL,
  material_id UUID NOT NULL REFERENCES public.materials(id) ON DELETE CASCADE,
  author_id UUID NOT NULL,
  parent_id UUID REFERENCES public.comments(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 8. Criar tabela de notificações
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('mention', 'comment', 'approval', 'rejection', 'project_update')),
  title TEXT NOT NULL,
  message TEXT,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  material_id UUID REFERENCES public.materials(id) ON DELETE CASCADE,
  mentioned_by UUID,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS em todas as tabelas
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.authorized_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para companies
DROP POLICY IF EXISTS "Users can view their company" ON public.companies;
CREATE POLICY "Users can view their company" ON public.companies 
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.user_id = auth.uid() 
    AND profiles.company_id = companies.id
  )
);

DROP POLICY IF EXISTS "Admins can manage companies" ON public.companies;
CREATE POLICY "Admins can manage companies" ON public.companies 
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.user_id = auth.uid() 
    AND profiles.role = 'admin'
  )
);

-- Políticas RLS para authorized_emails  
DROP POLICY IF EXISTS "Admins can manage authorized emails" ON public.authorized_emails;
CREATE POLICY "Admins can manage authorized emails" ON public.authorized_emails 
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.user_id = auth.uid() 
    AND profiles.role = 'admin'
  )
);

-- Políticas RLS para profiles
DROP POLICY IF EXISTS "Users can view profiles from their company" ON public.profiles;
CREATE POLICY "Users can view profiles from their company" ON public.profiles 
FOR SELECT USING (
  auth.uid() = user_id OR
  EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE p.user_id = auth.uid() 
    AND p.company_id = profiles.company_id
  )
);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile" ON public.profiles 
FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "System can insert profiles" ON public.profiles;
CREATE POLICY "System can insert profiles" ON public.profiles 
FOR INSERT WITH CHECK (true);

-- Políticas RLS para projects
DROP POLICY IF EXISTS "Users can view projects from their company" ON public.projects;
CREATE POLICY "Users can view projects from their company" ON public.projects 
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.user_id = auth.uid() 
    AND profiles.company_id = projects.company_id
  )
);

DROP POLICY IF EXISTS "Users can create projects" ON public.projects;
CREATE POLICY "Users can create projects" ON public.projects 
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.user_id = auth.uid() 
    AND profiles.company_id = projects.company_id
  )
);

DROP POLICY IF EXISTS "Users can update projects from their company" ON public.projects;
CREATE POLICY "Users can update projects from their company" ON public.projects 
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.user_id = auth.uid() 
    AND profiles.company_id = projects.company_id
  )
);

DROP POLICY IF EXISTS "Project creators can delete projects" ON public.projects;
CREATE POLICY "Project creators can delete projects" ON public.projects 
FOR DELETE USING (
  created_by = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
);

-- Políticas RLS para project_participants
DROP POLICY IF EXISTS "Users can view project participants" ON public.project_participants;
CREATE POLICY "Users can view project participants" ON public.project_participants 
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    JOIN public.projects pr ON p.company_id = pr.company_id
    WHERE p.user_id = auth.uid() 
    AND pr.id = project_participants.project_id
  )
);

DROP POLICY IF EXISTS "Users can manage project participants" ON public.project_participants;
CREATE POLICY "Users can manage project participants" ON public.project_participants 
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    JOIN public.projects pr ON p.company_id = pr.company_id
    WHERE p.user_id = auth.uid() 
    AND pr.id = project_participants.project_id
  )
);

-- Políticas RLS para materials
DROP POLICY IF EXISTS "Users can view materials from their company" ON public.materials;
CREATE POLICY "Users can view materials from their company" ON public.materials 
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.user_id = auth.uid() 
    AND profiles.company_id = materials.company_id
  )
);

DROP POLICY IF EXISTS "Users can create materials" ON public.materials;
CREATE POLICY "Users can create materials" ON public.materials 
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.user_id = auth.uid() 
    AND profiles.company_id = materials.company_id
  )
);

DROP POLICY IF EXISTS "Users can update materials from their company" ON public.materials;
CREATE POLICY "Users can update materials from their company" ON public.materials 
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.user_id = auth.uid() 
    AND profiles.company_id = materials.company_id
  )
);

DROP POLICY IF EXISTS "Users can delete materials they created" ON public.materials;
CREATE POLICY "Users can delete materials they created" ON public.materials 
FOR DELETE USING (
  created_by = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
);

-- Políticas RLS para comments
DROP POLICY IF EXISTS "Users can view comments from their company materials" ON public.comments;
CREATE POLICY "Users can view comments from their company materials" ON public.comments 
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.materials m
    JOIN public.profiles p ON p.user_id = auth.uid()
    WHERE m.id = comments.material_id 
    AND p.company_id = m.company_id
  )
);

DROP POLICY IF EXISTS "Users can create comments" ON public.comments;
CREATE POLICY "Users can create comments" ON public.comments 
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.materials m
    JOIN public.profiles p ON p.user_id = auth.uid()
    WHERE m.id = comments.material_id 
    AND p.company_id = m.company_id
  )
);

-- Políticas RLS para notifications
DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
CREATE POLICY "Users can view their own notifications" ON public.notifications 
FOR SELECT USING (
  user_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
);

DROP POLICY IF EXISTS "System can create notifications" ON public.notifications;
CREATE POLICY "System can create notifications" ON public.notifications 
FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;
CREATE POLICY "Users can update their own notifications" ON public.notifications 
FOR UPDATE USING (
  user_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
);

-- Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_company_id ON public.profiles(company_id);
CREATE INDEX IF NOT EXISTS idx_projects_company_id ON public.projects(company_id);
CREATE INDEX IF NOT EXISTS idx_projects_created_by ON public.projects(created_by);
CREATE INDEX IF NOT EXISTS idx_project_participants_project_id ON public.project_participants(project_id);
CREATE INDEX IF NOT EXISTS idx_project_participants_user_id ON public.project_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_materials_project_id ON public.materials(project_id);
CREATE INDEX IF NOT EXISTS idx_materials_created_by ON public.materials(created_by);
CREATE INDEX IF NOT EXISTS idx_materials_company_id ON public.materials(company_id);
CREATE INDEX IF NOT EXISTS idx_materials_status ON public.materials(status);
CREATE INDEX IF NOT EXISTS idx_comments_material_id ON public.comments(material_id);
CREATE INDEX IF NOT EXISTS idx_comments_author_id ON public.comments(author_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON public.notifications(read);

-- Função para atualizar timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
NEW.updated_at = now();
RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS update_companies_updated_at ON public.companies;
CREATE TRIGGER update_companies_updated_at
BEFORE UPDATE ON public.companies
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_projects_updated_at ON public.projects;
CREATE TRIGGER update_projects_updated_at
BEFORE UPDATE ON public.projects
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_project_participants_updated_at ON public.project_participants;
CREATE TRIGGER update_project_participants_updated_at
BEFORE UPDATE ON public.project_participants
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_materials_updated_at ON public.materials;
CREATE TRIGGER update_materials_updated_at
BEFORE UPDATE ON public.materials
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_notifications_updated_at ON public.notifications;
CREATE TRIGGER update_notifications_updated_at
BEFORE UPDATE ON public.notifications
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Função para criar perfil automaticamente quando usuário se registra
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  authorized_email_record RECORD;
BEGIN
  -- Verificar se o email está autorizado
  SELECT * INTO authorized_email_record 
  FROM public.authorized_emails 
  WHERE email = NEW.email AND used_at IS NULL;
  
  IF authorized_email_record IS NOT NULL THEN
    -- Criar perfil baseado no email autorizado
    INSERT INTO public.profiles (
      user_id, 
      email, 
      full_name, 
      role, 
      company_id, 
      allowed_companies,
      first_login_required
    ) VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data ->> 'full_name', authorized_email_record.email),
      authorized_email_record.role,
      authorized_email_record.company_id,
      authorized_email_record.allowed_companies,
      true
    );
    
    -- Marcar email como usado
    UPDATE public.authorized_emails 
    SET used_at = now() 
    WHERE id = authorized_email_record.id;
  ELSE
    -- Criar perfil básico se não estiver na lista autorizada
    INSERT INTO public.profiles (
      user_id, 
      email, 
      full_name, 
      role,
      first_login_required
    ) VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email),
      'client',
      true
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger para criar perfil automaticamente
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();

-- Inserir email autorizado
INSERT INTO public.authorized_emails (email, role, created_at) 
VALUES ('joao.vyctor@thinkcompany.com.br', 'admin', now())
ON CONFLICT (email) DO NOTHING;
