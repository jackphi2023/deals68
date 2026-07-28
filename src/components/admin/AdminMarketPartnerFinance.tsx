import { useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type {
  AffiliateCommissionRow,
  AffiliatePayoutRow,
  MarketPartnerRow,
} from '../../lib/marketPartners';

type Props = {
  partners: MarketPartnerRow[];
  commissions: AffiliateCommissionRow[];
  payouts: AffiliatePayoutRow[];
  busy: boolean;
  onCommissionStatus: (
    commission: AffiliateCommissionRow,
    status: 'approved' | 'rejected' | 'reversed',
    note?: string,
  ) => Promise<void>;
  onCreatePayout: (
    partnerId: string,
    currency: string,
    commissionIds: string[],
  ) => Promise<void>;
  onPayoutStatus: (
    payout: AffiliatePayoutRow,
    status: 'approved' | 'processing' | 'paid' | 'rejected' | 'cancelled',
    paymentReference?: string,
    note?: string,
  ) => Promise<void>;
};

type PayoutGroup = {
  partnerId: string;
  partnerName: string;
  currency: string;
  commissionIds: string[];
  amount: number;
};

type ActivationEmailState = {
  status: 'sending' | 'sent' | 'skipped' | 'error';
  message: string;
};

function amount(value: unknown) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function money(value: unknown, currency = 'VND') {
  return new Intl.NumberFormat(currency === 'VND' ? 'vi-VN' : 'en-US', {
    style: 'currency',
    currency: /^[A-Z]{3}$/.test(currency) ? currency : 'VND',
    maximumFractionDigits: currency === 'VND' ? 0 : 2,
  }).format(amount(value));
}

function statusClass(status: string) {
  if (['approved', 'paid'].includes(status)) return 'ok';
  if (['rejected', 'reversed', 'cancelled'].includes(status)) return 'err';
  return 'warn';
}

export default function AdminMarketPartnerFinance({
  partners,
  commissions,
  payouts,
  busy,
  onCommissionStatus,
  onCreatePayout,
  onPayoutStatus,
}: Props) {
  const [activationEmailState, setActivationEmailState] = useState<Record<string, ActivationEmailState>>({});
  const autoRequested = useRef(new Set<string>());
  const partnerNames = new Map(partners.map((partner) => [partner.id, partner.display_name]));
  const groups = Array.from(
    commissions
      .filter((row) => row.status === 'approved' && !row.payout_id)
      .reduce((map, row) => {
        const key = `${row.partner_id}:${row.currency}`;
        const current = map.get(key) || {
          partnerId: row.partner_id,
          partnerName: row.partner_name || partnerNames.get(row.partner_id) || row.affiliate_code,
          currency: row.currency,
          commissionIds: [],
          amount: 0,
        };
        current.commissionIds.push(row.id);
        current.amount += amount(row.commission_amount);
        map.set(key, current);
        return map;
      }, new Map<string, PayoutGroup>())
      .values(),
  );

  async function sendActivationEmail(partner: MarketPartnerRow, force: boolean) {
    setActivationEmailState((current) => ({
      ...current,
      [partner.id]: { status: 'sending', message: 'Đang gửi email kích hoạt...' },
    }));
    try {
      const { data, error } = await supabase.functions.invoke('market-partner-activation-email', {
        body: { partner_id: partner.id, force },
      });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.message || 'Không thể gửi email kích hoạt.');
      const skipped = data?.skipped === true;
      setActivationEmailState((current) => ({
        ...current,
        [partner.id]: {
          status: skipped ? 'skipped' : 'sent',
          message: skipped
            ? 'Email kích hoạt đã được gửi trước đó.'
            : `Đã gửi email kích hoạt tới ${partner.contact_email}.`,
        },
      }));
    } catch (error: any) {
      setActivationEmailState((current) => ({
        ...current,
        [partner.id]: {
          status: 'error',
          message: error?.message || 'Không thể gửi email kích hoạt.',
        },
      }));
    }
  }

  useEffect(() => {
    partners
      .filter((partner) => partner.status === 'active' && !partner.profile_id)
      .forEach((partner) => {
        if (autoRequested.current.has(partner.id)) return;
        autoRequested.current.add(partner.id);
        void sendActivationEmail(partner, false);
      });
  }, [partners]);

  async function rejectCommission(row: AffiliateCommissionRow) {
    const reason = window.prompt('Lý do từ chối commission:')?.trim();
    if (!reason) return;
    await onCommissionStatus(row, 'rejected', reason);
  }

  async function reverseCommission(row: AffiliateCommissionRow) {
    const reason = window.prompt('Lý do hoàn tác commission đã duyệt:')?.trim();
    if (!reason) return;
    await onCommissionStatus(row, 'reversed', reason);
  }

  async function cancelPayout(row: AffiliatePayoutRow) {
    const reason = window.prompt('Lý do hủy đợt chi trả:')?.trim();
    if (!reason) return;
    await onPayoutStatus(row, 'cancelled', undefined, reason);
  }

  async function rejectPayout(row: AffiliatePayoutRow) {
    const reason = window.prompt('Lý do từ chối đợt chi trả:')?.trim();
    if (!reason) return;
    await onPayoutStatus(row, 'rejected', undefined, reason);
  }

  async function markPaid(row: AffiliatePayoutRow) {
    const reference = window.prompt('Mã tham chiếu giao dịch ngân hàng:')?.trim();
    if (!reference) return;
    if (!window.confirm(`Xác nhận đã chi trả ${money(row.net_payout_amount, row.currency)}?`)) return;
    await onPayoutStatus(row, 'paid', reference);
  }

  return (
    <div className="d68-admin-market-partner-finance">
      <section className="d68-admin-card">
        <div className="d68-admin-row-head">
          <div>
            <h3>Email kích hoạt Đối tác thị trường</h3>
            <p className="d68-admin-subtle">
              Partner active chưa liên kết tài khoản sẽ được tự động gửi email kích hoạt một lần. Admin có thể gửi lại khi cần; email không chứa mật khẩu.
            </p>
          </div>
          <span className="d68-admin-badge blue">
            {partners.filter((partner) => partner.status === 'active' && !partner.profile_id).length} chờ kích hoạt
          </span>
        </div>
        {partners.length ? (
          <div className="d68-admin-table-wrap">
            <table className="d68-admin-table">
              <thead><tr><th>Partner</th><th>Email</th><th>Mã kích hoạt</th><th>Trạng thái</th><th>Action</th></tr></thead>
              <tbody>
                {partners.map((partner) => {
                  const emailState = activationEmailState[partner.id];
                  const activated = !!partner.profile_id;
                  return (
                    <tr key={`activation:${partner.id}`}>
                      <td><b>{partner.display_name}</b><br /><small>{partner.status}</small></td>
                      <td>{partner.contact_email}</td>
                      <td><code>{partner.affiliate_code}</code></td>
                      <td>
                        {activated ? <span className="d68-admin-badge ok">Đã kích hoạt</span> : <span className="d68-admin-badge warn">Chờ kích hoạt</span>}
                        {emailState ? <><br /><small>{emailState.message}</small></> : null}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="d68-admin-btn blue"
                          disabled={busy || activated || emailState?.status === 'sending' || partner.status !== 'active'}
                          onClick={() => sendActivationEmail(partner, true)}
                        >
                          {emailState?.status === 'sending' ? 'Đang gửi...' : 'Gửi email kích hoạt'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : <div className="d68-admin-empty">Chưa có Market Partner.</div>}
      </section>

      <section className="d68-admin-card">
        <div className="d68-admin-row-head">
          <div>
            <h3>Commission chờ duyệt và lịch sử</h3>
            <p className="d68-admin-subtle">
              Commission tự sinh sau payment confirmed, dùng snapshot X/Y của giao dịch. Admin duyệt hoặc từ chối trước khi lập payout.
            </p>
          </div>
          <span className="d68-admin-badge warn">
            {commissions.filter((row) => row.status === 'pending').length} chờ duyệt
          </span>
        </div>
        {commissions.length ? (
          <div className="d68-admin-table-wrap">
            <table className="d68-admin-table">
              <thead>
                <tr>
                  <th>Partner / giao dịch</th>
                  <th>Khách thực trả</th>
                  <th>Y / Hoa hồng</th>
                  <th>Trạng thái</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {commissions.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <b>{row.partner_name || partnerNames.get(row.partner_id) || row.affiliate_code}</b>
                      <br />
                      <code>{row.payment_order_code || '—'}</code>
                      <br />
                      <small>{new Date(row.created_at).toLocaleString('vi-VN')}</small>
                    </td>
                    <td>{money(row.net_paid_amount, row.currency)}</td>
                    <td>
                      {amount(row.commission_pct)}%<br />
                      <b>{money(row.commission_amount, row.currency)}</b>
                    </td>
                    <td>
                      <span className={`d68-admin-badge ${statusClass(row.status)}`}>{row.status}</span>
                      {row.payout_code ? <><br /><code>{row.payout_code}</code></> : null}
                    </td>
                    <td>
                      <div className="d68-admin-actions">
                        {row.status === 'pending' ? (
                          <>
                            <button className="d68-admin-btn green" disabled={busy} onClick={() => onCommissionStatus(row, 'approved')}>Duyệt</button>
                            <button className="d68-admin-btn red" disabled={busy} onClick={() => rejectCommission(row)}>Từ chối</button>
                          </>
                        ) : null}
                        {row.status === 'approved' && !row.payout_id ? (
                          <button className="d68-admin-btn light" disabled={busy} onClick={() => reverseCommission(row)}>Hoàn tác</button>
                        ) : null}
                        {!['pending', 'approved'].includes(row.status) ? <span>—</span> : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <div className="d68-admin-empty">Chưa có commission.</div>}
      </section>

      <section className="d68-admin-card">
        <div className="d68-admin-row-head">
          <div>
            <h3>Tạo đợt đối soát</h3>
            <p className="d68-admin-subtle">Mỗi payout chỉ gom commission đã duyệt, chưa thuộc payout, cùng Partner và cùng loại tiền.</p>
          </div>
          <span className="d68-admin-badge ok">{groups.length} nhóm sẵn sàng</span>
        </div>
        {groups.length ? (
          <div className="d68-admin-payout-groups">
            {groups.map((group) => (
              <article key={`${group.partnerId}:${group.currency}`} className="d68-admin-payout-group">
                <div>
                  <b>{group.partnerName}</b>
                  <p>{group.commissionIds.length} commission · {money(group.amount, group.currency)}</p>
                </div>
                <button
                  className="d68-admin-btn blue"
                  disabled={busy}
                  onClick={() => onCreatePayout(group.partnerId, group.currency, group.commissionIds)}
                >
                  Tạo payout draft
                </button>
              </article>
            ))}
          </div>
        ) : <div className="d68-admin-empty">Chưa có commission đã duyệt đủ điều kiện lập payout.</div>}
      </section>

      <section className="d68-admin-card">
        <div className="d68-admin-row-head">
          <div>
            <h3>Payout / thanh toán hoa hồng</h3>
            <p className="d68-admin-subtle">Chỉ thao tác “Đã trả” mới chuyển toàn bộ commission trong payout sang paid.</p>
          </div>
          <span className="d68-admin-badge blue">{payouts.length} payout</span>
        </div>
        {payouts.length ? (
          <div className="d68-admin-table-wrap">
            <table className="d68-admin-table">
              <thead><tr><th>Payout</th><th>Partner</th><th>Số tiền</th><th>Trạng thái</th><th>Action</th></tr></thead>
              <tbody>
                {payouts.map((row) => (
                  <tr key={row.id}>
                    <td><b>{row.payout_code}</b><br /><small>{new Date(row.created_at).toLocaleString('vi-VN')}</small></td>
                    <td>{row.partner_name || partnerNames.get(row.partner_id) || row.affiliate_code}<br /><small>{row.commission_count} commission</small></td>
                    <td>{money(row.net_payout_amount, row.currency)}{row.adjustment_amount ? <><br /><small>Điều chỉnh: {money(row.adjustment_amount, row.currency)}</small></> : null}</td>
                    <td><span className={`d68-admin-badge ${statusClass(row.status)}`}>{row.status}</span>{row.payment_reference ? <><br /><code>{row.payment_reference}</code></> : null}</td>
                    <td>
                      <div className="d68-admin-actions">
                        {row.status === 'draft' ? <>
                          <button className="d68-admin-btn green" disabled={busy} onClick={() => onPayoutStatus(row, 'approved')}>Duyệt payout</button>
                          <button className="d68-admin-btn red" disabled={busy} onClick={() => rejectPayout(row)}>Từ chối</button>
                        </> : null}
                        {row.status === 'approved' ? <>
                          <button className="d68-admin-btn blue" disabled={busy} onClick={() => onPayoutStatus(row, 'processing')}>Đang xử lý</button>
                          <button className="d68-admin-btn green" disabled={busy} onClick={() => markPaid(row)}>Đánh dấu đã trả</button>
                          <button className="d68-admin-btn light" disabled={busy} onClick={() => cancelPayout(row)}>Hủy</button>
                        </> : null}
                        {row.status === 'processing' ? <>
                          <button className="d68-admin-btn green" disabled={busy} onClick={() => markPaid(row)}>Đánh dấu đã trả</button>
                          <button className="d68-admin-btn light" disabled={busy} onClick={() => cancelPayout(row)}>Hủy</button>
                        </> : null}
                        {['paid', 'rejected', 'cancelled'].includes(row.status) ? <span>—</span> : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <div className="d68-admin-empty">Chưa có payout.</div>}
      </section>
    </div>
  );
}
