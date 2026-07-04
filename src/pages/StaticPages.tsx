import { Link } from 'react-router-dom';
import type { Lang } from '../lib/i18n';

const T = (lang: Lang, vi: string, en: string) => lang === 'en' ? en : vi;

type StaticPageProps = { lang: Lang };

type HeroProps = StaticPageProps & { kicker: string; kickerEn: string; title: string; titleEn: string; desc: string; descEn: string };

function StaticHero({ lang, kicker, kickerEn, title, titleEn, desc, descEn }: HeroProps) {
  return <section className="d68-static-hero">
    <div className="d68-static-hero__inner">
      <div className="d68-static-kicker">{T(lang, kicker, kickerEn)}</div>
      <h1>{T(lang, title, titleEn)}</h1>
      <p>{T(lang, desc, descEn)}</p>
    </div>
  </section>;
}

function CTA({ lang, title, titleEn, desc, descEn, to = '/register/business', cta = 'Bắt đầu ngay', ctaEn = 'Get started' }: StaticPageProps & { title: string; titleEn: string; desc: string; descEn: string; to?: string; cta?: string; ctaEn?: string }) {
  const label = <>{T(lang, cta, ctaEn)} →</>;
  return <div className="d68-static-cta">
    <div><h2>{T(lang, title, titleEn)}</h2><p>{T(lang, desc, descEn)}</p></div>
    {to.startsWith('mailto:') ? <a href={to}>{label}</a> : <Link to={to}>{label}</Link>}
  </div>;
}

export function About({ lang }: StaticPageProps) {
  return <>
    <StaticHero
      lang={lang}
      kicker="Giới thiệu"
      kickerEn="About"
      title="Deals68.com — Nền tảng kết nối thương vụ cho doanh nghiệp Việt toàn cầu"
      titleEn="Deals68.com — A Deal Connection Platform for Vietnamese Businesses Worldwide"
      desc="Deals68 được định hướng không chỉ là một trang đăng thông tin giao dịch, mà là nền tảng kết nối thương vụ có cấu trúc cho cộng đồng doanh nghiệp Việt Nam trên toàn cầu và các nhà đầu tư trong nước, quốc tế."
      descEn="Deals68 is designed to be more than a listing site. It aims to become a structured deal connection platform for Vietnamese businesses worldwide, domestic and international investors, and capital partners seeking Vietnam-related opportunities."
    />
    <section className="d68-static-section">
      <div className="d68-static-intro">
        <h2>{T(lang, 'Tầm nhìn', 'Vision')}</h2>
        <p>{T(lang,
          'Giai đoạn đầu, Deals68 tập trung phục vụ doanh nghiệp Việt Nam, chủ cửa hàng, nhà đầu tư người Việt ở nước ngoài và các đối tác vốn quan tâm đến doanh nghiệp Việt. Sau đó, nền tảng sẽ từng bước mở rộng sang doanh nghiệp và nhà đầu tư quốc tế ở nhiều thị trường.',
          'In the first stage, Deals68 focuses on Vietnamese businesses, store owners, overseas Vietnamese investors and capital partners interested in Vietnam-related opportunities. Over time, the platform will expand to serve international businesses and investors across multiple markets.'
        )}</p>
      </div>
      <div className="d68-grid-2">
        <div className="d68-goal-card"><span>{T(lang, 'Mục tiêu ba năm', '3-Year Goal')}</span><b>300.000 – 500.000</b><p>{T(lang, 'Doanh nghiệp, chủ cửa hàng, nhà đầu tư, người mua, bên cho vay và đối tác vốn Việt Nam - quốc tế.', 'Businesses, store owners, investors, buyers, lenders and capital partners across Vietnamese and international markets.')}</p></div>
        <div className="d68-goal-card"><span>{T(lang, 'Mục tiêu năm năm', '5-Year Goal')}</span><b>{T(lang, 'Tối thiểu 1 triệu', '1 million+')}</b><p>{T(lang, 'Doanh nghiệp và nhà đầu tư toàn cầu — một điểm đến đáng tin cậy để khám phá, chuẩn hóa và kết nối cơ hội.', 'Businesses and investors globally — a trusted destination to discover, structure and connect opportunities.')}</p></div>
      </div>
      <CTA lang={lang} title="Khám phá cơ hội trên Deals68" titleEn="Explore opportunities on Deals68" desc="Doanh nghiệp có thể đăng hồ sơ ẩn danh, nhà đầu tư có thể lọc cơ hội theo khẩu vị và bắt đầu kết nối có kiểm soát." descEn="Businesses can publish anonymous profiles, investors can filter opportunities by appetite and start controlled connections." to="/businesses" cta="Xem doanh nghiệp" ctaEn="View businesses" />
    </section>
    <section className="d68-static-section alt"><div className="d68-grid-3">
      <div className="d68-ref-card"><div className="d68-card-icon">🏢</div><h3>{T(lang, 'Bên có cơ hội', 'Opportunity owners')}</h3><p>{T(lang, 'Chủ doanh nghiệp muốn bán cổ phần, tìm nhà đầu tư, vay vốn hoặc sang nhượng cửa hàng có thể trình bày cơ hội rõ ràng hơn.', 'Business owners who want to sell shares, find investors, raise debt capital or transfer stores can present opportunities more clearly.')}</p></div>
      <div className="d68-ref-card"><div className="d68-card-icon gold">📈</div><h3>{T(lang, 'Bên tìm cơ hội', 'Opportunity seekers')}</h3><p>{T(lang, 'Nhà đầu tư, người mua hoặc bên cho vay có thể sàng lọc nhanh cơ hội theo ngành, quốc gia, quy mô giao dịch và chất lượng dữ liệu.', 'Investors, buyers and lenders can screen opportunities by sector, country, deal size and data quality.')}</p></div>
      <div className="d68-ref-card"><div className="d68-card-icon">🤝</div><h3>{T(lang, 'Kết nối có cấu trúc', 'Structured connection')}</h3><p>{T(lang, 'Danh tính và tài liệu nhạy cảm chỉ mở khi các bên có kết nối được duyệt, giúp tăng độ tin cậy trước khi trao đổi sâu.', 'Sensitive identities and documents unlock only after approved connections, increasing trust before deeper discussions.')}</p></div>
    </div></section>
  </>;
}

