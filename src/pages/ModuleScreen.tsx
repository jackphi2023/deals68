import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { screenByPath, screenRegistry } from '../config/screenRegistry';
import { useAuth } from '../contexts/AuthContext';

function Bi({ vi, en }: { vi: ReactNode; en: ReactNode }) {
  return <><span className="l-vi">{vi}</span><span className="l-en">{en}</span></>;
}

function findScreen(pathname: string) {
  return (screenByPath as any)[pathname] || screenRegistry.find((s) => pathname.startsWith(s.path.replace('/:businessId','')));
}

function StaticHero({ badgeVi, badgeEn, titleVi, titleEn, descVi, descEn }: { badgeVi: string; badgeEn: string; titleVi: string; titleEn: string; descVi: string; descEn: string }) {
  return <section className="d68-static-hero">
    <div className="d68-static-hero__inner">
      <div className="d68-static-kicker"><Bi vi={badgeVi} en={badgeEn} /></div>
      <h1><Bi vi={titleVi} en={titleEn} /></h1>
      <p><Bi vi={descVi} en={descEn} /></p>
    </div>
  </section>;
}

function AboutPage() {
  return <>
    <StaticHero
      badgeVi="Giới thiệu Deals68"
      badgeEn="About Deals68"
      titleVi="Nền tảng kết nối thương vụ cho doanh nghiệp Việt và nhà đầu tư toàn cầu"
      titleEn="A deal connection platform for Vietnamese businesses and global investors"
      descVi="Deals68 giúp doanh nghiệp, chủ cửa hàng, nhà đầu tư, người mua chiến lược và bên cho vay khám phá cơ hội phù hợp trong môi trường có cấu trúc, bảo mật và dễ bắt đầu trao đổi."
      descEn="Deals68 helps businesses, store owners, investors, strategic buyers and lenders discover suitable opportunities in a structured, confidential and practical environment."
    />
    <section className="d68-static-section">
      <div className="d68-static-intro">
        <h2><Bi vi="Tầm nhìn" en="Vision" /></h2>
        <p><Bi vi="Deals68 được định hướng không chỉ là một trang đăng thông tin giao dịch, mà là nền tảng kết nối thương vụ có cấu trúc cho cộng đồng doanh nghiệp Việt Nam trên toàn cầu và các nhà đầu tư trong nước, quốc tế. Giai đoạn đầu, Deals68 tập trung phục vụ doanh nghiệp Việt Nam, chủ cửa hàng, nhà đầu tư người Việt ở nước ngoài và các đối tác vốn quan tâm đến doanh nghiệp Việt. Sau đó, nền tảng sẽ từng bước mở rộng sang doanh nghiệp và nhà đầu tư quốc tế ở nhiều thị trường." en="Deals68 is designed to be more than a listing site. It aims to become a structured deal connection platform for Vietnamese businesses worldwide, domestic and international investors, and capital partners seeking opportunities connected to Vietnam. Over time, the platform will expand to serve international businesses and investors across multiple markets." /></p>
      </div>
      <div className="d68-grid-2">
        <div className="d68-goal-card"><span><Bi vi="Mục tiêu ba năm" en="3-Year Goal" /></span><b>300.000 – 500.000</b><p><Bi vi="Doanh nghiệp, chủ cửa hàng, nhà đầu tư, người mua, bên cho vay và đối tác vốn Việt Nam - quốc tế." en="Businesses, store owners, investors, buyers, lenders and capital partners across Vietnamese and international markets." /></p></div>
        <div className="d68-goal-card"><span><Bi vi="Mục tiêu năm năm" en="5-Year Goal" /></span><b><Bi vi="Tối thiểu 1 triệu" en="1 million+" /></b><p><Bi vi="Doanh nghiệp và nhà đầu tư toàn cầu — một điểm đến đáng tin cậy để khám phá, chuẩn hóa và kết nối cơ hội." en="Businesses and investors globally — a trusted destination to discover, structure and connect opportunities." /></p></div>
      </div>
    </section>
    <section className="d68-static-section alt">
      <div className="d68-static-intro"><h2><Bi vi="Deals68 giải quyết vấn đề gì?" en="What problem does Deals68 solve?" /></h2><p><Bi vi="Thị trường có nhiều cơ hội, nhưng thiếu một nơi trình bày thương vụ rõ ràng và đáng tin cậy." en="There are many opportunities in the market, but few trusted places to present them clearly." /></p></div>
      <div className="d68-grid-2">
        <div className="d68-ref-card"><div className="d68-card-icon">🏢</div><h3><Bi vi="Bên có cơ hội" en="Opportunity owners" /></h3><p><Bi vi="Nhiều chủ doanh nghiệp muốn bán cổ phần, tìm nhà đầu tư, vay vốn hoặc sang nhượng cửa hàng nhưng chưa biết chuẩn bị hồ sơ, định giá sơ bộ và tiếp cận đúng đối tác." en="Many business owners want to sell shares, find investors, raise debt capital or transfer stores, but do not know how to prepare a profile, estimate value or reach the right counterparties." /></p></div>
        <div className="d68-ref-card"><div className="d68-card-icon gold">📈</div><h3><Bi vi="Bên tìm cơ hội" en="Opportunity seekers" /></h3><p><Bi vi="Nhiều nhà đầu tư, người mua hoặc bên cho vay có nhu cầu tìm cơ hội nhưng thiếu dữ liệu ban đầu để sàng lọc nhanh." en="Many investors, buyers and lenders want to discover opportunities but lack the initial information required for efficient screening." /></p></div>
      </div>
    </section>
  </>;
}

