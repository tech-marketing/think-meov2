-- Add RLS policy to allow project participants to insert materials
CREATE POLICY "Project participants can insert materials" 
ON public.materials 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM public.projects p
    LEFT JOIN public.project_participants pp ON p.id = pp.project_id
    WHERE p.id = materials.project_id 
    AND (
      p.created_by = get_current_user_profile_id() -- Project creator
      OR pp.user_id = get_current_user_profile_id() -- Project participant
      OR get_current_user_role() = ANY(ARRAY['admin'::text, 'collaborator'::text]) -- Admin/Collaborator
    )
  )
);

-- Create trigger to automatically set company_id from project if null
CREATE OR REPLACE FUNCTION public.set_material_company_from_project()
RETURNS TRIGGER AS $$
BEGIN
  -- If company_id is not set, get it from the project
  IF NEW.company_id IS NULL THEN
    SELECT company_id INTO NEW.company_id 
    FROM public.projects 
    WHERE id = NEW.project_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create the trigger
CREATE TRIGGER trg_set_material_company
  BEFORE INSERT ON public.materials
  FOR EACH ROW
  EXECUTE FUNCTION public.set_material_company_from_project();