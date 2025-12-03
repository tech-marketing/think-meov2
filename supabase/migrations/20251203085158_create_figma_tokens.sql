create table if not exists public.figma_tokens (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  access_token text not null,
  refresh_token text,
  expires_at timestamptz,
  created_at timestamptz default now()
);

comment on table public.figma_tokens is 'Stores Figma OAuth tokens for each user';