export function Terms({ lang }: StaticPageProps) {
  return <>
    <StaticHero lang={lang} kicker="Điều khoản" kickerEn="Terms" title="Điều khoản sử dụng Deals68" titleEn="Deals68 Terms of Use" desc="Các điều khoản dưới đây quy định cách người dùng sử dụng nền tảng Deals68 để đăng hồ sơ, tìm kiếm cơ hội, gửi đề xuất và kết nối với các bên liên quan." descEn="These terms govern how users use Deals68 to publish profiles, discover opportunities, send proposals and connect with relevant parties." />
    <section className="d68-static-section d68-static-container--narrow">
      <div className="d68-legal-block"><h2>{T(lang, 'Vai trò của nền tảng', 'Platform role')}</h2><p>{T(lang, 'Deals68 là nền tảng kết nối thông tin và hỗ trợ khởi tạo trao đổi giữa các bên. Deals68 không cam kết giao dịch sẽ hoàn tất, không đại diện cho bất kỳ bên nào nếu không có thỏa thuận riêng bằng văn bản.', 'Deals68 is an information and connection platform that helps parties start conversations. Deals68 does not guarantee transaction completion and does not represent any party unless a separate written agreement exists.')}</p></div>
      <div className="d68-legal-block"><h2>{T(lang, 'Không phải tư vấn đầu tư', 'No investment advice')}</h2><p>{T(lang, 'Thông tin trên Deals68 chỉ nhằm mục đích tham khảo và sàng lọc ban đầu. Người dùng cần tự thẩm định, hỏi ý kiến chuyên gia phù hợp và chịu trách nhiệm cho quyết định đầu tư, mua bán, cho vay hoặc hợp tác.', 'Information on Deals68 is for reference and initial screening only. Users should conduct their own due diligence, consult appropriate advisors and take responsibility for investment, acquisition, lending or partnership decisions.')}</p></div>
      <div className="d68-legal-block"><h2>{T(lang, 'Nghĩa vụ của người dùng', 'User obligations')}</h2><ul><li>{T(lang, 'Cung cấp thông tin trung thực, hợp pháp và có quyền chia sẻ.', 'Provide accurate, lawful information that they are entitled to share.')}</li><li>{T(lang, 'Không đăng nội dung gây hiểu nhầm, vi phạm pháp luật hoặc xâm phạm quyền của bên thứ ba.', 'Do not publish misleading, unlawful content or content that infringes third-party rights.')}</li><li>{T(lang, 'Tôn trọng quy định bảo mật, ẩn danh và quy trình mở khóa thông tin của nền tảng.', 'Respect the platform’s privacy, anonymisation and data-unlock process.')}</li></ul></div>
      <CTA lang={lang} title="Cần trao đổi thêm về điều khoản?" titleEn="Need to discuss the terms?" desc="Liên hệ đội ngũ Deals68 để được hướng dẫn trước khi đăng hồ sơ hoặc gửi đề xuất." descEn="Contact the Deals68 team for guidance before publishing a profile or sending a proposal." to="/contact" cta="Liên hệ" ctaEn="Contact us" />
    </section>
  </>;
}

