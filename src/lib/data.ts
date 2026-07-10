import { supabase } from './supabase';
import { seedBusinesses } from '../data/seedBusinesses';
import { computeBusinessQuality } from './scoring';
import { industryKeyFromLabel } from './industryTaxonomy';

type BusinessAssetRow = Record<string, any>;
type BusinessDetailAssets = { files: BusinessAssetRow[]; images: BusinessAssetRow[] };

const businessPublicSelect = [
  'id','public_code','slug','title_vi','title_en','description_vi','description_en','country_iso2','city','industry','deal_type','plan','revenue_2025','revenue_currency','ebitda_margin','ask_amount','ask_currency','stake_pct','highlights_vi','highlights_en','investment_reason_vi','investment_reason_en','data_confidence','quality_score','valuation_reasonableness','visible','status','quota_total','quota_used','image_url','created_at','updated_at','public_snapshot_json','public_version','last_approved_at','moderation_status','hero_image_url'
].join(',');

const investorPublicSelect = [
  'id','code','type','title_vi','title_en','desc_vi','desc_en','country_iso2','country','region','industries','deal_types','stage','ticket_min','ticket_max','criteria','visible','verified','admin_priority','activity_level','status','created_at','updated_at'
].join(',');

function applyPagination(q: any, filters: any) {
  const limit = Number(filters.limit || 0);
  const offset = Math.max(0, Number(filters.offset || 0));
  if (limit > 0) return q.range(offset, offset + limit - 1);
  return q;
}

function clean(value: any) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function firstValue(...values: any[]) {
  return values.find((v) => clean(v)) ?? '';
}

function snapshotOf(row: any) {
  const raw = row?.public_snapshot_json;
  return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
}

export function getPublicBusinessView(row: any) {
  const s = snapshotOf(row);
  const titleVi = firstValue(s.title_vi, row.title_vi, row.public_code, 'Hồ sơ doanh nghiệp ẩn danh');
  const titleEn = firstValue(s.title_en, row.title_en, s.title_vi, row.title_vi, 'Anonymous business profile');
  return {
    ...row,
    ...s,
    id: row.id,
    slug: row.slug || '',
    public_code: row.public_code,
    visible: row.visible,
    status: row.status,
    public_version: row.public_version,
    last_approved_at: row.last_approved_at,
    title_vi: titleVi,
    title_en: titleEn,
    description_vi: firstValue(s.description_vi, row.description_vi),
    description_en: firstValue(s.description_en, row.description_en, s.description_vi, row.description_vi),
    highlights_vi: firstValue(s.highlights_vi, row.highlights_vi),
    highlights_en: firstValue(s.highlights_en, row.highlights_en, s.highlights_vi, row.highlights_vi),
    investment_reason_vi: firstValue(s.investment_reason_vi, row.investment_reason_vi),
    investment_reason_en: firstValue(s.investment_reason_en, row.investment_reason_en, s.investment_reason_vi, row.investment_reason_vi),
    industry: firstValue(s.industry, row.industry, 'Đang cập nhật'),
    deal_type: firstValue(s.deal_type, row.deal_type, 'Đang cập nhật'),
    city: firstValue(s.city, row.city, row.country_iso2, 'Việt Nam'),
    country_iso2: firstValue(s.country_iso2, row.country_iso2, 'VN'),
    revenue_2025: Number(firstValue(s.revenue_2025, row.revenue_2025, 0) || 0),
    revenue_currency: firstValue(s.revenue_currency, row.revenue_currency, 'VND'),
    ebitda_margin: s.ebitda_margin ?? row.ebitda_margin,
    ask_amount: Number(firstValue(s.ask_amount, row.ask_amount, 0) || 0),
    ask_currency: firstValue(s.ask_currency, row.ask_currency, row.revenue_currency, 'VND'),
    stake_pct: s.stake_pct ?? row.stake_pct,
    quality_score: s.quality_score ?? row.quality_score,
    data_confidence: s.data_confidence ?? row.data_confidence,
    image_url: firstValue(s.image_url, s.hero_image_url, row.hero_image_url, row.image_url),
    hero_image_url: firstValue(s.hero_image_url, s.image_url, row.hero_image_url, row.image_url)
  };
}

