import { FormEvent, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { countryOptions, phoneDialFromIso, T } from '../lib/labels';
import { toLocalizedPath } from '../lib/i18nRoutes';
import {
  createAdvisorSignup,
  safeAdvisorUsername,
  type AdvisorType,
} from '../lib/advisorAuth';
import type { Lang } from '../lib/i18n';

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function signupError(lang: Lang, raw?: string, code?: string) {
  const text = `${code || ''} ${raw || ''}`.toLowerCase();
  if (
    text.includes('already') ||
    text.includes('duplicate') ||
    text.includes('user_already_exists') ||
    text.includes('email_address_invalid')
  ) {
    return T(lang, 'Email không hợp lệ hoặc đã được đăng ký.', 'The email is invalid or already registered.');
  }
  return raw || T(lang, 'Không thể gửi hồ sơ Advisor.', 'Could not submit the Advisor application.');
}

export default function AdvisorRegister({ lang = 'vi' }: { lang?: Lang }) {
  const { signUp, signOut } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [advisorType, setAdvisorType] = useState<AdvisorType>('advisor');
  const [title, setTitle] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [countryIso2, setCountryIso2] = useState('VN');
  const [phoneIso2, setPhoneIso2] = useState('VN');
  const [phone, setPhone] = useState('');
  const [website, setWebsite] = useState('');
  const [introduction, setIntroduction] = useState('');
  const [expertiseText, setExpertiseText] = useState('');
  const [agree, setAgree] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'ok' | 'err' | ''>('');

  const expertise = useMemo(
    () => Array.from(new Set(expertiseText.split(/[,;\n]/).map((item) => item.trim()).filter(Boolean))).slice(0, 12),
    [expertiseText],
  );

  async function submit(event: FormEvent) {
    event.preventDefault();
    setMessage('');
    setMessageType('');

    const missing: string[] = [];
    if (!validEmail(email)) missing.push(T(lang, 'Email hợp lệ', 'Valid email'));
    if (password.length < 8) missing.push(T(lang, 'Mật khẩu tối thiểu 8 ký tự', 'Password with at least 8 characters'));
    if (!displayName.trim()) missing.push(T(lang, 'Họ và tên', 'Full name'));
    if (!title.trim()) missing.push(T(lang, 'Chức danh chuyên môn', 'Professional title'));
    if (!phone.trim()) missing.push(T(lang, 'Số điện thoại', 'Phone number'));
    if (!introduction.trim()) missing.push(T(lang, 'Giới thiệu kinh nghiệm', 'Professional introduction'));
    if (!expertise.length) missing.push(T(lang, 'Lĩnh vực chuyên môn', 'Areas of expertise'));
    if (!agree) missing.push(T(lang, 'Đồng ý Điều khoản và Chính sách bảo mật', 'Agreement to Terms and Privacy Policy'));

    if (missing.length) {
      setMessageType('err');
      setMessage(T(lang, `Vui lòng hoàn tất: ${missing.join(', ')}.`, `Please complete: ${missing.join(', ')}.`));
      return;
    }

    setLoading(true);
    const normalizedEmail = email.trim().toLowerCase();
    const username = safeAdvisorUsername(normalizedEmail, displayName);
    const signupNonce = typeof globalThis.crypto?.randomUUID === 'function'
      ? globalThis.crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;

    try {
      const result = await signUp('advisor', normalizedEmail, password, {
        username,
        display_name: displayName.trim(),
        country_iso2: countryIso2,
        language_code: lang,
        timezone: 'Asia/Ho_Chi_Minh',
        signup_nonce: signupNonce,
      });

      if (result.error || !result.user || result.user.identities?.length === 0) {
        throw Object.assign(new Error(result.error || 'Email already registered'), { code: result.code });
      }

      await createAdvisorSignup({
        userId: result.user.id,
        email: normalizedEmail,
        signupNonce,
        profile: {
          username,
          display_name: displayName.trim(),
          country_iso2: countryIso2,
          language_code: lang,
          timezone: 'Asia/Ho_Chi_Minh',
          phone_country_iso2: phoneIso2,
          phone: `${phoneDialFromIso(phoneIso2)} ${phone.trim()}`.trim(),
        },
        advisor: {
          advisor_type: advisorType,
          title: title.trim(),
          company_name: companyName.trim() || undefined,
          website: website.trim() || undefined,
          introduction: introduction.trim(),
          expertise,
        },
      });

      await signOut().catch(() => undefined);
      setMessageType('ok');
      setMessage(T(
        lang,
        'Hồ sơ Advisor đã được tạo. Mã OTP đã gửi đến email; vui lòng xác thực để vào trang trạng thái tài khoản.',
        'Your Advisor application has been created. An OTP was sent to your email; verify it to access your account status page.',
      ));
      const loginPath = `/advisor/login?email=${encodeURIComponent(normalizedEmail)}&otp=1&signup=1&next=${encodeURIComponent(lang === 'en' ? '/en/dashboard/advisor' : '/dashboard/advisor')}`;
      window.setTimeout(() => navigate(toLocalizedPath(loginPath, lang), { replace: true }), 1200);
    } catch (error: any) {
      setMessageType('err');
      setMessage(signupError(lang, error?.message, error?.code));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="d68-auth-page d68-register-page d68-advisor-auth-page">
      <section className="d68-auth-card d68-register-card d68-advisor-register-card">
        <div className="d68-auth-head">
          <span>{T(lang, 'Advisor / Broker', 'Advisor / Broker')}</span>
          <h1>{T(lang, 'Đăng ký Cố vấn hoặc Môi giới', 'Advisor or Broker registration')}</h1>
          <p>{T(
            lang,
            'Tạo một tài khoản Advisor độc lập. Sau khi xác thực email, hồ sơ sẽ chờ Deals68 kiểm tra trước khi được phân công quản lý doanh nghiệp.',
            'Create a separate Advisor account. After email verification, Deals68 will review the application before any Business assignment is granted.',
          )}</p>
        </div>

        <div className="d68-advisor-security-note">
          <b>{T(lang, 'Chưa cấp quyền doanh nghiệp', 'No Business access yet')}</b>
          <span>{T(
            lang,
            'Đăng ký Advisor không tự tạo quyền với bất kỳ hồ sơ doanh nghiệp nào. Mọi quyền sau này phải được Admin xác minh và cấp theo phạm vi.',
            'Advisor registration does not grant access to any Business profile. Future access must be verified and assigned by an Admin with explicit scopes.',
          )}</span>
        </div>

        <form className="d68-register-form" onSubmit={submit}>
          <section>
            <h2>{T(lang, 'Thông tin tài khoản', 'Account information')}</h2>
            <div className="d68-form-grid">
              <label className="d68-auth-field"><span>Email *</span><input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" placeholder="advisor@example.com" /></label>
              <label className="d68-auth-field"><span>{T(lang, 'Mật khẩu *', 'Password *')}</span><input required minLength={8} type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" placeholder="••••••••" /></label>
              <label className="d68-auth-field"><span>{T(lang, 'Họ và tên *', 'Full name *')}</span><input required value={displayName} onChange={(e) => setDisplayName(e.target.value)} autoComplete="name" /></label>
              <label className="d68-auth-field"><span>{T(lang, 'Quốc gia *', 'Country *')}</span><select value={countryIso2} onChange={(e) => { setCountryIso2(e.target.value); setPhoneIso2(e.target.value); }}>{countryOptions.map((country) => <option key={country.iso2} value={country.iso2}>{lang === 'en' ? country.en : country.vi}</option>)}</select></label>
            </div>
          </section>

          <section>
            <h2>{T(lang, 'Hồ sơ nghề nghiệp', 'Professional profile')}</h2>
            <div className="d68-advisor-type-grid" role="group" aria-label={T(lang, 'Loại tài khoản Advisor', 'Advisor account type')}>
              {([
                ['advisor', T(lang, 'Cố vấn', 'Advisor')],
                ['broker', T(lang, 'Môi giới', 'Broker')],
                ['advisor_broker', T(lang, 'Cố vấn & Môi giới', 'Advisor & Broker')],
              ] as [AdvisorType, string][]).map(([value, label]) => (
                <button key={value} type="button" className={advisorType === value ? 'active' : ''} onClick={() => setAdvisorType(value)} aria-pressed={advisorType === value}>{label}</button>
              ))}
            </div>
            <div className="d68-form-grid">
              <label className="d68-auth-field"><span>{T(lang, 'Chức danh chuyên môn *', 'Professional title *')}</span><input required value={title} onChange={(e) => setTitle(e.target.value)} placeholder={T(lang, 'VD: Cố vấn M&A, Môi giới đầu tư', 'e.g. M&A Advisor, Investment Broker')} /></label>
              <label className="d68-auth-field"><span>{T(lang, 'Công ty / Tổ chức', 'Company / Organization')}</span><input value={companyName} onChange={(e) => setCompanyName(e.target.value)} /></label>
              <label className="d68-auth-field"><span>{T(lang, 'Mã quốc gia điện thoại *', 'Phone country *')}</span><select value={phoneIso2} onChange={(e) => setPhoneIso2(e.target.value)}>{countryOptions.map((country) => <option key={country.iso2} value={country.iso2}>{phoneDialFromIso(country.iso2)} · {lang === 'en' ? country.en : country.vi}</option>)}</select></label>
              <label className="d68-auth-field"><span>{T(lang, 'Số điện thoại *', 'Phone number *')}</span><input required value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" autoComplete="tel" /></label>
              <label className="d68-auth-field d68-auth-field--wide"><span>Website</span><input type="url" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://" /></label>
              <label className="d68-auth-field d68-auth-field--wide"><span>{T(lang, 'Lĩnh vực chuyên môn *', 'Areas of expertise *')}</span><input required value={expertiseText} onChange={(e) => setExpertiseText(e.target.value)} placeholder={T(lang, 'M&A, Gọi vốn, Bất động sản, Tài chính...', 'M&A, Fundraising, Real Estate, Finance...')} /><small>{T(lang, 'Phân tách bằng dấu phẩy; tối đa 12 lĩnh vực.', 'Separate with commas; up to 12 areas.')}</small></label>
              <label className="d68-auth-field d68-auth-field--wide"><span>{T(lang, 'Giới thiệu kinh nghiệm *', 'Professional introduction *')}</span><textarea required rows={5} value={introduction} onChange={(e) => setIntroduction(e.target.value)} maxLength={3000} placeholder={T(lang, 'Mô tả kinh nghiệm, thương vụ tiêu biểu, thị trường và năng lực hỗ trợ doanh nghiệp.', 'Describe your experience, representative transactions, markets and capabilities for supporting Businesses.')} /></label>
            </div>
          </section>

          <label className="d68-auth-agree">
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
            <span>{T(lang, 'Tôi đồng ý với', 'I agree to the')} <Link to={toLocalizedPath('/terms', lang)}>{T(lang, 'Điều khoản', 'Terms')}</Link> {T(lang, 'và', 'and')} <Link to={toLocalizedPath('/privacy', lang)}>{T(lang, 'Chính sách bảo mật', 'Privacy Policy')}</Link>.</span>
          </label>

          {message ? <div className={messageType === 'ok' ? 'd68-auth-success' : 'd68-auth-error'}>{message}</div> : null}
          <button className="d68-auth-submit" disabled={loading}>{loading ? T(lang, 'Đang tạo hồ sơ...', 'Creating application...') : T(lang, 'Tạo hồ sơ Advisor', 'Create Advisor application')}</button>
        </form>

        <p className="d68-auth-bottom">{T(lang, 'Đã có tài khoản Advisor?', 'Already have an Advisor account?')} <Link to={toLocalizedPath('/advisor/login', lang)}>{T(lang, 'Đăng nhập tại đây', 'Log in here')}</Link></p>
      </section>
    </main>
  );
}
