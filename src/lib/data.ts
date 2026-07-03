import { supabase } from './supabase';
import { seedBusinesses } from '../data/seedBusinesses';
import { computeBusinessQuality } from './scoring';

export async function listBusinesses(filters: any = {}) {
  let q = supabase.from('businesses').select('*, business_files(count), business_images(count)').order('created_at', { ascending: false });
  if (!filters.includeHidden) q = q.eq('visible', true).eq('status', 'active');
  if (filters.industry) q = q.ilike('industry', `%${filters.industry}%`);
  if (filters.country) q = q.eq('country_iso2', filters.country);
  if (filters.search) q = q.or(`title_vi.ilike.%${filters.search}%,title_en.ilike.%${filters.search}%,industry.ilike.%${filters.search}%`);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
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
  let q = supabase.from('investors').select('*').order('admin_priority', { ascending: false }).order('created_at', { ascending: false });
  if (!filters.includeHidden) q = q.eq('visible', true).eq('status', 'active');
  if (filters.type) q = q.eq('type', filters.type);
  if (filters.country) q = q.eq('country_iso2', filters.country);
  if (filters.industry) q = q.contains('industries', [filters.industry]);
  if (filters.search) q = q.or(`title_vi.ilike.%${filters.search}%,title_en.ilike.%${filters.search}%,desc_en.ilike.%${filters.search}%`);
  const { data, error } = await q.limit(filters.limit || 1000);
  if (error) throw error;
  return data || [];
}

export async function getInvestorByOwner(ownerId: string) {
  const { data, error } = await supabase.from('investors').select('*').eq('owner_id', ownerId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function getInvestorByCode(code: string) {
  const { data, error } = await supabase.from('investors').select('*').eq('code', code).maybeSingle();
  if (error) throw error;
  return data;
}

export async function getQualityCriteria() {
  const { data, error } = await supabase.from('quality_criteria').select('*').eq('active', true).order('sort_order');
  if (error) throw error;
  return data || [];
}

export async function createBusinessFromProfile(ownerId: string, payload: any) {
  const criteria = await getQualityCriteria().catch(() => []);
  const quality = computeBusinessQuality(payload, criteria);
  const { data, error } = await supabase.from('businesses').insert({ ...payload, owner_id: ownerId, quality_score: quality, status: 'pending_admin_review', visible: false }).select().single();
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

export async function fallbackSeedBusinesses() {
  return seedBusinesses.map((b) => ({ ...b, id: b.username, status: 'active', visible: true }));
}
