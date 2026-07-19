from pathlib import Path


def replace_required(text: str, old: str, new: str, label: str, count: int | None = None) -> str:
    found = text.count(old)
    if found == 0:
        raise SystemExit(f'{label}: source block not found')
    if count is not None and found != count:
        raise SystemExit(f'{label}: expected {count}, found {found}')
    return text.replace(old, new)


page_path = Path('src/pages/StaticPages.tsx')
page = page_path.read_text(encoding='utf-8')

page = replace_required(
    page,
    "function Section({ children, narrow = false, alt = false }: { children: React.ReactNode; narrow?: boolean; alt?: boolean }) {\n  return <section className={`d68-static-section${alt ? ' d68-static-section--alt' : ''}`}>\n    <div className={narrow ? 'd68-static-container d68-static-container--narrow' : 'd68-static-container'}>{children}</div>\n  </section>;\n}",
    "function Section({ children, narrow = false, alt = false, className = '' }: { children: React.ReactNode; narrow?: boolean; alt?: boolean; className?: string }) {\n  return <section className={`d68-static-section${alt ? ' d68-static-section--alt' : ''}${className ? ` ${className}` : ''}`}>\n    <div className={narrow ? 'd68-static-container d68-static-container--narrow' : 'd68-static-container'}>{children}</div>\n  </section>;\n}",
    'Section className support',
    1,
)

page = replace_required(
    page,
    "{ icon: <Globe2 />, vi: 'Đối tác thị trường', en: 'Market Partners', descVi: 'Hỗ trợ Deals68 phát triển cộng đồng doanh nghiệp và nhà đầu tư tại từng quốc gia, thành phố hoặc cộng đồng người Việt.', descEn: 'Help Deals68 grow business and investor communities by country, city or Vietnamese diaspora market.' }",
    "{ icon: <Globe2 />, vi: 'Đối tác thị trường', en: 'Market Partners', descVi: 'Đối tác luật, tài chính, cố vấn, môi giới có thể tham gia Deals68 để giúp giao dịch hoàn thành nhanh chóng và hiệu quả.', descEn: 'Legal, financial, advisory and brokerage partners can join Deals68 to help transactions close faster and more effectively.' }",
    'Market partner description',
    1,
)

page = replace_required(
    page,
    "  return <main className=\"d68-static-page\">\n    <Hero lang={lang} kicker=\"Giới thiệu\" kickerEn=\"About\" title=\"Về Deals68\" titleEn=\"About Deals68\" desc=\"Deals68.com là nền tảng kết nối doanh nghiệp Việt và doanh nghiệp toàn cầu với nhà đầu tư, người mua doanh nghiệp, bên cho vay và đối tác chiến lược trên toàn cầu.\" descEn=\"Deals68.com connects Vietnamese and global businesses with investors, business buyers, lenders and strategic partners worldwide.\" />",
    "  return <main className=\"d68-static-page d68-static-page--about\">\n    <Hero lang={lang} kicker=\"Giới thiệu\" kickerEn=\"About\" title=\"Deals68 - Kết nối thương vụ, Khai mở lộc phát\" titleEn=\"Deals68 - Connecting Deals, Unlocking Prosperity\" desc=\"Deals68.com là nền tảng kết nối doanh nghiệp Việt và doanh nghiệp toàn cầu với nhà đầu tư, người mua doanh nghiệp, bên cho vay và đối tác chiến lược trên toàn cầu.\" descEn=\"Deals68.com connects Vietnamese and global businesses with investors, business buyers, lenders and strategic partners worldwide.\" />",
    'About hero',
    1,
)

page = replace_required(
    page,
    "<h2>{T(lang, 'Tầm nhìn toàn cầu của Deals68', 'Deals68 global vision')}</h2>\n        <p>{T(lang, 'Giai đoạn đầu, Deals68 tập trung phục vụ doanh nghiệp Việt Nam, chủ cửa hàng, nhà đầu tư người Việt ở nước ngoài và các đối tác vốn quan tâm đến doanh nghiệp Việt. Sau đó, nền tảng sẽ từng bước mở rộng sang doanh nghiệp và nhà đầu tư quốc tế ở nhiều thị trường.', 'In the first stage, Deals68 focuses on Vietnamese businesses, store owners, overseas Vietnamese investors and capital partners interested in Vietnam-related opportunities. Over time, the platform will expand to international businesses and investors across multiple markets.')}</p>",
    "<h2>{T(lang, 'Tầm nhìn Deals68', 'Deals68 Vision')}</h2>\n        <p>{T(lang, 'Chúng tôi hướng tới phục vụ cộng đồng doanh nghiệp Việt Nam trên toàn cầu với các nhà đầu tư, đối tác trong nước và trên toàn thế giới.', 'We aim to serve Vietnamese business communities worldwide by connecting them with investors and partners in Vietnam and across the globe.')}</p>",
    'Vision copy',
    1,
)

