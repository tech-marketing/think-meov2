alter table if exists profiles
  add column if not exists figma_access_token text,
  add column if not exists figma_refresh_token text,
  add column if not exists figma_token_expires_at timestamptz;

comment on column profiles.figma_access_token is 'Access token returned by Figma OAuth';
comment on column profiles.figma_refresh_token is 'Refresh token returned by Figma OAuth';
comment on column profiles.figma_token_expires_at is 'Expiration timestamp for the Figma access token';
