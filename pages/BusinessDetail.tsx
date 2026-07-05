import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { getBusinessBySlug, getBusinessDetailAssets, getInvestorByOwner, listBusinesses } from '../lib/data';
import { formatCompactMoney, percent } from '../lib/format';
import { useAuth } from '../contexts/AuthContext';
import type { Lang } from '../lib/i18n';
import { localizedPath } from '../lib/i18nRoutes';

/**
 * Business Detail (/businesses/:slug) — port theo ui-reference/Deals68 Business Detail.dc.html.
 * SPEC v1.3 guardrails:
 * - Chỉ đọc business public qua getBusinessBySlug(): visible=true, status=active, public_snapshot_json is not null.
 * - Chỉ đọc assets publicOnly: files không lộ file_path; images public_visible + is_sanitized.
 * - Không dùng username/fallback private route; không render private company/contact fields.
 * - Không fabricate dữ liệu; field thiếu hiển thị empty/locked state production-safe.
 */

const T = (lang: Lang, vi: string, en: string) => (lang === 'en' ? en : vi);

type Doc = { id?: string; file_name?: string; display_name?: string; file_type?: string; size_bytes?: number; category?: string; privacy_level?: string; created_at?: string };
type Img = { id?: string; public_url?: string; display_title?: string; title?: string; is_hero?: boolean };
type SimilarDeal = { id: string; slug: string; title: string; industry: string; city: string; revenue: string; ask: string; image: string | null };
type FactRow = { label: string; value: string };

function cleanText(value: any) {
  return String(value || '').trim();
}

function lines(value: any): string[] {
  if (Array.isArray(value)) return value.filter(Boolean).map(String).map((x) => x.trim()).filter(Boolean);
  return String(value || '').split(/\n|;/).map((x) => x.trim()).filter(Boolean);
}

function money(lang: Lang, value: any, currency: string) {
  return Number(value || 0) > 0 ? formatCompactMoney(value, currency || 'VND') : T(lang, 'Đang cập nhật', 'Pending');
}

function qualityLabel(lang: Lang, value: any) {
  const n = Number(value);
  if (!Number.isFinite(n) || value === null || value === undefined || value === '') return T(lang, 'Đang cập nhật', 'Pending');
  return `${Math.round(n)}/100`;
}

function qualityShort(value: any) {
  const n = Number(value);
  if (!Number.isFinite(n) || value === null || value === undefined || value === '') return null;
  return `${Math.round(n / 10).toFixed(1)} / 10`;
}

function fileExt(doc: Doc) {
  const name = doc.file_name || doc.display_name || '';
  const fromName = name.includes('.') ? name.split('.').pop() : '';
  const fromType = String(doc.file_type || '').split('/').pop();
  return String(fromName || fromType || 'file').slice(0, 5).toUpperCase();
}

