import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { getBusinessBySlug, getBusinessDetailAssets, getInvestorByOwner, getMyBusiness, listBusinesses } from '../lib/data';
import { percent } from '../lib/format';
import { useAuth } from '../contexts/AuthContext';
import { formatMoneyForLang, labelIndustry, labelLocation } from '../lib/labels';
import type { Lang } from '../lib/i18n';
import { BusinessFaq } from '../components/BusinessFaq';
import { applySeo, DEFAULT_SOCIAL_IMAGE } from '../lib/seo';
import { businessQualityPublicExplanation, normalizeQualityBreakdown, qualityBand, qualityItemLabel, qualityItemNote, qualityPublicCriteria } from '../lib/businessQuality';

const T = (lang: Lang, vi: string, en: string) => (lang === 'en' ? en : vi);

type Doc = { id?: string; file_name?: string; display_name?: string; file_type?: string; size_bytes?: number; category?: string; privacy_level?: string; public_visible?: boolean; file_path?: string; created_at?: string };
type Img = { id?: string; public_url?: string; display_title?: string; title?: string; is_hero?: boolean };
type SimilarDeal = { id: string; slug: string; title: string; industry: string; city: string; revenue: string; ask: string; image: string | null };
type FactRow = { label: string; value: string };
type TransactionInfoRow = { label: string; value: string };

function cleanText(value: any) { return String(value || '').trim(); }
function objectOf(value: any) { return value && typeof value === 'object' && !Array.isArray(value) ? value : {}; }
function approvedFinancialInputOf(business: any) {
  const snapshot = objectOf(business?.public_snapshot_json);
  const snapshotFinancial = objectOf(snapshot.financial_input);
  return Object.keys(snapshotFinancial).length ? snapshotFinancial : objectOf(business?.financial_input);
}
function localizedApprovedText(lang: Lang, vi: any, en: any, legacy: any = '') {
  const value = lang === 'en'
    ? cleanText(en) || cleanText(vi) || cleanText(legacy)
    : cleanText(vi) || cleanText(legacy) || cleanText(en);
  return value;
}
function lines(value: any): string[] {
  if (Array.isArray(value)) return value.filter(Boolean).map(String).map((x) => x.trim()).filter(Boolean);
  return String(value || '').split(/\n|;/).map((x) => x.trim()).filter(Boolean);
}
function primaryIndustry(raw: any) { return cleanText(raw).split(';').map((x) => x.trim()).filter(Boolean)[0] || ''; }
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
function money(lang: Lang, value: any, currency: string) { return formatMoneyForLang(Number(value || 0), currency || 'VND', lang); }
function qualityLabel(lang: Lang, value: any) {
  const n = Number(value);
  if (!Number.isFinite(n) || value === null || value === undefined || value === '') return T(lang, 'Đang cập nhật', 'Pending');
  return `${Math.round(n)}/100`;
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
  return { id: String(row.id || slug), slug, title, industry: labelIndustry(primaryIndustry(row.industry), lang), city: labelLocation(row.city_key || row.city || row.country_iso2, lang), revenue: money(lang, row.revenue_2025, row.revenue_currency || 'VND'), ask: money(lang, row.ask_amount, row.ask_currency || row.revenue_currency || 'VND'), image: row.image_url || row.hero_image_url || null };
}
function inferredSelfValuation(b: any) {
  const stored = Number(b?.self_valuation || 0);
  if (stored > 0) return stored;
  const ask = Number(b?.ask_amount || 0);
  const stake = Number(b?.stake_pct || b?.offer_stake_pct || 0);
  return ask > 0 && stake > 0 ? ask / (stake / 100) : 0;
}

