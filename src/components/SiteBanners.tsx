
import { FormEvent, useEffect, useMemo, useState } from 'react';
import type { Lang } from '../lib/i18n';
import { supabase } from '../lib/supabase';
import { bannerMatchesLang, listSiteBanners, uploadSiteBannerImage, type BannerPlacement, type SiteBanner } from '../lib/banners';

const T = (lang: Lang, vi: string, en: string) => (lang === 'en' ? en : vi);

const PLACEMENTS: { id: BannerPlacement; label: string; note: string }[] = [
  { id: 'home_hero', label: 'Trang chủ Hero', note: 'Slider 1-5 ảnh, khuyến nghị 1600×800px.' },
  { id: 'home_promotion', label: 'Trang chủ Promotion', note: 'Banner 1-2 ảnh, khuyến nghị 1600×550px.' },
  { id: 'listing_promotion', label: 'Trang danh sách Promotion', note: 'Dùng dưới danh sách Business/Investor, khuyến nghị 1600×550px.' },
];

function svgData(title: string, subtitle: string, bg1: string, bg2: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="800" viewBox="0 0 1600 800"><defs><linearGradient id="g" x1="0" x2="1"><stop offset="0" stop-color="${bg1}"/><stop offset="1" stop-color="${bg2}"/></linearGradient></defs><rect width="1600" height="800" fill="url(#g)"/><circle cx="1300" cy="140" r="230" fill="rgba(255,255,255,.18)"/><circle cx="1220" cy="620" r="320" fill="rgba(242,181,29,.20)"/><rect x="90" y="90" width="640" height="420" rx="28" fill="rgba(255,255,255,.12)"/><text x="120" y="180" font-family="Arial, sans-serif" font-size="54" font-weight="800" fill="white">${title}</text><text x="120" y="250" font-family="Arial, sans-serif" font-size="28" font-weight="600" fill="rgba(255,255,255,.82)">${subtitle}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

const HERO_FALLBACKS = [
  svgData('Deals68.com', 'Vietnam businesses meet global investors', '#0F2A4A', '#1596cc'),
  svgData('Capital · M&A · Lending', 'Anonymous public profiles, approved connections', '#14315A', '#16A34A'),
];

const PROMO_FALLBACK = svgData('Deals68 Beta', 'Promotion banner placeholder — upload real banner in Admin', '#F2B51D', '#1BADEA');

function normalizeUrl(url?: string | null) {
  return String(url || '').trim();
}

function BannerImg({ src, alt, fallback, className }: { src?: string | null; alt: string; fallback: string; className?: string }) {
  const [current, setCurrent] = useState(normalizeUrl(src) || fallback);
  useEffect(() => setCurrent(normalizeUrl(src) || fallback), [src, fallback]);
  return <img className={className} src={current} alt={alt} onError={() => setCurrent(fallback)} />;
}

function MaybeLink({ href, className, children }: { href?: string | null; className?: string; children: React.ReactNode }) {
  const clean = normalizeUrl(href);
  if (!clean) return <div className={className}>{children}</div>;
  return <a className={className} href={clean} target={clean.startsWith('http') ? '_blank' : undefined} rel={clean.startsWith('http') ? 'noreferrer' : undefined}>{children}</a>;
}

export function HeroBannerSlider({ lang }: { lang: Lang }) {
  const [rows, setRows] = useState<SiteBanner[]>([]);
  const [active, setActive] = useState(0);

  useEffect(() => {
    let live = true;
    listSiteBanners('home_hero', lang).then((data) => { if (live) setRows(data.slice(0, 5)); }).catch(() => { if (live) setRows([]); });
    return () => { live = false; };
  }, [lang]);

  const slides = useMemo(() => rows.length ? rows : HERO_FALLBACKS.map((image_url, idx) => ({ id: `fallback-${idx}`, placement: 'home_hero' as BannerPlacement, title: `Demo ${idx + 1}`, image_url, link_url: null, sort_order: idx + 1, lang_mode: 'both' as const, active: true })), [rows]);

  useEffect(() => {
    if (slides.length <= 1) return;
    const timer = window.setInterval(() => setActive((cur) => (cur + 1) % slides.length), 5500);
    return () => window.clearInterval(timer);
  }, [slides.length]);

  return <div className="d68-hero-slider" aria-hidden="true">
    {slides.map((slide, idx) => <MaybeLink key={slide.id} href={slide.link_url} className={`d68-hero-slide${idx === active ? ' is-active' : ''}`}><BannerImg src={slide.image_url} fallback={HERO_FALLBACKS[idx % HERO_FALLBACKS.length]} alt={slide.title || 'Deals68 banner'} /></MaybeLink>)}
    {slides.length > 1 ? <div className="d68-hero-dots">{slides.map((slide, idx) => <button key={slide.id} type="button" aria-label={`Slide ${idx + 1}`} className={idx === active ? 'active' : ''} onClick={() => setActive(idx)} />)}</div> : null}
  </div>;
}

export function PromotionBanner({ placement, lang, className = '' }: { placement: 'home_promotion' | 'listing_promotion'; lang: Lang; className?: string }) {
  const [rows, setRows] = useState<SiteBanner[]>([]);
  useEffect(() => {
    let live = true;
    listSiteBanners(placement, lang).then((data) => { if (live) setRows(data); }).catch(() => { if (live) setRows([]); });
    return () => { live = false; };
  }, [placement, lang]);

  const banner = rows[0] || null;
  if (!banner) return null;
  return <section className={`d68-promo-banner ${className}`.trim()}><MaybeLink href={banner.link_url} className="d68-promo-banner__link"><BannerImg src={banner.image_url} fallback={PROMO_FALLBACK} alt={banner.title || 'Deals68 promotion'} /></MaybeLink></section>;
}

function dateIn(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function AdminBannerManager() {
  const [rows, setRows] = useState<SiteBanner[]>([]);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    setErr('');
    const { data, error } = await supabase.from('site_banners').select('*').order('placement').order('sort_order');
    if (error) setErr(error.message);
    setRows((data || []) as SiteBanner[]);
  }

  useEffect(() => { load(); }, []);

  async function upload(e: FormEvent<HTMLFormElement>, placement: BannerPlacement) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const file = fd.get('file') as File | null;
    if (!file || !file.name) { setErr('Vui lòng chọn ảnh banner.'); return; }
    setBusy(true); setErr(''); setMsg('');
    try {
      const uploaded = await uploadSiteBannerImage(file, placement);
      const { error } = await supabase.from('site_banners').insert({
        placement,
        title: String(fd.get('title') || file.name),
        image_url: uploaded.publicUrl,
        image_path: uploaded.path,
        link_url: String(fd.get('link_url') || '').trim() || null,
        sort_order: Number(fd.get('sort_order') || 1),
        lang_mode: String(fd.get('lang_mode') || 'both'),
        starts_at: String(fd.get('starts_at') || dateIn(0)),
        ends_at: String(fd.get('ends_at') || dateIn(60)),
        active: true
      });
      if (error) throw error;
      (e.currentTarget as HTMLFormElement).reset();
      setMsg('Đã upload banner.');
      await load();
    } catch (error: any) { setErr(error?.message || 'Upload banner failed.'); }
    finally { setBusy(false); }
  }

  async function save(row: SiteBanner, e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const patch = {
      title: String(fd.get('title') || '').trim() || null,
      link_url: String(fd.get('link_url') || '').trim() || null,
      sort_order: Number(fd.get('sort_order') || 1),
      lang_mode: String(fd.get('lang_mode') || 'both'),
      starts_at: String(fd.get('starts_at') || dateIn(0)),
      ends_at: String(fd.get('ends_at') || '') || null,
      active: fd.get('active') === 'on',
      updated_at: new Date().toISOString()
    };
    const { error } = await supabase.from('site_banners').update(patch).eq('id', row.id);
    setErr(error?.message || '');
    setMsg(error ? '' : 'Đã lưu banner.');
    if (!error) await load();
  }

  async function remove(row: SiteBanner) {
    if (!window.confirm('Xóa banner này?')) return;
    if (row.image_path) await supabase.storage.from('site-banners').remove([row.image_path]).catch(() => undefined);
    const { error } = await supabase.from('site_banners').delete().eq('id', row.id);
    setErr(error?.message || '');
    setMsg(error ? '' : 'Đã xóa banner.');
    if (!error) await load();
  }

  return <div className="d68-banner-admin">
    <CardTitle title="Quản trị Banner" note="Quản trị 3 vị trí: Trang chủ Hero, Trang chủ Promotion, Trang danh sách Promotion. Ảnh public sau khi Admin upload tại đây." />
    {msg ? <div className="d68-admin-notice ok">{msg}</div> : null}{err ? <div className="d68-admin-notice err">{err}</div> : null}{busy ? <div className="d68-admin-notice warn">Đang xử lý...</div> : null}
    {PLACEMENTS.map((p) => {
      const list = rows.filter((r) => r.placement === p.id).sort((a, b) => a.sort_order - b.sort_order);
      const defaultOrder = Math.min(5, list.length + 1);
      return <div key={p.id} className="d68-admin-card d68-banner-admin__section"><h3>{p.label}</h3><p className="d68-admin-subtle">{p.note}</p><form onSubmit={(e) => upload(e, p.id)} className="d68-admin-form4 d68-admin-form-gap"><input name="title" className="d68-admin-input" placeholder="Tên banner"/><input name="link_url" className="d68-admin-input" placeholder="URL/Link nếu có"/><input name="sort_order" type="number" min="1" max="5" defaultValue={defaultOrder} className="d68-admin-input"/><select name="lang_mode" defaultValue="both" className="d68-admin-input"><option value="both">VN + EN</option><option value="vi">Chỉ VN</option><option value="en">Chỉ EN</option></select><label className="d68-admin-field"><span>Từ ngày</span><input name="starts_at" type="date" defaultValue={dateIn(0)} className="d68-admin-input"/></label><label className="d68-admin-field"><span>Đến ngày</span><input name="ends_at" type="date" defaultValue={dateIn(60)} className="d68-admin-input"/></label><label className="d68-admin-field d68-admin-span2"><span>Ảnh banner</span><input name="file" type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="d68-admin-input" required/></label><button className="d68-admin-btn green" disabled={busy}>Upload banner</button></form><div className="d68-banner-admin__list">{list.map((row) => <form key={row.id} onSubmit={(e) => save(row, e)} className="d68-banner-admin__row"><img src={row.image_url} alt={row.title || 'banner'} /><div className="d68-banner-admin__edit"><div className="d68-admin-form4"><input name="title" defaultValue={row.title || ''} className="d68-admin-input"/><input name="link_url" defaultValue={row.link_url || ''} className="d68-admin-input"/><input name="sort_order" type="number" defaultValue={row.sort_order || 1} min="1" max="5" className="d68-admin-input"/><select name="lang_mode" defaultValue={row.lang_mode || 'both'} className="d68-admin-input"><option value="both">VN + EN</option><option value="vi">Chỉ VN</option><option value="en">Chỉ EN</option></select><input name="starts_at" type="date" defaultValue={row.starts_at || dateIn(0)} className="d68-admin-input"/><input name="ends_at" type="date" defaultValue={row.ends_at || ''} className="d68-admin-input"/><label className="d68-admin-check"><input name="active" type="checkbox" defaultChecked={row.active !== false}/> Hiển thị</label></div><div className="d68-admin-actions"><button className="d68-admin-btn green">Lưu</button><button type="button" className="d68-admin-btn red" onClick={() => remove(row)}>Xóa</button></div></div></form>)}{!list.length ? <div className="d68-admin-empty">Chưa có banner.</div> : null}</div></div>;
    })}
  </div>;
}

function CardTitle({ title, note }: { title: string; note: string }) {
  return <div className="d68-admin-card"><h2>{title}</h2><p>{note}</p></div>;
}
