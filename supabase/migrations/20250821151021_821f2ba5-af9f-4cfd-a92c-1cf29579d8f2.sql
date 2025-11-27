-- Create project_participants table for managing project team members
CREATE TABLE public.project_participants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'collaborator', -- 'owner', 'collaborator', 'viewer'
  added_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(project_id, user_id)
);

-- Enable RLS
ALTER TABLE public.project_participants ENABLE ROW LEVEL SECURITY;

-- Create policies for project_participants
CREATE POLICY "Users can view project participants from accessible projects" 
ON public.project_participants 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.projects p 
    WHERE p.id = project_id 
    AND (
      get_current_user_role() = 'admin'::user_role 
      OR p.company_id = get_current_user_company() 
      OR p.company_id = ANY(get_current_user_allowed_companies())
    )
  )
);

CREATE POLICY "Project owners and admins can manage participants" 
ON public.project_participants 
FOR ALL 
USING (
  get_current_user_role() = 'admin'::user_role 
  OR EXISTS (
    SELECT 1 FROM public.projects p 
    WHERE p.id = project_id 
    AND p.created_by = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  )
  OR EXISTS (
    SELECT 1 FROM public.project_participants pp 
    WHERE pp.project_id = project_id 
    AND pp.user_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid()) 
    AND pp.role = 'owner'
  )
) 
WITH CHECK (
  get_current_user_role() = 'admin'::user_role 
  OR EXISTS (
    SELECT 1 FROM public.projects p 
    WHERE p.id = project_id 
    AND p.created_by = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  )
  OR EXISTS (
    SELECT 1 FROM public.project_participants pp 
    WHERE pp.project_id = project_id 
    AND pp.user_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid()) 
    AND pp.role = 'owner'
  )
);

-- Add trigger for updating updated_at
CREATE TRIGGER update_project_participants_updated_at
BEFORE UPDATE ON public.project_participants
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add index for better performance
CREATE INDEX idx_project_participants_project_id ON public.project_participants(project_id);
CREATE INDEX idx_project_participants_user_id ON public.project_participants(user_id);