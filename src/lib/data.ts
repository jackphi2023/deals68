import { supabase } from './supabase';
import { seedBusinesses } from '../data/seedBusinesses';
import { computeBusinessQuality } from './scoring';

const investorPublicSelect = [
  'id','code','username','type','title_vi','title_en','desc_vi','desc_en','country_iso2','country','region','industries','deal_types','stage','ticket_min','ticket_max','criteria','visible','verified','admin_priority','activity_level','status','created_at','updated_at'
].join(',');

function applyPagination(q: any, filters: any) {
  const limit = Number(filters.limit || 0);
  const offset = Math.max(0, Number(filters.offset || 0));
  if (limit > 0) return q.range(offset, offset + limit - 1);
  return q;
}

export async function listBusinesses(filters: any = {}) {
  let q = supabase.from('businesses').select('*, business_files(count), business_images(count)');
  if (!filters.includeHidden) q = q.eq('visible', true).eq('status', 'active');
  if (filters.industry) q = q.ilike('industry', `%${filters.industry}%`);
  if (filters.country) q = q.eq('country_iso2', filters.country);
  if (filters.dealType) q = q.ilike('deal_type', `%${filters.dealType}%`);
  if (filters.search || filters.q) {
    const keyword = filters.search || filters.q;
    q = q.or(`title_vi.ilike.%${keyword}%,title_en.ilike.%${keyword}%,description_vi.ilike.%${keyword}%,description_en.ilike.%${keyword}%,industry.ilike.%${keyword}%,public_code.ilike.%${keyword}%`);
  }
  const sort = filters.sort || 'featured';
  if (sort === 'revenue') q = q.order('revenue_2025', { ascending: false, nullsFirst: false });
  else if (sort === 'ask') q = q.order('ask_amount', { ascending: false, nullsFirst: false });
  else if (sort === 'quality' || sort === 'featured') q = q.order('quality_score', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false });
  else q = q.order('created_at', { ascending: false });
  q = applyPagination(q, filters);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function countBusinesses(filters: any = {}) {
  let q = supabase.from('businesses').select('id', { count: 'exact', head: true });
  if (!filters.includeHidden) q = q.eq('visible', true).eq('status', 'active');
  if (filters.industry) q = q.ilike('industry', `%${filters.industry}%`);
  if (filters.country) q = q.eq('country_iso2', filters.country);
  if (filters.dealType) q = q.ilike('deal_type', `%${filters.dealType}%`);
  const { count, error } = await q;
  if (error) throw error;
  return count || 0;
}

export async function getBusinessBySlug(slug: string) {
  const { data, error } = await supabase.from('businesses').select('*').eq('slug', slug).maybeSingle();
  if (error) throw error;
  return data;
}

