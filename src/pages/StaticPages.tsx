import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { Lang } from '../lib/i18n';

const T = (lang: Lang, vi: string, en: string) => lang === 'en' ? en : vi;
type StaticPageProps = { lang: Lang };

type Pair = { vi: string; en: string };
type Card = { icon: string; title: Pair; desc: Pair; tone?: 'blue' | 'gold' | 'green' | 'purple' | 'dark' };

const max = { maxWidth: 1080, margin: '0 auto', padding: '72px 24px' } as const;
const sectionTitle = { fontSize: 30, fontWeight: 800, letterSpacing: '-.6px', margin: '0 0 12px' } as const;
const muted = { fontSize: 15.5, color: '#64748B', lineHeight: 1.65, margin: 0 } as const;

function toneStyle(tone: Card['tone'] = 'blue') {
  const map = {
    blue: ['#E7F6FD', '#1596cc'],
    gold: ['#FEF3D3', '#B8860B'],
    green: ['#E9F9EF', '#16A34A'],
    purple: ['#F3E8FF', '#7c3aed'],
    dark: ['#EAF0F6', '#0F2A4A']
  } as Record<string, string[]>;
  return { background: map[tone][0], color: map[tone][1] };
}

function Hero({ lang, kicker, kickerEn, title, titleEn, desc, descEn, primaryTo, primary, primaryEn, secondaryTo, secondary, secondaryEn }: StaticPageProps & { kicker: string; kickerEn: string; title: string; titleEn: string; desc: string; descEn: string; primaryTo?: string; primary?: string; primaryEn?: string; secondaryTo?: string; secondary?: string; secondaryEn?: string }) {
  return <section style={{ position: 'relative', background: 'radial-gradient(1100px 500px at 78% -10%, rgba(27,173,234,.22), transparent 60%), linear-gradient(180deg,#0F2A4A,#14315A)', color: '#fff', overflow: 'hidden' }}>
    <div style={{ position: 'absolute', right: -80, top: 40, width: 380, height: 380, borderRadius: '50%', background: 'radial-gradient(circle, rgba(242,181,29,.20), transparent 70%)', pointerEvents: 'none' }} />
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '74px 24px 88px', position: 'relative', textAlign: 'center' }}>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 9, background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.16)', padding: '7px 15px', borderRadius: 999, fontSize: 13, fontWeight: 600, color: '#cfe8f6', marginBottom: 22 }}>{T(lang, kicker, kickerEn)}</div>
      <h1 className="d68-hero-h1" style={{ fontSize: 46, lineHeight: 1.1, fontWeight: 800, letterSpacing: -1, margin: '0 0 18px' }}>{T(lang, title, titleEn)}</h1>
      <p style={{ fontSize: 18, lineHeight: 1.6, color: '#c6d5e6', margin: '0 auto 34px', fontWeight: 400, maxWidth: 820 }}>{T(lang, desc, descEn)}</p>
      {(primaryTo || secondaryTo) && <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, flexWrap: 'wrap' }}>
        {primaryTo && <Link to={primaryTo} style={{ background: '#F2B51D', color: '#0F2A4A', fontWeight: 800, fontSize: 15.5, padding: '14px 26px', borderRadius: 11, boxShadow: '0 8px 18px rgba(242,181,29,.3)' }}>{T(lang, primary || 'Bắt đầu', primaryEn || 'Start')}</Link>}
        {secondaryTo && (secondaryTo.startsWith('mailto:') ? <a href={secondaryTo} style={{ border: '1px solid rgba(255,255,255,.28)', color: '#fff', fontWeight: 700, fontSize: 15.5, padding: '14px 26px', borderRadius: 11 }}>{T(lang, secondary || 'Liên hệ', secondaryEn || 'Contact')}</a> : <Link to={secondaryTo} style={{ border: '1px solid rgba(255,255,255,.28)', color: '#fff', fontWeight: 700, fontSize: 15.5, padding: '14px 26px', borderRadius: 11 }}>{T(lang, secondary || 'Xem thêm', secondaryEn || 'Learn more')}</Link>)}
      </div>}
    </div>
  </section>;
}

function CenterTitle({ lang, title, titleEn, desc, descEn }: StaticPageProps & { title: string; titleEn: string; desc?: string; descEn?: string }) {
  return <div style={{ textAlign: 'center', maxWidth: 720, margin: '0 auto 40px' }}>
    <h2 style={sectionTitle}>{T(lang, title, titleEn)}</h2>
    {desc && <p style={{ ...muted, lineHeight: 1.55 }}>{T(lang, desc, descEn || desc)}</p>}
  </div>;
}