function fileSize(bytes?: number) {
  const n = Number(bytes || 0);
  if (!n) return '';
  if (n > 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  if (n > 1024) return `${Math.round(n / 1024)} KB`;
  return `${n} B`;
}

function primaryIndustry(raw: any) {
  return cleanText(raw).split(';').map((x) => x.trim()).filter(Boolean)[0] || '';
}

function dealKind(raw: any): 'asset' | 'fundraise' | 'loan' | 'partner' | 'sale' | 'other' {
  const v = String(raw || '').toLowerCase();
  if (v.includes('asset')) return 'asset';
  if (v.includes('loan') || v.includes('debt') || v.includes('vay')) return 'loan';
  if (v.includes('jv') || v.includes('joint') || v.includes('partner') || v.includes('đối tác')) return 'partner';
  if (v.includes('fund') || v.includes('raise') || v.includes('invest') || v.includes('equity') || v.includes('gọi') || v.includes('vốn')) return 'fundraise';
  if (v.includes('sale') || v.includes('transfer') || v.includes('m&a') || v.includes('acquisition') || v.includes('bán') || v.includes('chuyển')) return 'sale';
  return 'other';
}

function dealLabel(lang: Lang, raw: any) {
  const kind = dealKind(raw);
  const fallback = cleanText(raw) || T(lang, 'Đang cập nhật', 'Pending');
  const labels: Record<typeof kind, { vi: string; en: string }> = {
    asset: { vi: 'Chuyển nhượng tài sản', en: 'Asset transfer' },
    fundraise: { vi: 'Gọi vốn / Đầu tư', en: 'Fundraising / Investment' },
    loan: { vi: 'Vay vốn', en: 'Business loan' },
    partner: { vi: 'JV / Đối tác', en: 'JV / Partnership' },
    sale: { vi: 'M&A / Chuyển nhượng', en: 'M&A / Business sale' },
    other: { vi: fallback, en: fallback }
  };
  return T(lang, labels[kind].vi, labels[kind].en);
}

function askLabel(lang: Lang, raw: any) {
  const kind = dealKind(raw);
  if (kind === 'asset' || kind === 'sale') return T(lang, 'Giá chào', 'Asking price');
  if (kind === 'loan') return T(lang, 'Nhu cầu vay', 'Loan sought');
  if (kind === 'partner') return T(lang, 'Quy mô hợp tác', 'Partnership scope');
  return T(lang, 'Nhu cầu vốn', 'Capital sought');
}

function normalizeSimilar(row: any, lang: Lang): SimilarDeal | null {
  const slug = cleanText(row.slug);
  if (!slug) return null;
  const title = T(lang, row.title_vi || row.public_code || 'Hồ sơ doanh nghiệp ẩn danh', row.title_en || row.title_vi || row.public_code || 'Anonymous business profile');
  return {
    id: String(row.id || slug),
    slug,
    title,
    industry: primaryIndustry(row.industry) || T(lang, 'Đang cập nhật', 'Pending'),
    city: cleanText(row.city) || cleanText(row.country_iso2) || 'VN',
    revenue: money(lang, row.revenue_2025, row.revenue_currency || 'VND'),
    ask: money(lang, row.ask_amount, row.ask_currency || row.revenue_currency || 'VND'),
    image: row.image_url || row.hero_image_url || null
  };
}

export default function BusinessDetail({ lang }: { lang: Lang }) {
  const { slug = '' } = useParams();
  const to = (path: string) => localizedPath(path, lang);
  const { profile } = useAuth();
  const navigate = useNavigate();

  const [business, setBusiness] = useState<any>(null);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [images, setImages] = useState<Img[]>([]);
  const [similar, setSimilar] = useState<SimilarDeal[]>([]);
  const [activeImage, setActiveImage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    let live = true;

    async function load() {
      setLoading(true);
      setError('');
      setMsg('');
      setBusiness(null);
      setDocs([]);
      setImages([]);
      setSimilar([]);
      setActiveImage(0);

      try {
        const b = await getBusinessBySlug(slug);
        if (!live) return;

        if (!b) {
          setError(T(lang, 'Không tìm thấy hồ sơ doanh nghiệp hoặc hồ sơ chưa được Admin duyệt công khai.', 'Business profile not found or not approved for public display.'));
          return;
        }

        setBusiness(b);

        const assets = await getBusinessDetailAssets(b.id, { publicOnly: true }).catch(() => ({ files: [], images: [] }));
        if (!live) return;
        setDocs((assets.files || []) as Doc[]);
        setImages((assets.images || []) as Img[]);

        const industry = primaryIndustry(b.industry);
        const related = await listBusinesses({ limit: 4, industry: industry || undefined, sort: 'featured' }).catch(() => []);
        if (!live) return;
        setSimilar((related || [])
          .map((row: any) => normalizeSimilar(row, lang))
          .filter((row: SimilarDeal | null): row is SimilarDeal => !!row && row.slug !== b.slug)
          .slice(0, 3));
      } catch (e: any) {
        if (live) setError(e?.message || T(lang, 'Không tải được hồ sơ.', 'Could not load profile.'));
      } finally {
        if (live) setLoading(false);
      }
    }

    load();
    return () => { live = false; };
  }, [slug, lang]);

  const title = useMemo(() => {
    if (!business) return '';
    return T(lang, business.title_vi || business.public_code || 'Hồ sơ doanh nghiệp ẩn danh', business.title_en || business.title_vi || business.public_code || 'Anonymous business profile');
  }, [business, lang]);

  const description = useMemo(() => {
    if (!business) return '';
    return T(
      lang,
      business.description_vi || business.highlights_vi || 'Hồ sơ công khai đang được Admin cập nhật.',
      business.description_en || business.description_vi || 'The public profile is being updated by Admin.'
    );
  }, [business, lang]);

  const highlights = useMemo(() => {
    if (!business) return [];
    return lines(lang === 'vi' ? business.highlights_vi : (business.highlights_en || business.highlights_vi));
  }, [business, lang]);

  const profileBullets = useMemo(() => {
    if (!business) return [];
    const investmentReason = lines(lang === 'vi' ? business.investment_reason_vi : (business.investment_reason_en || business.investment_reason_vi));
    const descLines = lines(lang === 'vi' ? business.description_vi : (business.description_en || business.description_vi));
    return [...descLines, ...investmentReason].filter(Boolean);
  }, [business, lang]);

  const heroImages = useMemo(() => {
    const approved = images
      .filter((img) => cleanText(img.public_url))
      .map((img) => ({ url: cleanText(img.public_url), title: img.display_title || img.title || '', isHero: !!img.is_hero }));
    const fallbackUrl = business?.hero_image_url || business?.image_url;
    const fallback = fallbackUrl ? [{ url: String(fallbackUrl), title, isHero: true }] : [];
    const merged = [...approved, ...fallback].filter((img, idx, arr) => img.url && arr.findIndex((x) => x.url === img.url) === idx);
    return merged.sort((a, b) => Number(b.isHero) - Number(a.isHero));
  }, [images, business, title]);

  const activeHero = heroImages[activeImage] || heroImages[0];
  const dealTypeLabel = business ? dealLabel(lang, business.deal_type) : '';
  const ask = business ? money(lang, business.ask_amount, business.ask_currency || business.revenue_currency || 'VND') : '';
  const revenue = business ? money(lang, business.revenue_2025, business.revenue_currency || 'VND') : '';
  const stake = business?.stake_pct === null || business?.stake_pct === undefined ? T(lang, 'Đang cập nhật', 'Pending') : percent(business.stake_pct);
  const quality = business ? qualityLabel(lang, business.quality_score) : '';
  const qualityRating = business ? qualityShort(business.quality_score) : null;
  const industry = business ? primaryIndustry(business.industry) || T(lang, 'Đang cập nhật', 'Pending') : '';
  const location = business ? (cleanText(business.city) || cleanText(business.country_iso2) || T(lang, 'Đang cập nhật', 'Pending')) : '';

  const facts: FactRow[] = business ? [
    { label: T(lang, 'Mã hồ sơ', 'Profile code'), value: business.public_code || business.slug || '—' },
    { label: T(lang, 'Ngành', 'Industry'), value: industry },
    { label: T(lang, 'Địa điểm', 'Location'), value: location },
    { label: T(lang, 'Loại giao dịch', 'Transaction'), value: dealTypeLabel },
    { label: T(lang, 'Doanh thu năm', 'Annual revenue'), value: revenue },
    { label: 'EBITDA', value: business.ebitda_margin === null || business.ebitda_margin === undefined ? T(lang, 'Đang cập nhật', 'Pending') : percent(business.ebitda_margin) },
    { label: askLabel(lang, business.deal_type), value: ask },
    { label: T(lang, 'Tỷ lệ cổ phần', 'Stake'), value: stake },
    { label: 'Business Quality Score', value: quality },
    { label: T(lang, 'Phiên bản public', 'Public version'), value: business.public_version ? `v${business.public_version}` : 'v1' }
  ] : [];

  const financialRows = business ? [
    { label: T(lang, 'Doanh thu', 'Revenue'), y1: '—', y2: '—', y3: revenue },
    { label: 'EBITDA', y1: '—', y2: '—', y3: business.ebitda_margin === null || business.ebitda_margin === undefined ? '—' : percent(business.ebitda_margin) },
    { label: askLabel(lang, business.deal_type), y1: '—', y2: '—', y3: ask },
    { label: T(lang, 'Tỷ lệ cổ phần', 'Stake offered'), y1: '—', y2: '—', y3: business.stake_pct === null || business.stake_pct === undefined ? '—' : percent(business.stake_pct) }
  ] : [];

  const publicDocs = docs.filter((doc) => doc.privacy_level === 'public');
  const lockedDocs = docs.filter((doc) => doc.privacy_level !== 'public');

  async function expressInterest() {
    if (!profile) {
      navigate(to(`/login?next=${encodeURIComponent(to(`/businesses/${slug}`))}`));
      return;
    }
    if (profile.role !== 'investor') {
      setMsg(T(lang, 'Chỉ tài khoản Nhà đầu tư được bày tỏ quan tâm.', 'Only Investor accounts can express interest.'));
      return;
    }

    const inv = await getInvestorByOwner(profile.id).catch(() => null);
    if (!inv?.id || !business?.id) {
      setMsg(T(lang, 'Không tìm thấy hồ sơ nhà đầu tư.', 'Investor profile not found.'));
      return;
    }

    let upErr: any = null;
    try {
      const rpcRes = await supabase.rpc('express_investor_interest', {
        investor_uuid: inv.id,
        business_uuid: business.id,
        interest_note: 'Expressed from public business detail page.'
      });
      upErr = rpcRes.error;
    } catch (err: any) {
      upErr = err;
    }

    if (upErr) {
      const fallback = await supabase
        .from('investor_interests')
        .upsert({ investor_id: inv.id, business_id: business.id, status: 'pending' }, { onConflict: 'investor_id,business_id' });
      upErr = fallback.error;
    }

    setMsg(upErr ? upErr.message : T(lang, 'Đã ghi nhận quan tâm. Admin/Doanh nghiệp sẽ duyệt kết nối trước khi mở thêm dữ liệu.', 'Interest recorded. Admin/Business approval is required before additional data unlocks.'));
  }

  async function requestData() {
    if (!profile) {
      navigate(to(`/login?next=${encodeURIComponent(to(`/businesses/${slug}`))}`));
      return;
    }
    if (profile.role !== 'investor') {
      setMsg(T(lang, 'Chỉ tài khoản Nhà đầu tư được yêu cầu tài liệu.', 'Only Investor accounts can request documents.'));
      return;
    }

    const inv = await getInvestorByOwner(profile.id).catch(() => null);
    if (!inv?.id || !business?.id) {
      setMsg(T(lang, 'Không tìm thấy hồ sơ nhà đầu tư.', 'Investor profile not found.'));
      return;
    }

    const { error: reqErr } = await supabase.from('request_data').insert({
      investor_id: inv.id,
      business_id: business.id,
      requested_items: ['IM', 'Financials'],
      note: 'Requested from public business detail page.',
      status: 'requested'
    });
    setMsg(reqErr ? reqErr.message : T(lang, 'Đã gửi yêu cầu tài liệu qua Deals68.', 'Data request sent via Deals68.'));
  }

  function sharePage() {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    if (!url) return;
    if (navigator.share) {
      navigator.share({ title, url }).catch(() => undefined);
      return;
    }
    navigator.clipboard?.writeText(url).then(() => setMsg(T(lang, 'Đã copy liên kết hồ sơ.', 'Profile link copied.'))).catch(() => undefined);
  }

  if (loading) {
    return <main className="d68-business-detail-page"><div className="d68-detail-shell"><div className="d68-detail-loading">{T(lang, 'Đang tải bản public đã duyệt...', 'Loading approved public profile...')}</div></div></main>;
  }

  if (error || !business) {
    return (
      <main className="d68-business-detail-page">
        <div className="d68-detail-shell d68-detail-shell--narrow">
          <div className="d68-detail-empty">
            <h1>{T(lang, 'Không hiển thị được hồ sơ', 'Profile unavailable')}</h1>
            <p>{error}</p>
            <Link to={to('/businesses')}>← {T(lang, 'Quay lại danh sách', 'Back to businesses')}</Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="d68-business-detail-page">
      <div className="d68-detail-shell">
        <nav className="d68-detail-breadcrumb">
          <Link to={to('/')}>{T(lang, 'Trang chủ', 'Home')}</Link><span>›</span>
          <Link to={to('/businesses')}>{T(lang, 'Doanh nghiệp', 'Businesses')}</Link><span>›</span>
          <Link to={to(`/businesses?industry=${encodeURIComponent(industry)}`)}>{industry}</Link><span>›</span>
          <b>{business.public_code || business.slug}</b>
        </nav>

        <div className="d68-detail-cols">
          <div className="d68-detail-main">
            <div className="d68-detail-status-row">
              <span className="d68-detail-status d68-detail-status--active"><i />{T(lang, 'Đang hiển thị', 'Active')}</span>
              {business.plan === 'featured' ? <span className="d68-detail-status d68-detail-status--featured">★ {T(lang, 'Nổi bật', 'Featured')}</span> : null}
              <span className="d68-detail-status d68-detail-status--verified">✓ {T(lang, 'Bản public đã duyệt', 'Approved public version')}</span>
            </div>

            <h1 className="d68-detail-h1">{title}</h1>
            <p className="d68-detail-lead">{description}</p>

            <section className="d68-detail-image-card" aria-label={T(lang, 'Hình ảnh doanh nghiệp', 'Business images')}>
              <div className={`d68-detail-hero-media${activeHero?.url ? ' has-image' : ''}`}>
                {activeHero?.url ? <img src={activeHero.url} alt={activeHero.title || title} /> : <div className="d68-detail-anon-visual"><b>📷 {T(lang, 'Hồ sơ ẩn danh', 'Anonymous listing')}</b><span>{T(lang, 'Ảnh public đang chờ Admin duyệt', 'Public image pending Admin approval')}</span></div>}
                {heroImages.length > 1 ? <button type="button" className="d68-detail-slide d68-detail-slide--prev" onClick={() => setActiveImage((v) => (v <= 0 ? heroImages.length - 1 : v - 1))}>‹</button> : null}
                {heroImages.length > 1 ? <button type="button" className="d68-detail-slide d68-detail-slide--next" onClick={() => setActiveImage((v) => (v + 1) % heroImages.length)}>›</button> : null}
                <span className="d68-detail-slide-count">{heroImages.length ? `${activeImage + 1}/${heroImages.length}` : '0/0'}</span>
              </div>
              {heroImages.length > 1 ? <div className="d68-detail-thumbs">{heroImages.map((img, idx) => <button type="button" key={`${img.url}-${idx}`} className={idx === activeImage ? 'active' : ''} onClick={() => setActiveImage(idx)}><img src={img.url} alt={img.title || title} /></button>)}</div> : null}
            </section>

            <section className="d68-detail-facts" aria-label={T(lang, 'Thông tin chính', 'Key facts')}>
              {facts.map((fact) => <Fact key={fact.label} label={fact.label} value={fact.value} />)}
            </section>

            <InfoSection title={T(lang, 'Điểm nổi bật', 'Highlights')}>
              <BulletList items={highlights} empty={T(lang, 'Chưa có điểm nổi bật đã duyệt.', 'No approved highlights yet.')} />
            </InfoSection>

            <InfoSection title={T(lang, 'Hồ sơ doanh nghiệp', 'Business profile')}>
              <BulletList items={profileBullets} empty={T(lang, 'Chưa có mô tả chi tiết trong bản public.', 'No detailed public description yet.')} />
            </InfoSection>

            <InfoSection title={T(lang, 'Tài chính', 'Financials')}>
              <div className="d68-detail-table-wrap">
                <table className="d68-detail-financials">
                  <thead><tr><th>{T(lang, 'Chỉ tiêu', 'Metric')}</th><th>2023</th><th>2024</th><th>2025</th></tr></thead>
                  <tbody>{financialRows.map((row) => <tr key={row.label}><td>{row.label}</td><td>{row.y1}</td><td>{row.y2}</td><td>{row.y3}</td></tr>)}</tbody>
                </table>
              </div>
              <p className="d68-detail-note">{T(lang, 'Dấu “—” nghĩa là chưa có số liệu được Admin duyệt public. Không tự suy đoán số liệu thiếu.', 'A “—” means no Admin-approved public value is available. Missing data is not inferred.')}</p>
            </InfoSection>

            <InfoSection title={T(lang, 'Tài liệu', 'Documents')} badge={`🔒 ${T(lang, 'Mở khóa sau kết nối', 'Unlocks after connection')}`}>
              <DocList docs={publicDocs} title={T(lang, 'Công khai', 'Public')} empty={T(lang, 'Chưa có file công khai đã duyệt.', 'No approved public files yet.')} />
              <DocList docs={lockedDocs} title={T(lang, 'Khóa sau kết nối/NDA', 'Locked after connection/NDA')} empty={T(lang, 'Chưa có file khóa đã duyệt.', 'No approved locked files yet.')} locked />
            </InfoSection>

            <p className="d68-detail-disclaimer"><b>{T(lang, 'Miễn trừ trách nhiệm:', 'Disclaimer:')}</b> {T(lang, 'Deals68 là sàn kết nối bên bán với nhà đầu tư, người mua, bên cho vay và cố vấn. Thông tin là teaser public đã duyệt và không thay thế thẩm định độc lập trước giao dịch.', 'Deals68 is a marketplace connecting sell-sides with investors, buyers, lenders and advisors. This is an approved public teaser and does not replace independent due diligence before any transaction.')}</p>
          </div>

          <aside className="d68-detail-side">
            <div className="d68-detail-summary-card">
              <div className="d68-detail-summary-head">
                <span>{T(lang, 'Loại giao dịch', 'Transaction')}</span>
                <strong>{dealTypeLabel}</strong>
              </div>
              <div className="d68-detail-summary-body">
                <span>{askLabel(lang, business.deal_type)}</span>
                <b>{ask}</b>
                <small>{business.ask_currency || business.revenue_currency ? `${T(lang, 'Tiền tệ', 'Currency')}: ${business.ask_currency || business.revenue_currency}` : T(lang, 'Tiền tệ đang cập nhật', 'Currency pending')}</small>
                <div className="d68-detail-mini-metrics">
                  <div><span>{T(lang, 'Doanh thu', 'Revenue')}</span><b>{revenue}</b></div>
                  <div><span>{T(lang, 'Cổ phần', 'Stake')}</span><b>{stake}</b></div>
                  <div><span>{T(lang, 'Xếp hạng Deals68', 'Deals68 rating')}</span><b>{qualityRating || quality}</b></div>
                </div>
              </div>
            </div>

            <div className="d68-detail-contact-card">
              <h2>{T(lang, 'Kết nối với doanh nghiệp', 'Connect with the business')}</h2>
              <p>{T(lang, 'Tên, số điện thoại, email và tài liệu nhạy cảm chỉ mở sau khi hai bên được duyệt kết nối.', 'Name, phone, email and sensitive documents unlock only after an approved connection.')}</p>
              <LockedField label={T(lang, 'Tên doanh nghiệp', 'Business name')} masked="••••••" />
              <LockedField label="Email" masked="••••••" />
              <LockedField label={T(lang, 'Điện thoại', 'Phone')} masked="••••••" />
              <button type="button" className="d68-detail-primary" onClick={expressInterest}>{T(lang, 'Bày tỏ quan tâm', 'Express interest')}</button>
              <div className="d68-detail-secondary-row">
                <button type="button" onClick={requestData}>🔒 {T(lang, 'Yêu cầu tài liệu', 'Request data')}</button>
                <button type="button" onClick={sharePage}>↗ {T(lang, 'Chia sẻ', 'Share')}</button>
              </div>
              {msg ? <div className="d68-detail-msg">{msg}</div> : null}
            </div>

            <div className="d68-detail-verify-card">
              <h3>{T(lang, 'Đã xác minh', 'Verified')}</h3>
              <div>
                <span>✓ {T(lang, 'Bản public đã duyệt', 'Approved public snapshot')}</span>
                <span>✓ {T(lang, 'Hồ sơ ẩn danh', 'Anonymous profile')}</span>
                {heroImages.length ? <span>✓ {T(lang, 'Ảnh public đã duyệt', 'Approved public images')}</span> : null}
                {qualityRating ? <span>✓ {T(lang, 'Có điểm chất lượng', 'Quality scored')}</span> : null}
              </div>
              <p>{T(lang, 'Public page chỉ dùng dữ liệu active/visible/approved; thay đổi mới từ user cần Admin duyệt trước khi hiển thị.', 'This public page only uses active/visible/approved data; user edits require Admin approval before display.')}</p>
            </div>
          </aside>
        </div>
      </div>

      <section className="d68-detail-similar-band">
        <div className="d68-detail-shell">
          <div className="d68-detail-section-head">
            <h2>{T(lang, 'Xem doanh nghiệp tương tự', 'Similar businesses')}</h2>
            <Link to={to(`/businesses?industry=${encodeURIComponent(industry)}`)}>{T(lang, 'Xem tất cả cùng ngành', 'View all in this sector')} →</Link>
          </div>
          {similar.length ? <div className="d68-detail-sim-grid">{similar.map((deal, idx) => <SimilarCard key={deal.id} deal={deal} idx={idx} lang={lang} />)}</div> : <div className="d68-detail-sim-empty">{T(lang, 'Chưa có hồ sơ tương tự đang hiển thị.', 'No similar public listings are currently available.')}</div>}
        </div>
      </section>

      <section className="d68-detail-faq-band">
        <div className="d68-detail-faq-inner">
          <h2>{T(lang, 'Câu hỏi thường gặp', 'Frequently asked questions')}</h2>
          <Faq q={T(lang, 'Tôi có xem được tên doanh nghiệp thật không?', 'Can I see the real company name?')} a={T(lang, 'Không trên trang public. Tên thật và thông tin liên hệ chỉ mở theo quy trình kết nối/NDA được duyệt.', 'Not on the public page. Legal name and contacts unlock only through the approved connection/NDA workflow.')} />
          <Faq q={T(lang, 'Số liệu tài chính có được đảm bảo không?', 'Are the financials guaranteed?')} a={T(lang, 'Đây là teaser public đã duyệt hiển thị và không thay thế thẩm định độc lập. Nhà đầu tư cần kiểm tra dữ liệu trong giai đoạn due diligence.', 'This is an approved public teaser and does not replace independent due diligence. Investors should verify data during diligence.')} />
          <Faq q={T(lang, 'Làm sao yêu cầu thêm tài liệu?', 'How do I request more documents?')} a={T(lang, 'Đăng nhập bằng tài khoản nhà đầu tư, bày tỏ quan tâm hoặc gửi yêu cầu tài liệu ngay trên trang này.', 'Log in with an investor account, express interest or request documents from this page.')} />
        </div>
      </section>
    </main>
  );
}

function InfoSection({ title, badge, children }: { title: string; badge?: string; children: ReactNode }) {
  return <section className="d68-detail-card"><div className="d68-detail-card-head"><h2>{title}</h2>{badge ? <span>{badge}</span> : null}</div>{children}</section>;
}

function BulletList({ items, empty }: { items: string[]; empty: string }) {
  if (!items.length) return <p className="d68-detail-muted">{empty}</p>;
  return <ul className="d68-detail-bullets">{items.map((item, idx) => <li key={`${item}-${idx}`}>{item}</li>)}</ul>;
}

function Fact({ label, value }: FactRow) {
  return <div className="d68-detail-fact"><span>{label}</span><b>{value}</b></div>;
}

function DocList({ docs, title, empty, locked = false }: { docs: Doc[]; title: string; empty: string; locked?: boolean }) {
  return (
    <div className="d68-detail-doc-group">
      <h3>{title}</h3>
      {docs.length ? <div className="d68-detail-doc-list">{docs.map((doc) => <div key={doc.id || doc.file_name || doc.display_name} className="d68-detail-doc-row"><span>{fileExt(doc)}</span><div><b>{doc.display_name || doc.file_name || doc.category || 'Document'}</b><small>{doc.category || 'document'}{fileSize(doc.size_bytes) ? ` · ${fileSize(doc.size_bytes)}` : ''}</small></div><em>{locked ? '🔒' : '✓'}</em></div>)}</div> : <p className="d68-detail-muted">{empty}</p>}
    </div>
  );
}

function LockedField({ label, masked }: { label: string; masked: string }) {
  return <div className="d68-detail-locked"><span>🔒</span><b>{label}</b><em>{masked}</em></div>;
}

function SimilarCard({ deal, idx, lang }: { deal: SimilarDeal; idx: number; lang: Lang }) {
  return (
    <Link to={to(`/businesses/${deal.slug}`)} className="d68-detail-sim-card">
      <div className={`d68-detail-sim-media d68-detail-sim-media--${(idx % 6) + 1}`}>{deal.image ? <img src={deal.image} alt={deal.title} /> : <span>🔒 {T(lang, 'Ẩn danh', 'Anonymous')}</span>}<b>{deal.city}</b></div>
      <div>
        <span>{deal.industry}</span>
        <h3>{deal.title}</h3>
        <footer><div><small>{T(lang, 'Doanh thu', 'Revenue')}</small><strong>{deal.revenue}</strong></div><div><small>{T(lang, 'Nhu cầu', 'Ask')}</small><strong>{deal.ask}</strong></div></footer>
      </div>
    </Link>
  );
}

function Faq({ q, a }: { q: string; a: string }) {
  return <article className="d68-detail-faq"><h3>{q}</h3><p>{a}</p></article>;
}
