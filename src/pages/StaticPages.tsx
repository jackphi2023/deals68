import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { toLocalizedPath } from '../lib/i18nRoutes';
import type { Lang } from '../lib/i18n';

type Props = { lang: Lang };
type LegalItem = { viTitle: string; enTitle: string; viText: string; enText: string };

type HeroProps = Props & {
  kicker: string;
  kickerEn: string;
  title: string;
  titleEn: string;
  desc: string;
  descEn: string;
};

const T = (lang: Lang, vi: string, en: string) => (lang === 'en' ? en : vi);
const path = (to: string, lang: Lang) => toLocalizedPath(to, lang);

function Hero({ lang, kicker, kickerEn, title, titleEn, desc, descEn }: HeroProps) {
  return <section className="d68-static-hero">
    <div className="d68-static-container d68-static-hero__inner">
      <span className="d68-static-eyebrow">{T(lang, kicker, kickerEn)}</span>
      <h1>{T(lang, title, titleEn)}</h1>
      <p>{T(lang, desc, descEn)}</p>
    </div>
  </section>;
}

function Section({ children, narrow = false, alt = false }: { children: React.ReactNode; narrow?: boolean; alt?: boolean }) {
  return <section className={`d68-static-section${alt ? ' d68-static-section--alt' : ''}`}>
    <div className={narrow ? 'd68-static-container d68-static-container--narrow' : 'd68-static-container'}>{children}</div>
  </section>;
}

function CTA({ lang, to, title, titleEn, cta, ctaEn }: Props & { to: string; title: string; titleEn: string; cta: string; ctaEn: string }) {
  const inner = <>{T(lang, cta, ctaEn)} <span>→</span></>;
  return <div className="d68-static-cta">
    <h2>{T(lang, title, titleEn)}</h2>
    {to.startsWith('mailto:') ? <a href={to}>{inner}</a> : <Link to={path(to, lang)}>{inner}</Link>}
  </div>;
}

function Card({ icon, title, children }: { icon: string; title: string; children: React.ReactNode }) {
  return <article className="d68-static-card">
    <div className="d68-static-card__icon">{icon}</div>
    <h3>{title}</h3>
    <div>{children}</div>
  </article>;
}

function LegalList({ lang, items }: Props & { items: LegalItem[] }) {
  return <div className="d68-static-legal-list">
    {items.map((it, i) => <article id={`sec-${i + 1}`} key={it.viTitle} className="d68-static-legal-card">
      <h2>{T(lang, it.viTitle, it.enTitle)}</h2>
      <p>{T(lang, it.viText, it.enText)}</p>
    </article>)}
  </div>;
}

function Notice({ lang }: Props) {
  return <div className="d68-static-notice">
    <b>⚠️</b>
    <span>{T(lang, 'Thông tin trên Deals68 không phải là lời khuyên đầu tư, pháp lý, thuế hoặc tín dụng.', 'Information on Deals68 is not investment, legal, tax or credit advice.')}</span>
  </div>;
}

