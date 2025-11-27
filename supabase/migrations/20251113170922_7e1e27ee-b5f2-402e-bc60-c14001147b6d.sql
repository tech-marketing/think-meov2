-- Add 'carousel' type to materials table type constraint with all existing types
ALTER TABLE public.materials DROP CONSTRAINT IF EXISTS materials_type_check;

ALTER TABLE public.materials ADD CONSTRAINT materials_type_check 
CHECK (type IN ('wireframe', 'video', 'image', 'carousel'));