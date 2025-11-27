-- Adicionar coluna para aprovação interna de briefings
ALTER TABLE public.materials
ADD COLUMN IF NOT EXISTS internal_approval BOOLEAN DEFAULT false;

-- Adicionar coluna para rastrear quem aprovou internamente
ALTER TABLE public.materials
ADD COLUMN IF NOT EXISTS internal_approved_by UUID REFERENCES public.profiles(id);

-- Adicionar coluna para rastrear quando foi aprovado internamente
ALTER TABLE public.materials
ADD COLUMN IF NOT EXISTS internal_approved_at TIMESTAMP WITH TIME ZONE;

-- Adicionar índice para melhorar performance de consultas
CREATE INDEX IF NOT EXISTS idx_materials_internal_approval ON public.materials(internal_approval) WHERE is_briefing = true;