create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists(select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin' and p.status = 'active');
$$;

create or replace function public.current_profile_role()
returns text
language sql
security definer
set search_path = public
stable
as $$
  select role::text from public.profiles p where p.id = auth.uid();
$$;

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger trg_profiles_updated before update on public.profiles for each row execute function public.touch_updated_at();
create trigger trg_businesses_updated before update on public.businesses for each row execute function public.touch_updated_at();
create trigger trg_investors_updated before update on public.investors for each row execute function public.touch_updated_at();

create or replace function public.log_admin_action(action text, entity_type text, entity_id text, detail jsonb default '{}'::jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.audit_logs(actor_id, action, entity_type, entity_id, detail)
  values (auth.uid(), action, entity_type, entity_id, detail);
end $$;

create or replace function public.approve_business_pending(business_uuid uuid)
returns public.businesses
language plpgsql
security definer
set search_path = public
as $$
declare b public.businesses;
begin
  if not public.is_admin() then raise exception 'not allowed'; end if;
  update public.businesses
  set
    title_vi = coalesce(pending_changes_json->>'title_vi', title_vi),
    title_en = coalesce(pending_changes_json->>'title_en', title_en),
    revenue_2025 = coalesce((pending_changes_json->>'revenue_2025')::numeric, revenue_2025),
    ebitda_margin = coalesce((pending_changes_json->>'ebitda_margin')::numeric, ebitda_margin),
    ask_amount = coalesce((pending_changes_json->>'ask_amount')::numeric, ask_amount),
    stake_pct = coalesce((pending_changes_json->>'stake_pct')::numeric, stake_pct),
    highlights_vi = coalesce(pending_changes_json->>'highlights_vi', highlights_vi),
    highlights_en = coalesce(pending_changes_json->>'highlights_en', highlights_en),
    investment_reason_vi = coalesce(pending_changes_json->>'investment_reason_vi', investment_reason_vi),
    investment_reason_en = coalesce(pending_changes_json->>'investment_reason_en', investment_reason_en),
    financial_input = coalesce(pending_changes_json->'financial_input', financial_input),
    pending_changes_json = null,
    status = 'active'
  where id = business_uuid
  returning * into b;
  perform public.log_admin_action('approve_pending_changes','business',business_uuid::text,'{}'::jsonb);
  return b;
end $$;

-- RLS
alter table public.profiles enable row level security;
alter table public.businesses enable row level security;
alter table public.investors enable row level security;
alter table public.business_files enable row level security;
alter table public.business_images enable row level security;
alter table public.proposals enable row level security;
alter table public.investor_interests enable row level security;
alter table public.saved_businesses enable row level security;
alter table public.request_data enable row level security;
alter table public.promo_codes enable row level security;
alter table public.promo_redemptions enable row level security;
alter table public.quality_criteria enable row level security;
alter table public.audit_logs enable row level security;
alter table public.country_calling_codes enable row level security;

create policy "public country codes" on public.country_calling_codes for select using (true);
create policy "public quality criteria" on public.quality_criteria for select using (true);
create policy "admin quality write" on public.quality_criteria for all using (public.is_admin()) with check (public.is_admin());

create policy "profile own or admin select" on public.profiles for select using (id = auth.uid() or public.is_admin());
create policy "profile own insert" on public.profiles for insert with check (id = auth.uid() or public.is_admin());
create policy "profile own update" on public.profiles for update using (id = auth.uid() or public.is_admin()) with check (id = auth.uid() or public.is_admin());

create policy "public visible businesses" on public.businesses for select using ((visible = true and status = 'active') or owner_id = auth.uid() or public.is_admin());
create policy "business insert own" on public.businesses for insert with check (owner_id = auth.uid() or public.is_admin());
create policy "business update own or admin" on public.businesses for update using (owner_id = auth.uid() or public.is_admin()) with check (owner_id = auth.uid() or public.is_admin());
create policy "business delete admin" on public.businesses for delete using (public.is_admin());

create policy "public visible investors" on public.investors for select using ((visible = true and status = 'active') or owner_id = auth.uid() or public.is_admin());
create policy "investor insert own" on public.investors for insert with check (owner_id = auth.uid() or public.is_admin());
create policy "investor update own or admin" on public.investors for update using (owner_id = auth.uid() or public.is_admin()) with check (owner_id = auth.uid() or public.is_admin());
create policy "investor delete admin" on public.investors for delete using (public.is_admin());

create policy "files readable to owner investor connected or admin" on public.business_files for select using (
  owner_id = auth.uid() or public.is_admin() or exists (
    select 1 from public.proposals p join public.investors i on i.id = p.investor_id
    where p.business_id = business_files.business_id and i.owner_id = auth.uid() and p.status in ('approved','connected')
  )
);
create policy "files insert owner/admin" on public.business_files for insert with check (owner_id = auth.uid() or public.is_admin());
create policy "files update owner/admin" on public.business_files for update using (owner_id = auth.uid() or public.is_admin()) with check (owner_id = auth.uid() or public.is_admin());

create policy "images public visible" on public.business_images for select using (true);
create policy "images insert owner/admin" on public.business_images for insert with check (owner_id = auth.uid() or public.is_admin());
create policy "images update owner/admin" on public.business_images for update using (owner_id = auth.uid() or public.is_admin()) with check (owner_id = auth.uid() or public.is_admin());

create policy "proposal parties admin select" on public.proposals for select using (
  public.is_admin()
  or exists(select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid())
  or exists(select 1 from public.investors i where i.id = investor_id and i.owner_id = auth.uid())
);
create policy "proposal business insert" on public.proposals for insert with check (exists(select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid()) or public.is_admin());
create policy "proposal investor admin update" on public.proposals for update using (public.is_admin() or exists(select 1 from public.investors i where i.id = investor_id and i.owner_id = auth.uid())) with check (public.is_admin() or exists(select 1 from public.investors i where i.id = investor_id and i.owner_id = auth.uid()));

create policy "interest parties select" on public.investor_interests for select using (
  public.is_admin()
  or exists(select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid())
  or exists(select 1 from public.investors i where i.id = investor_id and i.owner_id = auth.uid())
);
create policy "interest investor insert" on public.investor_interests for insert with check (exists(select 1 from public.investors i where i.id = investor_id and i.owner_id = auth.uid()) or public.is_admin());
create policy "interest business update" on public.investor_interests for update using (public.is_admin() or exists(select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid())) with check (public.is_admin() or exists(select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid()));

create policy "saved investor own" on public.saved_businesses for all using (public.is_admin() or exists(select 1 from public.investors i where i.id = investor_id and i.owner_id = auth.uid())) with check (public.is_admin() or exists(select 1 from public.investors i where i.id = investor_id and i.owner_id = auth.uid()));

create policy "request parties select" on public.request_data for select using (
  public.is_admin()
  or exists(select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid())
  or exists(select 1 from public.investors i where i.id = investor_id and i.owner_id = auth.uid())
);
create policy "request investor insert" on public.request_data for insert with check (public.is_admin() or exists(select 1 from public.investors i where i.id = investor_id and i.owner_id = auth.uid()));
create policy "request business admin update" on public.request_data for update using (public.is_admin() or exists(select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid())) with check (public.is_admin() or exists(select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid()));

create policy "public active promos" on public.promo_codes for select using (active = true or public.is_admin());
create policy "admin promo write" on public.promo_codes for all using (public.is_admin()) with check (public.is_admin());
create policy "redemption own/admin" on public.promo_redemptions for select using (profile_id = auth.uid() or public.is_admin());
create policy "redemption own insert" on public.promo_redemptions for insert with check (profile_id = auth.uid() or public.is_admin());

create policy "audit admin only" on public.audit_logs for select using (public.is_admin());
create policy "audit admin insert" on public.audit_logs for insert with check (public.is_admin());

-- Storage buckets should be created from Supabase UI or seed script:
-- business-files-private (private), business-images-public (public).

create or replace function public.resolve_login_email(login text)
returns text
language sql
security definer
set search_path = public
stable
as $$
  select email from public.profiles where username = login or email = login limit 1;
$$;
grant execute on function public.resolve_login_email(text) to anon, authenticated;