function CardGrid({ lang, cards, columns = 3 }: StaticPageProps & { cards: Card[]; columns?: number }) {
  return <div className="d68-grid-3" style={{ display: 'grid', gridTemplateColumns: `repeat(${columns},1fr)`, gap: 22 }}>
    {cards.map((c) => <div key={c.title.vi} style={{ background: '#fff', border: '1px solid #E7EDF3', borderRadius: 16, padding: 28, boxShadow: '0 1px 2px rgba(15,42,74,.04)' }}>
      <div style={{ width: 44, height: 44, borderRadius: 12, ...toneStyle(c.tone), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, marginBottom: 16 }}>{c.icon}</div>
      <h3 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 8px' }}>{T(lang, c.title.vi, c.title.en)}</h3>
      <p style={{ fontSize: 14.5, color: '#64748B', lineHeight: 1.6, margin: 0 }}>{T(lang, c.desc.vi, c.desc.en)}</p>
    </div>)}
  </div>;
}

function CTA({ lang, title, titleEn, desc, descEn, to, cta, ctaEn }: StaticPageProps & { title: string; titleEn: string; desc: string; descEn: string; to: string; cta: string; ctaEn: string }) {
  const label = <>{T(lang, cta, ctaEn)} →</>;
  return <div style={{ marginTop: 38, background: '#0F2A4A', color: '#fff', borderRadius: 18, padding: 30, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 22, flexWrap: 'wrap' }}>
    <div style={{ maxWidth: 620 }}><h2 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 6px' }}>{T(lang, title, titleEn)}</h2><p style={{ fontSize: 14.5, color: '#a9bdd4', lineHeight: 1.6, margin: 0 }}>{T(lang, desc, descEn)}</p></div>
    {to.startsWith('mailto:') ? <a href={to} style={{ background: '#F2B51D', color: '#0F2A4A', fontWeight: 800, padding: '13px 22px', borderRadius: 11 }}>{label}</a> : <Link to={to} style={{ background: '#F2B51D', color: '#0F2A4A', fontWeight: 800, padding: '13px 22px', borderRadius: 11 }}>{label}</Link>}
  </div>;
}

