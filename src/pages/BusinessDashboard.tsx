import { FormEvent, useEffect, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { BarChart3, BriefcaseBusiness, CreditCard, FileText, Image as ImageIcon, Inbox, LayoutDashboard, Users } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import {
  deleteBusinessFile,
  deleteBusinessImage,
  getMyBusiness,
  updateBusinessFile,
  updateBusinessImage,
  uploadBusinessFile,
  uploadBusinessImage
} from '../lib/data';
import { supabase } from '../lib/supabase';

type Lang = 'vi' | 'en';
type Tab = 'overview' | 'profile' | 'documents' | 'images' | 'interests' | 'requests' | 'services';
const T = (lang: Lang, vi: string, en: string) => lang === 'en' ? en : vi;

const tabs = [
  { id: 'overview' as Tab, Icon: LayoutDashboard, vi: 'Tổng quan', en: 'Overview', href: '/dashboard/business' },
  { id: 'profile' as Tab, Icon: BriefcaseBusiness, vi: 'Hồ sơ & số liệu', en: 'Profile & data', href: '/dashboard/business/profile' },
  { id: 'documents' as Tab, Icon: FileText, vi: 'Tài liệu', en: 'Documents', href: '/dashboard/business/files' },
  { id: 'images' as Tab, Icon: ImageIcon, vi: 'Ảnh', en: 'Images', href: '/dashboard/business/images' },
  { id: 'interests' as Tab, Icon: Users, vi: 'Nhà đầu tư', en: 'Investors', href: '/dashboard/business/investor-interest' },
  { id: 'requests' as Tab, Icon: Inbox, vi: 'Yêu cầu data', en: 'Data requests', href: '/dashboard/business/data-requests' },
  { id: 'services' as Tab, Icon: CreditCard, vi: 'Dịch vụ & phí', en: 'Services & billing', href: '/dashboard/business/payments' }
];

const tabMap: Record<string, Tab> = {
  '': 'overview',
  profile: 'profile',
  files: 'documents',
  documents: 'documents',
  images: 'images',
  'investor-interest': 'interests',
  interests: 'interests',
  proposals: 'interests',
  'data-requests': 'requests',
  requests: 'requests',
  payments: 'services',
  services: 'services',
  plan: 'services'
};

const INDUSTRY_VI = ['F&B','Y tế & Sức khỏe','Làm đẹp & Chăm sóc cá nhân','Bán lẻ','Sản xuất','Công nghệ','Bất động sản','Logistics','Giáo dục','Năng lượng','Thủy sản & Xuất khẩu'];
const DEAL_TYPE_VI = ['Gọi vốn','Bán cổ phần','M&A / Chuyển nhượng','Vay vốn','JV / Đối tác','Chuyển nhượng tài sản'];
const DOC_ACCEPT = '.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

function resolveTab(pathname: string): Tab {
  const suffix = pathname.replace('/dashboard/business','').replace(/^\//,'').split('/')[0];
  return tabMap[suffix] || 'overview';
}

function qBand(score: number) {
  if (score >= 80) return { labelVi: 'Mạnh', labelEn: 'Strong', cls: 'green' };
  if (score >= 65) return { labelVi: 'Tốt', labelEn: 'Good', cls: 'blue' };
  return { labelVi: 'Cần bổ sung', labelEn: 'Needs data', cls: 'gold' };
}

function ext(name = '', type = '') {
  const e = name.includes('.') ? name.split('.').pop()?.toUpperCase() : '';
  if (e) return e;
  if (type.includes('pdf')) return 'PDF';
  if (type.includes('excel') || type.includes('spreadsheet')) return 'XLSX';
  if (type.includes('word')) return 'DOCX';
  if (type.includes('presentation')) return 'PPT';
  return type || 'FILE';
}

function viIndustry(raw: any) {
  const v = String(raw || '').toLowerCase();
  if (v.includes('health')) return 'Y tế & Sức khỏe';
  if (v.includes('beauty') || v.includes('personal')) return 'Làm đẹp & Chăm sóc cá nhân';
  if (v.includes('retail')) return 'Bán lẻ';
  if (v.includes('manufact')) return 'Sản xuất';
  if (v.includes('tech')) return 'Công nghệ';
  if (v.includes('real')) return 'Bất động sản';
  if (v.includes('logistics')) return 'Logistics';
  if (v.includes('education')) return 'Giáo dục';
  if (v.includes('energy')) return 'Năng lượng';
  if (v.includes('seafood')) return 'Thủy sản & Xuất khẩu';
  return raw || 'F&B';
}

function viDealType(raw: any) {
  const v = String(raw || '').toLowerCase();
  if (v.includes('fund') || v.includes('primary') || v.includes('share') || v.includes('equity')) return 'Gọi vốn';
  if (v.includes('loan') || v.includes('debt')) return 'Vay vốn';
  if (v.includes('asset')) return 'Chuyển nhượng tài sản';
  if (v.includes('sale') || v.includes('m&a') || v.includes('transfer') || v.includes('acquisition')) return 'M&A / Chuyển nhượng';
  if (v.includes('jv') || v.includes('partner')) return 'JV / Đối tác';
  return raw || 'Gọi vốn';
}

function fieldValue(fd: FormData, name: string) {
  return String(fd.get(name) || '').trim();
}

function metric(label: string, value: string, cls = 'blue', note?: string) {
  return <div className="d68-dashboard-card d68-dashboard-metric-card">
    <div className="d68-dashboard-mini">{label}</div>
    <h2 className={`d68-dashboard-badge ${cls}`} style={{ marginTop: 8 }}>{value}</h2>
    {note ? <p>{note}</p> : null}
  </div>;
}

function isApprovedStatus(status: any) {
  return ['approved', 'connected', 'fulfilled'].includes(String(status || '').toLowerCase());
}

function fileMatches(file: any, categories: string[], extensions: string[] = []) {
  const category = String(file?.category || '').toLowerCase();
  const fileExt = ext(file?.file_name || file?.display_name || '', file?.file_type || '').toLowerCase();
  return categories.some((x) => category.includes(x)) || extensions.some((x) => fileExt.includes(x));
}

function financialInputOf(b: any) {
  const direct = b?.financial_input && typeof b.financial_input === 'object' ? b.financial_input : {};
  const pending = b?.pending_changes_json?.financial_input && typeof b.pending_changes_json.financial_input === 'object' ? b.pending_changes_json.financial_input : {};
  return { ...pending, ...direct };
}

function buildQualityItems(lang: Lang, b: any, files: any[], images: any[]) {
  const financialInput = financialInputOf(b);
  const hasFinancialData = Number(b?.revenue_2025 || 0) > 0 && b?.ebitda_margin !== null && b?.ebitda_margin !== undefined;
  return [
    {
      ok: images.length > 0,
      label: T(lang, 'Ảnh doanh nghiệp', 'Business images'),
      detail: images.length ? T(lang, `${images.length} ảnh đã gửi`, `${images.length} image(s) submitted`) : T(lang, 'Chưa gửi ảnh doanh nghiệp', 'Missing business images')
    },
    {
      ok: files.some((f) => fileMatches(f, ['profile', 'im', 'teaser'], ['pdf', 'ppt', 'pptx', 'doc', 'docx'])),
      label: T(lang, 'Hồ sơ doanh nghiệp / Teaser / IM', 'Business profile / teaser / IM'),
      detail: T(lang, 'PDF, Word, PowerPoint hoặc hồ sơ giới thiệu', 'PDF, Word, PowerPoint or profile deck')
    },
    {
      ok: files.some((f) => fileMatches(f, ['financial'], ['xls', 'xlsx', 'pdf'])),
      label: T(lang, 'Báo cáo tài chính / Excel số liệu', 'Financial statements / Excel data'),
      detail: T(lang, 'Báo cáo tài chính, Excel doanh thu, lợi nhuận, EBITDA', 'Financial statements, revenue, profit or EBITDA files')
    },
    {
      ok: hasFinancialData,
      label: T(lang, 'Doanh thu & EBITDA', 'Revenue & EBITDA'),
      detail: hasFinancialData ? T(lang, 'Đã có số liệu tài chính chính', 'Core financial metrics provided') : T(lang, 'Cần bổ sung doanh thu và EBITDA', 'Revenue and EBITDA are missing')
    },
    {
      ok: !!(financialInput.assets_owned || financialInput.financial_data_source || financialInput.excluded_physical_asset_value),
      label: T(lang, 'Tài sản & nguồn số liệu', 'Assets & data source'),
      detail: T(lang, 'Tài sản hữu hình/vô hình, tài sản loại trừ, nguồn số liệu', 'Tangible/intangible assets, excluded assets and data source')
    },
    {
      ok: Number(b?.ask_amount || 0) > 0 && Number(b?.stake_pct || 0) > 0,
      label: T(lang, 'Định giá / nhu cầu vốn', 'Valuation / capital ask'),
      detail: T(lang, 'Nhu cầu vốn hoặc giá chào và tỷ lệ cổ phần', 'Ask amount or asking price and stake percentage')
    }
  ];
}

function displayStatus(lang: Lang, b: any, hasPublicSnapshot: boolean) {
  const visible = !!b?.visible && String(b?.status || '').toLowerCase() === 'active' && hasPublicSnapshot;
  return {
    label: visible ? T(lang, 'Hiển thị', 'Visible') : T(lang, 'Đang ẩn', 'Hidden'),
    cls: visible ? 'green' : 'gold'
  };
}

function displayPlan(lang: Lang, plan: any) {
  return String(plan || '').toLowerCase().includes('featured') ? T(lang, 'Ưu tiên', 'Priority') : T(lang, 'Thường', 'Standard');
}


const FX_VND_PER_USD = 25000;

function currencyToUsd(value: number, currency: any) {
  const cur = String(currency || 'VND').toUpperCase();
  return cur === 'USD' ? value : value / FX_VND_PER_USD;
}

function currencyToVnd(value: number, currency: any) {
  const cur = String(currency || 'VND').toUpperCase();
  return cur === 'USD' ? value * FX_VND_PER_USD : value;
}

function estimateEnterpriseValue(row: any) {
  const ask = Number(row?.ask_amount || 0);
  const stake = Number(row?.stake_pct || 0);
  if (!ask || !stake || stake <= 0) return null;
  return { value: ask / (stake / 100), currency: String(row?.ask_currency || row?.revenue_currency || 'VND').toUpperCase() };
}

function formatValuation(lang: Lang, valuation: { value: number; currency: string } | null) {
  if (!valuation || !Number.isFinite(valuation.value) || valuation.value <= 0) return T(lang, 'Chưa đủ dữ liệu', 'Not enough data');
  if (lang === 'en') {
    const usd = currencyToUsd(valuation.value, valuation.currency);
    if (usd >= 1_000_000) return `US$${(usd / 1_000_000).toLocaleString('en-US', { maximumFractionDigits: 1 })}M`;
    if (usd >= 1_000) return `US$${(usd / 1_000).toLocaleString('en-US', { maximumFractionDigits: 0 })}K`;
    return `US$${Math.round(usd).toLocaleString('en-US')}`;
  }
  const vnd = currencyToVnd(valuation.value, valuation.currency);
  if (vnd >= 1_000_000_000) return `${(vnd / 1_000_000_000).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} tỷ VNĐ`;
  if (vnd >= 1_000_000) return `${(vnd / 1_000_000).toLocaleString('vi-VN', { maximumFractionDigits: 0 })} triệu VNĐ`;
  return `${Math.round(vnd).toLocaleString('vi-VN')} VNĐ`;
}

function median(values: number[]) {
  const sorted = values.filter((x) => Number.isFinite(x) && x > 0).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function industryKey(raw: any) {
  return viIndustry(raw).toLowerCase().replace(/\s+/g, ' ').trim();
}

function revenueUsd(row: any) {
  return currencyToUsd(Number(row?.revenue_2025 || 0), row?.revenue_currency || 'VND');
}

function estimateIndustryBenchmark(current: any, rows: any[]) {
  const currentRevenue = revenueUsd(current);
  const currentIndustry = industryKey(current?.industry);
  const peers = (rows || [])
    .filter((row) => row?.id !== current?.id)
    .filter((row) => industryKey(row?.industry) === currentIndustry)
    .filter((row) => String(row?.country_iso2 || '').toUpperCase() === String(current?.country_iso2 || '').toUpperCase())
    .map((row) => ({ row, valuation: estimateEnterpriseValue(row), revenue: revenueUsd(row) }))
    .filter((x) => x.valuation && x.revenue > 0);
  const revenueMatched = currentRevenue > 0 ? peers.filter((x) => x.revenue >= currentRevenue * 0.5 && x.revenue <= currentRevenue * 2) : peers;
  const chosen = revenueMatched.length ? revenueMatched : peers;
  const usdValues = chosen.map((x) => currencyToUsd(x.valuation!.value, x.valuation!.currency));
  const usd = median(usdValues);
  return usd ? { value: usd, currency: 'USD', sampleSize: chosen.length, revenueMatched: revenueMatched.length > 0 } : null;
}

function splitNumericParts(value: any, allowDecimal = false) {
  const raw = String(value ?? '').replace(/\s/g, '').replace(/[^0-9,.-]/g, '');
  const negative = raw.startsWith('-') ? '-' : '';
  let body = raw.replace(/-/g, '');
  let decimal = '';
  let hasDecimal = false;
  if (allowDecimal) {
    const commaIndex = body.lastIndexOf(',');
    if (commaIndex >= 0) {
      hasDecimal = true;
      decimal = body.slice(commaIndex + 1).replace(/\D/g, '').slice(0, 2);
      body = body.slice(0, commaIndex);
    }
  }
  const integer = body.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
  return { negative, integer, decimal, hasDecimal };
}

function formatTypedNumber(value: any, allowDecimal = false) {
  const { negative, integer, decimal, hasDecimal } = splitNumericParts(value, allowDecimal);
  if (!integer && !decimal) return '';
  const grouped = (integer || '0').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${negative}${grouped}${hasDecimal ? `,${decimal}` : ''}`;
}

function numberValue(value: any, allowDecimal = false) {
  const { negative, integer, decimal } = splitNumericParts(value, allowDecimal);
  if (!integer && !decimal) return '';
  return `${negative}${integer || '0'}${allowDecimal && decimal ? `.${decimal}` : ''}`;
}

function formatInitialNumber(value: any, allowDecimal = false) {
  if (value === null || value === undefined || value === '') return '';
  const [integer, decimal = ''] = String(value).split('.');
  const formatted = String(integer || '0').replace(/\D/g, '').replace(/^0+(?=\d)/, '').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return allowDecimal && decimal ? `${formatted || '0'},${decimal.slice(0, 2)}` : (formatted || '0');
}

function FormattedNumberInput({ name, defaultValue, allowDecimal = false }: { name: string; defaultValue?: any; allowDecimal?: boolean }) {
  const [display, setDisplay] = useState(formatInitialNumber(defaultValue, allowDecimal));
  return <>
    <input className="d68-dashboard-input" inputMode={allowDecimal ? 'decimal' : 'numeric'} value={display} onChange={(e) => setDisplay(formatTypedNumber(e.target.value, allowDecimal))} />
    <input type="hidden" name={name} value={numberValue(display, allowDecimal)} />
  </>;
}

function ValuationOverviewBox({ lang, valuation, benchmark }: any) {
  return <div className="d68-dashboard-valuation-box">
    <div>
      <span>{T(lang, 'Giá trị doanh nghiệp', 'Business value')}</span>
      <strong>{formatValuation(lang, valuation)}</strong>
    </div>
    <div>
      <span>{T(lang, 'Tham chiếu ngành', 'Industry benchmark')}</span>
      <strong>{benchmark ? formatValuation(lang, benchmark) : T(lang, 'Chưa đủ dữ liệu tham chiếu', 'Not enough benchmark data')}</strong>
      {benchmark ? <small>{T(lang, `Mẫu tham chiếu: ${benchmark.sampleSize} hồ sơ cùng ngành/quốc gia`, `Reference sample: ${benchmark.sampleSize} same-industry/country profile(s)`)}</small> : <small>{T(lang, 'Cần thêm hồ sơ cùng ngành, cùng quốc gia và có đủ số liệu định giá.', 'More same-industry, same-country listings with valuation data are needed.')}</small>}
    </div>
  </div>;
}

export default function BusinessDashboard() {
  const { profile, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [lang, setLang] = useState<Lang>('vi');
  const [tab, setTab] = useState<Tab>(() => resolveTab(location.pathname));
  const [b, setB] = useState<any>(null);
  const [files, setFiles] = useState<any[]>([]);
  const [images, setImages] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [interests, setInterests] = useState<any[]>([]);
  const [proposals, setProposals] = useState<any[]>([]);
  const [savedBusinesses, setSavedBusinesses] = useState<any[]>([]);
  const [benchmarkBusinesses, setBenchmarkBusinesses] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [newDocName, setNewDocName] = useState('');
  const [newDocCategory, setNewDocCategory] = useState('financials');

  useEffect(() => setTab(resolveTab(location.pathname)), [location.pathname]);

  async function load() {
    if (!profile) return;
    setBusy(true); setErr('');
    try {
      const biz = await getMyBusiness(profile.id);
      setB(biz);
      if (biz) {
        const [filesRes, imagesRes, requestsRes, interestsRes, paymentsRes, proposalsRes, savedRes, benchmarkRes] = await Promise.all([
          supabase.from('business_files').select('*').eq('business_id', biz.id).order('created_at', { ascending: false }),
          supabase.from('business_images').select('*').eq('business_id', biz.id).order('sort_order', { ascending: true, nullsFirst: false }).order('created_at', { ascending: true }),
          supabase.from('request_data').select('*, investors(code,title_en,title_vi,type,country)').eq('business_id', biz.id).order('created_at', { ascending: false }),
          supabase.from('investor_interests').select('*, investors(id,code,title_en,title_vi,type,country,industries,deal_types,ticket_min,ticket_max)').eq('business_id', biz.id).order('created_at', { ascending: false }),
          supabase.from('payment_orders').select('*').eq('business_id', biz.id).order('created_at', { ascending: false }),
          supabase.from('proposals').select('*, investors(code,title_en,title_vi,type,country)').eq('business_id', biz.id).order('sent_at', { ascending: false }),
          supabase.from('saved_businesses').select('id,investor_id,business_id,created_at').eq('business_id', biz.id).order('created_at', { ascending: false }),
          supabase.from('businesses').select('id,industry,country_iso2,revenue_2025,revenue_currency,ask_amount,ask_currency,stake_pct,deal_type,visible,status,public_snapshot_json').eq('visible', true).eq('status', 'active').not('public_snapshot_json', 'is', null).eq('country_iso2', biz.country_iso2 || 'VN').limit(80)
        ]);
        if (filesRes.error) throw filesRes.error;
        if (imagesRes.error) throw imagesRes.error;
        if (requestsRes.error) throw requestsRes.error;
        if (interestsRes.error) throw interestsRes.error;
        if (paymentsRes.error) throw paymentsRes.error;
        setFiles(filesRes.data || []);
        setImages(imagesRes.data || []);
        setRequests(requestsRes.data || []);
        setInterests(interestsRes.data || []);
        setPayments(paymentsRes.data || []);
        setProposals(proposalsRes.error ? [] : (proposalsRes.data || []));
        setSavedBusinesses(savedRes.error ? [] : (savedRes.data || []));
        setBenchmarkBusinesses(benchmarkRes.error ? [] : (benchmarkRes.data || []));
      }
    } catch (e: any) { setErr(e?.message || 'Could not load dashboard data.'); }
    finally { setBusy(false); }
  }

  useEffect(() => {
    if (!loading && !profile) navigate('/login?next=/dashboard/business');
    if (profile) load();
  }, [profile?.id, loading]);

  if (loading) return <main className="d68-dashboard-page"><div className="d68-dashboard-wrap"><div className="d68-dashboard-card">Loading...</div></div></main>;
  if (!profile) return <Navigate to="/login?next=/dashboard/business" replace />;
  if (profile.role !== 'business' && profile.role !== 'admin') return <main className="d68-dashboard-page"><div className="d68-dashboard-wrap"><div className="d68-dashboard-card"><h2>Business access only</h2><p>Role hiện tại: {profile.role}</p><Link to="/">Back home</Link></div></div></main>;
  if (!b) return <main className="d68-dashboard-page"><div className="d68-dashboard-wrap"><div className="d68-dashboard-card" style={{ textAlign: 'center' }}><h2>{T(lang, 'Chưa có hồ sơ doanh nghiệp', 'Business profile not found')}</h2><p>{T(lang, 'Tài khoản này chưa có hồ sơ DN hoặc đang chờ Admin kích hoạt.', 'This account has no business profile yet or is pending Admin activation.')}</p><Link className="d68-dashboard-btn" to="/register/business">{T(lang, 'Tạo hồ sơ DN', 'Create business profile')}</Link></div></div></main>;

  const score = b.quality_score === null || b.quality_score === undefined ? null : Math.round(Number(b.quality_score));
  const band = qBand(score ?? 0);
  const hasPublicSnapshot = !!b.public_snapshot_json;
  const hasPending = !!b.pending_changes_json || b.moderation_status === 'pending_admin_review';
  const planLabel = displayPlan(lang, b.plan);
  const status = displayStatus(lang, b, hasPublicSnapshot);
  const title = b.company_name_private || b.title_vi || b.title_en || b.public_code || 'Business profile';
  const quotaTotal = Number(b.quota_total || (String(b.plan || '').includes('featured') ? 200 : 100));
  const sentProposalCount = proposals.length;
  const approvedProposalCount = proposals.filter((p) => isApprovedStatus(p.status)).length;
  const investorAttentionCount = savedBusinesses.length + interests.length + requests.length + approvedProposalCount;
  const qualityItems = buildQualityItems(lang, b, files, images);
  const businessValuation = estimateEnterpriseValue(b);
  const industryBenchmark = estimateIndustryBenchmark(b, benchmarkBusinesses);

  async function saveProfile(e: FormEvent) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget as HTMLFormElement);
    const pending = {
      company_name_private: fieldValue(fd, 'company_name_private'),
      title_vi: fieldValue(fd, 'title_vi'),
      description_vi: fieldValue(fd, 'description_vi'),
      industry: fieldValue(fd, 'industry'),
      deal_type: fieldValue(fd, 'deal_type'),
      city: fieldValue(fd, 'city'),
      highlights_vi: fieldValue(fd, 'highlights_vi'),
      investment_reason_vi: fieldValue(fd, 'investment_reason_vi'),
      revenue_2025: Number(fd.get('revenue_2025') || 0),
      revenue_currency: fieldValue(fd, 'revenue_currency') || b.revenue_currency || 'VND',
      ebitda_margin: Number(fd.get('ebitda_margin') || 0),
      ask_amount: Number(fd.get('ask_amount') || 0),
      ask_currency: fieldValue(fd, 'ask_currency') || b.ask_currency || b.revenue_currency || 'VND',
      stake_pct: Number(fd.get('stake_pct') || 0),
      data_confidence: Number(fd.get('data_confidence') || 0),
      financial_input: financialInputOf(b)
    };
    const patch: any = { pending_changes_json: pending, pending_submitted_at: new Date().toISOString(), pending_submitted_by: profile.id, moderation_status: 'pending_admin_review' };
    if (!hasPublicSnapshot) { patch.status = 'pending_admin_review'; patch.visible = false; }
    const { error } = await supabase.from('businesses').update(patch).eq('id', b.id);
    setMsg(error ? '' : T(lang, 'Đã lưu thay đổi. Public vẫn giữ bản Admin duyệt trước đó; thay đổi mới đang chờ duyệt.', 'Saved. Public profile keeps the last Admin-approved snapshot; new changes are pending review.'));
    setErr(error ? error.message : '');
    await load();
  }

  async function fileChange(e: any) {
    const file = e.target.files?.[0];
    if (!file || !b || !profile) return;
    setBusy(true);
    try {
      await uploadBusinessFile(b.id, profile.id, file, newDocCategory, 'locked', newDocName || file.name);
      setNewDocName('');
      setMsg(T(lang, 'File đã tải lên ở trạng thái khóa/chờ Admin duyệt.', 'File uploaded as locked/pending Admin review.'));
      await load();
    } catch (e: any) { setErr(e?.message || 'Upload failed.'); }
    finally { setBusy(false); e.target.value = ''; }
  }

  async function imageChange(e: any) {
    const file = e.target.files?.[0];
    if (!file || !b || !profile) return;
    setBusy(true);
    try {
      await uploadBusinessImage(b.id, profile.id, file, file.name);
      setMsg(T(lang, 'Ảnh đã tải lên. Ảnh chỉ public sau khi Admin duyệt/làm mờ thông tin nhạy cảm.', 'Image uploaded. It becomes public only after Admin review/sanitization.'));
      await load();
    } catch (e: any) { setErr(e?.message || 'Upload failed.'); }
    finally { setBusy(false); e.target.value = ''; }
  }

  async function renameFile(row: any, displayName: string) {
    const safeName = String(displayName || row.display_name || row.file_name || '').trim();
    if (!safeName) return;
    try {
      await updateBusinessFile(row.id, { display_name: safeName, admin_note: 'User renamed file display name; Admin review remains required.' });
      setMsg(T(lang, 'Đã lưu tên hiển thị của tài liệu.', 'Document display name saved.'));
      await load();
    } catch (e: any) { setErr(e?.message || 'Update failed.'); }
  }

  async function deleteFile(row: any) {
    if (!confirm(T(lang, 'Xóa tài liệu này?', 'Delete this document?'))) return;
    try { await deleteBusinessFile(row); setMsg(T(lang, 'Đã xóa tài liệu.', 'Document deleted.')); await load(); }
    catch (e: any) { setErr(e?.message || 'Delete failed.'); }
  }

  async function deleteImage(row: any) {
    if (!confirm(T(lang, 'Xóa ảnh này?', 'Delete this image?'))) return;
    try { await deleteBusinessImage(row); setMsg(T(lang, 'Đã xóa ảnh.', 'Image deleted.')); await load(); }
    catch (e: any) { setErr(e?.message || 'Delete failed.'); }
  }

  async function renameImage(row: any) {
    const title = prompt(T(lang, 'Tên ảnh mới', 'New image title'), row.title || '');
    if (title === null) return;
    try { await updateBusinessImage(row.id, { title, admin_note: 'User renamed image; Admin must approve display_title/public visibility.' }); setMsg(T(lang, 'Đã cập nhật tên ảnh.', 'Image title updated.')); await load(); }
    catch (e: any) { setErr(e?.message || 'Update failed.'); }
  }

  async function suggestHero(row: any) {
    try { await updateBusinessImage(row.id, { admin_note: 'User suggests this as hero image' }); setMsg(T(lang, 'Đã ghi nhận ảnh đề xuất. Admin sẽ chọn ảnh public/hero sau kiểm duyệt.', 'Hero suggestion saved. Admin will choose public/hero image after review.')); await load(); }
    catch (e: any) { setErr(e?.message || 'Update failed.'); }
  }

  async function acceptInterest(row: any) { const { error } = await supabase.from('investor_interests').update({ status: 'connected' }).eq('id', row.id); setErr(error?.message || ''); setMsg(error ? '' : T(lang, 'Đã đồng ý kết nối.', 'Connection accepted.')); load(); }
  async function rejectInterest(row: any) { const { error } = await supabase.from('investor_interests').update({ status: 'rejected' }).eq('id', row.id); setErr(error?.message || ''); setMsg(error ? '' : T(lang, 'Đã từ chối kết nối.', 'Connection rejected.')); load(); }
  async function fulfillRequest(row: any) { const { error } = await supabase.from('request_data').update({ status: 'fulfilled' }).eq('id', row.id); setErr(error?.message || ''); setMsg(error ? '' : T(lang, 'Đã đánh dấu hoàn tất.', 'Marked as fulfilled.')); load(); }

  return <main className="d68-dashboard-page"><div className="d68-dashboard-wrap">
    <header className="d68-dashboard-head"><div><div className="d68-dashboard-kicker">Business Dashboard</div><h1>{title}</h1></div><div className="d68-dashboard-actions"><button className="d68-dashboard-btn light" onClick={() => setLang(lang === 'vi' ? 'en' : 'vi')}>{lang.toUpperCase()}</button><span className="d68-dashboard-badge blue">{planLabel}</span><span className={`d68-dashboard-badge ${status.cls}`}>{status.label}</span><button className="d68-dashboard-btn light" onClick={() => signOut().then(() => navigate('/'))}>{T(lang,'Thoát','Exit')}</button></div></header>
    {msg ? <div className="d68-dashboard-notice ok">{msg}</div> : null}{err ? <div className="d68-dashboard-notice err">{err}</div> : null}{busy ? <div className="d68-dashboard-notice warn">{T(lang,'Đang tải dữ liệu...','Loading data...')}</div> : null}{hasPending ? <div className="d68-dashboard-notice warn">{T(lang,'Có thay đổi đang chờ Admin duyệt. Public profile vẫn dùng bản snapshot đã duyệt gần nhất.', 'Changes are pending Admin review. Public profile still uses the latest approved snapshot.')}</div> : null}
    <div className="d68-dashboard-cols"><nav className="d68-dashboard-side">{tabs.map((t) => <Link key={t.id} to={t.href} onClick={() => setTab(t.id)} className={tab === t.id ? 'active' : ''}><span className="d68-dashboard-nav-icon"><t.Icon size={17} strokeWidth={2.2} /></span><span>{T(lang,t.vi,t.en)}</span></Link>)}<div className="d68-dashboard-side__note">{T(lang,'Cần hỗ trợ hoàn thiện hồ sơ, định giá và tài liệu làm việc với Nhà đầu tư? Hãy tham khảo:', 'Need help preparing your profile, valuation and investor materials? Please refer to:')}<br/><a href="https://vietcapitalpartners.com" target="_blank" rel="noreferrer">vietcapitalpartners.com ↗</a><br/>Hotline: 0909.584.075</div></nav><section>
      {tab === 'overview' ? <><ValuationOverviewBox lang={lang} valuation={businessValuation} benchmark={industryBenchmark} /><div className="d68-dashboard-scorecard"><div className="d68-dashboard-scorecard__ring" style={{ background: `conic-gradient(${score === null ? '#CBD5E1' : band.cls === 'green' ? '#16A34A' : band.cls === 'blue' ? '#1596cc' : '#B8860B'} ${Math.max(0, Math.min(100, score ?? 0)) * 3.6}deg, #EEF2F6 0deg)` }}><div><b>{score === null ? '—' : score}</b><span>/100</span></div></div><section><div><h2>Business Quality Score</h2><span className={`d68-dashboard-badge ${band.cls}`}>{score === null ? T(lang,'Đang cập nhật','Pending') : T(lang, band.labelVi, band.labelEn)}</span></div><p>{T(lang,'Điểm do hệ thống tính toán dựa trên chất lượng và số lượng tài liệu đăng lên cũng như định giá doanh nghiệp.', 'Score is calculated by the system based on the quality and quantity of uploaded materials as well as business valuation inputs.')}</p><div className="d68-dashboard-scorecard__chips"><span>{hasPublicSnapshot ? '✓ Public snapshot' : '⏳ No public snapshot'}</span><span>{hasPending ? '⏳ Pending review' : '✓ No pending changes'}</span><span>{images.length} images</span><span>{files.length} files</span></div></section></div><div className="d68-quality-list d68-dashboard-card"><div className="d68-quality-list__head"><BarChart3 size={18}/><h2>{T(lang,'Hồ sơ/tài liệu đạt yêu cầu','Required profile materials')}</h2></div>{qualityItems.map((item) => <div key={item.label} className={`d68-quality-item ${item.ok ? 'ok' : 'missing'}`}><b>{item.ok ? '✓' : '×'} {item.label}</b><span>{item.detail}</span></div>)}</div><div className="d68-dashboard-grid4" style={{ marginBottom: 18 }}>{metric(T(lang,'Trạng thái','Status'), status.label, status.cls)}{metric(T(lang,'Gói hiển thị','Listing plan'), planLabel)}{metric(T(lang,'Đã gửi Hồ sơ / Được duyệt','Proposals sent / approved'), `${sentProposalCount} / ${approvedProposalCount}`, approvedProposalCount ? 'green' : 'blue', T(lang,'Số proposal gửi đi và số nhà đầu tư đã được duyệt/kết nối.', 'Number of proposals sent and investors approved/connected.'))}{metric(T(lang,'Nhà đầu tư quan tâm','Investor attention'), String(investorAttentionCount), investorAttentionCount ? 'green' : 'gold', T(lang,`Lưu hồ sơ: ${savedBusinesses.length} · Quan tâm: ${interests.length} · Yêu cầu data: ${requests.length}`, `Saved: ${savedBusinesses.length} · Interest: ${interests.length} · Data requests: ${requests.length}`))}</div><div className="d68-dashboard-card"><h2>{T(lang,'Hạn mức proposal','Proposal quota')}</h2><div className="d68-dashboard-progress"><span style={{ width: `${Math.min(100, Math.round((sentProposalCount / Math.max(1, quotaTotal)) * 100))}%` }} /></div><p><b>{sentProposalCount} / {quotaTotal}</b> · {T(lang,'hồ sơ/proposal đã gửi','proposals sent')}</p><Link to="/investors" className="d68-dashboard-btn gold">{T(lang,'Tìm Nhà đầu tư','Find investors')} →</Link></div></> : null}
      {tab === 'profile' ? <ProfileForm lang={lang} b={b} saveProfile={saveProfile} /> : null}
      {tab === 'documents' ? <Documents lang={lang} files={files} deleteFile={deleteFile} renameFile={renameFile} fileChange={fileChange} newDocName={newDocName} setNewDocName={setNewDocName} newDocCategory={newDocCategory} setNewDocCategory={setNewDocCategory} /> : null}
      {tab === 'images' ? <Images lang={lang} images={images} imageChange={imageChange} deleteImage={deleteImage} renameImage={renameImage} suggestHero={suggestHero} /> : null}
      {tab === 'interests' ? <Rows title={T(lang,'Nhà đầu tư quan tâm','Investor interests')} rows={interests} empty={T(lang,'Chưa có nhà đầu tư quan tâm.','No investor interests yet.')} actions={(row: any) => <><button onClick={() => acceptInterest(row)} className="d68-dashboard-btn green">Accept</button><button onClick={() => rejectInterest(row)} className="d68-dashboard-btn red">Reject</button></>} /> : null}
      {tab === 'requests' ? <Rows title={T(lang,'Yêu cầu dữ liệu','Data requests')} rows={requests} empty={T(lang,'Chưa có yêu cầu dữ liệu.','No data requests yet.')} actions={(row: any) => <button onClick={() => fulfillRequest(row)} className="d68-dashboard-btn green">Fulfilled</button>} /> : null}
      {tab === 'services' ? <div className="d68-dashboard-card"><h2>Services & Billing</h2><p>{T(lang,'Đơn thanh toán gần đây','Recent payment orders')}: {payments.length}</p>{payments.map((p) => <div key={p.id} className="d68-dashboard-row"><div style={{ flex: 1 }}><b>{p.title || p.id}</b><div className="d68-dashboard-mini">{p.status} · {new Date(p.created_at).toLocaleString()}</div></div></div>)}<Link to="/pricing" className="d68-dashboard-btn gold">Renew / Upgrade →</Link></div> : null}
    </section></div>
  </div></main>;
}

function ProfileForm({ lang, b, saveProfile }: any) {
  return <form onSubmit={saveProfile} className="d68-dashboard-card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
    <h2>{T(lang,'Chỉnh sửa hồ sơ','Edit profile')}</h2>
    <p>{T(lang,'Lưu tại đây không tự public. Admin phải duyệt snapshot mới trước khi hiển thị ra ngoài.', 'Saving here does not publish changes. Admin must approve a new snapshot before public display.')}</p>
    <label className="d68-dashboard-field"><span>{T(lang,'Tên doanh nghiệp thật — chỉ Admin thấy','Real business name — Admin only')}</span><input className="d68-dashboard-input" name="company_name_private" defaultValue={b.company_name_private || ''}/></label>
    <label className="d68-dashboard-field"><span>{T(lang,'Tiêu đề ẩn danh public — Admin nhập','Anonymous public title — Admin managed')}</span><input className="d68-dashboard-input" value={b.title_vi || ''} disabled readOnly/><input type="hidden" name="title_vi" value={b.title_vi || ''}/></label>
    <div className="d68-dashboard-form2"><label className="d68-dashboard-field"><span>{T(lang,'Ngành','Industry')}</span><select className="d68-dashboard-input" name="industry" defaultValue={viIndustry(b.industry)}>{INDUSTRY_VI.map((x) => <option key={x}>{x}</option>)}</select></label><label className="d68-dashboard-field"><span>{T(lang,'Thành phố','City')}</span><input className="d68-dashboard-input" name="city" defaultValue={b.city || ''}/></label></div>
    <label className="d68-dashboard-field"><span>{T(lang,'Tổng quan doanh nghiệp','Business overview')}</span><textarea className="d68-dashboard-input d68-dashboard-textarea" name="description_vi" defaultValue={b.description_vi || ''}/></label>
    <label className="d68-dashboard-field"><span>{T(lang,'Điểm nổi bật','Highlights')}</span><textarea className="d68-dashboard-input d68-dashboard-textarea" name="highlights_vi" defaultValue={b.highlights_vi || ''}/></label>
    <div className="d68-dashboard-form2"><label className="d68-dashboard-field"><span>{T(lang,'Loại giao dịch','Deal type')}</span><select className="d68-dashboard-input" name="deal_type" defaultValue={viDealType(b.deal_type)}>{DEAL_TYPE_VI.map((x) => <option key={x}>{x}</option>)}</select></label><label className="d68-dashboard-field"><span>{T(lang,'Doanh thu 2025','Revenue 2025')}</span><FormattedNumberInput name="revenue_2025" defaultValue={b.revenue_2025 || 0} /></label><label className="d68-dashboard-field"><span>Revenue currency</span><select className="d68-dashboard-input" name="revenue_currency" defaultValue={b.revenue_currency || 'VND'}><option>VND</option><option>USD</option></select></label><label className="d68-dashboard-field"><span>EBITDA margin (%)</span><FormattedNumberInput name="ebitda_margin" defaultValue={b.ebitda_margin || 0} allowDecimal /></label><label className="d68-dashboard-field"><span>{T(lang,'Nhu cầu vốn/Giá chào','Ask amount')}</span><FormattedNumberInput name="ask_amount" defaultValue={b.ask_amount || 0} /></label><label className="d68-dashboard-field"><span>Ask currency</span><select className="d68-dashboard-input" name="ask_currency" defaultValue={b.ask_currency || b.revenue_currency || 'VND'}><option>VND</option><option>USD</option></select></label><label className="d68-dashboard-field"><span>{T(lang,'Tỷ lệ cổ phần (%)','Stake (%)')}</span><FormattedNumberInput name="stake_pct" defaultValue={b.stake_pct || 0} allowDecimal /></label><label className="d68-dashboard-field"><span>{T(lang,'Độ tin cậy dữ liệu','Data confidence')}</span><FormattedNumberInput name="data_confidence" defaultValue={b.data_confidence || 0} /></label></div>
    <label className="d68-dashboard-field"><span>{T(lang,'Lý do giao dịch / dùng vốn','Reason / use of funds')}</span><textarea className="d68-dashboard-input d68-dashboard-textarea" name="investment_reason_vi" defaultValue={b.investment_reason_vi || ''}/></label>
    <div style={{ display: 'flex', justifyContent: 'flex-end' }}><button className="d68-dashboard-btn">{T(lang,'Lưu & gửi Admin duyệt','Save & submit to Admin')}</button></div>
  </form>;
}

function DocumentRow({ lang, d, renameFile, deleteFile }: any) {
  const [name, setName] = useState(d.display_name || d.file_name || '');
  const [saving, setSaving] = useState(false);
  async function save() {
    setSaving(true);
    await renameFile(d, name);
    setSaving(false);
  }
  return <div className="d68-dashboard-row d68-document-row">
    <span className="d68-dashboard-badge blue">{ext(d.file_name, d.file_type)}</span>
    <div className="d68-document-row__body">
      <label className="d68-dashboard-field"><span>{T(lang,'Tên file hiển thị','Display file name')}</span><input className="d68-dashboard-input" value={name} onChange={(e) => setName(e.target.value)} /></label>
      <div className="d68-dashboard-mini">{d.category || 'document'} · {d.privacy_level || 'locked'} · {d.public_visible ? T(lang,'được duyệt public','approved public') : T(lang,'chờ duyệt/khóa','pending/locked')}</div>
    </div>
    <div className="d68-document-row__actions"><button onClick={save} disabled={saving} className="d68-dashboard-btn light">{saving ? T(lang,'Đang lưu','Saving') : T(lang,'Lưu tên','Save name')}</button><button onClick={() => deleteFile(d)} className="d68-dashboard-btn red">{T(lang,'Xóa','Delete')}</button></div>
  </div>;
}

function Documents({ lang, files, deleteFile, renameFile, fileChange, newDocName, setNewDocName, newDocCategory, setNewDocCategory }: any) {
  return <div className="d68-dashboard-card"><h2>{T(lang,'Tài liệu doanh nghiệp','Business documents')}</h2><p>{T(lang,'File luôn ở trạng thái khóa sau khi upload. Admin mới có thể duyệt public/locked.', 'Uploaded files are always locked first. Only Admin can approve public/locked visibility.')}</p>{files.map((d: any) => <DocumentRow key={d.id} lang={lang} d={d} renameFile={renameFile} deleteFile={deleteFile} />)}{!files.length ? <div className="d68-dashboard-empty">{T(lang,'Chưa có tài liệu.','No documents yet.')}</div> : null}<div className="d68-document-upload"><h3>{T(lang,'Tải hồ sơ mới','Upload a new document')}</h3><div className="d68-dashboard-form2"><label className="d68-dashboard-field"><span>{T(lang,'Nhập tên file','Enter file name')}</span><input className="d68-dashboard-input" value={newDocName} onChange={(e) => setNewDocName(e.target.value)} placeholder={T(lang,'VD: Báo cáo tài chính 2025, Company profile...', 'E.g. 2025 financials, company profile...')} /></label><label className="d68-dashboard-field"><span>{T(lang,'Loại tài liệu','Document type')}</span><select className="d68-dashboard-input" value={newDocCategory} onChange={(e) => setNewDocCategory(e.target.value)}><option value="financials">Financials</option><option value="profile">Profile</option><option value="im">Teaser / IM</option><option value="legal">Legal</option><option value="other">Other</option></select></label></div><label className="d68-dashboard-btn" style={{ display: 'inline-block', marginTop: 14 }}>+ {T(lang,'Chọn file & tải lên','Choose file & upload')}<input type="file" accept={DOC_ACCEPT} onChange={fileChange} style={{ display: 'none' }}/></label></div></div>;
}

function Images({ lang, images, imageChange, deleteImage, renameImage, suggestHero }: any) {
  return <div className="d68-dashboard-card"><h2>{T(lang,'Ảnh doanh nghiệp','Business images')}</h2><p>{T(lang,'Ảnh public chỉ hiển thị sau khi Admin kiểm duyệt/làm mờ thông tin nhạy cảm.', 'Images are public only after Admin review/sanitization.')}</p>{images.map((im: any) => <div key={im.id} className="d68-dashboard-row"><img className="d68-dashboard-thumb" src={im.public_url} alt={im.title || 'image'}/><div style={{ flex: 1 }}><b>{im.display_title || im.title || 'Image'}</b><div className="d68-dashboard-mini">{im.public_visible ? 'public' : 'not public'} · {im.is_sanitized ? 'sanitized' : 'pending sanitize'} · {im.is_hero ? 'hero' : 'gallery'}</div></div><button onClick={() => renameImage(im)} className="d68-dashboard-btn light">{T(lang,'Sửa tên','Rename')}</button><button onClick={() => suggestHero(im)} className="d68-dashboard-btn gold">Hero</button><button onClick={() => deleteImage(im)} className="d68-dashboard-btn red">{T(lang,'Xóa','Delete')}</button></div>)}{!images.length ? <div className="d68-dashboard-empty">{T(lang,'Chưa có ảnh.','No images yet.')}</div> : null}<label className="d68-dashboard-btn" style={{ display: 'inline-block', marginTop: 14 }}>+ {T(lang,'Tải ảnh','Upload image')}<input type="file" accept="image/png,image/jpeg,image/webp" onChange={imageChange} style={{ display: 'none' }}/></label></div>;
}

function Rows({ title, rows, empty, actions }: any) {
  return <div className="d68-dashboard-card"><h2>{title}</h2>{rows.map((row: any) => <div key={row.id} className="d68-dashboard-row"><div style={{ flex: 1 }}><b>{row.investors?.title_vi || row.investors?.title_en || row.investors?.code || row.id}</b><div className="d68-dashboard-mini">{row.status || 'new'} · {new Date(row.created_at || row.sent_at || Date.now()).toLocaleString()}</div>{row.message || row.note ? <p>{row.message || row.note}</p> : null}</div><div className="d68-dashboard-actions">{actions ? actions(row) : null}</div></div>)}{!rows.length ? <div className="d68-dashboard-empty">{empty}</div> : null}</div>;
}
