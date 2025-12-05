alter table if exists public.figma_file_history
  add column if not exists frames_cache jsonb,
  add column if not exists cached_at timestamptz;

comment on column public.figma_file_history.frames_cache is 'Cached snapshot of frames for quick reloads';
comment on column public.figma_file_history.cached_at is 'Timestamp when frames_cache was refreshed';
