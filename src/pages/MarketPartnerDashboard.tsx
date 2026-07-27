import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Copy, LayoutDashboard, Link2, LogOut, Settings, Users, WalletCards } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import {
  getMyMarketPartnerDashboard,
  updateMyMarketPartnerBankAccount,
  type MarketPartnerBankAccount,
  type MarketPartnerDashboardData,
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

  const { partner, metrics } = data;
  const currency = metrics.currency || 'VND';
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
            <small>BẬC HIỆN TẠI</small>
            <strong>Đối tác giới thiệu · {number(partner.commission_pct)}%</strong>
          </div>
        </aside>

        <section className="d68-mp-content">
          {tab === 'overview' ? (
            <>
              <div className="d68-mp-metrics">
                <Metric label="Lượt click" value={String(number(metrics.click_count))} note="qua link giới thiệu" />
                <Metric label="Đăng ký" value={String(number(metrics.signup_count))} note="tài khoản tạo mới" />
                <Metric label="Giao dịch trả phí" value={String(number(metrics.paid_transaction_count))} note={`tỷ lệ ${conversionRate}%`} positive />
                <Metric label="Hoa hồng đã ghi nhận" value={money(metrics.recorded_commission, currency)} note="tổng tích lũy" gold />
              </div>

              <div className="d68-mp-overview-grid">
                <article className="d68-mp-balance-card">
                  <h2>SỐ DƯ HOA HỒNG</h2>
                  <div><span>Đã ghi nhận</span><strong>{money(metrics.recorded_commission, currency)}</strong></div>
                  <div><span>Đang chờ xác nhận</span><strong className="gold">-{money(metrics.pending_commission, currency)}</strong></div>
                  <div><span>Đã chi trả</span><strong>{money(metrics.paid_commission, currency)}</strong></div>
                  <hr />
                  <div className="available"><span>Khả dụng để rút</span><strong>{money(metrics.available_commission, currency)}</strong></div>
                  <p>Chi trả theo lịch đối soát sau khi đạt ngưỡng tối thiểu do Deals68 công bố.</p>
                </article>

                <article className="d68-mp-progress-card">
                  <h2>TIẾN ĐỘ LÊN BẬC</h2>
                  <div className="d68-mp-progress-title"><strong>{number(partner.commission_pct)}%</strong><span>hoa hồng / giao dịch trả phí</span></div>
                  <div className="d68-mp-progress-track"><span style={{ width: `${Math.min(100, number(metrics.paid_transaction_count) * 20)}%` }} /></div>
                  <p>{number(metrics.paid_transaction_count) >= 5 ? 'Đã đủ điều kiện xem xét bậc tiếp theo.' : `Còn ${Math.max(0, 5 - number(metrics.paid_transaction_count))} giao dịch trả phí để được xem xét bậc tiếp theo.`}</p>
                  <div className="d68-mp-tier-row active"><b>Đối tác giới thiệu</b><span>&lt; 5 giao dịch</span><strong>{number(partner.commission_pct)}%</strong></div>
                  <div className="d68-mp-tier-row"><b>Đối tác thị trường</b><span>5–14 giao dịch</span><strong>18%</strong></div>
                  <div className="d68-mp-tier-row"><b>Đối tác thị trường cấp cao</b><span>15+ giao dịch</span><strong>22%</strong></div>
                </article>
              </div>

              <article className="d68-mp-referral-card">
                <div><h2>Link giới thiệu của bạn</h2><a href={referralLink} target="_blank" rel="noreferrer">{referralLink}</a><p>Khách được giảm {number(partner.customer_discount_pct)}% khi đăng ký qua link này.</p></div>
                <button onClick={copyLink}><Copy size={17} /> Copy link</button>
              </article>
            </>
          ) : null}

          {tab === 'leads' ? <ReadOnlyPanel title="Lead & chuyển đổi" text="Phase 3 đã kích hoạt click và signup attribution. Dashboard chỉ hiển thị số tổng hợp, không công khai danh tính khách hàng." /> : null}
          {tab === 'commissions' ? <ReadOnlyPanel title="Hoa hồng & thanh toán" text="Phase 2 không tự tính hoặc tạo hoa hồng. Số liệu chỉ đọc từ commission ledger do server/Admin ghi nhận." /> : null}
          {tab === 'campaigns' ? <ReadOnlyPanel title="Mã & chiến dịch" text={`Mã affiliate hiện tại: ${partner.affiliate_code}. Tracking ?ref=CODE đang hoạt động trên các trang public và đăng ký.`} /> : null}
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
  return <article className="d68-mp-readonly-panel"><h2>{title}</h2><p>{text}</p><span>READ-ONLY · PHASE 3</span></article>;
}

function BankAccountForm({ bank, setBank, saving, onSubmit }: { bank: MarketPartnerBankAccount; setBank: React.Dispatch<React.SetStateAction<MarketPartnerBankAccount>>; saving: boolean; onSubmit: (event: FormEvent) => Promise<void> }) {
  return (
    <form className="d68-mp-bank-card" onSubmit={onSubmit}>
      <div><h2>Tài khoản nhận hoa hồng</h2><p>Thông tin này chỉ Partner và Admin được xem. Phase 3 chưa phát sinh thanh toán tự động.</p></div>
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
