import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Copy, LayoutDashboard, Link2, LogOut, Settings, Users, WalletCards } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import {
  DEFAULT_MARKET_PARTNER_COMMERCIAL_POLICY,
  getMyMarketPartnerDashboard,
  updateMyMarketPartnerBankAccount,
  type AffiliateCommissionRow,
  type AffiliatePayoutRow,
  type MarketPartnerBankAccount,
  type MarketPartnerDashboardData,
  type MarketPartnerRow,
} from '../lib/marketPartners';
import '../styles/pages/market-partner.css';

type PartnerTab = 'overview' | 'leads' | 'commissions' | 'campaigns' | 'settings';

const EMPTY_BANK: MarketPartnerBankAccount = {
  bank_name: '',
  account_holder: '',
  account_number: '',
  branch: '',
  swift_code: '',
  currency: 'VND',
  country: 'Vietnam',
  note: '',
};

function number(value: unknown) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function money(value: unknown, currency = 'VND') {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: /^[A-Z]{3}$/.test(currency) ? currency : 'VND',
    maximumFractionDigits: currency === 'VND' ? 0 : 2,
  }).format(number(value));
}

function compactAmount(value: unknown, currency = 'VND') {
  const amount = number(value);
  if (currency === 'VND') return `${amount.toLocaleString('vi-VN')} ₫`;
  return `${amount.toLocaleString('en-US')} ${currency}`;
}

function commercialPolicy(partner: MarketPartnerRow) {
  return {
    basisCurrency: String(
      partner.commission_basis_currency ||
        DEFAULT_MARKET_PARTNER_COMMERCIAL_POLICY.commissionBasisCurrency,
    ),
    tier1Max: number(
      partner.commission_tier_1_max ??
        DEFAULT_MARKET_PARTNER_COMMERCIAL_POLICY.commissionTier1Max,
    ),
    tier2Max: number(
      partner.commission_tier_2_max ??
        DEFAULT_MARKET_PARTNER_COMMERCIAL_POLICY.commissionTier2Max,
    ),
    tier1Pct: number(
      partner.commission_tier_1_pct ??
        partner.commission_pct ??
        DEFAULT_MARKET_PARTNER_COMMERCIAL_POLICY.commissionPct,
    ),
    tier2Pct: number(
      partner.commission_tier_2_pct ??
        DEFAULT_MARKET_PARTNER_COMMERCIAL_POLICY.commissionTier2Pct,
    ),
    tier3Pct: number(
      partner.commission_tier_3_pct ??
        DEFAULT_MARKET_PARTNER_COMMERCIAL_POLICY.commissionTier3Pct,
    ),
  };
}

function bankFrom(value: Record<string, unknown> | undefined): MarketPartnerBankAccount {
  return {
    bank_name: String(value?.bank_name || ''),
    account_holder: String(value?.account_holder || ''),
    account_number: String(value?.account_number || ''),
    branch: String(value?.branch || ''),
    swift_code: String(value?.swift_code || ''),
    currency: String(value?.currency || 'VND'),
    country: String(value?.country || 'Vietnam'),
    note: String(value?.note || ''),
  };
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    pending: 'Chờ duyệt',
    approved: 'Đã duyệt',
    processing: 'Đang xử lý',
    paid: 'Đã chi trả',
    rejected: 'Từ chối',
    reversed: 'Hoàn tác',
    cancelled: 'Đã hủy',
    draft: 'Nháp',
  };
  return labels[status] || status;
}