function TermsPage() {
  return <>
    <StaticHero badgeVi="Điều khoản" badgeEn="Terms" titleVi="Điều khoản sử dụng Deals68" titleEn="Deals68 Terms of Use" descVi="Các điều khoản dưới đây áp dụng cho việc truy cập, đăng hồ sơ, tìm kiếm cơ hội và kết nối trên Deals68." descEn="These terms apply to accessing, listing, browsing and connecting through Deals68." />
    <section className="d68-static-section"><div className="d68-legal-block">
      <h2><Bi vi="Bản chất nền tảng" en="Platform nature" /></h2>
      <p><Bi vi="Deals68 là nền tảng kết nối thông tin ban đầu giữa doanh nghiệp, nhà đầu tư, người mua, bên cho vay, cố vấn và đối tác thị trường. Deals68 không cam kết một thương vụ sẽ hoàn tất và không thay thế quá trình thẩm định độc lập của các bên." en="Deals68 is a platform for initial information connection among businesses, investors, buyers, lenders, advisors and market partners. Deals68 does not guarantee that any transaction will close and does not replace each party's independent due diligence." /></p>
      <h2><Bi vi="Không phải tư vấn đầu tư" en="Not investment advice" /></h2>
      <p><Bi vi="Các thông tin, điểm chất lượng, định giá tham khảo và gợi ý kết nối chỉ có tính chất hỗ trợ sàng lọc ban đầu. Người dùng cần tự đánh giá, thuê tư vấn chuyên môn và chịu trách nhiệm với quyết định của mình." en="Information, quality scores, indicative valuation and matching suggestions are for initial screening only. Users should perform their own assessment, appoint professional advisors and remain responsible for their decisions." /></p>
      <h2><Bi vi="Trách nhiệm của người dùng" en="User obligations" /></h2>
      <p><Bi vi="Người dùng cần cung cấp thông tin trung thực, không đăng nội dung vi phạm pháp luật, không mạo danh và không sử dụng dữ liệu của bên khác khi chưa được phép." en="Users must provide truthful information, avoid unlawful content, refrain from impersonation and avoid using third-party data without permission." /></p>
    </div></section>
  </>;
}