export function About({ lang }: Props) {
  const pillars = [
    { icon: '🛡️', vi: 'Ẩn danh trước, công khai sau khi duyệt', en: 'Anonymous first, public after approval', descVi: 'Hồ sơ DN public chỉ dùng snapshot đã được Admin duyệt; tên thật và thông tin riêng tư không xuất hiện trên trang public.', descEn: 'Public business pages use Admin-approved snapshots only; real names and private details are not shown publicly.' },
    { icon: '📊', vi: 'Dữ liệu chuẩn hóa', en: 'Structured data', descVi: 'Doanh thu, EBITDA, nhu cầu vốn, loại giao dịch và chất lượng hồ sơ được chuẩn hóa để nhà đầu tư sàng lọc nhanh hơn.', descEn: 'Revenue, EBITDA, ask, deal type and profile quality are structured to help investors screen faster.' },
    { icon: '🤝', vi: 'Kết nối có kiểm soát', en: 'Controlled matching', descVi: 'Nhà đầu tư có thể bày tỏ quan tâm, lưu hồ sơ hoặc yêu cầu dữ liệu; tài liệu nhạy cảm chỉ mở theo quy trình được duyệt.', descEn: 'Investors may express interest, save profiles or request data; sensitive documents unlock only through approved workflow.' }
  ];
  return <main className="d68-static-page">
    <Hero lang={lang} kicker="Giới thiệu" kickerEn="About" title="Về Deals68" titleEn="About Deals68" desc="Deals68.com là nền tảng kết nối cơ hội mua bán doanh nghiệp, sang nhượng cửa hàng, đầu tư, vay vốn và cho vay dành cho doanh nghiệp Việt toàn cầu, nhà đầu tư toàn cầu và các đối tác vốn quốc tế." descEn="Deals68.com connects business acquisition, store transfer, investment, lending and private capital opportunities for global Vietnamese businesses, international investors and capital partners." />
    <Section>
      <div className="d68-static-title">
        <h2>{T(lang, 'Tầm nhìn toàn cầu của Deals68', 'Deals68 global vision')}</h2>
        <p>{T(lang, 'Giai đoạn đầu, Deals68 tập trung phục vụ doanh nghiệp Việt Nam, chủ cửa hàng, nhà đầu tư người Việt ở nước ngoài và các đối tác vốn quan tâm đến doanh nghiệp Việt. Sau đó, nền tảng sẽ từng bước mở rộng sang doanh nghiệp và nhà đầu tư quốc tế ở nhiều thị trường.', 'In the first stage, Deals68 focuses on Vietnamese businesses, store owners, overseas Vietnamese investors and capital partners interested in Vietnam-related opportunities. Over time, the platform will expand to international businesses and investors across multiple markets.')}</p>
      </div>
      <div className="d68-static-grid d68-static-grid--2">
        <Card icon="🎯" title={T(lang, 'Mục tiêu ba năm', '3-Year Goal')}>
          <strong>300.000 – 500.000</strong>
          <p>{T(lang, 'Doanh nghiệp, chủ cửa hàng, nhà đầu tư, người mua, bên cho vay và đối tác vốn Việt Nam - quốc tế.', 'Businesses, store owners, investors, buyers, lenders and capital partners across Vietnamese and international markets.')}</p>
        </Card>
        <Card icon="🌍" title={T(lang, 'Mục tiêu năm năm', '5-Year Goal')}>
          <strong>{T(lang, 'Tối thiểu 1 triệu', '1 million+')}</strong>
          <p>{T(lang, 'Doanh nghiệp và nhà đầu tư toàn cầu.', 'Businesses and investors globally.')}</p>
        </Card>
      </div>
    </Section>
    <Section alt>
      <div className="d68-static-grid d68-static-grid--3">
        {pillars.map((p) => <Card key={p.vi} icon={p.icon} title={T(lang, p.vi, p.en)}><p>{T(lang, p.descVi, p.descEn)}</p></Card>)}
      </div>
      <CTA lang={lang} to="/businesses" title="Khám phá cơ hội trên Deals68" titleEn="Explore opportunities on Deals68" cta="Xem doanh nghiệp" ctaEn="View businesses" />
    </Section>
  </main>;
}

