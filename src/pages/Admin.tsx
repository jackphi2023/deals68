import { FormEvent, useEffect, useState } from 'react';
import {
  Link,
  Navigate,
  useLocation,
  useNavigate,
} from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { AdminBusinessAssets } from '../components/admin/AdminBusinessAssets';
import { AdminNumberInput } from '../components/admin/AdminNumberInput';
import InvestorAdminReviewPanel from '../components/admin/InvestorAdminReviewPanel';
import { parseFormattedNumber } from '../lib/numberFormat';
import { supabase } from '../lib/supabase';
import {
  proposalStatusLabel,
  updateProposalStatus,
  type ProposalStatus,
} from '../lib/proposals';
import { AdminBannerManager } from '../components/SiteBanners';
import { industryKeyFromLabel } from '../lib/industryTaxonomy';
import {
  getLocationOptionsForCountry,
  locationDbLabel,
  locationKeyFromLabel,
} from '../lib/labels';
import {
  adminSetPaymentOrderStatus,
  paymentOrderCode,
} from '../lib/paymentOrders';
import { AdminOperationsOverview } from '../components/admin/AdminOperationsOverview';
import {
  adminRefreshLabel,
  isPendingAdminLead,
  isPendingAdminPayment,
  isPendingAdminProposal,
  isPendingAdminRequest,
  sortAdminQueueFirst,
  type AdminQueueCounts,
} from '../lib/adminOperations';

type AdminTab =
  | 'overview'
  | 'payments'
  | 'proposals'
  | 'banners'
  | 'businesses'
  | 'business_review'
  | 'assets'
  | 'investors'
  | 'promos'
  | 'requests'
  | 'leads'
  | 'logs'
  | 'settings';

type Row = Record<string, any>;

const pathTabs: Record<string, AdminTab> = {
  '': 'overview',
  overview: 'overview',
  payments: 'payments',
  approvals: 'payments',
  proposals: 'proposals',
  banners: 'banners',
  banner: 'banners',
  businesses: 'businesses',
  'business-review': 'business_review',
  assets: 'assets',
  investors: 'investors',
  promo: 'promos',
  promos: 'promos',
  'data-requests': 'requests',
  requests: 'requests',
  leads: 'leads',
  'market-partners': 'leads',
  contacts: 'leads',
  audit: 'logs',
  logs: 'logs',
  settings: 'settings',
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
  { id: 'settings', label: 'Cài đặt', icon: '⚙️', href: '/admin/settings' },
];

function resolveTab(pathname: string): AdminTab {
  const suffix = pathname.replace('/admin', '').replace(/^\//, '').split('/')[0];
  return pathTabs[suffix] || 'overview';
}

function text(value: any) {
  return String(value ?? '').trim();
}

function lines(raw: any) {
  if (Array.isArray(raw)) return raw.join('\n');
  return String(raw || '');
}

function sourceOf(business: Row) {
  return {
    ...business,
    ...(business.pending_changes_json && typeof business.pending_changes_json === 'object'
      ? business.pending_changes_json
      : {}),
  };
}

function publicOf(business: Row) {
  return business.public_snapshot_json && typeof business.public_snapshot_json === 'object'
    ? business.public_snapshot_json
    : business;
}

function autoEn(vi: string) {
  return text(vi)
    .replace(/Doanh nghiệp/gi, 'Business')
    .replace(/Công ty/gi, 'Company')
    .replace(/Gọi vốn/gi, 'Fundraising')
    .replace(/Bán/gi, 'Sale')
    .replace(/Chuyển nhượng/gi, 'Transfer')
    .replace(/Nhà đầu tư/gi, 'Investor')
    .replace(/Sản xuất/gi, 'Manufacturing')
    .replace(/Công nghệ/gi, 'Technology')
    .replace(/Y tế/gi, 'Healthcare')
    .replace(/Thủy sản/gi, 'Seafood');
}

function objectOf(value: any) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function hasOwn(obj: any, key: string) {
  return Object.prototype.hasOwnProperty.call(objectOf(obj), key);
}

function comparable(value: any) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item ?? '').trim()).filter(Boolean).join('\n');
  }
  if (value && typeof value === 'object') return JSON.stringify(value);
  return String(value ?? '').trim();
}

function changedAny(pending: any, approved: any, keys: string[]) {
  const proposed = objectOf(pending);
  const current = objectOf(approved);
  return keys.some(
    (key) => hasOwn(proposed, key) && comparable(proposed[key]) !== comparable(current[key]),
  );
}

function assetReviewState(row: Row) {
  const note = String(row.admin_note || '').toLowerCase();
  return {
    note,
    reviewed:
      note.includes('admin reviewed') ||
      note.includes('approved') ||
      note.includes('rejected') ||
      note.includes('không public') ||
      note.includes('khong public'),
    userSubmitted:
      note.includes('user') ||
      note.includes('pending') ||
      note.includes('review required') ||
      note.includes('admin review remains required'),
  };
}

function isPendingBusinessFile(row: Row) {
  const state = assetReviewState(row);
  if (state.reviewed) return false;
  const privacy = String(row.privacy_level || '').toLowerCase();
  return state.userSubmitted || row.public_visible !== true || privacy.includes('locked');
}

function isPendingBusinessImage(row: Row) {
  const state = assetReviewState(row);
  if (state.reviewed) return false;
  return state.userSubmitted || row.public_visible !== true || row.is_sanitized !== true;
}

function businessReviewSections(
  business: Row,
  files: Row[] = [],
  images: Row[] = [],
) {
  const pending = objectOf(business.pending_changes_json);
  const approved = objectOf(business.public_snapshot_json);
  const labels: string[] = [];
  if (
    changedAny(pending, approved, [
      'description_vi',
      'description_en',
      'investment_reason_vi',
      'investment_reason_en',
    ])
  ) labels.push('Giới thiệu');
  if (changedAny(pending, approved, ['highlights_vi', 'highlights_en'])) {
    labels.push('Điểm nổi bật');
  }
  if (
    changedAny(pending, approved, [
      'title_vi',
      'title_en',
      'industry',
      'deal_type',
      'city',
      'country_iso2',
      'revenue_2025',
      'revenue_currency',
      'ebitda_margin',
      'ask_amount',
      'ask_currency',
      'stake_pct',
      'data_confidence',
      'hero_image_url',
      'image_url',
    ])
  ) labels.push('Thông tin giao dịch');
  if (images.some((image) => String(image.business_id) === String(business.id) && isPendingBusinessImage(image))) {
    labels.push('Hình ảnh');
  }
  if (files.some((file) => String(file.business_id) === String(business.id) && isPendingBusinessFile(file))) {
    labels.push('Files tài liệu');
  }
  if (!labels.length && Object.keys(pending).length) labels.push('Thông tin doanh nghiệp');
  return Array.from(new Set(labels));
}

function businessNeedsReview(business: Row, files: Row[] = [], images: Row[] = []) {
  return (
    business.status === 'pending_admin_review' ||
    business.moderation_status === 'pending_admin_review' ||
    !!business.pending_changes_json ||
    !business.public_snapshot_json ||
    businessReviewSections(business, files, images).length > 0
  );
}

function investorNeedsReview(investor: Row) {
  const pending = objectOf(investor.privacy?.pending_profile_changes);
  const immediateKeys = new Set([
    'type', 'stage', 'industries', 'deal_types', 'country', 'country_iso2',
    'region', 'ticket_min', 'ticket_max', 'criteria',
  ]);
  const hasModeratedPending = Object.keys(pending).some(
    (key) => !immediateKeys.has(key),
  );
  return (
    ['draft', 'payment_pending', 'pending_admin_review'].includes(String(investor.status || '')) ||
    hasModeratedPending
  );
}

function dateMs(value: any) {
  const milliseconds = new Date(value || 0).getTime();
  return Number.isFinite(milliseconds) ? milliseconds : 0;
}

function businessPrivateTitle(business: Row) {
  return String(
    business.company_name_private ||
      business.title_vi ||
      business.title_en ||
      business.public_code ||
      business.slug ||
      business.id ||
      'Business',
  ).trim();
}

function businessPrimaryIndustry(business: Row) {
  const source = sourceOf(business);
  return String(source.industry || business.industry || '').split(';')[0].trim() || 'Đang cập nhật';
}

function businessPlanLabel(business: Row) {
  const plan = String(business.plan || 'standard').toLowerCase();
  if (plan.includes('featured') || plan.includes('priority') || plan.includes('ưu')) {
    return 'Ưu tiên';
  }
  return 'Thường';
}

function hasPendingPaymentForBusiness(business: Row, payments: Row[] = []) {
  return payments.some(
    (payment) =>
      String(payment.business_id || '') === String(business.id) &&
      ['pending', 'payment_pending', 'new'].includes(String(payment.status || '').toLowerCase()),
  );
}

