import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

type PromoRow = Record<string, any>;

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
  const startsAt = promo.starts_at ? new Date(promo.starts_at).getTime() : 0;
  const endsAt = promo.ends_at ? new Date(promo.ends_at).getTime() : Number.POSITIVE_INFINITY;
  if (!promo.active) return { label: 'Không hoạt động', className: 'off' };
  if (Number.isFinite(startsAt) && startsAt > now) return { label: 'Sắp áp dụng', className: 'upcoming' };
  if (Number.isFinite(endsAt) && endsAt < now) return { label: 'Đã hết hạn', className: 'expired' };
  return { label: 'Đang áp dụng', className: 'active' };
}

export default function AdminPromos() {
  const { profile, loading } = useAuth();
  const [promos, setPromos] = useState<PromoRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function loadPromos() {
    if (profile?.role !== 'admin') return;
    setBusy(true);
    setError('');
    const { data, error: loadError } = await supabase
      .from('promo_codes')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500);
    setBusy(false);
    if (loadError) {
      setError(loadError.message);
      setPromos([]);
      return;
    }
    setPromos(data || []);
  }

  useEffect(() => {
    loadPromos();
  }, [profile?.role]);

  const totals = useMemo(() => ({
    all: promos.length,
    active: promos.filter((promo) => promoState(promo).className === 'active').length,
    used: promos.reduce((sum, promo) => sum + Math.max(0, Number(promo.quota_used || 0)), 0),
  }), [promos]);

  async function createPromo(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile?.id) return;
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setMessage('');
    setError('');
    const { error: createError } = await supabase.from('promo_codes').insert({
      code: String(form.get('code') || '').trim().toUpperCase(),
      description: form.get('description'),
      role: form.get('role'),
      discount_pct: Number(form.get('discount_pct') || 0),
      quota_total: Number(form.get('quota_total') || 0),
      starts_at: form.get('starts_at') || new Date().toISOString(),
      ends_at: form.get('ends_at') || null,
      active: true,
      created_by: profile.id,
    });
    setBusy(false);
    if (createError) {
      setError(createError.message);
      return;
    }
    event.currentTarget.reset();
    setMessage('Đã tạo mã khuyến mãi.');
    await loadPromos();
  }

  if (loading) {
    return <section className="d68-admin-page"><div className="d68-admin-wrap"><div className="d68-admin-card">Loading admin...</div></div></section>;
  }
  if (profile?.role !== 'admin') return <Navigate to="/login?next=/admin/promo" replace />;

  return (
    <section className="d68-admin-page d68-admin-promos-page">
      <header className="d68-admin-head"><div className="d68-admin-head__inner"><b className="d68-admin-head__title">Admin Panel</b></div></header>
      <div className="d68-admin-wrap">
        <div className="d68-admin-promo-toolbar">
          <div>
            <Link to="/admin" className="d68-admin-promo-back">← Deals68 Admin</Link>
            <h1>Mã khuyến mãi</h1>
            <p>Quản lý mã giảm giá, số lượt sử dụng và thời gian áp dụng.</p>
          </div>
          <button type="button" className="d68-admin-btn" onClick={loadPromos} disabled={busy}>{busy ? 'Loading...' : 'Refresh'}</button>
        </div>

        {message ? <div className="d68-admin-notice ok">{message}</div> : null}
        {error ? <div className="d68-admin-notice err">{error}</div> : null}

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
            <select name="role" className="d68-admin-input">
              <option value="business">business</option>
              <option value="investor">investor</option>
              <option value="advisor">advisor</option>
              <option value="affiliate">affiliate</option>
            </select>
            <input required name="discount_pct" type="number" min="0" max="100" placeholder="% giảm" className="d68-admin-input" />
            <input name="quota_total" type="number" min="0" placeholder="Tổng lượt dùng" className="d68-admin-input" />
            <input name="starts_at" type="datetime-local" className="d68-admin-input" />
            <input name="ends_at" type="datetime-local" className="d68-admin-input" />
            <button className="d68-admin-btn green" disabled={busy}>Tạo mã</button>
          </form>
        </div>

        <div className="d68-admin-card">
          <div className="d68-admin-promo-list-head"><h2>Danh sách mã</h2><span>{promos.length} mã</span></div>
          {promos.length ? (
            <div className="d68-admin-promo-list">
              {promos.map((promo) => {
                const state = promoState(promo);
                return (
                  <article key={promo.id} className="d68-admin-promo-card">
                    <div className="d68-admin-promo-card__head">
                      <div><b>{promo.code}</b><p>{promo.description || 'Không có mô tả'}</p></div>
                      <span className={`d68-admin-promo-state ${state.className}`}>{state.label}</span>
                    </div>
                    <div className="d68-admin-promo-card__meta">
                      <div><span>Giảm giá</span><b>{Number(promo.discount_pct || 0)}%</b></div>
                      <div><span>Vai trò</span><b>{promo.role || 'Tất cả'}</b></div>
                      <div><span>Số lượt dùng/Tổng</span><b>{usageText(promo)}</b></div>
                      <div className="d68-admin-promo-card__period"><span>Thời gian áp dụng</span><b>{formatDateTime(promo.starts_at)} <em>→</em> {formatDateTime(promo.ends_at)}</b></div>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : <div className="d68-admin-empty">Chưa có mã khuyến mãi.</div>}
        </div>
      </div>
    </section>
  );
}
