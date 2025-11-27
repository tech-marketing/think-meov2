-- Adicionar tipo 'copy' aos materiais e novos status de briefing

-- Alterar o tipo de material para incluir 'copy'
ALTER TABLE public.materials 
ADD CONSTRAINT check_material_type_with_copy 
CHECK (type IN ('image', 'video', 'pdf', 'copy'));

-- Adicionar novos status para briefing
ALTER TABLE public.materials 
ADD CONSTRAINT check_material_status_with_briefing 
CHECK (status IN ('approved', 'pending', 'needs_adjustment', 'rejected', 'client_approval', 'internal_approval'));

-- Adicionar campo para indicar se é briefing
ALTER TABLE public.materials 
ADD COLUMN is_briefing BOOLEAN DEFAULT FALSE;

-- Adicionar campo para indicar se briefing foi aprovado pelo cliente
ALTER TABLE public.materials 
ADD COLUMN briefing_approved_by_client BOOLEAN DEFAULT FALSE;

-- Criar índices para melhor performance
CREATE INDEX idx_materials_is_briefing ON public.materials(is_briefing);
CREATE INDEX idx_materials_briefing_approved ON public.materials(briefing_approved_by_client);
CREATE INDEX idx_materials_type_status ON public.materials(type, status);