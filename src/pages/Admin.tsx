import { FormEvent, useEffect, useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { AdminBusinessAssets } from '../components/admin/AdminBusinessAssets';
import { AdminNumberInput } from '../components/admin/AdminNumberInput';
import { IndustryTagPicker } from '../components/investor/IndustryTagPicker';
import { parseFormattedNumber } from '../lib/numberFormat';
import { supabase } from '../lib/supabase';
import { proposalStatusLabel, updateProposalStatus, type ProposalStatus } from '../lib/proposals';
import { AdminBannerManager } from '../components/SiteBanners';
import { industryOptions, industryKeyFromLabel } from '../lib/industryTaxonomy';
import { businessProposalQuotaForPlan } from '../lib/businessPlans';

type AdminTab = 'overview' | 'payments' | 'proposals' | 'banners' | 'businesses' | 'business_review' | 'assets' | 'investors' | 'promos' | 'requests' | 'leads' | 'logs' | 'settings';

type Row = Record<string, any>;

const pathTabs: Record<string, AdminTab> = {
  '': 'overview', overview: 'overview', payments: 'payments', approvals: 'payments', proposals: 'proposals', banners: 'banners', banner: 'banners', businesses: 'businesses',
  'business-review': 'business_review', assets: 'assets', investors: 'investors', promo: 'promos', promos: 'promos',
  'data-requests': 'requests', requests: 'requests', leads: 'leads', 'market-partners': 'leads', contacts: 'leads',
  audit: 'logs', logs: 'logs', settings: 'settings'
};

const tabs: { id: AdminTab; label: string; icon: string; href: string }[] = [
  { id: 'overview', label: 'Tổng quan', icon: '📊', href: '/admin' },
  { id: 'payments', label: 'Thanh toán', icon: '💳', href: '/admin/payments' },
  { id: 'proposals', label: 'Proposal', icon: '📨', href: '/admin/proposals' },
  { id: 'banners', label: 'Banner', icon: '🖼️', href: '/admin/banners' },
  { id: 'business_review', label: 'Duyệt public DN', icon: '✅', href: '/admin/business-review' },
  { id: 'businesses', label: 'Doanh nghiệp', icon: '🏢', href: '/admin/businesses' },
  { id: 'assets', label: 'Ảnh/File DN', icon: '🖼️', href: '/admin/assets' },
  { id: 'investors', label: 'Nhà đầu tư', icon: '📈', href: '/admin/investors' },
  { id: 'promos', label: 'Mã KM', icon: '🎟️', href: '/admin/promo' },
  { id: 'requests', label: 'Yêu cầu data', icon: '📂', href: '/admin/data-requests' },
  { id: 'leads', label: 'Liên hệ/Đối tác', icon: '📨', href: '/admin/leads' },
  { id: 'logs', label: 'Audit', icon: '🧾', href: '/admin/audit' },
  { id: 'settings', label: 'Cài đặt', icon: '⚙️', href: '/admin/settings' }
];

function resolveTab(pathname: string): AdminTab {
  const suffix = pathname.replace('/admin', '').replace(/^\//, '').split('/')[0];
  return pathTabs[suffix] || 'overview';
}
function text(v: any) { return String(v ?? '').trim(); }
function lines(raw: any) { if (Array.isArray(raw)) return raw.join('\n'); return String(raw || ''); }
function arrFromText(raw: any) { if (Array.isArray(raw)) return raw.map(String).filter(Boolean); return String(raw || '').split(/[;,\n]/).map((x) => x.trim()).filter(Boolean); }
function sourceOf(b: Row) { return { ...b, ...(b.pending_changes_json && typeof b.pending_changes_json === 'object' ? b.pending_changes_json : {}) }; }
function publicOf(b: Row) { return b.public_snapshot_json && typeof b.public_snapshot_json === 'object' ? b.public_snapshot_json : b; }
function autoEn(vi: string) {
  return text(vi).replace(/Doanh nghiệp/gi, 'Business').replace(/Công ty/gi, 'Company').replace(/Gọi vốn/gi, 'Fundraising').replace(/Bán/gi, 'Sale').replace(/Chuyển nhượng/gi, 'Transfer').replace(/Nhà đầu tư/gi, 'Investor').replace(/Sản xuất/gi, 'Manufacturing').replace(/Công nghệ/gi, 'Technology').replace(/Y tế/gi, 'Healthcare').replace(/Thủy sản/gi, 'Seafood');
}

const investorTypeFilterOptions = [
  { value: 'Nhà đầu tư cá nhân', label: 'Nhà đầu tư cá nhân' },
  { value: 'VC', label: 'Quỹ đầu tư mạo hiểm' },
  { value: 'PE', label: 'Quỹ đầu tư tư nhân' },
  { value: 'Institutional', label: 'Nhà đầu tư tổ chức' },
  { value: 'Corporate/Strategic', label: 'Nhà đầu tư chiến lược' },
  { value: 'Family Office', label: 'Văn phòng gia đình' },
  { value: 'Lender/Debt', label: 'Tổ chức cho vay / Nợ' }
];
const investorCountryFilterOptions = [
  ['VN', 'Việt Nam'], ['US', 'Mỹ'], ['SG', 'Singapore'], ['JP', 'Nhật Bản'], ['KR', 'Hàn Quốc'],
  ['IN', 'Ấn Độ'], ['HK', 'Hồng Kông'], ['CN', 'Trung Quốc'], ['AU', 'Úc'], ['CA', 'Canada'],
  ['DE', 'Đức'], ['GB', 'Anh'], ['AE', 'UAE'], ['ID', 'Indonesia'], ['TH', 'Thái Lan'],
  ['MY', 'Malaysia'], ['PH', 'Philippines'], ['BR', 'Brazil'], ['IL', 'Israel']
];
function investorTargetCountriesAdmin(i: Row): string[] {
  const criteria = i.criteria && typeof i.criteria === 'object' ? i.criteria : {};
  const raw = Array.isArray(criteria.targetCountries)
    ? criteria.targetCountries
    : Array.isArray(criteria.targetCountriesCache)
      ? criteria.targetCountriesCache
      : Array.isArray(criteria.preferredCountries)
        ? criteria.preferredCountries
        : [];
  const values = raw.length ? raw : [i.country_iso2 || i.country].filter(Boolean);
  return Array.from(new Set(values.map((x: any) => String(x || '').trim().toUpperCase()).filter(Boolean)));
}
function investorIndustryMatchesAdmin(i: Row, rawIndustry: string) {
  const wantedKey = industryKeyFromLabel(rawIndustry);
  if (!wantedKey) return true;
  const criteria = i.criteria && typeof i.criteria === 'object' ? i.criteria : {};
  const values = [...arrFromText(i.industries), ...arrFromText(criteria.sectors)];
  return values.some((value) => industryKeyFromLabel(value) === wantedKey);
}
function investorNeedsReview(i: Row) {
  return ['draft', 'payment_pending', 'pending_admin_review'].includes(String(i.status || '')) || !!i.privacy?.pending_profile_changes;
}

function objectOf(value: any) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}
function hasOwn(obj: any, key: string) {
  return Object.prototype.hasOwnProperty.call(objectOf(obj), key);
}
function comparable(value: any) {
  if (Array.isArray(value)) return value.map((x) => String(x ?? '').trim()).filter(Boolean).join('\n');
  if (value && typeof value === 'object') return JSON.stringify(value);
  return String(value ?? '').trim();
}
function changedAny(pending: any, approved: any, keys: string[]) {
  const p = objectOf(pending);
  const a = objectOf(approved);
  return keys.some((key) => hasOwn(p, key) && comparable(p[key]) !== comparable(a[key]));
}
function assetReviewState(row: Row) {
  const note = String(row.admin_note || '').toLowerCase();
  return {
    note,
    reviewed: note.includes('admin reviewed') || note.includes('approved') || note.includes('rejected') || note.includes('không public') || note.includes('khong public'),
    userSubmitted: note.includes('user') || note.includes('pending') || note.includes('review required') || note.includes('admin review remains required')
  };
}
function isPendingBusinessFile(row: Row) {
  const state = assetReviewState(row);
  if (state.reviewed) return false;
  const privacy = String(row.privacy_level || '').toLowerCase();
  // New uploaded files are usually locked/private. They remain pending until Admin reviews them.
  return state.userSubmitted || row.public_visible !== true || privacy.includes('locked');
}
function isPendingBusinessImage(row: Row) {
  const state = assetReviewState(row);
  if (state.reviewed) return false;
  // New images remain pending until Admin reviews/sanitizes or intentionally hides/rejects them.
  return state.userSubmitted || row.public_visible !== true || row.is_sanitized !== true;
}

function businessReviewSections(b: Row, files: Row[] = [], images: Row[] = []) {
  const pending = objectOf(b.pending_changes_json);
  const approved = objectOf(b.public_snapshot_json);
  const labels: string[] = [];
  if (changedAny(pending, approved, ['description_vi','description_en','investment_reason_vi','investment_reason_en'])) labels.push('Giới thiệu');
  if (changedAny(pending, approved, ['highlights_vi','highlights_en'])) labels.push('Điểm nổi bật');
  if (changedAny(pending, approved, ['title_vi','title_en','industry','deal_type','city','country_iso2','revenue_2025','revenue_currency','ebitda_margin','ask_amount','ask_currency','stake_pct','data_confidence','hero_image_url','image_url'])) labels.push('Thông tin giao dịch');
  if (images.some((img) => String(img.business_id) === String(b.id) && isPendingBusinessImage(img))) labels.push('Hình ảnh');
  if (files.some((file) => String(file.business_id) === String(b.id) && isPendingBusinessFile(file))) labels.push('Files tài liệu');
  if (!labels.length && Object.keys(pending).length) labels.push('Thông tin doanh nghiệp');
  return Array.from(new Set(labels));
}
function businessNeedsReview(b: Row, files: Row[] = [], images: Row[] = []) {
  return b.status === 'pending_admin_review'
    || b.moderation_status === 'pending_admin_review'
    || !!b.pending_changes_json
    || !b.public_snapshot_json
    || businessReviewSections(b, files, images).length > 0;
}

function dateMs(value: any) {
  const ms = new Date(value || 0).getTime();
  return Number.isFinite(ms) ? ms : 0;
}
function businessPrivateTitle(b: Row) {
  return String(b.company_name_private || b.title_vi || b.title_en || b.public_code || b.slug || b.id || 'Business').trim();
}
function businessPrimaryIndustry(b: Row) {
  const src = sourceOf(b);
  return String(src.industry || b.industry || '').split(';')[0].trim() || 'Đang cập nhật';
}
function businessPlanLabel(b: Row) {
  const plan = String(b.plan || 'standard').toLowerCase();
  if (plan.includes('featured') || plan.includes('priority') || plan.includes('ưu')) return 'Ưu tiên';
  return 'Thường';
}
function hasPendingPaymentForBusiness(b: Row, payments: Row[] = []) {
  return payments.some((p) => String(p.business_id || '') === String(b.id) && ['pending','payment_pending','new'].includes(String(p.status || '').toLowerCase()));
}
function businessActivityMs(b: Row, files: Row[] = [], images: Row[] = [], payments: Row[] = []) {
  const assetTimes = [
    ...files.filter((x) => String(x.business_id) === String(b.id)).map((x) => dateMs(x.updated_at || x.created_at)),
    ...images.filter((x) => String(x.business_id) === String(b.id)).map((x) => dateMs(x.updated_at || x.created_at)),
    ...payments.filter((x) => String(x.business_id) === String(b.id)).map((x) => dateMs(x.updated_at || x.created_at)),
  ];
  return Math.max(dateMs(b.pending_submitted_at), dateMs(b.updated_at), dateMs(b.created_at), ...assetTimes, 0);
}
function businessAdminStatusLabel(b: Row, files: Row[] = [], images: Row[] = [], payments: Row[] = []) {
  if (hasPendingPaymentForBusiness(b, payments)) return { label: 'Chờ thanh toán', cls: 'warn' };
  if (!b.public_snapshot_json || String(b.status || '') === 'pending_admin_review' || String(b.moderation_status || '') === 'pending_admin_review') return { label: 'Mới/chờ duyệt', cls: 'warn' };
  if (businessReviewSections(b, files, images).length || b.pending_changes_json) return { label: 'Có thay đổi', cls: 'warn' };
  if (b.visible && String(b.status || '') === 'active') return { label: 'Đang hiển thị', cls: 'ok' };
  if (!b.visible || String(b.status || '') === 'hidden') return { label: 'Đang ẩn', cls: 'err' };
  return { label: String(b.status || 'Đang cập nhật'), cls: 'blue' };
}
function businessMatchesAdminStatus(b: Row, filter: string, payments: Row[] = [], files: Row[] = [], images: Row[] = []) {
  if (!filter) return true;
  if (filter === 'new_pending') return !b.public_snapshot_json || String(b.status || '') === 'pending_admin_review' || String(b.moderation_status || '') === 'pending_admin_review';
  if (filter === 'updated_pending') return !!b.pending_changes_json || businessReviewSections(b, files, images).length > 0;
  if (filter === 'visible') return !!b.visible && String(b.status || '') === 'active';
  if (filter === 'hidden') return !b.visible || String(b.status || '') === 'hidden';
  if (filter === 'payment_pending') return hasPendingPaymentForBusiness(b, payments);
  return true;
}
function businessReviewWarningText(b: Row, files: Row[] = [], images: Row[] = []) {
  const sections = businessReviewSections(b, files, images);
  return sections.length ? `Doanh nghiệp vừa sửa ${sections.join(', ')}, cần kiểm tra và duyệt.` : '';
}
function paymentAmountLabel(row: Row) {
  const payload = objectOf(row.payload);
  const price = objectOf(payload.price);
  const amount = price.total ?? payload.total ?? payload.amount ?? row.amount ?? '';
  const currency = price.currency || payload.currency || row.currency || '';
  return `${amount || '—'} ${currency || ''}`.trim();
}

const INVESTOR_PAGE_SIZE = 30;

function countryLabelAdmin(raw: any) {
  const value = String(raw || '').trim();
  if (!value) return '—';
  const upper = value.toUpperCase();
  const match = investorCountryFilterOptions.find(([code, label]) => code === upper || label.toLowerCase() === value.toLowerCase());
  return match ? match[1] : value;
}
function investorOfficeCountryCodeAdmin(i: Row) {
  return String(i.country_iso2 || i.country || '').trim().toUpperCase();
}
function investorOfficeCountryLabelAdmin(i: Row) {
  return countryLabelAdmin(i.country_iso2 || i.country);
}
function investorTargetCountryLabelsAdmin(i: Row) {
  return investorTargetCountriesAdmin(i).map(countryLabelAdmin);
}


export default function Admin() {
  const { profile, loading } = useAuth();
  const location = useLocation();
  const [tab, setTab] = useState<AdminTab>(() => resolveTab(location.pathname));
  const [businesses, setBusinesses] = useState<Row[]>([]);
  const [investors, setInvestors] = useState<Row[]>([]);
  const [profiles, setProfiles] = useState<Row[]>([]);
  const [promos, setPromos] = useState<Row[]>([]);
  const [requests, setRequests] = useState<Row[]>([]);
  const [proposals, setProposals] = useState<Row[]>([]);
  const [payments, setPayments] = useState<Row[]>([]);
  const [logs, setLogs] = useState<Row[]>([]);
  const [contactMessages, setContactMessages] = useState<Row[]>([]);
  const [partnerLeads, setPartnerLeads] = useState<Row[]>([]);
  const [businessFiles, setBusinessFiles] = useState<Row[]>([]);
  const [businessImages, setBusinessImages] = useState<Row[]>([]);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState('');
  const [investorVisibilityFilter, setInvestorVisibilityFilter] = useState('');
  const [investorTypeFilter, setInvestorTypeFilter] = useState('');
  const [investorOfficeCountryFilter, setInvestorOfficeCountryFilter] = useState('');
  const [investorCountryFilter, setInvestorCountryFilter] = useState('');
  const [investorIndustryFilter, setInvestorIndustryFilter] = useState('');
  const [investorPage, setInvestorPage] = useState(1);
  const [businessStatusFilter, setBusinessStatusFilter] = useState('');
  const [businessIndustryFilter, setBusinessIndustryFilter] = useState('');

  useEffect(() => setTab(resolveTab(location.pathname)), [location.pathname]);

  async function load() {
    if (profile?.role !== 'admin') return;
    setBusy(true); setError('');
    try {
      const [bizRes, bizFilesRes, bizImagesRes, invRes, profRes, promoRes, reqRes, propRes, payRes, logRes, cmRes, leadRes] = await Promise.all([
        supabase.from('businesses').select('*, business_files(count), business_images(count)').order('created_at', { ascending: false }).limit(2000),
        supabase.from('business_files').select('id,business_id,display_name,file_name,privacy_level,public_visible,admin_note,created_at,updated_at').order('created_at', { ascending: false }).limit(2000),
        supabase.from('business_images').select('id,business_id,title,display_title,public_visible,is_sanitized,is_hero,admin_note,created_at,updated_at').order('created_at', { ascending: false }).limit(2000),
        supabase.from('investors').select('*').order('created_at', { ascending: false }).limit(2000),
        supabase.from('profiles').select('id,role,username,display_name,email,country_iso2,language_code,timezone,phone_country_iso2,phone,status,dashboard_login_enabled,created_at,updated_at').order('created_at', { ascending: false }).limit(2000),
        supabase.from('promo_codes').select('*').order('created_at', { ascending: false }).limit(500),
        supabase.from('request_data').select('*, businesses(title_vi,title_en,public_code,slug), investors(title_en,title_vi,code,type)').order('created_at', { ascending: false }).limit(500),
        supabase.from('proposals').select('id,business_id,investor_id,message,status,sent_at,updated_at,businesses(id,slug,company_name_private,title_vi,title_en,public_code),investors(id,code,private_name,title_vi,title_en,private_email)').order('sent_at', { ascending: false }).limit(1000),
        supabase.from('payment_orders').select('*').order('created_at', { ascending: false }).limit(500),
        supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(120),
        supabase.from('contact_messages').select('*').order('created_at', { ascending: false }).limit(300),
        supabase.from('partner_leads').select('*').order('created_at', { ascending: false }).limit(300)
      ]);
      setBusinesses(bizRes.data || []);
      setBusinessFiles(bizFilesRes.data || []);
      setBusinessImages(bizImagesRes.data || []);
      setInvestors(invRes.data || []);
      setProfiles(profRes.data || []);
      setPromos(promoRes.data || []);
      setRequests(reqRes.data || []);
      setProposals(propRes.data || []);
      setPayments(payRes.data || []);
      setLogs(logRes.data || []);
      setContactMessages(cmRes.data || []);
      setPartnerLeads(leadRes.data || []);
      const firstErr = bizRes.error || bizFilesRes.error || bizImagesRes.error || invRes.error || profRes.error || promoRes.error || reqRes.error || propRes.error || payRes.error || logRes.error || cmRes.error || leadRes.error;
      if (firstErr) setError(firstErr.message);
    } catch (e: any) { setError(e?.message || 'Could not load admin data.'); }
    finally { setBusy(false); }
  }
  useEffect(() => { if (profile?.role === 'admin') load(); }, [profile?.role]);

  useEffect(() => {
    if (profile?.role !== 'admin') return;

    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') load();
    };

    window.addEventListener('focus', refreshWhenVisible);
    document.addEventListener('visibilitychange', refreshWhenVisible);

    const channel = supabase
      .channel('deals68-admin-business-flow')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'businesses' },
        () => load(),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'business_files' },
        () => load(),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'business_images' },
        () => load(),
      )
      .subscribe();

    return () => {
      window.removeEventListener('focus', refreshWhenVisible);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
      supabase.removeChannel(channel);
    };
  }, [profile?.role]);

  if (loading) return <section className="d68-admin-page"><div className="d68-admin-wrap"><div className="d68-admin-card">Loading admin...</div></div></section>;
  if (profile?.role !== 'admin') return <Navigate to="/login?next=/admin" replace />;

  const pendingBusinesses = businesses.filter((b) => businessNeedsReview(b, businessFiles, businessImages));
  const pendingInvestors = investors.filter(investorNeedsReview);
  const businessPathParts = location.pathname.replace(/^\/+|\/+$/g, '').split('/');
  const selectedBusinessKey = businessPathParts[0] === 'admin' && businessPathParts[1] === 'businesses' && businessPathParts[2] ? decodeURIComponent(businessPathParts[2]) : '';
  const selectedBusiness = selectedBusinessKey
    ? businesses.find((b) => [b.id, b.public_code, b.slug].map((x) => String(x || '')).includes(selectedBusinessKey))
    : null;
  const businessIndustryOptions = Array.from(new Set(businesses.map((b) => businessPrimaryIndustry(b)).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'vi'));
  const investorOfficeCountryOptions = Array.from(new Set(investors.map((i) => investorOfficeCountryCodeAdmin(i)).filter(Boolean))).sort((a, b) => countryLabelAdmin(a).localeCompare(countryLabelAdmin(b), 'vi'));
  const filteredBusinesses = businesses
    .filter((b) => {
      const src = sourceOf(b);
      const keyword = search.trim().toLowerCase();
      if (keyword && ![b.title_vi, b.title_en, b.company_name_private, b.public_code, b.slug, src.industry, b.industry, src.city, b.city, b.status, b.plan].some((v) => String(v || '').toLowerCase().includes(keyword))) return false;
      if (businessIndustryFilter && businessPrimaryIndustry(b) !== businessIndustryFilter) return false;
      if (!businessMatchesAdminStatus(b, businessStatusFilter, payments, businessFiles, businessImages)) return false;
      return true;
    })
    .sort((a, b) => businessActivityMs(b, businessFiles, businessImages, payments) - businessActivityMs(a, businessFiles, businessImages, payments));
  const filteredInvestors = investors
    .filter((i) => {
      const keyword = search.trim().toLowerCase();
      if (keyword && ![i.title_vi, i.title_en, i.private_name, i.private_email, i.code, i.type, i.country, i.country_iso2, i.status].some((v) => String(v || '').toLowerCase().includes(keyword))) return false;
      if (investorVisibilityFilter === 'visible' && !i.visible) return false;
      if (investorVisibilityFilter === 'hidden' && i.visible) return false;
      if (investorTypeFilter && i.type !== investorTypeFilter) return false;
      if (investorOfficeCountryFilter && investorOfficeCountryCodeAdmin(i) !== investorOfficeCountryFilter) return false;
      if (investorCountryFilter && !investorTargetCountriesAdmin(i).includes(investorCountryFilter)) return false;
      if (investorIndustryFilter && !investorIndustryMatchesAdmin(i, investorIndustryFilter)) return false;
      return true;
    })
    .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
  const investorPageCount = Math.max(1, Math.ceil(filteredInvestors.length / INVESTOR_PAGE_SIZE));
  const safeInvestorPage = Math.min(Math.max(1, investorPage), investorPageCount);
  const paginatedInvestors = filteredInvestors.slice((safeInvestorPage - 1) * INVESTOR_PAGE_SIZE, safeInvestorPage * INVESTOR_PAGE_SIZE);

  async function logAction(action: string, entity_type: string, entity_id: string, detail: any = {}) {
    try { await supabase.from('audit_logs').insert({ actor_id: profile.id, action, entity_type, entity_id, detail }); } catch { /* non-blocking */ }
  }
  async function markPayment(row: Row, status: string) {
    const wasConfirmed = String(row.status || '').toLowerCase() === 'confirmed';
    const { error: payErr } = await supabase.from('payment_orders').update({ status, updated_at: new Date().toISOString() }).eq('id', row.id);
    if (!payErr && status === 'confirmed' && !wasConfirmed) {
      if (row.profile_id || row.created_by) await supabase.from('profiles').update({ status: 'active', dashboard_login_enabled: true }).eq('id', row.profile_id || row.created_by);
      if (row.business_id) {
        const payload = row.payload && typeof row.payload === 'object' ? row.payload : {};
        const isUpgradeOrder = payload.orderType === 'business_service_upgrade';
        if (isUpgradeOrder) {
          const targetPlan = payload.businessPlan === 'featured' ? 'featured' : 'standard';
          const quotaAdd = Number(payload.proposalQuota || businessProposalQuotaForPlan(targetPlan));
          const { data: currentBiz } = await supabase.from('businesses').select('quota_total,plan').eq('id', row.business_id).maybeSingle();
          await supabase.from('businesses').update({
            plan: targetPlan,
            quota_total: Math.max(0, Number(currentBiz?.quota_total || 0)) + quotaAdd,
            updated_at: new Date().toISOString()
          }).eq('id', row.business_id);
        } else {
          await supabase.from('businesses').update({ status: 'pending_admin_review', visible: false }).eq('id', row.business_id);
        }
      }
      if (row.investor_id) await supabase.from('investors').update({ status: 'pending_admin_review', visible: false }).eq('id', row.investor_id);
      await logAction('confirm_payment_open_dashboard', 'payment_order', row.id, { profile_id: row.profile_id, business_id: row.business_id, investor_id: row.investor_id });
    }
    setError(payErr?.message || ''); setMsg(payErr ? '' : 'Payment updated. Dashboard can be tested if profile is active.'); load();
  }
  async function toggleBusiness(b: Row) {
    const nextVisible = !b.visible;
    const { error: err } = await supabase.from('businesses').update({ visible: nextVisible, status: nextVisible ? 'active' : 'hidden' }).eq('id', b.id);
    if (!err) await logAction(nextVisible ? 'show_business' : 'hide_business', 'business', b.id, { public_code: b.public_code });
    setError(err?.message || ''); setMsg(err ? '' : 'Business visibility updated.'); load();
  }
  async function updateBusinessQuota(b: Row, nextQuota: number) {
    const quota = Math.max(0, Math.floor(Number(nextQuota || 0)));
    const { error: err } = await supabase.from('businesses').update({ quota_total: quota, updated_at: new Date().toISOString() }).eq('id', b.id);
    if (!err) await logAction('set_business_proposal_quota', 'business', b.id, { public_code: b.public_code, quota_total: quota });
    setError(err?.message || '');
    setMsg(err ? '' : `Đã cập nhật quota proposal cho ${b.public_code || b.company_name_private || 'business'}: ${quota}.`);
    load();
  }
  async function adjustBusinessQuota(b: Row, delta: number) {
    const current = Number(b.quota_total || 0);
    await updateBusinessQuota(b, current + Number(delta || 0));
  }
  async function setBusinessHomepage(b: Row, checked: boolean) {
    const { error: err } = await supabase
      .from('businesses')
      .update({
        show_on_homepage: checked,
        updated_at: new Date().toISOString(),
      })
      .eq('id', b.id);

    if (!err) {
      await logAction(
        checked ? 'show_business_on_homepage' : 'remove_business_from_homepage',
        'business',
        b.id,
        {
          public_code: b.public_code,
          show_on_homepage: checked,
        },
      );
    }

    setError(err?.message || '');
    setMsg(
      err
        ? ''
        : checked
          ? 'Đã chọn Business hiển thị tại Homepage.'
          : 'Đã bỏ Business khỏi nhóm được ưu tiên tại Homepage.',
    );
    load();
  }
  async function approveBusiness(e: FormEvent, b: Row) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget as HTMLFormElement);

    const adminSnapshot = {
      title_vi: text(fd.get('title_vi')),
      title_en:
        text(fd.get('title_en')) || autoEn(text(fd.get('title_vi'))),
      description_vi: text(fd.get('description_vi')),
      description_en:
        text(fd.get('description_en')) ||
        autoEn(text(fd.get('description_vi'))),
      highlights_vi: text(fd.get('highlights_vi')),
      highlights_en:
        text(fd.get('highlights_en')) ||
        autoEn(text(fd.get('highlights_vi'))),
      investment_reason_vi: text(fd.get('investment_reason_vi')),
      investment_reason_en:
        text(fd.get('investment_reason_en')) ||
        autoEn(text(fd.get('investment_reason_vi'))),
      industry: text(fd.get('industry')),
      industry_key: industryKeyFromLabel(text(fd.get('industry'))),
      deal_type: text(fd.get('deal_type')),
      city: text(fd.get('city')),
      country_iso2: text(fd.get('country_iso2')) || 'VN',
      revenue_month: parseFormattedNumber(fd.get('revenue_month')),
      revenue_2025: parseFormattedNumber(fd.get('revenue_2025')),
      revenue_currency: text(fd.get('revenue_currency')) || 'VND',
      ebitda_margin: parseFormattedNumber(fd.get('ebitda_margin'), true),
      growth_pct: parseFormattedNumber(fd.get('growth_pct'), true),
      ask_amount: parseFormattedNumber(fd.get('ask_amount')),
      ask_currency:
        text(fd.get('ask_currency')) ||
        text(fd.get('revenue_currency')) ||
        'VND',
      stake_pct: parseFormattedNumber(fd.get('stake_pct'), true),
      offer_amount: parseFormattedNumber(fd.get('ask_amount')),
      offer_stake_pct: parseFormattedNumber(fd.get('stake_pct'), true),
      quality_score: parseFormattedNumber(fd.get('quality_score')),
      quality_score_manual_override:
        fd.get('quality_score_manual_override') === 'on',
      data_confidence: parseFormattedNumber(fd.get('data_confidence')),
      hero_image_url: text(fd.get('hero_image_url')),
      image_url: text(fd.get('hero_image_url')),
      approved_at: new Date().toISOString(),
    };

    const { error: err } = await supabase.rpc(
      'approve_business_pending_changes',
      {
        business_uuid: b.id,
        admin_snapshot: adminSnapshot,
        expected_pending_submitted_at:
          b.pending_submitted_at || null,
      },
    );

    if (!err) {
      await logAction(
        'approve_business_pending_changes',
        'business',
        b.id,
        {
          public_code: b.public_code,
          pending_submitted_at: b.pending_submitted_at || null,
          admin_snapshot: adminSnapshot,
        },
      );
    }

    setError(err?.message || '');
    setMsg(
      err
        ? ''
        : 'Đã duyệt toàn bộ thay đổi Business, cập nhật Dashboard và public snapshot.',
    );
    load();
  }
  async function saveInvestor(e: FormEvent, i: Row, mode: 'save' | 'approve' = 'save') {
    e.preventDefault();
    const fd = new FormData(e.currentTarget as HTMLFormElement);
    const industries = arrFromText(fd.get('industries'));
    const dealTypes = arrFromText(fd.get('deal_types'));
    const targetCountries = arrFromText(fd.get('target_countries')).map((x) => x.toUpperCase());
    const pending = i.privacy?.pending_profile_changes && typeof i.privacy.pending_profile_changes === 'object' ? i.privacy.pending_profile_changes : {};
    const mergedCriteria = {
      ...(i.criteria && typeof i.criteria === 'object' ? i.criteria : {}),
      ...(mode === 'approve' && pending.criteria && typeof pending.criteria === 'object' ? pending.criteria : {}),
      sectors: industries,
      dealTypes,
      targetCountries,
      preferredCountries: targetCountries,
      targetCountriesCache: targetCountries
    };
    const patch: any = {
      title_en: text(fd.get('title_en')),
      title_vi: text(fd.get('title_vi')),
      desc_en: text(fd.get('desc_en')),
      desc_vi: text(fd.get('desc_vi')),
      type: text(fd.get('type')),
      country: text(fd.get('country')),
      country_iso2: text(fd.get('country_iso2')),
      region: text(fd.get('region')),
      industries,
      deal_types: dealTypes,
      stage: text(fd.get('stage')),
      ticket_min: parseFormattedNumber(fd.get('ticket_min')),
      ticket_max: parseFormattedNumber(fd.get('ticket_max')),
      criteria: mergedCriteria,
      verified: fd.get('verified') === 'on',
      admin_priority: fd.get('admin_priority') === 'on',
      private_name: text(fd.get('private_name')),
      private_website: text(fd.get('private_website')),
      private_email: text(fd.get('private_email')),
      private_phone: text(fd.get('private_phone')),
      updated_at: new Date().toISOString()
    };
    if (mode === 'approve') {
      const nextPrivacy = { ...(i.privacy || {}) };
      delete nextPrivacy.pending_profile_changes;
      delete nextPrivacy.pending_submitted_at;
      patch.privacy = nextPrivacy;
    }
    patch.visible = mode === 'approve' ? true : fd.get('visible') === 'on';
    patch.status = patch.visible ? 'active' : 'hidden';
    const { error: err } = await supabase.from('investors').update(patch).eq('id', i.id);
    if (!err) await logAction(mode === 'approve' ? 'approve_investor_public_profile' : 'save_investor', 'investor', i.id, { code: i.code, approved_pending: mode === 'approve' });
    setError(err?.message || '');
    setMsg(err ? '' : (mode === 'approve' ? 'Đã duyệt thay đổi investor và cập nhật public.' : 'Investor updated.'));
    load();
  }
  async function toggleInvestor(i: Row) {
    const nextVisible = !i.visible;
    const { error: err } = await supabase.from('investors').update({ visible: nextVisible, status: nextVisible ? 'active' : 'hidden' }).eq('id', i.id);
    if (!err) await logAction(nextVisible ? 'show_investor' : 'hide_investor', 'investor', i.id, { code: i.code });
    setError(err?.message || ''); setMsg(err ? '' : 'Investor visibility updated.'); load();
  }
  async function markRequest(r: Row, status: string) {
    const { error: err } = await supabase.from('request_data').update({ status }).eq('id', r.id);
    if (!err) await logAction('mark_data_request', 'request_data', r.id, { status });
    setError(err?.message || ''); setMsg(err ? '' : 'Request updated.'); load();
  }
  async function markProposal(row: Row, status: ProposalStatus) {
    try {
      await updateProposalStatus(row.id, status);
      await logAction('mark_proposal', 'proposal', row.id, { status });
      setError(''); setMsg('Đã cập nhật trạng thái Proposal.'); load();
    } catch (e: any) { setError(e?.message || 'Could not update proposal.'); setMsg(''); }
  }
  async function createPromo(e: FormEvent) {
    e.preventDefault(); const fd = new FormData(e.currentTarget as HTMLFormElement);
    const { error: err } = await supabase.from('promo_codes').insert({ code: String(fd.get('code') || '').toUpperCase(), description: fd.get('description'), role: fd.get('role'), discount_pct: Number(fd.get('discount_pct') || 0), quota_total: Number(fd.get('quota_total') || 0), starts_at: fd.get('starts_at') || new Date().toISOString(), ends_at: fd.get('ends_at') || null, active: true, created_by: profile.id });
    setError(err?.message || ''); setMsg(err ? '' : 'Promo created.'); load();
  }
  async function markLead(table: 'contact_messages' | 'partner_leads', row: Row, status: string) {
    const { error: err } = await supabase.from(table).update({ status, updated_at: new Date().toISOString() }).eq('id', row.id);
    if (!err) await logAction('mark_lead', table, row.id, { status });
    setError(err?.message || ''); setMsg(err ? '' : 'Lead updated.'); load();
  }

  return <section className="d68-admin-page">
    <header className="d68-admin-head"><div className="d68-admin-head__inner"><b className="d68-admin-head__title">Admin Panel</b></div></header>
    <div className="d68-admin-wrap"><div className="d68-admin-cols"><nav className="d68-admin-side">{tabs.map((item) => <Link key={item.id} to={item.href} onClick={() => setTab(item.id)} className={tab === item.id ? 'active' : ''}>{item.icon} {item.label}</Link>)}</nav><main>
      <div className="d68-admin-title"><div><h1>Deals68 Admin</h1><p>Admin duyệt thanh toán, public snapshot, ảnh/file, profile investor và lead tĩnh.</p></div><button onClick={load} className="d68-admin-btn">{busy ? 'Loading...' : 'Refresh'}</button></div>
      {msg ? <div className="d68-admin-notice ok">{msg}</div> : null}{error ? <div className="d68-admin-notice err">{error}</div> : null}
      <input className="d68-admin-input d68-admin-search" value={search} onChange={(e) => { setSearch(e.target.value); setInvestorPage(1); }} placeholder="Search businesses/investors/profiles..." />
      {tab === 'overview' && <Overview businesses={businesses} investors={investors} profiles={profiles} payments={payments} pendingBusinesses={pendingBusinesses} pendingInvestors={pendingInvestors} leads={contactMessages.length + partnerLeads.length}/>} 
      {tab === 'payments' && <Payments payments={payments} profiles={profiles} markPayment={markPayment} />}
      {tab === 'proposals' && <ProposalList proposals={proposals} markProposal={markProposal} />}
      {tab === 'banners' && <AdminBannerManager />}
      {tab === 'business_review' && <BusinessReviewList rows={pendingBusinesses} approveBusiness={approveBusiness} toggleBusiness={toggleBusiness} businessFiles={businessFiles} businessImages={businessImages} />}
      {tab === 'businesses' && (selectedBusinessKey
        ? (selectedBusiness
          ? <BusinessAdminDetail b={selectedBusiness} payments={payments} profiles={profiles} approveBusiness={approveBusiness} toggleBusiness={toggleBusiness} setBusinessHomepage={setBusinessHomepage} markPayment={markPayment} updateBusinessQuota={updateBusinessQuota} adjustBusinessQuota={adjustBusinessQuota} businessFiles={businessFiles} businessImages={businessImages} adminId={profile.id} onAssetsApproved={load} />
          : <Card><h3>Không tìm thấy doanh nghiệp</h3><p className="d68-admin-subtle">ID/Mã/slug: {selectedBusinessKey}</p><Link to="/admin/businesses" className="d68-admin-btn blue">← Quay lại danh sách</Link></Card>)
        : <BusinessAdminList rows={filteredBusinesses} allRows={businesses} pendingRows={pendingBusinesses} search={search} setSearch={setSearch} businessStatusFilter={businessStatusFilter} setBusinessStatusFilter={setBusinessStatusFilter} businessIndustryFilter={businessIndustryFilter} setBusinessIndustryFilter={setBusinessIndustryFilter} businessIndustryOptions={businessIndustryOptions} businessFiles={businessFiles} businessImages={businessImages} payments={payments} />)}
      {tab === 'assets' && <div>{filteredBusinesses.map((b) => <AssetEditor key={b.id} b={b} adminId={profile.id} onRefresh={load} />)}</div>}
      {tab === 'investors' && <>
        <Card>
          <div className="d68-admin-row-head">
            <div>
              <h3>Quản trị Nhà đầu tư</h3>
              <div className="d68-admin-subtle">Sắp xếp mới tạo lên đầu · Hiển thị {paginatedInvestors.length}/{filteredInvestors.length} kết quả · 30/trang</div>
            </div>
            {pendingInvestors.length ? <span className="d68-admin-badge warn">⚠️ {pendingInvestors.length} cần duyệt</span> : <span className="d68-admin-badge ok">Không có hồ sơ cần duyệt</span>}
          </div>
          {pendingInvestors.length ? <div className="d68-admin-notice warn">Có {pendingInvestors.length} tài khoản Investor mới tạo hoặc mới cập nhật thông tin cần Admin kiểm tra/duyệt.</div> : null}
          <div className="d68-admin-form4">
            <label>Trạng thái<select value={investorVisibilityFilter} onChange={(e) => { setInvestorVisibilityFilter(e.target.value); setInvestorPage(1); }} className="d68-admin-input"><option value="">Tất cả</option><option value="visible">Hiển thị</option><option value="hidden">Ẩn</option></select></label>
            <label>Quốc gia trụ sở<select value={investorOfficeCountryFilter} onChange={(e) => { setInvestorOfficeCountryFilter(e.target.value); setInvestorPage(1); }} className="d68-admin-input"><option value="">Tất cả quốc gia</option>{investorOfficeCountryOptions.map((code) => <option key={code} value={code}>{countryLabelAdmin(code)}</option>)}</select></label>
            <label>Thị trường quan tâm<select value={investorCountryFilter} onChange={(e) => { setInvestorCountryFilter(e.target.value); setInvestorPage(1); }} className="d68-admin-input"><option value="">Tất cả thị trường</option>{investorCountryFilterOptions.map(([code, label]) => <option key={code} value={code}>{label}</option>)}</select></label>
            <label>Ngành quan tâm<select value={investorIndustryFilter} onChange={(e) => { setInvestorIndustryFilter(e.target.value); setInvestorPage(1); }} className="d68-admin-input"><option value="">Tất cả</option>{industryOptions.map((x) => <option key={x.key} value={x.key}>{x.vi}</option>)}</select></label>
          </div>
        </Card>
        <div>{paginatedInvestors.map((i) => <InvestorEditor key={i.id} i={i} profiles={profiles} onSave={saveInvestor} onToggle={toggleInvestor} />)}</div>
        <AdminPagination page={safeInvestorPage} pageCount={investorPageCount} onPage={setInvestorPage} />
        {!filteredInvestors.length ? <Empty text="Không có nhà đầu tư phù hợp bộ lọc."/> : null}
      </>}
      {tab === 'promos' && <Promos promos={promos} createPromo={createPromo} />}
      {tab === 'requests' && <Requests requests={requests} markRequest={markRequest} />}
      {tab === 'leads' && <Leads contactMessages={contactMessages} partnerLeads={partnerLeads} markLead={markLead} />}
      {tab === 'logs' && <Logs logs={logs} />}
      {tab === 'settings' && <Settings />}
    </main></div></div>
  </section>;
}

