
import { Link } from 'react-router-dom';
import type { Lang } from '../lib/i18n';
import { toLocalizedPath } from '../lib/i18nRoutes';

const T = (lang: Lang, vi: string, en: string) => (lang === 'en' ? en : vi);

const locations = [
  { vi: 'TP. Hồ Chí Minh', en: 'Ho Chi Minh City', city: 'TP. Hồ Chí Minh' },
  { vi: 'Hà Nội', en: 'Hanoi', city: 'Hà Nội' },
  { vi: 'Đà Nẵng', en: 'Da Nang', city: 'Đà Nẵng' },
  { vi: 'Hải Phòng', en: 'Hai Phong', city: 'Hải Phòng' },
  { vi: 'Khánh Hòa', en: 'Khanh Hoa', city: 'Khánh Hòa' },
  { vi: 'Lâm Đồng', en: 'Lam Dong', city: 'Lâm Đồng' },
  { vi: 'Huế', en: 'Hue', city: 'Huế' },
  { vi: 'Đồng Nai', en: 'Dong Nai', city: 'Đồng Nai' },
  { vi: 'Cần Thơ', en: 'Can Tho', city: 'Cần Thơ' }
];

const faqs = [
  {
    qVi: 'Doanh nghiệp trên Deals68 có uy tín không?',
    qEn: 'Are businesses on Deals68 reliable?',
    aVi: 'Thông tin doanh nghiệp do doanh nghiệp tự đăng tải và tự chịu trách nhiệm. Deals68 kiểm duyệt hồ sơ trước khi hiển thị công khai và cung cấp đánh giá tổng thể như Business Quality Score để Nhà đầu tư có thêm cơ sở sàng lọc ban đầu.',
    aEn: 'Business information is submitted by the businesses themselves and they are responsible for its accuracy. Deals68 reviews profiles before public display and provides an overall assessment such as the Business Quality Score so investors have an additional basis for initial screening.'
  },
  {
    qVi: 'Deals68 kiểm duyệt hồ sơ như thế nào?',
    qEn: 'How does Deals68 review business profiles?',
    aVi: 'Mọi hồ sơ được đội ngũ Deals68 duyệt trước khi hiển thị, nhằm đảm bảo ẩn danh tên/thương hiệu, làm mờ hình ảnh nhạy cảm và xác minh mã số thuế khi cần.',
    aEn: 'Every profile is reviewed by the Deals68 team before display to help anonymize names/brands, blur sensitive images and verify tax codes when needed.'
  },
  {
    qVi: 'Làm sao đảm bảo bảo mật và danh tính?',
    qEn: 'How are confidentiality and identity protected?',
    aVi: 'Hồ sơ hiển thị công khai luôn ở dạng ẩn danh. Thông tin đầy đủ và tài liệu chỉ mở sau khi hai bên chấp nhận kết nối theo quy trình của Deals68.',
    aEn: 'Public profiles are always shown in anonymous form. Full information and documents are unlocked only after both sides accept the connection through the Deals68 workflow.'
  },
  {
    qVi: 'Tôi liên hệ doanh nghiệp bằng cách nào?',
    qEn: 'How can I contact a business?',
    aVi: 'Bạn cần đăng ký tài khoản Nhà đầu tư và có gói thành viên phù hợp, sau đó bấm “Bày tỏ quan tâm” để gửi yêu cầu kết nối với doanh nghiệp.',
    aEn: 'You need to register an Investor account and have a suitable membership plan, then click “Express interest” to send a connection request to the business.'
  },
  {
    qVi: 'Deals68 có hỗ trợ phân tích, làm hồ sơ chi tiết cho doanh nghiệp không?',
    qEn: 'Does Deals68 support analysis and detailed profile preparation?',
    aVi: 'Có. Chúng tôi có đội ngũ hỗ trợ doanh nghiệp và nhà đầu tư chuẩn hóa hồ sơ, phân tích số liệu, chuẩn bị tài liệu đánh giá chi tiết để hai bên có thể tiến tới giao dịch. Tham khảo thêm tại www.vietcapitalpartners.com.',
    aEn: 'Yes. We have a team that supports businesses and investors in structuring profiles, analyzing data and preparing detailed assessment materials so both sides can move toward a transaction. Learn more at www.vietcapitalpartners.com.'
  }
];

