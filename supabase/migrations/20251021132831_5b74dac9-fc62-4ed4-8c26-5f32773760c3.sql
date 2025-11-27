-- Add metadata column to competitor_search_history to store Apify run details
ALTER TABLE competitor_search_history 
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Add comment for documentation
COMMENT ON COLUMN competitor_search_history.metadata IS 'Stores Apify run details like runId, webhookUrl for manual recovery and debugging';

-- Create index for faster metadata queries
CREATE INDEX IF NOT EXISTS idx_competitor_search_history_metadata ON competitor_search_history USING gin(metadata);