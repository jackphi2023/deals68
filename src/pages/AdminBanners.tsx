import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import {
  uploadSiteBannerImage,
  type BannerLangMode,
  type BannerPlacement,
  type SiteBanner,
} from '../lib/banners';
import {
  heroFocusPosition,
  heroMobileFocusPosition,
} from '../components/HeroBannerMedia';

type BannerRow = SiteBanner & {
  mobile_focal_x?: number | null;
  mobile_focal_y?: number | null;
};

type FocusDraft = {
  desktopX: number;
  desktopY: number;
  mobileX: number;
  mobileY: number;
  desktopPreviewUrl: string;
  mobilePreviewUrl: string;
};

const PLACEMENTS: Array<{
  id: BannerPlacement;
  label: string;
  slots: number;
  note: string;
}> = [
  {
    id: 'home_hero',
    label: 'Trang chủ Hero',
    slots: 5,
    note: 'Desktop ưu tiên 1600×600px; mobile ưu tiên 900×1200px. Mỗi thiết bị có vùng trọng tâm riêng.',
  },
  {
    id: 'home_promotion',
    label: 'Trang chủ Promotion',
    slots: 2,
    note: 'Khuyến nghị 1600×550px.',
  },
  {
    id: 'listing_promotion',
    label: 'Trang danh sách Promotion',
    slots: 2,
    note: 'Khuyến nghị 1600×550px.',
  },
  {
    id: 'investor_cover_default',
    label: 'Ảnh cover mặc định Nhà đầu tư',
    slots: 1,
    note: 'Khuyến nghị 1600×560px.',
  },
];

function dateIn(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function clampFocus(value: unknown, fallback = 50) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(0, Math.min(100, Math.round(numeric)));
}

function clean(value: unknown) {
  return String(value || '').trim();
}

function slotRow(rows: BannerRow[], placement: BannerPlacement, slot: number) {
  return rows
    .filter((row) => row.placement === placement && Number(row.sort_order || 1) === slot)
    .sort((a, b) => String(b.updated_at || b.created_at || '').localeCompare(String(a.updated_at || a.created_at || '')))[0] || null;
}

function initialDraft(row: BannerRow | null): FocusDraft {
  return {
    desktopX: clampFocus(row?.focal_x),
    desktopY: clampFocus(row?.focal_y),
    mobileX: clampFocus(row?.mobile_focal_x ?? row?.focal_x),
    mobileY: clampFocus(row?.mobile_focal_y ?? row?.focal_y),
    desktopPreviewUrl: clean(row?.image_url),
    mobilePreviewUrl: clean(row?.mobile_image_url || row?.image_url),
  };
}

function FocusControl({
  name,
  label,
  value,
  onChange,
  hint,
}: {
  name: string;
  label: string;
  value: number;
  onChange: (value: number) => void;
  hint: string;
}) {
  return (
    <label className="d68-admin-field d68-banner-focus-control">
      <span>{label}: {value}%</span>
      <input
        type="range"
        min="0"
        max="100"
        value={value}
        onChange={(event) => onChange(clampFocus(event.target.value))}
      />
      <input
        name={name}
        type="number"
        min="0"
        max="100"
        value={value}
        onChange={(event) => onChange(clampFocus(event.target.value))}
        className="d68-admin-input"
      />
      <small>{hint}</small>
    </label>
  );
}

