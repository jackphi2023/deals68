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
    if (sr.error || !sr.user) { setMsg(sr.error || 'Không thể tạo tài khoản'); setLoading(false); return; }
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
      setMsg(r === 'affiliate' ? 'Tài khoản Đối tác thị trường đã được tạo. Admin cần duyệt trước khi kích hoạt.' : 'Tài khoản đã được tạo. Vui lòng hoàn tất thanh toán hoặc chờ admin duyệt.');
      setTimeout(() => navigate('/login'), 1400);
    } catch (err: any) {
      setMsg(err?.message || 'Tài khoản đã được tạo, nhưng hồ sơ cần admin hỗ trợ kiểm tra lại.');
    } finally { setLoading(false); }
  }

  return <section className="register-page section alt">
    <div className="container register-layout">
      <main className="card register-card">
        <div className="card-body">
          <span className="badge-title blue">{roleLabel(r as any, 'vi')}</span>
          <h1>{r === 'business' ? 'Đăng ký Doanh nghiệp' : r === 'investor' ? 'Đăng ký Nhà đầu tư' : displayRole === 'market-partner' ? 'Đăng ký Đối tác thị trường' : 'Đăng ký Cố vấn'}</h1>
          <p className="muted">Tài khoản Beta cần xác nhận thanh toán hoặc được admin duyệt trước khi mở toàn bộ quyền cập nhật dữ liệu.</p>
          <div className="stepper"><span className={step===1?'active':''}>1. Tài khoản</span><span className={step===2?'active':''}>2. Hồ sơ</span><span className={step===3?'active':''}>3. Xem lại</span></div>

          <form onSubmit={submit}>
            {step === 1 && <div className="formgrid">
              <label>Email<input className="input" required type="email" value={email} onChange={e=>setEmail(e.target.value)} /></label>
              <label>Mật khẩu<input className="input" required type="password" value={password} onChange={e=>setPassword(e.target.value)} /></label>
              <label>Họ tên / Tên doanh nghiệp<input className="input" required value={name} onChange={e=>setName(e.target.value)} /></label>
              <label>Quốc gia<select className="select" value={country} onChange={e=>setCountry(e.target.value)}><option value="VN">Việt Nam</option><option value="SG">Singapore</option><option value="US">Hoa Kỳ</option><option value="JP">Nhật Bản</option><option value="KR">Hàn Quốc</option><option value="HK">Hồng Kông</option></select></label>
            </div>}

            {step === 2 && <div className="formgrid">
              {r === 'business' && <>
                <label>Gói dịch vụ<select className="select" value={plan} onChange={e=>setPlan(e.target.value as BusinessPlan)}><option value="standard">Gói thường - 100 lượt đề xuất</option><option value="featured">Gói ưu tiên - 200 lượt đề xuất</option></select></label>
                <label>Hình thức giao dịch<select className="select" value={dealType} onChange={e=>setDealType(e.target.value)}><option>Gọi vốn</option><option>Bán cổ phần thiểu số</option><option>Bán toàn bộ doanh nghiệp</option><option>Vay vốn</option><option>Hợp tác chiến lược</option></select></label>
                <label style={{gridColumn:'1/-1'}}>Tiêu đề hồ sơ DN<input className="input" required value={titleVi} onChange={e=>setTitleVi(e.target.value)} /></label>
                <label>Lĩnh vực<input className="input" value={industry} onChange={e=>setIndustry(e.target.value)} placeholder="Y tế, nhà hàng, công nghệ..." /></label>
                <label>Thành phố<input className="input" value={city} onChange={e=>setCity(e.target.value)} placeholder="Hồ Chí Minh" /></label>
                <label>Doanh thu 2025<input className="input" type="number" value={revenue} onChange={e=>setRevenue(e.target.value)} /></label>
                <label>EBITDA %<input className="input" type="number" value={ebitda} onChange={e=>setEbitda(e.target.value)} /></label>
                <label>Số tiền gọi vốn/giá chào<input className="input" type="number" value={ask} onChange={e=>setAsk(e.target.value)} /></label>
                <label>% cổ phần<input className="input" type="number" value={stake} onChange={e=>setStake(e.target.value)} /></label>
              </>}
              {r === 'investor' && <>
                <label style={{gridColumn:'1/-1'}}>Lĩnh vực đầu tư<input className="input" value={industry} onChange={e=>setIndustry(e.target.value)} placeholder="Nhà hàng, y tế, công nghệ" /></label>
                <label>Quy mô đầu tư tối thiểu (USD)<input className="input" type="number" value={ticketMin} onChange={e=>setTicketMin(e.target.value)} /></label>
                <label>Quy mô đầu tư tối đa (USD)<input className="input" type="number" value={ticketMax} onChange={e=>setTicketMax(e.target.value)} /></label>
              </>}
              {(r === 'advisor' || r === 'affiliate') && <div className="notice" style={{gridColumn:'1/-1'}}>Thông tin chi tiết của {displayRole === 'market-partner' ? 'Đối tác thị trường' : 'Cố vấn'} sẽ được admin xác minh sau khi tạo tài khoản. Bảng điều khiển sẽ hiển thị trạng thái chờ duyệt.</div>}
            </div>}

            {step === 3 && <div className="review-box">
              <h3>Xem lại trước khi gửi</h3>
              <div className="summary-row"><span>Vai trò</span><b>{displayRole === 'market-partner' ? 'Đối tác thị trường' : roleLabel(r as any, 'vi')}</b></div>
              <div className="summary-row"><span>Email</span><b>{email || '-'}</b></div>
              <div className="summary-row"><span>Quốc gia</span><b>{country}</b></div>
              <div className="summary-row"><span>Gói / chi phí</span><b>{price.planLabel === 'Featured' ? 'Gói ưu tiên' : 'Gói thường'} · {price.total.toLocaleString()} {price.currency}</b></div>
              {intent.promoCode && <div className="summary-row"><span>Mã khuyến mãi</span><b>{intent.promoCode}</b></div>}
              <p className="notice warn small-note">Sau khi tạo, tài khoản sẽ ở trạng thái chờ thanh toán hoặc chờ admin duyệt. Admin sẽ kích hoạt quyền cập nhật dữ liệu sau khi xác nhận.</p>
            </div>}

            <div className="register-actions">
              {step > 1 && <button type="button" className="btn secondary" onClick={()=>setStep(step-1)}>← Quay lại</button>}
              {step < 3 ? <button type="button" className="btn blue" onClick={()=>setStep(step+1)}>Tiếp tục →</button> : <button className="btn gold" disabled={loading} type="submit">{loading ? 'Đang tạo...' : 'Tạo tài khoản'}</button>}
            </div>
            {msg && <p className={`notice ${msg.includes('Tài khoản') ? 'ok' : 'warn'}`}>{msg}</p>}
          </form>
        </div>
      </main>
      <aside className="card register-side"><div className="card-body"><h3>Kích hoạt Beta</h3><p className="muted">Các tính năng thanh toán tự động, tải hồ sơ nâng cao và duyệt admin sẽ được hoàn thiện sâu hơn ở các giai đoạn sau.</p><div className="summary-row"><span>Tạm tính</span><b>{price.total.toLocaleString()} {price.currency}</b></div><Link className="btn secondary block" to="/pricing">Quay lại bảng giá</Link></div></aside>
    </div>
  </section>;
}
