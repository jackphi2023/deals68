import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart3,
  Briefcase,
  Building2,
  Globe2,
  Handshake,
  ShieldCheck,
  Target,
} from 'lucide-react';
import { type LegalItem } from '../content/staticAboutContent';
import { termsPart1 } from '../content/staticTermsContent1';
import { termsPart2 } from '../content/staticTermsContent2';
import { privacyPart1 } from '../content/staticPrivacyContent1';
import { privacyPart2 } from '../content/staticPrivacyContent2';
import { supabase } from '../lib/supabase';
import { toLocalizedPath } from '../lib/i18nRoutes';
import type { Lang } from '../lib/i18n';

type Props = { lang: Lang };

type HeroProps = Props & {
  kicker: string;
  kickerEn: string;
  title: string;
  titleEn: string;
  desc: string;
  descEn: string;
  slogan?: string;
  sloganEn?: string;
  meta?: string;
  metaEn?: string;
};

const T = (lang: Lang, vi: string, en: string) => (lang === 'en' ? en : vi);
const path = (to: string, lang: Lang) => toLocalizedPath(to, lang);
const terms: LegalItem[] = [...termsPart1, ...termsPart2];
const privacy: LegalItem[] = [...privacyPart1, ...privacyPart2];

function Hero({ lang, kicker, kickerEn, title, titleEn, desc, descEn, slogan, sloganEn, meta, metaEn }: HeroProps) {
  return <section className="d68-static-hero">
    <div className="d68-static-container d68-static-hero__inner">
      <span className="d68-static-eyebrow">{T(lang, kicker, kickerEn)}</span>
      <h1>{T(lang, title, titleEn)}</h1>
      <p>{T(lang, desc, descEn)}</p>
      {slogan && sloganEn ? <strong className="d68-static-hero__slogan">{T(lang, slogan, sloganEn)}</strong> : null}
      {meta && metaEn ? <small className="d68-static-hero__meta">{T(lang, meta, metaEn)}</small> : null}
    </div>
  </section>;
}

function Section({ children, narrow = false, alt = false }: { children: React.ReactNode; narrow?: boolean; alt?: boolean }) {
  return <section className={`d68-static-section${alt ? ' d68-static-section--alt' : ''}`}>
    <div className={narrow ? 'd68-static-container d68-static-container--narrow' : 'd68-static-container'}>{children}</div>
  </section>;
}

function CTA({ lang, to, title, titleEn, text, textEn, cta, ctaEn }: Props & { to: string; title: string; titleEn: string; text?: string; textEn?: string; cta: string; ctaEn: string }) {
  const inner = <>{T(lang, cta, ctaEn)} <span>→</span></>;
  return <div className="d68-static-cta">
    <div>
      <h2>{T(lang, title, titleEn)}</h2>
      {text && textEn ? <p>{T(lang, text, textEn)}</p> : null}
    </div>
    {to.startsWith('mailto:') ? <a href={to}>{inner}</a> : <Link to={path(to, lang)}>{inner}</Link>}
  </div>;
}

function Card({ icon, title, children }: { icon?: React.ReactNode; title: string; children: React.ReactNode }) {
  return <article className="d68-static-card">
    {icon ? <div className={typeof icon === 'string' ? 'd68-static-card__icon' : 'd68-static-card__icon d68-static-card__icon--line'}>{icon}</div> : null}
    <h3>{title}</h3>
    <div>{children}</div>
  </article>;
}


function BulletList({ items, ordered = false }: { items: string[]; ordered?: boolean }) {
  const List = ordered ? 'ol' : 'ul';
  return <List className="d68-static-bullets">{items.map((item) => <li key={item}>{item}</li>)}</List>;
}

function LegalToc({ lang, items }: Props & { items: LegalItem[] }) {
  return <nav className="d68-static-legal-toc" aria-label={T(lang, 'Mục lục', 'Table of contents')}>
    <h2>{T(lang, 'Mục lục', 'Table of contents')}</h2>
    <div>{items.map((item, index) => <a key={item.viTitle} href={`#sec-${index + 1}`}><span>{index + 1}</span>{T(lang, item.viTitle, item.enTitle)}</a>)}</div>
  </nav>;
}

