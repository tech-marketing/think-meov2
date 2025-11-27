-- Criar tabela para armazenar versões de materiais
CREATE TABLE IF NOT EXISTS public.material_versions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  material_id UUID NOT NULL REFERENCES public.materials(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  file_url TEXT NOT NULL,
  thumbnail_url TEXT,
  wireframe_data JSONB,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  notes TEXT,
  UNIQUE(material_id, version_number)
);

-- Adicionar índice para melhorar performance
CREATE INDEX idx_material_versions_material_id ON public.material_versions(material_id);
CREATE INDEX idx_material_versions_created_at ON public.material_versions(created_at DESC);

-- Enable RLS
ALTER TABLE public.material_versions ENABLE ROW LEVEL SECURITY;

-- Usuários podem visualizar versões de materiais da sua empresa
CREATE POLICY "Users can view material versions from their company"
ON public.material_versions
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.materials
    WHERE materials.id = material_versions.material_id
    AND (materials.company_id = get_current_user_company_id() OR get_current_user_role() = 'admin')
  )
);

-- Usuários podem criar versões de materiais da sua empresa
CREATE POLICY "Users can create material versions"
ON public.material_versions
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.materials
    WHERE materials.id = material_versions.material_id
    AND (materials.company_id = get_current_user_company_id() OR get_current_user_role() = 'admin')
  )
);

-- Admins podem deletar versões
CREATE POLICY "Admins can delete material versions"
ON public.material_versions
FOR DELETE
USING (get_current_user_role() = 'admin');

-- Adicionar coluna para contar alterações no material
ALTER TABLE public.materials 
ADD COLUMN IF NOT EXISTS version_count INTEGER DEFAULT 0;

-- Função para incrementar contador de versões
CREATE OR REPLACE FUNCTION public.increment_material_version_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.materials
  SET version_count = COALESCE(version_count, 0) + 1
  WHERE id = NEW.material_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger para incrementar contador quando nova versão é criada
CREATE TRIGGER trigger_increment_version_count
AFTER INSERT ON public.material_versions
FOR EACH ROW
EXECUTE FUNCTION public.increment_material_version_count();