const terms: LegalItem[] = [
  { viTitle: 'Vai trò của Deals68', enTitle: 'Role of Deals68', viText: 'Deals68 là nền tảng hỗ trợ hiển thị, sàng lọc, chuẩn hóa thông tin ban đầu và kết nối các bên có nhu cầu phù hợp. Deals68 không cam kết thương vụ thành công.', enText: 'Deals68 supports presentation, screening, initial standardisation and connection between relevant parties. Deals68 does not guarantee deal completion.' },
  { viTitle: 'Không phải tư vấn đầu tư', enTitle: 'No investment advice', viText: 'Thông tin trên Deals68 chỉ nhằm mục đích tham khảo và sàng lọc ban đầu. Người dùng cần tự thẩm định và chịu trách nhiệm cho quyết định của mình.', enText: 'Information on Deals68 is for reference and initial screening only. Users should conduct their own due diligence and take responsibility for their decisions.' },
  { viTitle: 'Nghĩa vụ của người dùng', enTitle: 'User obligations', viText: 'Người dùng phải cung cấp thông tin trung thực, hợp pháp và có quyền chia sẻ; không đăng nội dung gây hiểu lầm hoặc xâm phạm quyền của bên thứ ba.', enText: 'Users must provide accurate, lawful information they are entitled to share, and must not post misleading content or infringe third-party rights.' },
  { viTitle: 'Dữ liệu và tài liệu', enTitle: 'Data and documents', viText: 'Tài liệu nhạy cảm chỉ được mở theo quy trình kết nối được duyệt. Deals68 có thể yêu cầu bổ sung hoặc chỉnh sửa dữ liệu trước khi công khai.', enText: 'Sensitive documents unlock only through an approved connection process. Deals68 may request additions or corrections before publication.' },
  { viTitle: 'Phí dịch vụ và thanh toán', enTitle: 'Fees and payment', viText: 'Tài khoản mới có thể ở trạng thái chờ thanh toán. Dashboard chỉ mở sau khi Admin xác nhận thanh toán hoặc kích hoạt tài khoản theo chính sách nội bộ.', enText: 'New accounts may remain payment-pending. Dashboard access opens only after Admin confirms payment or activates the account under internal policy.' }
];

export function Terms({ lang }: Props) {
  return <main className="d68-static-page">
    <Hero lang={lang} kicker="Điều khoản" kickerEn="Terms" title="Điều khoản sử dụng" titleEn="Terms of Use" desc="Bằng việc sử dụng nền tảng, người dùng xác nhận đã đọc, hiểu và đồng ý tuân thủ các điều khoản dưới đây." descEn="By using the platform, users confirm that they have read, understood and agree to these terms." />
    <Section narrow><Notice lang={lang}/><LegalList lang={lang} items={terms}/></Section>
  </main>;
}

const privacy: LegalItem[] = [
  { viTitle: 'Hồ sơ ẩn danh', enTitle: 'Anonymous profiles', viText: 'Tên pháp lý, thông tin liên hệ, tài liệu tài chính và dữ liệu nhạy cảm không hiển thị công khai.', enText: 'Legal names, contact details, financial documents and sensitive data are not displayed publicly.' },
  { viTitle: 'Public snapshot', enTitle: 'Public snapshot', viText: 'Trang public của doanh nghiệp chỉ lấy dữ liệu từ bản snapshot được Admin duyệt. Khi doanh nghiệp tự sửa dashboard, thay đổi sẽ chờ duyệt và bản public cũ vẫn giữ nguyên.', enText: 'Public business pages use Admin-approved snapshots only. When a business edits its dashboard, changes remain pending while the existing public page stays unchanged.' },
  { viTitle: 'Mở khóa thông tin', enTitle: 'Information unlock', viText: 'Thông tin liên hệ và tài liệu chỉ mở sau khi có đề xuất hoặc kết nối được duyệt theo quy trình của Deals68.', enText: 'Contact information and documents unlock only after an approved proposal or connection under Deals68 workflow.' },
  { viTitle: 'Quyền của người dùng', enTitle: 'User rights', viText: 'Người dùng có thể yêu cầu xem, chỉnh sửa, cập nhật, ẩn hoặc xóa thông tin cá nhân của mình.', enText: 'Users may request to view, edit, update, hide or delete their personal information.' }
];

