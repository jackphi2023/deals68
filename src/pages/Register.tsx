import { FormEvent, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { createBusinessFromProfile, createInvestorForOwner } from '../lib/data';
import { slugify } from '../lib/format';
import { autoEnglishFromVietnamese } from '../lib/i18n';
import type { Role } from '../lib/supabase';
import { calculatePricing, normaliseRole, roleLabel, type BusinessPlan } from '../lib/pricing';

function safeUsername(email: string, name: string) {
  return (email.split('@')[0] || slugify(name)).toLowerCase().replace(/[^a-z0-9._-]/g, '').slice(0, 42);
}

export default function Register() {
  const { role = 'business' } = useParams();
  const r = normaliseRole(role) as Role;
  const displayRole = r === 'affiliate' ? 'market-partner' : r;
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const intent = useMemo(() => { try { return JSON.parse(localStorage.getItem('d68_checkout_intent') || '{}'); } catch { return {}; } }, []);
  const [step, setStep] = useState(1);
  const [plan, setPlan] = useState<BusinessPlan>(intent.businessPlan || 'standard');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('deals68User68!');
  const [name, setName] = useState('');
  const [titleVi, setTitleVi] = useState('');
  const [industry, setIndustry] = useState('');
  const [country, setCountry] = useState(intent.country || 'VN');
  const [city, setCity] = useState('');
  const [dealType, setDealType] = useState('Fundraise');
  const [revenue, setRevenue] = useState('');
  const [ebitda, setEbitda] = useState('');
  const [ask, setAsk] = useState('');
  const [stake, setStake] = useState('');
  const [ticketMin, setTicketMin] = useState('0');
  const [ticketMax, setTicketMax] = useState('5000000');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const price = calculatePricing({ role: r as any, country, termWeeks: Number(intent.termWeeks || 4), businessPlan: plan, promoCode: intent.promoCode }, Number(intent.price?.promoDiscountPct || 0));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setLoading(true); setMsg('');
    const username = safeUsername(email, name);
    const sr = await signUp(r, email.trim(), password, { username, display_name: name, country_iso2: country });
    if (sr.error || !sr.user) { setMsg(sr.error || 'Cannot create account'); setLoading(false); return; }
    try {
      if (r === 'business') {
        await createBusinessFromProfile(sr.user.id, {
          username,
          slug: slugify(titleVi || name) + '-' + Date.now().toString(36),
          public_code: 'D68-NEW',
          company_name_private: name,
          title_vi: titleVi || `Cơ hội đầu tư ${industry || 'doanh nghiệp'}`,
          title_en: autoEnglishFromVietnamese(titleVi || `Investment opportunity in ${industry || 'business'}`),
          country_iso2: country,
          city,
          industry,
          deal_type: dealType,
          plan,
          revenue_2025: Number(revenue || 0),
          revenue_currency: country === 'VN' ? 'VND' : 'USD',
          ebitda_margin: Number(ebitda || 0),
          ask_amount: Number(ask || 0),
          ask_currency: country === 'VN' ? 'VND' : 'USD',
          stake_pct: Number(stake || 0),
          quota_total: plan === 'featured' ? 200 : 100,
          highlights_vi: '', highlights_en: '', investment_reason_vi: '', investment_reason_en: ''
        });
      }
      if (r === 'investor') {
        await createInvestorForOwner(sr.user.id, {
          code: 'INV-NEW-' + Date.now().toString(36),
          username,
          title_vi: `Nhà đầu tư quan tâm ${industry || 'doanh nghiệp Việt Nam'}`,
          title_en: `Investor interested in ${industry || 'Vietnam businesses'}`,
          country_iso2: country,
          country,
          region: country === 'VN' ? 'Vietnam' : 'Global',
          industries: industry ? industry.split(',').map(x=>x.trim()).filter(Boolean) : [],
          deal_types: ['equity', 'M&A'],
          ticket_min: Number(ticketMin || 0),
          ticket_max: Number(ticketMax || 0),
          type: 'Individual/Angel',
          criteria: { revenueRange: '', ebitdaRange: '', sectors: industry ? [industry] : [] },
          privacy: { shareEmail: false, email, sharePhone: false, phone: '', phoneCountry: country }
        });
      }
      setMsg(r === 'affiliate' ? 'Market Partner account created. Admin approval is required before activation.' : 'Account created. Please complete payment/admin approval.');
      setTimeout(() => navigate('/login'), 1400);
    } catch (err: any) {
      setMsg(err?.message || 'Account created, but profile setup needs admin support.');
    } finally { setLoading(false); }
  }

  return <section className="register-page section alt">
    <div className="container register-layout">
      <main className="card register-card">
        <div className="card-body">
          <span className="badge-title blue">{roleLabel(r as any, 'vi')}</span>
          <h1>{r === 'business' ? 'Đăng ký Doanh nghiệp' : r === 'investor' ? 'Đăng ký Nhà đầu tư' : displayRole === 'market-partner' ? 'Đăng ký Market Partner' : 'Đăng ký Cố vấn'}</h1>
          <p className="muted">Tài khoản Beta cần xác nhận thanh toán hoặc duyệt admin trước khi mở toàn bộ quyền ghi dữ liệu.</p>
          <div className="stepper"><span className={step===1?'active':''}>1. Account</span><span className={step===2?'active':''}>2. Profile</span><span className={step===3?'active':''}>3. Review</span></div>

          <form onSubmit={submit}>
            {step === 1 && <div className="formgrid">
              <label>Email<input className="input" required type="email" value={email} onChange={e=>setEmail(e.target.value)} /></label>
              <label>Password<input className="input" required type="password" value={password} onChange={e=>setPassword(e.target.value)} /></label>
              <label>Name / Company<input className="input" required value={name} onChange={e=>setName(e.target.value)} /></label>
              <label>Country<select className="select" value={country} onChange={e=>setCountry(e.target.value)}><option value="VN">Vietnam</option><option value="SG">Singapore</option><option value="US">United States</option><option value="JP">Japan</option><option value="KR">Korea</option><option value="HK">Hong Kong</option></select></label>
            </div>}

            {step === 2 && <div className="formgrid">
              {r === 'business' && <>
                <label>Gói dịch vụ<select className="select" value={plan} onChange={e=>setPlan(e.target.value as BusinessPlan)}><option value="standard">Standard - 100 proposals</option><option value="featured">Featured - 200 proposals</option></select></label>
                <label>Deal type<select className="select" value={dealType} onChange={e=>setDealType(e.target.value)}><option>Fundraise</option><option>Sell minority stake</option><option>Sell business</option><option>Debt / Loan</option><option>Strategic partnership</option></select></label>
                <label style={{gridColumn:'1/-1'}}>Tiêu đề hồ sơ DN<input className="input" required value={titleVi} onChange={e=>setTitleVi(e.target.value)} /></label>
                <label>Lĩnh vực<input className="input" value={industry} onChange={e=>setIndustry(e.target.value)} placeholder="Healthcare, F&B, Technology..." /></label>
                <label>Thành phố<input className="input" value={city} onChange={e=>setCity(e.target.value)} placeholder="Hồ Chí Minh" /></label>
                <label>Doanh thu 2025<input className="input" type="number" value={revenue} onChange={e=>setRevenue(e.target.value)} /></label>
                <label>EBITDA %<input className="input" type="number" value={ebitda} onChange={e=>setEbitda(e.target.value)} /></label>
                <label>Số tiền gọi vốn/giá chào<input className="input" type="number" value={ask} onChange={e=>setAsk(e.target.value)} /></label>
                <label>% cổ phần<input className="input" type="number" value={stake} onChange={e=>setStake(e.target.value)} /></label>
              </>}
              {r === 'investor' && <>
                <label style={{gridColumn:'1/-1'}}>Investment sectors<input className="input" value={industry} onChange={e=>setIndustry(e.target.value)} placeholder="F&B, Healthcare, Technology" /></label>
                <label>Ticket min USD<input className="input" type="number" value={ticketMin} onChange={e=>setTicketMin(e.target.value)} /></label>
                <label>Ticket max USD<input className="input" type="number" value={ticketMax} onChange={e=>setTicketMax(e.target.value)} /></label>
              </>}
              {(r === 'advisor' || r === 'affiliate') && <div className="notice" style={{gridColumn:'1/-1'}}>Thông tin chi tiết của {displayRole === 'market-partner' ? 'Market Partner' : 'Advisor'} sẽ được admin xác minh sau khi tạo tài khoản. Dashboard sẽ hiển thị trạng thái pending approval.</div>}
            </div>}

            {step === 3 && <div className="review-box">
              <h3>Review before submit</h3>
              <div className="summary-row"><span>Role</span><b>{displayRole === 'market-partner' ? 'Market Partner' : roleLabel(r as any, 'en')}</b></div>
              <div className="summary-row"><span>Email</span><b>{email || '-'}</b></div>
              <div className="summary-row"><span>Country</span><b>{country}</b></div>
              <div className="summary-row"><span>Plan / price</span><b>{price.planLabel} · {price.total.toLocaleString()} {price.currency}</b></div>
              {intent.promoCode && <div className="summary-row"><span>Promo</span><b>{intent.promoCode}</b></div>}
              <p className="notice warn small-note">Sau khi tạo, tài khoản ở trạng thái payment pending / pending admin review. Admin sẽ kích hoạt quyền ghi dữ liệu sau khi xác nhận.</p>
            </div>}

            <div className="register-actions">
              {step > 1 && <button type="button" className="btn secondary" onClick={()=>setStep(step-1)}>← Back</button>}
              {step < 3 ? <button type="button" className="btn blue" onClick={()=>setStep(step+1)}>Continue →</button> : <button className="btn gold" disabled={loading} type="submit">{loading ? 'Creating...' : 'Create account'}</button>}
            </div>
            {msg && <p className={`notice ${msg.includes('created') ? 'ok' : 'warn'}`}>{msg}</p>}
          </form>
        </div>
      </main>
      <aside className="card register-side"><div className="card-body"><h3>Beta activation</h3><p className="muted">Các tính năng payment tự động, upload hồ sơ nâng cao và admin approval sẽ được build sâu hơn ở các phase sau.</p><div className="summary-row"><span>Price intent</span><b>{price.total.toLocaleString()} {price.currency}</b></div><Link className="btn secondary block" to="/pricing">Back to pricing</Link></div></aside>
    </div>
  </section>;
}
