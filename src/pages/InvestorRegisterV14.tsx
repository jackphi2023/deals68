import { type FormEvent, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  InvestorCountryTagPicker,
  InvestorDealTypeTagPicker,
  InvestorRegionTagPicker,
  InvestorStageMultiTagPicker,
  InvestorTypeMultiTagPicker,
} from '../components/investor/InvestorCriteriaTagPickers';
import { IndustryTagPicker } from '../components/investor/IndustryTagPicker';
import { useAuth } from '../contexts/AuthContext';
import { createSignupBundle } from '../lib/data';
import type { Lang } from '../lib/i18n';
import { toLocalizedPath } from '../lib/i18nRoutes';
import { industryOptions } from '../lib/industryTaxonomy';
import {
  INVESTOR_TYPE_OPTIONS,
  optionLabels,
} from '../lib/investorCriteriaOptions';
import {
  T,
  countryOptions,
  phoneDialFromIso,
} from '../lib/labels';
import { formatNumberTyping, parseFormattedNumber } from '../lib/numberFormat';
import { makePaymentOrderCode } from '../lib/paymentOrders';
import { calculatePricing, lookupPromo } from '../lib/pricing';
import { supabase } from '../lib/supabase';

const STATIC_VIETQR_URL = '/assets/vietqr-vcb.png';
const INVESTOR_MONTH_OPTIONS = [3, 6, 12];

function safeUsername(email: string, name: string) {
  return (email.split('@')[0] || name)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9._-]/g, '')
    .slice(0, 42);
}

function money(value: number, currency: string) {
  return currency === 'VND'
    ? `${Math.round(value).toLocaleString('vi-VN')} ₫`
    : `$${Math.round(value).toLocaleString('en-US')}`;
}

function countryName(iso2: string, lang: Lang) {
  const option = countryOptions.find((item) => item.iso2 === iso2);
  return option ? T(lang, option.vi, option.en) : iso2;
}

function industryLabels(keys: string[], lang: Lang) {
  return keys.map((key) => {
    const option = industryOptions.find((item) => item.key === key);
    return option ? T(lang, option.vi, option.en) : key;
  });
}

function officeRegion(iso2: string) {
  if (['US', 'CA', 'BR'].includes(iso2)) return 'americas';
  if (['DE', 'GB', 'CZ'].includes(iso2)) return 'europe';
  if (['AU'].includes(iso2)) return 'oceania';
  if (['AE'].includes(iso2)) return 'middle_east';
  return 'asia';
}

