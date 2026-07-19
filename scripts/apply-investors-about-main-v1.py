from pathlib import Path
import re


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected 1 match, found {count}")
    return text.replace(old, new, 1)


investors_path = Path('src/pages/Investors.tsx')
investors = investors_path.read_text(encoding='utf-8')
investors = replace_once(
    investors,
    "${T(lang, 'Hiển thị', 'Showing')} ${resultStart}-${resultEnd}/${total} ${T(lang, 'hồ sơ', 'profiles')}",
    "${T(lang, 'Hiển thị', 'Showing')} ${resultStart}-${resultEnd}/${total} ${T(lang, 'nhà đầu tư, đối tác', 'investors and partners')}",
    'investor range wording',
)
investors = replace_once(
    investors,
    "${T(lang, 'Hiển thị', 'Showing')} ${items.length} ${T(lang, 'hồ sơ', 'profiles')}",
    "${T(lang, 'Hiển thị', 'Showing')} ${items.length} ${T(lang, 'nhà đầu tư, đối tác', 'investors and partners')}",
    'investor fallback wording',
)
investors_path.write_text(investors, encoding='utf-8')


static_path = Path('src/pages/StaticPages.tsx')
static = static_path.read_text(encoding='utf-8')
static = replace_once(
    static,
    """import {
  aboutBusinessValues,
  aboutInvestorValues,
  aboutLayers,
  aboutTrustPrinciples,
  type LegalItem,
} from '../content/staticAboutContent';
""",
    """import {
  BarChart3,
  Briefcase,
  Building2,
  Globe2,
  Handshake,
  ShieldCheck,
  Target,
} from 'lucide-react';
import { type LegalItem } from '../content/staticAboutContent';
""",
    'about content imports',
)

icon_functions = re.compile(
    r"\nfunction GoalIcon\(\) \{.*?\n\}\n\nfunction GlobeIcon\(\) \{.*?\n\}\n",
    re.S,
)
static, icon_count = icon_functions.subn('\n', static, count=1)
if icon_count != 1:
    raise SystemExit(f'legacy about icon functions: expected 1 match, found {icon_count}')

about_main = r'''export function About({ lang }: Props) {
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
'''

about_pattern = re.compile(
    r"export function About\(\{ lang \}: Props\) \{.*?\n\}\n\nexport function Terms",
    re.S,
)
static, about_count = about_pattern.subn(about_main + '\nexport function Terms', static, count=1)
if about_count != 1:
    raise SystemExit(f'about function: expected 1 match, found {about_count}')

static_path.write_text(static, encoding='utf-8')


static_css_path = Path('src/styles/pages/static.css')
static_css = static_css_path.read_text(encoding='utf-8')
static_css = replace_once(
    static_css,
    ".d68-static-card__icon--line{\n  background:#E7F6FD;\n  color:#1BADEA;\n}",
    ".d68-static-card__icon--line{\n  background:#EAF0F6;\n  color:#F2B51D;\n}",
    'about line icon colour',
)
static_css_path.write_text(static_css, encoding='utf-8')


index_path = Path('src/styles/index.css')
index_css = index_path.read_text(encoding='utf-8')
index_css = replace_once(
    index_css,
    "@import './pages/about.css' layer(d68-overrides);\n",
    '',
    'about stylesheet import',
)
index_path.write_text(index_css, encoding='utf-8')


checks = {
    'investor wording vi': investors.count("'nhà đầu tư, đối tác'") == 2,
    'investor wording en': investors.count("'investors and partners'") == 2,
    'legacy investor profile wording removed': "T(lang, 'hồ sơ', 'profiles')" not in investors,
    'main about title restored': 'title="Về Deals68"' in static,
    'main about vision restored': 'Tầm nhìn toàn cầu của Deals68' in static,
    'main about trust section restored': 'Nền tảng được xây quanh niềm tin dữ liệu' in static,
    'main about user groups restored': 'Ba nhóm người dùng chính' in static,
    'long-form about wrapper removed': 'd68-static-about-page' not in static,
    'long-form about section removed': 'Cấu trúc chiến lược năm lớp' not in static,
    'gold icon contract': 'color:#F2B51D;' in static_css,
    'about css import removed': "pages/about.css" not in index_css,
}
failed = [name for name, ok in checks.items() if not ok]
if failed:
    raise SystemExit('Update assertions failed: ' + ', '.join(failed))
