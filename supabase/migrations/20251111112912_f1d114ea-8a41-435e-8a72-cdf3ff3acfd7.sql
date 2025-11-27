-- Adicionar coluna metadata para armazenar dados adicionais sobre materiais
ALTER TABLE materials
ADD COLUMN metadata JSONB DEFAULT '{}'::jsonb;

-- Criar índice GIN para consultas eficientes no JSONB
CREATE INDEX idx_materials_metadata ON materials USING GIN (metadata);

-- Adicionar comentário explicativo
COMMENT ON COLUMN materials.metadata IS 'Dados adicionais em formato JSON para operações especiais (ex: veo_operation_name para vídeos gerados)';