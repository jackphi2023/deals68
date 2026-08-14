create table if not exists public.news_articles (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'draft' check (status in ('draft','published','deleted')),
  slug_vi text,
  slug_en text,
  title_vi text,
  title_en text,
  excerpt_vi text,
  excerpt_en text,
  content_json_vi jsonb,
  content_json_en jsonb,
  featured_image_url text,
  featured_image_alt_vi text,
  featured_image_alt_en text,
  is_featured boolean not null default false,
  published_date date,
  author_name text not null default 'Deals68.com',
  seo_title_vi text,
  seo_title_en text,
  seo_description_vi text,
  seo_description_en text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint news_articles_slug_vi_not_blank check (slug_vi is null or btrim(slug_vi) <> ''),
  constraint news_articles_slug_en_not_blank check (slug_en is null or btrim(slug_en) <> ''),
  constraint news_articles_content_vi_shape check (content_json_vi is null or jsonb_typeof(content_json_vi) = 'object'),
  constraint news_articles_content_en_shape check (content_json_en is null or jsonb_typeof(content_json_en) = 'object'),
  constraint news_articles_deleted_state check (
    (status = 'deleted' and deleted_at is not null)
    or (status <> 'deleted' and deleted_at is null)
  ),
  constraint news_articles_publish_vi_complete check (
    status <> 'published'
    or (
      published_date is not null
      and nullif(btrim(slug_vi), '') is not null
      and nullif(btrim(title_vi), '') is not null
      and nullif(btrim(excerpt_vi), '') is not null
      and content_json_vi is not null
    )
  ),
  constraint news_articles_publish_en_bundle check (
    status <> 'published'
    or (
      (slug_en is null and title_en is null and excerpt_en is null and content_json_en is null)
      or (
        nullif(btrim(slug_en), '') is not null
        and nullif(btrim(title_en), '') is not null
        and nullif(btrim(excerpt_en), '') is not null
        and content_json_en is not null
      )
    )
  )
);

create unique index if not exists news_articles_slug_vi_unique
  on public.news_articles (lower(slug_vi))
  where slug_vi is not null and btrim(slug_vi) <> '' and status <> 'deleted';

create unique index if not exists news_articles_slug_en_unique
  on public.news_articles (lower(slug_en))
  where slug_en is not null and btrim(slug_en) <> '' and status <> 'deleted';

create index if not exists news_articles_public_order_idx
  on public.news_articles (published_date desc, created_at desc)
  where status = 'published' and deleted_at is null;

create index if not exists news_articles_featured_public_idx
  on public.news_articles (published_date desc, created_at desc)
  where status = 'published' and deleted_at is null and is_featured = true;

create index if not exists news_articles_admin_updated_idx
  on public.news_articles (updated_at desc);

create table if not exists public.news_tags (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  label_vi text not null,
  label_en text,
  created_at timestamptz not null default now(),
  constraint news_tags_slug_not_blank check (btrim(slug) <> ''),
  constraint news_tags_label_vi_not_blank check (btrim(label_vi) <> '')
);

create unique index if not exists news_tags_slug_unique
  on public.news_tags (lower(slug));