function PrivacyPage() {
  return <>
    <StaticHero badgeVi="Bảo mật" badgeEn="Privacy" titleVi="Chính sách bảo mật và quyền riêng tư" titleEn="Privacy Policy" descVi="Deals68 ưu tiên bảo vệ danh tính, thông tin liên hệ và dữ liệu hồ sơ của doanh nghiệp, nhà đầu tư và các bên tham gia." descEn="Deals68 prioritizes protecting identity, contact information and profile data for businesses, investors and participants." />
    <section className="d68-static-section"><div className="d68-grid-3">
      <div className="d68-ref-card"><div className="d68-card-icon">🔒</div><h3><Bi vi="Hồ sơ ẩn danh" en="Anonymous profiles" /></h3><p><Bi vi="Tên doanh nghiệp, người liên hệ, email, số điện thoại và tài liệu riêng tư không hiển thị công khai nếu chưa được mở khóa theo luồng kết nối." en="Company names, contact persons, emails, phone numbers and private documents are not public unless unlocked through the connection workflow." /></p></div>
      <div className="d68-ref-card"><div className="d68-card-icon gold">🤝</div><h3><Bi vi="Mở khóa có điều kiện" en="Conditional unlock" /></h3><p><Bi vi="Thông tin chi tiết chỉ được chia sẻ khi các bên có nhu cầu phù hợp và được duyệt theo quy trình của Deals68." en="Detailed information is shared only when parties are relevant and approved under the Deals68 workflow." /></p></div>
      <div className="d68-ref-card"><div className="d68-card-icon">📁</div><h3><Bi vi="Kiểm soát tài liệu" en="Document controls" /></h3><p><Bi vi="Tài liệu tài chính, hồ sơ thẩm định và phòng dữ liệu được xem là dữ liệu nhạy cảm, cần quyền phù hợp trước khi truy cập." en="Financial files, diligence materials and data-room content are considered sensitive and require appropriate permission before access." /></p></div>
    </div></section>
  </>;
}

function ContactPage() {
  return <>
    <StaticHero badgeVi="Liên hệ" badgeEn="Contact" titleVi="Trao đổi với Deals68" titleEn="Contact Deals68" descVi="Liên hệ để đăng hồ sơ doanh nghiệp, tìm nhà đầu tư, trở thành cố vấn hoặc thảo luận hợp tác thị trường." descEn="Contact us to list a business, find investors, become an advisor or discuss market partnerships." />
    <section className="d68-static-section"><div className="d68-grid-2">
      <div className="d68-ref-card"><h2><Bi vi="Thông tin liên hệ" en="Contact information" /></h2><div className="d68-contact-list"><a href="mailto:partner@vietcapitalpartners.com">partner@vietcapitalpartners.com</a><span>Hotline/Zalo: 0909.584.075</span><span><Bi vi="Thời gian phản hồi: trong 1–2 ngày làm việc" en="Response time: within 1–2 business days" /></span></div></div>
      <div className="d68-ref-card"><h2><Bi vi="Bạn muốn bắt đầu từ đâu?" en="Where would you like to start?" /></h2><div className="d68-action-list"><Link to="/register/business"><Bi vi="Đăng hồ sơ doanh nghiệp" en="List a business" /></Link><Link to="/register/investor"><Bi vi="Đăng ký nhà đầu tư" en="Register as investor" /></Link><Link to="/partners"><Bi vi="Tìm hiểu Đối tác thị trường" en="Learn about Market Partner" /></Link></div></div>
    </div></section>
  </>;
}