export default function InvestorRegisterV14({ lang }: { lang: Lang }) {
  const { signUp, signOut } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [contactName, setContactName] = useState('');
  const [countryIso2, setCountryIso2] = useState('VN');
  const [phoneIso2, setPhoneIso2] = useState('VN');
  const [phone, setPhone] = useState('');
  const [website, setWebsite] = useState('');
  const [investorTypes, setInvestorTypes] = useState<string[]>(['Individual/Angel']);
  const [stages, setStages] = useState<string[]>(['Growth']);
  const [targetRegions, setTargetRegions] = useState<string[]>(['vietnam', 'southeast_asia']);
  const [targetCountries, setTargetCountries] = useState<string[]>(['VN']);
  const [industries, setIndustries] = useState<string[]>(['food_beverage', 'it_software']);
  const [dealTypes, setDealTypes] = useState<string[]>(['Investment']);
  const [ticketMin, setTicketMin] = useState(formatNumberTyping('100000'));
  const [ticketMax, setTicketMax] = useState(formatNumberTyping('5000000'));
  const [description, setDescription] = useState('');
  const [appetite, setAppetite] = useState('');
  const [months, setMonths] = useState(12);
  const [promoCode, setPromoCode] = useState('');
  const [promoPct, setPromoPct] = useState(0);
  const [promoMessage, setPromoMessage] = useState('');
  const [paymentAck, setPaymentAck] = useState(false);
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [qrFailed, setQrFailed] = useState(false);
  const [orderCode] = useState(() => makePaymentOrderCode('INVREG'));

  const price = useMemo(
    () => calculatePricing(
      { role: 'investor', country: countryIso2, termWeeks: months * 4, promoCode },
      promoPct,
    ),
    [countryIso2, months, promoCode, promoPct],
  );

  const qrUrl = qrFailed
    ? STATIC_VIETQR_URL
    : `https://img.vietqr.io/image/VCB-0011004000713-compact2.png?amount=${Math.round(price.total)}&addInfo=${encodeURIComponent(orderCode)}&accountName=${encodeURIComponent('Tieu Vo Dinh Phi')}`;

  async function applyPromo() {
    setPromoMessage('');
    const result = await lookupPromo(promoCode, 'investor').catch(() => ({ discountPct: 0, message: T(lang, 'Không kiểm tra được mã khuyến mãi.', 'Could not validate promo code.') }));
    setPromoPct(result.discountPct);
    setPromoMessage(result.message);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setMessage('');

    const minTicket = parseFormattedNumber(ticketMin);
    const maxTicket = parseFormattedNumber(ticketMax);
    const missing: string[] = [];
    if (!email.trim()) missing.push(T(lang, 'Email đăng nhập', 'Login email'));
    if (password.length < 8) missing.push(T(lang, 'Mật khẩu tối thiểu 8 ký tự', 'Password of at least 8 characters'));
    if (!contactName.trim()) missing.push(T(lang, 'Tên người phụ trách', 'Contact name'));
    if (!investorTypes.length) missing.push(T(lang, 'Loại hình nhà đầu tư', 'Investor type'));
    if (!stages.length) missing.push(T(lang, 'Giai đoạn phù hợp', 'Preferred stages'));
    if (!industries.length) missing.push(T(lang, 'Ngành quan tâm', 'Preferred industries'));
    if (!dealTypes.length) missing.push(T(lang, 'Loại giao dịch quan tâm', 'Preferred deal types'));
    if (!targetCountries.length && !targetRegions.length) missing.push(T(lang, 'Khu vực hoặc thị trường quan tâm', 'Target region or market'));
    if (!description.trim()) missing.push(T(lang, 'Giới thiệu chung', 'General introduction'));
    if (!minTicket || !maxTicket) missing.push(T(lang, 'Khoản đầu tư', 'Ticket size'));
    if (minTicket > maxTicket) missing.push(T(lang, 'Khoản đầu tư tối thiểu phải nhỏ hơn hoặc bằng tối đa', 'Minimum ticket must not exceed maximum'));
    if (!paymentAck) missing.push(T(lang, 'Xác nhận chuyển khoản', 'Payment confirmation'));
    if (!agree) missing.push(T(lang, 'Đồng ý Điều khoản và Chính sách bảo mật', 'Agreement to Terms and Privacy Policy'));

    if (missing.length) {
      setError(T(lang, `Vui lòng hoàn tất: ${missing.join(', ')}.`, `Please complete: ${missing.join(', ')}.`));
      return;
    }

    setBusy(true);
    try {
      const duplicate = await supabase.rpc('investor_public_email_exists', { email_text: email.trim() }).catch(() => ({ data: false } as any));
      if (duplicate?.data) throw new Error(T(lang, 'Email đã được đăng ký. Vui lòng đăng nhập hoặc liên hệ hỗ trợ.', 'This email is already registered. Please sign in or contact support.'));

      const username = safeUsername(email, contactName);
      const signupNonce = typeof globalThis.crypto?.randomUUID === 'function'
        ? globalThis.crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const signup = await signUp('investor', email.trim(), password, {
        username,
        display_name: contactName.trim(),
        country_iso2: countryIso2,
        language_code: lang,
        timezone: 'Asia/Ho_Chi_Minh',
        signup_nonce: signupNonce,
      });
      if (signup.error || !signup.user) throw new Error(signup.error || T(lang, 'Không thể tạo tài khoản.', 'Could not create account.'));

      const typeLabelsVi = optionLabels(investorTypes, INVESTOR_TYPE_OPTIONS, 'vi');
      const typeLabelsEn = optionLabels(investorTypes, INVESTOR_TYPE_OPTIONS, 'en');
      const industryLabelsVi = industryLabels(industries, 'vi');
      const industryLabelsEn = industryLabels(industries, 'en');
      const titleVi = `${typeLabelsVi.join(', ')} quan tâm ${industryLabelsVi.join(', ')}`;
      const titleEn = `${typeLabelsEn.join(', ')} interested in ${industryLabelsEn.join(', ')}`;
      const phoneValue = `${phoneDialFromIso(phoneIso2)} ${phone}`.trim();

      await createSignupBundle({
        userId: signup.user.id,
        email: email.trim(),
        signupNonce,
        role: 'investor',
        profile: {
          username,
          display_name: contactName.trim(),
          country_iso2: countryIso2,
          language_code: lang,
          timezone: 'Asia/Ho_Chi_Minh',
          phone_country_iso2: phoneIso2,
          phone: phoneValue,
        },
        investor: {
          code: 'INV-PENDING',
          username,
          type: investorTypes[0],
          title_vi: titleVi,
          title_en: titleEn,
          desc_vi: lang === 'vi' ? description.trim() : '',
          desc_en: lang === 'en' ? description.trim() : '',
          country_iso2: countryIso2,
          country: countryOptions.find((item) => item.iso2 === countryIso2)?.en || countryIso2,
          region: officeRegion(countryIso2),
          industries,
          deal_types: dealTypes,
          stage: stages[0],
          ticket_min: minTicket,
          ticket_max: maxTicket,
          criteria: {
            investorTypes,
            stages,
            targetRegions,
            targetCountries,
            preferredCountries: targetCountries,
            targetCountriesCache: targetCountries,
            sectors: industries,
            dealTypes,
            investment_appetite: appetite.trim(),
          },
          privacy: {
            shareEmail: false,
            email: email.trim(),
            sharePhone: false,
            phone: phoneValue,
            shareWebsite: false,
            website: website.trim(),
            preferredCountries: targetCountries,
          },
        },
        payment: {
          title: `${T(lang, 'Nhà đầu tư', 'Investor')} · ${months} ${T(lang, 'tháng', 'months')} · ${money(price.total, price.currency)}`,
          role: 'investor',
          country: countryIso2,
          plan: 'membership',
          price,
          orderCode,
          bankContent: orderCode,
          source: 'investor_register_v14',
        },
      });

      setMessage(T(lang, 'Đã tạo hồ sơ Nhà đầu tư. Vui lòng xác thực email và chờ Admin xác nhận thanh toán/kích hoạt.', 'Investor profile created. Verify your email and wait for administrator payment confirmation/activation.'));
      await signOut().catch(() => undefined);
      setTimeout(() => navigate(`${toLocalizedPath('/login', lang)}?registered=investor`), 700);
    } catch (submitError: any) {
      setError(submitError?.message || T(lang, 'Không tạo được hồ sơ Nhà đầu tư.', 'Could not create Investor profile.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="d68-auth-page d68-register-page">
      <section className="d68-auth-card d68-register-card">
        <div className="d68-auth-head">
          <span>📈 {T(lang, 'Đăng ký Nhà đầu tư', 'Register as Investor')}</span>
          <h1>{T(lang, 'Tạo hồ sơ Nhà đầu tư', 'Create your Investor profile')}</h1>
          <p>{T(lang, 'Thông tin liên hệ riêng tư không hiển thị công khai. Dữ liệu lựa chọn được dùng thống nhất tại Dashboard và Admin.', 'Private contact details are not public. Selected values remain consistent across Dashboard and Admin.')}</p>
        </div>

        <form onSubmit={submit} className="d68-register-form">
          <section className="d68-register-section d68-register-section--account">
            <h2>{T(lang, 'Thông tin tài khoản', 'Account information')}</h2>
            <div className="d68-form-grid">
              <label className="d68-auth-field"><span>{T(lang, 'Email đăng nhập', 'Login email')}</span><input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
              <label className="d68-auth-field"><span>{T(lang, 'Mật khẩu', 'Password')}</span><input required type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder={T(lang, 'Tối thiểu 8 ký tự', 'At least 8 characters')} /></label>
              <label className="d68-auth-field"><span>{T(lang, 'Tên người phụ trách', 'Contact name')}</span><input required value={contactName} onChange={(event) => setContactName(event.target.value)} /></label>
              <label className="d68-auth-field"><span>{T(lang, 'Quốc gia trụ sở', 'Headquarters country')}</span><select value={countryIso2} onChange={(event) => setCountryIso2(event.target.value)}>{countryOptions.map((item) => <option key={item.iso2} value={item.iso2}>{T(lang, item.vi, item.en)}</option>)}</select></label>
              <label className="d68-auth-field"><span>{T(lang, 'Website riêng', 'Private website')}</span><input value={website} onChange={(event) => setWebsite(event.target.value)} /></label>
              <label className="d68-auth-field"><span>{T(lang, 'Số điện thoại / WhatsApp / Zalo', 'Phone / WhatsApp / Zalo')}</span><div className="d68-phone-row"><select value={phoneIso2} onChange={(event) => setPhoneIso2(event.target.value)}>{countryOptions.map((item) => <option key={item.iso2} value={item.iso2}>{item.dial} · {item.iso2}</option>)}</select><input value={phone} onChange={(event) => setPhone(event.target.value)} /></div></label>
            </div>
          </section>

          <section className="d68-register-section">
            <h2>{T(lang, 'Cấu trúc Nhà đầu tư', 'Investor structure')}</h2>
            <div className="d68-field-group"><h3>{T(lang, 'Loại hình nhà đầu tư', 'Investor type')}</h3><InvestorTypeMultiTagPicker lang={lang} values={investorTypes} onChange={setInvestorTypes} /></div>
            <div className="d68-field-group"><h3>{T(lang, 'Giai đoạn phù hợp', 'Preferred stages')}</h3><InvestorStageMultiTagPicker lang={lang} values={stages} onChange={setStages} /></div>
            <div className="d68-field-group"><h3>{T(lang, 'Khu vực đầu tư', 'Investment regions')}</h3><InvestorRegionTagPicker lang={lang} values={targetRegions} onChange={setTargetRegions} /></div>
            <div className="d68-field-group"><h3>{T(lang, 'Thị trường quan tâm', 'Target markets')}</h3><InvestorCountryTagPicker lang={lang} values={targetCountries} onChange={setTargetCountries} /></div>
            <div className="d68-field-group"><h3>{T(lang, 'Ngành quan tâm', 'Preferred industries')}</h3><IndustryTagPicker lang={lang} values={industries} onChange={setIndustries} defaultExpanded /></div>
            <div className="d68-field-group"><h3>{T(lang, 'Loại giao dịch quan tâm', 'Preferred deal types')}</h3><InvestorDealTypeTagPicker lang={lang} values={dealTypes} onChange={setDealTypes} /></div>
            <div className="d68-form-grid">
              <label className="d68-auth-field"><span>{T(lang, 'Khoản đầu tư tối thiểu (USD)', 'Minimum ticket (USD)')}</span><input inputMode="numeric" value={ticketMin} onChange={(event) => setTicketMin(formatNumberTyping(event.target.value))} /></label>
              <label className="d68-auth-field"><span>{T(lang, 'Khoản đầu tư tối đa (USD)', 'Maximum ticket (USD)')}</span><input inputMode="numeric" value={ticketMax} onChange={(event) => setTicketMax(formatNumberTyping(event.target.value))} /></label>
            </div>
            <label className="d68-auth-field d68-auth-field--wide d68-auth-field--spaced"><span>{T(lang, 'Giới thiệu chung', 'General introduction')}</span><textarea rows={4} value={description} onChange={(event) => setDescription(event.target.value)} /></label>
            <label className="d68-auth-field d68-auth-field--wide d68-auth-field--spaced"><span>{T(lang, 'Khẩu vị đầu tư', 'Investment appetite')}</span><textarea rows={4} value={appetite} onChange={(event) => setAppetite(event.target.value)} /></label>
          </section>

          <section className="d68-register-section">
            <h2>{T(lang, 'Gói dịch vụ và thanh toán', 'Service package and payment')}</h2>
            <div className="d68-form-grid">
              <label className="d68-auth-field"><span>{T(lang, 'Thời hạn', 'Term')}</span><select value={months} onChange={(event) => setMonths(Number(event.target.value))}>{INVESTOR_MONTH_OPTIONS.map((item) => <option key={item} value={item}>{item} {T(lang, 'tháng', 'months')}</option>)}</select></label>
              <label className="d68-auth-field"><span>{T(lang, 'Mã khuyến mãi', 'Promo code')}</span><div className="d68-phone-row"><input value={promoCode} onChange={(event) => { setPromoCode(event.target.value.toUpperCase()); setPromoPct(0); }} /><button type="button" className="d68-dashboard-btn light" onClick={applyPromo}>{T(lang, 'Áp dụng', 'Apply')}</button></div>{promoMessage ? <small>{promoMessage}</small> : null}</label>
            </div>
            <div className="d68-bizreg-qrbox">
              <a href={qrUrl} target="_blank" rel="noreferrer"><img src={qrUrl} alt="QR Vietcombank" onError={() => setQrFailed(true)} /></a>
              <div>
                <p>{T(lang, 'Người nhận:', 'Recipient:')} <b>Tieu Vo Dinh Phi</b></p>
                <p>{T(lang, 'Số TK:', 'Account no.:')} <b>0011004000713</b></p>
                <p>{T(lang, 'Nội dung:', 'Transfer note:')} <b>{orderCode}</b></p>
                <p>{T(lang, 'Số tiền:', 'Amount:')} <b>{money(price.total, price.currency)}</b></p>
              </div>
              <label><input type="checkbox" checked={paymentAck} onChange={(event) => setPaymentAck(event.target.checked)} /> {T(lang, 'Tôi đã chuyển khoản đúng số tiền và nội dung ở trên', 'I transferred the exact amount with the transfer note above')}</label>
            </div>
          </section>

          <label className="d68-agree"><input type="checkbox" checked={agree} onChange={(event) => setAgree(event.target.checked)} /> {T(lang, 'Tôi đồng ý Điều khoản & Chính sách bảo mật.', 'I agree to the Terms & Privacy Policy.')}</label>
          {message ? <div className="d68-auth-msg ok">{message}</div> : null}
          {error ? <div className="d68-auth-msg err">{error}</div> : null}
          <button disabled={busy} className="d68-auth-submit">{busy ? T(lang, 'Đang tạo...', 'Creating...') : T(lang, 'Tạo tài khoản Nhà đầu tư', 'Create Investor account')}</button>
          <p className="d68-auth-switch">{T(lang, 'Đã có tài khoản?', 'Already have an account?')} <Link to={toLocalizedPath('/login', lang)}>{T(lang, 'Đăng nhập', 'Sign in')}</Link></p>
        </form>
      </section>
    </main>
  );
}