export function Privacy({ lang }: StaticPageProps) {
  return <>
    <StaticHero lang={lang} kicker="Bảo mật" kickerEn="Privacy" title="Chính sách bảo mật và riêng tư" titleEn="Privacy Policy" desc="Deals68 ưu tiên cơ chế hồ sơ ẩn danh, kiểm soát quyền xem và chỉ mở thông tin nhạy cảm khi có kết nối được duyệt." descEn="Deals68 prioritises anonymous profiles, access control and unlocking sensitive information only after approved connections." />
    <section className="d68-static-section d68-static-container--narrow">
      <div className="d68-legal-block"><h2>{T(lang, 'Hồ sơ ẩn danh', 'Anonymous profiles')}</h2><p>{T(lang, 'Tên pháp lý, thông tin liên hệ, tài liệu tài chính và dữ liệu nhạy cảm của doanh nghiệp hoặc nhà đầu tư không hiển thị công khai. Trang công khai chỉ dùng hồ sơ giới thiệu, mã hồ sơ và thông tin chọn lọc.', 'Legal names, contact details, financial documents and sensitive data of businesses or investors are not shown publicly. Public pages use teaser profiles, profile codes and selected information only.')}</p></div>
      <div className="d68-legal-block"><h2>{T(lang, 'Mở khóa thông tin', 'Information unlock')}</h2><p>{T(lang, 'Thông tin liên hệ và tài liệu chỉ được mở khi có đề xuất hoặc kết nối được duyệt theo quy trình của Deals68. Một số dữ liệu có thể cần xác nhận thêm từ quản trị viên.', 'Contact information and documents are unlocked only after an approved proposal or connection under Deals68’s process. Some data may require additional admin confirmation.')}</p></div>
      <div className="d68-legal-block"><h2>{T(lang, 'Dữ liệu và quyền kiểm soát', 'Data and control')}</h2><p>{T(lang, 'Người dùng có thể cập nhật hồ sơ, tùy chọn riêng tư và yêu cầu hỗ trợ liên quan đến dữ liệu của mình. Các thay đổi quan trọng có thể cần được duyệt trước khi hiển thị công khai.', 'Users can update profiles, privacy settings and request support related to their data. Major changes may require approval before being displayed publicly.')}</p></div>
      <CTA lang={lang} title="Câu hỏi về dữ liệu riêng tư?" titleEn="Questions about privacy?" desc="Gửi yêu cầu cho Deals68 để được hỗ trợ kiểm tra quyền xem, hồ sơ ẩn danh hoặc dữ liệu tài liệu." descEn="Send a request to Deals68 for support on access control, anonymised profiles or document data." to="/contact" cta="Liên hệ" ctaEn="Contact us" />
    </section>
  </>;
}