function safeLikeTerm(value: any) {
  return String(value || '').trim().replace(/[,()%]/g, ' ');
}

const COUNTRY_NAME_TO_ISO: Record<string, string> = {
  'vietnam': 'VN', 'việt nam': 'VN', 'viet nam': 'VN', 'singapore': 'SG',
  'united states': 'US', 'usa': 'US', 'us': 'US', 'mỹ': 'US', 'america': 'US',
  'canada': 'CA', 'south korea': 'KR', 'korea': 'KR', 'hàn quốc': 'KR',
  'germany': 'DE', 'đức': 'DE', 'japan': 'JP', 'nhật bản': 'JP',
  'india': 'IN', 'ấn độ': 'IN', 'an do': 'IN', 'china': 'CN', 'trung quốc': 'CN',
  'australia': 'AU', 'úc': 'AU', 'hong kong': 'HK', 'uae': 'AE',
  'united kingdom': 'GB', 'uk': 'GB', 'brazil': 'BR'
};
function normalizeCountryIso(value: any) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const upper = raw.toUpperCase();
  if (/^[A-Z]{2}$/.test(upper)) return upper;
  return COUNTRY_NAME_TO_ISO[raw.toLowerCase()] || '';
}
function criteriaCountryValues(criteria: any): any[] {
  if (!criteria || typeof criteria !== 'object') return [];
  const keys = ['targetCountries','target_countries','targetCountriesCache','target_countries_cache','preferredCountries','preferred_countries','investmentCountries','investment_countries','countries','markets'];
  return keys.flatMap((key) => { const v = criteria[key]; if (Array.isArray(v)) return v; if (typeof v === 'string') return v.split(/[;,]/); return []; });
}
function criteriaGeoValues(criteria: any): any[] {
  if (!criteria || typeof criteria !== 'object') return [];
  const keys = ['targetGeographies','target_geographies','geographies','geo','targetRegions','target_regions','preferredGeographies','preferred_geographies'];
  return keys.flatMap((key) => { const v = criteria[key]; if (Array.isArray(v)) return v; if (typeof v === 'string') return v.split(/[;,]/); return []; });
}
function uniqueCountryList(values: string[]) {
  const unique = Array.from(new Set(values.map((x) => String(x || '').trim().toUpperCase()).filter(Boolean)));
  return unique.includes('VN') ? ['VN', ...unique.filter((x) => x !== 'VN')] : unique;
}
function extractInvestorGeoText(row: any) {
  const text = `${row?.desc_vi || ''}\n${row?.desc_en || ''}`;
  const patterns = [/Khu vực quan tâm:\s*([^.\n]+)/i, /Địa lý quan tâm:\s*([^.\n]+)/i, /Target geographies:\s*([^.\n]+)/i, /Target markets:\s*([^.\n]+)/i, /Preferred markets:\s*([^.\n]+)/i];
  for (const pattern of patterns) {
    const m = text.match(pattern);
    if (m?.[1]) return String(m[1]).split(/[;,]/).map((x) => x.trim()).filter(Boolean);
  }
  return [];
}
export function investorTargetCountries(row: any): string[] {
  const explicit = criteriaCountryValues(row?.criteria).map(normalizeCountryIso).filter(Boolean);
  if (explicit.length) return uniqueCountryList(explicit);

  const countries: string[] = [];
  [...criteriaGeoValues(row?.criteria), ...extractInvestorGeoText(row)].forEach((raw) => {
    const n = String(raw || '').trim().toLowerCase();
    if (!n) return;
    if (n.includes('global') || n.includes('toàn cầu') || n.includes('toan cau')) countries.push('VN','US','SG','JP','KR','IN','CA','DE','AU','HK');
    if (n.includes('southeast asia') || n.includes('south east asia') || n === 'sea' || n.includes('đông nam á') || n.includes('dong nam a')) countries.push('VN','SG','ID','TH','MY','PH');
    if (n.includes('asia') || n.includes('châu á') || n.includes('chau a')) countries.push('VN','SG','JP','KR','IN','CN','HK','AE');
    if (n.includes('europe') || n.includes('châu âu') || n.includes('chau au')) countries.push('DE','GB');
    if (n.includes('america') || n.includes('americas') || n.includes('châu mỹ') || n.includes('chau my')) countries.push('US','CA','BR');
    const direct = normalizeCountryIso(raw);
    if (direct) countries.push(direct);
  });
  if (countries.length) return uniqueCountryList(countries);

  const hq = normalizeCountryIso(row?.country_iso2 || row?.country);
  return hq ? [hq] : [];
}
function investorTargetRegions(row: any): string[] {
  const map: Record<string, string> = { VN:'asia', SG:'asia', KR:'asia', JP:'asia', HK:'asia', IN:'asia', CN:'asia', AE:'mideast', US:'americas', CA:'americas', BR:'americas', DE:'europe', GB:'europe', AU:'oceania' };
  return Array.from(new Set(investorTargetCountries(row).map((iso) => map[iso]).filter(Boolean)));
}
function applyInvestorTargetFilter(rows: any[], filters: any) {
  let out = rows;
  if (filters.country) {
    const iso = normalizeCountryIso(filters.country);
    out = out.filter((row) => investorTargetCountries(row).includes(iso));
  }
  if (filters.region) {
    const region = String(filters.region || '').toLowerCase();
    out = out.filter((row) => investorTargetRegions(row).some((r) => r.includes(region)));
  }
  return out;
}