function LegalList({ lang, items }: Props & { items: LegalItem[] }) {
  return <div className="d68-static-legal-list">
    {items.map((item, index) => {
      const paragraphs = lang === 'en' ? item.enParagraphs : item.viParagraphs;
      const bullets = lang === 'en' ? item.enBullets : item.viBullets;
      return <article id={`sec-${index + 1}`} key={item.viTitle} className="d68-static-legal-card">
        <h2>{index + 1}. {T(lang, item.viTitle, item.enTitle)}</h2>
        {paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
        {bullets?.length ? <BulletList items={bullets} /> : null}
      </article>;
    })}
  </div>;
}

export function About({ lang }: Props) {
  const pillars = [
    { icon: <ShieldCheck />, vi: 'Ẩn danh trước, công khai sau khi duyệt', en: 'Anonymous first, public after approval', descVi: 'Hồ sơ doanh nghiệp công khai chỉ dùng bản hiển thị đã được Admin duyệt; tên thật, tài liệu và thông tin liên hệ riêng tư không xuất hiện trên trang công khai.', descEn: 'Public business pages use Admin-approved snapshots only; real names, documents and private contact details are not shown publicly.' },
    { icon: <BarChart3 />, vi: 'Dữ liệu chuẩn hóa', en: 'Structured data', descVi: 'Doanh thu, lợi nhuận, nhu cầu vốn, loại giao dịch và điểm chất lượng hồ sơ được chuẩn hóa để nhà đầu tư sàng lọc nhanh hơn.', descEn: 'Revenue, profit, ask, deal type and profile quality score are structured to help investors screen faster.' },
    { icon: <Handshake />, vi: 'Kết nối có kiểm soát', en: 'Controlled matching', descVi: 'Nhà đầu tư, người mua và bên cho vay có thể bày tỏ quan tâm hoặc yêu cầu dữ liệu; tài liệu nhạy cảm chỉ mở theo quy trình được duyệt.', descEn: 'Investors, buyers and lenders may express interest or request data; sensitive documents unlock only through an approved workflow.' }
  ];
  const flows = [
    { icon: <Building2 />, vi: 'Doanh nghiệp', en: 'Businesses', descVi: 'Đăng hồ sơ ẩn danh để tìm nhà đầu tư, người mua, bên cho vay hoặc đối tác chiến lược phù hợp.', descEn: 'Create an anonymous profile to find relevant investors, buyers, lenders or strategic partners.' },
    { icon: <Briefcase />, vi: 'Nhà đầu tư / Người mua / Bên cho vay', en: 'Investors / Buyers / Lenders', descVi: 'Lọc cơ hội theo ngành, quốc gia, quy mô, loại giao dịch và mức độ sẵn sàng dữ liệu.', descEn: 'Filter opportunities by sector, country, size, transaction type and data-readiness level.' },
    { icon: <Globe2 />, vi: 'Đối tác thị trường', en: 'Market Partners', descVi: 'Hỗ trợ Deals68 phát triển cộng đồng doanh nghiệp và nhà đầu tư tại từng quốc gia, thành phố hoặc cộng đồng người Việt.', descEn: 'Help Deals68 grow business and investor communities by country, city or Vietnamese diaspora market.' }
  ];
  return <main className="d68-static-page">
    <Hero lang={lang} kicker="Giới thiệu" kickerEn="About" title="Về Deals68" titleEn="About Deals68" desc="Deals68.com là nền tảng kết nối doanh nghiệp Việt và doanh nghiệp toàn cầu với nhà đầu tư, người mua doanh nghiệp, bên cho vay và đối tác chiến lược trên toàn cầu." descEn="Deals68.com connects Vietnamese and global businesses with investors, business buyers, lenders and strategic partners worldwide." />
    <Section>
      <div className="d68-static-title">
        <h2>{T(lang, 'Tầm nhìn toàn cầu của Deals68', 'Deals68 global vision')}</h2>
        <p>{T(lang, 'Giai đoạn đầu, Deals68 tập trung phục vụ doanh nghiệp Việt Nam, chủ cửa hàng, nhà đầu tư người Việt ở nước ngoài và các đối tác vốn quan tâm đến doanh nghiệp Việt. Sau đó, nền tảng sẽ từng bước mở rộng sang doanh nghiệp và nhà đầu tư quốc tế ở nhiều thị trường.', 'In the first stage, Deals68 focuses on Vietnamese businesses, store owners, overseas Vietnamese investors and capital partners interested in Vietnam-related opportunities. Over time, the platform will expand to international businesses and investors across multiple markets.')}</p>
      </div>
      <div className="d68-static-grid d68-static-grid--2">
        <Card icon={<Target />} title={T(lang, 'Mục tiêu ba năm', '3-Year Goal')}>
          <strong>300.000 – 500.000</strong>
          <p>{T(lang, 'Doanh nghiệp, chủ cửa hàng, nhà đầu tư, người mua doanh nghiệp, bên cho vay và đối tác vốn Việt Nam - quốc tế.', 'Businesses, store owners, investors, business buyers, lenders and capital partners across Vietnamese and international markets.')}</p>
        </Card>
        <Card icon={<Globe2 />} title={T(lang, 'Mục tiêu 10 năm', '10-Year Goal')}>
          <strong>{T(lang, 'Tối thiểu 1 triệu', '1 million+')}</strong>
          <p>{T(lang, 'Doanh nghiệp và nhà đầu tư toàn cầu được phục vụ.', 'Businesses and investors served globally.')}</p>
        </Card>
      </div>
    </Section>
    <Section alt>
      <div className="d68-static-title">
        <h2>{T(lang, 'Nền tảng được xây quanh niềm tin dữ liệu', 'Built around data trust')}</h2>
        <p>{T(lang, 'Deals68 ưu tiên hồ sơ ẩn danh, dữ liệu được chuẩn hóa và quy trình duyệt trước khi công khai để giảm rủi ro lộ thông tin riêng tư.', 'Deals68 prioritises anonymous profiles, structured data and approval before publication to reduce private-information exposure risk.')}</p>
      </div>
      <div className="d68-static-grid d68-static-grid--3">
        {pillars.map((p) => <Card key={p.vi} icon={p.icon} title={T(lang, p.vi, p.en)}><p>{T(lang, p.descVi, p.descEn)}</p></Card>)}
      </div>
    </Section>
    <Section>
      <div className="d68-static-title">
        <h2>{T(lang, 'Ba nhóm người dùng chính', 'Three core user groups')}</h2>
        <p>{T(lang, 'Mỗi nhóm có luồng hiển thị và quyền xem riêng để bảo vệ dữ liệu và tăng chất lượng kết nối.', 'Each group has a dedicated display and access flow to protect data and improve matching quality.')}</p>
      </div>
      <div className="d68-static-grid d68-static-grid--3">
        {flows.map((p) => <Card key={p.vi} icon={p.icon} title={T(lang, p.vi, p.en)}><p>{T(lang, p.descVi, p.descEn)}</p></Card>)}
      </div>
      <div className="d68-static-cta d68-static-cta--partnership">
        <p>{T(lang, 'Hân hạnh được hợp tác và đồng hành', 'Honoured to collaborate and grow together')}</p>
      </div>
    </Section>
  </main>;
}

export function Terms({ lang }: Props) {
  return <main className="d68-static-page">
    <Hero
      lang={lang}
      kicker="Điều khoản"
      kickerEn="Terms"
      title="Điều khoản sử dụng Deals68"
      titleEn="Deals68 Terms of Use"
      desc="Các điều khoản này điều chỉnh việc truy cập và sử dụng Deals68 của khách truy cập, doanh nghiệp, nhà đầu tư, bên mua, bên cho vay, cố vấn và đối tác thị trường."
      descEn="These Terms govern access to and use of Deals68 by visitors, businesses, investors, buyers, lenders, advisors and Market Partners."
      meta="Ngày hiệu lực: Tháng 6/2026"
      metaEn="Effective date: June 2026"
    />
    <Section narrow>
      <LegalToc lang={lang} items={terms} />
      <LegalList lang={lang} items={terms} />
    </Section>
  </main>;
}

export function Privacy({ lang }: Props) {
  return <main className="d68-static-page">
    <Hero
      lang={lang}
      kicker="Bảo mật"
      kickerEn="Privacy"
      title="Chính sách bảo mật và dữ liệu Deals68"
      titleEn="Deals68 Privacy and Data Policy"
      desc="Chính sách này giải thích Deals68 thu thập, sử dụng, chia sẻ, lưu trữ và bảo vệ dữ liệu cá nhân, dữ liệu doanh nghiệp và tài liệu giao dịch như thế nào."
      descEn="This Policy explains how Deals68 collects, uses, shares, retains and protects personal data, business information and transaction materials."
      meta="Ngày hiệu lực: Tháng 6/2026"
      metaEn="Effective date: June 2026"
    />
    <Section narrow>
      <LegalToc lang={lang} items={privacy} />
      <LegalList lang={lang} items={privacy} />
    </Section>
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
    { icon: '🌍', vi: 'Phát triển cộng đồng', en: 'Community development', descVi: 'Kết nối doanh nghiệp Việt, chủ cửa hàng, nhà đầu tư, người mua doanh nghiệp và bên cho vay tại thị trường của bạn.', descEn: 'Connect Vietnamese businesses, store owners, investors, business buyers and lenders in your market.' },
    { icon: '🤝', vi: 'Giới thiệu cơ hội phù hợp', en: 'Relevant opportunity referral', descVi: 'Giới thiệu khách hàng phù hợp theo ngành, quốc gia, quy mô giao dịch và nhu cầu vốn thực tế.', descEn: 'Refer relevant customers by sector, country, transaction size and actual capital need.' },
    { icon: '📊', vi: 'Theo dõi minh bạch', en: 'Transparent tracking', descVi: 'Hoa hồng dựa trên đơn hàng thực thu, tách biệt với mã khuyến mãi và chỉ ghi nhận theo quy trình duyệt của Admin.', descEn: 'Commission is based on net paid orders, separated from promo codes and recorded through Admin approval workflow.' }
  ];
  const standards = [
    { icon: '✅', vi: 'Minh bạch kỳ vọng', en: 'Clear expectations', descVi: 'Không cam kết lợi nhuận hoặc thương vụ thành công thay Deals68.', descEn: 'Do not promise returns or deal completion on behalf of Deals68.' },
    { icon: '🔒', vi: 'Kỷ luật dữ liệu', en: 'Data discipline', descVi: 'Không chia sẻ dữ liệu riêng tư nếu chưa có quyền xem được duyệt.', descEn: 'Do not share private data without approved access rights.' },
    { icon: '🧭', vi: 'Tập trung đúng thị trường', en: 'Market focus', descVi: 'Ưu tiên thị trường có cộng đồng doanh nghiệp Việt hoặc nhà đầu tư quan tâm đến Việt Nam.', descEn: 'Prioritise markets with Vietnamese business communities or investors interested in Vietnam.' }
  ];
  return <main className="d68-static-page">
    <Hero lang={lang} kicker="Đối tác thị trường" kickerEn="Market Partner" title="Trở thành Đối tác thị trường của Deals68" titleEn="Become a Deals68 Market Partner" desc="Cùng Deals68 kết nối doanh nghiệp Việt, nhà đầu tư, người mua doanh nghiệp và đối tác chiến lược tại thị trường của bạn." descEn="Join Deals68 in connecting Vietnamese businesses, investors, business buyers and strategic partners in your market." />
    <Section>
      <div className="d68-static-title">
        <h2>{T(lang, 'Vai trò của Đối tác thị trường', 'Market Partner role')}</h2>
        <p>{T(lang, 'Đối tác thị trường hỗ trợ phát triển cộng đồng, giới thiệu hồ sơ phù hợp và giúp Deals68 mở rộng tại từng quốc gia hoặc cộng đồng doanh nghiệp cụ thể.', 'Market Partners support community development, refer relevant profiles and help Deals68 expand by country or business community.')}</p>
      </div>
      <div className="d68-static-grid d68-static-grid--3">{benefits.map((b) => <Card key={b.vi} icon={b.icon} title={T(lang, b.vi, b.en)}><p>{T(lang, b.descVi, b.descEn)}</p></Card>)}</div>
    </Section>
    <Section alt>
      <div className="d68-static-title">
        <h2>{T(lang, 'Nguyên tắc hợp tác', 'Partnership standards')}</h2>
        <p>{T(lang, 'Deals68 ưu tiên phát triển đối tác có kỷ luật dữ liệu, hiểu cộng đồng doanh nghiệp và tuân thủ nguyên tắc không gây hiểu lầm cho khách hàng.', 'Deals68 prioritises partners with data discipline, business-community understanding and a clear no-misrepresentation standard.')}</p>
      </div>
      <div className="d68-static-grid d68-static-grid--3">{standards.map((b) => <Card key={b.vi} icon={b.icon} title={T(lang, b.vi, b.en)}><p>{T(lang, b.descVi, b.descEn)}</p></Card>)}</div>
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