export function Contact({ lang }: StaticPageProps) {
  return <>
    <StaticHero lang={lang} kicker="Liên hệ" kickerEn="Contact" title="Liên hệ Deals68" titleEn="Contact Deals68" desc="Kết nối với đội ngũ Deals68 để được hỗ trợ về đăng hồ sơ doanh nghiệp, tài khoản nhà đầu tư, đối tác thị trường hoặc hợp tác phát triển nền tảng." descEn="Connect with the Deals68 team for support with business profiles, investor accounts, market partner opportunities or platform cooperation." />
    <section className="d68-static-section">
      <div className="d68-grid-2">
        <div className="d68-ref-card"><div className="d68-card-icon">✉️</div><h2>{T(lang, 'Thông tin liên hệ', 'Contact details')}</h2><div className="d68-contact-list"><a href="mailto:partner@vietcapitalpartners.com">partner@vietcapitalpartners.com</a><span>Hotline/Zalo: 0909.584.075</span><span>{T(lang, 'Khu vực ưu tiên: Việt Nam, Đông Nam Á và cộng đồng doanh nghiệp Việt toàn cầu.', 'Priority markets: Vietnam, Southeast Asia and Vietnamese business communities worldwide.')}</span></div></div>
        <div className="d68-ref-card"><div className="d68-card-icon gold">🚀</div><h2>{T(lang, 'Bạn cần hỗ trợ gì?', 'What do you need help with?')}</h2><div className="d68-action-list"><Link to="/register/business">{T(lang, 'Đăng hồ sơ doanh nghiệp', 'Register a business')}</Link><Link to="/register/investor">{T(lang, 'Đăng ký tài khoản nhà đầu tư', 'Register as an investor')}</Link><Link to="/partners">{T(lang, 'Tìm hiểu chương trình Đối tác thị trường', 'Explore the Market Partner programme')}</Link><Link to="/pricing">{T(lang, 'Xem bảng giá', 'View pricing')}</Link></div></div>
      </div>
      <CTA lang={lang} title="Gửi thông tin ban đầu" titleEn="Send initial information" desc="Bạn có thể gửi email giới thiệu ngắn gọn về nhu cầu, lĩnh vực, quốc gia và quy mô giao dịch để đội ngũ Deals68 phản hồi phù hợp." descEn="You can email a short introduction with your need, sector, country and deal size so the Deals68 team can respond appropriately." to="mailto:partner@vietcapitalpartners.com" cta="Gửi email" ctaEn="Email us" />
    </section>
  </>;
}

export function MarketPartner({ lang }: StaticPageProps) {
  return <>
    <StaticHero lang={lang} kicker="Đối tác thị trường" kickerEn="Market Partner" title="Trở thành Đối tác thị trường của Deals68" titleEn="Become a Deals68 Market Partner" desc="Cùng Deals68 kết nối doanh nghiệp Việt, nhà đầu tư và đối tác chiến lược tại thị trường của bạn — Việt Nam, Mỹ, Canada, Úc, Đức, Singapore, Nhật Bản, Hàn Quốc và hơn thế nữa." descEn="Work with Deals68 to connect Vietnamese businesses, investors and strategic partners in your market — Vietnam, the US, Canada, Australia, Germany, Singapore, Japan, Korea and beyond." />
    <section className="d68-static-section">
      <div className="d68-static-intro"><h2>{T(lang, 'Vai trò của Đối tác thị trường', 'Role of a Market Partner')}</h2><p>{T(lang, 'Đối tác thị trường giúp Deals68 tiếp cận cộng đồng doanh nghiệp, nhà đầu tư, hiệp hội, cố vấn và các kênh giới thiệu phù hợp tại từng quốc gia hoặc khu vực.', 'Market Partners help Deals68 reach business communities, investors, associations, advisors and referral channels in each country or region.')}</p></div>
      <div className="d68-grid-3">
        <div className="d68-ref-card"><div className="d68-card-icon">🌍</div><h3>{T(lang, 'Phát triển cộng đồng', 'Community development')}</h3><p>{T(lang, 'Kết nối Deals68 với cộng đồng doanh nghiệp Việt và đối tác địa phương tại thị trường của bạn.', 'Connect Deals68 with Vietnamese business communities and local partners in your market.')}</p></div>
        <div className="d68-ref-card"><div className="d68-card-icon gold">🤝</div><h3>{T(lang, 'Giới thiệu cơ hội', 'Opportunity referral')}</h3><p>{T(lang, 'Giới thiệu doanh nghiệp, nhà đầu tư hoặc đối tác chiến lược có nhu cầu phù hợp với nền tảng.', 'Refer businesses, investors or strategic partners with needs that fit the platform.')}</p></div>
        <div className="d68-ref-card"><div className="d68-card-icon">📊</div><h3>{T(lang, 'Theo dõi minh bạch', 'Transparent tracking')}</h3><p>{T(lang, 'Theo dõi liên kết giới thiệu, chuyển đổi và hoa hồng sau khi đơn hàng đã thanh toán và không hoàn tiền.', 'Track referral links, conversions and commissions after paid, non-refunded orders.')}</p></div>
      </div>
      <CTA lang={lang} title="Ứng tuyển làm Đối tác thị trường" titleEn="Apply to become a Market Partner" desc="Tài khoản Đối tác thị trường cần được quản trị viên duyệt trước khi kích hoạt đầy đủ quyền theo dõi và hoa hồng." descEn="Market Partner accounts require admin approval before full tracking and commission permissions are activated." to="/register/market-partner" cta="Đăng ký Đối tác thị trường" ctaEn="Register as Market Partner" />
    </section>
  </>;
}
