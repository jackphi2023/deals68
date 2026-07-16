import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import InvestorAppetiteEditorV10 from '../components/admin/InvestorAppetiteEditorV10';
import InvestorCoverEditorV10 from '../components/admin/InvestorCoverEditorV10';
import InvestorProfileEditorV10 from '../components/admin/InvestorProfileEditorV10';
import AdminV10Shell from '../components/admin/AdminV10Shell';
import { useAuth } from '../contexts/AuthContext';
import {
  investorDisplayNameV10,
  investorNeedsReviewV10,
  investorReviewReasonsV10,
  objectOf,
  valueList,
  type InvestorRow,
} from '../lib/investorAdminV10';
import {
  INVESTOR_TYPE_OPTIONS,
  optionLabels,
  optionValues,
} from '../lib/investorCriteriaOptions';
import {
  getDefaultInvestorCover,
  type InvestorCoverBanner,
} from '../lib/investorProfileService';
import { countryOptions } from '../lib/labels';
import { industryKeyFromLabel, industryOptions } from '../lib/industryTaxonomy';
import { formatServiceExpiry, paymentOrderCode } from '../lib/paymentOrders';
import { supabase } from '../lib/supabase';

const PAGE_SIZE = 30;

type ServiceState = 'active' | 'expiring' | 'expired' | 'unpaid';

function clean(value: unknown) {
  return String(value ?? '').trim();
}

function dateMs(value: unknown) {
  const result = new Date(String(value || '')).getTime();
  return Number.isFinite(result) ? result : 0;
}

function dateTime(value: unknown) {
  if (!value) return '—';
  const date = new Date(String(value));
  return Number.isFinite(date.getTime()) ? date.toLocaleString('vi-VN') : '—';
}

function countryLabel(value: unknown) {
  const raw = clean(value).toUpperCase();
  return countryOptions.find((item) => item.iso2 === raw)?.vi || clean(value) || '—';
}

function investorTypes(row: InvestorRow) {
  const criteria = objectOf(row.criteria);
  return optionValues(criteria.investorTypes || [row.type].filter(Boolean), INVESTOR_TYPE_OPTIONS);
}

function targetCountries(row: InvestorRow) {
  const criteria = objectOf(row.criteria);
  return Array.from(new Set(
    valueList(
      criteria.targetCountries ||
      criteria.targetCountriesCache ||
      criteria.preferredCountries ||
      objectOf(row.privacy).preferredCountries ||
      [],
    ).map((item) => item.toUpperCase()),
  ));
}

function investorIndustries(row: InvestorRow) {
  const criteria = objectOf(row.criteria);
  return Array.from(new Set(
    [...valueList(row.industries), ...valueList(criteria.sectors)]
      .map((item) => industryKeyFromLabel(item))
      .filter(Boolean),
  ));
}

function profileForInvestor(row: InvestorRow, profiles: InvestorRow[]) {
  return profiles.find((item) =>
    String(item.id) === String(row.owner_id) ||
    clean(item.username) === clean(row.username) ||
    clean(item.email) === clean(row.private_email),
  ) || {};
}

function paymentsForInvestor(row: InvestorRow, profiles: InvestorRow[], payments: InvestorRow[]) {
  const loginProfile = profileForInvestor(row, profiles);
  return payments
    .filter((item) =>
      String(item.investor_id || '') === String(row.id) ||
      String(item.profile_id || '') === String(loginProfile.id || row.owner_id || '') ||
      String(item.created_by || '') === String(loginProfile.id || row.owner_id || ''),
    )
    .sort((left, right) => dateMs(right.created_at) - dateMs(left.created_at));
}

function serviceSummary(row: InvestorRow, profiles: InvestorRow[], payments: InvestorRow[]) {
  const related = paymentsForInvestor(row, profiles, payments);
  const latest = related[0] || null;
  const expiresAt = dateMs(row.membership_expires_at);
  const now = Date.now();
  const days = expiresAt ? Math.ceil((expiresAt - now) / 86_400_000) : null;
  const confirmed = related.some((item) => String(item.status || '').toLowerCase() === 'confirmed');
  let state: ServiceState = 'unpaid';
  if (expiresAt && expiresAt < now) state = 'expired';
  else if (expiresAt && days !== null && days <= 30) state = 'expiring';
  else if (expiresAt || confirmed) state = 'active';
  const price = objectOf(objectOf(latest?.payload).price);
  const plan = clean(price.planLabel || objectOf(latest?.payload).planLabel || objectOf(latest?.payload).plan || latest?.title) || 'Chưa có gói';
  return { state, days, latest, related, plan };
}