export default function BusinessDetail({ lang }: { lang: Lang }) {
  const { slug = '' } = useParams();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const homePath = lang === 'en' ? '/en' : '/';
  const businessListPath = lang === 'en' ? '/en/businesses' : '/businesses';
  const loginPath = lang === 'en' ? '/en/login' : '/login';
  const [business, setBusiness] = useState<any>(null);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [images, setImages] = useState<Img[]>([]);
  const [similar, setSimilar] = useState<SimilarDeal[]>([]);
  const [activeImage, setActiveImage] = useState(0);
  const [investorAccess, setInvestorAccess] = useState(false);
  const [isOwnerBusiness, setIsOwnerBusiness] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    let live = true;
    async function load() {
      setLoading(true); setError(''); setMsg(''); setInvestorAccess(false); setIsOwnerBusiness(false);
      setBusiness(null); setDocs([]); setImages([]); setSimilar([]); setActiveImage(0);
      try {
        const b = await getBusinessBySlug(slug);
        if (!live) return;
        if (!b) { setError(T(lang, 'Không tìm thấy hồ sơ doanh nghiệp hoặc hồ sơ chưa được Admin duyệt công khai.', 'Business profile not found or not approved for public display.')); return; }
        setBusiness(b);
        let ownerViewing = false;
        if (profile?.role === 'business') {
          const myBiz = await getMyBusiness(profile.id).catch(() => null);
          ownerViewing = !!myBiz?.id && myBiz.id === b.id;
          if (live) setIsOwnerBusiness(ownerViewing);
        }
        if (profile?.role === 'investor' || profile?.role === 'admin' || ownerViewing) {
          const { data: qrow } = await supabase
            .from('businesses')
            .select('quality_score,quality_breakdown_json,quality_breakdown')
            .eq('id', b.id)
            .maybeSingle()
            .catch(() => ({ data: null } as any));
          if (live && qrow) setBusiness({ ...b, quality_score: qrow.quality_score ?? b.quality_score, quality_breakdown_json: qrow.quality_breakdown_json ?? qrow.quality_breakdown });
        }

        let canDownload = false;
        if (profile?.role === 'investor') {
          const inv = await getInvestorByOwner(profile.id).catch(() => null);
          if (inv?.id) {
            const proposal = await supabase
              .from('proposals')
              .select('id,status')
              .eq('business_id', b.id)
              .eq('investor_id', inv.id)
              .in('status', ['approved','connected'])
              .limit(1)
              .maybeSingle()
              .catch(() => ({ data: null } as any));
            canDownload = !!proposal.data;
          }
        }
        if (!live) return;
        setInvestorAccess(canDownload);
        const assets = await getBusinessDetailAssets(b.id, { publicOnly: !(canDownload || ownerViewing) }).catch(() => ({ files: [], images: [] }));
        if (!live) return;
        setDocs((assets.files || []) as Doc[]);
        setImages((assets.images || []) as Img[]);

        const industry = primaryIndustry(b.industry);
        const related = await listBusinesses({ limit: 4, industry: industry || undefined, sort: 'featured' }).catch(() => []);
        if (!live) return;
        setSimilar((related || []).map((row: any) => normalizeSimilar(row, lang)).filter((row: SimilarDeal | null): row is SimilarDeal => !!row && row.slug !== b.slug).slice(0, 3));
      } catch (e: any) {
        if (live) setError(e?.message || T(lang, 'Không tải được hồ sơ.', 'Could not load profile.'));
      } finally { if (live) setLoading(false); }
    }
    load();
    return () => { live = false; };
  }, [slug, lang, profile?.id, profile?.role]);

  const title = useMemo(() => business ? T(lang, business.title_vi || business.public_code || 'Hồ sơ doanh nghiệp ẩn danh', business.title_en || business.title_vi || business.public_code || 'Anonymous business profile') : '', [business, lang]);
  const description = useMemo(() => business ? T(lang, business.description_vi || business.highlights_vi || 'Hồ sơ công khai đang được Admin cập nhật.', business.description_en || business.description_vi || 'The public profile is being updated by Admin.') : '', [business, lang]);
  const highlights = useMemo(() => business ? lines(lang === 'vi' ? business.highlights_vi : (business.highlights_en || business.highlights_vi)) : [], [business, lang]);
  const transactionInfo = useMemo<TransactionInfoRow[]>(() => {
    const financial = approvedFinancialInputOf(business);
    return [
      {
        label: T(lang, 'Tài sản hữu hình & vô hình DN sở hữu', 'Tangible & intangible assets owned by the business'),
        value: localizedApprovedText(
          lang,
          financial.assets_owned_vi,
          financial.assets_owned_en,
          financial.assets_owned,
        ),
      },
      {
        label: T(lang, 'Tài sản hữu hình thuộc sở hữu doanh nghiệp sẽ được đưa vào giao dịch', 'Tangible assets owned by the business that will be included in the transaction'),
        value: localizedApprovedText(
          lang,
          financial.included_tangible_assets_vi,
          financial.included_tangible_assets_en,
          financial.included_tangible_assets,
        ),
      },
      {
        label: T(lang, 'Lý do gọi vốn/chuyển nhượng', 'Fundraising / transfer rationale'),
        value: localizedApprovedText(
          lang,
          business?.investment_reason_vi || financial.investment_reason_vi,
          business?.investment_reason_en || financial.investment_reason_en,
          financial.investment_reason,
        ),
      },
    ].filter((item) => cleanText(item.value));
  }, [business, lang]);
  const heroImages = useMemo(() => {
    const approved = images.filter((img) => cleanText(img.public_url)).map((img) => ({ url: cleanText(img.public_url), title: img.display_title || img.title || '', isHero: !!img.is_hero }));
    const fallbackUrl = business?.hero_image_url || business?.image_url;
    const fallback = fallbackUrl ? [{ url: String(fallbackUrl), title, isHero: true }] : [];
    return [...approved, ...fallback].filter((img, idx, arr) => img.url && arr.findIndex((x) => x.url === img.url) === idx).sort((a, b) => Number(b.isHero) - Number(a.isHero));
  }, [images, business, title]);

  const activeHero = heroImages[activeImage] || heroImages[0];

  useEffect(() => {
    if (loading) return;

    const canonicalPath =
      lang === 'en'
        ? `/en/businesses/${encodeURIComponent(slug)}`
        : `/businesses/${encodeURIComponent(slug)}`;

    if (!business) {
      applySeo({
        lang,
        pageName: T(
          lang,
          'Không tìm thấy hồ sơ doanh nghiệp',
          'Business Profile Not Found',
        ),
        description:
          error ||
          T(
            lang,
            'Hồ sơ doanh nghiệp không tồn tại hoặc chưa được Admin duyệt công khai.',
            'The business profile does not exist or is not approved for public display.',
          ),
        canonicalPath,
        image: DEFAULT_SOCIAL_IMAGE,
        type: 'article',
        noindex: true,
      });
      return;
    }

    applySeo({
      lang,
      pageName: title,
      description,
      canonicalPath,
      image:
        activeHero?.url ||
        business.hero_image_url ||
        business.image_url ||
        DEFAULT_SOCIAL_IMAGE,
      type: 'article',
      noindex: false,
    });
  }, [
    activeHero?.url,
    business,
    description,
    error,
    lang,
    loading,
    slug,
    title,
  ]);
  const dealTypeLabel = business ? dealLabel(lang, business.deal_type) : '';
  const ask = business ? money(lang, business.ask_amount, business.ask_currency || business.revenue_currency || 'VND') : '';
  const revenue = business ? money(lang, business.revenue_2025, business.revenue_currency || 'VND') : '';
  const stake = business?.stake_pct === null || business?.stake_pct === undefined ? T(lang, 'Đang cập nhật', 'Pending') : percent(business.stake_pct);
  const quality = business ? qualityLabel(lang, business.quality_score) : '';
  const industry = business ? labelIndustry(primaryIndustry(business.industry), lang) : '';
  const location = business ? labelLocation(cleanText(business.city_key) || cleanText(business.city) || cleanText(business.country_iso2), lang) : '';
  const selfVal = business ? inferredSelfValuation(business) : 0;
  const selfValLabel = selfVal > 0 ? money(lang, selfVal, business.ask_currency || business.revenue_currency || 'VND') : T(lang, 'Đang cập nhật', 'Pending');
  const docsToShow = docs.filter((d) => investorAccess || isOwnerBusiness || d.public_visible === true || d.privacy_level === 'locked');
  const canViewRealQuality = profile?.role === 'investor' || profile?.role === 'admin' || isOwnerBusiness;
  const scoreNumber = business?.quality_score === null || business?.quality_score === undefined ? null : Math.round(Number(business.quality_score));
  const bqsBand = qualityBand(scoreNumber, lang);

  const facts: FactRow[] = business ? [
    { label: T(lang, 'Mã hồ sơ', 'Profile code'), value: business.public_code || business.slug || '—' },
    { label: T(lang, 'Ngành', 'Industry'), value: industry },
    { label: T(lang, 'Địa điểm', 'Location'), value: location },
    { label: T(lang, 'Loại giao dịch', 'Transaction'), value: dealTypeLabel },
    { label: T(lang, 'Doanh thu năm', 'Annual revenue'), value: revenue },
    { label: T(lang, 'Tỷ suất lợi nhuận/EBITDA', 'EBITDA margin'), value: business.ebitda_margin === null || business.ebitda_margin === undefined ? T(lang, 'Đang cập nhật', 'Pending') : percent(business.ebitda_margin) },
    { label: askLabel(lang, business.deal_type), value: ask },
    { label: T(lang, 'Tỷ lệ cổ phần', 'Stake'), value: stake },
    { label: T(lang, 'DN tự định giá', 'Company self-valuation'), value: selfValLabel },
    { label: 'Business Quality Score', value: canViewRealQuality ? quality : T(lang, 'Chỉ nhà đầu tư đăng nhập', 'Investor login required') }
  ] : [];

  const qualityItems = business ? [
    { ok: !!business.revenue_2025, vi: 'Có doanh thu năm gần nhất', en: 'Latest annual revenue provided' },
    { ok: business.ebitda_margin !== null && business.ebitda_margin !== undefined, vi: 'Có tỷ suất lợi nhuận/EBITDA', en: 'EBITDA margin provided' },
    { ok: !!business.ask_amount && !!business.stake_pct, vi: 'Có offer để suy ra định giá DN', en: 'Offer data supports self-valuation' },
    { ok: docsToShow.length > 0, vi: 'Có tài liệu hồ sơ doanh nghiệp đã duyệt tên hiển thị', en: 'Approved profile document names available' },
    { ok: heroImages.length > 0, vi: 'Có hình ảnh doanh nghiệp đã duyệt', en: 'Approved business images available' },
    { ok: !!business.bench_mid || !!business.valuation_factors, vi: 'Có định giá tham chiếu hệ thống', en: 'System benchmark valuation available' }
  ] : [];
  const qualityBreakdown = business ? normalizeQualityBreakdown(business.quality_breakdown_json, business.quality_score) : null;
  const qualityCriteria = qualityPublicCriteria(lang);

  async function expressInterest() {
    if (!profile) {
      setMsg(
        T(
          lang,
          'Bạn cần là nhà đầu tư để thao tác. Hãy đăng ký/đăng nhập tài khoản nhà đầu tư để thực hiện.',
          'You need an Investor account to perform this action. Please register or log in as an investor.',
        ),
      );
      return;
    }

    if (profile.role !== 'investor') {
      setMsg(
        T(
          lang,
          'Chỉ tài khoản Nhà đầu tư được bày tỏ quan tâm.',
          'Only Investor accounts can express interest.',
        ),
      );
      return;
    }

    const inv = await getInvestorByOwner(profile.id).catch(() => null);
    if (!inv?.id || !business?.id) {
      setMsg(T(lang, 'Có lỗi', 'Something went wrong'));
      return;
    }

    try {
      const { error: interestError } = await supabase.rpc(
        'express_investor_interest',
        {
          investor_uuid: inv.id,
          business_uuid: business.id,
          interest_note:
            'Expressed from public business detail page.',
        },
      );

      setMsg(
        interestError
          ? T(lang, 'Có lỗi', 'Something went wrong')
          : T(
              lang,
              'Đã ghi nhận quan tâm. Doanh nghiệp sẽ nhận thông báo.',
              'Interest recorded. The business will be notified.',
            ),
      );
    } catch {
      setMsg(T(lang, 'Có lỗi', 'Something went wrong'));
    }
  }
  async function requestData() {
    if (!profile) { setMsg(T(lang, 'Bạn cần là nhà đầu tư để thao tác. Hãy đăng ký/đăng nhập tài khoản nhà đầu tư để thực hiện.', 'You need an Investor account to perform this action. Please register or log in as an investor.')); return; }
    if (profile.role !== 'investor') { setMsg(T(lang, 'Chỉ tài khoản Nhà đầu tư được yêu cầu tài liệu.', 'Only Investor accounts can request documents.')); return; }
    const inv = await getInvestorByOwner(profile.id).catch(() => null);
    if (!inv?.id || !business?.id) { setMsg(T(lang, 'Không tìm thấy hồ sơ nhà đầu tư.', 'Investor profile not found.')); return; }
    const { error: reqErr } = await supabase.from('request_data').insert({ investor_id: inv.id, business_id: business.id, requested_items: ['IM', 'Financials'], note: 'Requested from public business detail page. e-NDA placeholder pending Beta completion.', status: 'pending' });
    setMsg(reqErr ? reqErr.message : T(lang, 'Đã gửi yêu cầu tài liệu qua Deals68. Luồng e-NDA sẽ được hoàn thiện ở bước tiếp theo.', 'Data request sent via Deals68. The e-NDA flow will be completed in the next step.'));
  }
  async function downloadDoc(doc: Doc) {
    if (!investorAccess || !doc.file_path) { await requestData(); return; }
    const { data, error } = await supabase.storage.from('business-files-private').createSignedUrl(doc.file_path, 60 * 5);
    if (error || !data?.signedUrl) { setMsg(error?.message || T(lang, 'Chưa tạo được link tải tài liệu.', 'Could not create document download link.')); return; }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  }
  function sharePage() {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    if (!url) return;
    if (navigator.share) { navigator.share({ title, url }).catch(() => undefined); return; }
    navigator.clipboard?.writeText(url).then(() => setMsg(T(lang, 'Đã copy liên kết hồ sơ.', 'Profile link copied.'))).catch(() => undefined);
  }

  if (loading) return <main className="d68-business-detail-page"><div className="d68-detail-shell"><div className="d68-detail-loading">{T(lang, 'Đang tải…', 'Loading…')}</div></div></main>;
  if (error || !business) return <main className="d68-business-detail-page"><div className="d68-detail-shell d68-detail-shell--narrow"><div className="d68-detail-empty"><h1>{T(lang, 'Không hiển thị được hồ sơ', 'Profile unavailable')}</h1><p>{error}</p><Link to={businessListPath}>← {T(lang, 'Quay lại danh sách', 'Back to businesses')}</Link></div></div></main>;

  return <main className="d68-business-detail-page">
    <div className="d68-detail-shell">
      <nav className="d68-detail-breadcrumb"><Link to={homePath}>{T(lang, 'Trang chủ', 'Home')}</Link><span>›</span><Link to={businessListPath}>{T(lang, 'Doanh nghiệp', 'Businesses')}</Link><span>›</span><Link to={`${businessListPath}?industry=${encodeURIComponent(industry)}`}>{industry}</Link><span>›</span><b>{business.public_code || business.slug}</b></nav>
      <div className="d68-detail-cols">
        <div className="d68-detail-main">
          <div className="d68-detail-status-row"><span className="d68-detail-status d68-detail-status--active"><i />{T(lang, 'Đang hiển thị', 'Active')}</span>{business.plan === 'featured' ? <span className="d68-detail-status d68-detail-status--featured">★ {T(lang, 'Nổi bật', 'Featured')}</span> : null}<span className="d68-detail-status d68-detail-status--verified">✓ {T(lang, 'Đã duyệt', 'Approved')}</span></div>
          <h1 className="d68-detail-h1">{title}</h1><p className="d68-detail-lead">{description}</p>
          <section className="d68-detail-image-card" aria-label={T(lang, 'Hình ảnh doanh nghiệp', 'Business images')}><div className={`d68-detail-hero-media${activeHero?.url ? ' has-image' : ''}`}>{activeHero?.url ? <img src={activeHero.url} alt={activeHero.title || title} /> : <div className="d68-detail-anon-visual"><b>📷 {T(lang, 'Hồ sơ ẩn danh', 'Anonymous listing')}</b><span>{T(lang, 'Ảnh public đang chờ Admin duyệt', 'Public image pending Admin approval')}</span></div>}{heroImages.length > 1 ? <button type="button" className="d68-detail-slide d68-detail-slide--prev" onClick={() => setActiveImage((v) => (v <= 0 ? heroImages.length - 1 : v - 1))}>‹</button> : null}{heroImages.length > 1 ? <button type="button" className="d68-detail-slide d68-detail-slide--next" onClick={() => setActiveImage((v) => (v + 1) % heroImages.length)}>›</button> : null}<span className="d68-detail-slide-count">{heroImages.length ? `${activeImage + 1}/${heroImages.length}` : '0/0'}</span></div>{heroImages.length > 1 ? <div className="d68-detail-thumbs">{heroImages.map((img, idx) => <button type="button" key={`${img.url}-${idx}`} className={idx === activeImage ? 'active' : ''} onClick={() => setActiveImage(idx)}><img src={img.url} alt={img.title || title} /></button>)}</div> : null}</section>
          <section className="d68-detail-facts" aria-label={T(lang, 'Thông tin chính', 'Key facts')}>{facts.map((fact) => <Fact key={fact.label} label={fact.label} value={fact.value} />)}</section>
          <InfoSection title={T(lang, 'Điểm nổi bật', 'Highlights')}><BulletList items={highlights} empty={T(lang, 'Chưa có điểm nổi bật đã duyệt.', 'No approved highlights yet.')} /></InfoSection>
          {transactionInfo.length ? <InfoSection title={T(lang, 'Thông tin Tài sản & Giao dịch', 'Assets & Transaction Information')}><div className="d68-detail-transaction-info">{transactionInfo.map((item) => <div key={item.label} className="d68-detail-transaction-row"><span>{item.label}</span><p>{item.value}</p></div>)}</div></InfoSection> : null}
          <InfoSection title={T(lang, 'Tài liệu Hồ sơ doanh nghiệp', 'Business Profile Documents')} badge={investorAccess ? `✓ ${T(lang, 'Đã kết nối', 'Connected')}` : isOwnerBusiness ? T(lang, 'Bản xem của doanh nghiệp', 'Business owner view') : `🔒 ${T(lang, 'Mở sau kết nối', 'Unlock after connection')}`}><DocList
            docs={docsToShow}
            lang={lang}
            investorAccess={investorAccess}
            onDownload={downloadDoc}
            empty={
              profile?.role === 'investor'
                ? T(
                    lang,
                    'Chưa có tài liệu được duyệt hiển thị.',
                    'No approved document names are available yet.',
                  )
                : T(
                    lang,
                    'Nhà đầu tư đăng nhập có thể xem danh sách tên tài liệu.',
                    'Logged-in investors can view the document-name list.',
                  )
            }
          /></InfoSection>
          <section className="d68-detail-card d68-detail-card--bqs"><div className={`d68-bqs-card ${canViewRealQuality ? 'is-real' : 'is-demo'}`}><div className="d68-bqs-ring-col"><div className="d68-bqs-ring" style={{ background: `conic-gradient(${canViewRealQuality ? (bqsBand.cls === 'green' ? '#16A34A' : bqsBand.cls === 'blue' ? '#1596cc' : '#B8860B') : '#CBD5E1'} ${canViewRealQuality ? Math.max(0, Math.min(100, scoreNumber ?? 0)) * 3.6 : 0}deg, #EEF2F6 0deg)` }}><div><b>{canViewRealQuality ? (scoreNumber === null ? '—' : scoreNumber) : 'BQS'}</b><span>/100</span></div></div></div><div className="d68-bqs-body"><div className="d68-bqs-head"><h3>Business Quality Score</h3>{canViewRealQuality ? <span className={`d68-bqs-badge ${bqsBand.cls}`}>{bqsBand.label}</span> : null}</div><p>{canViewRealQuality ? businessQualityPublicExplanation(lang) : `${businessQualityPublicExplanation(lang)} ${T(lang, 'Chỉ Nhà đầu tư đăng nhập mới được xem cụ thể.', 'Only logged-in investors can view details.')}`}</p>{canViewRealQuality ? <div className="d68-bqs-breakdown">{qualityBreakdown?.items.map((item) => <div key={item.key} className="d68-bqs-breakdown__row"><b>{qualityItemLabel(item, lang)}</b><span>{item.score}/{item.max}</span><small>{qualityItemNote(item, lang)}</small></div>)}</div> : <div className="d68-bqs-public-criteria">{qualityCriteria.map((x) => <span key={x}>✓ {x}</span>)}</div>}{!canViewRealQuality ? <div className="d68-bqs-alert">🔒 {T(lang, 'Chỉ nhà đầu tư đã đăng nhập mới xem được điểm chi tiết.', 'Only logged-in investors can view the detailed score.')} <Link to={`${loginPath}?role=investor&next=${encodeURIComponent(`${businessListPath}/${slug}`)}`}>{T(lang, 'Đăng nhập nhà đầu tư', 'Investor login')}</Link></div> : null}</div></div></section>
        </div>
        <aside className="d68-detail-side"><div className="d68-detail-summary-card"><div className="d68-detail-summary-head"><span>{T(lang, 'Loại giao dịch', 'Transaction')}</span><strong>{dealTypeLabel}</strong></div><div className="d68-detail-summary-body"><span>{askLabel(lang, business.deal_type)}</span><b>{ask}</b><small>{business.ask_currency || business.revenue_currency ? `${T(lang, 'Tiền tệ', 'Currency')}: ${business.ask_currency || business.revenue_currency}` : T(lang, 'Tiền tệ đang cập nhật', 'Currency pending')}</small><div className="d68-detail-mini-metrics"><div><span>{T(lang, 'Doanh thu', 'Revenue')}</span><b>{revenue}</b></div><div><span>{T(lang, 'Cổ phần', 'Stake')}</span><b>{stake}</b></div><div><span>{T(lang, 'DN tự định giá', 'Self-valuation')}</span><b>{selfValLabel}</b></div></div></div></div>
          <div className="d68-detail-contact-card"><h2>{T(lang, 'Kết nối với doanh nghiệp', 'Connect with the business')}</h2><p>{T(lang, 'Tên, số điện thoại, email và tài liệu nhạy cảm chỉ mở sau khi hai bên được duyệt kết nối.', 'Name, phone, email and sensitive documents unlock only after an approved connection.')}</p><LockedField label={T(lang, 'Tên doanh nghiệp', 'Business name')} masked="••••••" /><LockedField label="Email" masked="••••••" /><LockedField label={T(lang, 'Điện thoại', 'Phone')} masked="••••••" /><button type="button" className="d68-detail-primary" onClick={expressInterest}>{T(lang, 'Bày tỏ quan tâm', 'Express interest')}</button><div className="d68-detail-secondary-row"><button type="button" onClick={requestData}>🔒 {T(lang, 'Yêu cầu tài liệu', 'Request data')}</button><button type="button" onClick={sharePage}>↗ {T(lang, 'Chia sẻ', 'Share')}</button></div>{msg ? <div className="d68-detail-msg">{msg}</div> : null}</div>
          <div className="d68-detail-verify-card"><h3>{T(lang, 'Đã xác minh', 'Verified')}</h3><div><span>✓ {T(lang, 'Bản public đã duyệt', 'Approved public snapshot')}</span><span>✓ {T(lang, 'Hồ sơ ẩn danh', 'Anonymous profile')}</span>{heroImages.length ? <span>✓ {T(lang, 'Ảnh public đã duyệt', 'Approved public images')}</span> : null}{docsToShow.length ? <span>✓ {T(lang, 'Có tài liệu hồ sơ', 'Profile documents listed')}</span> : null}</div></div>
        </aside>
      </div>
    </div>
    <div className="d68-detail-shell"><BusinessFaq lang={lang} /></div>
    <section className="d68-detail-similar-band"><div className="d68-detail-shell"><div className="d68-detail-section-head"><h2>{T(lang, 'Xem doanh nghiệp tương tự', 'Similar businesses')}</h2><Link to={`${businessListPath}?industry=${encodeURIComponent(industry)}`}>{T(lang, 'Xem tất cả cùng ngành', 'View all in this sector')} →</Link></div>{similar.length ? <div className="d68-detail-sim-grid">{similar.map((deal, idx) => <SimilarCard key={deal.id} deal={deal} idx={idx} lang={lang} />)}</div> : <div className="d68-detail-sim-empty">{T(lang, 'Chưa có hồ sơ tương tự đang hiển thị.', 'No similar public listings are currently available.')}</div>}</div></section>
  </main>;
}

