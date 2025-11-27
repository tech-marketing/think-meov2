-- Add wireframe_data column to materials table for storing wireframe configurations
ALTER TABLE public.materials ADD COLUMN wireframe_data JSONB;