function serviceLabel(state: ServiceState) {
  if (state === 'active') return ['Đang hoạt động', 'ok'];
  if (state === 'expiring') return ['Sắp hết hạn', 'warn'];
  if (state === 'expired') return ['Đã hết hạn', 'err'];
  return ['Chưa xác nhận thanh toán', 'warn'];
}

function paymentAmount(row: InvestorRow | null) {
  const price = objectOf(objectOf(row?.payload).price);
  const total = Number(price.total || objectOf(row?.payload).total || 0);
  const currency = clean(price.currency || objectOf(row?.payload).currency);
  if (!total) return '—';
  return `${total.toLocaleString(currency === 'VND' ? 'vi-VN' : 'en-US')} ${currency}`.trim();
}

export default function AdminInvestorsV10() {
  const { profile, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const query = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const pathParts = location.pathname.replace(/^\/+|\/+$/g, '').split('/');
  const selectedKey = pathParts[0] === 'admin' && pathParts[1] === 'investors' && pathParts[2]
    ? decodeURIComponent(pathParts[2])
    : '';

  const [rows, setRows] = useState<InvestorRow[]>([]);
  const [profiles, setProfiles] = useState<InvestorRow[]>([]);
  const [payments, setPayments] = useState<InvestorRow[]>([]);
  const [defaultCover, setDefaultCover] = useState<InvestorCoverBanner | null>(null);
  const [search, setSearch] = useState(() => query.get('q') || '');
  const [reviewFilter, setReviewFilter] = useState(() => query.get('review') || '');
  const [visibilityFilter, setVisibilityFilter] = useState(() => query.get('iv') || '');
  const [typeFilter, setTypeFilter] = useState(() => query.get('it') || '');
  const [officeCountryFilter, setOfficeCountryFilter] = useState(() => query.get('io') || '');
  const [targetCountryFilter, setTargetCountryFilter] = useState(() => query.get('ic') || '');
  const [industryFilter, setIndustryFilter] = useState(() => query.get('ii') || '');
  const [serviceFilter, setServiceFilter] = useState(() => query.get('service') || '');
  const [page, setPage] = useState(() => Math.max(1, Number(query.get('ip') || 1)));
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');

  const selected = selectedKey
    ? rows.find((row) => [row.id, row.code].map(String).includes(selectedKey)) || null
    : null;

  function replaceQuery(patch: Record<string, string | number | null>) {
    const next = new URLSearchParams(location.search);
    Object.entries(patch).forEach(([key, value]) => {
      const normalized = clean(value);
      if (!normalized || normalized === '1') next.delete(key);
      else next.set(key, normalized);
    });
    navigate({ pathname: location.pathname, search: next.toString() ? `?${next}` : '' }, { replace: true });
  }

  function resetPage(patch: Record<string, string | number | null>) {
    setPage(1);
    replaceQuery({ ...patch, ip: null });
  }

  async function loadAll() {
    setBusy(true);
    setError('');
    try {
      const [investorResult, profileResult, paymentResult, coverResult] = await Promise.all([
        supabase.from('investors').select('*').order('created_at', { ascending: false }).limit(3000),
        supabase.from('profiles').select('id,role,username,display_name,email,country_iso2,phone,status,dashboard_login_enabled,created_at,updated_at').limit(3000),
        supabase.from('payment_orders').select('*').order('created_at', { ascending: false }).limit(3000),
        getDefaultInvestorCover('vi', true).catch(() => null),
      ]);
      if (investorResult.error) throw investorResult.error;
      if (profileResult.error) throw profileResult.error;
      if (paymentResult.error) throw paymentResult.error;
      setRows(Array.isArray(investorResult.data) ? investorResult.data : []);
      setProfiles(Array.isArray(profileResult.data) ? profileResult.data : []);
      setPayments(Array.isArray(paymentResult.data) ? paymentResult.data : []);
      setDefaultCover(coverResult);
    } catch (loadError: any) {
      setError(loadError?.message || 'Không tải được dữ liệu Nhà đầu tư.');
    } finally {
      setBusy(false);
    }
  }

  async function refreshInvestor(id: string) {
    const { data, error: refreshError } = await supabase
      .from('investors')
      .select('*')
      .eq('id', id)
      .single();
    if (refreshError) throw refreshError;
    setRows((current) => current.map((row) => String(row.id) === id ? data : row));
  }

  useEffect(() => {
    if (profile?.role === 'admin') loadAll();
  }, [profile?.role]);

  useEffect(() => {
    setSearch(query.get('q') || '');
    setReviewFilter(query.get('review') || '');
    setVisibilityFilter(query.get('iv') || '');
    setTypeFilter(query.get('it') || '');
    setOfficeCountryFilter(query.get('io') || '');
    setTargetCountryFilter(query.get('ic') || '');
    setIndustryFilter(query.get('ii') || '');
    setServiceFilter(query.get('service') || '');
    setPage(Math.max(1, Number(query.get('ip') || 1)));
  }, [location.search]);

  const reviewCounts = useMemo(() => rows.reduce((result, row) => {
    const reasons = investorReviewReasonsV10(row);
    if (reasons.newAccount) result.newAccount += 1;
    if (reasons.profileUpdated) result.profileUpdated += 1;
    if (reasons.criteriaUpdated) result.criteriaUpdated += 1;
    if (reasons.any) result.total += 1;
    return result;
  }, { total: 0, newAccount: 0, profileUpdated: 0, criteriaUpdated: 0 }), [rows]);

  const officeCountries = useMemo(() => Array.from(new Set(
    rows.map((row) => clean(row.country_iso2).toUpperCase()).filter(Boolean),
  )).sort((left, right) => countryLabel(left).localeCompare(countryLabel(right), 'vi')), [rows]);

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return rows
      .filter((row) => {
        const reasons = investorReviewReasonsV10(row);
        const service = serviceSummary(row, profiles, payments);
        if (keyword && ![
          row.code,
          row.private_name,
          row.private_email,
          row.title_vi,
          row.title_en,
          row.type,
          row.country,
          row.country_iso2,
          row.status,
        ].some((value) => clean(value).toLowerCase().includes(keyword))) return false;
        if (reviewFilter === 'pending' && !reasons.any) return false;
        if (reviewFilter === 'new' && !reasons.newAccount) return false;
        if (reviewFilter === 'profile' && !reasons.profileUpdated) return false;
        if (reviewFilter === 'criteria' && !reasons.criteriaUpdated) return false;
        if (visibilityFilter === 'visible' && row.visible !== true) return false;
        if (visibilityFilter === 'hidden' && row.visible === true) return false;
        if (typeFilter && !investorTypes(row).includes(typeFilter)) return false;
        if (officeCountryFilter && clean(row.country_iso2).toUpperCase() !== officeCountryFilter) return false;
        if (targetCountryFilter && !targetCountries(row).includes(targetCountryFilter)) return false;
        if (industryFilter && !investorIndustries(row).includes(industryFilter)) return false;
        if (serviceFilter && service.state !== serviceFilter) return false;
        return true;
      })
      .sort((left, right) => {
        const reviewPriority = Number(investorNeedsReviewV10(right)) - Number(investorNeedsReviewV10(left));
        if (reviewPriority) return reviewPriority;
        return dateMs(right.updated_at || right.created_at) - dateMs(left.updated_at || left.created_at);
      });
  }, [rows, profiles, payments, search, reviewFilter, visibilityFilter, typeFilter, officeCountryFilter, targetCountryFilter, industryFilter, serviceFilter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const paginated = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  if (loading) return <section className="d68-admin-page"><div className="d68-admin-wrap">Đang tải…</div></section>;
  if (profile?.role !== 'admin') return <Navigate to="/login?next=/admin/investors" replace />;

  if (selectedKey) {
    if (!selected && !busy) {
      return <AdminV10Shell current="/admin/investors" title="Không tìm thấy Nhà đầu tư" subtitle={`Mã/ID: ${selectedKey}`}><Link className="d68-admin-btn blue" to={`/admin/investors${location.search}`}>← Quay lại danh sách</Link></AdminV10Shell>;
    }
    if (!selected) {
      return <AdminV10Shell current="/admin/investors" title="Đang tải hồ sơ Nhà đầu tư" subtitle="Vui lòng chờ…"><div className="d68-admin-card">Đang tải…</div></AdminV10Shell>;
    }

    const loginProfile = profileForInvestor(selected, profiles);
    const service = serviceSummary(selected, profiles, payments);
    const [serviceText, serviceClass] = serviceLabel(service.state);
    const reasons = investorReviewReasonsV10(selected);
    const latestPayment = service.latest;
    const backUrl = `/admin/investors${location.search}`;

    return (
      <AdminV10Shell
        current="/admin/investors"
        title={`${selected.code || 'Investor'} · ${investorDisplayNameV10(selected)}`}
        subtitle="Hồ sơ, tài khoản, gói dịch vụ, ảnh cover và hàng chờ duyệt."
        actions={<div className="d68-admin-actions"><Link className="d68-admin-btn" to={backUrl}>← Danh sách</Link><button type="button" className="d68-admin-btn" disabled={busy} onClick={loadAll}>{busy ? 'Đang tải…' : 'Làm mới'}</button></div>}
      >
        {error ? <div className="d68-admin-notice err">{error}</div> : null}
        {reasons.any ? <div className="d68-admin-notice warn"><b>Hồ sơ cần kiểm tra:</b>{' '}{[
          reasons.newAccount ? 'Tài khoản mới/chờ kích hoạt' : '',
          reasons.profileUpdated ? 'Hồ sơ public vừa cập nhật' : '',
          reasons.criteriaUpdated ? 'Khẩu vị & tiêu chí vừa cập nhật' : '',
        ].filter(Boolean).join(' · ')}</div> : null}

        <div className="d68-admin-grid2">
          <section className="d68-admin-card">
            <h2>Tài khoản đăng nhập</h2>
            <div className="d68-admin-summary-grid">
              <div><span>Username</span><b>{loginProfile.username || selected.username || '—'}</b></div>
              <div><span>Email tài khoản</span><b>{loginProfile.email || selected.private_email || '—'}</b></div>
              <div><span>Điện thoại</span><b>{loginProfile.phone || selected.private_phone || '—'}</b></div>
              <div><span>Trạng thái tài khoản</span><b>{loginProfile.status || selected.status || '—'}</b></div>
              <div><span>Dashboard</span><b>{loginProfile.dashboard_login_enabled ? 'Đã mở khóa' : 'Chưa mở khóa'}</b></div>
              <div><span>Ngày tạo</span><b>{dateTime(selected.created_at)}</b></div>
            </div>
          </section>

          <section className="d68-admin-card">
            <div className="d68-v10-section-head"><div><h2>Gói dịch vụ & hiển thị</h2><p>Thông tin lấy từ Investor, membership và payment order gần nhất.</p></div><span className={`d68-admin-badge ${serviceClass}`}>{serviceText}</span></div>
            <div className="d68-admin-summary-grid">
              <div><span>Gói dịch vụ</span><b>{service.plan}</b></div>
              <div><span>Bắt đầu</span><b>{formatServiceExpiry(selected.membership_started_at)}</b></div>
              <div><span>Hết hạn</span><b>{formatServiceExpiry(selected.membership_expires_at)}</b></div>
              <div><span>Còn lại</span><b>{service.days === null ? '—' : service.days >= 0 ? `${service.days} ngày` : `Quá hạn ${Math.abs(service.days)} ngày`}</b></div>
              <div><span>Public</span><b>{selected.visible ? 'Đang hiển thị' : 'Đang ẩn'}</b></div>
              <div><span>Verified</span><b>{selected.verified ? 'Đã xác minh' : 'Chưa xác minh'}</b></div>
              <div><span>Payment gần nhất</span><b>{latestPayment?.status || '—'}</b></div>
              <div><span>Số tiền</span><b>{paymentAmount(latestPayment)}</b></div>
              <div><span>Mã thanh toán</span><b>{latestPayment ? paymentOrderCode(latestPayment) || '—' : '—'}</b></div>
              <div><span>Cập nhật gần nhất</span><b>{dateTime(selected.updated_at)}</b></div>
            </div>
          </section>
        </div>

        <InvestorCoverEditorV10 investor={selected} defaultCover={defaultCover} onRefresh={() => refreshInvestor(String(selected.id))} />
        <InvestorProfileEditorV10 investor={selected} onRefresh={() => refreshInvestor(String(selected.id))} />
        <InvestorAppetiteEditorV10 investor={selected} onRefresh={() => refreshInvestor(String(selected.id))} />
      </AdminV10Shell>
    );
  }

  return (
    <AdminV10Shell
      current="/admin/investors"
      title="Quản trị Nhà đầu tư"
      subtitle="Giữ bộ lọc của Admin main; mở từng hồ sơ để xem và duyệt chi tiết."
      actions={<button type="button" className="d68-admin-btn" disabled={busy} onClick={loadAll}>{busy ? 'Đang tải…' : 'Làm mới'}</button>}
    >
      {error ? <div className="d68-admin-notice err">{error}</div> : null}
      {reviewCounts.total ? (
        <div className="d68-admin-notice warn">
          <b>⚠️ Có {reviewCounts.total} Nhà đầu tư cần kiểm tra:</b>{' '}
          {reviewCounts.newAccount} tài khoản mới/chờ kích hoạt · {reviewCounts.profileUpdated} hồ sơ vừa cập nhật · {reviewCounts.criteriaUpdated} khẩu vị/tiêu chí vừa cập nhật.
        </div>
      ) : <div className="d68-admin-notice ok">Không có hồ sơ Nhà đầu tư chờ duyệt.</div>}

      <section className="d68-admin-card">
        <div className="d68-admin-row-head"><div><h2>Danh sách Nhà đầu tư</h2><p className="d68-admin-subtle">Hiển thị {paginated.length}/{filtered.length} kết quả · {PAGE_SIZE}/trang</p></div><span className="d68-admin-badge blue">Tổng {rows.length}</span></div>
        <div className="d68-admin-form4">
          <label className="d68-admin-field"><span>Tìm kiếm</span><input className="d68-admin-input" value={search} onChange={(event) => { setSearch(event.target.value); resetPage({ q: event.target.value }); }} placeholder="Mã, tên, email, quốc gia…" /></label>
          <label className="d68-admin-field"><span>Hàng chờ</span><select className="d68-admin-input" value={reviewFilter} onChange={(event) => { setReviewFilter(event.target.value); resetPage({ review: event.target.value }); }}><option value="">Tất cả hồ sơ</option><option value="pending">Tất cả cần duyệt</option><option value="new">Tài khoản mới</option><option value="profile">Hồ sơ vừa cập nhật</option><option value="criteria">Khẩu vị/tiêu chí vừa cập nhật</option></select></label>
          <label className="d68-admin-field"><span>Trạng thái public</span><select className="d68-admin-input" value={visibilityFilter} onChange={(event) => { setVisibilityFilter(event.target.value); resetPage({ iv: event.target.value }); }}><option value="">Tất cả</option><option value="visible">Hiển thị</option><option value="hidden">Ẩn</option></select></label>
          <label className="d68-admin-field"><span>Loại hình Nhà đầu tư</span><select className="d68-admin-input" value={typeFilter} onChange={(event) => { setTypeFilter(event.target.value); resetPage({ it: event.target.value }); }}><option value="">Tất cả</option>{INVESTOR_TYPE_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.vi}</option>)}</select></label>
          <label className="d68-admin-field"><span>Quốc gia trụ sở</span><select className="d68-admin-input" value={officeCountryFilter} onChange={(event) => { setOfficeCountryFilter(event.target.value); resetPage({ io: event.target.value }); }}><option value="">Tất cả</option>{officeCountries.map((item) => <option key={item} value={item}>{countryLabel(item)}</option>)}</select></label>
          <label className="d68-admin-field"><span>Thị trường quan tâm</span><select className="d68-admin-input" value={targetCountryFilter} onChange={(event) => { setTargetCountryFilter(event.target.value); resetPage({ ic: event.target.value }); }}><option value="">Tất cả</option>{countryOptions.filter((item) => item.iso2 !== 'OTHER').map((item) => <option key={item.iso2} value={item.iso2}>{item.vi}</option>)}</select></label>
          <label className="d68-admin-field"><span>Ngành quan tâm</span><select className="d68-admin-input" value={industryFilter} onChange={(event) => { setIndustryFilter(event.target.value); resetPage({ ii: event.target.value }); }}><option value="">Tất cả</option>{industryOptions.map((item) => <option key={item.key} value={item.key}>{item.vi}</option>)}</select></label>
          <label className="d68-admin-field"><span>Gói dịch vụ</span><select className="d68-admin-input" value={serviceFilter} onChange={(event) => { setServiceFilter(event.target.value); resetPage({ service: event.target.value }); }}><option value="">Tất cả</option><option value="active">Đang hoạt động</option><option value="expiring">Sắp hết hạn</option><option value="expired">Hết hạn</option><option value="unpaid">Chưa xác nhận thanh toán</option></select></label>
        </div>
      </section>

      <section className="d68-admin-card">
        <div className="d68-admin-table-wrap">
          <table className="d68-admin-table d68-v14-investor-table">
            <thead><tr><th>Nhà đầu tư</th><th>Loại hình</th><th>Trụ sở & Ticket</th><th>Gói dịch vụ</th><th>Public</th><th>Hàng chờ</th><th>Cập nhật</th><th>Thao tác</th></tr></thead>
            <tbody>{paginated.map((row) => {
              const reasons = investorReviewReasonsV10(row);
              const service = serviceSummary(row, profiles, payments);
              const [serviceText, serviceClass] = serviceLabel(service.state);
              const typeLabels = optionLabels(investorTypes(row), INVESTOR_TYPE_OPTIONS, 'vi');
              const reviewLabels = [
                reasons.newAccount ? 'Tài khoản mới' : '',
                reasons.profileUpdated ? 'Hồ sơ sửa' : '',
                reasons.criteriaUpdated ? 'Tiêu chí sửa' : '',
              ].filter(Boolean);
              return <tr key={row.id} className={reasons.any ? 'd68-admin-row-pending' : ''}>
                <td><b>{investorDisplayNameV10(row)}</b><br/><code>{row.code || '—'}</code><br/><span>{row.private_email || '—'}</span></td>
                <td><div className="d68-admin-taglist">{typeLabels.length ? typeLabels.map((label) => <span key={label}>{label}</span>) : <em>Chưa chọn</em>}</div></td>
                <td>{countryLabel(row.country_iso2 || row.country)}<br/><b>{Number(row.ticket_min || 0).toLocaleString('en-US')}–{Number(row.ticket_max || 0).toLocaleString('en-US')} USD</b></td>
                <td><b>{service.plan}</b><br/><span className={`d68-admin-badge ${serviceClass}`}>{serviceText}</span><br/><small>{formatServiceExpiry(row.membership_expires_at)}</small></td>
                <td><span className={`d68-admin-badge ${row.visible ? 'ok' : 'err'}`}>{row.visible ? 'Hiển thị' : 'Ẩn'}</span></td>
                <td><div className="d68-admin-taglist">{reviewLabels.length ? reviewLabels.map((label) => <span key={label}>{label}</span>) : <em>Không có</em>}</div></td>
                <td>{dateTime(row.updated_at || row.created_at)}</td>
                <td><Link className="d68-admin-btn blue" to={`/admin/investors/${encodeURIComponent(row.code || row.id)}${location.search}`}>Xem chi tiết</Link></td>
              </tr>;
            })}</tbody>
          </table>
        </div>
        {!paginated.length ? <div className="d68-admin-empty">Không có Nhà đầu tư phù hợp bộ lọc.</div> : null}
        {pageCount > 1 ? <div className="d68-admin-pagination"><button className="d68-admin-btn light" disabled={safePage <= 1} onClick={() => { const next = safePage - 1; setPage(next); replaceQuery({ ip: next }); }}>‹ Trang trước</button><span>{safePage}/{pageCount}</span><button className="d68-admin-btn light" disabled={safePage >= pageCount} onClick={() => { const next = safePage + 1; setPage(next); replaceQuery({ ip: next }); }}>Trang tiếp ›</button></div> : null}
      </section>
    </AdminV10Shell>
  );
}
