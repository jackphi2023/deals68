import { useMemo, useState } from 'react';
import { Copy, LayoutDashboard, Link2, LogOut, Settings, Users, WalletCards } from 'lucide-react';
import { Navigate, useNavigate } from 'react-router-dom';
import {
  MARKET_PARTNER_DEMO_DATA,
  clearMarketPartnerDemoSession,
  hasMarketPartnerDemoSession,
  type DemoPartnerTransaction,
} from '../lib/marketPartnerDemo';
import '../styles/pages/market-partner.css';

type PartnerTab = 'overview' | 'leads' | 'commissions' | 'campaigns' | 'settings';

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

export default function MarketPartnerDemoDashboard() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<PartnerTab>('overview');
  const data = MARKET_PARTNER_DEMO_DATA;

  const referralLink = useMemo(() => {
    const origin = typeof window === 'undefined' ? 'https://deals68.com' : window.location.origin;
    return `${origin}/?ref=${encodeURIComponent(data.partner.affiliate_code)}`;
  }, [data.partner.affiliate_code]);

  if (!hasMarketPartnerDemoSession()) {
    return <Navigate to="/market-partner/login?demo=1" replace />;
  }

  const { partner, metrics, commissions, payouts, transactions, summary } = data;
  const currency = metrics.currency || 'VND';
  const conversionRate = metrics.signup_count > 0
    ? Math.round((metrics.paid_transaction_count / metrics.signup_count) * 100)
    : 0;

  const navItems: Array<{ id: PartnerTab; label: string; icon: typeof LayoutDashboard }> = [
    { id: 'overview', label: 'Tổng quan', icon: LayoutDashboard },
    { id: 'leads', label: 'Giao dịch', icon: Users },
    { id: 'commissions', label: 'Thu nhập', icon: WalletCards },
    { id: 'campaigns', label: 'Mã & chiến dịch', icon: Link2 },
    { id: 'settings', label: 'Cài đặt', icon: Settings },
  ];

  function signOut() {
    clearMarketPartnerDemoSession();
    navigate('/market-partner/login?demo=1', { replace: true });
  }

  function copyLink() {
    void navigator.clipboard?.writeText(referralLink).catch(() => undefined);
  }

  return (
    <main className="d68-mp-dashboard-page">
      <header className="d68-mp-dashboard-head">
        <div>
          <span className="d68-mp-eyebrow">Trang quản trị demo của Đối tác thị trường</span>
          <div className="d68-mp-title-row">
            <h1>{partner.display_name}</h1>
            <span>· {partner.affiliate_code}</span>
            <span className="d68-mp-country-badge">🌐 {partner.country}</span>
          </div>
        </div>
        <button className="d68-mp-signout" onClick={signOut}><LogOut size={17} /> Đăng xuất</button>
      </header>

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
            <strong>Hoa hồng 40%–60% theo doanh thu</strong>
          </div>
        </aside>

        <section className="d68-mp-content">
          {tab === 'overview' ? (
            <>
              <div className="d68-mp-metrics">
                <Metric label="Lượt click" value={String(metrics.click_count)} note="qua link giới thiệu" />
                <Metric label="Đăng ký" value={String(metrics.signup_count)} note="tài khoản tạo mới" />
                <Metric label="Giao dịch trả phí" value={String(metrics.paid_transaction_count)} note={`tỷ lệ ${conversionRate}%`} positive />
                <Metric label="Hoa hồng đã ghi nhận" value={money(metrics.recorded_commission, currency)} note="đã đối soát và chi trả" gold />
              </div>

              <div className="d68-mp-overview-grid">
                <article className="d68-mp-balance-card">
                  <h2>SỐ DƯ HOA HỒNG</h2>
                  <div><span>Đã ghi nhận</span><strong>{money(metrics.recorded_commission, currency)}</strong></div>
                  <div><span>Đang chờ xác nhận</span><strong className="gold">{money(metrics.pending_commission, currency)}</strong></div>
                  <div><span>Đã duyệt</span><strong>{money(metrics.approved_commission, currency)}</strong></div>
                  <div><span>Đã chi trả</span><strong>{money(metrics.paid_commission, currency)}</strong></div>
                  <hr />
                  <div className="available"><span>Chờ thanh toán</span><strong>{money(metrics.available_commission, currency)}</strong></div>
                  <p>Thu nhập/Hoa hồng chỉ được chi trả sau khi Admin deals68 duyệt và hoàn tất đối soát.</p>
                </article>

                <article className="d68-mp-progress-card">
                  <h2>CƠ CẤU HOA HỒNG THEO DOANH THU</h2>
                  <div className="d68-mp-progress-title"><strong>40%–60%</strong><span>trên số tiền khách thực thanh toán</span></div>
                  <p>Đơn vị: VNĐ. Thu nhập/Hoa hồng theo Chính sách Đối tác thị trường của Deals68.com.</p>
                  <div className="d68-mp-tier-row active"><b>Dưới mốc 1</b><span>&lt; {compactAmount(20_000_000)}</span><strong>40%</strong></div>
                  <div className="d68-mp-tier-row"><b>Từ mốc 1 đến mốc 2</b><span>{compactAmount(20_000_000)} – {compactAmount(50_000_000)}</span><strong>50%</strong></div>
                  <div className="d68-mp-tier-row"><b>Trên mốc 2</b><span>&gt; {compactAmount(50_000_000)}</span><strong>60%</strong></div>
                </article>
              </div>

              <article className="d68-mp-referral-card">
                <div><h2>Link giới thiệu của bạn</h2><a href={referralLink} target="_blank" rel="noreferrer">{referralLink}</a><p>Khách được giảm 40% trên phí đủ điều kiện. Không cộng dồn mã khuyến mãi khác.</p></div>
                <button onClick={copyLink}><Copy size={17} /> Copy link</button>
              </article>
            </>
          ) : null}

          {tab === 'leads' ? (
            <div className="d68-mp-finance-history">
              <div className="d68-mp-metrics">
                <Metric label="Doanh thu đã xác nhận" value={money(summary.confirmedRevenue, currency)} note="4 giao dịch thành công" positive />
                <Metric label="Chờ xác nhận" value={money(summary.pendingRevenue, currency)} note="1 giao dịch chuyển khoản" gold />
                <Metric label="Hoa hồng dự kiến" value={money(summary.projectedPendingCommission, currency)} note="chưa ghi nhận đến khi payment confirmed" />
              </div>
              <TransactionHistory rows={transactions} />
            </div>
          ) : null}

          {tab === 'commissions' ? <PartnerFinanceHistory commissions={commissions} payouts={payouts} /> : null}

          {tab === 'campaigns' ? (
            <div className="d68-mp-finance-history">
              <article className="d68-mp-referral-card">
                <div><h2>Link giới thiệu của bạn</h2><a href={referralLink} target="_blank" rel="noreferrer">{referralLink}</a><p>Mã affiliate: {partner.affiliate_code}. Giảm giá X = 40%; promo code khác không được cộng dồn.</p></div>
                <button onClick={copyLink}><Copy size={17} /> Copy link</button>
              </article>
              <article className="d68-mp-history-card">
                <div><h2>Hiệu quả chiến dịch</h2><p>Tổng hợp theo mã affiliate hiện tại.</p></div>
                <div className="d68-mp-table-wrap">
                  <table className="d68-mp-table">
                    <thead><tr><th>Mã affiliate</th><th>Lượt click</th><th>Đăng ký</th><th>Đã thanh toán</th><th>Tỷ lệ chuyển đổi</th></tr></thead>
                    <tbody><tr><td><b>{partner.affiliate_code}</b></td><td>{metrics.click_count}</td><td>{metrics.signup_count}</td><td>{metrics.paid_transaction_count}</td><td><b>{conversionRate}%</b></td></tr></tbody>
                  </table>
                </div>
              </article>
            </div>
          ) : null}

          {tab === 'settings' ? <ReadOnlyBankAccount /> : null}
        </section>
      </div>
    </main>
  );
}

