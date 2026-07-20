import { FormEvent, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';

type PromoRow = Record<string, any>;

type PromoUsageSummary = {
  promo_id: string;
  usage_count: number | string;
  confirmed_count: number | string;
  service_amount_total: number | string;
  discount_amount_total: number | string;
};

type PromoUsageRow = {
  promo_id: string;
  payment_order_id: string;
  order_code?: string | null;
  entity_type?: string | null;
  entity_code?: string | null;
  entity_name?: string | null;
  service_plan?: string | null;
  service_amount?: number | string | null;
  discount_amount?: number | string | null;
  currency?: string | null;
  used_at?: string | null;
  payment_status?: string | null;
  payment_confirmed?: boolean | null;
};

type AdminPromoManagerProps = {
  adminId: string;
  refreshKey?: string;
  setMessage: (message: string) => void;
  setError: (message: string) => void;
};

function formatDateTime(value: unknown, emptyLabel = 'Không giới hạn') {
  const raw = String(value || '').trim();
  if (!raw) return emptyLabel;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return 'Không xác định';
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function roleLabel(value: unknown) {
  const role = String(value || '').toLowerCase();
  if (role === 'business') return 'Doanh nghiệp';
  if (role === 'investor') return 'Nhà đầu tư';
  if (role === 'advisor') return 'Cố vấn';
  if (role === 'affiliate') return 'Đối tác thị trường';
  return 'Tất cả';
}

function entityTypeLabel(value: unknown) {
  const role = String(value || '').toLowerCase();
  if (role === 'business') return 'Doanh nghiệp';
  if (role === 'investor') return 'Nhà đầu tư';
  if (role === 'advisor') return 'Cố vấn';
  if (role === 'affiliate') return 'Đối tác thị trường';
  return 'Tài khoản';
}

function formatMoney(value: unknown, currency: unknown) {
  const amount = Number(value || 0);
  const unit = String(currency || 'VND').toUpperCase();
  const formatted = new Intl.NumberFormat(unit === 'USD' ? 'en-US' : 'vi-VN', {
    maximumFractionDigits: unit === 'USD' ? 2 : 0,
  }).format(Number.isFinite(amount) ? amount : 0);
  return unit === 'USD' ? `US$${formatted}` : `${formatted} ₫`;
}

function usageText(promo: PromoRow, summary?: PromoUsageSummary) {
  const used = Math.max(0, Number(summary?.usage_count || 0));
  const total = Number(promo.quota_total || 0);
  return `${used}/${total > 0 ? total : '∞'}`;
}

function usageHeadline(promo: PromoRow, count: number) {
  const total = Number(promo.quota_total || 0);
  return `Có ${count}/${total > 0 ? total : '∞'} lượt sử dụng`;
}

function paymentState(row: PromoUsageRow) {
  if (row.payment_confirmed) {
    return { label: 'Đã duyệt', className: 'confirmed' };
  }
  const status = String(row.payment_status || '').toLowerCase();
  if (status === 'rejected' || status === 'cancelled' || status === 'canceled') {
    return { label: 'Không duyệt', className: 'rejected' };
  }
  return { label: 'Chưa duyệt', className: 'pending' };
}

function promoState(promo: PromoRow) {
  const now = Date.now();
  const startsAt = promo.starts_at
    ? new Date(promo.starts_at).getTime()
    : 0;
  const endsAt = promo.ends_at
    ? new Date(promo.ends_at).getTime()
    : Number.POSITIVE_INFINITY;

  if (!promo.active) {
    return { label: 'Không hoạt động', className: 'off' };
  }
  if (Number.isFinite(startsAt) && startsAt > now) {
    return { label: 'Sắp áp dụng', className: 'upcoming' };
  }
  if (Number.isFinite(endsAt) && endsAt < now) {
    return { label: 'Đã hết hạn', className: 'expired' };
  }
  return { label: 'Đang áp dụng', className: 'active' };
}

function dateTimeValue(raw: FormDataEntryValue | null) {
  const value = String(raw || '').trim();
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export default function AdminPromoManager({
  adminId,
  refreshKey = '',
  setMessage,
  setError,
}: AdminPromoManagerProps) {
  const [promos, setPromos] = useState<PromoRow[]>([]);
  const [usageSummaries, setUsageSummaries] = useState<Record<string, PromoUsageSummary>>({});
  const [usageRowsByPromo, setUsageRowsByPromo] = useState<Record<string, PromoUsageRow[]>>({});
  const [expandedPromoId, setExpandedPromoId] = useState('');
  const [usageLoadingId, setUsageLoadingId] = useState('');
  const [loading, setLoading] = useState(false);
  const [actionKey, setActionKey] = useState('');
  const isBusy = loading || Boolean(actionKey);

  async function loadPromos() {
    if (!adminId) return;
    setLoading(true);
    setError('');

    try {
      const [promoResult, summaryResult] = await Promise.all([
        supabase
          .from('promo_codes')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(500),
        supabase.rpc('get_admin_promo_usage_summary'),
      ]);

      if (promoResult.error || summaryResult.error) {
        throw promoResult.error || summaryResult.error;
      }

      const summaries = Object.fromEntries(
        ((summaryResult.data || []) as PromoUsageSummary[]).map((item) => [
          String(item.promo_id),
          item,
        ]),
      );

      setPromos(promoResult.data || []);
      setUsageSummaries(summaries);
      setUsageRowsByPromo({});
      setExpandedPromoId('');
    } catch (loadError: any) {
      setPromos([]);
      setUsageSummaries({});
      setError(loadError?.message || 'Không tải được danh sách mã khuyến mãi.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadPromos();
  }, [adminId, refreshKey]);

  const totals = useMemo(
    () => ({
      all: promos.length,
      active: promos.filter(
        (promo) => promoState(promo).className === 'active',
      ).length,
      used: promos.reduce(
        (sum, promo) =>
          sum + Math.max(0, Number(usageSummaries[promo.id]?.usage_count || 0)),
        0,
      ),
    }),
    [promos, usageSummaries],
  );

  async function createPromo(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const code = String(form.get('code') || '').trim().toUpperCase();
    const discountPct = Number(form.get('discount_pct') || 0);
    const quotaTotal = Math.max(0, Number(form.get('quota_total') || 0));
    const startsAt = dateTimeValue(form.get('starts_at')) || new Date().toISOString();
    const endsAt = dateTimeValue(form.get('ends_at'));

    setMessage('');
    setError('');

    if (!code) {
      setError('Vui lòng nhập mã khuyến mãi.');
      return;
    }
    if (!Number.isFinite(discountPct) || discountPct < 0 || discountPct > 100) {
      setError('Mức giảm giá phải từ 0% đến 100%.');
      return;
    }
    if (endsAt && new Date(endsAt).getTime() < new Date(startsAt).getTime()) {
      setError('Ngày kết thúc phải sau ngày bắt đầu.');
      return;
    }

    setActionKey('create');
    try {
      const { error } = await supabase.from('promo_codes').insert({
        code,
        description: String(form.get('description') || '').trim() || null,
        role: form.get('role'),
        discount_pct: discountPct,
        quota_total: Math.floor(quotaTotal),
        starts_at: startsAt,
        ends_at: endsAt,
        active: true,
        created_by: adminId,
      });

      if (error) throw error;
      formElement.reset();
      setMessage(`Đã tạo mã khuyến mãi ${code}.`);
      await loadPromos();
    } catch (createError: any) {
      setError(createError?.message || 'Không tạo được mã khuyến mãi.');
    } finally {
      setActionKey('');
    }
  }

  async function setPromoActive(promo: PromoRow, active: boolean) {
    setActionKey(`status-${promo.id}`);
    setMessage('');
    setError('');

    try {
      const { error } = await supabase
        .from('promo_codes')
        .update({ active })
        .eq('id', promo.id);

      if (error) throw error;
      setMessage(
        active
          ? `Đã bật mã ${promo.code}.`
          : `Đã tạm dừng mã ${promo.code}.`,
      );
      await loadPromos();
    } catch (statusError: any) {
      setError(statusError?.message || 'Không cập nhật được trạng thái mã.');
    } finally {
      setActionKey('');
    }
  }

  async function toggleUsageDetails(promo: PromoRow) {
    const promoId = String(promo.id || '');
    if (!promoId) return;

    if (expandedPromoId === promoId) {
      setExpandedPromoId('');
      return;
    }

    setExpandedPromoId(promoId);
    if (Object.prototype.hasOwnProperty.call(usageRowsByPromo, promoId)) return;

    setUsageLoadingId(promoId);
    setError('');
    try {
      const { data, error } = await supabase.rpc('get_admin_promo_usage', {
        promo_uuid: promoId,
      });
      if (error) throw error;

      const rows = (data || []) as PromoUsageRow[];
      setUsageRowsByPromo((current) => ({ ...current, [promoId]: rows }));
      setUsageSummaries((current) => ({
        ...current,
        [promoId]: {
          promo_id: promoId,
          usage_count: rows.length,
          confirmed_count: rows.filter((row) => row.payment_confirmed).length,
          service_amount_total: current[promoId]?.service_amount_total || 0,
          discount_amount_total: current[promoId]?.discount_amount_total || 0,
        },
      }));
    } catch (usageError: any) {
      setUsageRowsByPromo((current) => ({ ...current, [promoId]: [] }));
      setError(usageError?.message || 'Không tải được chi tiết lượt sử dụng.');
    } finally {
      setUsageLoadingId('');
    }
  }

  return (
    <section className="d68-admin-promo-manager" aria-labelledby="admin-promo-title">
      <div className="d68-admin-promo-toolbar">
        <div>
          <h2 id="admin-promo-title">Mã khuyến mãi</h2>
          <p>Quản lý mã giảm giá, số lượt sử dụng và thời gian áp dụng.</p>
        </div>
        <button
          type="button"
          className="d68-admin-btn"
          onClick={() => void loadPromos()}
          disabled={isBusy}
        >
          {isBusy ? 'Đang xử lý...' : 'Làm mới'}
        </button>
      </div>

      <div className="d68-admin-promo-metrics">
        <div className="d68-admin-card"><span>Tổng mã</span><b>{totals.all}</b></div>
        <div className="d68-admin-card"><span>Đang áp dụng</span><b>{totals.active}</b></div>
        <div className="d68-admin-card"><span>Tổng lượt đã dùng</span><b>{totals.used}</b></div>
      </div>

      <div className="d68-admin-card">
        <h2>Tạo mã mới</h2>
        <form onSubmit={createPromo} className="d68-admin-form4 d68-admin-form-gap">
          <input required name="code" placeholder="CODE" className="d68-admin-input" />
          <input name="description" placeholder="Mô tả" className="d68-admin-input" />
          <select name="role" className="d68-admin-input" defaultValue="business">
            <option value="business">Doanh nghiệp</option>
            <option value="investor">Nhà đầu tư</option>
            <option value="advisor">Cố vấn</option>
            <option value="affiliate">Đối tác thị trường</option>
          </select>
          <input
            required
            name="discount_pct"
            type="number"
            min="0"
            max="100"
            step="0.01"
            placeholder="% giảm"
            className="d68-admin-input"
          />
          <input
            name="quota_total"
            type="number"
            min="0"
            step="1"
            placeholder="Tổng lượt dùng · 0 = không giới hạn"
            className="d68-admin-input"
          />
          <input name="starts_at" type="datetime-local" className="d68-admin-input" />
          <input name="ends_at" type="datetime-local" className="d68-admin-input" />
          <button className="d68-admin-btn green" disabled={isBusy}>
            {actionKey === 'create' ? 'Đang tạo...' : 'Tạo mã'}
          </button>
        </form>
      </div>

      <div className="d68-admin-card">
        <div className="d68-admin-promo-list-head">
          <h2>Danh sách mã</h2>
          <span>{loading ? 'Đang tải...' : `${promos.length} mã`}</span>
        </div>
        {promos.length ? (
          <div className="d68-admin-promo-list">
            {promos.map((promo) => {
              const state = promoState(promo);
              const summary = usageSummaries[promo.id];
              const statusBusy = actionKey === `status-${promo.id}`;
              const isExpanded = expandedPromoId === promo.id;
              const usageLoading = usageLoadingId === promo.id;
              const usageRows = usageRowsByPromo[promo.id] || [];
              const usageCount = Math.max(0, Number(summary?.usage_count || usageRows.length));

              return (
                <article key={promo.id} className={`d68-admin-promo-card${isExpanded ? ' is-expanded' : ''}`}>
                  <div className="d68-admin-promo-card__head">
                    <div>
                      <b>{promo.code}</b>
                      <p>{promo.description || 'Không có mô tả'}</p>
                    </div>
                    <div className="d68-admin-promo-card__status-actions">
                      <span className={`d68-admin-promo-state ${state.className}`}>
                        {state.label}
                      </span>
                      <button
                        type="button"
                        className="d68-admin-btn light"
                        disabled={usageLoading}
                        aria-expanded={isExpanded}
                        onClick={() => void toggleUsageDetails(promo)}
                      >
                        {usageLoading
                          ? 'Đang tải...'
                          : isExpanded
                            ? 'Ẩn chi tiết'
                            : 'Chi tiết lượt dùng'}
                      </button>
                      <button
                        type="button"
                        className={`d68-admin-btn ${promo.active ? 'light' : 'green'}`}
                        disabled={isBusy}
                        onClick={() => void setPromoActive(promo, !promo.active)}
                      >
                        {statusBusy
                          ? 'Đang lưu...'
                          : promo.active
                            ? 'Tạm dừng'
                            : 'Bật mã'}
                      </button>
                    </div>
                  </div>
                  <div className="d68-admin-promo-card__meta">
                    <div><span>Giảm giá</span><b>{Number(promo.discount_pct || 0)}%</b></div>
                    <div><span>Vai trò</span><b>{roleLabel(promo.role)}</b></div>
                    <div><span>Số lượt dùng/Tổng</span><b>{usageText(promo, summary)}</b></div>
                    <div className="d68-admin-promo-card__period">
                      <span>Thời gian áp dụng</span>
                      <b>{formatDateTime(promo.starts_at)} <em>→</em> {formatDateTime(promo.ends_at)}</b>
                    </div>
                  </div>

                  {isExpanded ? (
                    <section className="d68-admin-promo-usage" aria-label={`Chi tiết lượt dùng mã ${promo.code}`}>
                      <div className="d68-admin-promo-usage__info">
                        <div>
                          <span>Tên/Mã khuyến mãi</span>
                          <b>{promo.description || promo.code}</b>
                          {promo.description ? <small>{promo.code}</small> : null}
                        </div>
                        <div>
                          <span>Đối tượng áp dụng</span>
                          <b>{roleLabel(promo.role)}</b>
                        </div>
                        <div>
                          <span>Số lượng áp dụng</span>
                          <b>{Number(promo.quota_total || 0) > 0 ? `${Number(promo.quota_total)} lượt` : 'Không giới hạn'}</b>
                        </div>
                        <div>
                          <span>Ngày áp dụng</span>
                          <b>{formatDateTime(promo.starts_at)} <em>→</em> {formatDateTime(promo.ends_at)}</b>
                        </div>
                      </div>

                      <div className="d68-admin-promo-usage__head">
                        <h3>{usageHeadline(promo, usageCount)}</h3>
                        {summary ? (
                          <span>{Math.max(0, Number(summary.confirmed_count || 0))} lượt đã duyệt thanh toán</span>
                        ) : null}
                      </div>

                      {usageLoading ? (
                        <div className="d68-admin-promo-usage__empty">Đang tải chi tiết lượt sử dụng...</div>
                      ) : usageRows.length ? (
                        <div className="d68-admin-promo-usage__table-wrap">
                          <table className="d68-admin-promo-usage__table">
                            <thead>
                              <tr>
                                <th>ID Business/Investor</th>
                                <th>Tên Business/Investor</th>
                                <th>Gói dịch vụ</th>
                                <th>Số tiền gói dịch vụ</th>
                                <th>Số tiền ưu đãi</th>
                                <th>Ngày sử dụng</th>
                                <th>Trạng thái thanh toán</th>
                              </tr>
                            </thead>
                            <tbody>
                              {usageRows.map((row) => {
                                const payment = paymentState(row);
                                return (
                                  <tr key={row.payment_order_id}>
                                    <td>
                                      <b>{row.entity_code || '—'}</b>
                                      <small>{entityTypeLabel(row.entity_type)}</small>
                                    </td>
                                    <td>{row.entity_name || '—'}</td>
                                    <td>{row.service_plan || '—'}</td>
                                    <td>{formatMoney(row.service_amount, row.currency)}</td>
                                    <td>{formatMoney(row.discount_amount, row.currency)}</td>
                                    <td>{formatDateTime(row.used_at, '—')}</td>
                                    <td>
                                      <span className={`d68-admin-promo-payment ${payment.className}`}>
                                        {payment.label}
                                      </span>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="d68-admin-promo-usage__empty">Chưa có lượt dùng nào.</div>
                      )}
                    </section>
                  ) : null}
                </article>
              );
            })}
          </div>
        ) : loading ? null : (
          <div className="d68-admin-empty">Chưa có mã khuyến mãi.</div>
        )}
      </div>
    </section>
  );
}