function Card({ children }: { children: React.ReactNode }) { return <div className="d68-admin-card">{children}</div>; }
function Empty({ text }: { text: string }) { return <div className="d68-admin-empty">{text}</div>; }
function Metric({ label, value, color = '#0F2A4A' }: { label: string; value: string; color?: string }) { return <Card><div className="d68-admin-metric-label">{label}</div><div className="d68-admin-metric-value" style={{ color }}>{value}</div></Card>; }
function AdminPagination({ page, pageCount, onPage }: { page: number; pageCount: number; onPage: (page: number) => void }) {
  if (pageCount <= 1) return null;
  return <div className="d68-admin-pagination">
    <button className="d68-admin-btn light" disabled={page <= 1} onClick={() => onPage(Math.max(1, page - 1))}>&lt; Trang trước</button>
    <span>{page} / {pageCount}</span>
    <button className="d68-admin-btn light" disabled={page >= pageCount} onClick={() => onPage(Math.min(pageCount, page + 1))}>Trang tiếp &gt;</button>
  </div>;
}
function Overview({ businesses, investors, profiles, payments, pendingBusinesses, pendingInvestors, leads }: any) { return <><div className="d68-admin-grid4"><Metric label="Businesses" value={String(businesses.length)} color="#1596cc"/><Metric label="Investors" value={String(investors.length)} color="#B8860B"/><Metric label="Pending DN" value={String(pendingBusinesses.length)} color="#DC2626"/><Metric label="Leads" value={String(leads || 0)} color="#16A34A"/></div><Card><h3>Baseline workflow test</h3><ol className="d68-admin-steps"><li>User đăng ký Business/Investor → tạo profile + listing ẩn + payment_order pending.</li><li>Admin xác nhận payment → mở dashboard_login_enabled cho user.</li><li>Business tự sửa dashboard → pending_changes_json, public snapshot cũ vẫn giữ.</li><li>Admin duyệt snapshot → visible=true, status=active, public_snapshot_json cập nhật.</li><li>Investor tự sửa profile → lưu vào privacy.pending_profile_changes, public profile cũ không đổi; Admin duyệt mới public.</li></ol><p>Profiles: {profiles.length} · Payments: {payments.length} · Pending investors: {pendingInvestors.length}</p></Card></>; }
function ProposalList({ proposals, markProposal }: any) { return <Card><h3>Proposal Business → Investor</h3><div className="d68-admin-table-wrap"><table className="d68-admin-table"><thead><tr><th>Thời gian</th><th>Doanh nghiệp</th><th>Nhà đầu tư</th><th>Trạng thái</th><th>Action</th></tr></thead><tbody>{proposals.map((row: Row) => { const st = proposalStatusLabel(row.status, 'vi'); const b = row.businesses || {}; const i = row.investors || {}; return <tr key={row.id}><td>{new Date(row.sent_at || row.updated_at || Date.now()).toLocaleString('vi-VN')}</td><td>{b.slug ? <a href={`/businesses/${b.slug}`} target="_blank" rel="noreferrer"><b>{b.company_name_private || b.title_vi || b.title_en || b.public_code || row.business_id}</b></a> : <b>{b.company_name_private || b.title_vi || b.title_en || row.business_id}</b>}<br/><span className="d68-admin-badge warn">{b.public_code || 'Business'}</span></td><td>{i.code ? <a href={`/investors/${i.code}`} target="_blank" rel="noreferrer"><b>{i.private_name || i.title_vi || i.title_en || i.code}</b></a> : <b>{i.private_name || i.title_vi || i.title_en || row.investor_id}</b>}<br/><span>{i.private_email || i.code || 'Investor'}</span></td><td><span className={`d68-admin-badge ${st.cls === 'green' ? 'ok' : st.cls === 'red' ? 'err' : 'warn'}`}>{st.label}</span></td><td><div className="d68-admin-actions"><button className="d68-admin-btn green" onClick={() => markProposal(row, 'approved')}>Duyệt</button><button className="d68-admin-btn red" onClick={() => markProposal(row, 'declined')}>Từ chối</button><button className="d68-admin-btn blue" onClick={() => markProposal(row, 'connected')}>Connected</button></div></td></tr>; })}</tbody></table></div>{!proposals.length ? <Empty text="No proposals."/> : null}</Card>; }
function Payments({ payments, profiles, markPayment }: any) { return <Card><h3>Thanh toán / mở dashboard</h3>{payments.length ? <div className="d68-admin-table-wrap"><table className="d68-admin-table"><thead><tr><th>Order</th><th>Status</th><th>Profile</th><th>Amount</th><th>Action</th></tr></thead><tbody>{payments.map((p: Row) => { const prof = profiles.find((x: Row) => x.id === (p.profile_id || p.created_by)); const amount = p.payload?.price?.total || p.payload?.total || ''; const cur = p.payload?.price?.currency || p.payload?.currency || ''; return <tr key={p.id}><td><b>{p.title || p.id}</b><br/><span className="d68-admin-badge warn">{new Date(p.created_at).toLocaleString()}</span></td><td>{p.status}</td><td>{prof?.email || p.profile_id || p.created_by || '—'}<br/>{prof?.role}</td><td>{amount} {cur}</td><td><button className="d68-admin-btn green" onClick={() => markPayment(p, 'confirmed')}>Xác nhận thanh toán & mở dashboard</button> <button className="d68-admin-btn red" onClick={() => markPayment(p, 'rejected')}>Từ chối</button></td></tr>; })}</tbody></table></div> : <Empty text="No payment orders."/>}</Card>; }

