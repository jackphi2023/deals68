
import { FormEvent, useEffect, useState } from 'react';
import type { Lang } from '../lib/i18n';
import { supabase } from '../lib/supabase';
import { listSiteBanners, uploadSiteBannerImage, type BannerPlacement, type SiteBanner } from '../lib/banners';

const PLACEMENTS: { id: BannerPlacement; label: string; note: string; slotCount: number; size: string }[] = [
  { id: 'home_hero', label: 'Trang chủ Hero', note: 'Slider ảnh nền trang chủ. Upload tối đa 5 ảnh, khuyến nghị 1600×800px.', slotCount: 5, size: '1600×800px' },
  { id: 'home_promotion', label: 'Trang chủ Promotion', note: 'Banner dưới box vai trò tại trang chủ. Upload 1-2 ảnh, khuyến nghị 1600×550px.', slotCount: 2, size: '1600×550px' },
  { id: 'listing_promotion', label: 'Trang danh sách Promotion', note: 'Banner dưới danh sách Business/Investor. Upload 1-2 ảnh, khuyến nghị 1600×550px.', slotCount: 2, size: '1600×550px' },
];

function svgData(title: string, subtitle: string, bg1: string, bg2: string, h = 800) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="${h}" viewBox="0 0 1600 ${h}"><defs><linearGradient id="g" x1="0" x2="1"><stop offset="0" stop-color="${bg1}"/><stop offset="1" stop-color="${bg2}"/></linearGradient></defs><rect width="1600" height="${h}" fill="url(#g)"/><circle cx="1300" cy="140" r="230" fill="rgba(255,255,255,.18)"/><circle cx="1220" cy="${h - 160}" r="320" fill="rgba(242,181,29,.20)"/><text x="120" y="180" font-family="Arial, sans-serif" font-size="54" font-weight="800" fill="white">${title}</text><text x="120" y="250" font-family="Arial, sans-serif" font-size="28" font-weight="600" fill="rgba(255,255,255,.82)">${subtitle}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
const HERO_FALLBACK = svgData('Deals68.com', 'Upload active Hero banners in Admin', '#0F2A4A', '#1596cc');
const PROMO_FALLBACK = svgData('Deals68 Beta', 'Upload promotion banner in Admin', '#F2B51D', '#1BADEA', 550);
function cleanUrl(url?: string | null) { return String(url || '').trim(); }
function BannerImg({ src, alt, fallback, eager = false }: { src?: string | null; alt: string; fallback: string; eager?: boolean }) {
  const [current, setCurrent] = useState(cleanUrl(src) || fallback);
  useEffect(() => setCurrent(cleanUrl(src) || fallback), [src, fallback]);
  return <img src={current} alt={alt} loading={eager ? 'eager' : 'lazy'} fetchPriority={eager ? 'high' : 'auto'} onError={() => setCurrent(fallback)} />;
}
function MaybeLink({ href, className, children }: { href?: string | null; className?: string; children: React.ReactNode }) {
  const clean = cleanUrl(href);
  if (!clean) return <div className={className}>{children}</div>;
  return <a className={className} href={clean} target={clean.startsWith('http') ? '_blank' : undefined} rel={clean.startsWith('http') ? 'noreferrer' : undefined}>{children}</a>;
}
export function HeroBannerSlider({ lang }: { lang: Lang }) {
  const [rows, setRows] = useState<SiteBanner[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [active, setActive] = useState(0);
  useEffect(() => { let live = true; setLoaded(false); listSiteBanners('home_hero', lang).then((data) => { if (live) { setRows(data.slice(0, 5)); setLoaded(true); } }).catch(() => { if (live) { setRows([]); setLoaded(true); } }); return () => { live = false; }; }, [lang]);
  useEffect(() => setActive(0), [rows.length]);
  useEffect(() => { if (rows.length <= 1) return; const timer = window.setInterval(() => setActive((cur) => (cur + 1) % rows.length), 5500); return () => window.clearInterval(timer); }, [rows.length]);
  if (!loaded || !rows.length) return <div className="d68-hero-slider" aria-hidden="true"><div className="d68-hero-slide is-active"><BannerImg src="" fallback={HERO_FALLBACK} alt="Deals68 hero placeholder" eager /></div></div>;
  return <div className="d68-hero-slider" aria-hidden="true">{rows.map((slide, idx) => <MaybeLink key={slide.id} href={slide.link_url} className={`d68-hero-slide${idx === active ? ' is-active' : ''}`}><BannerImg src={slide.image_url} fallback={HERO_FALLBACK} alt={slide.title || 'Deals68 banner'} eager={idx === 0} /></MaybeLink>)}{rows.length > 1 ? <div className="d68-hero-dots">{rows.map((slide, idx) => <button key={slide.id} type="button" aria-label={`Slide ${idx + 1}`} className={idx === active ? 'active' : ''} onClick={() => setActive(idx)} />)}</div> : null}</div>;
}
export function PromotionBanner({ placement, lang, className = '' }: { placement: 'home_promotion' | 'listing_promotion'; lang: Lang; className?: string }) {
  const [rows, setRows] = useState<SiteBanner[]>([]);
  useEffect(() => { let live = true; listSiteBanners(placement, lang).then((data) => { if (live) setRows(data); }).catch(() => { if (live) setRows([]); }); return () => { live = false; }; }, [placement, lang]);
  const banner = rows[0] || null;
  if (!banner) return null;
  return <section className={`d68-promo-banner ${className}`.trim()}><MaybeLink href={banner.link_url} className="d68-promo-banner__link"><BannerImg src={banner.image_url} fallback={PROMO_FALLBACK} alt={banner.title || 'Deals68 promotion'} /></MaybeLink></section>;
}
function dateIn(days: number) { const d = new Date(); d.setDate(d.getDate() + days); return d.toISOString().slice(0, 10); }
function firstSlotRow(rows: SiteBanner[], placement: BannerPlacement, slot: number) { return rows.filter((r) => r.placement === placement && Number(r.sort_order || 1) === slot).sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))[0] || null; }
export function AdminBannerManager() {
  const [rows, setRows] = useState<SiteBanner[]>([]); const [msg, setMsg] = useState(''); const [err, setErr] = useState(''); const [busyKey, setBusyKey] = useState('');
  async function load() { setErr(''); const { data, error } = await supabase.from('site_banners').select('*').order('placement').order('sort_order').order('created_at', { ascending: false }); if (error) setErr(error.message); setRows((data || []) as SiteBanner[]); }
  useEffect(() => { load(); }, []);
  async function upsertSlot(e: FormEvent<HTMLFormElement>, placement: BannerPlacement, slot: number, row: SiteBanner | null) {
    e.preventDefault(); const form = e.currentTarget as HTMLFormElement; const fd = new FormData(form); const file = fd.get('file') as File | null; const key = `${placement}-${slot}`;
    if ((!file || !file.name) && !row?.image_url) { setErr(`Vui lòng chọn ảnh cho ${PLACEMENTS.find((p) => p.id === placement)?.label || placement} · Banner ${slot}.`); return; }
    setBusyKey(key); setErr(''); setMsg('');
    try {
      let image_url = row?.image_url || ''; let image_path = row?.image_path || null;
      if (file && file.name) { const uploaded = await uploadSiteBannerImage(file, placement); image_url = uploaded.publicUrl; image_path = uploaded.path; if (row?.image_path && row.image_path !== uploaded.path) await supabase.storage.from('site-banners').remove([row.image_path]).catch(() => undefined); }
      const payload = { placement, title: String(fd.get('title') || row?.title || `Banner ${slot}`), image_url, image_path, link_url: String(fd.get('link_url') || '').trim() || null, sort_order: slot, lang_mode: String(fd.get('lang_mode') || 'both'), starts_at: String(fd.get('starts_at') || dateIn(0)), ends_at: String(fd.get('ends_at') || '') || null, active: fd.get('active') === 'on', updated_at: new Date().toISOString() };
      const { error } = row?.id ? await supabase.from('site_banners').update(payload).eq('id', row.id) : await supabase.from('site_banners').insert(payload);
      if (error) throw error; form.reset(); setMsg(`Đã lưu ${PLACEMENTS.find((p) => p.id === placement)?.label || placement} · Banner ${slot}.`); await load();
    } catch (error: any) { setErr(error?.message || 'Upload/lưu banner thất bại.'); } finally { setBusyKey(''); }
  }
  async function remove(row: SiteBanner) { if (!window.confirm('Xóa banner này?')) return; if (row.image_path) await supabase.storage.from('site-banners').remove([row.image_path]).catch(() => undefined); const { error } = await supabase.from('site_banners').delete().eq('id', row.id); setErr(error?.message || ''); setMsg(error ? '' : 'Đã xóa banner.'); if (!error) await load(); }
  return <div className="d68-banner-admin"><CardTitle title="Quản trị Banner" note="Upload theo từng vị trí banner để dễ kiểm soát: Hero 1-5, Home Promotion 1-2, Listing Promotion 1-2. Có thể gắn link hoặc để trống nếu không muốn bấm được." />{msg ? <div className="d68-admin-notice ok">{msg}</div> : null}{err ? <div className="d68-admin-notice err">{err}</div> : null}{busyKey ? <div className="d68-admin-notice warn">Đang xử lý {busyKey}...</div> : null}{PLACEMENTS.map((p) => <div key={p.id} className="d68-admin-card d68-banner-admin__section"><h3>{p.label}</h3><p className="d68-admin-subtle">{p.note}</p><div className="d68-banner-slot-grid">{Array.from({ length: p.slotCount }).map((_, idx) => { const slot = idx + 1; const row = firstSlotRow(rows, p.id, slot); const key = `${p.id}-${slot}`; return <form key={key} onSubmit={(e) => upsertSlot(e, p.id, slot, row)} className="d68-banner-slot-card"><div className="d68-banner-slot-card__media">{row?.image_url ? <img src={row.image_url} alt={row.title || `Banner ${slot}`} /> : <span>Banner {slot}<small>{p.size}</small></span>}</div><div className="d68-banner-slot-card__body"><h4>{p.label} · Banner {slot}</h4><label className="d68-admin-field"><span>Tên banner</span><input name="title" className="d68-admin-input" defaultValue={row?.title || `Banner ${slot}`} /></label><label className="d68-admin-field"><span>URL/Link nếu có</span><input name="link_url" className="d68-admin-input" defaultValue={row?.link_url || ''} placeholder="/pricing hoặc https://..." /></label><div className="d68-admin-form2"><label className="d68-admin-field"><span>Hiển thị</span><select name="lang_mode" defaultValue={row?.lang_mode || 'both'} className="d68-admin-input"><option value="both">VN + EN</option><option value="vi">Chỉ VN</option><option value="en">Chỉ EN</option></select></label><label className="d68-admin-field"><span>Trạng thái</span><label className="d68-admin-check d68-banner-active"><input name="active" type="checkbox" defaultChecked={row?.active !== false}/> Đang hiển thị</label></label><label className="d68-admin-field"><span>Từ ngày</span><input name="starts_at" type="date" defaultValue={row?.starts_at || dateIn(0)} className="d68-admin-input"/></label><label className="d68-admin-field"><span>Đến ngày</span><input name="ends_at" type="date" defaultValue={row?.ends_at || dateIn(60)} className="d68-admin-input"/></label></div><label className="d68-admin-field"><span>{row ? 'Thay ảnh banner' : 'Upload ảnh banner'}</span><input name="file" type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="d68-admin-input" required={!row}/></label><div className="d68-admin-actions"><button className="d68-admin-btn green" disabled={!!busyKey}>{row ? 'Lưu / Thay ảnh' : 'Upload banner'}</button>{row ? <button type="button" className="d68-admin-btn red" onClick={() => remove(row)}>Xóa</button> : null}</div></div></form>; })}</div></div>)}</div>;
}
function CardTitle({ title, note }: { title: string; note: string }) { return <div className="d68-admin-card"><h2>{title}</h2><p>{note}</p></div>; }
