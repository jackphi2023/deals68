import { FormEvent, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { createBusinessFromProfile, createInvestorForOwner } from '../lib/data';
import { slugify } from '../lib/format';
import { calculatePricing, normaliseRole, roleLabel, type BusinessPlan } from '../lib/pricing';
import { toLocalizedPath } from '../lib/i18nRoutes';
import { supabase, type Role } from '../lib/supabase';
import type { Lang } from '../lib/i18n';

const T = (lang: Lang, vi: string, en: string) => lang === 'en' ? en : vi;
const countries = ['Việt Nam', 'Singapore', 'United States', 'Japan', 'South Korea', 'Hong Kong', 'Thailand', 'Australia'];
const countryIso: Record<string, string> = { 'Việt Nam': 'VN', Singapore: 'SG', 'United States': 'US', Japan: 'JP', 'South Korea': 'KR', 'Hong Kong': 'HK', Thailand: 'TH', Australia: 'AU' };
const industries = ['F&B', 'Y tế & Sức khỏe', 'Bán lẻ', 'Sản xuất', 'Công nghệ', 'Bất động sản', 'Logistics', 'Giáo dục', 'Làm đẹp', 'Năng lượng', 'E-commerce', 'Thủy sản & Xuất khẩu'];
const investorTypes = ['VC', 'PE', 'Institutional', 'Corporate/Strategic', 'Individual/Angel', 'Family Office', 'Lender/Debt'];
const stages = ['Seed', 'Series A', 'Growth', 'Mature', 'Buyout'];
const dealTypes = ['Gọi vốn', 'Bán cổ phần', 'M&A', 'Vay vốn', 'JV / Đối tác'];
function safeUsername(email: string, name: string) { return (email.split('@')[0] || slugify(name)).toLowerCase().replace(/[^a-z0-9._-]/g, '').slice(0, 42); }
function money(v: number, cur: string) { return cur === 'VND' ? Math.round(v).toLocaleString('vi-VN') + ' ₫' : '$' + Math.round(v).toLocaleString('en-US'); }

export default function Register({ lang = 'vi' }: { lang?: Lang }) {
  const { role = 'business' } = useParams();
  const normalized = normaliseRole(role);
  const r = (normalized === 'affiliate' ? 'affiliate' : normalized) as Role;
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const intent = useMemo(() => { try { return JSON.parse(localStorage.getItem('d68_checkout_intent') || '{}'); } catch { return {}; } }, []);
  const [plan, setPlan] = useState<BusinessPlan>(intent.businessPlan === 'featured' ? 'featured' : 'standard');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [country, setCountry] = useState(intent.country === 'GLOBAL' ? 'Singapore' : 'Việt Nam');
  const [industry, setIndustry] = useState('F&B');
  const [city, setCity] = useState('TP.HCM');
  const [companyName, setCompanyName] = useState('');
  const [highlights, setHighlights] = useState('');
  const [dealType, setDealType] = useState('Gọi vốn');
  const [revenue, setRevenue] = useState('');
  const [ebitda, setEbitda] = useState('');
  const [ask, setAsk] = useState('');
  const [stake, setStake] = useState('');
  const [reason, setReason] = useState('');
  const [invType, setInvType] = useState('Individual/Angel');
  const [selectedIndustries, setSelectedIndustries] = useState<string[]>(['F&B', 'Công nghệ']);
  const [stage, setStage] = useState('Growth');
  const [investorDealType, setInvestorDealType] = useState('Gọi vốn');
  const [ticketMin, setTicketMin] = useState('100000');
  const [ticketMax, setTicketMax] = useState('5000000');
  const [desc, setDesc] = useState('');
  const [phone, setPhone] = useState('');
  const [website, setWebsite] = useState('');
  const [agree, setAgree] = useState(false);
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const isBusiness = normalized === 'business';
  const isInvestor = normalized === 'investor';
  const countryCode = countryIso[country] || 'VN';
  const price = calculatePricing({ role: normalized as any, country: countryCode, termWeeks: Number(intent.termWeeks || (isBusiness ? 4 : 12)), businessPlan: plan, promoCode: intent.promoCode }, Number(intent.price?.promoDiscountPct || 0));
  const pricingSummary = intent.price ? `${money(Number(intent.price.total || price.total), intent.price.currency || price.currency)} · ${intent.units || intent.termWeeks || price.termWeeks} ${intent.unitLabel || T(lang, 'tuần', 'weeks')}` : `${money(price.total, price.currency)} · ${price.termWeeks} ${T(lang, 'tuần', 'weeks')}`;
  function toggleIndustry(x: string) { setSelectedIndustries((cur) => cur.includes(x) ? cur.filter((v) => v !== x) : [...cur, x]); }

  async function createPaymentOrder(payload: { userId: string; businessId?: string; investorId?: string; title: string }) {
    const orderPayload = { role: normalized, country: countryCode, plan, checkout_intent: intent, price, source: 'register_beta_reference' };
    const { error } = await supabase.from('payment_orders').insert({ profile_id: payload.userId, created_by: payload.userId, business_id: payload.businessId || null, investor_id: payload.investorId || null, status: 'pending', title: payload.title, payload: orderPayload, visibility: 'admin', sort_order: 0 });
    if (error) throw error;
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!agree) { setMsg(T(lang, 'Vui lòng xác nhận Điều khoản & Chính sách bảo mật.', 'Please confirm Terms & Privacy Policy.')); return; }
    if (password.length < 8) { setMsg(T(lang, 'Mật khẩu cần tối thiểu 8 ký tự.', 'Password must be at least 8 characters.')); return; }
    setLoading(true); setMsg('');
    const realName = name || companyName || email;
    const username = safeUsername(email, realName);
    const sr = await signUp(r, email.trim(), password, { username, display_name: realName, country_iso2: countryCode });
    if (sr.error || !sr.user) { setMsg(sr.error || T(lang, 'Không thể tạo tài khoản', 'Could not create account')); setLoading(false); return; }
    try {
      let businessId = ''; let investorId = '';
      if (isBusiness) {
        const titleVi = `${dealType} · ${industry} · ${city}`;
        const row = await createBusinessFromProfile(sr.user.id, { username, slug: `${slugify(titleVi || realName)}-${Date.now().toString(36)}`, company_name_private: companyName || realName, title_vi: titleVi, title_en: '', country_iso2: countryCode, city, industry, deal_type: dealType, plan, revenue_2025: Number(revenue || 0), revenue_currency: countryCode === 'VN' ? 'VND' : 'USD', ebitda_margin: Number(ebitda || 0), ask_amount: Number(ask || 0), ask_currency: countryCode === 'VN' ? 'VND' : 'USD', stake_pct: Number(stake || 0), quota_total: plan === 'featured' ? 200 : 100, highlights_vi: highlights, highlights_en: '', investment_reason_vi: reason, investment_reason_en: '' });
        businessId = row?.id || '';
      } else if (isInvestor) {
        const row = await createInvestorForOwner(sr.user.id, { code: 'INV-NEW-' + Date.now().toString(36), username, title_vi: `${invType} quan tâm ${selectedIndustries.join(', ')}`, title_en: `${invType} interested in ${selectedIndustries.join(', ')}`, desc_vi: desc, desc_en: '', country_iso2: countryCode, country, region: countryCode === 'VN' ? 'asia' : 'global', industries: selectedIndustries, deal_types: [investorDealType], ticket_min: Number(ticketMin || 0), ticket_max: Number(ticketMax || 0), type: invType, stage, criteria: { sectors: selectedIndustries, stage, dealType: investorDealType }, privacy: { shareEmail: false, email, sharePhone: false, phone, website } });
        investorId = row?.id || '';
      }
      await createPaymentOrder({ userId: sr.user.id, businessId, investorId, title: `${roleLabel(normalized as any, lang)} · ${pricingSummary}` });
      setMsg(T(lang, 'Tài khoản, hồ sơ và đơn thanh toán pending đã được tạo. Admin xác nhận thanh toán để mở dashboard, sau đó duyệt public.', 'Account, profile and pending payment order created. Admin confirms payment to open dashboard, then approves public listing.'));
      setTimeout(() => navigate(toLocalizedPath('/login', lang)), 1700);
    } catch (err: any) { setMsg(err?.message || T(lang, 'Tài khoản đã tạo, nhưng hồ sơ/đơn thanh toán cần Admin kiểm tra lại.', 'Account created, but profile/payment order needs Admin review.')); }
    finally { setLoading(false); }
  }

  return <main className="d68-auth-page d68-register-page"><section className="d68-auth-card d68-register-card"><div className="d68-auth-head"><span>{isBusiness ? '🏢' : isInvestor ? '📈' : '🤝'} {isBusiness ? T(lang, 'Đăng ký Doanh nghiệp', 'Register as Business') : isInvestor ? T(lang, 'Đăng ký Nhà đầu tư', 'Register as Investor') : roleLabel(normalized as any, lang)}</span><h1>{isBusiness ? T(lang, 'Đăng hồ sơ gọi vốn / bán doanh nghiệp', 'List your fundraise / business sale') : isInvestor ? T(lang, 'Tạo hồ sơ Nhà đầu tư', 'Create your Investor profile') : T(lang, 'Tạo tài khoản Deals68', 'Create your Deals68 account')}</h1><p>{isBusiness ? T(lang, 'Hồ sơ public luôn ẩn danh và chỉ hiển thị sau Admin duyệt.', 'Public profiles are always anonymous and visible only after Admin approval.') : T(lang, 'Thông tin liên hệ riêng tư không hiển thị công khai.', 'Private contact details are not displayed publicly.')}</p></div>{intent.createdAt ? <div className="d68-auth-banner">✓ {T(lang, 'Đã lấy gói từ Bảng giá:', 'Plan carried over from Pricing:')} {pricingSummary} <Link to={toLocalizedPath('/pricing', lang)}>{T(lang, 'Đổi lựa chọn', 'Change')}</Link></div> : null}<form onSubmit={submit} className="d68-register-form"><div className="d68-form-grid"><Field label={T(lang, 'Email đăng nhập', 'Login email')}><input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field><Field label={T(lang, 'Mật khẩu', 'Password')}><input required type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={T(lang, 'Tối thiểu 8 ký tự', 'At least 8 characters')} /></Field><Field label={T(lang, 'Tên người phụ trách', 'Contact name')}><input required value={name} onChange={(e) => setName(e.target.value)} /></Field><Field label={T(lang, 'Quốc gia', 'Country')}><select value={country} onChange={(e) => setCountry(e.target.value)}>{countries.map((x) => <option key={x}>{x}</option>)}</select></Field></div>{isBusiness ? <section><h2>{T(lang, 'Thông tin doanh nghiệp', 'Business information')}</h2><div className="d68-form-grid"><Field label={T(lang, 'Tên DN thật (chỉ Admin thấy)', 'Real company name (Admin only)')}><input value={companyName} onChange={(e) => setCompanyName(e.target.value)} /></Field><Field label={T(lang, 'Ngành', 'Industry')}><select value={industry} onChange={(e) => setIndustry(e.target.value)}>{industries.map((x) => <option key={x}>{x}</option>)}</select></Field><Field label={T(lang, 'Thành phố', 'City')}><input value={city} onChange={(e) => setCity(e.target.value)} /></Field><Field label={T(lang, 'Loại giao dịch', 'Deal type')}><select value={dealType} onChange={(e) => setDealType(e.target.value)}>{dealTypes.map((x) => <option key={x}>{x}</option>)}</select></Field><Field label={T(lang, 'Doanh thu 2025', '2025 revenue')}><input type="number" value={revenue} onChange={(e) => setRevenue(e.target.value)} /></Field><Field label="EBITDA margin (%)"><input type="number" value={ebitda} onChange={(e) => setEbitda(e.target.value)} /></Field><Field label={T(lang, 'Nhu cầu vốn/Giá chào', 'Capital sought / Ask')}><input type="number" value={ask} onChange={(e) => setAsk(e.target.value)} /></Field><Field label={T(lang, 'Tỷ lệ cổ phần (%)', 'Stake (%)')}><input type="number" value={stake} onChange={(e) => setStake(e.target.value)} /></Field></div><Field label={T(lang, 'Điểm nổi bật', 'Highlights')}><textarea rows={4} value={highlights} onChange={(e) => setHighlights(e.target.value)} placeholder={T(lang, 'Mỗi ý một dòng hoặc phân cách bằng dấu ;', 'One point per line or separated by ;')} /></Field><Field label={T(lang, 'Lý do gọi vốn/chuyển nhượng', 'Reason for fundraising/sale')}><textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} /></Field><div className="d68-plan-toggle"><button type="button" className={plan === 'standard' ? 'active' : ''} onClick={() => setPlan('standard')}>Standard</button><button type="button" className={plan === 'featured' ? 'active' : ''} onClick={() => setPlan('featured')}>Priority</button></div></section> : null}{isInvestor ? <section><h2>{T(lang, 'Tiêu chí đầu tư', 'Investment criteria')}</h2><div className="d68-form-grid"><Field label={T(lang, 'Loại nhà đầu tư', 'Investor type')}><select value={invType} onChange={(e) => setInvType(e.target.value)}>{investorTypes.map((x) => <option key={x}>{x}</option>)}</select></Field><Field label={T(lang, 'Giai đoạn', 'Stage')}><select value={stage} onChange={(e) => setStage(e.target.value)}>{stages.map((x) => <option key={x}>{x}</option>)}</select></Field><Field label={T(lang, 'Loại giao dịch', 'Deal type')}><select value={investorDealType} onChange={(e) => setInvestorDealType(e.target.value)}>{dealTypes.map((x) => <option key={x}>{x}</option>)}</select></Field><Field label="Ticket min (USD)"><input type="number" value={ticketMin} onChange={(e) => setTicketMin(e.target.value)} /></Field><Field label="Ticket max (USD)"><input type="number" value={ticketMax} onChange={(e) => setTicketMax(e.target.value)} /></Field><Field label={T(lang, 'Website riêng (không public)', 'Private website (not public)')}><input value={website} onChange={(e) => setWebsite(e.target.value)} /></Field><Field label={T(lang, 'Số điện thoại riêng', 'Private phone')}><input value={phone} onChange={(e) => setPhone(e.target.value)} /></Field></div><div className="d68-chip-select">{industries.map((x) => <button key={x} type="button" className={selectedIndustries.includes(x) ? 'active' : ''} onClick={() => toggleIndustry(x)}>{x}</button>)}</div><Field label={T(lang, 'Mô tả khẩu vị đầu tư', 'Investment appetite description')}><textarea rows={4} value={desc} onChange={(e) => setDesc(e.target.value)} /></Field></section> : null}<label className="d68-agree"><input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} /> {T(lang, 'Tôi đồng ý Điều khoản & Chính sách bảo mật.', 'I agree to Terms & Privacy Policy.')}</label>{msg ? <div className="d68-auth-msg">{msg}</div> : null}<button disabled={loading} className="d68-auth-submit">{loading ? T(lang, 'Đang tạo...', 'Creating...') : T(lang, 'Tạo tài khoản & đơn thanh toán', 'Create account & payment order')}</button></form></section></main>;
}
function Field({ label, children }: { label: string; children: any }) { return <label className="d68-auth-field"><span>{label}</span>{children}</label>; }
