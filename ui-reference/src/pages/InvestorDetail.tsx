import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { getInvestorByCode, getMyBusiness } from '../lib/data';
import { formatCompactMoney } from '../lib/format';
import { useAuth } from '../contexts/AuthContext';
import type { Lang } from '../lib/i18n';

const T = (lang: Lang, vi: string, en: string) => (lang === 'en' ? en : vi);
function arr(v: any): string[] { if (Array.isArray(v)) return v.filter(Boolean).map(String); if (!v) return []; return String(v).split(/[;,\n]/).map((x) => x.trim()).filter(Boolean); }
function ticket(min: any, max: any) { const a = Number(min || 0), b = Number(max || 0); if (!a && !b) return 'TBD'; if (a && b) return `${formatCompactMoney(a, 'USD')} – ${formatCompactMoney(b, 'USD')}`; return a ? `≥ ${formatCompactMoney(a, 'USD')}` : `≤ ${formatCompactMoney(b, 'USD')}`; }
function criteriaList(criteria: any): string[] {
  if (!criteria || typeof criteria !== 'object' || Array.isArray(criteria)) return [];
  return Object.entries(criteria).map(([k, v]) => `${k.replace(/_/g, ' ')}: ${Array.isArray(v) ? v.join(', ') : String(v ?? '')}`).filter((x) => !x.endsWith(': '));
}
function activity(lang: Lang, value: any) {
  const v = String(value || '').toLowerCase();
  if (v.includes('high') || v.includes('active') || v.includes('cao')) return { label: T(lang, 'Đang hoạt động', 'Active'), color: '#16A34A' };
  if (v.includes('medium') || v.includes('normal')) return { label: T(lang, 'Hoạt động vừa', 'Moderate'), color: '#F2B51D' };
  return { label: T(lang, 'Đang cập nhật', 'Updating'), color: '#94A3B8' };
}
function typeColor(type: any) {
  const v = String(type || '').toLowerCase();
  if (v.includes('vc')) return { bg: '#E7F6FD', color: '#1596cc' };
  if (v.includes('pe')) return { bg: '#EEF2FF', color: '#4F46E5' };
  if (v.includes('corporate') || v.includes('strategic')) return { bg: '#FEF3D3', color: '#B8860B' };
  return { bg: '#F1F5F9', color: '#64748B' };
}
const colors = ['#1BADEA', '#F2B51D', '#16A34A', '#8B5CF6'];