export function About({ lang }: StaticPageProps) {
  const solutionPoints = [
    ['Chuẩn hóa hồ sơ cơ hội', 'Standardize opportunity profiles'],
    ['Ẩn danh danh tính và tài liệu nhạy cảm', 'Anonymize identity and sensitive files'],
    ['Lọc theo ngành, quốc gia, quy mô và chất lượng dữ liệu', 'Filter by sector, country, size and data quality'],
    ['Bắt đầu kết nối theo quy trình kiểm soát', 'Start controlled connection workflows']
  ];
  const dealTypes = [
    ['Bán doanh nghiệp', 'Business sale'], ['Bán cổ phần', 'Stake sale'], ['Gọi vốn', 'Fundraising'], ['Vay vốn', 'Business loan'], ['Đối tác chiến lược', 'Strategic partner']
  ];
  return <>
    <Hero lang={lang} kicker="Kết nối thương vụ, khai mở lộc phát" kickerEn="Connecting Deals, Unlocking Prosperity" title="Về Deals68" titleEn="About Deals68" desc="Deals68.com là nền tảng kết nối cơ hội mua bán doanh nghiệp, sang nhượng cửa hàng, đầu tư, vay vốn và cho vay dành cho doanh nghiệp Việt toàn cầu, nhà đầu tư toàn cầu và các đối tác vốn quốc tế." descEn="Deals68.com is a platform connecting opportunities for business acquisition, store transfer, investment, business lending and private capital for global Vietnamese businesses and international capital partners." primaryTo="/register/business" primary="Đăng cơ hội của bạn" primaryEn="Submit Your Opportunity" secondaryTo="/businesses" secondary="Khám phá các thương vụ đang mở" secondaryEn="Explore Open Deals" />
    <section style={max}>
      <CenterTitle lang={lang} title="Từ nền tảng cho doanh nghiệp Việt toàn cầu đến mạng lưới thương vụ quốc tế" titleEn="From a platform for global Vietnamese businesses to an international deal network" desc="Tầm nhìn dài hạn là xây dựng một mạng lưới thương vụ toàn cầu có gốc từ cộng đồng doanh nghiệp Việt: nơi doanh nghiệp tìm được đối tác phù hợp, nhà đầu tư tiếp cận cơ hội rõ hơn, và thương vụ bắt đầu từ niềm tin, dữ liệu và sự phù hợp thực tế." descEn="The long-term vision is to build a global deal network rooted in the Vietnamese business community: where businesses find suitable partners, investors access clearer opportunities, and deals begin with trust, data and practical fit." />
      <div className="d68-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 22 }}>
        <div style={{ background: '#0F2A4A', color: '#fff', borderRadius: 18, padding: 32 }}><div style={{ fontSize: 13, fontWeight: 700, color: '#F2B51D', textTransform: 'uppercase', letterSpacing: .5, marginBottom: 10 }}>{T(lang, 'Mục tiêu ba năm', '3-Year Goal')}</div><div style={{ fontSize: 32, fontWeight: 800, letterSpacing: -.6, marginBottom: 10 }}>300.000 – 500.000</div><p style={{ fontSize: 14.5, color: '#a9bdd4', lineHeight: 1.6, margin: 0 }}>{T(lang, 'Doanh nghiệp, chủ cửa hàng, nhà đầu tư, người mua, bên cho vay và đối tác vốn Việt Nam - quốc tế.', 'Businesses, store owners, investors, buyers, lenders and capital partners across Vietnamese and international markets.')}</p></div>
        <div style={{ background: '#0F2A4A', color: '#fff', borderRadius: 18, padding: 32 }}><div style={{ fontSize: 13, fontWeight: 700, color: '#F2B51D', textTransform: 'uppercase', letterSpacing: .5, marginBottom: 10 }}>{T(lang, 'Mục tiêu năm năm', '5-Year Goal')}</div><div style={{ fontSize: 32, fontWeight: 800, letterSpacing: -.6, marginBottom: 10 }}>{T(lang, 'Tối thiểu 1 triệu', '1 million+')}</div><p style={{ fontSize: 14.5, color: '#a9bdd4', lineHeight: 1.6, margin: 0 }}>{T(lang, 'Doanh nghiệp và nhà đầu tư toàn cầu — một điểm đến đáng tin cậy để khám phá, chuẩn hóa và kết nối cơ hội.', 'Businesses and investors globally — a trusted destination to discover, structure and connect opportunities.')}</p></div>
      </div>
    </section>
    <section style={{ background: '#F7FAFC', borderTop: '1px solid #E7EDF3', borderBottom: '1px solid #E7EDF3' }}><div style={max}>
      <CenterTitle lang={lang} title="Deals68 giải quyết vấn đề gì?" titleEn="What problem does Deals68 solve?" desc="Thị trường có nhiều cơ hội, nhưng thiếu một nơi trình bày thương vụ rõ ràng và đáng tin cậy." descEn="There are many opportunities in the market, but few trusted places to present them clearly." />
      <CardGrid lang={lang} columns={2} cards={[{ icon: '🏢', tone: 'dark', title: { vi: 'Bên có cơ hội', en: 'Opportunity owners' }, desc: { vi: 'Chủ doanh nghiệp muốn bán cổ phần, tìm nhà đầu tư, vay vốn hoặc sang nhượng cửa hàng có thể chuẩn hóa hồ sơ và tiếp cận đúng đối tác hơn.', en: 'Business owners who want to sell shares, find investors, raise debt or transfer stores can standardize their profiles and reach better counterparties.' } }, { icon: '📈', tone: 'gold', title: { vi: 'Bên tìm cơ hội', en: 'Opportunity seekers' }, desc: { vi: 'Nhà đầu tư, người mua hoặc bên cho vay có thể sàng lọc nhanh theo ngành, quy mô, quốc gia, loại giao dịch và chất lượng dữ liệu.', en: 'Investors, buyers and lenders can screen by sector, size, country, transaction type and data quality.' } }]} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginTop: 26 }} className="d68-grid-2">{solutionPoints.map((x) => <div key={x[0]} style={{ background: '#fff', border: '1px solid #E7EDF3', borderRadius: 12, padding: 18, fontSize: 13.5, fontWeight: 600, color: '#14315A', lineHeight: 1.5 }}>{T(lang, x[0], x[1])}</div>)}</div>
    </div></section>
    <section style={max}><CenterTitle lang={lang} title="Chúng tôi kết nối những loại thương vụ nào?" titleEn="What types of deals does Deals68 connect?" desc="Một nền tảng cho nhiều nhu cầu vốn và chuyển nhượng." descEn="One platform for multiple capital and transfer needs." />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 16 }} className="d68-grid-5">{dealTypes.map((x, i) => <div key={x[0]} style={{ background: '#fff', border: '1px solid #E7EDF3', borderRadius: 14, padding: '22px 16px', textAlign: 'center', boxShadow: '0 1px 2px rgba(15,42,74,.04)' }}><div style={{ fontSize: 26, marginBottom: 10 }}>{['🏢','🤝','📈','💳','🌐'][i]}</div><div style={{ fontSize: 14, fontWeight: 800 }}>{T(lang, x[0], x[1])}</div></div>)}</div>
      <CTA lang={lang} title="Khám phá cơ hội trên Deals68" titleEn="Explore opportunities on Deals68" desc="Doanh nghiệp có thể đăng hồ sơ ẩn danh, nhà đầu tư có thể lọc cơ hội theo khẩu vị và bắt đầu kết nối có kiểm soát." descEn="Businesses can publish anonymous profiles; investors can filter opportunities by appetite and start controlled connections." to="/businesses" cta="Xem doanh nghiệp" ctaEn="View businesses" />
    </section>
  </>;
}