function businessActivityMs(
  business: Row,
  files: Row[] = [],
  images: Row[] = [],
  payments: Row[] = [],
) {
  const assetTimes = [
    ...files
      .filter((file) => String(file.business_id) === String(business.id))
      .map((file) => dateMs(file.updated_at || file.created_at)),
    ...images
      .filter((image) => String(image.business_id) === String(business.id))
      .map((image) => dateMs(image.updated_at || image.created_at)),
    ...payments
      .filter((payment) => String(payment.business_id) === String(business.id))
      .map((payment) => dateMs(payment.updated_at || payment.created_at)),
  ];
  return Math.max(
    dateMs(business.pending_submitted_at),
    dateMs(business.updated_at),
    dateMs(business.created_at),
    ...assetTimes,
    0,
  );
}

function businessAdminStatusLabel(
  business: Row,
  files: Row[] = [],
  images: Row[] = [],
  payments: Row[] = [],
) {
  if (hasPendingPaymentForBusiness(business, payments)) return { label: 'Chờ thanh toán', cls: 'warn' };
  if (
    !business.public_snapshot_json ||
    String(business.status || '') === 'pending_admin_review' ||
    String(business.moderation_status || '') === 'pending_admin_review'
  ) return { label: 'Mới/chờ duyệt', cls: 'warn' };
  if (businessReviewSections(business, files, images).length || business.pending_changes_json) {
    return { label: 'Có thay đổi', cls: 'warn' };
  }
  if (business.visible && String(business.status || '') === 'active') {
    return { label: 'Đang hiển thị', cls: 'ok' };
  }
  if (!business.visible || String(business.status || '') === 'hidden') {
    return { label: 'Đang ẩn', cls: 'err' };
  }
  return { label: String(business.status || 'Đang cập nhật'), cls: 'blue' };
}

function businessMatchesAdminStatus(
  business: Row,
  filter: string,
  payments: Row[] = [],
  files: Row[] = [],
  images: Row[] = [],
) {
  if (!filter) return true;
  if (filter === 'new_pending') {
    return (
      !business.public_snapshot_json ||
      String(business.status || '') === 'pending_admin_review' ||
      String(business.moderation_status || '') === 'pending_admin_review'
    );
  }
  if (filter === 'updated_pending') {
    return !!business.pending_changes_json || businessReviewSections(business, files, images).length > 0;
  }
  if (filter === 'visible') return !!business.visible && String(business.status || '') === 'active';
  if (filter === 'hidden') return !business.visible || String(business.status || '') === 'hidden';
  if (filter === 'payment_pending') return hasPendingPaymentForBusiness(business, payments);
  return true;
}

function businessReviewWarningText(business: Row, files: Row[] = [], images: Row[] = []) {
  const sections = businessReviewSections(business, files, images);
  return sections.length
    ? `Doanh nghiệp vừa sửa ${sections.join(', ')}, cần kiểm tra và duyệt.`
    : '';
}

function paymentAmountLabel(row: Row) {
  const payload = objectOf(row.payload);
  const price = objectOf(payload.price);
  const amount = price.total ?? payload.total ?? payload.amount ?? row.amount ?? '';
  const currency = price.currency || payload.currency || row.currency || '';
  return `${amount || '—'} ${currency || ''}`.trim();
}

const INVESTOR_PAGE_SIZE = 30;

