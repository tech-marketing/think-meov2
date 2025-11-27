-- Add visualization_html column to materials table for TipTap editor content
ALTER TABLE materials
ADD COLUMN IF NOT EXISTS visualization_html TEXT;

-- Add comment explaining the column
COMMENT ON COLUMN materials.visualization_html IS 'HTML content from TipTap editor for the Visualization section of briefings';