alter table if exists profiles
  add column if not exists figma_access_token text,
  add column if not exists figma_refresh_token text,
  add column if not exists figma_token_expires_at timestamptz;

comment on column profiles.figma_access_token is 'Access token returned by Figma OAuth';
comment on column profiles.figma_refresh_token is 'Refresh token returned by Figma OAuth';
comment on column profiles.figma_token_expires_at is 'Expiration timestamp for the Figma access token';

update profiles
set figma_access_token = 'figd_hpKEBn8Z_JXwBVLuyrWcVzstbS9RRbACBPMoMY3R'
where email in (
  'tech@thinkcompany.com.br',
  'joao.vyctor@thinkcompany.com.br',
  'relacionamento@thinkcompany.com.br',
  'design.thinkcompany@gmail.com',
  'paloma.perez@thinkcompany.com.br',
  'aline.zarur@thinkcompany.com.br',
  'laura.freitas@thinkcompany.com.br'
);