function investorIndustryMatches(row: any, rawIndustry: any) {
  const wantedKey = industryKeyFromLabel(rawIndustry);
  if (!wantedKey) return true;
  const criteria = row?.criteria && typeof row.criteria === 'object' ? row.criteria : {};
  const values = [
    ...(Array.isArray(row?.industries) ? row.industries : []),
    ...(Array.isArray(criteria.sectors) ? criteria.sectors : [])
  ];
  return values.some((value) => industryKeyFromLabel(value) === wantedKey);
}
function applyInvestorClientFilters(rows: any[], filters: any) {
  let out = rows;
  if (filters.country || filters.region) out = applyInvestorTargetFilter(out, filters);
  if (filters.industry) out = out.filter((row) => investorIndustryMatches(row, filters.industry));
  return out;
}

function dealTypeSearchTerms(raw: any) {
  const v = String(raw || '').toLowerCase();
  if (!v) return [];
  if (v.includes('loan') || v.includes('debt') || v.includes('vay') || v.includes('lending')) return ['loan', 'debt', 'vay', 'lending'];
  if (v.includes('jv') || v.includes('joint') || v.includes('partner') || v.includes('đối')) return ['jv', 'joint', 'partner', 'đối', 'partnership'];
  if (v.includes('sale') || v.includes('transfer') || v.includes('asset') || v.includes('m&a') || v.includes('bán') || v.includes('chuyển')) return ['sale', 'transfer', 'asset', 'acquisition', 'm&a', 'bán', 'chuyển'];
  if (v.includes('fund') || v.includes('raise') || v.includes('invest') || v.includes('gọi') || v.includes('vốn')) return ['fund', 'raise', 'fundrais', 'invest', 'equity', 'gọi', 'vốn'];
  const single = safeLikeTerm(v);
  return single ? [single] : [];
}

function applyBusinessPublicFilters(q: any, filters: any) {
  if (!filters.includeHidden) q = q.eq('visible', true).eq('status', 'active').not('public_snapshot_json', 'is', null);
  if (filters.industry) q = q.ilike('industry', `%${safeLikeTerm(filters.industry)}%`);
  if (filters.country) q = q.eq('country_iso2', filters.country);
  if (filters.dealType) {
    const terms = dealTypeSearchTerms(filters.dealType);
    if (terms.length > 1) q = q.or(terms.map((term) => `deal_type.ilike.%${term}%`).join(','));
    else if (terms[0]) q = q.ilike('deal_type', `%${terms[0]}%`);
  }
  if (filters.city) q = q.ilike('city', `%${safeLikeTerm(filters.city)}%`);
  if (filters.revenueBand === 'small') {
    q = q.or('and(revenue_currency.eq.VND,revenue_2025.lt.10000000000),and(revenue_currency.eq.USD,revenue_2025.lt.400000)');
  } else if (filters.revenueBand === 'mid') {
    q = q.or('and(revenue_currency.eq.VND,revenue_2025.gte.10000000000,revenue_2025.lte.100000000000),and(revenue_currency.eq.USD,revenue_2025.gte.400000,revenue_2025.lte.4000000)');
  } else if (filters.revenueBand === 'large') {
    q = q.or('and(revenue_currency.eq.VND,revenue_2025.gt.100000000000),and(revenue_currency.eq.USD,revenue_2025.gt.4000000)');
  }
  if (filters.minQuality) q = q.gte('quality_score', Number(filters.minQuality));
  if (filters.featuredOnly) q = q.eq('plan', 'featured');
  if (filters.search || filters.q) {
    const keyword = safeLikeTerm(filters.search || filters.q);
    if (keyword) q = q.or(`title_vi.ilike.%${keyword}%,title_en.ilike.%${keyword}%,description_vi.ilike.%${keyword}%,description_en.ilike.%${keyword}%,industry.ilike.%${keyword}%,public_code.ilike.%${keyword}%`);
  }
  return q;
}