function Metric({ label, value, note, positive, gold }: { label: string; value: string; note: string; positive?: boolean; gold?: boolean }) {
  return <article className="d68-mp-metric"><span>{label}</span><strong className={positive ? 'positive' : gold ? 'gold' : ''}>{value}</strong><small>{note}</small></article>;
}

function TransactionHistory({ rows }: { rows: DemoPartnerTransaction[] }) {
  return (
    <article className="d68-mp-history-card">
      <div><h2>Giao dịch giới thiệu</h2><p>Giá và hoa hồng được tính theo đúng thứ tự: giảm kỳ hạn → giảm Partner X → hoa hồng Y trên số tiền thực trả.</p></div>
      <div className="d68-mp-table-wrap">
        <table className="d68-mp-table">
          <thead><tr><th>Doanh nghiệp</th><th>Gói</th><th>Phí gốc</th><th>Giảm kỳ hạn</th><th>Giảm Partner</th><th>Khách thực trả</th><th>Hoa hồng</th><th>Thanh toán</th></tr></thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.businessCode}>
                <td><b>{row.businessCode}</b><br /><small>{new Date(row.createdAt).toLocaleDateString('vi-VN')}</small></td>
                <td>{row.termWeeks} tuần</td>
                <td>{money(row.subtotal)}</td>
                <td>{row.termDiscountPct}%<br /><small>−{money(row.termDiscount)}</small></td>
                <td>{row.affiliateDiscountPct}%<br /><small>−{money(row.affiliateDiscount)}</small></td>
                <td><b>{money(row.netPaidAmount)}</b></td>
                <td>{row.commissionRecorded ? <><b>{money(row.commissionAmount)}</b><br /><small>Y = {row.commissionPct}%</small></> : <><span>Chưa ghi nhận</span><br /><small>Dự kiến {money(row.commissionAmount)}</small></>}</td>
                <td>{row.paymentStatus === 'confirmed' ? <><span className="d68-mp-status d68-mp-status--paid">Đã xác nhận</span><br /><small>Chuyển khoản thành công</small></> : <><span className="d68-mp-status">Chờ xác nhận</span><br /><small>Chưa duyệt thanh toán</small></>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </article>
  );
}