function BusinessAdminList({ rows, allRows, pendingRows, search, setSearch, businessStatusFilter, setBusinessStatusFilter, businessIndustryFilter, setBusinessIndustryFilter, businessIndustryOptions, businessFiles, businessImages, payments }: any) {
  return <>
    <Card>
      <div className="d68-admin-row-head">
        <div>
          <h3>Quản trị Doanh nghiệp</h3>
          <div className="d68-admin-subtle">Sắp xếp DN mới cập nhật/cần duyệt lên đầu · Kết quả {rows.length}/{allRows.length}</div>
        </div>
        {pendingRows.length ? <span className="d68-admin-badge warn">⚠️ {pendingRows.length} DN cần duyệt</span> : <span className="d68-admin-badge ok">Không có DN cần duyệt</span>}
      </div>
      <div className="d68-admin-business-filters">
        <label>Tên DN / mã / lĩnh vực<input className="d68-admin-input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm tên DN, mã D68, lĩnh vực, địa phương..." /></label>
        <label>Lĩnh vực<select className="d68-admin-input" value={businessIndustryFilter} onChange={(e) => setBusinessIndustryFilter(e.target.value)}><option value="">Tất cả lĩnh vực</option>{businessIndustryOptions.map((x: string) => <option key={x} value={x}>{x}</option>)}</select></label>
        <label>Tình trạng<select className="d68-admin-input" value={businessStatusFilter} onChange={(e) => setBusinessStatusFilter(e.target.value)}><option value="">Tất cả</option><option value="new_pending">Mới chờ duyệt</option><option value="updated_pending">Có thay đổi chờ duyệt</option><option value="visible">Đang hiển thị</option><option value="hidden">Đang ẩn</option><option value="payment_pending">Chờ thanh toán</option></select></label>
      </div>
    </Card>
    <Card>
      <div className="d68-admin-table-wrap"><table className="d68-admin-table d68-admin-business-table">
        <thead><tr><th>Tên DN</th><th>Lĩnh vực</th><th>Địa phương</th><th>Gói dịch vụ</th><th>Tình trạng</th><th>Cảnh báo</th><th>Cập nhật</th><th>Thao tác</th></tr></thead>
        <tbody>{rows.map((b: Row) => {
          const src = sourceOf(b);
          const st = businessAdminStatusLabel(b, businessFiles, businessImages, payments);
          const warn = businessReviewWarningText(b, businessFiles, businessImages);
          return <tr key={b.id}>
            <td><b>{businessPrivateTitle(b)}</b><br/><span className="d68-admin-badge warn">{b.public_code || b.slug || 'Business'}</span></td>
            <td>{businessPrimaryIndustry(b)}</td>
            <td>{src.city || b.city || src.country_iso2 || b.country_iso2 || '—'}</td>
            <td>{businessPlanLabel(b)}<br/><span className="d68-admin-subtle">Quota {Number(b.quota_used || 0)}/{Number(b.quota_total || 0)}</span>{b.show_on_homepage ? <><br/><span className="d68-admin-badge ok">Homepage</span></> : null}</td>
            <td><span className={`d68-admin-badge ${st.cls}`}>{st.label}</span></td>
            <td>{warn ? <span className="d68-admin-badge warn">{warn}</span> : <span className="d68-admin-subtle">—</span>}</td>
            <td>{new Date(businessActivityMs(b, businessFiles, businessImages, payments)).toLocaleString('vi-VN')}</td>
            <td><div className="d68-admin-actions"><Link to={`/admin/businesses/${b.id}`} className="d68-admin-btn blue">Xem chi tiết DN</Link>{b.slug ? <a href={`/businesses/${b.slug}`} target="_blank" rel="noreferrer" className="d68-admin-btn blue d68-admin-public-btn">Public ↗</a> : null}</div></td>
          </tr>;
        })}</tbody>
      </table></div>
      {!rows.length ? <Empty text="Không có doanh nghiệp phù hợp bộ lọc."/> : null}
    </Card>
  </>;
}
function BusinessQuotaManager({ b, updateBusinessQuota, adjustBusinessQuota }: any) {
  const [quota, setQuota] = useState(Number(b.quota_total || 0));
  useEffect(() => { setQuota(Number(b.quota_total || 0)); }, [b.id, b.quota_total]);
  return <div className="d68-admin-quota-box">
    <div><b>Quota gửi proposal</b><span>Đã dùng {Number(b.quota_used || 0)} / Tổng quota {Number(b.quota_total || 0)}</span></div>
    <div className="d68-admin-quota-actions">
      <button type="button" className="d68-admin-btn" onClick={() => adjustBusinessQuota(b, -1)}>-1</button>
      <button type="button" className="d68-admin-btn" onClick={() => adjustBusinessQuota(b, 1)}>+1</button>
      <button type="button" className="d68-admin-btn" onClick={() => adjustBusinessQuota(b, 6)}>+6</button>
      <input className="d68-admin-input" type="number" min="0" value={quota} onChange={(e) => setQuota(Number(e.target.value || 0))} />
      <button type="button" className="d68-admin-btn green" onClick={() => updateBusinessQuota(b, quota)}>Lưu quota</button>
    </div>
    <p className="d68-admin-subtle">Dùng khi Business có mã giảm giá 100% hoặc cần quota thủ công, ví dụ đặt 6 proposal thay vì 50/80 mặc định.</p>
  </div>;
}
function BusinessPaymentPanel({ b, payments, profiles, markPayment, updateBusinessQuota, adjustBusinessQuota }: any) {
  const rows = payments.filter((p: Row) => String(p.business_id || '') === String(b.id));
  return <div className="d68-admin-detail-stack">
    <Card>
      <div className="d68-admin-grid4">
        <Metric label="Gói dịch vụ" value={businessPlanLabel(b)} color="#1596cc"/>
        <Metric label="Quota proposal" value={`${Number(b.quota_used || 0)} / ${Number(b.quota_total || 0)}`} color="#B8860B"/>
        <Metric label="Trạng thái" value={businessAdminStatusLabel(b, [], [], payments).label} color="#0F2A4A"/>
        <Metric label="Public" value={b.visible ? 'Đang hiển thị' : 'Đang ẩn'} color={b.visible ? '#16A34A' : '#DC2626'}/>
      </div>
      <BusinessQuotaManager b={b} updateBusinessQuota={updateBusinessQuota} adjustBusinessQuota={adjustBusinessQuota} />
    </Card>
    <Card>
      <h3>Lịch sử thanh toán</h3>
      {rows.length ? <div className="d68-admin-table-wrap"><table className="d68-admin-table"><thead><tr><th>Order</th><th>Status</th><th>Profile</th><th>Amount</th><th>Cập nhật</th><th>Action</th></tr></thead><tbody>{rows.map((p: Row) => { const prof = profiles.find((x: Row) => x.id === (p.profile_id || p.created_by)); return <tr key={p.id}><td><b>{p.title || p.id}</b><br/><span className="d68-admin-subtle">{p.payload?.orderType || p.payload?.businessPlan || 'payment'}</span></td><td><span className={`d68-admin-badge ${String(p.status).toLowerCase() === 'confirmed' ? 'ok' : 'warn'}`}>{p.status}</span></td><td>{prof?.email || p.profile_id || p.created_by || '—'}</td><td>{paymentAmountLabel(p)}</td><td>{new Date(p.updated_at || p.created_at || Date.now()).toLocaleString('vi-VN')}</td><td><div className="d68-admin-actions"><button className="d68-admin-btn green" onClick={() => markPayment(p, 'confirmed')}>Xác nhận</button><button className="d68-admin-btn red" onClick={() => markPayment(p, 'rejected')}>Từ chối</button></div></td></tr>; })}</tbody></table></div> : <Empty text="Business này chưa có payment order."/>}
    </Card>
  </div>;
}
function BusinessAdminDetail({ b, payments, profiles, approveBusiness, toggleBusiness, setBusinessHomepage, markPayment, updateBusinessQuota, adjustBusinessQuota, businessFiles, businessImages, adminId, onAssetsApproved }: any) {
  const [detailTab, setDetailTab] = useState<'payments' | 'info' | 'assets'>('info');
  const sections = businessReviewSections(b, businessFiles, businessImages);
  const status = businessAdminStatusLabel(b, businessFiles, businessImages, payments);
  return <div className="d68-admin-business-detail">
    <Card>
      <div className="d68-admin-row-head">
        <div>
          <Link to="/admin/businesses" className="d68-admin-subtle">← Quay lại danh sách business</Link>
          <h2>{businessPrivateTitle(b)}</h2>
          <div className="d68-admin-subtle">{b.public_code || 'D68'} · {businessPrimaryIndustry(b)} · {sourceOf(b).city || b.city || '—'} · public v{b.public_version || 0}</div>
        </div>
        <span className={`d68-admin-badge ${status.cls}`}>{status.label}</span>
      </div>
      <div className="d68-admin-notice">
        <label className="d68-admin-check">
          <input
            type="checkbox"
            checked={!!b.show_on_homepage}
            onChange={(e) => setBusinessHomepage(b, e.target.checked)}
          />
          <b>Hiển thị Homepage</b>
        </label>
        <span className="d68-admin-subtle">
          Business mới mặc định không được chọn. Nếu chọn trên 6 Business,
          Homepage lấy ngẫu nhiên 6; nếu chọn dưới 6, hệ thống bổ sung
          Business public khác cho đủ 6.
        </span>
      </div>
      {sections.length ? <div className="d68-admin-notice warn">Doanh nghiệp vừa sửa {sections.join(', ')}, cần kiểm tra và duyệt.</div> : null}
      <div className="d68-admin-detail-tabs">
        <button className={detailTab === 'payments' ? 'active' : ''} onClick={() => setDetailTab('payments')}>Thanh toán & Quota</button>
        <button className={detailTab === 'info' ? 'active' : ''} onClick={() => setDetailTab('info')}>Thông tin</button>
        <button className={detailTab === 'assets' ? 'active' : ''} onClick={() => setDetailTab('assets')}>Hình ảnh & Files</button>
      </div>
    </Card>
    {detailTab === 'payments' ? <BusinessPaymentPanel b={b} payments={payments} profiles={profiles} markPayment={markPayment} updateBusinessQuota={updateBusinessQuota} adjustBusinessQuota={adjustBusinessQuota} /> : null}
    {detailTab === 'info' ? <BusinessPublicEditor b={b} onApprove={approveBusiness} onToggle={toggleBusiness} businessFiles={businessFiles} businessImages={businessImages} /> : null}
    {detailTab === 'assets' ? <AssetEditor b={b} adminId={adminId} onRefresh={onAssetsApproved} /> : null}
  </div>;
}