const terms = [
  ['1. Định nghĩa', '1. Definitions', ['Deals68 là trang web Deals68.com và các sản phẩm, tính năng, biểu mẫu, trang quản trị, email hoặc kênh liên lạc liên quan.', 'Người dùng bao gồm doanh nghiệp, nhà đầu tư, người mua, bên cho vay, cố vấn, môi giới, đối tác và cá nhân/tổ chức truy cập nền tảng.'], ['Deals68 refers to Deals68.com and related products, features, forms, dashboards, emails or communication channels.', 'Users include businesses, investors, buyers, lenders, advisors, brokers, partners and any individual or organization accessing the platform.']],
  ['2. Vai trò của Deals68', '2. Role of Deals68', ['Deals68 hỗ trợ hiển thị, sàng lọc, chuẩn hóa thông tin ban đầu và kết nối các bên có nhu cầu phù hợp.', 'Deals68 không phải bên mua, bên bán, nhà đầu tư, bên cho vay hoặc đại diện pháp lý/tài chính của người dùng nếu không có thỏa thuận riêng.'], ['Deals68 supports presentation, screening, standardization and connection among relevant parties.', 'Deals68 is not a buyer, seller, investor, lender or legal/financial representative unless a separate agreement exists.']],
  ['3. Không phải tư vấn đầu tư', '3. No investment advice', ['Thông tin trên Deals68 chỉ phục vụ tham khảo và sàng lọc ban đầu.', 'Người dùng cần tự thẩm định, hỏi ý kiến chuyên gia phù hợp và chịu trách nhiệm cho quyết định của mình.'], ['Information on Deals68 is for reference and initial screening only.', 'Users should conduct their own due diligence, consult advisors and take responsibility for their decisions.']],
  ['4. Hồ sơ, dữ liệu và bảo mật', '4. Profiles, data and confidentiality', ['Người dùng cam kết cung cấp thông tin trung thực, hợp pháp và có quyền chia sẻ.', 'Danh tính, thông tin liên hệ và tài liệu nhạy cảm chỉ mở theo cơ chế kết nối/NDA hoặc duyệt của nền tảng.'], ['Users must provide accurate, lawful information that they are entitled to share.', 'Identity, contact details and sensitive documents unlock only under connection/NDA or platform approval rules.']],
  ['5. Phí, thanh toán và hoàn tiền', '5. Fees, payment and refunds', ['Các gói hiển thị/thành viên được tính theo bảng giá tại thời điểm đăng ký.', 'Sau khi hồ sơ đã hiển thị hoặc tài khoản đã kích hoạt, phí có thể không hoàn lại trừ khi có quyết định riêng của Deals68.'], ['Listing and membership packages follow the pricing page at registration time.', 'After a profile is published or an account activated, fees may be non-refundable unless Deals68 decides otherwise.']],
  ['6. Giới hạn trách nhiệm', '6. Limitation of liability', ['Deals68 không cam kết thương vụ hoàn tất, không bảo đảm lợi nhuận và không chịu trách nhiệm cho quyết định giao dịch của người dùng.', 'Người dùng chịu trách nhiệm kiểm tra pháp lý, tài chính, thuế, tín dụng và rủi ro trước khi ký kết.'], ['Deals68 does not guarantee deal completion or returns and is not responsible for users’ transaction decisions.', 'Users are responsible for legal, financial, tax, credit and risk checks before signing.']]
];

