-- Add logo_url column to companies table
ALTER TABLE public.companies 
ADD COLUMN logo_url TEXT;

-- Add comment to the column
COMMENT ON COLUMN public.companies.logo_url IS 'URL da logo da empresa no storage';