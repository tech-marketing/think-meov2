-- Allow pattern_id to be NULL for automatic taxonomy matching
-- This enables the system to create taxonomy entries automatically when matching materials by name
ALTER TABLE applied_taxonomies ALTER COLUMN pattern_id DROP NOT NULL;