function LegalPage({ lang, kind }: StaticPageProps & { kind: 'terms' | 'privacy' }) {
  const privacy = kind === 'privacy';
  const sections = privacy ? [
    ['1. Hồ sơ ẩn danh', '1. Anonymous profiles', ['Tên pháp lý, thông tin liên hệ, dữ liệu tài chính và tài liệu nhạy cảm không hiển thị công khai.', 'Trang public chỉ dùng mã hồ sơ, mô tả teaser và thông tin chọn lọc.'], ['Legal names, contact details, financial data and sensitive documents are not shown publicly.', 'Public pages use profile codes, teaser descriptions and selected information only.']],
    ['2. Mở khóa thông tin', '2. Information unlock', ['Thông tin liên hệ và tài liệu chỉ mở khi có đề xuất/kết nối được duyệt hoặc sau NDA.', 'Một số quyền xem cần xác nhận thêm từ quản trị viên.'], ['Contact details and documents unlock only after an approved proposal/connection or NDA.', 'Some access rights may require additional admin confirmation.']],
    ['3. Dữ liệu người dùng', '3. User data', ['Người dùng có thể cập nhật hồ sơ, cài đặt riêng tư và yêu cầu hỗ trợ liên quan đến dữ liệu.', 'Các thay đổi quan trọng có thể cần được duyệt trước khi công khai.'], ['Users can update profiles, privacy settings and request support related to their data.', 'Major changes may require approval before becoming public.']],
    ['4. Lưu trữ và bảo vệ', '4. Storage and protection', ['Deals68 sử dụng cơ chế tài khoản, phân quyền và lưu trữ nhằm hạn chế truy cập không phù hợp.', 'Không có hệ thống nào an toàn tuyệt đối; người dùng cần tự bảo vệ mật khẩu và chỉ tải tài liệu có quyền chia sẻ.'], ['Deals68 uses account, permission and storage controls to limit inappropriate access.', 'No system is perfectly secure; users should protect passwords and upload only files they can share.']]
  ] : terms;
  return <>
    <section style={{ background: '#fff', borderBottom: '1px solid #E7EDF3' }}><div style={{ maxWidth: 820, margin: '0 auto', padding: '56px 24px 40px' }}><h1 className="d68-hero-h1" style={{ fontSize: 38, fontWeight: 800, letterSpacing: '-.8px', margin: '0 0 14px' }}>{privacy ? T(lang, 'Chính sách bảo mật', 'Privacy Policy') : T(lang, 'Điều khoản sử dụng', 'Terms of Use')}</h1><p style={muted}>{privacy ? T(lang, 'Deals68 ưu tiên cơ chế hồ sơ ẩn danh, kiểm soát quyền xem và chỉ mở thông tin nhạy cảm khi có kết nối được duyệt.', 'Deals68 prioritizes anonymous profiles, access control and unlocking sensitive information only after approved connections.') : T(lang, 'Vui lòng đọc kỹ Điều khoản sử dụng này trước khi truy cập, đăng ký tài khoản, đăng cơ hội, tìm kiếm cơ hội hoặc sử dụng bất kỳ tính năng nào trên Deals68.com.', 'Please read these Terms of Use carefully before accessing, registering, submitting opportunities, searching opportunities or using any feature on Deals68.com.')}</p></div></section>
    <section style={{ maxWidth: 820, margin: '0 auto', padding: '36px 24px 60px' }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', background: '#FEF3D3', border: '1px solid #F5DFA0', borderRadius: 14, padding: '18px 20px', marginBottom: 36 }}><span style={{ fontSize: 20 }}>⚠️</span><p style={{ fontSize: 14, color: '#7a5c12', fontWeight: 600, lineHeight: 1.55, margin: 0 }}>{privacy ? T(lang, 'Không chia sẻ mật khẩu, tài khoản hoặc tài liệu mật cho người không có thẩm quyền.', 'Do not share passwords, accounts or confidential files with unauthorized people.') : T(lang, 'Thông tin trên Deals68 không phải là lời khuyên đầu tư, pháp lý, thuế hoặc tín dụng. Deals68 không cam kết thương vụ thành công.', 'Information on Deals68 is not investment, legal, tax or credit advice. Deals68 does not guarantee deal completion.')}</p></div>
      <div style={{ background: '#F7FAFC', border: '1px solid #E7EDF3', borderRadius: 16, padding: '24px 28px', marginBottom: 48 }}><div style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: .5, color: '#94A3B8', marginBottom: 14 }}>{T(lang, 'Mục lục', 'Table of contents')}</div><div className="d68-toc-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 20px' }}>{sections.map((s, i) => <a key={s[0] as string} href={`#sec-${i}`} style={{ fontSize: 14, fontWeight: 600, color: '#1596cc', padding: '4px 0' }}>{T(lang, s[0] as string, s[1] as string)}</a>)}</div></div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 38 }}>{sections.map((s, i) => <div key={s[0] as string} id={`sec-${i}`} style={{ scrollMarginTop: 90 }}><h2 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 14px' }}>{T(lang, s[0] as string, s[1] as string)}</h2><div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{((lang === 'en' ? s[3] : s[2]) as string[]).map((p) => <p key={p} style={{ fontSize: 15, color: '#334155', lineHeight: 1.65, margin: 0 }}>{p}</p>)}</div></div>)}</div>
      <div style={{ border: '1px dashed #CBD5E1', borderRadius: 16, padding: '26px 28px', marginTop: 48 }}><div style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: .5, color: '#94A3B8', marginBottom: 14 }}>{T(lang, 'Thông tin pháp nhân — chờ xác nhận trước khi công bố', 'Legal entity information — pending confirmation before publication')}</div><div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{['Tên pháp nhân / Legal entity', 'Mã số thuế / Tax ID', 'Địa chỉ / Address', 'Đại diện / Representative'].map((r) => <div key={r} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, fontSize: 14, padding: '8px 0', borderBottom: '1px solid #F1F5F9' }}><span style={{ color: '#64748B', fontWeight: 600 }}>{r}</span><span style={{ color: '#94A3B8', fontWeight: 600, textAlign: 'right' }}>{T(lang, 'Đang cập nhật', 'Updating')}</span></div>)}</div></div>
    </section>
  </>;
}

