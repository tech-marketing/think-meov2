alter table if exists public.competitor_ads_cache
  add column if not exists gcs_image_urls jsonb,
  add column if not exists gcs_video_urls jsonb;

comment on column public.competitor_ads_cache.gcs_image_urls is 'List of cached competitor image URLs stored in GCS';
comment on column public.competitor_ads_cache.gcs_video_urls is 'List of cached competitor video URLs stored in GCS';
