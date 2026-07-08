-- Deals68 Business Quality Score v1.1
-- Changes:
-- 1) Profile completeness weight 15 -> 20
-- 2) Images weight 10 -> 5
-- 3) Images score = 1 point per image, capped at 5

update public.quality_score_config
set config = jsonb_set(
      jsonb_set(config, '{weights,profile}', '20'::jsonb, true),
      '{weights,images}', '5'::jsonb, true
    ),
    name = 'Business Quality Score v1.1',
    updated_at = now()
where is_active = true;

create or replace function public.active_quality_score_config()
returns jsonb language sql stable security definer set search_path to 'public' as $$
  select coalesce(
    (select config from public.quality_score_config where is_active=true order by version desc limit 1),
    '{"weights":{"profile":20,"financial":20,"documents":20,"images":5,"valuation":25,"readiness":10}}'::jsonb
  );
$$;

do $$
declare src text;
begin
  select pg_get_functiondef('public.calculate_business_quality_score_payload(uuid)'::regprocedure) into src;

  src := replace(src,
    $old$w_profile numeric := coalesce((weights->>'profile')::numeric, 15);$old$,
    $new$w_profile numeric := coalesce((weights->>'profile')::numeric, 20);$new$
  );

  src := replace(src,
    $old$w_images numeric := coalesce((weights->>'images')::numeric, 10);$old$,
    $new$w_images numeric := coalesce((weights->>'images')::numeric, 5);$new$
  );

  src := replace(src,
    $old$profile_score := profile_score + case when nullif(b.company_name_private,'') is not null then 2 else 0 end + case when nullif(b.title_vi,'') is not null then 2 else 0 end + case when nullif(b.title_en,'') is not null then 1 else 0 end + case when nullif(b.description_vi,'') is not null then 3 else 0 end + case when nullif(b.description_en,'') is not null then 1 else 0 end + case when nullif(b.industry,'') is not null then 2 else 0 end + case when nullif(coalesce(b.city,b.country_iso2),'') is not null then 2 else 0 end + case when nullif(b.deal_type,'') is not null then 2 else 0 end;$old$,
    $new$profile_score := profile_score + case when nullif(b.company_name_private,'') is not null then 2 else 0 end + case when nullif(b.title_vi,'') is not null then 2 else 0 end + case when nullif(b.title_en,'') is not null then 1 else 0 end + case when nullif(b.description_vi,'') is not null then 3 else 0 end + case when nullif(b.description_en,'') is not null then 1 else 0 end + case when nullif(b.industry,'') is not null then 2 else 0 end + case when nullif(coalesce(b.city,b.country_iso2),'') is not null then 2 else 0 end + case when nullif(b.deal_type,'') is not null then 2 else 0 end + case when nullif(b.highlights_vi,'') is not null then 2 else 0 end + case when nullif(b.investment_reason_vi,'') is not null then 3 else 0 end;$new$
  );

  src := replace(src,
    $old$images_score := least(w_images, (case when image_count>=1 then 3 else 0 end) + (case when image_count>=3 then 2 else 0 end) + (case when hero_image_count>0 or nullif(coalesce(b.hero_image_url,b.image_url),'') is not null then 2 else 0 end) + (case when image_count>0 and nullif(coalesce(b.hero_image_url,b.image_url),'') is not null then 2 else 0 end) + (case when image_count>0 then 1 else 0 end));$old$,
    $new$images_score := least(w_images, image_count);$new$
  );

  execute src;
end $$;

do $$
declare r record;
begin
  for r in select id from public.businesses loop
    perform public.recalculate_business_quality_score(r.id, true);
  end loop;
end $$;