function BusinessReviewList({ rows, approveBusiness, toggleBusiness, businessFiles = [], businessImages = [] }: any) {
  return <div>{rows.length ? rows.map((b: Row) => <BusinessPublicEditor key={b.id} b={b} onApprove={approveBusiness} onToggle={toggleBusiness} businessFiles={businessFiles} businessImages={businessImages} />) : <Empty text="No business pending review."/>}</div>;
}

function adminCompareValue(value: any, key: string) {
  if (value === null || value === undefined || value === '') return '—';

  if (
    [
      'revenue_month',
      'revenue_2025',
      'ask_amount',
      'offer_amount',
      'self_valuation',
    ].includes(key)
  ) {
    const number = Number(value || 0);
    return Number.isFinite(number)
      ? number.toLocaleString('vi-VN')
      : String(value);
  }

  if (typeof value === 'object') {
    return JSON.stringify(value, null, 2);
  }

  return String(value);
}

function BusinessPendingComparison({ b }: { b: Row }) {
  const pending = objectOf(b.pending_changes_json);
  const current = { ...b, ...publicOf(b) };

  const fields = [
    ['company_name_private', 'Tên doanh nghiệp thật'],
    ['industry', 'Ngành'],
    ['deal_type', 'Loại giao dịch'],
    ['city', 'Tỉnh/Thành phố'],
    ['description_vi', 'Tổng quan doanh nghiệp'],
    ['revenue_month', 'Doanh thu tháng'],
    ['revenue_2025', 'Doanh thu năm'],
    ['ebitda_margin', 'EBITDA (%)'],
    ['growth_pct', 'Tăng trưởng năm (%)'],
    ['ask_amount', 'Nhu cầu vốn/Giá chào'],
    ['stake_pct', 'Tỷ lệ cổ phần (%)'],
    ['highlights_vi', 'Điểm nổi bật'],
    ['investment_reason_vi', 'Lý do gọi vốn/chuyển nhượng'],
  ] as const;

  const changedRows = fields.filter(([key]) => {
    if (!hasOwn(pending, key)) return false;
    return JSON.stringify(pending[key]) !== JSON.stringify(current[key]);
  });

  if (!changedRows.length) return null;

  return (
    <div className="d68-admin-table-wrap">
      <table className="d68-admin-table">
        <thead>
          <tr>
            <th>Trường Business sửa</th>
            <th>Dữ liệu đang public/đã duyệt</th>
            <th>Dữ liệu Business đề xuất</th>
          </tr>
        </thead>
        <tbody>
          {changedRows.map(([key, label]) => (
            <tr key={key}>
              <td><b>{label}</b></td>
              <td><pre>{adminCompareValue(current[key], key)}</pre></td>
              <td>
                <span className="d68-admin-badge warn">Đã thay đổi</span>
                <pre>{adminCompareValue(pending[key], key)}</pre>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BusinessPublicEditor({ b, onApprove, onToggle, businessFiles = [], businessImages = [] }: any) {
  const pending = objectOf(b.pending_changes_json);
  const hasPending = Object.keys(pending).length > 0;
  const src = sourceOf(b);
  const pub = publicOf(b);
  const sections = businessReviewSections(b, businessFiles, businessImages);
  const pendingFiles = businessFiles.filter((file: Row) => String(file.business_id) === String(b.id) && isPendingBusinessFile(file));
  const pendingImages = businessImages.filter((img: Row) => String(img.business_id) === String(b.id) && isPendingBusinessImage(img));
  const reviewValue = (key: string, fallback: any = '') => {
    if (hasPending && hasOwn(pending, key)) return pending[key] ?? '';
    return pub[key] ?? src[key] ?? fallback;
  };
  const reviewLines = (key: string) => lines(reviewValue(key));
  const warningText = sections.length
    ? `Doanh nghiệp vừa sửa ${sections.join(', ')}, cần kiểm tra và duyệt.`
    : 'Doanh nghiệp cần Admin kiểm tra và duyệt trước khi public.';
  return <Card><form
    key={`${b.id}:${b.updated_at || ''}:${b.pending_submitted_at || ''}`}
    onSubmit={(e) => onApprove(e, b)}
  >
    <div className="d68-admin-row-head">
      <div><b>{b.public_code || 'D68'} · {b.company_name_private || src.company_name_private || 'Private name pending'}</b><div className="d68-admin-subtle">{b.status || 'pending'} · public v{b.public_version || 0} · {b.public_snapshot_json ? 'has snapshot' : 'no snapshot'} · {b.pending_submitted_at ? `pending ${new Date(b.pending_submitted_at).toLocaleString('vi-VN')}` : 'no pending text'}</div></div>
      <span className={`d68-admin-badge ${b.visible ? 'ok' : 'warn'}`}>{b.visible ? 'visible' : 'not public'}</span>
    </div>
    <div className="d68-admin-notice warn">{warningText}</div>
    {hasPending ? <BusinessPendingComparison b={b} /> : null}
    {sections.length ? <div className="d68-admin-actions">{sections.map((label) => <span key={label} className="d68-admin-badge warn">{label}</span>)}</div> : null}
    {pendingFiles.length || pendingImages.length ? <details className="d68-admin-source" open><summary>Tài sản cần duyệt: {pendingFiles.length} file · {pendingImages.length} ảnh</summary><pre>{JSON.stringify({ files: pendingFiles.map((x: Row) => ({ id: x.id, file_name: x.file_name, display_name: x.display_name, public_visible: x.public_visible, privacy_level: x.privacy_level, admin_note: x.admin_note })), images: pendingImages.map((x: Row) => ({ id: x.id, title: x.title, display_title: x.display_title, public_visible: x.public_visible, is_sanitized: x.is_sanitized, admin_note: x.admin_note })) }, null, 2)}</pre><p className="d68-admin-subtle">Duyệt/đổi tên/làm sạch ảnh-file tại tab “Hình ảnh & Files” hoặc “Ảnh/File DN”. Sau khi Admin lưu một thay đổi, tài sản được đánh dấu đã kiểm tra và cảnh báo sẽ tắt nếu không còn pending khác.</p></details> : null}
    {hasPending ? <details className="d68-admin-source" open><summary>Thay đổi doanh nghiệp vừa gửi</summary><pre>{JSON.stringify(pending, null, 2)}</pre></details> : <details className="d68-admin-source"><summary>Xem dữ liệu nguồn</summary><pre>{JSON.stringify(src, null, 2)}</pre></details>}
    <div className="d68-admin-form4">
      <label className="d68-admin-field"><span>Tiêu đề ẩn danh (hiển thị public, VN)</span><input name="title_vi" defaultValue={reviewValue('title_vi') || 'Hồ sơ doanh nghiệp ẩn danh'} placeholder="Tên ẩn danh VI" required className="d68-admin-input"/></label>
      <label className="d68-admin-field"><span>Tiêu đề ẩn danh (hiển thị public, EN)</span><input name="title_en" defaultValue={reviewValue('title_en') || autoEn(String(reviewValue('title_vi') || ''))} placeholder="Anonymous title EN" className="d68-admin-input"/></label>
      <input name="industry" defaultValue={reviewValue('industry')} placeholder="Industry" className="d68-admin-input"/>
      <input name="deal_type" defaultValue={reviewValue('deal_type')} placeholder="Deal type" className="d68-admin-input"/>
      <input name="city" defaultValue={reviewValue('city')} placeholder="City" className="d68-admin-input"/>
      <input name="country_iso2" defaultValue={reviewValue('country_iso2', 'VN')} placeholder="Country ISO2" className="d68-admin-input"/>
      <AdminNumberInput name="revenue_month" value={reviewValue('revenue_month', 0)} placeholder="Doanh thu tháng"/>
      <AdminNumberInput name="revenue_2025" value={reviewValue('revenue_2025', 0)} placeholder="Doanh thu năm"/>
      <select name="revenue_currency" defaultValue={reviewValue('revenue_currency', 'VND')} className="d68-admin-input"><option>VND</option><option>USD</option></select>
      <AdminNumberInput name="ebitda_margin" value={reviewValue('ebitda_margin', 0)} placeholder="EBITDA %" allowDecimal/>
      <AdminNumberInput name="growth_pct" value={reviewValue('growth_pct', 0)} placeholder="Tăng trưởng năm %" allowDecimal/>
      <AdminNumberInput name="ask_amount" value={reviewValue('ask_amount', 0)} placeholder="Nhu cầu vốn/Giá chào"/>
      <select name="ask_currency" defaultValue={reviewValue('ask_currency') || reviewValue('revenue_currency', 'VND')} className="d68-admin-input"><option>VND</option><option>USD</option></select>
      <AdminNumberInput name="stake_pct" value={reviewValue('stake_pct', 0)} placeholder="Tỷ lệ cổ phần %" allowDecimal/>
      <AdminNumberInput name="quality_score" value={reviewValue('quality_score', b.quality_score ?? 0)} placeholder="Business Quality Score 0-100"/>
      <label className="d68-admin-check"><input name="quality_score_manual_override" type="checkbox" defaultChecked={!!b.quality_score_manual_override}/> Giữ điểm Admin nhập</label>
      <AdminNumberInput name="data_confidence" value={reviewValue('data_confidence', b.data_confidence ?? 0)} placeholder="Data confidence"/>
      <input name="hero_image_url" defaultValue={reviewValue('hero_image_url') || reviewValue('image_url')} placeholder="Approved hero image URL" className="d68-admin-input d68-admin-span2"/>
      <label className="d68-admin-field d68-admin-span2"><span>Mô tả/Giới thiệu (hiển thị public, VN)</span><textarea name="description_vi" defaultValue={reviewValue('description_vi')} placeholder="Mô tả public VI" className="d68-admin-input textarea"/></label>
      <label className="d68-admin-field d68-admin-span2"><span>Mô tả/Giới thiệu (hiển thị public, EN)</span><textarea name="description_en" defaultValue={reviewValue('description_en') || autoEn(String(reviewValue('description_vi') || ''))} placeholder="Description EN" className="d68-admin-input textarea"/></label>
      <label className="d68-admin-field d68-admin-span2"><span>Điểm nổi bật (hiển thị public, VN)</span><textarea name="highlights_vi" defaultValue={reviewLines('highlights_vi')} placeholder="Mỗi dòng là một điểm nổi bật public" className="d68-admin-input textarea"/></label>
      <label className="d68-admin-field d68-admin-span2"><span>Điểm nổi bật (hiển thị public, EN)</span><textarea name="highlights_en" defaultValue={reviewLines('highlights_en') || autoEn(reviewLines('highlights_vi'))} placeholder="Each line is one public highlight" className="d68-admin-input textarea"/></label>
      <textarea name="investment_reason_vi" defaultValue={reviewValue('investment_reason_vi')} placeholder="Lý do giao dịch VI" className="d68-admin-input textarea d68-admin-span2"/>
      <textarea name="investment_reason_en" defaultValue={reviewValue('investment_reason_en') || autoEn(String(reviewValue('investment_reason_vi') || ''))} placeholder="Reason EN" className="d68-admin-input textarea d68-admin-span2"/>
    </div>
    <div className="d68-admin-actions"><button className="d68-admin-btn green">Duyệt & hiển thị public snapshot</button><button type="button" onClick={() => onToggle(b)} className={`d68-admin-btn ${b.visible ? 'red' : ''}`}>{b.visible ? 'Ẩn public' : 'Bật visible'}</button>{b.slug ? <Link to={`/businesses/${b.slug}`} className="d68-admin-btn blue">Public ↗</Link> : null}{(pendingFiles.length || pendingImages.length) ? <Link to="/admin/assets" className="d68-admin-btn blue">Duyệt ảnh/file ↗</Link> : null}</div>
  </form></Card>;
}
function InvestorEditor({ i, profiles, onSave, onToggle }: any) {
  const pending = i.privacy?.pending_profile_changes;
  const needsReview = investorNeedsReview(i);
  const src = {
    ...i,
    desc_vi: pending?.desc_vi ?? i.desc_vi,
    desc_en: pending?.desc_en ?? i.desc_en,
  };
  const criteria = objectOf(src.criteria || i.criteria);
  const targetCountries = investorTargetCountriesAdmin({ ...i, criteria });
  const targetCountryText = targetCountries.join(', ');
  const targetLabels = targetCountries.map(countryLabelAdmin);
  const loginProfile = (profiles || []).find((p: Row) => p.id === i.owner_id || p.username === i.username || p.email === i.private_email) || {};
  const loginUsername = loginProfile.username || i.username || loginProfile.email || i.private_email || '—';
  return <Card><form onSubmit={(e) => onSave(e, i, pending ? 'approve' : 'save')}>
    <div className="d68-admin-row-head">
      <div>
        <b>{i.code} · {i.private_name || i.title_vi || i.title_en}</b>
        <div className="d68-admin-subtle">{i.status} · {i.visible ? 'visible' : 'not public'} · Trụ sở: {investorOfficeCountryLabelAdmin(i)} · {pending ? 'has pending dashboard changes' : 'no pending changes'}</div>
      </div>
      <span className={`d68-admin-badge ${i.visible ? 'ok' : 'warn'}`}>{i.visible ? 'visible' : 'not public'}</span>
      {needsReview ? <span className="d68-admin-badge warn">Cần duyệt</span> : null}
    </div>
    {needsReview ? <div className="d68-admin-notice warn">Tài khoản Investor mới tạo hoặc mới cập nhật thông tin cần Admin duyệt trước khi public.</div> : null}
    <div className="d68-admin-loginbox"><b>Login Investor</b><span>Username: <code>{loginUsername}</code></span><span>Mật khẩu: <code>Quản lý bằng Supabase Auth · không lưu trong database</code></span><span>Email: <code>{loginProfile.email || i.private_email || '—'}</code></span></div>
    <div className="d68-admin-targetbox">
      <b>Thị trường quan tâm</b>
      <div className="d68-admin-taglist">{targetLabels.length ? targetLabels.map((label, idx) => <span key={`${label}-${idx}`}>{label}</span>) : <em>Chưa chọn thị trường</em>}</div>
    </div>
    {pending ? <details className="d68-admin-source" open><summary>Pending changes from Investor Dashboard</summary><pre>{JSON.stringify(pending, null, 2)}</pre></details> : null}
    <div className="d68-admin-form4">
      <input name="title_vi" defaultValue={src.title_vi || ''} placeholder="Title VI" className="d68-admin-input"/>
      <input name="title_en" defaultValue={src.title_en || ''} placeholder="Title EN" className="d68-admin-input"/>
      <input name="type" defaultValue={src.type || ''} placeholder="Loại nhà đầu tư" className="d68-admin-input"/>
      <input name="country" defaultValue={src.country || ''} placeholder="Quốc gia trụ sở" className="d68-admin-input"/>
      <input name="country_iso2" defaultValue={src.country_iso2 || i.country_iso2 || ''} placeholder="Mã quốc gia trụ sở ISO2" className="d68-admin-input"/>
      <input name="region" defaultValue={src.region || i.region || ''} placeholder="Region" className="d68-admin-input"/>
      <AdminNumberInput name="ticket_min" value={src.ticket_min || 0} placeholder="Ticket min"/>
      <AdminNumberInput name="ticket_max" value={src.ticket_max || 0} placeholder="Ticket max"/>
      <input name="stage" defaultValue={src.stage || ''} placeholder="Stage" className="d68-admin-input"/>
            <div className="d68-admin-span2">
        <label className="d68-admin-field">
          <span>Ngành/Lĩnh vực quan tâm</span>
          <IndustryTagPicker
            lang="vi"
            name="industries"
            values={arrFromText(src.industries)}
            expandVi="Mở rộng"
            expandEn="Expand"
          />
        </label>
      </div>
      <input name="deal_types" defaultValue={arrFromText(src.deal_types).join(', ')} placeholder="Deal types" className="d68-admin-input"/>
      <label className="d68-admin-field d68-admin-span2"><span>Thị trường quan tâm (mã quốc gia, cách nhau bằng dấu phẩy)</span><input name="target_countries" defaultValue={targetCountryText} placeholder="VD: VN, US, SG, JP" className="d68-admin-input"/><small>Hiển thị thành tag phía trên; lưu vào criteria.targetCountries/preferredCountries.</small></label>
      <label className="d68-admin-check"><input name="verified" type="checkbox" defaultChecked={!!i.verified}/> Verified</label>
      <label className="d68-admin-check"><input name="admin_priority" type="checkbox" defaultChecked={!!i.admin_priority}/> Priority</label>
      <label className="d68-admin-check"><input name="visible" type="checkbox" defaultChecked={!!i.visible}/> Visible</label>
      <input name="private_name" defaultValue={i.private_name || ''} placeholder="Private name" className="d68-admin-input"/>
      <input name="private_email" defaultValue={i.private_email || i.privacy?.email || ''} placeholder="Private email" className="d68-admin-input"/>
      <input name="private_phone" defaultValue={i.private_phone || i.privacy?.phone || ''} placeholder="Private phone" className="d68-admin-input"/>
      <input name="private_website" defaultValue={i.private_website || i.privacy?.website || ''} placeholder="Private website" className="d68-admin-input"/>
      <textarea name="desc_vi" defaultValue={src.desc_vi || ''} placeholder="Desc VI" className="d68-admin-input textarea d68-admin-span2"/>
      <textarea name="desc_en" defaultValue={src.desc_en || ''} placeholder="Desc EN" className="d68-admin-input textarea d68-admin-span2"/>
    </div>
    <div className="d68-admin-actions"><button className="d68-admin-btn green">{pending ? 'Duyệt thay đổi & public' : 'Lưu investor'}</button><button type="button" onClick={() => onToggle(i)} className={`d68-admin-btn ${i.visible ? 'red' : ''}`}>{i.visible ? 'Ẩn public' : 'Bật visible'}</button>{i.code ? <Link to={`/investors/${i.code}`} className="d68-admin-btn blue">Public ↗</Link> : null}</div>
  </form></Card>;
}
function AssetEditor({
  b,
  adminId,
  onRefresh,
}: {
  b: Row;
  adminId?: string;
  onRefresh?: () => void | Promise<void>;
}) {
  return (
    <Card>
      <AdminBusinessAssets
        business={b}
        adminId={adminId}
        onRefresh={onRefresh}
      />
    </Card>
  );
}
function Promos({ promos, createPromo }: any) { return <Card><h3>Mã khuyến mãi</h3><form onSubmit={createPromo} className="d68-admin-form4 d68-admin-form-gap"><input required name="code" placeholder="CODE" className="d68-admin-input"/><input name="description" placeholder="Description" className="d68-admin-input"/><select name="role" className="d68-admin-input"><option value="business">business</option><option value="investor">investor</option><option value="advisor">advisor</option><option value="affiliate">affiliate</option></select><input name="discount_pct" type="number" placeholder="%" className="d68-admin-input"/><input name="quota_total" type="number" placeholder="Quota" className="d68-admin-input"/><input name="starts_at" type="datetime-local" className="d68-admin-input"/><input name="ends_at" type="datetime-local" className="d68-admin-input"/><button className="d68-admin-btn green">Tạo mã</button></form>{promos.map((p: Row) => <div key={p.id} className="d68-admin-card"><b>{p.code}</b> · {p.discount_pct}% · {p.role} · {p.active ? 'active' : 'inactive'}</div>)}</Card>; }
function Requests({ requests, markRequest }: any) { return <Card><h3>Yêu cầu data</h3>{requests.length ? requests.map((r: Row) => <div key={r.id} className="d68-admin-card"><b>{r.businesses?.public_code || r.business_id}</b> ← {r.investors?.code || r.investor_id}<p>{r.note}</p><span>{r.status}</span><div className="d68-admin-actions"><button className="d68-admin-btn blue" onClick={() => markRequest(r, 'forwarded')}>Forwarded</button><button className="d68-admin-btn green" onClick={() => markRequest(r, 'fulfilled')}>Fulfilled</button><button className="d68-admin-btn red" onClick={() => markRequest(r, 'rejected')}>Rejected</button></div></div>) : <Empty text="No data requests."/>}</Card>; }
function Leads({ contactMessages, partnerLeads, markLead }: any) { return <div><Card><h3>Contact messages</h3>{contactMessages.length ? contactMessages.map((m: Row) => <div key={m.id} className="d68-admin-card"><b>{m.name}</b> · <a href={`mailto:${m.email}`}>{m.email}</a><p>{m.message}</p><span className="d68-admin-badge warn">{m.status}</span><div className="d68-admin-actions"><button className="d68-admin-btn green" onClick={() => markLead('contact_messages', m, 'handled')}>Handled</button><button className="d68-admin-btn blue" onClick={() => markLead('contact_messages', m, 'follow_up')}>Follow up</button></div></div>) : <Empty text="No contact messages."/>}</Card><Card><h3>Market Partner leads</h3>{partnerLeads.length ? partnerLeads.map((l: Row) => <div key={l.id} className="d68-admin-card"><b>{l.full_name}</b> · <a href={`mailto:${l.email}`}>{l.email}</a> · {l.country}<p>{l.phone}</p><p>{l.intro}</p><span className="d68-admin-badge warn">{l.status}</span><div className="d68-admin-actions"><button className="d68-admin-btn green" onClick={() => markLead('partner_leads', l, 'approved')}>Approved</button><button className="d68-admin-btn blue" onClick={() => markLead('partner_leads', l, 'follow_up')}>Follow up</button><button className="d68-admin-btn red" onClick={() => markLead('partner_leads', l, 'rejected')}>Rejected</button></div></div>) : <Empty text="No partner leads."/>}</Card></div>; }
function Logs({ logs }: { logs: Row[] }) { return <Card><h3>Audit logs</h3>{logs.length ? <div className="d68-admin-table-wrap"><table className="d68-admin-table"><tbody>{logs.map((l) => <tr key={l.id}><td>{new Date(l.created_at).toLocaleString()}</td><td><b>{l.action}</b></td><td>{l.entity_type}</td><td><pre>{JSON.stringify(l.detail || {}, null, 2)}</pre></td></tr>)}</tbody></table></div> : <Empty text="No audit logs."/>}</Card>; }
function Settings() { return <Card><h3>Cài đặt & kiểm thử baseline</h3><p>Không có secret/service_role key trong frontend. Admin chạy bằng Supabase RLS + profile.role=admin.</p><ul className="d68-admin-steps"><li>Public Business phải có visible=true, status=active, public_snapshot_json.</li><li>Business user edit chỉ vào pending_changes_json.</li><li>Investor user edit chỉ vào privacy.pending_profile_changes.</li><li>Admin duyệt mới public.</li><li>Contact và Market Partner leads lưu vào bảng riêng, Admin xem tại /admin/leads.</li></ul></Card>; }
