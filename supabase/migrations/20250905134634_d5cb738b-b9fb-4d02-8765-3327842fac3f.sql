-- Fix materials table structure
DROP TABLE IF EXISTS public.materials CASCADE;

CREATE TABLE public.materials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('image', 'video', 'pdf', 'copy')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'revision')),
  project_id UUID NOT NULL,
  created_by UUID NOT NULL,
  company_id UUID NOT NULL,
  copy TEXT,
  caption TEXT,
  file_url TEXT,
  thumbnail_url TEXT,
  is_briefing BOOLEAN DEFAULT false,
  briefing_approved_by_client BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for materials
CREATE POLICY "Users can view materials from their company" 
ON public.materials 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.user_id = auth.uid() 
    AND profiles.company_id = materials.company_id
  )
);

CREATE POLICY "Users can create materials" 
ON public.materials 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.user_id = auth.uid() 
    AND profiles.company_id = materials.company_id
  )
);

CREATE POLICY "Users can update materials from their company" 
ON public.materials 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.user_id = auth.uid() 
    AND profiles.company_id = materials.company_id
  )
);

CREATE POLICY "Users can delete materials they created" 
ON public.materials 
FOR DELETE 
USING (
  created_by = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
);

-- Create indexes for better performance
CREATE INDEX idx_materials_project_id ON public.materials(project_id);
CREATE INDEX idx_materials_created_by ON public.materials(created_by);
CREATE INDEX idx_materials_company_id ON public.materials(company_id);
CREATE INDEX idx_materials_status ON public.materials(status);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
NEW.updated_at = now();
RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_materials_updated_at
BEFORE UPDATE ON public.materials
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();