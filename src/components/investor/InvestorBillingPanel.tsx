import { useEffect, useMemo, useState } from 'react';
import type { Lang } from '../../lib/i18n';
import { T } from '../../lib/labels';
import { calculatePricing, lookupPromo } from '../../lib/pricing';
import { supabase } from '../../lib/supabase';

const STATIC_VIETQR_URL = '/assets/vietqr-vcb.png';

function money(value: unknown, currency: unknown) {
  const amount = Number(value || 0);
  const code = String(currency || 'VND').toUpperCase();
  return code === 'USD'
    ? `$${Math.round(amount).toLocaleString('en-US')}`
    : `${Math.round(amount).toLocaleString('vi-VN')} ₫`;
}

function statusLabel(lang: Lang, status: unknown) {
  const value = String(status || 'pending').toLowerCase();
  if (['confirmed', 'paid', 'active'].includes(value)) {
    return T(lang, 'Đã xác nhận', 'Confirmed');
  }
  if (['rejected', 'cancelled'].includes(value)) {
    return T(lang, 'Không duyệt', 'Rejected');
  }
  return T(lang, 'Chờ xác nhận', 'Pending');
}

function payloadOf(row: any) {
  return row?.payload && typeof row.payload === 'object'
    ? row.payload
    : {};
}

type Props = {
  lang: Lang;
  investor: any;
  profile: any;
  payments: any[];
  onReload: () => void | Promise<void>;
  setMessage: (value: string) => void;
  setError: (value: string) => void;
};

