import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { getBusinessBySlug, getInvestorByOwner } from '../lib/data';
import { formatCompactMoney, percent } from '../lib/format';
import { useAuth } from '../contexts/AuthContext';
import type { Lang } from '../lib/i18n';

const T = (lang: Lang, vi: string, en: string) => lang === 'en' ? en : vi;

type Doc = { id?: string; file_name?: string; category?: string; privacy_level?: string; created_at?: string };
function lines(v: any): string[] { if (Array.isArray(v)) return v.filter(Boolean).map(String); return String(v || '').split(/\n|;/).map((x) => x.trim()).filter(Boolean); }
function money(v: any, cur: string) { return Number(v || 0) > 0 ? formatCompactMoney(v, cur) : 'TBD'; }
function qualityLabel(lang: Lang, q: any) { const n = Number(q); if (!Number.isFinite(n) || q === null || q === undefined) return T(lang, 'Đang cập nhật', 'Pending'); return `${n}/100`; }
function asJsonList(raw: any, key: string): string[] { return raw && typeof raw === 'object' ? lines(raw[key]) : []; }

export default function BusinessDetail({ lang }: { lang: Lang }) {
  const { slug = '' } = useParams();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [business, setBusiness] = useState<any>(null);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    let live = true;
    async function load() {
      setLoading(true); setError(''); setBusiness(null); setDocs([]);
      try {
        const b = await getBusinessBySlug(slug);
        if (!live) return;
        if (!b) { setError(T(lang, 'Không tìm thấy hồ sơ doanh nghiệp hoặc hồ sơ chưa được công khai.', 'Business profile not found or not public.')); return; }
        setBusiness(b);
        const { data } = await supabase.from('business_files').select('id,file_name,category,privacy_level,created_at').eq('business_id', b.id).order('created_at', { ascending: false });
        if (live) setDocs(data || []);
      } catch (e: any) { if (live) setError(e?.message || T(lang, 'Không tải được hồ sơ.', 'Could not load profile.')); }
      finally { if (live) setLoading(false); }
    }
    load();
    return () => { live = false; };
  }, [slug, lang]);

  const title = business ? T(lang, business.title_vi || business.public_code || 'Hồ sơ doanh nghiệp', business.title_en || business.title_vi || business.public_code || 'Business profile') : '';
  const overview = useMemo(() => business ? [business.description_vi, ...lines(business.highlights_vi), business.investment_reason_vi].filter(Boolean) : [], [business]);
  const overviewEn = useMemo(() => business ? [business.description_en || business.description_vi, ...lines(business.highlights_en || business.highlights_vi), business.investment_reason_en || business.investment_reason_vi].filter(Boolean) : [], [business]);
  const facts = business ? [
    [T(lang, 'Mã hồ sơ', 'Profile code'), business.public_code || business.slug || '-'],
    [T(lang, 'Ngành', 'Industry'), business.industry || T(lang, 'Đang cập nhật', 'Pending')],
    [T(lang, 'Địa điểm', 'Location'), business.city || business.country_iso2 || T(lang, 'Đang cập nhật', 'Pending')],
    [T(lang, 'Loại giao dịch', 'Transaction'), business.deal_type || T(lang, 'Đang cập nhật', 'Pending')],
    [T(lang, 'Doanh thu 2025E', '2025E revenue'), money(business.revenue_2025, business.revenue_currency || 'VND')],
    ['EBITDA', business.ebitda_margin === null || business.ebitda_margin === undefined ? T(lang, 'Đang cập nhật', 'Pending') : percent(business.ebitda_margin)],
    [T(lang, 'Nhu cầu vốn/giá chào', 'Capital sought / asking'), money(business.ask_amount, business.ask_currency || business.revenue_currency || 'VND')],
    [T(lang, 'Tỷ lệ cổ phần', 'Stake'), business.stake_pct === null || business.stake_pct === undefined ? 'TBD' : percent(business.stake_pct)],
    ['Business Quality Score', qualityLabel(lang, business.quality_score)],
    [T(lang, 'Trạng thái dữ liệu', 'Data status'), business.verified === true ? T(lang, 'Đã xác minh', 'Verified') : T(lang, 'Chờ xác nhận/Admin review', 'Pending verification/Admin review')]
  ] : [];
  const extraFacts = business ? asJsonList(business.profile_json || business.detail_json || {}, 'facts') : [];
  const useOfFunds = business ? lines(business.use_of_funds_vi || business.use_of_funds || business.funds_usage_vi) : [];
  const publicDocs = docs.filter((d) => d.privacy_level === 'public');
  const lockedDocs = docs.filter((d) => d.privacy_level !== 'public');

  async function expressInterest() {
    if (!profile) { navigate(`/login?next=/businesses/${slug}`); return; }
    if (profile.role !== 'investor') { setMsg(T(lang, 'Chỉ tài khoản Nhà đầu tư được bày tỏ quan tâm.', 'Only Investor accounts can express interest.')); return; }
    const inv = await getInvestorByOwner(profile.id).catch(() => null);
    if (!inv?.id || !business?.id) { setMsg(T(lang, 'Không tìm thấy hồ sơ nhà đầu tư.', 'Investor profile not found.')); return; }
    const { error: upErr } = await supabase.from('investor_interests').upsert({ investor_id: inv.id, business_id: business.id, status: 'pending' }, { onConflict: 'investor_id,business_id' });
    setMsg(upErr ? upErr.message : T(lang, 'Đã ghi nhận quan tâm. Admin/Doanh nghiệp sẽ duyệt kết nối trước khi mở thêm dữ liệu.', 'Interest recorded. Admin/Business approval is required before additional data unlocks.'));
  }
  async function requestData() {
    if (!profile) { navigate(`/login?next=/businesses/${slug}`); return; }
    if (profile.role !== 'investor') { setMsg(T(lang, 'Chỉ tài khoản Nhà đầu tư được yêu cầu tài liệu.', 'Only Investor accounts can request documents.')); return; }
    const inv = await getInvestorByOwner(profile.id).catch(() => null);
    if (!inv?.id || !business?.id) { setMsg(T(lang, 'Không tìm thấy hồ sơ nhà đầu tư.', 'Investor profile not found.')); return; }
    const { error: reqErr } = await supabase.from('request_data').insert({ investor_id: inv.id, business_id: business.id, requested_items: ['IM', 'Financials'], note: 'Requested from public business detail page.', status: 'requested' });
    setMsg(reqErr ? reqErr.message : T(lang, 'Đã gửi yêu cầu tài liệu qua Deals68.', 'Data request sent via Deals68.'));
  }

  if (loading) return <main style={{ maxWidth: 1180, margin: '0 auto', padding: '48px 24px' }}><div style={{ background: '#fff', border: '1px solid #E7EDF3', borderRadius: 18, padding: 32 }}>{T(lang, 'Đang tải hồ sơ thật từ database...', 'Loading live profile from database...')}</div></main>;
  if (error || !business) return <main style={{ maxWidth: 920, margin: '0 auto', padding: '48px 24px' }}><div style={{ background: '#fff', border: '1px solid #E7EDF3', borderRadius: 18, padding: 32 }}><h1>{T(lang, 'Không hiển thị được hồ sơ', 'Profile unavailable')}</h1><p style={{ color: '#64748B' }}>{error}</p><Link to="/businesses" style={{ color: '#1596cc', fontWeight: 700 }}>← {T(lang, 'Quay lại danh sách', 'Back to businesses')}</Link></div></main>;

  return <main style={{ background: '#F7FAFC' }}>
    <section style={{ maxWidth: 1180, margin: '0 auto', padding: '28px 24px 60px' }}>
      <div style={{ fontSize: 13, color: '#94A3B8', marginBottom: 18 }}><Link to="/">{T(lang, 'Trang chủ', 'Home')}</Link> › <Link to="/businesses">{T(lang, 'Doanh nghiệp', 'Businesses')}</Link> › <b style={{ color: '#475569' }}>{business.public_code || business.slug}</b></div>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 340px', gap: 26 }} className="d68-detail-cols">
        <article style={{ background: '#fff', border: '1px solid #E7EDF3', borderRadius: 18, overflow: 'hidden' }}>
          <div style={{ height: 390, background: '#EAF0F6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94A3B8', fontWeight: 800 }}>
            {business.image_url || business.hero_image_url ? <img src={business.image_url || business.hero_image_url} alt={title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : T(lang, 'Ảnh doanh nghiệp đang cập nhật', 'Business image pending')}
          </div>
          <div style={{ padding: 28 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}><span style={{ background: '#E7F6FD', color: '#1596cc', fontWeight: 800, fontSize: 12, padding: '5px 10px', borderRadius: 7 }}>{business.industry || 'Industry TBD'}</span><span style={{ background: '#F1F5F9', color: '#64748B', fontWeight: 800, fontSize: 12, padding: '5px 10px', borderRadius: 7 }}>{business.deal_type || 'Transaction TBD'}</span></div>
            <h1 style={{ fontSize: 30, lineHeight: 1.18, margin: '0 0 12px', letterSpacing: -.7 }}>{title}</h1>
            <p style={{ color: '#64748B', lineHeight: 1.65, margin: '0 0 22px' }}>{T(lang, business.description_vi || business.highlights_vi || 'Hồ sơ đang được cập nhật từ dashboard/Admin.', business.description_en || business.description_vi || 'Profile is being updated from dashboard/Admin.')}</p>
            <Section title={T(lang, 'Thông tin chính', 'Key facts')}><div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 12 }} className="d68-form-2">{facts.map(([k, v]) => <Fact key={k} k={k} v={v} />)}{extraFacts.map((v, i) => <Fact key={`ex-${i}`} k={T(lang, 'Thông tin bổ sung', 'Additional fact')} v={v} />)}</div></Section>
            <Section title={T(lang, 'Hồ sơ doanh nghiệp', 'Business profile')}><ul style={{ margin: 0, paddingLeft: 20, color: '#334155', lineHeight: 1.7 }}>{(lang === 'vi' ? overview : overviewEn).length ? (lang === 'vi' ? overview : overviewEn).map((x, i) => <li key={i}>{x}</li>) : <li>{T(lang, 'Chưa có mô tả chi tiết trong database.', 'No detailed description in database yet.')}</li>}</ul></Section>
            <Section title={T(lang, 'Lý do giao dịch / sử dụng vốn', 'Transaction rationale / use of funds')}><ul style={{ margin: 0, paddingLeft: 20, color: '#334155', lineHeight: 1.7 }}>{useOfFunds.length ? useOfFunds.map((x, i) => <li key={i}>{x}</li>) : <li>{business.investment_reason_vi || T(lang, 'Đang cập nhật.', 'Pending.')}</li>}</ul></Section>
            <Section title={T(lang, 'Tài liệu trong database', 'Documents in database')}><DocList docs={publicDocs} title={T(lang, 'Công khai', 'Public')} empty={T(lang, 'Chưa có tài liệu công khai.', 'No public documents yet.')} /><DocList docs={lockedDocs} title={T(lang, 'Khóa sau kết nối/NDA', 'Locked after connection/NDA')} empty={T(lang, 'Chưa có tài liệu khóa hoặc dữ liệu chưa được upload.', 'No locked documents uploaded yet.')} /></Section>
            <div style={{ background: '#FEF3D3', color: '#7a5c12', border: '1px solid #F5D98A', borderRadius: 14, padding: 16, fontSize: 13.5, lineHeight: 1.55 }}><b>{T(lang, 'Lưu ý dữ liệu', 'Data note')}:</b> {T(lang, 'Trang này chỉ hiển thị dữ liệu có trong database hoặc file đã upload. Deals68 không tự tạo chứng nhận, tài liệu, điểm xác minh hoặc FAQ khi chưa có dữ liệu backing.', 'This page only displays database-backed data or uploaded files. Deals68 does not fabricate certifications, documents, verification scores or FAQs without backing data.')}</div>
          </div>
        </article>
        <aside style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ background: '#0F2A4A', color: '#fff', borderRadius: 18, padding: 24 }}><div style={{ color: '#9db4cc', fontWeight: 700, fontSize: 13, marginBottom: 8 }}>{T(lang, 'Tóm tắt giao dịch', 'Transaction summary')}</div><h2 style={{ margin: '0 0 8px', color: '#F2B51D' }}>{money(business.ask_amount, business.ask_currency || business.revenue_currency || 'VND')}</h2><p style={{ color: '#c6d5e6', margin: 0 }}>{business.stake_pct ? `${percent(business.stake_pct)} · ` : ''}{business.deal_type || 'Transaction TBD'}</p><button onClick={expressInterest} style={{ width: '100%', marginTop: 18, border: 'none', borderRadius: 10, padding: 12, background: '#F2B51D', color: '#0F2A4A', fontWeight: 800 }}>{T(lang, 'Bày tỏ quan tâm', 'Express interest')}</button><button onClick={requestData} style={{ width: '100%', marginTop: 10, border: '1px solid rgba(255,255,255,.2)', borderRadius: 10, padding: 12, background: 'rgba(255,255,255,.08)', color: '#fff', fontWeight: 800 }}>{T(lang, 'Yêu cầu IM / dữ liệu', 'Request IM / data')}</button></div>
          <div style={{ background: '#fff', border: '1px solid #E7EDF3', borderRadius: 18, padding: 22 }}><h3 style={{ margin: '0 0 12px' }}>{T(lang, 'Quyền xem', 'Access')}</h3><p style={{ color: '#64748B', lineHeight: 1.55 }}>{T(lang, 'Tên pháp nhân, thông tin liên hệ và tài liệu khóa chỉ mở sau workflow kết nối được duyệt. Email/điện thoại không hiển thị công khai.', 'Legal name, contact details and locked documents unlock only after approved connection workflow. Email/phone are not public.')}</p></div>
          {msg ? <div style={{ background: '#E7F6FD', border: '1px solid #BEE3F5', color: '#0F2A4A', borderRadius: 14, padding: 14, fontWeight: 600 }}>{msg}</div> : null}
        </aside>
      </div>
    </section>
  </main>;
}
function Section({ title, children }: { title: string; children: any }) { return <section style={{ borderTop: '1px solid #EEF2F6', paddingTop: 22, marginTop: 22 }}><h2 style={{ margin: '0 0 14px', fontSize: 20 }}>{title}</h2>{children}</section>; }
function Fact({ k, v }: { k: string; v: string }) { return <div style={{ border: '1px solid #EEF2F6', borderRadius: 12, padding: 13, background: '#F8FAFC' }}><div style={{ color: '#94A3B8', fontSize: 11, fontWeight: 800, textTransform: 'uppercase' }}>{k}</div><div style={{ fontWeight: 800, marginTop: 4 }}>{v}</div></div>; }
function DocList({ docs, title, empty }: { docs: Doc[]; title: string; empty: string }) { return <div style={{ marginBottom: 12 }}><b>{title}</b>{docs.length ? <ul style={{ margin: '8px 0 0', paddingLeft: 20 }}>{docs.map((d) => <li key={d.id || d.file_name}>{d.file_name || 'Document'} <span style={{ color: '#94A3B8' }}>· {d.category || 'other'}</span></li>)}</ul> : <p style={{ color: '#94A3B8', margin: '8px 0 0' }}>{empty}</p>}</div>; }
