import { FormEvent, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';

type PromoRow = Record<string, any>;

type AdminPromoManagerProps = {
  adminId: string;
  refreshKey?: string;
  setMessage: (message: string) => void;
  setError: (message: string) => void;
};

function formatDateTime(value: unknown) {
  const raw = String(value || '').trim();
  if (!raw) return 'Không giới hạn';
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

function usageText(promo: PromoRow) {
  const used = Math.max(0, Number(promo.quota_used || 0));
  const total = Number(promo.quota_total || 0);
  return `${used}/${total > 0 ? total : '∞'}`;
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
  const [loading, setLoading] = useState(false);
  const [actionKey, setActionKey] = useState('');
  const isBusy = loading || Boolean(actionKey);

  async function loadPromos() {
    if (!adminId) return;
    setLoading(true);
    setError('');

    try {
      const { data, error } = await supabase
        .from('promo_codes')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);

      if (error) throw error;
      setPromos(data || []);
    } catch (loadError: any) {
      setPromos([]);
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
          sum + Math.max(0, Number(promo.quota_used || 0)),
        0,
      ),
    }),
    [promos],
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
              const statusBusy = actionKey === `status-${promo.id}`;
              return (
                <article key={promo.id} className="d68-admin-promo-card">
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
                    <div><span>Vai trò</span><b>{promo.role || 'Tất cả'}</b></div>
                    <div><span>Số lượt dùng/Tổng</span><b>{usageText(promo)}</b></div>
                    <div className="d68-admin-promo-card__period">
                      <span>Thời gian áp dụng</span>
                      <b>{formatDateTime(promo.starts_at)} <em>→</em> {formatDateTime(promo.ends_at)}</b>
                    </div>
                  </div>
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