function PartnerFinanceHistory({ commissions, payouts }: { commissions: typeof MARKET_PARTNER_DEMO_DATA.commissions; payouts: typeof MARKET_PARTNER_DEMO_DATA.payouts }) {
  return (
    <div className="d68-mp-finance-history">
      <article className="d68-mp-history-card">
        <div><h2>Commission</h2><p>Không hiển thị danh tính khách hàng hoặc payment payload.</p></div>
        <div className="d68-mp-table-wrap">
          <table className="d68-mp-table">
            <thead><tr><th>Ngày</th><th>Doanh nghiệp</th><th>Gói</th><th>Khách thực trả</th><th>Y</th><th>Hoa hồng</th><th>Trạng thái</th></tr></thead>
            <tbody>{commissions.map((row) => <tr key={row.id}><td>{new Date(row.created_at).toLocaleDateString('vi-VN')}</td><td><b>{row.business_code}</b></td><td>{row.term_weeks} tuần</td><td>{money(row.net_paid_amount, row.currency)}</td><td>{number(row.commission_pct)}%</td><td><b>{money(row.commission_amount, row.currency)}</b></td><td><span className={`d68-mp-status d68-mp-status--${row.status}`}>{statusLabel(row.status)}</span>{row.payout_code ? <><br /><code>{row.payout_code}</code></> : null}</td></tr>)}</tbody>
          </table>
        </div>
      </article>

      <article className="d68-mp-history-card">
        <div><h2>Lịch sử payout</h2><p>Admin quản lý duyệt, xử lý và đánh dấu đã chi trả.</p></div>
        <div className="d68-mp-table-wrap">
          <table className="d68-mp-table">
            <thead><tr><th>Mã payout</th><th>Số commission</th><th>Số tiền</th><th>Trạng thái</th><th>Tham chiếu</th></tr></thead>
            <tbody>{payouts.map((row) => <tr key={row.id}><td><b>{row.payout_code}</b><br /><small>{new Date(row.created_at).toLocaleDateString('vi-VN')}</small></td><td>{row.commission_count}</td><td>{money(row.net_payout_amount, row.currency)}</td><td><span className={`d68-mp-status d68-mp-status--${row.status}`}>{statusLabel(row.status)}</span></td><td>{row.payment_reference || '—'}</td></tr>)}</tbody>
          </table>
        </div>
      </article>
    </div>
  );
}

function ReadOnlyBankAccount() {
  const bank = MARKET_PARTNER_DEMO_DATA.partner.bank_account_json || {};
  return (
    <article className="d68-mp-bank-card">
      <div><h2>Tài khoản nhận hoa hồng</h2><p>Thông tin này chỉ Partner và Admin được xem. Cần hoàn tất trước khi payout được đánh dấu đã trả.</p></div>
      <div className="d68-mp-bank-grid">
        <label>Tên ngân hàng<input readOnly value={String(bank.bank_name || '')} /></label>
        <label>Chủ tài khoản<input readOnly value={String(bank.account_holder || '')} /></label>
        <label>Số tài khoản<input readOnly value={String(bank.account_number || '')} /></label>
        <label>Chi nhánh<input readOnly value={String(bank.branch || '')} /></label>
        <label>SWIFT/BIC<input readOnly value={String(bank.swift_code || '')} /></label>
        <label>Loại tiền<input readOnly value={String(bank.currency || '')} /></label>
        <label>Quốc gia<input readOnly value={String(bank.country || '')} /></label>
        <label className="wide">Ghi chú<textarea readOnly value={String(bank.note || '')} /></label>
      </div>
    </article>
  );
}
