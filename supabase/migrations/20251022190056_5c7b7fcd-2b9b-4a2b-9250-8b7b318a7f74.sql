-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create cron job to refresh competitor ads cache every Monday at 3 AM UTC
SELECT cron.schedule(
  'refresh-competitor-ads-weekly',
  '0 3 * * 1', -- Every Monday at 3 AM UTC
  $$
  SELECT
    net.http_post(
      url:='https://oprscgxsfldzydbrbioz.supabase.co/functions/v1/refresh-competitor-ads-cache',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9wcnNjZ3hzZmxkenlkYnJiaW96Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcwNzY0ODIsImV4cCI6MjA3MjY1MjQ4Mn0.qJapmxzavtnEWZ2j5RpW6nb3fppcaOiKCxApn77DG7g"}'::jsonb,
      body:='{}'::jsonb
    ) as request_id;
  $$
);

-- Add comment to document the cron job
COMMENT ON EXTENSION pg_cron IS 'Enables scheduled jobs for automatic competitor ads cache refresh';
