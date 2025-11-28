-- Preserve user uploads when users are deleted
-- Change ON DELETE CASCADE to ON DELETE SET NULL for created_by columns

-- Step 1: Make created_by nullable in materials table
ALTER TABLE public.materials ALTER COLUMN created_by DROP NOT NULL;

-- Step 2: Make created_by nullable in projects table  
ALTER TABLE public.projects ALTER COLUMN created_by DROP NOT NULL;

-- Step 3: Drop existing foreign key constraints
ALTER TABLE public.materials 
DROP CONSTRAINT IF EXISTS materials_created_by_fkey;

ALTER TABLE public.projects
DROP CONSTRAINT IF EXISTS projects_created_by_fkey;

-- Step 4: Add new foreign key constraints with SET NULL on delete
ALTER TABLE public.materials
ADD CONSTRAINT materials_created_by_fkey 
FOREIGN KEY (created_by) 
REFERENCES public.profiles(id) 
ON DELETE SET NULL;

ALTER TABLE public.projects
ADD CONSTRAINT projects_created_by_fkey
FOREIGN KEY (created_by)
REFERENCES public.profiles(id)
ON DELETE SET NULL;

-- Step 5: Add comment for documentation
COMMENT ON COLUMN public.materials.created_by IS 'Creator of the material. NULL if user was deleted.';
COMMENT ON COLUMN public.projects.created_by IS 'Creator of the project. NULL if user was deleted.';