create table if not exists public.news_article_tags (
  article_id uuid not null references public.news_articles(id) on delete cascade,
  tag_id uuid not null references public.news_tags(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (article_id, tag_id)
);

create index if not exists news_article_tags_tag_article_idx
  on public.news_article_tags (tag_id, article_id);

create or replace function public.d68_news_set_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.d68_news_set_updated_at() from public, anon, authenticated;
grant execute on function public.d68_news_set_updated_at() to service_role;

drop trigger if exists news_articles_set_updated_at on public.news_articles;
create trigger news_articles_set_updated_at
before update on public.news_articles
for each row execute function public.d68_news_set_updated_at();

alter table public.news_articles enable row level security;
alter table public.news_tags enable row level security;
alter table public.news_article_tags enable row level security;

revoke all on public.news_articles from anon, authenticated;
revoke all on public.news_tags from anon, authenticated;
revoke all on public.news_article_tags from anon, authenticated;

grant select on public.news_articles to anon, authenticated;
grant insert, update on public.news_articles to authenticated;

grant select on public.news_tags to anon, authenticated;
grant insert, update, delete on public.news_tags to authenticated;

grant select on public.news_article_tags to anon, authenticated;
grant insert, update, delete on public.news_article_tags to authenticated;

grant all on public.news_articles to service_role;
grant all on public.news_tags to service_role;
grant all on public.news_article_tags to service_role;

drop policy if exists "news articles public read published" on public.news_articles;
create policy "news articles public read published"
on public.news_articles
for select
to anon, authenticated
using (status = 'published' and deleted_at is null);

drop policy if exists "news articles admin read all" on public.news_articles;
create policy "news articles admin read all"
on public.news_articles
for select
to authenticated
using ((select public.is_admin()));

drop policy if exists "news articles admin insert" on public.news_articles;
create policy "news articles admin insert"
on public.news_articles
for insert
to authenticated
with check ((select public.is_admin()));

drop policy if exists "news articles admin update" on public.news_articles;
create policy "news articles admin update"
on public.news_articles
for update
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

drop policy if exists "news tags public read" on public.news_tags;
create policy "news tags public read"
on public.news_tags
for select
to anon, authenticated
using (true);

drop policy if exists "news tags admin insert" on public.news_tags;
create policy "news tags admin insert"
on public.news_tags
for insert
to authenticated
with check ((select public.is_admin()));

drop policy if exists "news tags admin update" on public.news_tags;
create policy "news tags admin update"
on public.news_tags
for update
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

drop policy if exists "news tags admin delete" on public.news_tags;
create policy "news tags admin delete"
on public.news_tags
for delete
to authenticated
using ((select public.is_admin()));

drop policy if exists "news article tags public read published" on public.news_article_tags;
create policy "news article tags public read published"
on public.news_article_tags
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.news_articles a
    where a.id = news_article_tags.article_id
      and a.status = 'published'
      and a.deleted_at is null
  )
);

drop policy if exists "news article tags admin insert" on public.news_article_tags;
create policy "news article tags admin insert"
on public.news_article_tags
for insert
to authenticated
with check ((select public.is_admin()));

drop policy if exists "news article tags admin update" on public.news_article_tags;
create policy "news article tags admin update"
on public.news_article_tags
for update
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

drop policy if exists "news article tags admin delete" on public.news_article_tags;
create policy "news article tags admin delete"
on public.news_article_tags
for delete
to authenticated
using ((select public.is_admin()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'news-media',
  'news-media',
  true,
  10485760,
  array['image/jpeg','image/png','image/webp']::text[]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "news media admin select" on storage.objects;
create policy "news media admin select"
on storage.objects
for select
to authenticated
using (bucket_id = 'news-media' and (select public.is_admin()));

drop policy if exists "news media admin insert" on storage.objects;
create policy "news media admin insert"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'news-media' and (select public.is_admin()));

drop policy if exists "news media admin update" on storage.objects;
create policy "news media admin update"
on storage.objects
for update
to authenticated
using (bucket_id = 'news-media' and (select public.is_admin()))
with check (bucket_id = 'news-media' and (select public.is_admin()));

drop policy if exists "news media admin delete" on storage.objects;
create policy "news media admin delete"
on storage.objects
for delete
to authenticated
using (bucket_id = 'news-media' and (select public.is_admin()));

comment on table public.news_articles is 'Deals68 News V1 editorial articles. Public RLS exposes published, non-deleted rows only.';
comment on table public.news_tags is 'Deals68 News V1 normalized tag taxonomy.';
comment on table public.news_article_tags is 'Deals68 News V1 article-to-tag relation. Public RLS exposes relations for published articles only.';
comment on column public.news_articles.published_date is 'Editorial publication date selected by Admin; independent from created_at and publish action time.';
