-- Enable realtime for materials table
ALTER TABLE materials REPLICA IDENTITY FULL;

-- Ensure materials table is in realtime publication
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'materials'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE materials;
  END IF;
END $$;