page = replace_required(
    page,
    "    <Section alt>\n      <div className=\"d68-static-title\">\n        <h2>{T(lang, 'Nền tảng được xây quanh niềm tin dữ liệu', 'Built around data trust')}</h2>\n        <p>{T(lang, 'Deals68 ưu tiên hồ sơ ẩn danh, dữ liệu được chuẩn hóa và quy trình duyệt trước khi công khai để giảm rủi ro lộ thông tin riêng tư.', 'Deals68 prioritises anonymous profiles, structured data and approval before publication to reduce private-information exposure risk.')}</p>",
    "    <Section alt className=\"d68-static-section--about-platform\">\n      <div className=\"d68-static-title\">\n        <h2>{T(lang, 'Nền tảng giao dịch M&A, Huy động vốn toàn diện', 'A Comprehensive M&A and Fundraising Transaction Platform')}</h2>\n        <p>{T(lang, 'Deals68 là nền tảng giao dịch tư nhân dành cho doanh nghiệp Việt và nhà đầu tư trên toàn cầu, từ khám phá cơ hội, chuẩn hóa và xác minh dữ liệu, cải thiện chất lượng doanh nghiệp, tổ chức thẩm định và giao dịch, đến quản trị giá trị sau đầu tư.', 'Deals68 is a private transaction platform for Vietnamese businesses and investors worldwide, covering opportunity discovery, data standardisation and verification, business quality improvement, due diligence and transaction execution, and post-investment value management.')}</p>",
    'Platform section copy and class',
    1,
)

page = replace_required(
    page,
    "<h2>{T(lang, 'Ba nhóm người dùng chính', 'Three core user groups')}</h2>\n        <p>{T(lang, 'Mỗi nhóm có luồng hiển thị và quyền xem riêng để bảo vệ dữ liệu và tăng chất lượng kết nối.', 'Each group has a dedicated display and access flow to protect data and improve matching quality.')}</p>",
    "<h2>{T(lang, 'Đối tác chúng tôi phục vụ', 'Partners We Serve')}</h2>\n        <p>{T(lang, 'Chúng tôi chào đón các đối tác cùng đồng hành.', 'We welcome partners to join and grow with us.')}</p>",
    'Partners copy',
    1,
)

page_path.write_text(page, encoding='utf-8')

index_path = Path('src/styles/index.css')
index = index_path.read_text(encoding='utf-8')
index = replace_required(
    index,
    "@import './pages/static.css' layer(d68-overrides);\n",
    "@import './pages/static.css' layer(d68-overrides);\n@import './pages/about.css' layer(d68-overrides);\n",
    'About stylesheet import',
    1,
)
index_path.write_text(index, encoding='utf-8')

about_css = '''/* About page ownership.
   Static legal pages remain governed by static.css; this file only styles About. */

.d68-static-page--about .d68-static-container {
  max-width: 1200px;
}

.d68-static-page--about .d68-static-title h2 {
  color: #F2B51D;
}

/* Full-width brand surface; readable content remains aligned to the 1200px grid. */
.d68-static-page--about .d68-static-section--about-platform {
  width: 100%;
  max-width: none;
  background: #E7F6FD;
  border: 0;
}

.d68-static-page--about .d68-static-section--about-platform .d68-static-title p {
  color: #334155;
}

.d68-static-page--about .d68-static-cta--partnership {
  background: #1BADEA;
  border: 0;
  box-shadow: none;
  color: #F2B51D;
}

.d68-static-page--about .d68-static-cta--partnership p {
  color: #F2B51D;
}
'''
Path('src/styles/pages/about.css').write_text(about_css, encoding='utf-8')

checks = {
    'about page scope': 'd68-static-page d68-static-page--about' in page,
    'vision copy': 'Tầm nhìn Deals68' in page and 'Deals68 Vision' in page,
    'platform copy': 'Nền tảng giao dịch M&A, Huy động vốn toàn diện' in page,
    'partners copy': 'Đối tác chúng tôi phục vụ' in page,
    'market partner copy': 'Đối tác luật, tài chính, cố vấn, môi giới' in page,
    'full-width modifier': 'd68-static-section--about-platform' in page,
    'about import': "@import './pages/about.css'" in index,
}
failed = [name for name, ok in checks.items() if not ok]
if failed:
    raise SystemExit('About V2 assertions failed: ' + ', '.join(failed))