export default function Admin() {
  const { profile, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const initialQuery = new URLSearchParams(location.search);
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
  const [lastRefreshedAt, setLastRefreshedAt] = useState('');
  const [search, setSearch] = useState(() => initialQuery.get('q') || '');
  const [investorVisibilityFilter, setInvestorVisibilityFilter] = useState(
    () => initialQuery.get('iv') || '',
  );
  const [investorReviewFilter, setInvestorReviewFilter] = useState(
    () => initialQuery.get('review') || '',
  );
  const [investorTypeFilter, setInvestorTypeFilter] = useState(
    () => initialQuery.get('it') || '',
  );
  const [investorOfficeCountryFilter, setInvestorOfficeCountryFilter] = useState(
    () => initialQuery.get('io') || '',
  );
  const [investorCountryFilter, setInvestorCountryFilter] = useState(
    () => initialQuery.get('ic') || '',
  );
  const [investorIndustryFilter, setInvestorIndustryFilter] = useState(
    () => initialQuery.get('ii') || '',
  );
  const [investorPage, setInvestorPage] = useState(
    () => Math.max(1, Number(initialQuery.get('ip') || 1)),
  );
  const [businessStatusFilter, setBusinessStatusFilter] = useState(
    () => initialQuery.get('bs') || '',
  );
  const [businessIndustryFilter, setBusinessIndustryFilter] = useState(
    () => initialQuery.get('bi') || '',
  );
  const [paymentStatusFilter, setPaymentStatusFilter] = useState(
    () => initialQuery.get('ps') || 'pending',
  );
  const [proposalStatusFilter, setProposalStatusFilter] = useState(
    () => initialQuery.get('prs') || 'sent',
  );

  useEffect(() => setTab(resolveTab(location.pathname)), [location.pathname]);

  useEffect(() => {
    const query = new URLSearchParams(location.search);
    setSearch(query.get('q') || '');
    setInvestorVisibilityFilter(query.get('iv') || '');
    setInvestorReviewFilter(query.get('review') || '');
    setInvestorTypeFilter(query.get('it') || '');
    setInvestorOfficeCountryFilter(query.get('io') || '');
    setInvestorCountryFilter(query.get('ic') || '');
    setInvestorIndustryFilter(query.get('ii') || '');
    setInvestorPage(Math.max(1, Number(query.get('ip') || 1)));
    setBusinessStatusFilter(query.get('bs') || '');
    setBusinessIndustryFilter(query.get('bi') || '');
    setPaymentStatusFilter(query.get('ps') || 'pending');
    setProposalStatusFilter(query.get('prs') || 'sent');
  }, [location.search]);

  function replaceAdminQuery(patch: Record<string, string | number | null | undefined>) {
    const query = new URLSearchParams(location.search);
    Object.entries(patch).forEach(([key, value]) => {
      const clean = String(value ?? '').trim();
      if (!clean) query.delete(key);
      else query.set(key, clean);
    });
    const next = query.toString();
    navigate(
      { pathname: location.pathname, search: next ? `?${next}` : '' },
      { replace: true },
    );
  }

  function updateSearch(value: string) {
    setSearch(value);
    setInvestorPage(1);
    replaceAdminQuery({ q: value, ip: null });
  }

  function updateInvestorPage(value: number) {
    const page = Math.max(1, value);
    setInvestorPage(page);
    replaceAdminQuery({ ip: page > 1 ? page : null });
  }

  async function load() {
    if (profile?.role !== 'admin') return;
    setBusy(true);
    setError('');
    try {
      const [
        businessResult,
        businessFilesResult,
        businessImagesResult,
        investorResult,
        profileResult,
        promoResult,
        requestResult,
        proposalResult,
        paymentResult,
        logResult,
        contactResult,
        leadResult,
      ] = await Promise.all([
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
        supabase.from('partner_leads').select('*').order('created_at', { ascending: false }).limit(300),
      ]);

      setBusinesses(businessResult.data || []);
      setBusinessFiles(businessFilesResult.data || []);
      setBusinessImages(businessImagesResult.data || []);
      setInvestors(investorResult.data || []);
      setProfiles(profileResult.data || []);
      setPromos(promoResult.data || []);
      setRequests(requestResult.data || []);
      setProposals(proposalResult.data || []);
      setPayments(paymentResult.data || []);
      setLogs(logResult.data || []);
      setContactMessages(contactResult.data || []);
      setPartnerLeads(leadResult.data || []);
      setLastRefreshedAt(new Date().toISOString());

      const firstError =
        businessResult.error ||
        businessFilesResult.error ||
        businessImagesResult.error ||
        investorResult.error ||
        profileResult.error ||
        promoResult.error ||
        requestResult.error ||
        proposalResult.error ||
        paymentResult.error ||
        logResult.error ||
        contactResult.error ||
        leadResult.error;
      if (firstError) setError(firstError.message);
    } catch (loadError: any) {
      setError(loadError?.message || 'Could not load admin data.');
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (profile?.role === 'admin') load();
  }, [profile?.role]);

  useEffect(() => {
    if (profile?.role !== 'admin') return;
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') load();
    };
    window.addEventListener('focus', refreshWhenVisible);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    const channel = supabase
      .channel('deals68-admin-business-flow')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'businesses' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'business_files' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'business_images' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'investors' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payment_orders' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'proposals' }, () => load())
      .subscribe();
    return () => {
      window.removeEventListener('focus', refreshWhenVisible);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
      supabase.removeChannel(channel);
    };
  }, [profile?.role]);

  if (loading) {
    return <section className="d68-admin-page"><div className="d68-admin-wrap"><div className="d68-admin-card">Loading admin...</div></div></section>;
  }
  if (profile?.role !== 'admin') return <Navigate to="/login?next=/admin" replace />;

  const pendingBusinesses = businesses.filter((business) =>
    businessNeedsReview(business, businessFiles, businessImages),
  );
  const pendingInvestors = investors.filter(investorNeedsReview);
  const pendingPayments = payments.filter(isPendingAdminPayment);
  const pendingProposals = proposals.filter(isPendingAdminProposal);
  const pendingRequests = requests.filter(isPendingAdminRequest);
  const pendingLeads = [...contactMessages, ...partnerLeads].filter(isPendingAdminLead);
  const queueCounts: AdminQueueCounts = {
    businesses: pendingBusinesses.length,
    investors: pendingInvestors.length,
    payments: pendingPayments.length,
    proposals: pendingProposals.length,
    requests: pendingRequests.length,
    leads: pendingLeads.length,
  };
  const navQueueCounts: Partial<Record<AdminTab, number>> = {
    payments: queueCounts.payments,
    proposals: queueCounts.proposals,
    business_review: queueCounts.businesses,
    investors: queueCounts.investors,
    requests: queueCounts.requests,
    leads: queueCounts.leads,
  };

  const filteredPayments = sortAdminQueueFirst(payments, isPendingAdminPayment).filter((row) => {
    if (paymentStatusFilter === 'all') return true;
    if (paymentStatusFilter === 'pending') return isPendingAdminPayment(row);
    return String(row.status || '').toLowerCase() === paymentStatusFilter;
  });
  const filteredProposals = sortAdminQueueFirst(proposals, isPendingAdminProposal).filter((row) => {
    if (proposalStatusFilter === 'all') return true;
    return String(row.status || 'sent').toLowerCase() === proposalStatusFilter;
  });

  const businessPathParts = location.pathname.replace(/^\/+|\/+$/g, '').split('/');
  const selectedBusinessKey =
    businessPathParts[0] === 'admin' &&
    businessPathParts[1] === 'businesses' &&
    businessPathParts[2]
      ? decodeURIComponent(businessPathParts[2])
      : '';
  const selectedBusiness = selectedBusinessKey
    ? businesses.find((business) =>
        [business.id, business.public_code, business.slug]
          .map((value) => String(value || ''))
          .includes(selectedBusinessKey),
      )
    : null;

  const businessIndustryOptions = Array.from(
    new Set(businesses.map((business) => businessPrimaryIndustry(business)).filter(Boolean)),
  ).sort((left, right) => left.localeCompare(right, 'vi'));
  const filteredBusinesses = businesses
    .filter((business) => {
      const source = sourceOf(business);
      const keyword = search.trim().toLowerCase();
      if (
        keyword &&
        ![
          business.title_vi,
          business.title_en,
          business.company_name_private,
          business.public_code,
          business.slug,
          source.industry,
          business.industry,
          source.city,
          business.city,
          business.status,
          business.plan,
        ].some((value) => String(value || '').toLowerCase().includes(keyword))
      ) return false;
      if (businessIndustryFilter && businessPrimaryIndustry(business) !== businessIndustryFilter) return false;
      if (!businessMatchesAdminStatus(business, businessStatusFilter, payments, businessFiles, businessImages)) return false;
      return true;
    })
    .sort(
      (left, right) =>
        businessActivityMs(right, businessFiles, businessImages, payments) -
        businessActivityMs(left, businessFiles, businessImages, payments),
    );

  async function logAction(action: string, entityType: string, entityId: string, detail: any = {}) {
    try {
      await supabase.from('audit_logs').insert({
        actor_id: profile.id,
        action,
        entity_type: entityType,
        entity_id: entityId,
        detail,
      });
    } catch {
      // Non-blocking audit logging.
    }
  }

  async function markPayment(row: Row, status: string) {
    if (!['confirmed', 'rejected'].includes(status)) {
      setError('Unsupported payment status.');
      return;
    }
    setBusy(true);
    setError('');
    setMsg('');
    try {
      const result = await adminSetPaymentOrderStatus(row.id, status as 'confirmed' | 'rejected');
      const alreadyApplied = !!result?.already_applied;
      setMsg(
        status === 'confirmed'
          ? alreadyApplied
            ? 'Payment đã được áp dụng trước đó; hệ thống không cộng gói/quota lần hai.'
            : 'Đã xác nhận payment và áp dụng gói/quota/thời hạn atomically.'
          : 'Đã từ chối payment.',
      );
      await load();
    } catch (paymentError: any) {
      setError(paymentError?.message || 'Could not update payment.');
    } finally {
      setBusy(false);
    }
  }

  async function toggleBusiness(business: Row) {
    const nextVisible = !business.visible;
    const { error: updateError } = await supabase
      .from('businesses')
      .update({ visible: nextVisible, status: nextVisible ? 'active' : 'hidden' })
      .eq('id', business.id);
    if (!updateError) {
      await logAction(
        nextVisible ? 'show_business' : 'hide_business',
        'business',
        business.id,
        { public_code: business.public_code },
      );
    }
    setError(updateError?.message || '');
    setMsg(updateError ? '' : 'Business visibility updated.');
    load();
  }

  async function updateBusinessQuota(business: Row, nextQuota: number) {
    const quota = Math.max(0, Math.floor(Number(nextQuota || 0)));
    const { error: updateError } = await supabase
      .from('businesses')
      .update({ quota_total: quota, updated_at: new Date().toISOString() })
      .eq('id', business.id);
    if (!updateError) {
      await logAction('set_business_proposal_quota', 'business', business.id, {
        public_code: business.public_code,
        quota_total: quota,
      });
    }
    setError(updateError?.message || '');
    setMsg(
      updateError
        ? ''
        : `Đã cập nhật quota proposal cho ${business.public_code || business.company_name_private || 'business'}: ${quota}.`,
    );
    load();
  }

  async function adjustBusinessQuota(business: Row, delta: number) {
    await updateBusinessQuota(business, Number(business.quota_total || 0) + Number(delta || 0));
  }

  async function setBusinessHomepage(business: Row, checked: boolean) {
    const { error: updateError } = await supabase
      .from('businesses')
      .update({ show_on_homepage: checked, updated_at: new Date().toISOString() })
      .eq('id', business.id);
    if (!updateError) {
      await logAction(
        checked ? 'show_business_on_homepage' : 'remove_business_from_homepage',
        'business',
        business.id,
        { public_code: business.public_code, show_on_homepage: checked },
      );
    }
    setError(updateError?.message || '');
    setMsg(
      updateError
        ? ''
        : checked
          ? 'Đã chọn Business hiển thị tại Homepage.'
          : 'Đã bỏ Business khỏi nhóm được ưu tiên tại Homepage.',
    );
    load();
  }

  async function approveBusiness(event: FormEvent, business: Row) {
    event.preventDefault();
    const form = new FormData(event.currentTarget as HTMLFormElement);
    const countryIso2 = text(form.get('country_iso2')) || 'VN';
    const submittedCity = text(form.get('city'));
    const cityKey = locationKeyFromLabel(
      text(form.get('city_key')) || submittedCity,
      countryIso2,
    );
    const adminSnapshot = {
      title_vi: text(form.get('title_vi')),
      title_en: text(form.get('title_en')) || autoEn(text(form.get('title_vi'))),
      description_vi: text(form.get('description_vi')),
      description_en:
        text(form.get('description_en')) || autoEn(text(form.get('description_vi'))),
      highlights_vi: text(form.get('highlights_vi')),
      highlights_en:
        text(form.get('highlights_en')) || autoEn(text(form.get('highlights_vi'))),
      investment_reason_vi: text(form.get('investment_reason_vi')),
      investment_reason_en:
        text(form.get('investment_reason_en')) || autoEn(text(form.get('investment_reason_vi'))),
      industry: text(form.get('industry')),
      industry_key: industryKeyFromLabel(text(form.get('industry'))),
      deal_type: text(form.get('deal_type')),
      city: locationDbLabel(cityKey || submittedCity, countryIso2),
      city_key: cityKey,
      country_iso2: countryIso2,
      revenue_month: parseFormattedNumber(form.get('revenue_month')),
      revenue_2025: parseFormattedNumber(form.get('revenue_2025')),
      revenue_currency: text(form.get('revenue_currency')) || 'VND',
      ebitda_margin: parseFormattedNumber(form.get('ebitda_margin'), true),
      growth_pct: parseFormattedNumber(form.get('growth_pct'), true),
      ask_amount: parseFormattedNumber(form.get('ask_amount')),
      ask_currency:
        text(form.get('ask_currency')) || text(form.get('revenue_currency')) || 'VND',
      stake_pct: parseFormattedNumber(form.get('stake_pct'), true),
      offer_amount: parseFormattedNumber(form.get('ask_amount')),
      offer_stake_pct: parseFormattedNumber(form.get('stake_pct'), true),
      quality_score: parseFormattedNumber(form.get('quality_score')),
      quality_score_manual_override: form.get('quality_score_manual_override') === 'on',
      data_confidence: parseFormattedNumber(form.get('data_confidence')),
      hero_image_url: text(form.get('hero_image_url')),
      image_url: text(form.get('hero_image_url')),
      approved_at: new Date().toISOString(),
    };

    const { error: approveError } = await supabase.rpc('approve_business_pending_changes', {
      business_uuid: business.id,
      admin_snapshot: adminSnapshot,
      expected_pending_submitted_at: business.pending_submitted_at || null,
    });
    if (!approveError) {
      await logAction('approve_business_pending_changes', 'business', business.id, {
        public_code: business.public_code,
        pending_submitted_at: business.pending_submitted_at || null,
        admin_snapshot: adminSnapshot,
      });
    }
    setError(approveError?.message || '');
    setMsg(
      approveError
        ? ''
        : 'Đã duyệt toàn bộ thay đổi Business, cập nhật Dashboard và public snapshot.',
    );
    load();
  }

  async function markRequest(request: Row, status: string) {
    const { error: updateError } = await supabase
      .from('request_data')
      .update({ status })
      .eq('id', request.id);
    if (!updateError) await logAction('mark_data_request', 'request_data', request.id, { status });
    setError(updateError?.message || '');
    setMsg(updateError ? '' : 'Request updated.');
    load();
  }

  async function markProposal(row: Row, status: ProposalStatus) {
    try {
      await updateProposalStatus(row.id, status);
      await logAction('mark_proposal', 'proposal', row.id, { status });
      setError('');
      setMsg('Đã cập nhật trạng thái Proposal.');
      load();
    } catch (proposalError: any) {
      setError(proposalError?.message || 'Could not update proposal.');
      setMsg('');
    }
  }

  async function createPromo(event: FormEvent) {
    event.preventDefault();
    const form = new FormData(event.currentTarget as HTMLFormElement);
    const { error: createError } = await supabase.from('promo_codes').insert({
      code: String(form.get('code') || '').toUpperCase(),
      description: form.get('description'),
      role: form.get('role'),
      discount_pct: Number(form.get('discount_pct') || 0),
      quota_total: Number(form.get('quota_total') || 0),
      starts_at: form.get('starts_at') || new Date().toISOString(),
      ends_at: form.get('ends_at') || null,
      active: true,
      created_by: profile.id,
    });
    setError(createError?.message || '');
    setMsg(createError ? '' : 'Promo created.');
    load();
  }

  async function markLead(
    table: 'contact_messages' | 'partner_leads',
    row: Row,
    status: string,
  ) {
    const { error: updateError } = await supabase
      .from(table)
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', row.id);
    if (!updateError) await logAction('mark_lead', table, row.id, { status });
    setError(updateError?.message || '');
    setMsg(updateError ? '' : 'Lead updated.');
    load();
  }

  return (
    <section className="d68-admin-page">
      <header className="d68-admin-head">
        <div className="d68-admin-head__inner"><b className="d68-admin-head__title">Admin Panel</b></div>
      </header>
      <div className="d68-admin-wrap">
        <div className="d68-admin-cols">
          <nav className="d68-admin-side">
            {tabs.map((item) => {
              const queueCount = navQueueCounts[item.id] || 0;
              return (
                <Link
                  key={item.id}
                  to={item.href}
                  onClick={() => setTab(item.id)}
                  className={`d68-admin-nav-link ${tab === item.id ? 'active' : ''}`}
                >
                  <span>{item.icon} {item.label}</span>
                  {queueCount ? <b className="d68-admin-nav-count">{queueCount}</b> : null}
                </Link>
              );
            })}
          </nav>
          <main>
            <div className="d68-admin-title">
              <div>
                <h1>Deals68 Admin</h1>
                <p>
                  Admin duyệt thanh toán, public snapshot, ảnh/file, profile investor và lead tĩnh.{' '}
                  <span className="d68-admin-refreshed">Cập nhật: {adminRefreshLabel(lastRefreshedAt)}</span>
                </p>
              </div>
              <button onClick={load} className="d68-admin-btn">{busy ? 'Loading...' : 'Refresh'}</button>
            </div>
            {msg ? <div className="d68-admin-notice ok">{msg}</div> : null}
            {error ? <div className="d68-admin-notice err">{error}</div> : null}
            <input
              className="d68-admin-input d68-admin-search"
              value={search}
              onChange={(event) => updateSearch(event.target.value)}
              placeholder="Search businesses/investors/profiles..."
            />

            {tab === 'overview' && (
              <AdminOperationsOverview
                queueCounts={queueCounts}
                totals={{
                  businesses: businesses.length,
                  investors: investors.length,
                  profiles: profiles.length,
                  payments: payments.length,
                  proposals: proposals.length,
                }}
                refreshedAt={lastRefreshedAt}
              />
            )}
            {tab === 'payments' && <Payments
        payments={filteredPayments}
              profiles={profiles}
              markPayment={markPayment}
              statusFilter={paymentStatusFilter}
              setStatusFilter={(value: string) => {
                setPaymentStatusFilter(value);
                replaceAdminQuery({ ps: value });
              }}
              total={payments.length}
              pending={pendingPayments.length}
            />}
            {tab === 'proposals' && <ProposalList
        proposals={filteredProposals}
              markProposal={markProposal}
              statusFilter={proposalStatusFilter}
              setStatusFilter={(value: string) => {
                setProposalStatusFilter(value);
                replaceAdminQuery({ prs: value });
              }}
              total={proposals.length}
              pending={pendingProposals.length}
            />}
            {tab === 'banners' && <AdminBannerManager />}
            {tab === 'business_review' && (
              <BusinessReviewList
                rows={pendingBusinesses}
                approveBusiness={approveBusiness}
                toggleBusiness={toggleBusiness}
                businessFiles={businessFiles}
                businessImages={businessImages}
              />
            )}
            {tab === 'businesses' && (
              selectedBusinessKey ? (
                selectedBusiness ? (
                  <BusinessAdminDetail
                    b={selectedBusiness}
                    payments={payments}
                    profiles={profiles}
                    approveBusiness={approveBusiness}
                    toggleBusiness={toggleBusiness}
                    setBusinessHomepage={setBusinessHomepage}
                    markPayment={markPayment}
                    updateBusinessQuota={updateBusinessQuota}
                    adjustBusinessQuota={adjustBusinessQuota}
                    businessFiles={businessFiles}
                    businessImages={businessImages}
                    adminId={profile.id}
                    onAssetsApproved={load}
                  />
                ) : (
                  <Card>
                    <h3>Không tìm thấy doanh nghiệp</h3>
                    <p className="d68-admin-subtle">ID/Mã/slug: {selectedBusinessKey}</p>
                    <Link to="/admin/businesses" className="d68-admin-btn blue">← Quay lại danh sách</Link>
                  </Card>
                )
              ) : (
                <BusinessAdminList
                  rows={filteredBusinesses}
                  allRows={businesses}
                  pendingRows={pendingBusinesses}
                  search={search}
                  setSearch={updateSearch}
                  businessStatusFilter={businessStatusFilter}
                  setBusinessStatusFilter={(value: string) => {
                    setBusinessStatusFilter(value);
                    replaceAdminQuery({ bs: value });
                  }}
                  businessIndustryFilter={businessIndustryFilter}
                  setBusinessIndustryFilter={(value: string) => {
                    setBusinessIndustryFilter(value);
                    replaceAdminQuery({ bi: value });
                  }}
                  businessIndustryOptions={businessIndustryOptions}
                  businessFiles={businessFiles}
                  businessImages={businessImages}
                  payments={payments}
                />
              )
            )}
            {tab === 'assets' && (
              <div>
                {filteredBusinesses.map((business) => (
                  <AssetEditor key={business.id} business={business} adminId={profile.id} onRefresh={load} />
                ))}
              </div>
            )}
            {tab === 'investors' && (
              <div>
                <p className="d68-admin-subtle">
                  Mật khẩu Investor: Quản lý bằng Supabase Auth · không lưu trong database
                </p>
                <InvestorAdminReviewPanel
                  investors={investors}
                  profiles={profiles}
                  payments={payments}
                  search={search}
                  reviewFilter={investorReviewFilter}
                  visibilityFilter={investorVisibilityFilter}
                  officeCountryFilter={investorOfficeCountryFilter}
                  targetCountryFilter={investorCountryFilter}
                  industryFilter={investorIndustryFilter}
                  typeFilter={investorTypeFilter}
                  page={investorPage}
                  pageSize={INVESTOR_PAGE_SIZE}
                  officeCountryLabel="Quốc gia trụ sở"
                  renderPagination={(page, pageCount, onPage) => (
                    <AdminPagination page={page} pageCount={pageCount} onPage={onPage} />
                  )}
                  onReviewFilterChange={(value) => {
                    setInvestorReviewFilter(value);
                    setInvestorPage(1);
                    replaceAdminQuery({ review: value, ip: null });
                  }}
                  onVisibilityFilterChange={(value) => {
                    setInvestorVisibilityFilter(value);
                    setInvestorPage(1);
                    replaceAdminQuery({ iv: value, ip: null });
                  }}
                  onOfficeCountryFilterChange={(value) => {
                    setInvestorOfficeCountryFilter(value);
                    setInvestorPage(1);
                    replaceAdminQuery({ io: value, ip: null });
                  }}
                  onTargetCountryFilterChange={(value) => {
                    setInvestorCountryFilter(value);
                    setInvestorPage(1);
                    replaceAdminQuery({ ic: value, ip: null });
                  }}
                  onIndustryFilterChange={(value) => {
                    setInvestorIndustryFilter(value);
                    setInvestorPage(1);
                    replaceAdminQuery({ ii: value, ip: null });
                  }}
                  onTypeFilterChange={(value) => {
                    setInvestorTypeFilter(value);
                    setInvestorPage(1);
                    replaceAdminQuery({ it: value, ip: null });
                  }}
                  onPageChange={updateInvestorPage}
                  onReload={load}
                  setMessage={setMsg}
                  setError={setError}
                />
              </div>
            )}
            {tab === 'promos' && <Promos promos={promos} createPromo={createPromo} />}
            {tab === 'requests' && <Requests requests={requests} markRequest={markRequest} />}
            {tab === 'leads' && (
              <Leads
                contactMessages={contactMessages}
                partnerLeads={partnerLeads}
                markLead={markLead}
              />
            )}
            {tab === 'logs' && <Logs logs={logs} />}
            {tab === 'settings' && <Settings />}
          </main>
        </div>
      </div>
    </section>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="d68-admin-card">{children}</div>;
}

function Empty({ text: emptyText }: { text: string }) {
  return <div className="d68-admin-empty">{emptyText}</div>;
}

function Metric({
  label,
  value,
  color = '#0F2A4A',
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <Card>
      <div className="d68-admin-metric-label">{label}</div>
      <div className="d68-admin-metric-value" style={{ color }}>{value}</div>
    </Card>
  );
}

function AdminPagination({
  page,
  pageCount,
  onPage,
}: {
  page: number;
  pageCount: number;
  onPage: (page: number) => void;
}) {
  if (pageCount <= 1) return null;
  return (
    <div className="d68-admin-pagination">
      <button className="d68-admin-btn light" disabled={page <= 1} onClick={() => onPage(Math.max(1, page - 1))}>&lt; Trang trước</button>
      <span>{page} / {pageCount}</span>
      <button className="d68-admin-btn light" disabled={page >= pageCount} onClick={() => onPage(Math.min(pageCount, page + 1))}>Trang tiếp &gt;</button>
    </div>
  );
}

function ProposalList({
  proposals: rows,
  markProposal,
  statusFilter,
  setStatusFilter,
  total,
  pending,
}: any) {
  return (
    <Card>
      <div className="d68-admin-row-head">
        <div><h3>Proposal Business → Investor</h3><div className="d68-admin-subtle">Hiển thị {rows.length}/{total} · {pending} chưa duyệt</div></div>
        <label className="d68-admin-queue-filter">Trạng thái<select className="d68-admin-input" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="sent">Chưa duyệt</option><option value="approved">Đã duyệt</option><option value="request_data">Yêu cầu tài liệu</option><option value="connected">Đã kết nối</option><option value="declined">Bỏ qua</option><option value="all">Tất cả</option></select></label>
      </div>
      <div className="d68-admin-table-wrap">
        <table className="d68-admin-table">
          <thead><tr><th>Thời gian</th><th>Doanh nghiệp</th><th>Nhà đầu tư</th><th>Trạng thái</th><th>Action</th></tr></thead>
          <tbody>{rows.map((row: Row) => {
            const status = proposalStatusLabel(row.status, 'vi');
            const business = row.businesses || {};
            const investor = row.investors || {};
            return (
              <tr key={row.id} className={isPendingAdminProposal(row) ? 'd68-admin-row-pending' : ''}>
                <td>{new Date(row.sent_at || row.updated_at || Date.now()).toLocaleString('vi-VN')}</td>
                <td>{business.slug ? <a href={`/businesses/${business.slug}`} target="_blank" rel="noreferrer"><b>{business.company_name_private || business.title_vi || business.title_en || business.public_code || row.business_id}</b></a> : <b>{business.company_name_private || business.title_vi || business.title_en || row.business_id}</b>}<br/><span className="d68-admin-badge warn">{business.public_code || 'Business'}</span></td>
                <td>{investor.code ? <a href={`/investors/${investor.code}`} target="_blank" rel="noreferrer"><b>{investor.private_name || investor.title_vi || investor.title_en || investor.code}</b></a> : <b>{investor.private_name || investor.title_vi || investor.title_en || row.investor_id}</b>}<br/><span>{investor.private_email || investor.code || 'Investor'}</span></td>
                <td><span className={`d68-admin-badge ${status.cls === 'green' ? 'ok' : status.cls === 'red' ? 'err' : 'warn'}`}>{status.label}</span></td>
                <td><div className="d68-admin-actions"><button className="d68-admin-btn green" onClick={() => markProposal(row, 'approved')}>Duyệt</button><button className="d68-admin-btn red" onClick={() => markProposal(row, 'declined')}>Từ chối</button><button className="d68-admin-btn blue" onClick={() => markProposal(row, 'connected')}>Connected</button></div></td>
              </tr>
            );
          })}</tbody>
        </table>
      </div>
      {!rows.length ? <Empty text="Không có Proposal phù hợp bộ lọc." /> : null}
    </Card>
  );
}

function Payments({
  payments: rows,
  profiles,
  markPayment,
  statusFilter,
  setStatusFilter,
  total,
  pending,
}: any) {
  return (
    <Card>
      <div className="d68-admin-row-head">
        <div><h3>Thanh toán / mở dashboard</h3><div className="d68-admin-subtle">Hiển thị {rows.length}/{total} · {pending} chờ xác nhận</div></div>
        <label className="d68-admin-queue-filter">Trạng thái<select className="d68-admin-input" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="pending">Chờ xác nhận</option><option value="confirmed">Đã xác nhận</option><option value="rejected">Đã từ chối</option><option value="all">Tất cả</option></select></label>
      </div>
      {rows.length ? (
        <div className="d68-admin-table-wrap"><table className="d68-admin-table"><thead><tr><th>Order</th><th>Status</th><th>Profile</th><th>Amount</th><th>Action</th></tr></thead><tbody>{rows.map((p: Row) => {
          const account = profiles.find((item: Row) => item.id === (p.profile_id || p.created_by));
          const amount = p.payload?.price?.total || p.payload?.total || '';
          const currency = p.payload?.price?.currency || p.payload?.currency || '';
          const status = String(p.status || '').toLowerCase();
          return <tr key={p.id} className={isPendingAdminPayment(p) ? 'd68-admin-row-pending' : ''}><td><b>{p.title || p.id}</b><br/><code>{paymentOrderCode(p) || '—'}</code><br/><span className="d68-admin-badge warn">{new Date(p.created_at).toLocaleString('vi-VN')}</span></td><td><span className={`d68-admin-badge ${status === 'confirmed' ? 'ok' : status === 'rejected' ? 'err' : 'warn'}`}>{p.status}</span></td><td>{account?.email || p.profile_id || p.created_by || '—'}<br/>{account?.role}</td><td>{amount} {currency}</td><td><div className="d68-admin-actions"><button className="d68-admin-btn green" onClick={() => markPayment(p, 'confirmed')}>Xác nhận thanh toán & mở dashboard</button><button className="d68-admin-btn red" onClick={() => markPayment(p, 'rejected')}>Từ chối</button></div></td></tr>;
        })}</tbody></table></div>
      ) : <Empty text="Không có payment order phù hợp bộ lọc." />}
    </Card>
  );
}

function BusinessAdminList({
  rows,
  allRows,
  pendingRows,
  search,
  setSearch,
  businessStatusFilter,
  setBusinessStatusFilter,
  businessIndustryFilter,
  setBusinessIndustryFilter,
  businessIndustryOptions,
  businessFiles,
  businessImages,
  payments,
}: any) {
  return (
    <>
      <Card>
        <div className="d68-admin-row-head"><div><h3>Quản trị Doanh nghiệp</h3><div className="d68-admin-subtle">Sắp xếp DN mới cập nhật/cần duyệt lên đầu · Kết quả {rows.length}/{allRows.length}</div></div>{pendingRows.length ? <span className="d68-admin-badge warn">⚠️ {pendingRows.length} DN cần duyệt</span> : <span className="d68-admin-badge ok">Không có DN cần duyệt</span>}</div>
        <div className="d68-admin-business-filters"><label>Tên DN / mã / lĩnh vực<input className="d68-admin-input" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm tên DN, mã D68, lĩnh vực, địa phương..." /></label><label>Lĩnh vực<select className="d68-admin-input" value={businessIndustryFilter} onChange={(event) => setBusinessIndustryFilter(event.target.value)}><option value="">Tất cả lĩnh vực</option>{businessIndustryOptions.map((option: string) => <option key={option} value={option}>{option}</option>)}</select></label><label>Tình trạng<select className="d68-admin-input" value={businessStatusFilter} onChange={(event) => setBusinessStatusFilter(event.target.value)}><option value="">Tất cả</option><option value="new_pending">Mới chờ duyệt</option><option value="updated_pending">Có thay đổi chờ duyệt</option><option value="visible">Đang hiển thị</option><option value="hidden">Đang ẩn</option><option value="payment_pending">Chờ thanh toán</option></select></label></div>
      </Card>
      <Card>
        <div className="d68-admin-table-wrap"><table className="d68-admin-table d68-admin-business-table"><thead><tr><th>Tên DN</th><th>Lĩnh vực</th><th>Địa phương</th><th>Gói dịch vụ</th><th>Tình trạng</th><th>Cảnh báo</th><th>Cập nhật</th><th>Thao tác</th></tr></thead><tbody>{rows.map((business: Row) => {
          const source = sourceOf(business);
          const status = businessAdminStatusLabel(business, businessFiles, businessImages, payments);
          const warning = businessReviewWarningText(business, businessFiles, businessImages);
          return <tr key={business.id}><td><b>{businessPrivateTitle(business)}</b><br/><span className="d68-admin-badge warn">{business.public_code || business.slug || 'Business'}</span></td><td>{businessPrimaryIndustry(business)}</td><td>{source.city || business.city || source.country_iso2 || business.country_iso2 || '—'}</td><td>{businessPlanLabel(business)}<br/><span className="d68-admin-subtle">Quota {Number(business.quota_used || 0)}/{Number(business.quota_total || 0)}</span>{business.show_on_homepage ? <><br/><span className="d68-admin-badge ok">Homepage</span></> : null}</td><td><span className={`d68-admin-badge ${status.cls}`}>{status.label}</span></td><td>{warning ? <span className="d68-admin-badge warn">{warning}</span> : <span className="d68-admin-subtle">—</span>}</td><td>{new Date(businessActivityMs(business, businessFiles, businessImages, payments)).toLocaleString('vi-VN')}</td><td><div className="d68-admin-actions"><Link to={`/admin/businesses/${business.id}`} className="d68-admin-btn blue">Xem chi tiết DN</Link>{business.slug ? <a href={`/businesses/${business.slug}`} target="_blank" rel="noreferrer" className="d68-admin-btn blue d68-admin-public-btn">Public ↗</a> : null}</div></td></tr>;
        })}</tbody></table></div>
        {!rows.length ? <Empty text="Không có doanh nghiệp phù hợp bộ lọc." /> : null}
      </Card>
    </>
  );
}

function BusinessQuotaManager({ business, updateBusinessQuota, adjustBusinessQuota }: any) {
  const [quota, setQuota] = useState(Number(business.quota_total || 0));
  useEffect(() => setQuota(Number(business.quota_total || 0)), [business.id, business.quota_total]);
  return <div className="d68-admin-quota-box"><div><b>Quota gửi proposal</b><span>Đã dùng {Number(business.quota_used || 0)} / Tổng quota {Number(business.quota_total || 0)}</span></div><div className="d68-admin-quota-actions"><button type="button" className="d68-admin-btn" onClick={() => adjustBusinessQuota(business, -1)}>-1</button><button type="button" className="d68-admin-btn" onClick={() => adjustBusinessQuota(business, 1)}>+1</button><button type="button" className="d68-admin-btn" onClick={() => adjustBusinessQuota(business, 6)}>+6</button><input className="d68-admin-input" type="number" min="0" value={quota} onChange={(event) => setQuota(Number(event.target.value || 0))} /><button type="button" className="d68-admin-btn green" onClick={() => updateBusinessQuota(business, quota)}>Lưu quota</button></div><p className="d68-admin-subtle">Dùng khi Business có mã giảm giá 100% hoặc cần quota thủ công, ví dụ đặt 6 proposal thay vì 50/80 mặc định.</p></div>;
}

function BusinessPaymentPanel({ business, payments, profiles, markPayment, updateBusinessQuota, adjustBusinessQuota }: any) {
  const rows = payments.filter((payment: Row) => String(payment.business_id || '') === String(business.id));
  return <div className="d68-admin-detail-stack"><Card><div className="d68-admin-grid4"><Metric label="Gói dịch vụ" value={businessPlanLabel(business)} color="#1596cc"/><Metric label="Quota proposal" value={`${Number(business.quota_used || 0)} / ${Number(business.quota_total || 0)}`} color="#B8860B"/><Metric label="Trạng thái" value={businessAdminStatusLabel(business, [], [], payments).label} color="#0F2A4A"/><Metric label="Public" value={business.visible ? 'Đang hiển thị' : 'Đang ẩn'} color={business.visible ? '#16A34A' : '#DC2626'}/></div><BusinessQuotaManager business={business} updateBusinessQuota={updateBusinessQuota} adjustBusinessQuota={adjustBusinessQuota} /></Card><Card><h3>Lịch sử thanh toán</h3>{rows.length ? <div className="d68-admin-table-wrap"><table className="d68-admin-table"><thead><tr><th>Order</th><th>Status</th><th>Profile</th><th>Amount</th><th>Cập nhật</th><th>Action</th></tr></thead><tbody>{rows.map((p: Row) => { const account = profiles.find((item: Row) => item.id === (p.profile_id || p.created_by)); return <tr key={p.id}><td><b>{p.title || p.id}</b><br/><code>{paymentOrderCode(p) || '—'}</code><br/><span className="d68-admin-subtle">{p.payload?.orderType || p.payload?.businessPlan || 'payment'}</span></td><td><span className={`d68-admin-badge ${String(p.status).toLowerCase() === 'confirmed' ? 'ok' : 'warn'}`}>{p.status}</span></td><td>{account?.email || p.profile_id || p.created_by || '—'}</td><td>{paymentAmountLabel(p)}</td><td>{new Date(p.updated_at || p.created_at || Date.now()).toLocaleString('vi-VN')}</td><td><div className="d68-admin-actions"><button className="d68-admin-btn green" onClick={() => markPayment(p, 'confirmed')}>Xác nhận</button><button className="d68-admin-btn red" onClick={() => markPayment(p, 'rejected')}>Từ chối</button></div></td></tr>; })}</tbody></table></div> : <Empty text="Business này chưa có payment order." />}</Card></div>;
}

function BusinessAdminDetail({
  b: business,
  payments,
  profiles,
  approveBusiness,
  toggleBusiness,
  setBusinessHomepage,
  markPayment,
  updateBusinessQuota,
  adjustBusinessQuota,
  businessFiles,
  businessImages,
  adminId,
  onAssetsApproved,
}: any) {
  const [detailTab, setDetailTab] = useState<'payments' | 'info' | 'assets'>('info');
  const sections = businessReviewSections(business, businessFiles, businessImages);
  const status = businessAdminStatusLabel(business, businessFiles, businessImages, payments);
  return <div className="d68-admin-business-detail"><Card><div className="d68-admin-row-head"><div><Link to="/admin/businesses" className="d68-admin-subtle">← Quay lại danh sách business</Link><h2>{businessPrivateTitle(business)}</h2><div className="d68-admin-subtle">{business.public_code || 'D68'} · {businessPrimaryIndustry(business)} · {sourceOf(business).city || business.city || '—'} · public v{business.public_version || 0}</div></div><span className={`d68-admin-badge ${status.cls}`}>{status.label}</span></div><div className="d68-admin-notice"><label className="d68-admin-check"><input type="checkbox" checked={!!business.show_on_homepage} onChange={(event) => setBusinessHomepage(business, event.target.checked)} /><b>Hiển thị Homepage</b></label><span className="d68-admin-subtle">Business mới mặc định không được chọn. Nếu chọn trên 6 Business, Homepage lấy ngẫu nhiên 6; nếu chọn dưới 6, hệ thống bổ sung Business public khác cho đủ 6.</span></div>{sections.length ? <div className="d68-admin-notice warn">Doanh nghiệp vừa sửa {sections.join(', ')}, cần kiểm tra và duyệt.</div> : null}<div className="d68-admin-detail-tabs"><button className={detailTab === 'payments' ? 'active' : ''} onClick={() => setDetailTab('payments')}>Thanh toán & Quota</button><button className={detailTab === 'info' ? 'active' : ''} onClick={() => setDetailTab('info')}>Thông tin</button><button className={detailTab === 'assets' ? 'active' : ''} onClick={() => setDetailTab('assets')}>Hình ảnh & Files</button></div></Card>{detailTab === 'payments' ? <BusinessPaymentPanel business={business} payments={payments} profiles={profiles} markPayment={markPayment} updateBusinessQuota={updateBusinessQuota} adjustBusinessQuota={adjustBusinessQuota} /> : null}{detailTab === 'info' ? <BusinessPublicEditor business={business} onApprove={approveBusiness} onToggle={toggleBusiness} businessFiles={businessFiles} businessImages={businessImages} /> : null}{detailTab === 'assets' ? <AssetEditor business={business} adminId={adminId} onRefresh={onAssetsApproved} /> : null}</div>;
}

function BusinessReviewList({ rows, approveBusiness, toggleBusiness, businessFiles = [], businessImages = [] }: any) {
  return <div>{rows.length ? rows.map((business: Row) => <BusinessPublicEditor key={business.id} business={business} onApprove={approveBusiness} onToggle={toggleBusiness} businessFiles={businessFiles} businessImages={businessImages} />) : <Empty text="No business pending review." />}</div>;
}

function adminCompareValue(value: any, key: string) {
  if (value === null || value === undefined || value === '') return '—';
  if (['revenue_month', 'revenue_2025', 'ask_amount', 'offer_amount', 'self_valuation'].includes(key)) {
    const number = Number(value || 0);
    return Number.isFinite(number) ? number.toLocaleString('vi-VN') : String(value);
  }
  if (typeof value === 'object') return JSON.stringify(value, null, 2);
  return String(value);
}

function BusinessPendingComparison({ business }: { business: Row }) {
  const pending = objectOf(business.pending_changes_json);
  const current = { ...business, ...publicOf(business) };
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
  const changedRows = fields.filter(([key]) => hasOwn(pending, key) && JSON.stringify(pending[key]) !== JSON.stringify(current[key]));
  if (!changedRows.length) return null;
  return <div className="d68-admin-table-wrap"><table className="d68-admin-table"><thead><tr><th>Trường Business sửa</th><th>Dữ liệu đang public/đã duyệt</th><th>Dữ liệu Business đề xuất</th></tr></thead><tbody>{changedRows.map(([key, label]) => <tr key={key}><td><b>{label}</b></td><td><pre>{adminCompareValue(current[key], key)}</pre></td><td><span className="d68-admin-badge warn">Đã thay đổi</span><pre>{adminCompareValue(pending[key], key)}</pre></td></tr>)}</tbody></table></div>;
}

function AdminBusinessLocationFields({
  city,
  cityKey,
  countryIso2,
}: {
  city: string;
  cityKey: string;
  countryIso2: string;
}) {
  const iso2 = String(countryIso2 || 'VN').toUpperCase();
  const options = getLocationOptionsForCountry(iso2);
  const resolvedKey = locationKeyFromLabel(cityKey || city, iso2);
  const legacyCity = String(city || '').trim();
  const defaultKey = resolvedKey || (!legacyCity ? options[0]?.key || '' : '');

  return <>
    <label className="d68-admin-field">
      <span>Tỉnh/Thành phố</span>
      {options.length ? <>
        <select name="city_key" defaultValue={defaultKey} className="d68-admin-input">
          {!resolvedKey && legacyCity ? <option value="">{legacyCity}</option> : null}
          {options.map((item) => <option key={item.key} value={item.key}>{item.vi}</option>)}
        </select>
        <input type="hidden" name="city" value={legacyCity} />
      </> : <>
        <input name="city" defaultValue={legacyCity} placeholder="City" className="d68-admin-input" />
        <input type="hidden" name="city_key" value={resolvedKey} />
      </>}
    </label>
    <label className="d68-admin-field">
      <span>Quốc gia (ISO2)</span>
      <input name="country_iso2" defaultValue={iso2} placeholder="Country ISO2" className="d68-admin-input" />
    </label>
  </>;
}

function BusinessPublicEditor({
  business,
  onApprove,
  onToggle,
  businessFiles = [],
  businessImages = [],
}: any) {
  const pending = objectOf(business.pending_changes_json);
  const hasPending = Object.keys(pending).length > 0;
  const source = sourceOf(business);
  const publicRow = publicOf(business);
  const sections = businessReviewSections(business, businessFiles, businessImages);
  const pendingFiles = businessFiles.filter((file: Row) => String(file.business_id) === String(business.id) && isPendingBusinessFile(file));
  const pendingImages = businessImages.filter((image: Row) => String(image.business_id) === String(business.id) && isPendingBusinessImage(image));
  const reviewValue = (key: string, fallback: any = '') => {
    if (hasPending && hasOwn(pending, key)) return pending[key] ?? '';
    return publicRow[key] ?? source[key] ?? fallback;
  };
  const reviewLines = (key: string) => lines(reviewValue(key));
  const warningText = sections.length
    ? `Doanh nghiệp vừa sửa ${sections.join(', ')}, cần kiểm tra và duyệt.`
    : 'Doanh nghiệp cần Admin kiểm tra và duyệt trước khi public.';

  return <Card><form key={`${business.id}:${business.updated_at || ''}:${business.pending_submitted_at || ''}`} onSubmit={(event) => onApprove(event, business)}><div className="d68-admin-row-head"><div><b>{business.public_code || 'D68'} · {business.company_name_private || source.company_name_private || 'Private name pending'}</b><div className="d68-admin-subtle">{business.status || 'pending'} · public v{business.public_version || 0} · {business.public_snapshot_json ? 'has snapshot' : 'no snapshot'} · {business.pending_submitted_at ? `pending ${new Date(business.pending_submitted_at).toLocaleString('vi-VN')}` : 'no pending text'}</div></div><span className={`d68-admin-badge ${business.visible ? 'ok' : 'warn'}`}>{business.visible ? 'visible' : 'not public'}</span></div><div className="d68-admin-notice warn">{warningText}</div>{hasPending ? <BusinessPendingComparison business={business} /> : null}{sections.length ? <div className="d68-admin-actions">{sections.map((label) => <span key={label} className="d68-admin-badge warn">{label}</span>)}</div> : null}{pendingFiles.length || pendingImages.length ? <details className="d68-admin-source" open><summary>Tài sản cần duyệt: {pendingFiles.length} file · {pendingImages.length} ảnh</summary><pre>{JSON.stringify({ files: pendingFiles.map((file: Row) => ({ id: file.id, file_name: file.file_name, display_name: file.display_name, public_visible: file.public_visible, privacy_level: file.privacy_level, admin_note: file.admin_note })), images: pendingImages.map((image: Row) => ({ id: image.id, title: image.title, display_title: image.display_title, public_visible: image.public_visible, is_sanitized: image.is_sanitized, admin_note: image.admin_note })) }, null, 2)}</pre><p className="d68-admin-subtle">Duyệt/đổi tên/làm sạch ảnh-file tại tab “Hình ảnh & Files” hoặc “Ảnh/File DN”.</p></details> : null}{hasPending ? <details className="d68-admin-source" open><summary>Thay đổi doanh nghiệp vừa gửi</summary><pre>{JSON.stringify(pending, null, 2)}</pre></details> : <details className="d68-admin-source"><summary>Xem dữ liệu nguồn</summary><pre>{JSON.stringify(source, null, 2)}</pre></details>}<div className="d68-admin-form4"><label className="d68-admin-field"><span>Tiêu đề ẩn danh (hiển thị public, VN)</span><input name="title_vi" defaultValue={reviewValue('title_vi') || 'Hồ sơ doanh nghiệp ẩn danh'} placeholder="Tên ẩn danh VI" required className="d68-admin-input"/></label><label className="d68-admin-field"><span>Tiêu đề ẩn danh (hiển thị public, EN)</span><input name="title_en" defaultValue={reviewValue('title_en') || autoEn(String(reviewValue('title_vi') || ''))} placeholder="Anonymous title EN" className="d68-admin-input"/></label><input name="industry" defaultValue={reviewValue('industry')} placeholder="Industry" className="d68-admin-input"/><input name="deal_type" defaultValue={reviewValue('deal_type')} placeholder="Deal type" className="d68-admin-input"/><AdminBusinessLocationFields city={String(reviewValue('city') || '')} cityKey={String(reviewValue('city_key') || '')} countryIso2={String(reviewValue('country_iso2', 'VN') || 'VN')} /><AdminNumberInput name="revenue_month" value={reviewValue('revenue_month', 0)} placeholder="Doanh thu tháng"/><AdminNumberInput name="revenue_2025" value={reviewValue('revenue_2025', 0)} placeholder="Doanh thu năm"/><select name="revenue_currency" defaultValue={reviewValue('revenue_currency', 'VND')} className="d68-admin-input"><option>VND</option><option>USD</option></select><AdminNumberInput name="ebitda_margin" value={reviewValue('ebitda_margin', 0)} placeholder="EBITDA %" allowDecimal/><AdminNumberInput name="growth_pct" value={reviewValue('growth_pct', 0)} placeholder="Tăng trưởng năm %" allowDecimal/><AdminNumberInput name="ask_amount" value={reviewValue('ask_amount', 0)} placeholder="Nhu cầu vốn/Giá chào"/><select name="ask_currency" defaultValue={reviewValue('ask_currency') || reviewValue('revenue_currency', 'VND')} className="d68-admin-input"><option>VND</option><option>USD</option></select><AdminNumberInput name="stake_pct" value={reviewValue('stake_pct', 0)} placeholder="Tỷ lệ cổ phần %" allowDecimal/><AdminNumberInput name="quality_score" value={reviewValue('quality_score', business.quality_score ?? 0)} placeholder="Business Quality Score 0-100"/><label className="d68-admin-check"><input name="quality_score_manual_override" type="checkbox" defaultChecked={!!business.quality_score_manual_override}/> Giữ điểm Admin nhập</label><AdminNumberInput name="data_confidence" value={reviewValue('data_confidence', business.data_confidence ?? 0)} placeholder="Data confidence"/><input name="hero_image_url" defaultValue={reviewValue('hero_image_url') || reviewValue('image_url')} placeholder="Approved hero image URL" className="d68-admin-input d68-admin-span2"/><label className="d68-admin-field d68-admin-span2"><span>Mô tả/Giới thiệu (hiển thị public, VN)</span><textarea name="description_vi" defaultValue={reviewValue('description_vi')} placeholder="Mô tả public VI" className="d68-admin-input textarea"/></label><label className="d68-admin-field d68-admin-span2"><span>Mô tả/Giới thiệu (hiển thị public, EN)</span><textarea name="description_en" defaultValue={reviewValue('description_en') || autoEn(String(reviewValue('description_vi') || ''))} placeholder="Description EN" className="d68-admin-input textarea"/></label><label className="d68-admin-field d68-admin-span2"><span>Điểm nổi bật (hiển thị public, VN)</span><textarea name="highlights_vi" defaultValue={reviewLines('highlights_vi')} placeholder="Mỗi dòng là một điểm nổi bật public" className="d68-admin-input textarea"/></label><label className="d68-admin-field d68-admin-span2"><span>Điểm nổi bật (hiển thị public, EN)</span><textarea name="highlights_en" defaultValue={reviewLines('highlights_en') || autoEn(reviewLines('highlights_vi'))} placeholder="Each line is one public highlight" className="d68-admin-input textarea"/></label><textarea name="investment_reason_vi" defaultValue={reviewValue('investment_reason_vi')} placeholder="Lý do giao dịch VI" className="d68-admin-input textarea d68-admin-span2"/><textarea name="investment_reason_en" defaultValue={reviewValue('investment_reason_en') || autoEn(String(reviewValue('investment_reason_vi') || ''))} placeholder="Reason EN" className="d68-admin-input textarea d68-admin-span2"/></div><div className="d68-admin-actions"><button className="d68-admin-btn green">Duyệt & hiển thị public snapshot</button><button type="button" onClick={() => onToggle(business)} className={`d68-admin-btn ${business.visible ? 'red' : ''}`}>{business.visible ? 'Ẩn public' : 'Bật visible'}</button>{business.slug ? <Link to={`/businesses/${business.slug}`} className="d68-admin-btn blue">Public ↗</Link> : null}{pendingFiles.length || pendingImages.length ? <Link to="/admin/assets" className="d68-admin-btn blue">Duyệt ảnh/file ↗</Link> : null}</div></form></Card>;
}

function AssetEditor({ business, adminId, onRefresh }: { business: Row; adminId?: string; onRefresh?: () => void | Promise<void> }) {
  return <Card><AdminBusinessAssets business={business} adminId={adminId} onRefresh={onRefresh} /></Card>;
}

function Promos({ promos, createPromo }: any) {
  return <Card><h3>Mã khuyến mãi</h3><form onSubmit={createPromo} className="d68-admin-form4 d68-admin-form-gap"><input required name="code" placeholder="CODE" className="d68-admin-input"/><input name="description" placeholder="Description" className="d68-admin-input"/><select name="role" className="d68-admin-input"><option value="business">business</option><option value="investor">investor</option><option value="advisor">advisor</option><option value="affiliate">affiliate</option></select><input name="discount_pct" type="number" placeholder="%" className="d68-admin-input"/><input name="quota_total" type="number" placeholder="Quota" className="d68-admin-input"/><input name="starts_at" type="datetime-local" className="d68-admin-input"/><input name="ends_at" type="datetime-local" className="d68-admin-input"/><button className="d68-admin-btn green">Tạo mã</button></form>{promos.map((promo: Row) => <div key={promo.id} className="d68-admin-card"><b>{promo.code}</b> · {promo.discount_pct}% · {promo.role} · {promo.active ? 'active' : 'inactive'}</div>)}</Card>;
}

function Requests({ requests, markRequest }: any) {
  return <Card><h3>Yêu cầu data</h3>{requests.length ? requests.map((request: Row) => <div key={request.id} className="d68-admin-card"><b>{request.businesses?.public_code || request.business_id}</b> ← {request.investors?.code || request.investor_id}<p>{request.note}</p><span>{request.status}</span><div className="d68-admin-actions"><button className="d68-admin-btn blue" onClick={() => markRequest(request, 'forwarded')}>Forwarded</button><button className="d68-admin-btn green" onClick={() => markRequest(request, 'fulfilled')}>Fulfilled</button><button className="d68-admin-btn red" onClick={() => markRequest(request, 'rejected')}>Rejected</button></div></div>) : <Empty text="No data requests." />}</Card>;
}

function Leads({ contactMessages, partnerLeads, markLead }: any) {
  return <div><Card><h3>Contact messages</h3>{contactMessages.length ? contactMessages.map((message: Row) => <div key={message.id} className="d68-admin-card"><b>{message.name}</b> · <a href={`mailto:${message.email}`}>{message.email}</a><p>{message.message}</p><span className="d68-admin-badge warn">{message.status}</span><div className="d68-admin-actions"><button className="d68-admin-btn green" onClick={() => markLead('contact_messages', message, 'handled')}>Handled</button><button className="d68-admin-btn blue" onClick={() => markLead('contact_messages', message, 'follow_up')}>Follow up</button></div></div>) : <Empty text="No contact messages." />}</Card><Card><h3>Market Partner leads</h3>{partnerLeads.length ? partnerLeads.map((lead: Row) => <div key={lead.id} className="d68-admin-card"><b>{lead.full_name}</b> · <a href={`mailto:${lead.email}`}>{lead.email}</a> · {lead.country}<p>{lead.phone}</p><p>{lead.intro}</p><span className="d68-admin-badge warn">{lead.status}</span><div className="d68-admin-actions"><button className="d68-admin-btn green" onClick={() => markLead('partner_leads', lead, 'approved')}>Approved</button><button className="d68-admin-btn blue" onClick={() => markLead('partner_leads', lead, 'follow_up')}>Follow up</button><button className="d68-admin-btn red" onClick={() => markLead('partner_leads', lead, 'rejected')}>Rejected</button></div></div>) : <Empty text="No partner leads." />}</Card></div>;
}

function Logs({ logs }: { logs: Row[] }) {
  return <Card><h3>Audit logs</h3>{logs.length ? <div className="d68-admin-table-wrap"><table className="d68-admin-table"><tbody>{logs.map((log) => <tr key={log.id}><td>{new Date(log.created_at).toLocaleString()}</td><td><b>{log.action}</b></td><td>{log.entity_type}</td><td><pre>{JSON.stringify(log.detail || {}, null, 2)}</pre></td></tr>)}</tbody></table></div> : <Empty text="No audit logs." />}</Card>;
}

function Settings() {
  return <Card><h3>Cài đặt & kiểm thử baseline</h3><p>Không có secret/service_role key trong frontend. Admin chạy bằng Supabase RLS + profile.role=admin.</p><ul className="d68-admin-steps"><li>Public Business phải có visible=true, status=active, public_snapshot_json.</li><li>Business user edit chỉ vào pending_changes_json.</li><li>Investor lưu ngay tiêu chí đầu tư; chỉ Giới thiệu, ảnh và files vào hàng chờ duyệt.</li><li>Admin duyệt nội dung ẩn danh mới public.</li><li>Contact và Market Partner leads lưu vào bảng riêng, Admin xem tại /admin/leads.</li></ul></Card>;
}