export function Privacy({ lang }: Props) {
  return <main className="d68-static-page">
    <Hero lang={lang} kicker="Bảo mật" kickerEn="Privacy" title="Chính sách bảo mật" titleEn="Privacy Policy" desc="Deals68 ưu tiên hồ sơ ẩn danh, kiểm soát quyền xem và chỉ mở thông tin nhạy cảm khi có kết nối được duyệt." descEn="Deals68 prioritises anonymous profiles, access control and unlocking sensitive information only after approved connections." />
    <Section narrow><LegalList lang={lang} items={privacy}/><CTA lang={lang} to="/contact" title="Câu hỏi về dữ liệu riêng tư?" titleEn="Questions about privacy?" cta="Liên hệ" ctaEn="Contact us" /></Section>
  </main>;
}

export function Contact({ lang }: Props) {
  const [form, setForm] = useState({ name: '', email: '', message: '' });
  const [status, setStatus] = useState<{ ok?: boolean; msg: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setStatus(null);
    if (!form.name.trim() || !form.email.trim() || !form.message.trim()) {
      setStatus({ ok: false, msg: T(lang, 'Vui lòng nhập đầy đủ thông tin.', 'Please complete all fields.') });
      return;
    }
    setBusy(true);
    const { error } = await supabase.from('contact_messages').insert({ name: form.name.trim(), email: form.email.trim(), message: form.message.trim(), source: 'contact_page', status: 'new' });
    setBusy(false);
    if (error) setStatus({ ok: false, msg: T(lang, `Chưa lưu được tin nhắn: ${error.message}`, `Message was not saved: ${error.message}`) });
    else { setStatus({ ok: true, msg: T(lang, 'Đã lưu tin nhắn. Deals68 sẽ phản hồi qua email.', 'Message saved. Deals68 will respond by email.') }); setForm({ name: '', email: '', message: '' }); }
  }

  return <main className="d68-static-page">
    <Hero lang={lang} kicker="Liên hệ" kickerEn="Contact" title="Liên hệ" titleEn="Contact" desc="Có câu hỏi, góp ý hoặc muốn hợp tác với Deals68? Gửi lời nhắn cho chúng tôi." descEn="Have a question, feedback or partnership idea for Deals68? Send us a message." />
    <Section>
      <div className="d68-static-contact-grid">
        <form onSubmit={submit} className="d68-static-form">
          <h2>{T(lang, 'Gửi lời nhắn cho chúng tôi', 'Send us a message')}</h2>
          <label><span>{T(lang, 'Họ và tên', 'Full name')}</span><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
          <label><span>Email</span><input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} type="email" placeholder="email@example.com" /></label>
          <label><span>{T(lang, 'Nội dung', 'Message')}</span><textarea value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder={T(lang, 'Nội dung liên hệ / góp ý', 'Message / feedback')} /></label>
          <button disabled={busy}>{busy ? T(lang, 'Đang gửi...', 'Sending...') : T(lang, 'Gửi liên hệ', 'Send message')}</button>
          {status ? <div className={`d68-static-form-msg ${status.ok ? 'ok' : 'err'}`}>{status.msg}</div> : null}
        </form>
        <aside className="d68-static-aside">
          <Card icon="✉️" title="Email"><a href="mailto:partner@vietcapitalpartners.com">partner@vietcapitalpartners.com</a><p>Hotline/Zalo: 0909.584.075</p></Card>
          <Card icon="🚀" title={T(lang, 'Lối tắt', 'Shortcuts')}><div className="d68-static-links"><Link to={path('/register/business', lang)}>{T(lang, 'Đăng hồ sơ doanh nghiệp', 'Register a business')}</Link><Link to={path('/register/investor', lang)}>{T(lang, 'Đăng ký nhà đầu tư', 'Register as investor')}</Link><Link to={path('/partners', lang)}>{T(lang, 'Đối tác thị trường', 'Market Partner')}</Link></div></Card>
        </aside>
      </div>
    </Section>
  </main>;
}