export default function MarketPartnerDashboard() {
  const { signOut } = useAuth();
  const [data, setData] = useState<MarketPartnerDashboardData | null>(null);
  const [tab, setTab] = useState<PartnerTab>('overview');
  const [bank, setBank] = useState<MarketPartnerBankAccount>(EMPTY_BANK);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const next = await getMyMarketPartnerDashboard();
      setData(next);
      setBank(bankFrom(next.partner.bank_account_json));
    } catch (loadError: any) {
      setError(loadError?.message || 'Không thể tải Dashboard Market Partner.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const referralLink = useMemo(() => {
    if (!data?.partner.affiliate_code) return '';
    const origin = typeof window === 'undefined' ? 'https://deals68.com' : window.location.origin;
    return `${origin}/?ref=${encodeURIComponent(data.partner.affiliate_code)}`;
  }, [data?.partner.affiliate_code]);

  async function copyLink() {
    if (!referralLink) return;
    await navigator.clipboard.writeText(referralLink);
    setMessage('Đã sao chép link giới thiệu.');
    window.setTimeout(() => setMessage(''), 2400);
  }

  async function saveBank(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await updateMyMarketPartnerBankAccount(bank);
      setMessage('Đã lưu thông tin tài khoản ngân hàng.');
      await load();
    } catch (saveError: any) {
      setError(saveError?.message || 'Không thể lưu tài khoản ngân hàng.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <main className="d68-mp-dashboard-page"><div className="d68-mp-state-card">Đang tải Dashboard...</div></main>;
  if (!data) return <main className="d68-mp-dashboard-page"><div className="d68-mp-state-card d68-mp-state-card--error"><h1>Chưa thể mở Dashboard</h1><p>{error}</p><button className="d68-mp-primary-btn" onClick={load}>Thử lại</button></div></main>;

  const { partner, metrics, commissions, payouts } = data;
  const currency = metrics.currency || 'VND';
  const policy = commercialPolicy(partner);
  const conversionRate = metrics.signup_count > 0
    ? Math.round((metrics.paid_transaction_count / metrics.signup_count) * 100)
    : 0;

  const navItems: Array<{ id: PartnerTab; label: string; icon: typeof LayoutDashboard }> = [
    { id: 'overview', label: 'Tổng quan', icon: LayoutDashboard },
    { id: 'leads', label: 'Lead & chuyển đổi', icon: Users },
    { id: 'commissions', label: 'Hoa hồng & thanh toán', icon: WalletCards },
    { id: 'campaigns', label: 'Mã & chiến dịch', icon: Link2 },
    { id: 'settings', label: 'Cài đặt', icon: Settings },
  ];

  return (
    <main className="d68-mp-dashboard-page">
      <header className="d68-mp-dashboard-head">
        <div>
          <span className="d68-mp-eyebrow">ĐỐI TÁC THỊ TRƯỜNG</span>
          <div className="d68-mp-title-row">
            <h1>{partner.display_name}</h1>
            <span>· {partner.affiliate_code}</span>
            <span className="d68-mp-country-badge">🌐 {partner.country || partner.country_iso2 || 'Đang cập nhật'}</span>
          </div>
        </div>
        <button className="d68-mp-signout" onClick={() => signOut()}><LogOut size={17} /> Đăng xuất</button>
      </header>

      {partner.status === 'suspended' ? (
        <div className="d68-mp-alert d68-mp-alert--error">
          Tài khoản đang tạm ngưng{partner.suspension_reason ? `: ${partner.suspension_reason}` : '.'}
        </div>
      ) : null}
      {message ? <div className="d68-mp-alert d68-mp-alert--success">{message}</div> : null}
      {error ? <div className="d68-mp-alert d68-mp-alert--error">{error}</div> : null}

      <div className="d68-mp-dashboard-layout">
        <aside className="d68-mp-sidebar">
          <nav>
            {navItems.map(({ id, label, icon: Icon }) => (
              <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>
                <Icon size={18} /> <span>{label}</span>
              </button>
            ))}
          </nav>
          <div className="d68-mp-tier-card">
            <small>CHÍNH SÁCH HIỆN TẠI</small>
            <strong>Hoa hồng {policy.tier1Pct}%–{policy.tier3Pct}% theo doanh thu</strong>
          </div>
        </aside>

        <section className="d68-mp-content">
          {tab === 'overview' ? (
            <>
              <div className="d68-mp-metrics">
                <Metric label="Lượt click" value={String(number(metrics.click_count))} note="qua link giới thiệu" />
                <Metric label="Đăng ký" value={String(number(metrics.signup_count))} note="tài khoản tạo mới" />
                <Metric label="Giao dịch trả phí" value={String(number(metrics.paid_transaction_count))} note={`tỷ lệ ${conversionRate}%`} positive />
                <Metric label="Hoa hồng đã ghi nhận" value={money(metrics.recorded_commission, currency)} note="pending + approved + paid" gold />
              </div>

              <div className="d68-mp-overview-grid">
                <article className="d68-mp-balance-card">
                  <h2>SỐ DƯ HOA HỒNG</h2>
                  <div><span>Đã ghi nhận</span><strong>{money(metrics.recorded_commission, currency)}</strong></div>
                  <div><span>Đang chờ xác nhận</span><strong className="gold">{money(metrics.pending_commission, currency)}</strong></div>
                  <div><span>Đã duyệt</span><strong>{money(metrics.approved_commission, currency)}</strong></div>
                  <div><span>Đã chi trả</span><strong>{money(metrics.paid_commission, currency)}</strong></div>
                  <hr />
                  <div className="available"><span>Khả dụng để lập payout</span><strong>{money(metrics.available_commission, currency)}</strong></div>
                  <p>Commission chỉ được chi trả sau khi Admin duyệt và hoàn tất đối soát.</p>
                </article>

                <article className="d68-mp-progress-card">
                  <h2>CƠ CẤU HOA HỒNG THEO DOANH THU</h2>
                  <div className="d68-mp-progress-title"><strong>{policy.tier1Pct}%–{policy.tier3Pct}%</strong><span>trên số tiền khách thực thanh toán</span></div>
                  <p>Đồng tiền cơ sở: {policy.basisCurrency}. Commission lịch sử dùng snapshot X/Y tại thời điểm payment.</p>
                  <div className="d68-mp-tier-row active"><b>Dưới mốc 1</b><span>&lt; {compactAmount(policy.tier1Max, policy.basisCurrency)}</span><strong>{policy.tier1Pct}%</strong></div>
                  <div className="d68-mp-tier-row"><b>Từ mốc 1 đến mốc 2</b><span>{compactAmount(policy.tier1Max, policy.basisCurrency)} – {compactAmount(policy.tier2Max, policy.basisCurrency)}</span><strong>{policy.tier2Pct}%</strong></div>
                  <div className="d68-mp-tier-row"><b>Trên mốc 2</b><span>&gt; {compactAmount(policy.tier2Max, policy.basisCurrency)}</span><strong>{policy.tier3Pct}%</strong></div>
                </article>
              </div>

              <article className="d68-mp-referral-card">
                <div><h2>Link giới thiệu của bạn</h2><a href={referralLink} target="_blank" rel="noreferrer">{referralLink}</a><p>Khách được giảm {number(partner.customer_discount_pct)}% trên phí đủ điều kiện. Không cộng dồn mã khuyến mãi khác.</p></div>
                <button onClick={copyLink}><Copy size={17} /> Copy link</button>
              </article>
            </>
          ) : null}

          {tab === 'leads' ? <ReadOnlyPanel title="Lead & chuyển đổi" text="Dashboard chỉ hiển thị số tổng hợp, không công khai danh tính Business/Investor được giới thiệu." /> : null}
          {tab === 'commissions' ? <PartnerFinanceHistory commissions={commissions} payouts={payouts} /> : null}
          {tab === 'campaigns' ? <ReadOnlyPanel title="Mã & chiến dịch" text={`Mã affiliate hiện tại: ${partner.affiliate_code}. Giảm giá X = ${number(partner.customer_discount_pct)}%; promo code khác không được cộng dồn.`} /> : null}
          {tab === 'settings' ? <BankAccountForm bank={bank} setBank={setBank} saving={saving} onSubmit={saveBank} /> : null}
        </section>
      </div>
    </main>
  );
}

function Metric({ label, value, note, positive, gold }: { label: string; value: string; note: string; positive?: boolean; gold?: boolean }) {
  return <article className="d68-mp-metric"><span>{label}</span><strong className={positive ? 'positive' : gold ? 'gold' : ''}>{value}</strong><small>{note}</small></article>;
}

function ReadOnlyPanel({ title, text }: { title: string; text: string }) {
  return <article className="d68-mp-readonly-panel"><h2>{title}</h2><p>{text}</p><span>READ-ONLY · MARKET PARTNER</span></article>;
}

function PartnerFinanceHistory({ commissions, payouts }: { commissions: AffiliateCommissionRow[]; payouts: AffiliatePayoutRow[] }) {
  return (
    <div className="d68-mp-finance-history">
      <article className="d68-mp-history-card">
        <div><h2>Commission</h2><p>Không hiển thị danh tính khách hàng hoặc payment payload.</p></div>
        {commissions.length ? (
          <div className="d68-mp-table-wrap">
            <table className="d68-mp-table">
              <thead><tr><th>Ngày</th><th>Khách thực trả</th><th>Y</th><th>Hoa hồng</th><th>Trạng thái</th></tr></thead>
              <tbody>{commissions.map((row) => <tr key={row.id}><td>{new Date(row.created_at).toLocaleDateString('vi-VN')}</td><td>{money(row.net_paid_amount, row.currency)}</td><td>{number(row.commission_pct)}%</td><td><b>{money(row.commission_amount, row.currency)}</b></td><td><span className={`d68-mp-status d68-mp-status--${row.status}`}>{statusLabel(row.status)}</span>{row.payout_code ? <><br /><code>{row.payout_code}</code></> : null}</td></tr>)}</tbody>
            </table>
          </div>
        ) : <p className="d68-mp-empty">Chưa có commission được ghi nhận.</p>}
      </article>

      <article className="d68-mp-history-card">
        <div><h2>Lịch sử payout</h2><p>Admin quản lý duyệt, xử lý và đánh dấu đã chi trả.</p></div>
        {payouts.length ? (
          <div className="d68-mp-table-wrap">
            <table className="d68-mp-table">
              <thead><tr><th>Mã payout</th><th>Số commission</th><th>Số tiền</th><th>Trạng thái</th><th>Tham chiếu</th></tr></thead>
              <tbody>{payouts.map((row) => <tr key={row.id}><td><b>{row.payout_code}</b><br /><small>{new Date(row.created_at).toLocaleDateString('vi-VN')}</small></td><td>{row.commission_count}</td><td>{money(row.net_payout_amount, row.currency)}</td><td><span className={`d68-mp-status d68-mp-status--${row.status}`}>{statusLabel(row.status)}</span></td><td>{row.payment_reference || '—'}</td></tr>)}</tbody>
            </table>
          </div>
        ) : <p className="d68-mp-empty">Chưa có payout.</p>}
      </article>
    </div>
  );
}

function BankAccountForm({ bank, setBank, saving, onSubmit }: { bank: MarketPartnerBankAccount; setBank: React.Dispatch<React.SetStateAction<MarketPartnerBankAccount>>; saving: boolean; onSubmit: (event: FormEvent) => Promise<void> }) {
  return (
    <form className="d68-mp-bank-card" onSubmit={onSubmit}>
      <div><h2>Tài khoản nhận hoa hồng</h2><p>Thông tin này chỉ Partner và Admin được xem. Cần hoàn tất trước khi payout được đánh dấu đã trả.</p></div>
      <div className="d68-mp-bank-grid">
        <label>Tên ngân hàng<input required value={bank.bank_name} onChange={(e) => setBank((v) => ({ ...v, bank_name: e.target.value }))} /></label>
        <label>Chủ tài khoản<input required value={bank.account_holder} onChange={(e) => setBank((v) => ({ ...v, account_holder: e.target.value }))} /></label>
        <label>Số tài khoản<input required value={bank.account_number} onChange={(e) => setBank((v) => ({ ...v, account_number: e.target.value }))} /></label>
        <label>Chi nhánh<input value={bank.branch || ''} onChange={(e) => setBank((v) => ({ ...v, branch: e.target.value }))} /></label>
        <label>SWIFT/BIC<input maxLength={11} value={bank.swift_code || ''} onChange={(e) => setBank((v) => ({ ...v, swift_code: e.target.value.toUpperCase() }))} /></label>
        <label>Loại tiền<input maxLength={3} value={bank.currency || ''} onChange={(e) => setBank((v) => ({ ...v, currency: e.target.value.toUpperCase() }))} /></label>
        <label>Quốc gia<input value={bank.country || ''} onChange={(e) => setBank((v) => ({ ...v, country: e.target.value }))} /></label>
        <label className="wide">Ghi chú<textarea value={bank.note || ''} onChange={(e) => setBank((v) => ({ ...v, note: e.target.value }))} /></label>
      </div>
      <button className="d68-mp-primary-btn" disabled={saving}>{saving ? 'Đang lưu...' : 'Lưu tài khoản ngân hàng'}</button>
    </form>
  );
}
