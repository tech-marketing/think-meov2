-- Add is_running field to materials table
ALTER TABLE public.materials
ADD COLUMN is_running boolean DEFAULT true;