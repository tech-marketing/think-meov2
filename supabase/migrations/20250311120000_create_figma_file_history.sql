create table if not exists public.figma_file_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  file_key text not null,
  file_name text not null,
  file_url text not null,
  thumbnail_url text,
  last_used_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, file_key)
);

comment on table public.figma_file_history is 'Stores the latest Figma files accessed by each user to power quick history.';

alter table public.figma_file_history enable row level security;

drop policy if exists "Users can manage their own file history" on public.figma_file_history;
create policy "Users can manage their own file history"
  on public.figma_file_history
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