export function BusinessFaq({ lang }: { lang: Lang }) {
  return (
    <section className="d68-onsite-faq" aria-label={T(lang, 'Câu hỏi thường gặp', 'Frequently asked questions')}>
      <div className="d68-onsite-head">
        <span>{T(lang, 'Câu hỏi thường gặp', 'FAQ')}</span>
        <h2>{T(lang, 'Câu hỏi thường gặp khi xem doanh nghiệp trên Deals68', 'Frequently asked questions when viewing businesses on Deals68')}</h2>
      </div>
      <div className="d68-onsite-faq-list">
        {faqs.map((item, idx) => (
          <details key={item.qVi} className="d68-onsite-faq-item" open={idx === 0}>
            <summary>{T(lang, item.qVi, item.qEn)}</summary>
            <p>
              {T(lang, item.aVi, item.aEn)}
            </p>
          </details>
        ))}
      </div>
    </section>
  );
}

export function BusinessOnsiteContent({ lang }: { lang: Lang }) {
  const base = toLocalizedPath('/businesses', lang);

  return (
    <section className="d68-onsite d68-businesses-onsite">
      <div className="d68-onsite-card d68-onsite-intro">
        <div className="d68-onsite-head">
          <span>{T(lang, 'Đầu tư, Mua bán Doanh nghiệp tại Deals68', 'Investing and Business M&A at Deals68')}</span>
          <h2>{T(lang, 'Khám phá doanh nghiệp đang chào bán tại Việt Nam', 'Explore businesses for sale and investment in Vietnam')}</h2>
        </div>
        <p>
          {T(
            lang,
            'Việt Nam là một trong những thị trường doanh nghiệp tư nhân năng động tại Đông Nam Á, với nhiều doanh nghiệp vừa và nhỏ đang tìm đối tác chiến lược, vốn tăng trưởng, chuyển nhượng một phần hoặc toàn bộ doanh nghiệp. Với lợi thế dân số trẻ, tiêu dùng nội địa tăng, chuỗi cung ứng mở rộng và nhiều ngành đang chuyển đổi số, doanh nghiệp Việt Nam có thể tạo ra cơ hội hấp dẫn cho nhà đầu tư trong và ngoài nước.',
            'Vietnam is one of Southeast Asia’s dynamic private business markets, with many small and medium-sized companies seeking strategic partners, growth capital, partial transfers or full business sales. With a young population, rising domestic consumption, expanding supply chains and many sectors undergoing digital transformation, Vietnamese businesses can create attractive opportunities for local and international investors.'
          )}
        </p>
        <p>
          {T(
            lang,
            'Deals68 giúp chuẩn hóa quá trình tìm kiếm, sàng lọc và kết nối thương vụ mua bán công ty, sang nhượng doanh nghiệp, gọi vốn và hợp tác đầu tư. Hồ sơ được hiển thị ẩn danh, có bộ lọc theo ngành, địa điểm, quy mô và loại giao dịch; thông tin nhạy cảm chỉ mở sau khi hai bên chấp nhận kết nối.',
            'Deals68 helps standardize the process of finding, screening and connecting business sale, transfer, fundraising and investment partnership opportunities. Profiles are displayed anonymously, with filters by industry, location, size and transaction type; sensitive information is unlocked only after both sides accept the connection.'
          )}
        </p>
      </div>

      <div className="d68-onsite-card d68-onsite-locations">
        <div className="d68-onsite-head">
          <span>{T(lang, 'Theo địa điểm', 'By location')}</span>
          <h2>{T(lang, 'Duyệt doanh nghiệp theo địa điểm', 'Browse businesses by location')}</h2>
        </div>
        <div className="d68-onsite-tags">
          {locations.map((loc) => {
            const keyword = T(lang, `mua bán công ty ${loc.vi}`, `businesses for sale in ${loc.en}`);
            const href = `${base}?search=${encodeURIComponent(keyword)}&city=${encodeURIComponent(loc.city)}`;
            return <Link key={loc.vi} to={href}>{keyword}</Link>;
          })}
        </div>
      </div>

      <BusinessFaq lang={lang} />
    </section>
  );
}