function HeroEditor({
  row,
  placement,
  slot,
  busy,
  onSave,
  onDelete,
}: {
  row: BannerRow | null;
  placement: BannerPlacement;
  slot: number;
  busy: boolean;
  onSave: (event: FormEvent<HTMLFormElement>, placement: BannerPlacement, slot: number, row: BannerRow | null, draft: FocusDraft) => Promise<void>;
  onDelete: (row: BannerRow) => Promise<void>;
}) {
  const [draft, setDraft] = useState<FocusDraft>(() => initialDraft(row));

  useEffect(() => {
    setDraft(initialDraft(row));
  }, [row?.id, row?.updated_at]);

  useEffect(() => {
    return () => {
      [draft.desktopPreviewUrl, draft.mobilePreviewUrl].forEach((url) => {
        if (url.startsWith('blob:')) URL.revokeObjectURL(url);
      });
    };
  }, []);

  const previewBanner = useMemo<BannerRow>(() => ({
    ...(row || {
      id: `draft-${placement}-${slot}`,
      placement,
      image_url: draft.desktopPreviewUrl,
      sort_order: slot,
      lang_mode: 'both',
      active: true,
    }),
    image_url: draft.desktopPreviewUrl,
    mobile_image_url: draft.mobilePreviewUrl || null,
    focal_x: draft.desktopX,
    focal_y: draft.desktopY,
    mobile_focal_x: draft.mobileX,
    mobile_focal_y: draft.mobileY,
  }), [row, placement, slot, draft]);

  function updatePreview(kind: 'desktop' | 'mobile', file?: File | null) {
    if (!file?.name) return;
    const url = URL.createObjectURL(file);
    setDraft((current) => {
      const old = kind === 'desktop' ? current.desktopPreviewUrl : current.mobilePreviewUrl;
      if (old.startsWith('blob:')) URL.revokeObjectURL(old);
      return kind === 'desktop'
        ? {
            ...current,
            desktopPreviewUrl: url,
            mobilePreviewUrl: row?.mobile_image_url ? current.mobilePreviewUrl : url,
          }
        : { ...current, mobilePreviewUrl: url };
    });
  }

  return (
    <form
      className="d68-banner-slot-card d68-banner-slot-card--responsive"
      onSubmit={(event) => onSave(event, placement, slot, row, draft)}
    >
      <div className="d68-banner-slot-card__body">
        <div className="d68-admin-row-head">
          <div>
            <h3>{PLACEMENTS.find((item) => item.id === placement)?.label} · Banner {slot}</h3>
            <p className="d68-admin-subtle">{row ? 'Đang chỉnh banner đã lưu' : 'Chưa có banner trong slot này'}</p>
          </div>
          {row ? <span className={`d68-admin-badge ${row.active ? 'ok' : 'warn'}`}>{row.active ? 'Đang bật' : 'Đang tắt'}</span> : null}
        </div>

        {placement === 'home_hero' ? (
          <div className="d68-banner-live-previews">
            <figure className="d68-banner-live-preview d68-banner-live-preview--desktop">
              <figcaption>Desktop · khung 8:3 · cover</figcaption>
              {draft.desktopPreviewUrl ? (
                <img
                  src={draft.desktopPreviewUrl}
                  alt="Desktop hero preview"
                  style={{ objectPosition: heroFocusPosition(previewBanner) }}
                />
              ) : <span>Chọn ảnh desktop để xem trước</span>}
            </figure>
            <figure className="d68-banner-live-preview d68-banner-live-preview--mobile">
              <figcaption>Mobile · khung 3:4 · cover</figcaption>
              {draft.mobilePreviewUrl ? (
                <img
                  src={draft.mobilePreviewUrl}
                  alt="Mobile hero preview"
                  style={{ objectPosition: heroMobileFocusPosition(previewBanner) }}
                />
              ) : <span>Mobile sẽ dùng ảnh desktop</span>}
            </figure>
          </div>
        ) : null}

        <div className="d68-admin-form2">
          <label className="d68-admin-field"><span>Tên banner</span><input name="title" defaultValue={row?.title || `Banner ${slot}`} className="d68-admin-input" /></label>
          <label className="d68-admin-field"><span>URL/Link</span><input name="link_url" defaultValue={row?.link_url || ''} placeholder="/pricing hoặc https://..." className="d68-admin-input" /></label>
          <label className="d68-admin-field"><span>Ngôn ngữ</span><select name="lang_mode" defaultValue={row?.lang_mode || 'both'} className="d68-admin-input"><option value="both">VN + EN</option><option value="vi">Chỉ VN</option><option value="en">Chỉ EN</option></select></label>
          <label className="d68-admin-field"><span>Trạng thái</span><label className="d68-admin-check"><input name="active" type="checkbox" defaultChecked={row?.active !== false} /> Đang hiển thị</label></label>
          <label className="d68-admin-field"><span>Từ ngày</span><input name="starts_at" type="date" defaultValue={row?.starts_at || dateIn(0)} className="d68-admin-input" /></label>
          <label className="d68-admin-field"><span>Đến ngày</span><input name="ends_at" type="date" defaultValue={row?.ends_at || dateIn(60)} className="d68-admin-input" /></label>
        </div>

        {placement === 'home_hero' ? (
          <>
            <section className="d68-banner-focus-group">
              <h4>Ưu tiên vùng ảnh Desktop</h4>
              <div className="d68-admin-form2">
                <FocusControl name="focal_x" label="Ngang X" value={draft.desktopX} onChange={(value) => setDraft((current) => ({ ...current, desktopX: value }))} hint="0 trái · 50 giữa · 100 phải" />
                <FocusControl name="focal_y" label="Dọc Y" value={draft.desktopY} onChange={(value) => setDraft((current) => ({ ...current, desktopY: value }))} hint="0 trên · 50 giữa · 100 dưới" />
              </div>
            </section>
            <section className="d68-banner-focus-group">
              <h4>Ưu tiên vùng ảnh Mobile</h4>
              <div className="d68-admin-form2">
                <FocusControl name="mobile_focal_x" label="Ngang X" value={draft.mobileX} onChange={(value) => setDraft((current) => ({ ...current, mobileX: value }))} hint="Độc lập với desktop" />
                <FocusControl name="mobile_focal_y" label="Dọc Y" value={draft.mobileY} onChange={(value) => setDraft((current) => ({ ...current, mobileY: value }))} hint="Độc lập với desktop" />
              </div>
            </section>
            <label className="d68-admin-field"><span>{row ? 'Thay ảnh desktop' : 'Upload ảnh desktop'}</span><small>Khuyến nghị 1600×600px.</small><input name="file" type="file" accept="image/png,image/jpeg,image/webp" required={!row} className="d68-admin-input" onChange={(event) => updatePreview('desktop', event.target.files?.[0])} /></label>
            <label className="d68-admin-field"><span>Ảnh mobile riêng — không bắt buộc</span><small>Khuyến nghị 900×1200px. Khi trống, mobile dùng ảnh desktop nhưng theo focal mobile.</small><input name="mobile_file" type="file" accept="image/png,image/jpeg,image/webp" className="d68-admin-input" onChange={(event) => updatePreview('mobile', event.target.files?.[0])} /></label>
            {row?.mobile_image_url ? <label className="d68-admin-check"><input name="remove_mobile" type="checkbox" onChange={(event) => { if (event.target.checked) setDraft((current) => ({ ...current, mobilePreviewUrl: current.desktopPreviewUrl })); else setDraft((current) => ({ ...current, mobilePreviewUrl: clean(row.mobile_image_url || row.image_url) })); }} /> Xóa ảnh mobile riêng và dùng ảnh desktop</label> : null}
          </>
        ) : (
          <label className="d68-admin-field"><span>{row ? 'Thay ảnh banner' : 'Upload ảnh banner'}</span><input name="file" type="file" accept="image/png,image/jpeg,image/webp,image/gif" required={!row} className="d68-admin-input" /></label>
        )}

        <div className="d68-admin-actions">
          <button className="d68-admin-btn green" disabled={busy}>{row ? 'Lưu / Thay ảnh' : 'Upload banner'}</button>
          {row ? <button type="button" className="d68-admin-btn red" disabled={busy} onClick={() => onDelete(row)}>Xóa</button> : null}
        </div>
      </div>
    </form>
  );
}