function PartnersPage() {
  return <>
    <StaticHero badgeVi="Đối tác thị trường" badgeEn="Market Partner" titleVi="Cùng Deals68 phát triển mạng lưới thương vụ tại thị trường của bạn" titleEn="Grow the Deals68 deal network in your market" descVi="Đối tác thị trường hỗ trợ giới thiệu doanh nghiệp, nhà đầu tư và cộng đồng đối tác phù hợp cho Deals68 tại Việt Nam và các thị trường quốc tế." descEn="Market Partners help refer businesses, investors and partner communities to Deals68 across Vietnam and international markets." />
    <section className="d68-static-section"><div className="d68-grid-3">
      <div className="d68-ref-card"><div className="d68-card-icon">🌏</div><h3><Bi vi="Phát triển thị trường" en="Market development" /></h3><p><Bi vi="Kết nối cộng đồng doanh nghiệp, hội ngành nghề, nhà đầu tư và người mua chiến lược tại khu vực bạn am hiểu." en="Connect business communities, industry groups, investors and strategic buyers in markets you understand." /></p></div>
      <div className="d68-ref-card"><div className="d68-card-icon gold">🔗</div><h3><Bi vi="Giới thiệu cơ hội" en="Referral flow" /></h3><p><Bi vi="Giới thiệu doanh nghiệp hoặc nhà đầu tư phù hợp, theo dõi trạng thái chuyển đổi và kết quả sau khi đơn hàng được xác nhận." en="Refer suitable businesses or investors and track conversion status after orders are confirmed." /></p></div>
      <div className="d68-ref-card"><div className="d68-card-icon">💼</div><h3><Bi vi="Hoa hồng minh bạch" en="Transparent commission" /></h3><p><Bi vi="Hoa hồng chỉ ghi nhận khi giao dịch dịch vụ đã thanh toán, không hoàn tiền và được xác nhận trong hệ thống." en="Commission is recorded only when a service order is paid, non-refunded and confirmed in the system." /></p></div>
    </div><div className="d68-static-cta"><div><h2><Bi vi="Sẵn sàng trở thành Đối tác thị trường?" en="Ready to become a Market Partner?" /></h2><p><Bi vi="Tạo tài khoản để Deals68 xác minh và kích hoạt quyền theo dõi giới thiệu." en="Create an account so Deals68 can review and activate your referral dashboard." /></p></div><Link to="/register/market-partner"><Bi vi="Đăng ký Đối tác thị trường" en="Register as Market Partner" /> →</Link></div></section>
  </>;
}

export default function ModuleScreen() {
  const { pathname } = useLocation();
  const screen = findScreen(pathname);
  const { profile } = useAuth();

  if (pathname === '/about') return <AboutPage />;
  if (pathname === '/terms') return <TermsPage />;
  if (pathname === '/privacy') return <PrivacyPage />;
  if (pathname === '/contact') return <ContactPage />;
  if (pathname === '/partners' || pathname === '/market-partner') return <PartnersPage />;

  if (!screen) return <section className="section"><div className="container empty"><Bi vi="Màn hình chưa được cấu hình." en="Screen not configured." /></div></section>;
  const allowed = !screen.roles.includes('admin') || profile?.role === 'admin';
  return <section className="section"><div className="container">
    <div className="section-title">
      <div><span className="pill gold">{screen.group}</span><h1>{screen.title_vi}</h1><p className="muted">{screen.title_en}</p></div>
      <Link className="btn secondary" to="/"><Bi vi="Về trang chủ" en="Deals68 Home" /></Link>
    </div>
    {!allowed && <div className="notice warn"><Bi vi="Trang này cần quyền phù hợp. Quyền truy cập dữ liệu thật sẽ được kiểm soát bằng Supabase." en="This screen requires the right role. Data access will be enforced by Supabase." /></div>}
    <div className="grid2">
      <div className="dash"><h2><Bi vi="Luồng nghiệp vụ" en="Workflow" /></h2><p>{screen.intent}</p></div>
      <div className="dash"><h2><Bi vi="Tính năng chính" en="Key features" /></h2><ul>{screen.features.map((f) => <li key={f}>{f}</li>)}</ul></div>
    </div>
  </div></section>;
}