export async function getMyBusiness(ownerId: string) {
  const { data, error } = await supabase.from('businesses').select('*').eq('owner_id', ownerId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function listInvestors(filters: any = {}) {
  let q = supabase.from('investors').select(investorPublicSelect);
  if (!filters.includeHidden) q = q.eq('visible', true).eq('status', 'active');
  if (filters.type) q = q.eq('type', filters.type);
  if (filters.country) q = q.eq('country_iso2', filters.country);
  if (filters.region) q = q.ilike('region', `%${filters.region}%`);
  if (filters.industry) q = q.contains('industries', [filters.industry]);
  if (filters.dealType) q = q.contains('deal_types', [filters.dealType]);
  if (filters.stage) q = q.ilike('stage', `%${filters.stage}%`);
  if (filters.minTicket) q = q.gte('ticket_max', Number(filters.minTicket));
  if (filters.maxTicket) q = q.lte('ticket_min', Number(filters.maxTicket));
  if (filters.search || filters.q) {
    const keyword = filters.search || filters.q;
    q = q.or(`code.ilike.%${keyword}%,title_vi.ilike.%${keyword}%,title_en.ilike.%${keyword}%,desc_vi.ilike.%${keyword}%,desc_en.ilike.%${keyword}%,type.ilike.%${keyword}%,country.ilike.%${keyword}%`);
  }
  const sort = filters.sort || 'ranking';
  if (sort === 'ticket') q = q.order('ticket_max', { ascending: false, nullsFirst: false });
  else if (sort === 'newest') q = q.order('created_at', { ascending: false });
  else if (sort === 'verified') q = q.order('verified', { ascending: false }).order('admin_priority', { ascending: false }).order('created_at', { ascending: false });
  else q = q.order('admin_priority', { ascending: false }).order('verified', { ascending: false }).order('created_at', { ascending: false });
  q = applyPagination(q, { ...filters, limit: filters.limit || 24 });
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function countInvestors(filters: any = {}) {
  let q = supabase.from('investors').select('id', { count: 'exact', head: true });
  if (!filters.includeHidden) q = q.eq('visible', true).eq('status', 'active');
  if (filters.type) q = q.eq('type', filters.type);
  if (filters.country) q = q.eq('country_iso2', filters.country);
  if (filters.region) q = q.ilike('region', `%${filters.region}%`);
  if (filters.industry) q = q.contains('industries', [filters.industry]);
  const { count, error } = await q;
  if (error) throw error;
  return count || 0;
}

export async function getInvestorByOwner(ownerId: string) {
  const { data, error } = await supabase.from('investors').select('*').eq('owner_id', ownerId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function getInvestorByCode(code: string) {
  const { data, error } = await supabase.from('investors').select(investorPublicSelect).eq('code', code).maybeSingle();
  if (error) throw error;
  return data;
}

export async function getQualityCriteria() {
  const { data, error } = await supabase.from('quality_criteria').select('*').eq('active', true).order('sort_order');
  if (error) throw error;
  return data || [];
}

export function makePublicCode(prefix = 'D68') {
  const dt = new Date();
  const ymd = `${dt.getFullYear()}${String(dt.getMonth() + 1).padStart(2, '0')}${String(dt.getDate()).padStart(2, '0')}`;
  const tail = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${prefix}-${ymd}-${tail}`;
}

export async function createBusinessFromProfile(ownerId: string, payload: any) {
  const criteria = await getQualityCriteria().catch(() => []);
  const quality = computeBusinessQuality(payload, criteria);
  const { data, error } = await supabase.from('businesses').insert({
    ...payload,
    public_code: payload.public_code || makePublicCode('D68'),
    owner_id: ownerId,
    quality_score: quality,
    status: 'pending_admin_review',
    visible: false
  }).select().single();
  if (error) throw error;
  return data;
}

export async function uploadBusinessFile(businessId: string, ownerId: string, file: File, category = 'financials', privacy = 'locked') {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `${businessId}/${Date.now()}-${safeName}`;
  const { error: upErr } = await supabase.storage.from('business-files-private').upload(path, file, { upsert: false });
  if (upErr) throw upErr;
  const { data, error } = await supabase.from('business_files').insert({ business_id: businessId, owner_id: ownerId, file_name: file.name, file_path: path, file_type: file.type, size_bytes: file.size, category, privacy_level: privacy }).select().single();
  if (error) throw error;
  return data;
}

export async function uploadBusinessImage(businessId: string, ownerId: string, file: File, title = '') {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `${businessId}/${Date.now()}-${safeName}`;
  const { error: upErr } = await supabase.storage.from('business-images-public').upload(path, file, { upsert: false });
  if (upErr) throw upErr;
  const { data: pub } = supabase.storage.from('business-images-public').getPublicUrl(path);
  const { data, error } = await supabase.from('business_images').insert({ business_id: businessId, owner_id: ownerId, title, image_path: path, public_url: pub.publicUrl }).select().single();
  if (error) throw error;
  return data;
}

export async function createInvestorForOwner(ownerId: string, payload: any) {
  const { data, error } = await supabase.from('investors').insert({ ...payload, owner_id: ownerId, status: 'pending_admin_review', visible: false }).select().single();
  if (error) throw error;
  return data;
}

// Legacy helper retained only for local seed/admin scripts. Public pages must not call this.
export async function fallbackSeedBusinesses() {
  return seedBusinesses.map((b) => ({ ...b, id: b.username, status: 'active', visible: true }));
}