export default function InvestorDetail({ lang }: { lang: Lang }) {
  const { code = '' } = useParams();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [inv, setInv] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let live = true;
    async function load() {
      setLoading(true); setError(''); setInv(null);
      try {
        const data = await getInvestorByCode(code);
        if (!live) return;
        if (!data) setError(T(lang, 'Không tìm thấy hồ sơ nhà đầu tư hoặc hồ sơ chưa public.', 'Investor profile not found or not public.'));
        else setInv(data);
      } catch (e: any) {
        if (live) setError(e?.message || T(lang, 'Không tải được hồ sơ nhà đầu tư.', 'Could not load investor profile.'));
      } finally { if (live) setLoading(false); }
    }
    load(); return () => { live = false; };
  }, [code, lang]);

  const industries = useMemo(() => arr(inv?.industries), [inv]);
  const dealTypes = useMemo(() => arr(inv?.deal_types), [inv]);
  const criteria = useMemo(() => criteriaList(inv?.criteria), [inv]);
  const regions = useMemo(() => arr(inv?.region || inv?.country || inv?.country_iso2 || 'Global'), [inv]);
  const title = inv ? T(lang, inv.title_vi || inv.code || 'Nhà đầu tư ẩn danh', inv.title_en || inv.title_vi || inv.code || 'Anonymous investor') : '';
  const desc = inv ? T(lang, inv.desc_vi || 'Hồ sơ nhà đầu tư ẩn danh đang được cập nhật tiêu chí đầu tư.', inv.desc_en || inv.desc_vi || 'Anonymous investor profile is being updated.') : '';
  const act = activity(lang, inv?.activity_level);
  const tc = typeColor(inv?.type);
  const facts = inv ? [
    [T(lang, 'Mã hồ sơ', 'Profile code'), inv.code || '-'],
    [T(lang, 'Loại nhà đầu tư', 'Investor type'), inv.type || 'Investor'],
    [T(lang, 'Quốc gia', 'Country'), inv.country || inv.country_iso2 || 'Global'],
    [T(lang, 'Khu vực', 'Region'), inv.region || 'Global'],
    ['Ticket', ticket(inv.ticket_min, inv.ticket_max)],
    [T(lang, 'Ngành quan tâm', 'Preferred industries'), industries.join(', ') || 'TBD'],
    [T(lang, 'Loại giao dịch', 'Deal types'), dealTypes.join(', ') || 'TBD'],
    [T(lang, 'Giai đoạn', 'Stage'), inv.stage || 'TBD'],
    [T(lang, 'Xác minh', 'Verification'), inv.verified ? T(lang, 'Đã xác minh', 'Verified') : T(lang, 'Chờ xác nhận', 'Pending')]
  ] : [];
  const tags = [...industries, ...dealTypes, inv?.country || inv?.country_iso2, inv?.type, inv?.stage].filter(Boolean).slice(0, 12);
  const industryDonut = donut(industries.length || 1);
  const locationDonut = donut(regions.length || 1);

  async function sendProposal() {
    if (!profile) { navigate(`/login?next=/investors/${code}`); return; }
    if (profile.role !== 'business') { setMsg(T(lang, 'Chỉ tài khoản Doanh nghiệp được gửi hồ sơ tới nhà đầu tư.', 'Only Business accounts can send a profile to investors.')); return; }
    setSending(true); setMsg('');
    try {
      const biz = await getMyBusiness(profile.id);
      if (!biz?.id || !inv?.id) throw new Error(T(lang, 'Không tìm thấy hồ sơ doanh nghiệp hoặc nhà đầu tư.', 'Business or investor profile not found.'));
      let err: any = null;
      try {
        const res = await supabase.rpc('submit_business_proposal', { p_business_id: biz.id, p_investor_id: inv.id, p_note: 'Submitted from investor detail page.' });
        err = res.error;
      } catch (e) { err = e; }
      if (err) {
        const fallback = await supabase.from('proposals').insert({ business_id: biz.id, investor_id: inv.id, note: 'Submitted from investor detail page.', status: 'sent' });
        err = fallback.error;
      }
      if (err) throw err;
      setMsg(T(lang, 'Đã gửi hồ sơ DN tới nhà đầu tư. Hệ thống sẽ ghi nhận quota/workflow duyệt.', 'Business profile sent to the investor. Quota/workflow has been recorded.'));
    } catch (e: any) {
      setMsg(e?.message || T(lang, 'Chưa gửi được proposal.', 'Could not send proposal.'));
    } finally { setSending(false); }
  }

  if (loading) return <main style={{ maxWidth: 920, margin: '0 auto', padding: '48px 24px' }}><div style={box}>{T(lang, 'Đang tải hồ sơ nhà đầu tư...', 'Loading investor profile...')}</div></main>;
  if (error || !inv) return <main style={{ maxWidth: 920, margin: '0 auto', padding: '48px 24px' }}><div style={box}><h1>{T(lang, 'Không hiển thị được hồ sơ', 'Profile unavailable')}</h1><p style={{ color: '#64748B' }}>{error}</p><Link to="/investors" style={{ color: '#1596cc', fontWeight: 700 }}>← {T(lang, 'Quay lại danh sách', 'Back to investors')}</Link></div></main>;

  return <main style={{ background: '#F7FAFC' }}>
    <div style={{ maxWidth: 1240, margin: '0 auto', padding: '22px 24px 0' }}><div style={{ fontSize: 13, color: '#94A3B8' }}><Link to="/">{T(lang, 'Trang chủ', 'Home')}</Link><span style={{ margin: '0 8px' }}>›</span><Link to="/investors">{T(lang, 'Nhà đầu tư', 'Investors')}</Link><span style={{ margin: '0 8px' }}>›</span><span style={{ color: '#475569', fontWeight: 600 }}>{inv.code}</span></div></div>

    <div className="d68-detail-cols" style={{ maxWidth: 1240, margin: '0 auto', padding: '14px 24px 40px', display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 360px', gap: 28, alignItems: 'start' }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}><Badge bg={tc.bg} color={tc.color}>{inv.type || 'Investor'}</Badge><Badge bg="#F1F5F9" color="#64748B">📍 {inv.country || inv.country_iso2 || 'Global'}</Badge>{inv.verified ? <Badge bg="#E9F9EF" color="#16A34A">✓ {T(lang, 'Đã xác minh', 'Verified')}</Badge> : null}<span style={{ fontSize: 12, fontWeight: 700, color: act.color }}>● {act.label}</span></div>
        <h1 style={{ fontSize: 27, fontWeight: 800, letterSpacing: -.6, margin: '0 0 10px', lineHeight: 1.3 }}>{title}</h1>
        <p style={{ fontSize: 15.5, color: '#64748B', lineHeight: 1.6, margin: '0 0 22px', maxWidth: 760 }}>{desc}</p>

        <div className="d68-facts" style={{ background: '#fff', border: '1px solid #E7EDF3', borderRadius: 16, padding: '8px 24px', display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: 44, boxShadow: '0 1px 2px rgba(15,42,74,.04)', marginBottom: 22 }}>{facts.map(([k, v]) => <FactRow key={k} k={k} v={v} />)}</div>

        <Panel title={T(lang, 'Lịch sử nhận proposal', 'Proposal history')}><EmptyLine text={T(lang, 'Lịch sử proposal không hiển thị công khai. Nhà đầu tư và Admin xem trong dashboard sau khi đăng nhập.', 'Proposal history is not public. Investors and Admin can view it in the dashboard after login.')} /></Panel>

        <Panel title={T(lang, 'Mức độ quan tâm', 'Preferences')}><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }} className="d68-form-2"><Preference title={T(lang, 'Lĩnh vực', 'Industries')} donut={industryDonut} items={industries.length ? industries : ['TBD']} /><Preference title={T(lang, 'Khu vực', 'Locations')} donut={locationDonut} items={regions.length ? regions : ['Global']} /></div></Panel>

        <Panel title="Tags"><div style={{ fontSize: 13, color: '#64748B', lineHeight: 2.2 }}>{tags.length ? tags.map((tag, i) => <span key={`${tag}-${i}`} style={{ whiteSpace: 'nowrap', display: 'inline-block', margin: '0 2px 6px 0' }}>{tag}{i < tags.length - 1 ? <span style={{ margin: '0 6px', color: '#CBD5E1' }}>·</span> : null}</span>) : <span>TBD</span>}</div></Panel>

        <Panel title={T(lang, 'Tiêu chí đầu tư đầy đủ', 'Full investment criteria')}><div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>{criteria.length ? criteria.map((c, i) => <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 14.5, color: '#334155' }}><span style={{ color: '#1BADEA', fontWeight: 800, flexShrink: 0, lineHeight: 1.6 }}>▪</span><span style={{ flex: 1, lineHeight: 1.6 }}>{c}</span></div>) : <EmptyLine text={T(lang, 'Tiêu chí chi tiết đang được cập nhật trong dashboard nhà đầu tư.', 'Detailed criteria are being updated in the investor dashboard.')} />}</div></Panel>

        <Panel title={T(lang, 'Thông tin liên hệ', 'Contact information')}><div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}><Locked>{T(lang, 'Tên người liên hệ thật', 'Real contact name')}</Locked><Locked>Email</Locked><Locked>{T(lang, 'Điện thoại / website riêng', 'Phone / private website')}</Locked></div></Panel>
      </div>

      <aside className="d68-side" style={{ position: 'sticky', top: 90, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ background: '#0F2A4A', color: '#fff', borderRadius: 18, padding: 22, boxShadow: '0 8px 26px rgba(15,42,74,.08)' }}><div style={{ fontSize: 12, fontWeight: 700, color: '#9db4cc', textTransform: 'uppercase', letterSpacing: .5, marginBottom: 8 }}>{T(lang, 'Gửi proposal', 'Send proposal')}</div><p style={{ fontSize: 14, color: '#dbe6f2', lineHeight: 1.6, margin: '0 0 16px' }}>{T(lang, 'Doanh nghiệp có thể gửi hồ sơ ẩn danh tới nhà đầu tư này. Thông tin riêng tư chỉ mở khi kết nối được duyệt.', 'A business can send its anonymous profile to this investor. Private information unlocks only after approval.')}</p><button onClick={sendProposal} disabled={sending} style={{ display: 'block', width: '100%', textAlign: 'center', background: '#F2B51D', color: '#0F2A4A', fontWeight: 800, fontSize: 15, padding: 13, borderRadius: 11, border: 'none', cursor: sending ? 'wait' : 'pointer' }}>{sending ? T(lang, 'Đang gửi...', 'Sending...') : T(lang, 'Gửi hồ sơ DN', 'Send business profile')}</button>{msg ? <div style={{ marginTop: 12, fontSize: 12.5, fontWeight: 600, color: '#F2B51D', lineHeight: 1.45 }}>{msg}</div> : null}</div>
        <div style={box}><div style={{ fontSize: 13, fontWeight: 800, marginBottom: 12, color: '#334155' }}>{T(lang, 'Tóm tắt đầu tư', 'Investment summary')}</div><Summary k="Ticket" v={ticket(inv.ticket_min, inv.ticket_max)} /><Summary k={T(lang, 'Loại', 'Type')} v={inv.type || 'Investor'} /><Summary k={T(lang, 'Ngành', 'Industries')} v={industries.slice(0, 3).join(', ') || 'TBD'} /><Summary k={T(lang, 'Khu vực', 'Region')} v={inv.region || inv.country || 'Global'} /></div>
        <div style={box}><div style={{ fontSize: 13, fontWeight: 800, marginBottom: 12, color: '#334155' }}>{T(lang, 'Quyền riêng tư', 'Privacy')}</div><p style={{ color: '#64748B', lineHeight: 1.55, fontSize: 13, margin: 0 }}>{T(lang, 'Email, điện thoại, tên cá nhân và thông tin liên hệ riêng tư không hiển thị công khai.', 'Email, phone, personal name and private contact details are not publicly displayed.')}</p></div>
      </aside>
    </div>
  </main>;
}