export default function AdminBanners() {
  const { profile, loading } = useAuth();
  const [rows, setRows] = useState<BannerRow[]>([]);
  const [busyKey, setBusyKey] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function load() {
    const { data, error: loadError } = await supabase.from('site_banners').select('*').order('placement').order('sort_order').order('updated_at', { ascending: false });
    if (loadError) throw loadError;
    setRows((data || []) as BannerRow[]);
  }

  useEffect(() => {
    if (profile?.role === 'admin') load().catch((loadError) => setError(loadError?.message || 'Không tải được banner.'));
  }, [profile?.role]);

  async function removeStoragePath(path?: string | null) {
    if (!clean(path)) return;
    const { error: removeError } = await supabase.storage.from('site-banners').remove([clean(path)]);
    if (removeError) throw removeError;
  }

  async function save(event: FormEvent<HTMLFormElement>, placement: BannerPlacement, slot: number, row: BannerRow | null, draft: FocusDraft) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const desktopFile = data.get('file') as File | null;
    const mobileFile = data.get('mobile_file') as File | null;
    if (!row?.image_url && !desktopFile?.name) return;

    const key = `${placement}-${slot}`;
    setBusyKey(key); setError(''); setMessage('');
    const uploadedPaths: string[] = [];
    const stalePaths = new Set<string>();
    let saved = false;

    try {
      let imageUrl = row?.image_url || '';
      let imagePath = row?.image_path || null;
      let mobileImageUrl = row?.mobile_image_url || null;
      let mobileImagePath = row?.mobile_image_path || null;

      if (desktopFile?.name) {
        const uploaded = await uploadSiteBannerImage(desktopFile, placement, 'desktop');
        uploadedPaths.push(uploaded.path);
        if (imagePath) stalePaths.add(imagePath);
        imageUrl = uploaded.publicUrl;
        imagePath = uploaded.path;
      }

      if (data.get('remove_mobile') === 'on' && mobileImagePath) {
        stalePaths.add(mobileImagePath);
        mobileImageUrl = null;
        mobileImagePath = null;
      }

      if (placement === 'home_hero' && mobileFile?.name) {
        const uploaded = await uploadSiteBannerImage(mobileFile, placement, 'mobile');
        uploadedPaths.push(uploaded.path);
        if (mobileImagePath) stalePaths.add(mobileImagePath);
        mobileImageUrl = uploaded.publicUrl;
        mobileImagePath = uploaded.path;
      }

      const payload = {
        placement,
        title: clean(data.get('title')) || `Banner ${slot}`,
        image_url: imageUrl,
        image_path: imagePath,
        mobile_image_url: placement === 'home_hero' ? mobileImageUrl : null,
        mobile_image_path: placement === 'home_hero' ? mobileImagePath : null,
        focal_x: placement === 'home_hero' ? clampFocus(draft.desktopX) : 50,
        focal_y: placement === 'home_hero' ? clampFocus(draft.desktopY) : 50,
        mobile_focal_x: placement === 'home_hero' ? clampFocus(draft.mobileX) : 50,
        mobile_focal_y: placement === 'home_hero' ? clampFocus(draft.mobileY) : 50,
        link_url: clean(data.get('link_url')) || null,
        sort_order: slot,
        lang_mode: (clean(data.get('lang_mode')) || 'both') as BannerLangMode,
        starts_at: clean(data.get('starts_at')) || dateIn(0),
        ends_at: clean(data.get('ends_at')) || null,
        active: data.get('active') === 'on',
        updated_at: new Date().toISOString(),
      };

      const result = row?.id
        ? await supabase.from('site_banners').update(payload).eq('id', row.id).select('id').single()
        : await supabase.from('site_banners').insert(payload).select('id').single();
      if (result.error) throw result.error;
      saved = true;

      const savedId = String(result.data?.id || row?.id || '');
      if (savedId) {
        const duplicate = await supabase.from('site_banners').update({ active: false }).eq('placement', placement).eq('sort_order', slot).neq('id', savedId).eq('active', true);
        if (duplicate.error) throw duplicate.error;
      }

      for (const path of stalePaths) {
        if ([imagePath, mobileImagePath].includes(path)) continue;
        try { await removeStoragePath(path); } catch { /* non-blocking stale cleanup */ }
      }

      setMessage(`Đã lưu ${placement} · Banner ${slot}.`);
      await load();
    } catch (saveError: any) {
      if (!saved) for (const path of uploadedPaths) { try { await removeStoragePath(path); } catch { /* best effort */ } }
      setError(saveError?.message || 'Không lưu được banner. Hãy đảm bảo migration mobile focal đã được áp dụng.');
    } finally {
      setBusyKey('');
    }
  }

  async function remove(row: BannerRow) {
    if (!window.confirm('Xóa banner này?')) return;
    setBusyKey(`delete-${row.id}`); setError(''); setMessage('');
    try {
      const { error: deleteError } = await supabase.from('site_banners').delete().eq('id', row.id);
      if (deleteError) throw deleteError;
      for (const path of [row.image_path, row.mobile_image_path]) { try { await removeStoragePath(path); } catch { /* non-blocking */ } }
      setMessage('Đã xóa banner.');
      await load();
    } catch (deleteError: any) {
      setError(deleteError?.message || 'Không xóa được banner.');
    } finally {
      setBusyKey('');
    }
  }

  if (loading) return <main className="d68-admin-page"><div className="d68-admin-wrap"><div className="d68-admin-card">Loading admin...</div></div></main>;
  if (profile?.role !== 'admin') return <Navigate to="/login?next=/admin/banners" replace />;

  return (
    <main className="d68-admin-page d68-admin-banners-page">
      <div className="d68-admin-wrap">
        <div className="d68-admin-row-head d68-admin-banners-head">
          <div><h1>Quản trị Banner</h1><p>Hero desktop/mobile có focal riêng và preview trực tiếp đúng tỷ lệ production.</p></div>
          <Link to="/admin" className="d68-admin-btn light">← Admin</Link>
        </div>
        {message ? <div className="d68-admin-notice ok">{message}</div> : null}
        {error ? <div className="d68-admin-notice err">{error}</div> : null}
        {PLACEMENTS.map((placement) => (
          <section key={placement.id} className="d68-admin-card d68-banner-admin__section">
            <h2>{placement.label}</h2><p className="d68-admin-subtle">{placement.note}</p>
            <div className="d68-banner-slot-grid">
              {Array.from({ length: placement.slots }).map((_, index) => {
                const slot = index + 1;
                const row = slotRow(rows, placement.id, slot);
                return <HeroEditor key={`${placement.id}-${slot}-${row?.id || 'new'}-${row?.updated_at || ''}`} row={row} placement={placement.id} slot={slot} busy={!!busyKey} onSave={save} onDelete={remove} />;
              })}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