export function MarketPartner({ lang }: Props) {
  const [form, setForm] = useState({ fullName: '', email: '', phone: '', country: 'Vietnam', intro: '' });
  const [status, setStatus] = useState<{ ok?: boolean; msg: string } | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setStatus(null);
    if (!form.fullName.trim() || !form.email.trim()) {
      setStatus({ ok: false, msg: T(lang, 'Vui lòng nhập họ tên và email.', 'Please enter full name and email.') });
      return;
    }
    setBusy(true);
    const { error } = await supabase.from('partner_leads').insert({ full_name: form.fullName.trim(), email: form.email.trim(), phone: form.phone.trim(), country: form.country, intro: form.intro.trim(), source: 'market_partner_page', status: 'new' });
    setBusy(false);
    if (error) setStatus({ ok: false, msg: T(lang, `Chưa lưu được đăng ký: ${error.message}`, `Application was not saved: ${error.message}`) });
    else { setStatus({ ok: true, msg: T(lang, 'Đã lưu đăng ký Đối tác thị trường. Admin sẽ duyệt hồ sơ.', 'Market Partner application saved. Admin will review it.') }); setForm({ fullName: '', email: '', phone: '', country: 'Vietnam', intro: '' }); }
  }
  const benefits = [
    { icon: '🌍', vi: 'Phát triển cộng đồng', en: 'Community development', descVi: 'Kết nối doanh nghiệp Việt, chủ cửa hàng và nhà đầu tư tại thị trường của bạn.', descEn: 'Connect Vietnamese businesses, store owners and investors in your market.' },
    { icon: '🤝', vi: 'Giới thiệu cơ hội', en: 'Opportunity referral', descVi: 'Giới thiệu khách hàng phù hợp và theo dõi chuyển đổi sau khi được duyệt.', descEn: 'Refer relevant customers and track conversions after approval.' },
    { icon: '📊', vi: 'Theo dõi minh bạch', en: 'Transparent tracking', descVi: 'Hoa hồng dựa trên đơn hàng thực thu, tách biệt với mã khuyến mãi.', descEn: 'Commission is based on net paid orders and kept separate from promo codes.' }
  ];
  return <main className="d68-static-page">
    <Hero lang={lang} kicker="Đối tác thị trường" kickerEn="Market Partner" title="Trở thành Đối tác thị trường của Deals68" titleEn="Become a Deals68 Market Partner" desc="Cùng Deals68 kết nối doanh nghiệp Việt, nhà đầu tư, người mua doanh nghiệp và đối tác chiến lược tại thị trường của bạn." descEn="Join Deals68 in connecting Vietnamese businesses, investors, business buyers and strategic partners in your market." />
    <Section>
      <div className="d68-static-grid d68-static-grid--3">{benefits.map((b) => <Card key={b.vi} icon={b.icon} title={T(lang, b.vi, b.en)}><p>{T(lang, b.descVi, b.descEn)}</p></Card>)}</div>
      <form onSubmit={submit} className="d68-static-form d68-static-partner-form">
        <h2>{T(lang, 'Đăng ký Đối tác thị trường', 'Register as Market Partner')}</h2>
        <label><span>{T(lang, 'Họ tên', 'Full name')}</span><input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} /></label>
        <label><span>Email</span><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="email@example.com" /></label>
        <label><span>{T(lang, 'Số điện thoại', 'Phone')}</span><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label>
        <label><span>{T(lang, 'Quốc gia', 'Country')}</span><select value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })}>{['Vietnam','United States','Canada','Australia','Germany','Singapore','Japan','South Korea','Other'].map((x) => <option key={x}>{x}</option>)}</select></label>
        <label><span>{T(lang, 'Giới thiệu bản thân / mạng lưới', 'About you / your network')}</span><textarea value={form.intro} onChange={(e) => setForm({ ...form, intro: e.target.value })} /></label>
        <button disabled={busy}>{busy ? T(lang, 'Đang gửi...', 'Submitting...') : T(lang, 'Gửi đăng ký', 'Submit application')}</button>
        {status ? <div className={`d68-static-form-msg ${status.ok ? 'ok' : 'err'}`}>{status.msg}</div> : null}
      </form>
    </Section>
  </main>;
}
