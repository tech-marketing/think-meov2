-- Add RLS policy to allow material creators to view their own materials
CREATE POLICY "Material creators can view their own materials" 
ON public.materials 
FOR SELECT 
USING (created_by = (SELECT id FROM public.profiles WHERE user_id = auth.uid()));