export function Terms({ lang }: StaticPageProps) { return <LegalPage lang={lang} kind="terms" />; }
export function Privacy({ lang }: StaticPageProps) { return <LegalPage lang={lang} kind="privacy" />; }

export function Contact({ lang }: StaticPageProps) {
  const [submitted, setSubmitted] = useState(false);
  const [err, setErr] = useState('');
  const [form, setForm] = useState({ name: '', email: '', message: '' });
  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.message.trim()) {
      setErr(T(lang, 'Vui lòng nhập đầy đủ họ tên, email và nội dung.', 'Please enter your full name, email and message.'));
      return;
    }
    setErr('');
    setSubmitted(true);
  }
  const input = { border: '1px solid #E2E8F0', borderRadius: 10, padding: '13px 14px', fontSize: 15, color: '#0F2A4A', width: '100%' } as const;
  return <>
    <section style={{ background: '#F7FAFC', borderBottom: '1px solid #E7EDF3' }}>
      <div style={{ maxWidth: 1080, margin: '0 auto', padding: '56px 24px 44px', textAlign: 'center' }}>
        <h1 className="d68-hero-h1" style={{ fontSize: 38, fontWeight: 800, letterSpacing: '-.8px', margin: '0 0 14px' }}>{T(lang, 'Liên hệ', 'Contact')}</h1>
        <p style={{ fontSize: 16, color: '#64748B', lineHeight: 1.6, margin: '0 auto', maxWidth: 560 }}>{T(lang, 'Có câu hỏi, góp ý hoặc muốn hợp tác với Deals68? Gửi lời nhắn cho chúng tôi, đội ngũ sẽ phản hồi sớm nhất có thể.', 'Have a question, feedback or partnership idea for Deals68? Send us a message and our team will get back to you shortly.')}</p>
      </div>
    </section>
    <section style={{ maxWidth: 1080, margin: '0 auto', padding: '56px 24px 80px' }}>
      <div className="d68-contact-cols" style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 36, alignItems: 'start' }}>
        <div style={{ background: '#fff', border: '1px solid #E7EDF3', borderRadius: 18, padding: 34, boxShadow: '0 1px 2px rgba(15,42,74,.04)' }}>
          {submitted ? <div style={{ textAlign: 'center', padding: '30px 10px' }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#E9F9EF', color: '#16A34A', fontSize: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px' }}>✓</div>
            <h3 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 8px' }}>{T(lang, 'Đã gửi thành công', 'Message sent')}</h3>
            <p style={{ fontSize: 14.5, color: '#64748B', margin: '0 0 22px', lineHeight: 1.6 }}>{T(lang, 'Cảm ơn bạn đã liên hệ. Đội ngũ Deals68 sẽ phản hồi qua email trong thời gian sớm nhất.', 'Thank you for reaching out. The Deals68 team will reply by email as soon as possible.')}</p>
            <button onClick={() => setSubmitted(false)} style={{ border: '1px solid #E2E8F0', background: '#fff', color: '#14315A', fontWeight: 700, fontSize: 14, padding: '10px 20px', borderRadius: 9, cursor: 'pointer' }}>{T(lang, 'Gửi lời nhắn khác', 'Send another message')}</button>
          </div> : <form onSubmit={submit}>
            <h2 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 22px' }}>{T(lang, 'Gửi lời nhắn cho chúng tôi', 'Send us a message')}</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}><span style={{ fontSize: 13, fontWeight: 700, color: '#334155' }}>{T(lang, 'Họ và tên', 'Full name')} <span style={{ color: '#DC2626' }}>*</span></span><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={T(lang, 'Nguyễn Văn A', 'Your name')} style={input} /></label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}><span style={{ fontSize: 13, fontWeight: 700, color: '#334155' }}>Email <span style={{ color: '#DC2626' }}>*</span></span><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="ban@congty.com" style={input} /></label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}><span style={{ fontSize: 13, fontWeight: 700, color: '#334155' }}>{T(lang, 'Nội dung liên hệ / góp ý', 'Message / feedback')} <span style={{ color: '#DC2626' }}>*</span></span><textarea value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} rows={6} placeholder={T(lang, 'Tôi muốn đăng hồ sơ doanh nghiệp / hợp tác / góp ý...', 'I want to list a business / partner / share feedback...')} style={{ ...input, resize: 'vertical', fontFamily: 'inherit' }} /></label>
              {err && <div style={{ fontSize: 13.5, color: '#DC2626', fontWeight: 600, background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 9, padding: '10px 14px' }}>{err}</div>}
              <button type="submit" style={{ background: '#0F2A4A', color: '#fff', fontWeight: 700, fontSize: 15.5, padding: 14, border: 'none', borderRadius: 11, cursor: 'pointer' }}>{T(lang, 'Gửi liên hệ', 'Send message')}</button>
            </div>
          </form>}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ background: '#0F2A4A', color: '#fff', borderRadius: 16, padding: 26 }}><div style={{ fontSize: 13, fontWeight: 700, color: '#F2B51D', textTransform: 'uppercase', letterSpacing: .5, marginBottom: 12 }}>{T(lang, 'Thư điện tử', 'Email')}</div><a href="mailto:partner@vietcapitalpartners.com" style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>partner@vietcapitalpartners.com</a><p style={{ fontSize: 13.5, color: '#a9bdd4', lineHeight: 1.55, margin: '14px 0 0' }}>{T(lang, 'Thời gian phản hồi dự kiến: chờ xác nhận.', 'Expected response time: to be confirmed.')}</p></div>
          <div style={{ background: '#F7FAFC', border: '1px solid #E7EDF3', borderRadius: 16, padding: 26 }}><div style={{ fontSize: 13, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: .5, marginBottom: 14 }}>{T(lang, 'Câu hỏi khác?', 'Other questions?')}</div><div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 14.5, fontWeight: 600, color: '#1596cc' }}><Link to="/about">{T(lang, 'Về Deals68 →', 'About Deals68 →')}</Link><Link to="/terms">{T(lang, 'Điều khoản sử dụng →', 'Terms of Use →')}</Link><Link to="/privacy">{T(lang, 'Chính sách bảo mật →', 'Privacy Policy →')}</Link><Link to="/pricing">{T(lang, 'Bảng giá →', 'Pricing →')}</Link></div></div>
        </div>
      </div>
    </section>
  </>;
}