export async function listBusinessFacets(filters: any = {}): Promise<{ city: string; industry: string; deal_type: string; plan: string; quality_score: number | null }[]> {
  let q: any = supabase.from('businesses').select('city, industry, deal_type, plan, quality_score');
  q = applyBusinessPublicFilters(q, { search: filters.search, country: filters.country });
  const { data, error } = await q.limit(1000);
  if (error) throw error;
  return (data || []) as any[];
}

export async function listBusinesses(filters: any = {}): Promise<any[]> {
  const select = filters.includeHidden ? '*, business_files(count), business_images(count)' : `${businessPublicSelect}, business_files(count), business_images(count)`;
  let q: any = supabase.from('businesses').select(select as string);
  q = applyBusinessPublicFilters(q, filters);
  const sort = filters.sort || 'featured';
  if (sort === 'revenue') q = q.order('revenue_2025', { ascending: false, nullsFirst: false });
  else if (sort === 'ask') q = q.order('ask_amount', { ascending: false, nullsFirst: false });
  else if (sort === 'quality' || sort === 'featured') q = q.order('quality_score', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false });
  else q = q.order('created_at', { ascending: false });
  q = applyPagination(q, filters);
  const { data, error } = await q;
  if (error) throw error;
  return ((data || []) as any[]).map(getPublicBusinessView);
}

export async function countBusinesses(filters: any = {}): Promise<number> {
  let q: any = supabase.from('businesses').select('id', { count: 'exact', head: true });
  q = applyBusinessPublicFilters(q, filters);
  const { count, error } = await q;
  if (error) throw error;
  return count || 0;
}

export async function getBusinessBySlug(slug: string, options: { includeHidden?: boolean } = {}): Promise<any | null> {
  const select = options.includeHidden ? '*' : businessPublicSelect;
  let q: any = supabase.from('businesses').select(select as string).eq('slug', slug);
  if (!options.includeHidden) q = q.eq('visible', true).eq('status', 'active').not('public_snapshot_json', 'is', null);
  const { data, error } = await q.maybeSingle();
  if (error) throw error;
  return data ? getPublicBusinessView(data) : null;
}

export async function getBusinessFiles(businessId: string, options: { publicOnly?: boolean } = {}): Promise<BusinessAssetRow[]> {
  const select = options.publicOnly
    ? 'id,business_id,file_name,display_name,file_type,size_bytes,category,privacy_level,public_visible,created_at,updated_at'
    : 'id,business_id,owner_id,file_name,display_name,file_path,file_type,size_bytes,category,privacy_level,public_visible,admin_note,created_at,updated_at';
  let q: any = supabase.from('business_files').select(select as string).eq('business_id', businessId);
  if (options.publicOnly) q = q.eq('public_visible', true);
  const { data, error } = await q.order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as BusinessAssetRow[];
}

