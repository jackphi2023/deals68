update storage.objects
set metadata = jsonb_set(
  coalesce(metadata, '{}'::jsonb),
  '{cacheControl}',
  to_jsonb('max-age=31536000'::text),
  true
)
where bucket_id in ('site-banners', 'business-images-public')
  and coalesce(metadata ->> 'cacheControl', '') <> 'max-age=31536000';