const box = { background: '#fff', border: '1px solid #E7EDF3', borderRadius: 18, padding: 22, boxShadow: '0 1px 2px rgba(15,42,74,.04)' };
function Badge({ bg, color, children }: { bg: string; color: string; children: any }) { return <span style={{ fontSize: 12.5, fontWeight: 700, padding: '5px 11px', borderRadius: 7, background: bg, color }}>{children}</span>; }
function FactRow({ k, v }: { k: string; v: any }) { return <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: '13px 0', borderBottom: '1px solid #F1F5F9' }}><span style={{ fontSize: 13.5, color: '#64748B', flexShrink: 0 }}>{k}</span><span style={{ fontSize: 13.5, fontWeight: 700, color: '#0F2A4A', textAlign: 'right' }}>{v}</span></div>; }
function Panel({ title, children }: { title: string; children: any }) { return <div style={{ background: '#fff', border: '1px solid #E7EDF3', borderRadius: 16, padding: '24px 26px', marginBottom: 22 }}><h2 style={{ fontSize: 17.5, fontWeight: 800, margin: '0 0 16px' }}>{title}</h2>{children}</div>; }
function EmptyLine({ text }: { text: string }) { return <div style={{ background: '#F7FAFC', border: '1px dashed #CBD5E1', color: '#64748B', borderRadius: 12, padding: 16, fontSize: 14, lineHeight: 1.6 }}>{text}</div>; }
function Preference({ title, donut, items }: { title: string; donut: string; items: string[] }) { return <div style={{ textAlign: 'center' }}><div style={{ fontSize: 13, fontWeight: 700, color: '#334155', marginBottom: 14 }}>{title}</div><div style={{ position: 'relative', width: 130, height: 130, margin: '0 auto 16px', borderRadius: '50%', background: donut }}><div style={{ position: 'absolute', inset: 26, background: '#fff', borderRadius: '50%' }} /></div><div style={{ display: 'flex', flexDirection: 'column', gap: 6, textAlign: 'left', maxWidth: 220, margin: '0 auto' }}>{items.slice(0, 4).map((x, i) => <div key={x + i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: '#475569' }}><span style={{ width: 9, height: 9, borderRadius: 2, background: colors[i % colors.length], flexShrink: 0 }} />{x}</div>)}</div></div>; }
function Locked({ children }: { children: any }) { return <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: '#F7FAFC', border: '1px solid #EEF2F6', borderRadius: 10 }}><span style={{ fontSize: 15 }}>🔒</span><span style={{ flex: 1, fontSize: 13.5, color: '#64748B' }}>{children}</span></div>; }
function Summary({ k, v }: { k: string; v: string }) { return <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '10px 0', borderBottom: '1px solid #EEF2F6', fontSize: 13 }}><span style={{ color: '#64748B' }}>{k}</span><span style={{ fontWeight: 800, textAlign: 'right' }}>{v}</span></div>; }
function donut(count: number) { const c = Math.max(1, Math.min(4, count)); const step = 360 / c; return `conic-gradient(${Array.from({ length: c }).map((_, i) => `${colors[i % colors.length]} ${i * step}deg ${(i + 1) * step}deg`).join(',')})`; }