export async function getBusinessImages(businessId: string, options: { publicOnly?: boolean } = {}): Promise<BusinessAssetRow[]> {
  const select = options.publicOnly
    ? 'id,business_id,title,display_title,public_url,sort_order,public_visible,is_sanitized,is_hero,created_at,updated_at'
    : 'id,business_id,owner_id,title,display_title,image_path,public_url,sort_order,public_visible,is_sanitized,is_hero,admin_note,created_at,updated_at';
  let q: any = supabase.from('business_images').select(select as string).eq('business_id', businessId);
  if (options.publicOnly) q = q.eq('public_visible', true).eq('is_sanitized', true);
  const { data, error } = await q.order('is_hero', { ascending: false }).order('sort_order', { ascending: true, nullsFirst: false }).order('created_at', { ascending: true });
  if (error) throw error;
  return (data || []) as BusinessAssetRow[];
}

export async function getBusinessDetailAssets(businessId: string, options: { publicOnly?: boolean } = {}): Promise<BusinessDetailAssets> {
  const [files, images] = await Promise.all([getBusinessFiles(businessId, options), getBusinessImages(businessId, options)]);
  return { files, images };
}

export async function getMyBusiness(ownerId: string) {
  const { data, error } = await supabase.from('businesses').select('*').eq('owner_id', ownerId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function listInvestors(filters: any = {}): Promise<any[]> {
  let q: any = supabase.from('investors').select(investorPublicSelect as string);
  if (!filters.includeHidden) q = q.eq('visible', true).eq('status', 'active');
  if (filters.type) q = q.eq('type', filters.type);
  // country/region filters mean target investment markets, not investor office location.
  if (filters.dealType) { const value = String(filters.dealType); q = q.or(`deal_types.cs.{${value}},deal_types.cs.{"${value}"}`); }
  if (filters.stage) q = q.ilike('stage', `%${safeLikeTerm(filters.stage)}%`);
  if (filters.minTicket) q = q.gte('ticket_max', Number(filters.minTicket));
  if (filters.maxTicket) q = q.lte('ticket_min', Number(filters.maxTicket));
  if (filters.search || filters.q) { const keyword = safeLikeTerm(filters.search || filters.q); if (keyword) q = q.or(`code.ilike.%${keyword}%,title_vi.ilike.%${keyword}%,title_en.ilike.%${keyword}%,desc_vi.ilike.%${keyword}%,desc_en.ilike.%${keyword}%,type.ilike.%${keyword}%,country.ilike.%${keyword}%`); }
  const sort = filters.sort || 'ranking';
  if (sort === 'ticket') q = q.order('ticket_max', { ascending: false, nullsFirst: false });
  else if (sort === 'newest') q = q.order('created_at', { ascending: false });
  else if (sort === 'verified') q = q.order('verified', { ascending: false }).order('admin_priority', { ascending: false }).order('created_at', { ascending: false });
  else q = q.order('admin_priority', { ascending: false }).order('verified', { ascending: false }).order('created_at', { ascending: false });
  const needsClientFilter = !!(filters.country || filters.region || filters.industry);
  q = applyPagination(q, needsClientFilter ? { ...filters, limit: filters.rawLimit || 1000, offset: 0 } : { ...filters, limit: filters.limit || 24 });
  const { data, error } = await q;
  if (error) throw error;
  const rows = needsClientFilter ? applyInvestorClientFilters((data || []) as any[], filters) : ((data || []) as any[]);
  if (!needsClientFilter) return rows;
  const offset = Math.max(0, Number(filters.offset || 0)); const limit = Number(filters.limit || 24);
  return rows.slice(offset, offset + limit);
}

export async function countInvestors(filters: any = {}): Promise<number> {
  if (filters.country || filters.region || filters.industry) {
    const rows = await listInvestors({ ...filters, limit: 1000, offset: 0, rawLimit: 1000 });
    return rows.length;
  }
  let q: any = supabase.from('investors').select('id', { count: 'exact', head: true });
  if (!filters.includeHidden) q = q.eq('visible', true).eq('status', 'active');
  if (filters.type) q = q.eq('type', filters.type);
  if (filters.dealType) { const value = String(filters.dealType); q = q.or(`deal_types.cs.{${value}},deal_types.cs.{"${value}"}`); }
  if (filters.stage) q = q.ilike('stage', `%${safeLikeTerm(filters.stage)}%`);
  if (filters.minTicket) q = q.gte('ticket_max', Number(filters.minTicket));
  if (filters.search || filters.q) { const keyword = safeLikeTerm(filters.search || filters.q); if (keyword) q = q.or(`code.ilike.%${keyword}%,title_vi.ilike.%${keyword}%,title_en.ilike.%${keyword}%,desc_vi.ilike.%${keyword}%,desc_en.ilike.%${keyword}%,type.ilike.%${keyword}%,country.ilike.%${keyword}%`); }
  const { count, error } = await q; if (error) throw error; return count || 0;
}

export async function getInvestorByOwner(ownerId: string) {
  const { data, error } = await supabase.from('investors').select('*').eq('owner_id', ownerId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function getInvestorByCode(code: string): Promise<any | null> {
  const { data, error } = await supabase.from('investors').select(investorPublicSelect as string).eq('code', code).eq('visible', true).eq('status', 'active').maybeSingle();
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

export async function createSignupBundle(payload: {
  userId: string;
  email: string;
  role: 'business' | 'investor' | 'affiliate';
  profile: any;
  business?: any | null;
  investor?: any | null;
  payment: any;
}) {
  const { data, error } = await supabase.rpc('create_signup_bundle', {
    user_uuid: payload.userId,
    user_email: payload.email,
    role_text: payload.role,
    profile_payload: payload.profile || {},
    business_payload: payload.business || null,
    investor_payload: payload.investor || null,
    payment_payload: payload.payment || {}
  });
  if (error) throw error;
  return data;
}

export async function createBusinessFromProfile(ownerId: string, payload: any) {
  const criteria = await getQualityCriteria().catch(() => []);
  const quality = computeBusinessQuality(payload, criteria);
  const { data, error } = await supabase.from('businesses').insert({
    ...payload,
    public_code: payload.public_code || makePublicCode('D68'),
    owner_id: ownerId,
    quality_score: quality,
    public_snapshot_json: null,
    pending_changes_json: payload,
    status: 'pending_admin_review',
    visible: false
  }).select().single();
  if (error) throw error;
  return data;
}

export async function approveBusinessPublicSnapshot(businessId: string, snapshot: any) {
  const normalized = { ...snapshot, approved_at: new Date().toISOString() };
  const rpc = await supabase.rpc('approve_business_public_snapshot', { business_uuid: businessId, snapshot: normalized });
  if (!rpc.error) return rpc.data;
  const fallback = {
    public_snapshot_json: normalized,
    title_vi: normalized.title_vi,
    title_en: normalized.title_en,
    description_vi: normalized.description_vi,
    description_en: normalized.description_en,
    highlights_vi: normalized.highlights_vi,
    highlights_en: normalized.highlights_en,
    investment_reason_vi: normalized.investment_reason_vi,
    investment_reason_en: normalized.investment_reason_en,
    industry: normalized.industry,
    deal_type: normalized.deal_type,
    city: normalized.city,
    country_iso2: normalized.country_iso2,
    revenue_2025: Number(normalized.revenue_2025 || 0),
    revenue_currency: normalized.revenue_currency || 'VND',
    ebitda_margin: Number(normalized.ebitda_margin || 0),
    ask_amount: Number(normalized.ask_amount || 0),
    ask_currency: normalized.ask_currency || normalized.revenue_currency || 'VND',
    stake_pct: Number(normalized.stake_pct || 0),
    quality_score: Number(normalized.quality_score || 0),
    data_confidence: Number(normalized.data_confidence || 0),
    hero_image_url: normalized.hero_image_url || normalized.image_url || null,
    image_url: normalized.image_url || normalized.hero_image_url || null,
    visible: true,
    status: 'active',
    pending_changes_json: null,
    last_approved_at: new Date().toISOString(),
    public_version: normalized.public_version
  };
  const { data, error } = await supabase.from('businesses').update(fallback).eq('id', businessId).select().single();
  if (error) throw error;
  return data;
}

function isDuplicateStorageUploadError(error: any) {
  const message = String(error?.message || error || '').toLowerCase();
  const status = Number(error?.statusCode || error?.status || 0);
  return status === 409 || message.includes('already exists') || message.includes('duplicate');
}

export async function uploadBusinessFile(
  businessId: string,
  ownerId: string,
  file: File,
  category = 'financials',
  privacy = 'locked',
  displayName = '',
  clientUploadId = '',
) {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const stableId = String(clientUploadId || '').replace(/[^a-zA-Z0-9_-]/g, '');
  const path = stableId
    ? `${businessId}/signup/${stableId}-${safeName}`
    : `${businessId}/${Date.now()}-${safeName}`;

  const { error: upErr } = await supabase.storage
    .from('business-files-private')
    .upload(path, file, { upsert: false });

  if (upErr && !(stableId && isDuplicateStorageUploadError(upErr))) {
    throw upErr;
  }

  const payload = {
    business_id: businessId,
    owner_id: ownerId,
    file_name: file.name,
    display_name: displayName || file.name,
    file_path: path,
    file_type: file.type,
    size_bytes: file.size,
    category,
    privacy_level: privacy,
    public_visible: false,
    client_upload_id: stableId || null,
  };

  const query = stableId
    ? supabase
        .from('business_files')
        .upsert(payload, { onConflict: 'client_upload_id' })
        .select()
        .single()
    : supabase.from('business_files').insert(payload).select().single();

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function updateBusinessFile(fileId: string, patch: any) {
  const { data, error } = await supabase.from('business_files').update(patch).eq('id', fileId).select().single();
  if (error) throw error;
  return data;
}

export async function deleteBusinessFile(row: any) {
  const path = row?.file_path;
  if (path) await supabase.storage.from('business-files-private').remove([path]).catch(() => undefined);
  const { error } = await supabase.from('business_files').delete().eq('id', row.id);
  if (error) throw error;
}

export async function uploadBusinessImage(
  businessId: string,
  ownerId: string,
  file: File,
  title = '',
  clientUploadId = '',
) {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const stableId = String(clientUploadId || '').replace(/[^a-zA-Z0-9_-]/g, '');
  const path = stableId
    ? `${businessId}/signup/${stableId}-${safeName}`
    : `${businessId}/${Date.now()}-${safeName}`;

  const { error: upErr } = await supabase.storage
    .from('business-images-public')
    .upload(path, file, { upsert: false });

  if (upErr && !(stableId && isDuplicateStorageUploadError(upErr))) {
    throw upErr;
  }

  const { data: pub } = supabase.storage
    .from('business-images-public')
    .getPublicUrl(path);

  const payload = {
    business_id: businessId,
    owner_id: ownerId,
    title,
    display_title: title,
    image_path: path,
    public_url: pub.publicUrl,
    public_visible: false,
    is_sanitized: false,
    is_hero: false,
    client_upload_id: stableId || null,
  };

  const query = stableId
    ? supabase
        .from('business_images')
        .upsert(payload, { onConflict: 'client_upload_id' })
        .select()
        .single()
    : supabase.from('business_images').insert(payload).select().single();

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function updateBusinessImage(imageId: string, patch: any) {
  const { data, error } = await supabase.from('business_images').update(patch).eq('id', imageId).select().single();
  if (error) throw error;
  return data;
}

export async function deleteBusinessImage(row: any) {
  const path = row?.image_path;
  if (path) await supabase.storage.from('business-images-public').remove([path]).catch(() => undefined);
  const { error } = await supabase.from('business_images').delete().eq('id', row.id);
  if (error) throw error;
}

export async function createInvestorForOwner(ownerId: string, payload: any) {
  const { data, error } = await supabase.from('investors').insert({ ...payload, owner_id: ownerId, status: 'pending_admin_review', visible: false }).select().single();
  if (error) throw error;
  return data;
}

export async function submitBusinessProposal(businessId: string, investorId: string, message = '') {
  const rpc = await supabase.rpc('submit_business_proposal', { business_uuid: businessId, investor_uuid: investorId, proposal_note: message });
  if (!rpc.error) return rpc.data;
  const { data, error } = await supabase.from('proposals').insert({ business_id: businessId, investor_id: investorId, message, status: 'sent' }).select().single();
  if (error) throw error;
  return data;
}

// Legacy helper retained only for local seed/admin scripts. Public pages must not call this.
export async function fallbackSeedBusinesses() {
  return seedBusinesses.map((b) => ({ ...b, id: b.username, status: 'active', visible: true }));
}