export function MarketPartner({ lang }: StaticPageProps) {
  const who = ['Cộng đồng doanh nhân Việt', 'Hội doanh nghiệp', 'Luật sư / cố vấn', 'Môi giới M&A', 'Nhà đầu tư cá nhân', 'Chuyên gia tài chính', 'Đối tác địa phương', 'Người có mạng lưới kiều bào'];
  return <>
    <Hero lang={lang} kicker="Đối tác thị trường" kickerEn="Market Partner" title="Trở thành Đối tác thị trường của Deals68" titleEn="Become a Deals68 Market Partner" desc="Cùng Deals68 kết nối doanh nghiệp Việt, nhà đầu tư, người mua doanh nghiệp và đối tác chiến lược tại các thị trường như Việt Nam, Mỹ, Canada, Úc, Đức, Singapore, Nhật Bản và Hàn Quốc." descEn="Join Deals68 in connecting Vietnamese businesses, investors, business buyers and strategic partners across markets like Vietnam, the US, Canada, Australia, Germany, Singapore, Japan and Korea." primaryTo="/register/market-partner" primary="Đăng ký làm Đối tác thị trường" primaryEn="Become a Market Partner" secondaryTo="mailto:partner@vietcapitalpartners.com" secondary="Liên hệ qua email" secondaryEn="Contact by email" />
    <section style={{ maxWidth: 1080, margin: '0 auto', padding: '64px 24px 8px' }}><CenterTitle lang={lang} title="Bạn phù hợp nếu là" titleEn="This is for you if you are" desc="Người có quan hệ trong cộng đồng doanh nhân Việt, hội doanh nghiệp, cộng đồng kiều bào hoặc mạng lưới đầu tư tại thị trường của bạn." descEn="Someone connected to the Vietnamese business community, associations, overseas communities or investor networks in your market." />
      <div className="d68-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 }}>{who.map((w) => <div key={w} style={{ background: '#F7FAFC', border: '1px solid #E7EDF3', borderRadius: 12, padding: 16, fontSize: 13.5, fontWeight: 600, color: '#14315A', textAlign: 'center', lineHeight: 1.4 }}>{w}</div>)}</div>
    </section>
    <section style={max}><CenterTitle lang={lang} title="Quyền lợi Đối tác thị trường" titleEn="Market Partner benefits" desc="Hoa hồng minh bạch, cấp bậc rõ ràng, cùng đồng hành sứ mệnh phục vụ doanh nghiệp Việt toàn cầu và nhà đầu tư quốc tế." descEn="Transparent commission, clear tiers, and a shared mission serving global Vietnamese businesses and international investors." />
      <CardGrid lang={lang} cards={[{ icon: '💰', tone: 'gold', title: { vi: 'Hoa hồng minh bạch', en: 'Transparent commission' }, desc: { vi: 'Theo dõi giới thiệu, chuyển đổi và hoa hồng sau khi đơn hàng đã thanh toán và không hoàn tiền.', en: 'Track referrals, conversions and commission after paid, non-refunded orders.' } }, { icon: '🌍', tone: 'blue', title: { vi: 'Phát triển thị trường', en: 'Market development' }, desc: { vi: 'Đại diện mở rộng cộng đồng doanh nghiệp và nhà đầu tư tại quốc gia/khu vực bạn phụ trách.', en: 'Expand business and investor communities in your country or region.' } }, { icon: '🤝', tone: 'green', title: { vi: 'Cơ hội hợp tác sâu', en: 'Deeper partnership' }, desc: { vi: 'Các thương vụ lớn hoặc success fee M&A/gọi vốn có thể áp dụng cơ chế riêng sau khi Admin duyệt.', en: 'Larger M&A/fundraising success fees may use separate approval-based mechanisms.' } }]} />
      <div style={{ background: '#0F2A4A', borderRadius: 18, padding: '30px 32px', color: '#fff', marginTop: 26 }}><div style={{ fontSize: 13, fontWeight: 700, color: '#F2B51D', textTransform: 'uppercase', letterSpacing: .5, marginBottom: 18 }}>{T(lang, 'Cấp đối tác & hoa hồng gợi ý', 'Partner tiers & suggested commission')}</div>{[['Bronze', '1–10 đơn thanh toán', '10%'], ['Silver', '11–30 đơn thanh toán', '15%'], ['Gold', '31+ đơn thanh toán', '20%'], ['Strategic', 'Deal lớn / M&A / fundraising', 'Riêng']].map((r, i) => <div key={r[0]} style={{ display: 'grid', gridTemplateColumns: '1.3fr 1.7fr .9fr', gap: 14, alignItems: 'center', padding: '14px 16px', borderRadius: 10, background: i % 2 ? 'rgba(255,255,255,.05)' : 'rgba(255,255,255,.08)' }}><div style={{ fontWeight: 800, fontSize: 14.5 }}>{r[0]}</div><div style={{ fontSize: 13, color: '#c6d5e6' }}>{r[1]}</div><div style={{ fontWeight: 800, fontSize: 15, color: '#F2B51D', textAlign: 'right' }}>{r[2]}</div></div>)}<p style={{ fontSize: 12.5, color: '#9db4cc', lineHeight: 1.6, margin: '16px 0 0' }}>{T(lang, 'Hoa hồng tính trên doanh thu thực thu sau giảm giá/hoàn tiền, không tính trên tổng giá trị giao dịch. Success fee M&A/gọi vốn có tỷ lệ riêng và cần Admin duyệt.', 'Commission is calculated on actual net revenue after discounts/refunds, not total deal value. M&A/fundraising success fees use a separate rate and require Admin approval.')}</p></div>
    </section>
    <section style={{ background: '#F7FAFC', borderTop: '1px solid #E7EDF3', borderBottom: '1px solid #E7EDF3' }}><div style={max}><CenterTitle lang={lang} title="Cách thức tham gia" titleEn="How to join" desc="3 bước đơn giản, miễn phí đăng ký trong giai đoạn Beta." descEn="3 simple steps, free to register during Beta." /><CardGrid lang={lang} cards={[{ icon: '1', tone: 'gold', title: { vi: 'Điền thông tin', en: 'Submit details' }, desc: { vi: 'Chọn thị trường, giới thiệu mạng lưới và kinh nghiệm của bạn.', en: 'Choose your market and introduce your network and experience.' } }, { icon: '2', tone: 'blue', title: { vi: 'Admin duyệt', en: 'Admin review' }, desc: { vi: 'Deals68 kiểm tra phù hợp trước khi mở dashboard đối tác.', en: 'Deals68 checks fit before opening the partner dashboard.' } }, { icon: '3', tone: 'green', title: { vi: 'Bắt đầu giới thiệu', en: 'Start referring' }, desc: { vi: 'Theo dõi liên kết, chuyển đổi và hoa hồng theo từng thị trường.', en: 'Track links, conversions and commission by market.' } }]} /><CTA lang={lang} title="Ứng tuyển làm Đối tác thị trường" titleEn="Apply to become a Market Partner" desc="Tài khoản Đối tác thị trường cần được quản trị viên duyệt trước khi kích hoạt đầy đủ quyền theo dõi và hoa hồng." descEn="Market Partner accounts require admin approval before full tracking and commission permissions are activated." to="/register/market-partner" cta="Đăng ký Đối tác thị trường" ctaEn="Register as Market Partner" /></div></section>
  </>;
}
