-- Allow 'wireframe' type in materials table
ALTER TABLE public.materials DROP CONSTRAINT IF EXISTS materials_type_check;
ALTER TABLE public.materials
  ADD CONSTRAINT materials_type_check
  CHECK (type IN ('image', 'video', 'pdf', 'copy', 'wireframe'));