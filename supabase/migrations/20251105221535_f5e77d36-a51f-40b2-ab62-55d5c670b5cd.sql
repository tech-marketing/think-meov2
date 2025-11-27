-- Adicionar coluna canvas_data para armazenar JSON do Fabric.js Canvas
ALTER TABLE materials 
ADD COLUMN IF NOT EXISTS canvas_data TEXT;

-- Comentário para documentação
COMMENT ON COLUMN materials.canvas_data IS 'JSON do Fabric.js Canvas para briefings editáveis. Novo formato que substitui wireframe_data.';