function InfoSection({ title, badge, children }: { title: string; badge?: string; children: ReactNode }) { return <section className="d68-detail-card"><div className="d68-detail-card-head"><h2>{title}</h2>{badge ? <span>{badge}</span> : null}</div>{children}</section>; }
function BulletList({ items, empty }: { items: string[]; empty: string }) { return items.length ? <ul className="d68-detail-bullets">{items.map((item, idx) => <li key={`${item}-${idx}`}>{item}</li>)}</ul> : <p className="d68-detail-muted">{empty}</p>; }
function Fact({ label, value }: FactRow) { return <div className="d68-detail-fact"><span>{label}</span><b>{value}</b></div>; }
function DocList({ docs, lang, investorAccess, onDownload, empty }: { docs: Doc[]; lang: Lang; investorAccess: boolean; onDownload: (doc: Doc) => void; empty: string }) { return docs.length ? <div className="d68-detail-doc-list">{docs.map((doc) => <div key={doc.id || doc.file_name || doc.display_name} className="d68-detail-doc-row"><span>{fileExt(doc)}</span><div><b>{doc.display_name || doc.file_name || doc.category || 'Document'}</b><small>{doc.category || 'document'}{fileSize(doc.size_bytes) ? ` · ${fileSize(doc.size_bytes)}` : ''}</small></div><button type="button" disabled={!investorAccess} aria-disabled={!investorAccess} className={investorAccess ? 'd68-doc-download' : 'd68-doc-download locked'} onClick={() => investorAccess ? onDownload(doc) : undefined}>{investorAccess ? T(lang, 'Tải tài liệu', 'Download') : T(lang, 'Khóa', 'Locked')}</button></div>)}</div> : <p className="d68-detail-muted">{empty}</p>; }
function LockedField({ label, masked }: { label: string; masked: string }) { return <div className="d68-detail-locked"><span>🔒</span><b>{label}</b><em>{masked}</em></div>; }
function SimilarCard({ deal, idx, lang }: { deal: SimilarDeal; idx: number; lang: Lang }) { return <Link to={`${lang === 'en' ? '/en/businesses' : '/businesses'}/${deal.slug}`} className="d68-detail-sim-card"><div className={`d68-detail-sim-media d68-detail-sim-media--${(idx % 6) + 1}`}>{deal.image ? <img src={deal.image} alt={deal.title} /> : <span>🔒 {T(lang, 'Ẩn danh', 'Anonymous')}</span>}<b>{deal.city}</b></div><div><span>{deal.industry}</span><h3 className="d68-entity-title-link">{deal.title}</h3><footer><div><small>{T(lang, 'Doanh thu', 'Revenue')}</small><strong>{deal.revenue}</strong></div><div><small>{T(lang, 'Nhu cầu', 'Ask')}</small><strong>{deal.ask}</strong></div></footer></div></Link>; }
