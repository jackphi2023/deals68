import { FormEvent, useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { BarChart3, BriefcaseBusiness, CreditCard, FileText, Image as ImageIcon, Inbox, LayoutDashboard, Users } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import {
  deleteBusinessFile,
  deleteBusinessImage,
  getBusinessFiles,
  getBusinessImages,
  getMyBusiness,
  updateBusinessFile,
  updateBusinessImage,
  uploadBusinessFile,
  uploadBusinessImage
} from '../lib/data';
import { supabase } from '../lib/supabase';
import { ensureBusinessImagePrivate } from '../lib/businessAssetStorage';
import { langFromPath, stripLangPrefix, toLocalizedPath } from '../lib/i18nRoutes';
import { DEFAULT_VALUATION_CONFIG, getActiveValuationConfig, valuate, valuationInputFromBusiness, formatValuationMoney, valuationVerdictMessage, VALUATION_DISCLAIMER_VI, VALUATION_DISCLAIMER_EN } from '../lib/valuationEngine';
import { businessQualityPublicExplanation, normalizeQualityBreakdown, qualityItemLabel, qualityItemNote } from '../lib/businessQuality';
import { proposalQuotaTotal } from '../lib/proposals';
import { calculatePricing, lookupPromo, type BusinessPlan } from '../lib/pricing';
import { businessProposalQuotaForPlan } from '../lib/businessPlans';
import {
  createOwnPaymentOrder,
  formatServiceExpiry,
  makePaymentOrderCode,
  paymentOrderCode,
} from '../lib/paymentOrders';
import { resumePendingBusinessSignupUploads } from '../lib/pendingBusinessUploads';
import {
  getLocationOptionsForCountry,
  locationDbLabel,
  locationKeyFromLabel,
} from '../lib/labels';

type Lang = 'vi' | 'en';
type Tab = 'overview' | 'profile' | 'documents' | 'images' | 'interests' | 'requests' | 'services';
const T = (lang: Lang, vi: string, en: string) => lang === 'en' ? en : vi;
const businessUpdateSuccessMsg = (lang: Lang) => T(
  lang,
  'Thông tin doanh nghiệp của bạn đang được duyệt trong 1-3 ngày tới, Deals68 sẽ ẩn thông tin tên/thương hiệu nếu có để hiển thị.',
  'Your business information is being reviewed within the next 1-3 days. Deals68 will hide any name or brand information before publishing.',
);

const tabs = [
  { id: 'overview' as Tab, Icon: LayoutDashboard, vi: 'Tổng quan', en: 'Overview', href: '/dashboard/business' },
  { id: 'profile' as Tab, Icon: BriefcaseBusiness, vi: 'Hồ sơ & số liệu', en: 'Profile & data', href: '/dashboard/business/profile' },
  { id: 'documents' as Tab, Icon: FileText, vi: 'Tài liệu', en: 'Documents', href: '/dashboard/business/files' },
  { id: 'images' as Tab, Icon: ImageIcon, vi: 'Ảnh', en: 'Images', href: '/dashboard/business/images' },
  { id: 'interests' as Tab, Icon: Users, vi: 'Proposal', en: 'Proposals', href: '/dashboard/business/proposals' },
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

const INDUSTRY_VI = ['Nông nghiệp','Ô tô & Phụ tùng','Làm đẹp & Chăm sóc cá nhân','Xây dựng & Vật liệu','Hóa chất','Giáo dục & Đào tạo','Năng lượng & Tiện ích','Giải trí & Nghỉ dưỡng','Tài chính','Thực phẩm & Đồ uống (F&B)','Y tế & Chăm sóc sức khỏe','Khách sạn & Resort','CNTT & Phần mềm','Sản xuất','Truyền thông & Quảng cáo','Bất động sản','Bán lẻ','Dịch vụ (B2B/B2C)','Logistics & Vận tải','Du lịch','Thương mại điện tử','Dệt may & Thời trang','Thủy sản & Xuất khẩu'];
const DEAL_TYPE_VI = ['Gọi vốn','Bán cổ phần','M&A / Chuyển nhượng','Vay vốn','JV / Đối tác','Chuyển nhượng tài sản'];
const DOC_ACCEPT = '.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const STATIC_VIETQR_URL = '/assets/vietqr-vcb.png';

function resolveTab(pathname: string): Tab {
  const suffix = stripLangPrefix(pathname)
    .replace('/dashboard/business','')
    .replace(/^\//,'')
    .split('/')[0];
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
  if (v.includes('agri') || v.includes('nông') || v.includes('nong')) return 'Nông nghiệp';
  if (v.includes('auto') || v.includes('ô tô') || v.includes('o to') || v.includes('car')) return 'Ô tô & Phụ tùng';
  if (v.includes('beauty') || v.includes('personal') || v.includes('spa') || v.includes('làm đẹp') || v.includes('lam dep')) return 'Làm đẹp & Chăm sóc cá nhân';
  if (v.includes('construction') || v.includes('building') || v.includes('xây dựng') || v.includes('xay dung')) return 'Xây dựng & Vật liệu';
  if (v.includes('chemical') || v.includes('hóa chất') || v.includes('hoa chat')) return 'Hóa chất';
  if (v.includes('education') || v.includes('training') || v.includes('giáo dục') || v.includes('giao duc')) return 'Giáo dục & Đào tạo';
  if (v.includes('energy') || v.includes('utility') || v.includes('năng lượng') || v.includes('nang luong')) return 'Năng lượng & Tiện ích';
  if (v.includes('entertainment') || v.includes('leisure') || v.includes('giải trí') || v.includes('giai tri')) return 'Giải trí & Nghỉ dưỡng';
  if (v.includes('finance') || v.includes('tài chính') || v.includes('tai chinh')) return 'Tài chính';
  if (v.includes('food') || v.includes('beverage') || v.includes('f&b') || v.includes('fnb') || v.includes('nhà hàng') || v.includes('nha hang')) return 'Thực phẩm & Đồ uống (F&B)';
  if (v.includes('health') || v.includes('clinic') || v.includes('medical') || v.includes('y tế') || v.includes('y te')) return 'Y tế & Chăm sóc sức khỏe';
  if (v.includes('hotel') || v.includes('resort') || v.includes('khách sạn') || v.includes('khach san')) return 'Khách sạn & Resort';
  if (v.includes('software') || v.includes('technology') || v.includes('tech') || v.includes('cntt') || v.includes('công nghệ') || v.includes('cong nghe')) return 'CNTT & Phần mềm';
  if (v.includes('manufact') || v.includes('factory') || v.includes('sản xuất') || v.includes('san xuat')) return 'Sản xuất';
  if (v.includes('media') || v.includes('advert') || v.includes('truyền thông') || v.includes('truyen thong')) return 'Truyền thông & Quảng cáo';
  if (v.includes('real') || v.includes('property') || v.includes('bất động sản') || v.includes('bat dong san')) return 'Bất động sản';
  if (v.includes('retail') || v.includes('bán lẻ') || v.includes('ban le')) return 'Bán lẻ';
  if (v.includes('service') || v.includes('dịch vụ') || v.includes('dich vu')) return 'Dịch vụ (B2B/B2C)';
  if (v.includes('logistics') || v.includes('transport') || v.includes('vận tải') || v.includes('van tai')) return 'Logistics & Vận tải';
  if (v.includes('travel') || v.includes('du lịch') || v.includes('du lich')) return 'Du lịch';
  if (v.includes('commerce') || v.includes('ecommerce') || v.includes('thương mại điện tử') || v.includes('thuong mai dien tu')) return 'Thương mại điện tử';
  if (v.includes('textile') || v.includes('apparel') || v.includes('fashion') || v.includes('dệt may') || v.includes('det may') || v.includes('thời trang') || v.includes('thoi trang')) return 'Dệt may & Thời trang';
  if (v.includes('seafood') || v.includes('export') || v.includes('thủy sản') || v.includes('thuy san')) return 'Thủy sản & Xuất khẩu';
  return INDUSTRY_VI.includes(String(raw || '')) ? String(raw) : 'Thực phẩm & Đồ uống (F&B)';
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

function uniqueProposalInvestorCount(rows: any[], statuses?: string[]) {
  const allowed = statuses?.map((x) => x.toLowerCase()) || null;
  const ids = (rows || [])
    .filter((row) => !allowed || allowed.includes(String(row?.status || '').toLowerCase()))
    .map((row) => String(row?.investor_id || row?.investors?.id || '').trim())
    .filter(Boolean);
  return new Set(ids).size;
}

function fileMatches(file: any, categories: string[], extensions: string[] = []) {
  const category = String(file?.category || '').toLowerCase();
  const fileExt = ext(file?.file_name || file?.display_name || '', file?.file_type || '').toLowerCase();
  return categories.some((x) => category.includes(x)) || extensions.some((x) => fileExt.includes(x));
}

function financialInputOf(b: any) {
  const direct = b?.financial_input && typeof b.financial_input === 'object' ? b.financial_input : {};
  const pending = b?.pending_changes_json?.financial_input && typeof b.pending_changes_json.financial_input === 'object' ? b.pending_changes_json.financial_input : {};
  return { ...direct, ...pending };
}
function businessOwnerView(b: any) {
  const pending =
    b?.pending_changes_json &&
    typeof b.pending_changes_json === 'object' &&
    !Array.isArray(b.pending_changes_json)
      ? b.pending_changes_json
      : {};

  return {
    ...b,
    ...pending,
    id: b?.id,
    owner_id: b?.owner_id,
    public_code: b?.public_code,
    slug: b?.slug,
    visible: b?.visible,
    status: b?.status,
    public_snapshot_json: b?.public_snapshot_json,
    public_version: b?.public_version,
    pending_changes_json: b?.pending_changes_json,
    pending_submitted_at: b?.pending_submitted_at,
    updated_at: b?.updated_at,
    financial_input: {
      ...(b?.financial_input || {}),
      ...(pending?.financial_input || {}),
    },
  };
}


function buildQualityItems(lang: Lang, b: any, files: any[], images: any[]) {
  const financialInput = financialInputOf(b);
  const approvedFiles = files.filter((file) => isApprovedStatus(file?.review_status));
  const approvedImages = images.filter(
    (image) => isApprovedStatus(image?.review_status) && image?.is_sanitized,
  );
  const hasProfileDocument = approvedFiles.some((file) =>
    fileMatches(file, ['profile', 'im', 'teaser'], ['ppt', 'pptx', 'doc', 'docx']),
  );
  const hasFinancialDocument = approvedFiles.some((file) =>
    fileMatches(file, ['financial'], ['xls', 'xlsx']),
  );
  const hasAssetDocument = approvedFiles.some((file) =>
    fileMatches(file, ['asset', 'legal', 'ownership'], []),
  );
  const hasFinancialData =
    Number(b?.revenue_2025 || 0) > 0 &&
    b?.ebitda_margin !== null &&
    b?.ebitda_margin !== undefined;
  const hasAssetDeclaration = !!(
    financialInput.assets_owned_vi ||
    financialInput.assets_owned_en ||
    financialInput.assets_owned ||
    financialInput.included_tangible_assets_vi ||
    financialInput.included_tangible_assets_en ||
    financialInput.included_tangible_assets
  );
  const financialSource = String(financialInput.financial_source || '').toLowerCase();
  const sourceIsVerified = !!financialSource && financialSource !== 'estimate';
  const valuationItem = Array.isArray(b?.quality_breakdown_json?.items)
    ? b.quality_breakdown_json.items.find((item: any) => item?.key === 'valuation')
    : null;
  const valuationStatus = T(
    lang,
    valuationItem?.status_vi || 'Cần bổ sung cơ sở định giá',
    valuationItem?.status_en || 'Valuation basis needs supporting evidence',
  );
  const valuationOk =
    Number(valuationItem?.max || 0) > 0 &&
    Number(valuationItem?.score || 0) >= Number(valuationItem?.max || 0) * 0.7;

  return [
    {
      ok: approvedImages.length > 0,
      label: T(lang, 'Ảnh doanh nghiệp', 'Business images'),
      detail: approvedImages.length
        ? T(lang, `${approvedImages.length} ảnh đã duyệt`, `${approvedImages.length} approved image(s)`)
        : images.length
          ? T(lang, 'Ảnh đã tải lên đang chờ duyệt', 'Uploaded images are pending review')
          : T(lang, 'Chưa gửi ảnh doanh nghiệp', 'Missing business images'),
    },
    {
      ok: hasProfileDocument,
      label: T(lang, 'Hồ sơ doanh nghiệp / Teaser / IM', 'Business profile / teaser / IM'),
      detail: hasProfileDocument
        ? T(lang, 'Đã có tài liệu được Admin duyệt', 'An Admin-approved document is available')
        : T(lang, 'Chưa có Teaser/IM được duyệt', 'No approved Teaser/IM is available'),
    },
    {
      ok: hasFinancialDocument,
      label: T(lang, 'Báo cáo tài chính / Excel số liệu', 'Financial statements / Excel data'),
      detail: hasFinancialDocument
        ? T(lang, 'Đã có tài liệu tài chính được duyệt', 'Approved financial evidence is available')
        : T(lang, 'Chưa có tài liệu tài chính được duyệt', 'No approved financial evidence is available'),
    },
    {
      ok: hasFinancialData && hasFinancialDocument,
      label: T(lang, 'Doanh thu & EBITDA', 'Revenue & EBITDA'),
      detail: !hasFinancialData
        ? T(lang, 'Cần bổ sung doanh thu và EBITDA', 'Revenue and EBITDA are missing')
        : hasFinancialDocument
          ? T(lang, 'Đã có số liệu và tài liệu chứng minh', 'Metrics are supported by approved evidence')
          : T(lang, 'Đã khai báo, chưa được chứng minh', 'Declared, not yet evidenced'),
    },
    {
      ok: hasAssetDeclaration && hasAssetDocument && sourceIsVerified,
      label: T(lang, 'Tài sản & nguồn số liệu', 'Assets & data source'),
      detail: !hasAssetDeclaration
        ? T(lang, 'Chưa khai báo tài sản đưa vào giao dịch', 'Transaction assets have not been declared')
        : hasAssetDocument && sourceIsVerified
          ? T(lang, 'Đã có khai báo và tài liệu/nguồn xác minh', 'Declaration is supported by evidence and source data')
          : T(lang, 'Đã khai báo, cần bổ sung tài liệu xác minh', 'Declared, supporting evidence is still required'),
    },
    {
      ok: valuationOk,
      label: T(lang, 'Định giá / nhu cầu vốn', 'Valuation / capital ask'),
      detail: valuationStatus,
    },
  ];
}

function displayStatus(lang: Lang, b: any, hasPublicSnapshot: boolean) {
  const visible = !!b?.visible && String(b?.status || '').toLowerCase() === 'active' && hasPublicSnapshot;
  return {
    label: visible ? T(lang, 'Hiển thị', 'Visible') : T(lang, 'Đang ẩn', 'Hidden'),
    cls: visible ? 'green' : 'gold'
  };
}

function userFacingNote(row: any) {
  const note = String(row?.message || row?.note || '').trim();
  if (!note) return '';
  if (note.includes('Investor requested documents from received proposal') || note.includes('e-NDA placeholder')) return '';
  return note;
}

function displayPlan(lang: Lang, plan: any) {
  return String(plan || '').toLowerCase().includes('featured') ? T(lang, 'Ưu tiên', 'Priority') : T(lang, 'Thường', 'Standard');
}

function billingMoney(v: any, cur: any) {
  const n = Number(v || 0);
  const c = String(cur || 'VND').toUpperCase();
  return c === 'USD' ? `$${Math.round(n).toLocaleString('en-US')}` : `${Math.round(n).toLocaleString('vi-VN')} ₫`;
}
function paymentStatusText(lang: Lang, status: any) {
  const s = String(status || 'pending').toLowerCase();
  if (s === 'confirmed' || s === 'paid' || s === 'active') return T(lang, 'Đã xác nhận', 'Confirmed');
  if (s === 'rejected' || s === 'cancelled') return T(lang, 'Không duyệt', 'Rejected');
  return T(lang, 'Chờ xác nhận', 'Pending');
}
function paymentPayload(row: any) {
  return row?.payload && typeof row.payload === 'object' ? row.payload : {};
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

function ValuationOverviewBox({ lang, result }: any) {
  const currency = result?.currency || 'VND';
  return <div className="d68-dashboard-valuation-box d68-dashboard-valuation-box--engine">
    <div>
      <span>{T(lang, 'Giá trị doanh nghiệp tự định giá', 'Implied self valuation')}</span>
      <strong>{result?.self ? formatValuationMoney(result.self, currency, lang) : T(lang, 'Chưa đủ dữ liệu', 'Not enough data')}</strong>
      <small>{T(lang, 'Suy từ số tiền đề xuất và tỷ lệ cổ phần.', 'Derived from proposed amount and stake percentage.')}</small>
    </div>
    <div>
      <span>{T(lang, 'Tham chiếu ngành', 'Industry benchmark')}</span>
      <strong>{result ? `${formatValuationMoney(result.low, currency, lang)} – ${formatValuationMoney(result.high, currency, lang)}` : T(lang, 'Đang cập nhật', 'Pending')}</strong>
      <small>{result ? valuationVerdictMessage(lang, result) : T(lang, 'Cần doanh thu, ngành và biên EBITDA/tăng trưởng để tính tham chiếu.', 'Revenue, industry and EBITDA/growth inputs are needed for a benchmark.')}</small>
    </div>
    <div>
      <span>{T(lang, 'Cách tính', 'Calculation')}</span>
      <strong>{result ? (result.method === 'blend' ? 'EBITDA + Revenue' : 'Revenue only') : '—'}</strong>
      <small>{result ? `EV/EBITDA ${result.adjE.toFixed(2)}× · EV/Revenue ${result.adjR.toFixed(2)}×` : T(lang, 'Không trả số giả nếu thiếu dữ liệu.', 'No fake numbers when inputs are missing.')}</small>
    </div>
    <p>{T(lang, VALUATION_DISCLAIMER_VI, VALUATION_DISCLAIMER_EN)}</p>
  </div>;
}

export default function BusinessDashboard() {
  const { profile } = useAuth();
  const location = useLocation();
  const lang = langFromPath(location.pathname) as Lang;
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
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const [newDocName, setNewDocName] = useState('');
  const [newDocCategory, setNewDocCategory] = useState('financials');
  const [valuationConfig, setValuationConfig] = useState(DEFAULT_VALUATION_CONFIG);

  useEffect(() => setTab(resolveTab(location.pathname)), [location.pathname]);
  useEffect(() => { getActiveValuationConfig().then(setValuationConfig).catch(() => setValuationConfig(DEFAULT_VALUATION_CONFIG)); }, []);

  async function load() {
    if (!profile) return;
    setBusy(true); setErr('');
    try {
      const uploadResult = await resumePendingBusinessSignupUploads(profile.id)
        .catch(() => null);

      if (uploadResult?.attempted) {
        setMsg(
          uploadResult.errors.length
            ? T(
                lang,
                `Đã upload ${uploadResult.uploadedImages} ảnh và ${uploadResult.uploadedFiles} file; còn ${uploadResult.remaining} file chờ thử lại.`,
                `Uploaded ${uploadResult.uploadedImages} images and ${uploadResult.uploadedFiles} files; ${uploadResult.remaining} item(s) remain for retry.`,
              )
            : T(
                lang,
                `Đã hoàn tất upload ${uploadResult.uploadedImages} ảnh và ${uploadResult.uploadedFiles} file từ bước đăng ký.`,
                `Completed upload of ${uploadResult.uploadedImages} images and ${uploadResult.uploadedFiles} files from registration.`,
              ),
        );
      }

      const biz = await getMyBusiness(profile.id);
      setB(biz);
      if (biz) {
        const [
          nextFiles,
          nextImages,
          relationsRes,
          paymentsRes,
          savedRes,
          benchmarkRes,
        ] = await Promise.all([
          getBusinessFiles(biz.id),
          getBusinessImages(biz.id),
          supabase.rpc('get_my_business_dashboard_relations', {
            business_uuid: biz.id,
          }),
          supabase
            .from('payment_orders')
            .select('*')
            .eq('business_id', biz.id)
            .order('created_at', { ascending: false }),
          supabase
            .from('saved_businesses')
            .select('id,investor_id,business_id,created_at')
            .eq('business_id', biz.id)
            .order('created_at', { ascending: false }),
          supabase
            .from('public_businesses_safe')
            .select(
              'id,industry,country_iso2,revenue_2025,revenue_currency,' +
                'ask_amount,ask_currency,stake_pct,deal_type,visible,status,' +
                'public_snapshot_json',
            )
            .eq('country_iso2', biz.country_iso2 || 'VN')
            .limit(80),
        ]);

        if (relationsRes.error) throw relationsRes.error;
        if (paymentsRes.error) throw paymentsRes.error;

        const relations =
          relationsRes.data && typeof relationsRes.data === 'object'
            ? (relationsRes.data as Record<string, any>)
            : {};

        setFiles(nextFiles || []);
        setImages(nextImages || []);
        setRequests(
          Array.isArray(relations.requests) ? relations.requests : [],
        );
        setInterests(
          Array.isArray(relations.interests) ? relations.interests : [],
        );
        setPayments(paymentsRes.data || []);
        setProposals(
          Array.isArray(relations.proposals) ? relations.proposals : [],
        );
        setSavedBusinesses(savedRes.error ? [] : (savedRes.data || []));
        setBenchmarkBusinesses(
          benchmarkRes.error ? [] : (benchmarkRes.data || []),
        );
      }
    } catch (e: any) { setErr(e?.message || 'Could not load dashboard data.'); }
    finally { setBusy(false); }
  }

  useEffect(() => {
    if (!profile) return;
    let active = true;
    setInitialLoadComplete(false);
    load().finally(() => {
      if (active) setInitialLoadComplete(true);
    });
    return () => { active = false; };
  }, [profile?.id]);

  useEffect(() => {
    if (!profile?.id || !b?.id) return;

    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') load();
    };

    window.addEventListener('focus', refreshWhenVisible);
    document.addEventListener('visibilitychange', refreshWhenVisible);

    const channel = supabase
      .channel(`business-dashboard-${b.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'businesses',
          filter: `id=eq.${b.id}`,
        },
        () => load(),
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'business_files',
          filter: `business_id=eq.${b.id}`,
        },
        () => load(),
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'business_images',
          filter: `business_id=eq.${b.id}`,
        },
        () => load(),
      )
      .subscribe();

    return () => {
      window.removeEventListener('focus', refreshWhenVisible);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
      supabase.removeChannel(channel);
    };
  }, [profile?.id, b?.id]);

  if (!profile || !initialLoadComplete) return <main className="d68-dashboard-page d68-business-dashboard-page"><div className="d68-dashboard-wrap"><div className="d68-dashboard-card">{T(lang, 'Đang tải hồ sơ doanh nghiệp...', 'Loading business profile...')}</div></div></main>;
  if (profile.role !== 'business' && profile.role !== 'admin') return <main className="d68-dashboard-page d68-business-dashboard-page"><div className="d68-dashboard-wrap"><div className="d68-dashboard-card"><h2>Business access only</h2><p>Role hiện tại: {profile.role}</p><Link to="/">Back home</Link></div></div></main>;
  if (!b && err) return <main className="d68-dashboard-page d68-business-dashboard-page"><div className="d68-dashboard-wrap"><div className="d68-dashboard-card" style={{ textAlign: 'center' }}><h2>{T(lang, 'Không thể tải hồ sơ doanh nghiệp', 'Could not load business profile')}</h2><p>{err}</p><button type="button" className="d68-dashboard-btn" onClick={() => { setInitialLoadComplete(false); load().finally(() => setInitialLoadComplete(true)); }}>{T(lang, 'Thử lại', 'Try again')}</button></div></div></main>;
  if (!b) return <main className="d68-dashboard-page d68-business-dashboard-page"><div className="d68-dashboard-wrap"><div className="d68-dashboard-card" style={{ textAlign: 'center' }}><h2>{T(lang, 'Chưa có hồ sơ doanh nghiệp', 'Business profile not found')}</h2><p>{T(lang, 'Tài khoản này chưa có hồ sơ DN hoặc đang chờ Admin kích hoạt.', 'This account has no business profile yet or is pending Admin activation.')}</p><Link className="d68-dashboard-btn" to={toLocalizedPath('/register/business', lang)}>{T(lang, 'Tạo hồ sơ DN', 'Create business profile')}</Link></div></div></main>;

  const score = b.quality_score === null || b.quality_score === undefined ? null : Math.round(Number(b.quality_score));
  const band = qBand(score ?? 0);
  const hasPublicSnapshot = !!b.public_snapshot_json;
  const hasPending = !!b.pending_changes_json || b.moderation_status === 'pending_admin_review';
  const ownerView = businessOwnerView(b);
  const planLabel = displayPlan(lang, b.plan);
  const status = displayStatus(lang, b, hasPublicSnapshot);
  const title = ownerView.company_name_private || ownerView.title_vi || ownerView.title_en || ownerView.public_code || 'Business profile';
  const quotaTotal = proposalQuotaTotal(b);
  const sentProposalCount = uniqueProposalInvestorCount(proposals);
  const remainingProposalQuota = Math.max(0, quotaTotal - sentProposalCount);
  const approvedProposalCount = uniqueProposalInvestorCount(proposals, ['approved', 'connected', 'fulfilled']);
  const investorAttentionCount = savedBusinesses.length + interests.length + requests.length + approvedProposalCount;
  const qualityItems = buildQualityItems(lang, ownerView, files, images);
  const qualityBreakdown = normalizeQualityBreakdown(b.quality_breakdown_json, score);
  const dashboardBenchmark = valuate(valuationInputFromBusiness(ownerView), valuationConfig);
  const businessValuation = dashboardBenchmark?.self ? { value: dashboardBenchmark.self, currency: dashboardBenchmark.currency } : estimateEnterpriseValue(ownerView);
  const industryBenchmark = dashboardBenchmark;

  async function saveProfile(e: FormEvent) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget as HTMLFormElement);
    const countryIso2 = fieldValue(fd, 'country_iso2') || ownerView.country_iso2 || 'VN';
    const submittedCity = fieldValue(fd, 'city') || ownerView.city || '';
    const cityKey = locationKeyFromLabel(
      fieldValue(fd, 'city_key') || submittedCity,
      countryIso2,
    );
    const city = locationDbLabel(cityKey || submittedCity, countryIso2);
    const currentFinancialInput = financialInputOf(ownerView);
    const assetsOwned = fieldValue(fd, 'assets_owned_localized');
    const includedTangibleAssets = fieldValue(fd, 'included_tangible_assets_localized');
    const financialSource = fieldValue(fd, 'financial_source');
    const localizedFinancialInput = lang === 'en'
      ? {
          assets_owned: assetsOwned,
          assets_owned_en: assetsOwned,
          included_tangible_assets: includedTangibleAssets,
          included_tangible_assets_en: includedTangibleAssets,
        }
      : {
          assets_owned: assetsOwned,
          assets_owned_vi: assetsOwned,
          included_tangible_assets: includedTangibleAssets,
          included_tangible_assets_vi: includedTangibleAssets,
        };
    const pending = {
      company_name_private: fieldValue(fd, 'company_name_private'),
      title_vi: fieldValue(fd, 'title_vi'),
      description_vi: fieldValue(fd, 'description_vi'),
      industry: fieldValue(fd, 'industry'),
      deal_type: fieldValue(fd, 'deal_type'),
      country_iso2: countryIso2,
      city,
      city_key: cityKey,
      highlights_vi: fieldValue(fd, 'highlights_vi'),
      investment_reason_vi: fieldValue(fd, 'investment_reason_vi'),
      revenue_month: Number(fd.get('revenue_month') || 0),
      revenue_2025: Number(fd.get('revenue_2025') || 0),
      revenue_currency: fieldValue(fd, 'revenue_currency') || b.revenue_currency || 'VND',
      ebitda_margin: Number(fd.get('ebitda_margin') || 0),
      growth_pct: Number(fd.get('growth_pct') || 0),
      ask_amount: Number(fd.get('ask_amount') || 0),
      ask_currency: fieldValue(fd, 'ask_currency') || b.ask_currency || b.revenue_currency || 'VND',
      stake_pct: Number(fd.get('stake_pct') || 0),
      offer_amount: Number(fd.get('ask_amount') || 0),
      offer_stake_pct: Number(fd.get('stake_pct') || 0),
      financial_input: {
        ...currentFinancialInput,
        ...localizedFinancialInput,
        financial_source: financialSource,
      }
    };
    const patch: any = { pending_changes_json: pending, pending_submitted_at: new Date().toISOString(), pending_submitted_by: profile.id, moderation_status: 'pending_admin_review' };
    if (!hasPublicSnapshot) { patch.status = 'pending_admin_review'; patch.visible = false; }
    const { error } = await supabase.from('businesses').update(patch).eq('id', b.id);
    setMsg(error ? '' : businessUpdateSuccessMsg(lang));
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
      setMsg(businessUpdateSuccessMsg(lang));
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
      setMsg(businessUpdateSuccessMsg(lang));
      await load();
    } catch (e: any) { setErr(e?.message || 'Upload failed.'); }
    finally { setBusy(false); e.target.value = ''; }
  }

  async function renameFile(row: any, displayName: string) {
    const safeName = String(displayName || row.display_name || row.file_name || '').trim();
    if (!safeName) return;
    try {
      await updateBusinessFile(row.id, { display_name: safeName, admin_note: 'User renamed file display name; Admin review remains required.' });
      setMsg(businessUpdateSuccessMsg(lang));
      await load();
    } catch (e: any) { setErr(e?.message || 'Update failed.'); }
  }

  async function deleteFile(row: any) {
    if (!confirm(T(lang, 'Xóa tài liệu này?', 'Delete this document?'))) {
      return;
    }

    setBusy(true);
    setErr('');
    setMsg('');

    try {
      await deleteBusinessFile(row);
      setFiles((current) =>
        current.filter((file) => String(file.id) !== String(row.id)),
      );
      setMsg(T(lang, 'Đã xóa tài liệu.', 'Document deleted.'));
      await load();
    } catch (e: any) {
      setErr(e?.message || T(lang, 'Xóa tài liệu thất bại.', 'Delete failed.'));
    } finally {
      setBusy(false);
    }
  }

  async function deleteImage(row: any) {
    if (!confirm(T(lang, 'Xóa ảnh này?', 'Delete this image?'))) {
      return;
    }

    setBusy(true);
    setErr('');
    setMsg('');

    try {
      await deleteBusinessImage(row);
      setImages((current) =>
        current.filter((image) => String(image.id) !== String(row.id)),
      );
      setMsg(T(lang, 'Đã xóa ảnh.', 'Image deleted.'));
      await load();
    } catch (e: any) {
      setErr(e?.message || T(lang, 'Xóa ảnh thất bại.', 'Delete failed.'));
    } finally {
      setBusy(false);
    }
  }

  async function renameImage(row: any) {
    const title = prompt(
      T(lang, 'Tên ảnh mới', 'New image title'),
      row.title || '',
    );
    if (title === null) return;

    setBusy(true);
    setErr('');
    setMsg('');

    try {
      const securedRow = await ensureBusinessImagePrivate(row);
      await updateBusinessImage(securedRow.id, {
        title,
        display_title: title,
        admin_note:
          'User renamed image; Admin must approve public display again.',
      });
      setMsg(businessUpdateSuccessMsg(lang));
      await load();
    } catch (e: any) {
      setErr(e?.message || T(lang, 'Cập nhật ảnh thất bại.', 'Update failed.'));
    } finally {
      setBusy(false);
    }
  }

  async function suggestHero(row: any) {
    try { await updateBusinessImage(row.id, { admin_note: 'User suggests this as hero image' }); setMsg(businessUpdateSuccessMsg(lang)); await load(); }
    catch (e: any) { setErr(e?.message || 'Update failed.'); }
  }

  async function acceptInterest(row: any) { const { error } = await supabase.from('investor_interests').update({ status: 'connected' }).eq('id', row.id); setErr(error?.message || ''); setMsg(error ? '' : T(lang, 'Đã đồng ý kết nối.', 'Connection accepted.')); load(); }
  async function rejectInterest(row: any) { const { error } = await supabase.from('investor_interests').update({ status: 'rejected' }).eq('id', row.id); setErr(error?.message || ''); setMsg(error ? '' : T(lang, 'Đã từ chối kết nối.', 'Connection rejected.')); load(); }
  async function fulfillRequest(row: any) { const { error } = await supabase.from('request_data').update({ status: 'fulfilled' }).eq('id', row.id); setErr(error?.message || ''); setMsg(error ? '' : T(lang, 'Đã đánh dấu hoàn tất.', 'Marked as fulfilled.')); load(); }

  return <main className="d68-dashboard-page d68-business-dashboard-page"><div className="d68-dashboard-wrap">
    <header className="d68-dashboard-head"><div><div className="d68-dashboard-kicker">Business Dashboard</div><h1>{title}</h1></div><div className="d68-dashboard-actions"><span className="d68-dashboard-badge blue">{planLabel}</span><span className={`d68-dashboard-badge ${status.cls}`}>{status.label}</span></div></header>
    {msg ? <div className="d68-dashboard-notice ok d68-business-update-alert">{msg}</div> : null}{err ? <div className="d68-dashboard-notice err">{err}</div> : null}{busy ? <div className="d68-dashboard-notice warn">{T(lang,'Đang tải dữ liệu...','Loading data...')}</div> : null}{hasPending ? <div className="d68-dashboard-notice ok d68-business-update-alert">{businessUpdateSuccessMsg(lang)}</div> : null}
    <div className="d68-dashboard-cols"><nav className="d68-dashboard-side">{tabs.map((t) => <Link key={t.id} to={toLocalizedPath(t.href, lang)} onClick={() => setTab(t.id)} className={tab === t.id ? 'active' : ''}><span className="d68-dashboard-nav-icon"><t.Icon size={17} strokeWidth={2.2} /></span><span>{T(lang,t.vi,t.en)}</span></Link>)}{b.slug ? <a className="d68-dashboard-public-link" href={toLocalizedPath(`/businesses/${b.slug}`, lang)} target="_blank" rel="noreferrer">{T(lang, 'Xem hồ sơ công khai', 'View public profile')} &gt;</a> : null}<div className="d68-dashboard-side__note">{T(lang,'Cần hỗ trợ hoàn thiện hồ sơ, định giá và tài liệu làm việc với Nhà đầu tư? Hãy tham khảo:', 'Need help preparing your profile, valuation and investor materials? Please refer to:')}<br/><a href="https://vietcapitalpartners.com" target="_blank" rel="noreferrer">vietcapitalpartners.com ↗</a><br/>Hotline: 0909.584.075</div></nav><section>
      {tab === 'overview' ? <><ValuationOverviewBox lang={lang} result={industryBenchmark} /><div className="d68-dashboard-scorecard"><div className="d68-dashboard-scorecard__ring" style={{ background: `conic-gradient(${score === null ? '#CBD5E1' : band.cls === 'green' ? '#16A34A' : band.cls === 'blue' ? '#1596cc' : '#B8860B'} ${Math.max(0, Math.min(100, score ?? 0)) * 3.6}deg, #EEF2F6 0deg)` }}><div><b>{score === null ? '—' : score}</b><span>/100</span></div></div><section><div><h2>Business Quality Score</h2><span className={`d68-dashboard-badge ${band.cls}`}>{score === null ? T(lang,'Đang cập nhật','Pending') : T(lang, band.labelVi, band.labelEn)}</span></div><p>{businessQualityPublicExplanation(lang)}</p></section></div><div className="d68-quality-list d68-dashboard-card"><div className="d68-quality-list__head"><BarChart3 size={18}/><h2>{T(lang,'Điểm theo nhóm tiêu chí','Score by criterion')}</h2></div>{qualityBreakdown.items.map((item) => <div key={item.key} className={`d68-quality-item ${item.score >= item.max * 0.7 ? 'ok' : 'missing'}`}><b>{qualityItemLabel(item, lang)}</b><span>{item.score}/{item.max} · {qualityItemNote(item, lang)}</span></div>)}</div><div className="d68-quality-list d68-dashboard-card"><div className="d68-quality-list__head"><BarChart3 size={18}/><h2>{T(lang,'Hồ sơ/tài liệu đạt yêu cầu','Required profile materials')}</h2></div>{qualityItems.map((item) => <div key={item.label} className={`d68-quality-item ${item.ok ? 'ok' : 'missing'}`}><b>{item.ok ? '✓' : '×'} {item.label}</b><span>{item.detail}</span></div>)}</div><div className="d68-dashboard-grid4 d68-business-overview-metrics">{metric(T(lang,'Trạng thái','Status'), status.label, status.cls)}{metric(T(lang,'Gói hiển thị','Listing plan'), planLabel)}{metric(T(lang,'Đã gửi Hồ sơ / Được duyệt','Proposals sent / approved'), `${sentProposalCount} / ${approvedProposalCount}`, approvedProposalCount ? 'green' : 'blue', T(lang,'Số lượt gửi Hồ sơ DN và số nhà đầu tư đã được duyệt/kết nối.', 'Business profile sends and investors approved/connected.'))}{metric(T(lang,'Nhà đầu tư quan tâm','Investor attention'), String(investorAttentionCount), investorAttentionCount ? 'green' : 'gold', T(lang,`Lưu hồ sơ: ${savedBusinesses.length} · Quan tâm: ${interests.length} · Yêu cầu data: ${requests.length}`, `Saved: ${savedBusinesses.length} · Interest: ${interests.length} · Data requests: ${requests.length}`))}</div><div className="d68-dashboard-card"><h2>{T(lang,'Hạn mức Gửi Hồ sơ doanh nghiệp/Proposal','Business profile / Proposal sending quota')}</h2><div className="d68-dashboard-progress"><span style={{ width: `${Math.min(100, Math.round((sentProposalCount / Math.max(1, quotaTotal)) * 100))}%` }} /></div><p><b>{sentProposalCount} / {quotaTotal}</b> · {T(lang, `đã dùng, còn lại ${remainingProposalQuota} lượt`, `used, ${remainingProposalQuota} sends remaining`)}</p><Link to={toLocalizedPath('/investors', lang)} className="d68-dashboard-btn gold">{T(lang,'Tìm Nhà đầu tư','Find investors')} →</Link></div></> : null}
      {tab === 'profile' ? (
        <ProfileForm
          key={`${b.id}:${b.updated_at || ''}:${b.pending_submitted_at || ''}`}
          lang={lang}
          b={ownerView}
          saveProfile={saveProfile}
        />
      ) : null}
      {tab === 'documents' ? <Documents lang={lang} files={files} deleteFile={deleteFile} renameFile={renameFile} fileChange={fileChange} newDocName={newDocName} setNewDocName={setNewDocName} newDocCategory={newDocCategory} setNewDocCategory={setNewDocCategory} /> : null}
      {tab === 'images' ? <Images lang={lang} images={images} imageChange={imageChange} deleteImage={deleteImage} renameImage={renameImage} suggestHero={suggestHero} /> : null}
      {tab === 'interests' ? <><ProposalRows lang={lang} rows={proposals} empty={T(lang,'Chưa gửi hồ sơ DN tới nhà đầu tư nào.','No business profile proposals sent yet.')} /><Rows title={T(lang,'Nhà đầu tư quan tâm','Investor interests')} rows={interests} empty={T(lang,'Chưa có nhà đầu tư quan tâm.','No investor interests yet.')} actions={(row: any) => <><button onClick={() => acceptInterest(row)} className="d68-dashboard-btn green">Accept</button><button onClick={() => rejectInterest(row)} className="d68-dashboard-btn red">Reject</button></>} /></> : null}
      {tab === 'requests' ? <Rows title={T(lang,'Yêu cầu dữ liệu','Data requests')} rows={requests} empty={T(lang,'Chưa có yêu cầu dữ liệu.','No data requests yet.')} actions={(row: any) => <button onClick={() => fulfillRequest(row)} className="d68-dashboard-btn green">Fulfilled</button>} /> : null}
      {tab === 'services' ? <BusinessBillingPanel lang={lang} b={b} payments={payments} profile={profile} setMsg={setMsg} setErr={setErr} onReload={load} /> : null}
    </section></div>
  </div></main>;
}


function BusinessBillingPanel({ lang, b, payments, profile, setMsg, setErr, onReload }: any) {
  const [open, setOpen] = useState(false);
  const [plan, setPlan] = useState<BusinessPlan>(String(b?.plan || '').includes('featured') ? 'featured' : 'standard');
  const [weeks, setWeeks] = useState<number>(16);
  const [promoCode, setPromoCode] = useState('');
  const [promoPct, setPromoPct] = useState(0);
  const [promoMsg, setPromoMsg] = useState('');
  const [promoLoading, setPromoLoading] = useState(false);
  const [paymentAck, setPaymentAck] = useState(false);
  const [orderBusy, setOrderBusy] = useState(false);
  const [qrSrc, setQrSrc] = useState('');
  const [orderCode, setOrderCode] = useState(() =>
    makePaymentOrderCode('BIZUP'),
  );

  const country = String(b?.country_iso2 || 'VN').toUpperCase();
  const price = calculatePricing({ role: 'business', country, termWeeks: weeks, businessPlan: plan, promoCode }, promoPct);
  const quotaAdd = businessProposalQuotaForPlan(plan);
  const qrAmountParam = price.currency === 'VND' ? `amount=${Math.round(price.total)}&` : '';
  const qrUrl = `https://img.vietqr.io/image/VCB-0011004000713-compact2.png?${qrAmountParam}addInfo=${encodeURIComponent(orderCode)}&accountName=${encodeURIComponent('Tieu Vo Dinh Phi')}`;
  useEffect(() => { setQrSrc(qrUrl); }, [qrUrl]);

  async function applyPromo() {
    setPromoLoading(true); setPromoMsg('');
    const res = await lookupPromo(promoCode, 'business').catch(() => ({ discountPct: 0 }));
    setPromoLoading(false);
    const pct = Number(res.discountPct || 0);
    setPromoPct(pct);
    setPromoMsg(pct ? T(lang, 'Mã hợp lệ, đã cập nhật số tiền giảm giá', 'Valid code, discount amount updated') : T(lang, 'Mã không hợp lệ', 'Invalid code'));
  }

  async function createUpgradeOrder() {
    if (!paymentAck) {
      setErr(
        T(
          lang,
          'Vui lòng xác nhận đã chuyển khoản đúng số tiền và nội dung.',
          'Please confirm the payment transfer details.',
        ),
      );
      return;
    }

    if (!profile?.id) {
      setErr(T(lang, 'Phiên đăng nhập không hợp lệ.', 'Invalid session.'));
      return;
    }

    setOrderBusy(true);
    setErr('');

    const payload = {
      orderType: 'business_service_upgrade',
      businessPlan: plan,
      proposalQuota: quotaAdd,
      termWeeks: weeks,
      amount: price.total,
      currency: price.currency,
      promoCode: promoCode.trim().toUpperCase() || null,
      promoDiscountPct: promoPct,
      bankContent: orderCode,
      orderCode,
      pricing: price,
    };

    try {
      await createOwnPaymentOrder({
        entity: 'business',
        entityId: b.id,
        profileId: profile.id,
        title:
          `${T(lang, 'Mua/Nâng cấp Gói dịch vụ', 'Buy/Upgrade service package')}` +
          ` - ${displayPlan(lang, plan)}` +
          ` - ${billingMoney(price.total, price.currency)}`,
        payload,
        orderCode,
      });

      setMsg(
        T(
          lang,
          'Đã ghi nhận thanh toán. Admin/SePay sẽ xác nhận để cập nhật gói hiển thị và cộng thêm lượt gửi Hồ sơ doanh nghiệp.',
          'Payment recorded. Admin/SePay confirmation will update the listing plan and add business profile sends.',
        ),
      );
      setOpen(false);
      setPaymentAck(false);
      setOrderCode(makePaymentOrderCode('BIZUP'));
      await onReload?.();
    } catch (error: any) {
      setErr(error?.message || T(lang, 'Không tạo được đơn thanh toán.', 'Could not create payment order.'));
    } finally {
      setOrderBusy(false);
    }
  }

  return <div className="d68-dashboard-card d68-dashboard-billing">
    <div className="d68-dashboard-row-head"><div><h2>{T(lang,'Thanh toán / Invoice','Payments / Invoices')}</h2><p>{T(lang,'Lịch sử thanh toán của doanh nghiệp và mua thêm/nâng cấp gói hiển thị.', 'Business payment history and service package upgrade.')}</p></div><button type="button" className="d68-dashboard-btn gold" onClick={() => setOpen((v) => !v)}>{T(lang,'Mua/Nâng cấp Gói dịch vụ','Buy/Upgrade service package')}</button></div>
    {b.plan_expires_at ? (
      <div className="d68-dashboard-notice">
        {T(lang, 'Hạn gói hiện tại', 'Current plan expiry')}: {formatServiceExpiry(b.plan_expires_at, lang === 'vi' ? 'vi-VN' : 'en-US')}
      </div>
    ) : null}
    <div className="d68-billing-history">
      {payments.length ? payments.map((p: any) => {
        const payload = paymentPayload(p);
        const amount = payload.amount ?? payload.pricing?.total;
        const currency = payload.currency ?? payload.pricing?.currency ?? 'VND';
        return <div key={p.id} className="d68-dashboard-row d68-billing-row"><div style={{ flex: 1 }}><b>{p.title || T(lang,'Đơn thanh toán','Payment order')}</b><div className="d68-dashboard-mini">{paymentStatusText(lang, p.status)} · {new Date(p.created_at).toLocaleString()} · {amount ? billingMoney(amount, currency) : T(lang,'Đang cập nhật','Pending')}</div>{paymentOrderCode(p) ? <div className="d68-dashboard-mini">{T(lang,'Mã đơn/Nội dung CK','Order/transfer code')}: {paymentOrderCode(p)}</div> : null}</div><span className={`d68-dashboard-badge ${String(p.status).toLowerCase() === 'confirmed' ? 'green' : 'gold'}`}>{paymentStatusText(lang, p.status)}</span></div>;
      }) : <div className="d68-dashboard-empty">{T(lang,'Chưa có lịch sử thanh toán.','No payment history yet.')}</div>}
    </div>
    {open ? <div className="d68-dashboard-upgrade-box">
      <h3>{T(lang,'Gói dịch vụ và Thanh toán','Service package and Payment')}</h3>
      <div className="d68-bizreg-options">
        {[
          { key: 'standard' as BusinessPlan, title: T(lang,'Gói Thường','Regular package'), desc: T(lang, `Hiển thị tại danh sách và gửi Hồ sơ doanh nghiệp tới tối đa ${businessProposalQuotaForPlan('standard')} nhà đầu tư`, `Display in the listing and send your business profile to up to ${businessProposalQuotaForPlan('standard')} investors`) },
          { key: 'featured' as BusinessPlan, title: T(lang,'Gói Ưu tiên ★','Priority package ★'), desc: T(lang, `Hiển thị tại danh sách/trang chủ và gửi Hồ sơ doanh nghiệp tới tối đa ${businessProposalQuotaForPlan('featured')} nhà đầu tư`, `Display in the listing/homepage and send your business profile to up to ${businessProposalQuotaForPlan('featured')} investors`) }
        ].map((item) => <button key={item.key} type="button" className={plan === item.key ? 'active' : ''} onClick={() => setPlan(item.key)}><h3>{item.title}</h3><p>{item.desc}</p><span>{businessProposalQuotaForPlan(item.key)} {T(lang,'lượt gửi Hồ sơ doanh nghiệp','business profile sends')}</span>{item.key === 'featured' ? <em>+30% {T(lang, 'so với gói Thường', 'vs Standard')}</em> : null}</button>)}
      </div>
      <div className="d68-bizreg-paygrid">
        <div className="d68-bizreg-payleft"><label className="d68-bizreg-label">{T(lang,'Kỳ hạn','Term')} <small>({T(lang,'tuần','weeks')})</small></label><div className="d68-bizreg-terms">{[4,8,12,16,24].map((t) => { const tmp = calculatePricing({ role:'business', country, termWeeks:t, businessPlan:plan, promoCode }, promoPct); return <button type="button" key={t} className={weeks === t ? 'active' : ''} onClick={() => setWeeks(t)}><b>{t}</b>{tmp.termDiscountPct ? <span>-{tmp.termDiscountPct}%</span> : null}</button>; })}</div><label className="d68-bizreg-label">{T(lang,'Mã khuyến mãi/giới thiệu','Promo/referral code')}</label><div className="d68-bizreg-promo"><input value={promoCode} onChange={(e) => setPromoCode(e.target.value.toUpperCase())} placeholder="DEALS68"/><button type="button" disabled={promoLoading} onClick={applyPromo}>{promoLoading ? '...' : T(lang,'Áp dụng','Apply')}</button></div>{promoMsg ? <p className={promoPct ? 'd68-bizreg-promo-ok' : 'd68-bizreg-promo-warn'}>{promoMsg}</p> : null}</div>
        <aside className="d68-bizreg-summary"><span>{T(lang,'Tạm tính','Estimate')}</span><div><span>{T(lang,'Phí dịch vụ','Service fee')}</span><b>{billingMoney(price.subtotal, price.currency)}</b></div><div className={price.termDiscountPct ? 'good' : ''}><span>{T(lang,'Chiết khấu kỳ hạn','Term discount')}</span><b>{price.termDiscountPct ? `-${billingMoney(price.termDiscount, price.currency)} (${price.termDiscountPct}%)` : T(lang,'Không','None')}</b></div><div className={price.promoDiscountPct ? 'good' : ''}><span>{T(lang,'Giảm giá','Promo discount')}</span><b>{price.promoDiscountPct ? `-${billingMoney(price.promoDiscount, price.currency)} (${price.promoDiscountPct}%)` : T(lang,'Không','None')}</b></div><div className="good"><span>{T(lang,'Cộng thêm lượt gửi','Additional sends')}</span><b>{quotaAdd}</b></div><strong>{T(lang,'Tổng thanh toán','Total due')}<b>{billingMoney(price.total, price.currency)}</b></strong></aside>
      </div>
      <div className="d68-bizreg-payment-methods d68-bizreg-payment-methods--primary"><button type="button" className="active"><span>💵</span>{T(lang,'Chuyển khoản QR','QR bank transfer')}</button></div>
      <div className="d68-bizreg-qrbox"><a href={qrSrc || qrUrl} target="_blank" rel="noreferrer"><img src={qrSrc || qrUrl} alt="QR Vietcombank" onError={() => setQrSrc(STATIC_VIETQR_URL)} /></a><div><p>{T(lang,'Người nhận:','Recipient:')} <b>Tieu Vo Dinh Phi</b></p><p>{T(lang,'Số TK:','Account no.:')} <b>0011004000713</b></p><p>{T(lang,'Nội dung:','Transfer note:')} <b>{orderCode}</b></p><p>{T(lang,'Số tiền:','Amount:')} <b>{billingMoney(price.total, price.currency)}</b></p></div><label><input type="checkbox" checked={paymentAck} onChange={(e) => setPaymentAck(e.target.checked)} /> {T(lang,'Tôi đã chuyển khoản đúng số tiền và nội dung ở trên','I have transferred the exact amount with the transfer note above')}</label></div>
      <div className="d68-bizreg-payment-methods d68-bizreg-payment-methods--secondary"><button type="button" disabled><span>💳</span>Sepay ({T(lang,'Thẻ nội địa / tín dụng','Debit / credit card')}) · {T(lang,'Sắp ra mắt','Coming soon')}</button><button type="button" disabled><span>💳</span>Stripe / Paypal · {T(lang,'Sắp ra mắt','Coming soon')}</button></div>
      <div style={{ display:'flex', justifyContent:'flex-end', marginTop: 14 }}><button type="button" disabled={orderBusy} className="d68-dashboard-btn gold" onClick={createUpgradeOrder}>{orderBusy ? T(lang,'Đang ghi nhận...','Recording...') : T(lang,'Tôi đã thanh toán','I have paid')}</button></div>
      <p className="d68-dashboard-mini">{T(lang,'Sau khi Admin/SePay xác nhận thanh toán, hệ thống sẽ cập nhật Gói hiển thị và cộng thêm lượt gửi Hồ sơ doanh nghiệp tương ứng.', 'After Admin/SePay confirms payment, the system updates the listing plan and adds the corresponding business profile sends.')}</p>
    </div> : null}
  </div>;
}

function ProfileForm({ lang, b, saveProfile }: any) {
  const countryIso2 = String(b.country_iso2 || 'VN').toUpperCase();
  const locationChoices = getLocationOptionsForCountry(countryIso2);
  const selectedCityKey = locationKeyFromLabel(b.city_key || b.city, countryIso2);
  const legacyCity = String(b.city || '').trim();
  const defaultCityKey = selectedCityKey || (!legacyCity ? locationChoices[0]?.key || '' : '');
  const [revenueCurrency, setRevenueCurrency] = useState(
    String(b.revenue_currency || 'VND').toUpperCase(),
  );
  const [askCurrency, setAskCurrency] = useState(
    String(b.ask_currency || b.revenue_currency || 'VND').toUpperCase(),
  );
  const financialInput = financialInputOf(b);
  const assetsOwnedValue = lang === 'en'
    ? financialInput.assets_owned_en || financialInput.assets_owned || ''
    : financialInput.assets_owned_vi || financialInput.assets_owned || '';
  const includedTangibleAssetsValue = lang === 'en'
    ? financialInput.included_tangible_assets_en || financialInput.included_tangible_assets || ''
    : financialInput.included_tangible_assets_vi || financialInput.included_tangible_assets || '';

  return <form onSubmit={saveProfile} className="d68-dashboard-card d68-business-profile-form">
    <h2>{T(lang,'Chỉnh sửa hồ sơ','Edit profile')}</h2>
    <p className="d68-business-profile-intro">{T(lang,'Thông tin hiển thị luôn ẩn danh, quản trị sẽ duyệt các thông tin bạn cập nhật.', 'Displayed information is always anonymous, and Admin will review the information you update.')}</p>
    <label className="d68-dashboard-field"><span>{T(lang,'Tên doanh nghiệp','Business name')}</span><input className="d68-dashboard-input" name="company_name_private" defaultValue={b.company_name_private || ''}/></label>
    <label className="d68-dashboard-field"><span>{T(lang,'Tên doanh nghiệp hiển thị (ẩn danh)','Displayed business name (anonymous)')}</span><input className="d68-dashboard-input" value={b.title_vi || ''} disabled readOnly/><input type="hidden" name="title_vi" value={b.title_vi || ''}/></label>
    <input type="hidden" name="country_iso2" value={countryIso2} />
    <div className="d68-dashboard-form2">
      <label className="d68-dashboard-field"><span>{T(lang,'Ngành','Industry')}</span><select className="d68-dashboard-input" name="industry" defaultValue={viIndustry(b.industry)}>{INDUSTRY_VI.map((x) => <option key={x}>{x}</option>)}</select></label>
      <label className="d68-dashboard-field">
        <span>{T(lang,'Tỉnh/Thành phố','Province/City')}</span>
        {locationChoices.length ? <>
          <select className="d68-dashboard-input" name="city_key" defaultValue={defaultCityKey}>
            {!selectedCityKey && legacyCity ? <option value="">{legacyCity}</option> : null}
            {locationChoices.map((item) => <option key={item.key} value={item.key}>{T(lang, item.vi, item.en)}</option>)}
          </select>
          <input type="hidden" name="city" value={legacyCity} />
        </> : <>
          <input className="d68-dashboard-input" name="city" defaultValue={legacyCity} />
          <input type="hidden" name="city_key" value={selectedCityKey} />
        </>}
      </label>
    </div>
    <label className="d68-dashboard-field"><span>{T(lang,'Tổng quan doanh nghiệp','Business overview')}</span><textarea className="d68-dashboard-input d68-dashboard-textarea" name="description_vi" defaultValue={b.description_vi || ''}/></label>
    <label className="d68-dashboard-field"><span>{T(lang,'Điểm nổi bật','Highlights')}</span><textarea className="d68-dashboard-input d68-dashboard-textarea" name="highlights_vi" defaultValue={b.highlights_vi || ''}/></label>
    <div className="d68-business-transaction-fields">
      <h3>{T(lang,'Thông tin Tài sản & Giao dịch','Assets & Transaction Information')}</h3>
      <label className="d68-dashboard-field"><span>{T(lang,'Tài sản hữu hình & vô hình doanh nghiệp sở hữu (Không bắt buộc điền)','Tangible and intangible assets owned by the business (Optional)')}</span><textarea className="d68-dashboard-input d68-dashboard-textarea" name="assets_owned_localized" defaultValue={assetsOwnedValue} placeholder={T(lang,'Không bắt buộc điền','Optional')}/><small>{T(lang,'Ví dụ: thương hiệu, quyền sở hữu trí tuệ, hệ thống, máy móc, phương tiện, bất động sản hoặc tài sản khác.','Examples: brand, intellectual property, systems, machinery, vehicles, real estate or other assets.')}</small></label>
      <label className="d68-dashboard-field"><span>{T(lang,'Mô tả giá trị của các tài sản hữu hình thuộc sở hữu của doanh nghiệp sẽ được đưa vào giao dịch (Không bắt buộc điền)','Description and value of tangible assets owned by the business that will be included in the transaction (Optional)')}</span><textarea className="d68-dashboard-input d68-dashboard-textarea" name="included_tangible_assets_localized" defaultValue={includedTangibleAssetsValue} placeholder={T(lang,'Không bắt buộc điền','Optional')}/><small>{T(lang,'Ví dụ: khi bán khách sạn, giao dịch có thể bao gồm quyền sử dụng đất, công trình khách sạn, nội thất và thiết bị. Nêu giá trị ước tính và đơn vị tiền nếu có.','Example: a hotel sale may include land-use rights, the hotel building, furniture and equipment. Include estimated values and currency where available.')}</small></label>
      <label className="d68-dashboard-field"><span>{T(lang,'Nguồn số liệu tài chính (Không bắt buộc điền)','Financial data source (Optional)')}</span><select className="d68-dashboard-input" name="financial_source" defaultValue={financialInput.financial_source || ''}><option value="">{T(lang,'Chọn nguồn số liệu nếu có','Select a data source if available')}</option><option value="management_accounts">{T(lang,'Số liệu quản trị nội bộ','Management accounts')}</option><option value="tax_report">{T(lang,'Báo cáo thuế','Tax filings')}</option><option value="audited_financials">{T(lang,'Báo cáo kiểm toán','Audited financials')}</option><option value="bank_statement">{T(lang,'Sao kê ngân hàng / POS','Bank / POS statements')}</option><option value="estimate">{T(lang,'Ước tính của chủ DN','Founder estimate')}</option></select></label>
    </div>
    <div className="d68-dashboard-form2 d68-business-financial-fields">
      <label className="d68-dashboard-field d68-business-financial-span2"><span>{T(lang,'Loại giao dịch','Deal type')}</span><select className="d68-dashboard-input" name="deal_type" defaultValue={viDealType(b.deal_type)}>{DEAL_TYPE_VI.map((x) => <option key={x}>{x}</option>)}</select></label>
      <label className="d68-dashboard-field"><span>{T(lang,'Doanh thu tháng','Monthly revenue')}</span><FormattedNumberInput name="revenue_month" defaultValue={b.revenue_month || b.financial_input?.revenue_month || 0} /></label>
      <CurrencyField lang={lang} value={revenueCurrency} onChange={setRevenueCurrency} />
      <label className="d68-dashboard-field"><span>{T(lang,'Doanh thu năm','Annual revenue')}</span><FormattedNumberInput name="revenue_2025" defaultValue={b.revenue_2025 || 0} /></label>
      <CurrencyField lang={lang} name="revenue_currency" value={revenueCurrency} onChange={setRevenueCurrency} />
      <label className="d68-dashboard-field"><span>EBITDA margin (%)</span><FormattedNumberInput name="ebitda_margin" defaultValue={b.ebitda_margin || 0} allowDecimal /></label>
      <label className="d68-dashboard-field"><span>{T(lang,'Tăng trưởng năm (%)','Annual growth (%)')}</span><FormattedNumberInput name="growth_pct" defaultValue={b.growth_pct || b.financial_input?.growth_pct || 0} allowDecimal /></label>
      <label className="d68-dashboard-field"><span>{T(lang,'Nhu cầu vốn/Giá chào','Ask amount')}</span><FormattedNumberInput name="ask_amount" defaultValue={b.ask_amount || 0} /></label>
      <CurrencyField lang={lang} name="ask_currency" value={askCurrency} onChange={setAskCurrency} />
      <label className="d68-dashboard-field"><span>{T(lang,'Tỷ lệ cổ phần (%)','Stake (%)')}</span><FormattedNumberInput name="stake_pct" defaultValue={b.stake_pct || 0} allowDecimal /></label>
    </div>
    <label className="d68-dashboard-field"><span>{T(lang,'Lý do giao dịch / dùng vốn','Reason / use of funds')}</span><textarea className="d68-dashboard-input d68-dashboard-textarea" name="investment_reason_vi" defaultValue={b.investment_reason_vi || ''}/></label>
    <div style={{ display: 'flex', justifyContent: 'flex-end' }}><button className="d68-dashboard-btn">{T(lang,'Lưu & gửi Admin duyệt','Save & submit to Admin')}</button></div>
  </form>;
}

function CurrencyField({ lang, name, value, onChange }: {
  lang: Lang;
  name?: string;
  value: string;
  onChange?: (value: string) => void;
}) {
  return <label className="d68-dashboard-field d68-business-currency-field">
    <span>{T(lang,'Đơn vị','Currency')}</span>
    <select
      className="d68-dashboard-input"
      name={name}
      value={value}
      onChange={(event) => onChange?.(event.target.value)}
    >
      <option value="VND">VND</option>
      <option value="USD">USD</option>
    </select>
  </label>;
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
  return <div className="d68-dashboard-card"><h2>{T(lang,'Tài liệu doanh nghiệp','Business documents')}</h2><p>{T(lang,'File hiển thị luôn ở trạng thái khóa. Chỉ nhà đầu tư mới xem Tên file và tải về sau khi đã kết nối.', 'Files are always shown as locked. Only investors can view file names and download them after an approved connection.')}</p>{files.map((d: any) => <DocumentRow key={d.id} lang={lang} d={d} renameFile={renameFile} deleteFile={deleteFile} />)}{!files.length ? <div className="d68-dashboard-empty">{T(lang,'Chưa có tài liệu.','No documents yet.')}</div> : null}<div className="d68-document-upload"><h3>{T(lang,'Tải hồ sơ mới','Upload a new document')}</h3><div className="d68-dashboard-form2"><label className="d68-dashboard-field"><span>{T(lang,'Nhập tên file','Enter file name')}</span><input className="d68-dashboard-input" value={newDocName} onChange={(e) => setNewDocName(e.target.value)} placeholder={T(lang,'VD: Báo cáo tài chính 2025, Company profile...', 'E.g. 2025 financials, company profile...')} /></label><label className="d68-dashboard-field"><span>{T(lang,'Loại tài liệu','Document type')}</span><select className="d68-dashboard-input" value={newDocCategory} onChange={(e) => setNewDocCategory(e.target.value)}><option value="financials">Financials</option><option value="profile">Profile</option><option value="im">Teaser / IM</option><option value="legal">Legal</option><option value="other">Other</option></select></label></div><label className="d68-dashboard-btn" style={{ display: 'inline-block', marginTop: 14 }}>+ {T(lang,'Chọn file & tải lên','Choose file & upload')}<input type="file" accept={DOC_ACCEPT} onChange={fileChange} style={{ display: 'none' }}/></label></div></div>;
}

function Images({ lang, images, imageChange, deleteImage, renameImage, suggestHero }: any) {
  return <div className="d68-dashboard-card"><h2>{T(lang,'Ảnh doanh nghiệp','Business images')}</h2><p>{T(lang,'Ảnh hiển thị luôn đảm bảo ẩn danh, quản trị sẽ duyệt và làm mờ tên/thương hiệu nếu có trước khi hiển thị.', 'Images are always displayed anonymously; Admin will review and blur names/brands if needed before display.')}</p>{images.map((im: any) => <div key={im.id} className="d68-dashboard-row"><img className="d68-dashboard-thumb" src={im.public_url} alt={im.title || 'image'}/><div style={{ flex: 1 }}><b>{im.display_title || im.title || 'Image'}</b><div className="d68-dashboard-mini">{im.public_visible ? 'public' : 'not public'} · {im.is_sanitized ? 'sanitized' : 'pending sanitize'} · {im.is_hero ? 'hero' : 'gallery'}</div></div><button onClick={() => renameImage(im)} className="d68-dashboard-btn light">{T(lang,'Sửa tên','Rename')}</button><button onClick={() => suggestHero(im)} className="d68-dashboard-btn gold">Hero</button><button onClick={() => deleteImage(im)} className="d68-dashboard-btn red">{T(lang,'Xóa','Delete')}</button></div>)}{!images.length ? <div className="d68-dashboard-empty">{T(lang,'Chưa có ảnh.','No images yet.')}</div> : null}<label className="d68-dashboard-btn" style={{ display: 'inline-block', marginTop: 14 }}>+ {T(lang,'Tải ảnh','Upload image')}<input type="file" accept="image/png,image/jpeg,image/webp" onChange={imageChange} style={{ display: 'none' }}/></label></div>;
}

function proposalDisplayStatus(status: any, lang: Lang) {
  const s = String(status || 'sent');
  if (s === 'approved' || s === 'connected') return { label: T(lang, 'Đã duyệt', 'Approved'), cls: 'green' };
  if (s === 'declined') return { label: T(lang, 'Đã từ chối', 'Declined'), cls: 'red' };
  if (s === 'request_data') return { label: T(lang, 'Yêu cầu tài liệu', 'Data requested'), cls: 'blue' };
  return { label: T(lang, 'Chưa duyệt', 'Pending review'), cls: 'gold' };
}
function investorTicket(inv: any, lang: Lang) {
  const min = Number(inv?.ticket_min || 0), max = Number(inv?.ticket_max || 0);
  const fmt = (v: number) => v >= 1_000_000 ? `$${(v / 1_000_000).toLocaleString('en-US', { maximumFractionDigits: 1 })}M` : `$${Math.round(v / 1000).toLocaleString('en-US')}K`;
  if (min && max) return `${fmt(min)} – ${fmt(max)}`;
  if (max) return `≤ ${fmt(max)}`;
  if (min) return `≥ ${fmt(min)}`;
  return T(lang, 'Đang cập nhật', 'Updating');
}
function ProposalRows({ lang, rows, empty }: any) {
  return <div className="d68-dashboard-card"><h2>{T(lang,'Proposal đã gửi','Sent proposals')}</h2>{rows.map((row: any) => { const inv = row.investors || {}; const st = proposalDisplayStatus(row.status, lang); const title = inv.title_vi || inv.title_en || inv.code || row.investor_id || row.id; return <div key={row.id} className="d68-dashboard-row d68-proposal-row"><div style={{ flex: 1 }}><a href={inv.code ? `/investors/${inv.code}` : undefined} target="_blank" rel="noreferrer" className="d68-dashboard-row-title d68-entity-title-link">{title}</a><div className="d68-dashboard-mini">{inv.country || inv.country_iso2 || '—'} · {T(lang,'Khoản đầu tư','Ticket')}: {investorTicket(inv, lang)} · {new Date(row.sent_at || row.created_at || Date.now()).toLocaleString(lang === 'en' ? 'en-US' : 'vi-VN')}</div></div><span className={`d68-dashboard-badge ${st.cls}`}>{st.label}</span></div>; })}{!rows.length ? <div className="d68-dashboard-empty">{empty}</div> : null}</div>;
}
function Rows({ title, rows, empty, actions }: any) {
  return <div className="d68-dashboard-card"><h2>{title}</h2>{rows.map((row: any) => <div key={row.id} className="d68-dashboard-row"><div style={{ flex: 1 }}><b>{row.investors?.title_vi || row.investors?.title_en || row.investors?.code || row.id}</b><div className="d68-dashboard-mini">{row.status || 'new'} · {new Date(row.created_at || row.sent_at || Date.now()).toLocaleString()}</div>{userFacingNote(row) ? <p>{userFacingNote(row)}</p> : null}</div><div className="d68-dashboard-actions">{actions ? actions(row) : null}</div></div>)}{!rows.length ? <div className="d68-dashboard-empty">{empty}</div> : null}</div>;
}