export default function InvestorBillingPanel({
  lang,
  investor,
  profile,
  payments,
  onReload,
  setMessage,
  setError,
}: Props) {
  const [open, setOpen] = useState(false);
  const [months, setMonths] = useState(12);
  const [promoCode, setPromoCode] = useState('');
  const [promoPct, setPromoPct] = useState(0);
  const [promoMessage, setPromoMessage] = useState('');
  const [promoBusy, setPromoBusy] = useState(false);
  const [paymentAck, setPaymentAck] = useState(false);
  const [orderBusy, setOrderBusy] = useState(false);
  const [qrSrc, setQrSrc] = useState('');

  const country = String(investor?.country_iso2 || 'VN').toUpperCase();
  const price = useMemo(
    () =>
      calculatePricing(
        {
          role: 'investor',
          country,
          termWeeks: months * 4,
          promoCode,
        },
        promoPct,
      ),
    [country, months, promoCode, promoPct],
  );

  const orderCode = `DEALS68-INV-${String(
    investor?.code || investor?.id || 'INVESTOR',
  )
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(0, 20)}`.toUpperCase();

  const amountParam =
    price.currency === 'VND'
      ? `amount=${Math.round(price.total)}&`
      : '';
  const qrUrl =
    `https://img.vietqr.io/image/VCB-0011004000713-compact2.png?` +
    `${amountParam}addInfo=${encodeURIComponent(orderCode)}` +
    `&accountName=${encodeURIComponent('Tieu Vo Dinh Phi')}`;

  useEffect(() => {
    setQrSrc(qrUrl);
  }, [qrUrl]);

  async function applyPromo() {
    setPromoBusy(true);
    setPromoMessage('');
    const result = await lookupPromo(promoCode, 'investor').catch(() => ({
      discountPct: 0,
    }));
    setPromoBusy(false);
    const pct = Number(result.discountPct || 0);
    setPromoPct(pct);
    setPromoMessage(
      pct
        ? T(
            lang,
            'Mã hợp lệ, đã cập nhật số tiền giảm giá',
            'Valid code. The discounted amount has been updated.',
          )
        : T(lang, 'Mã không hợp lệ', 'Invalid promo code'),
    );
  }

  async function createOrder() {
    if (!paymentAck) {
      setError(
        T(
          lang,
          'Vui lòng xác nhận đã chuyển khoản đúng số tiền và nội dung.',
          'Please confirm the exact transfer amount and reference.',
        ),
      );
      return;
    }

    setOrderBusy(true);
    setError('');

    const payload = {
      orderType: 'investor_service_upgrade',
      role: 'investor',
      termMonths: months,
      termWeeks: months * 4,
      amount: price.total,
      currency: price.currency,
      promoCode: promoCode.trim().toUpperCase() || null,
      promoDiscountPct: promoPct,
      bankContent: orderCode,
      pricing: price,
    };

    const { error } = await supabase.from('payment_orders').insert({
      investor_id: investor.id,
      profile_id: profile?.id || null,
      created_by: profile?.id || null,
      status: 'pending',
      title:
        `${T(lang, 'Mua/Nâng cấp dịch vụ Nhà đầu tư', 'Buy/Upgrade investor service')}` +
        ` · ${months} ${T(lang, 'tháng', 'months')}` +
        ` · ${money(price.total, price.currency)}`,
      payload,
      visibility: 'private',
      sort_order: 0,
    });

    setOrderBusy(false);

    if (error) {
      setError(T(lang, 'Có lỗi', 'Something went wrong'));
      return;
    }

    setMessage(
      T(
        lang,
        'Đã ghi nhận thanh toán. Quản trị/SePay sẽ xác nhận và cập nhật dịch vụ.',
        'Payment recorded. The administrator/SePay will confirm and update the service.',
      ),
    );
    setOpen(false);
    setPaymentAck(false);
    await onReload();
  }

  return (
    <div className="d68-dashboard-card d68-dashboard-billing">
      <div className="d68-dashboard-row-head">
        <div>
          <h2>{T(lang, 'Thanh toán / Invoice', 'Payments / Invoices')}</h2>
          <p>
            {T(
              lang,
              'Lịch sử thanh toán dịch vụ và mua/nâng cấp dịch vụ Nhà đầu tư.',
              'Investor service payment history and service purchase/upgrade.',
            )}
          </p>
        </div>
        <button
          type="button"
          className="d68-dashboard-btn gold"
          onClick={() => setOpen((value) => !value)}
        >
          {T(lang, 'Mua/Nâng cấp dịch vụ', 'Buy/Upgrade service')}
        </button>
      </div>

      <div className="d68-billing-history">
        {payments.length ? (
          payments.map((payment) => {
            const payload = payloadOf(payment);
            const amount = payload.amount ?? payload.pricing?.total;
            const currency =
              payload.currency ?? payload.pricing?.currency ?? 'VND';
            const label = statusLabel(lang, payment.status);
            return (
              <div
                key={payment.id}
                className="d68-dashboard-row d68-billing-row"
              >
                <div style={{ flex: 1 }}>
                  <b>
                    {payment.title ||
                      T(lang, 'Đơn thanh toán', 'Payment order')}
                  </b>
                  <div className="d68-dashboard-mini">
                    {label} ·{' '}
                    {new Date(payment.created_at).toLocaleString(
                      lang === 'vi' ? 'vi-VN' : 'en-US',
                    )}{' '}
                    ·{' '}
                    {amount
                      ? money(amount, currency)
                      : T(lang, 'Đang cập nhật', 'Pending')}
                  </div>
                  {payload.bankContent ? (
                    <div className="d68-dashboard-mini">
                      {T(lang, 'Nội dung chuyển khoản', 'Transfer reference')}:{' '}
                      {payload.bankContent}
                    </div>
                  ) : null}
                </div>
                <span
                  className={`d68-dashboard-badge ${
                    ['confirmed', 'paid', 'active'].includes(
                      String(payment.status).toLowerCase(),
                    )
                      ? 'green'
                      : 'gold'
                  }`}
                >
                  {label}
                </span>
              </div>
            );
          })
        ) : (
          <div className="d68-dashboard-empty">
            {T(
              lang,
              'Chưa có lịch sử thanh toán.',
              'No payment history yet.',
            )}
          </div>
        )}
      </div>

      {open ? (
        <div className="d68-dashboard-upgrade-box">
          <h3>
            {T(
              lang,
              'Dịch vụ Nhà đầu tư và Thanh toán',
              'Investor service and payment',
            )}
          </h3>

          <div className="d68-bizreg-paygrid">
            <div className="d68-bizreg-payleft">
              <label className="d68-bizreg-label">
                {T(lang, 'Kỳ hạn', 'Term')}{' '}
                <small>({T(lang, 'tháng', 'months')})</small>
              </label>
              <div className="d68-bizreg-terms">
                {[4, 8, 12, 16, 24].map((term) => {
                  const estimate = calculatePricing(
                    {
                      role: 'investor',
                      country,
                      termWeeks: term * 4,
                      promoCode,
                    },
                    promoPct,
                  );
                  return (
                    <button
                      type="button"
                      key={term}
                      className={months === term ? 'active' : ''}
                      onClick={() => setMonths(term)}
                    >
                      <b>{term}</b>
                      {estimate.termDiscountPct ? (
                        <span>-{estimate.termDiscountPct}%</span>
                      ) : null}
                    </button>
                  );
                })}
              </div>

              <label className="d68-bizreg-label">
                {T(
                  lang,
                  'Mã khuyến mãi/giới thiệu',
                  'Promo/referral code',
                )}
              </label>
              <div className="d68-bizreg-promo">
                <input
                  value={promoCode}
                  onChange={(event) =>
                    setPromoCode(event.target.value.toUpperCase())
                  }
                  placeholder="DEALS68"
                />
                <button
                  type="button"
                  disabled={promoBusy}
                  onClick={applyPromo}
                >
                  {promoBusy ? '...' : T(lang, 'Áp dụng', 'Apply')}
                </button>
              </div>
              {promoMessage ? (
                <p
                  className={
                    promoPct
                      ? 'd68-bizreg-promo-ok'
                      : 'd68-bizreg-promo-warn'
                  }
                >
                  {promoMessage}
                </p>
              ) : null}
            </div>

            <aside className="d68-bizreg-summary">
              <span>{T(lang, 'Tạm tính', 'Estimate')}</span>
              <div>
                <span>{T(lang, 'Phí dịch vụ', 'Service fee')}</span>
                <b>{money(price.subtotal, price.currency)}</b>
              </div>
              <div className={price.termDiscountPct ? 'good' : ''}>
                <span>
                  {T(lang, 'Chiết khấu kỳ hạn', 'Term discount')}
                </span>
                <b>
                  {price.termDiscountPct
                    ? `-${money(
                        price.termDiscount,
                        price.currency,
                      )} (${price.termDiscountPct}%)`
                    : T(lang, 'Không', 'None')}
                </b>
              </div>
              <div className={price.promoDiscountPct ? 'good' : ''}>
                <span>{T(lang, 'Giảm giá', 'Promo discount')}</span>
                <b>
                  {price.promoDiscountPct
                    ? `-${money(
                        price.promoDiscount,
                        price.currency,
                      )} (${price.promoDiscountPct}%)`
                    : T(lang, 'Không', 'None')}
                </b>
              </div>
              <strong>
                {T(lang, 'Tổng thanh toán', 'Total due')}
                <b>{money(price.total, price.currency)}</b>
              </strong>
            </aside>
          </div>

          <div className="d68-bizreg-payment-methods d68-bizreg-payment-methods--primary">
            <button type="button" className="active">
              <span>💵</span>
              {T(lang, 'Chuyển khoản QR', 'QR bank transfer')}
            </button>
          </div>

          <div className="d68-bizreg-qrbox">
            <a href={qrSrc || qrUrl} target="_blank" rel="noreferrer">
              <img
                src={qrSrc || qrUrl}
                alt="QR Vietcombank"
                onError={() => setQrSrc(STATIC_VIETQR_URL)}
              />
            </a>
            <div>
              <p>
                {T(lang, 'Người nhận:', 'Recipient:')}{' '}
                <b>Tieu Vo Dinh Phi</b>
              </p>
              <p>
                {T(lang, 'Số TK:', 'Account no.:')}{' '}
                <b>0011004000713</b>
              </p>
              <p>
                {T(lang, 'Nội dung:', 'Transfer reference:')}{' '}
                <b>{orderCode}</b>
              </p>
              <p>
                {T(lang, 'Số tiền:', 'Amount:')}{' '}
                <b>{money(price.total, price.currency)}</b>
              </p>
            </div>
            <label>
              <input
                type="checkbox"
                checked={paymentAck}
                onChange={(event) =>
                  setPaymentAck(event.target.checked)
                }
              />{' '}
              {T(
                lang,
                'Tôi đã chuyển khoản đúng số tiền và nội dung ở trên',
                'I have transferred the exact amount with the reference above',
              )}
            </label>
          </div>

          <div className="d68-bizreg-payment-methods d68-bizreg-payment-methods--secondary">
            <button type="button" disabled>
              <span>💳</span>
              SePay · {T(lang, 'Sắp ra mắt', 'Coming soon')}
            </button>
            <button type="button" disabled>
              <span>💳</span>
              Stripe / PayPal · {T(lang, 'Sắp ra mắt', 'Coming soon')}
            </button>
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              marginTop: 14,
            }}
          >
            <button
              type="button"
              disabled={orderBusy}
              className="d68-dashboard-btn gold"
              onClick={createOrder}
            >
              {orderBusy
                ? T(lang, 'Đang ghi nhận...', 'Recording...')
                : T(lang, 'Tôi đã thanh toán', 'I have paid')}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
