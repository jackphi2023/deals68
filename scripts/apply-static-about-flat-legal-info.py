from pathlib import Path
import re


def read(path: str) -> str:
    return Path(path).read_text(encoding='utf-8')


def write(path: str, content: str) -> None:
    Path(path).write_text(content, encoding='utf-8')


def replace_once(content: str, old: str, new: str, label: str) -> str:
    count = content.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 match, found {count}')
    return content.replace(old, new, 1)


# About page component and legal effective dates.
path = 'src/pages/StaticPages.tsx'
text = read(path)
text = replace_once(
    text,
    'export function About({ lang }: Props) {\n  return <main className="d68-static-page">',
    'export function About({ lang }: Props) {\n  return <main className="d68-static-page d68-static-about-page">',
    'About page class',
)
text = replace_once(
    text,
    '<div className="d68-static-grid d68-static-grid--2">\n        <Card title={T(lang, \'Giá trị dành cho cố vấn và đối tác thị trường\', \'Value for advisors and market partners\')}>',
    '<div className="d68-static-about-single">\n        <Card title={T(lang, \'Giá trị dành cho cố vấn và đối tác thị trường\', \'Value for advisors and market partners\')}>',
    'Advisor section wrapper',
)
scope_pattern = re.compile(
    r"\n\s*<Card title=\{T\(lang, 'Phạm vi và giới hạn', 'Scope and limitations'\)\}>.*?</Card>",
    re.S,
)
text, scope_count = scope_pattern.subn('', text, count=1)
if scope_count != 1:
    raise SystemExit(f'About scope removal: expected 1 match, found {scope_count}')
text = text.replace('meta="Ngày hiệu lực: [Ngày hiệu lực]"', 'meta="Ngày hiệu lực: Tháng 6/2026"')
text = text.replace('metaEn="Effective date: [Effective date]"', 'metaEn="Effective date: June 2026"')
write(path, text)

# Terms: legal operator, liability reference date, jurisdiction and contact.
path = 'src/content/staticTermsContent1.ts'
text = read(path)
text = replace_once(
    text,
    'Deals68.com được vận hành bởi [Tên pháp nhân đầy đủ], mã số doanh nghiệp [●], địa chỉ [●] (“Deals68”, “chúng tôi”).',
    'Deals68.com được vận hành bởi Deals68.com (“Deals68”, “chúng tôi”).',
    'Terms operator VI',
)
text = replace_once(
    text,
    'Deals68.com is operated by [full legal entity name], registration number [●], registered address [●] (“Deals68”, “we”, “us”).',
    'Deals68.com is operated by Deals68.com (“Deals68”, “we”, “us”).',
    'Terms operator EN',
)
write(path, text)

path = 'src/content/staticTermsContent2.ts'
text = read(path)
text = replace_once(
    text,
    'Tổng trách nhiệm trực tiếp của Deals68 liên quan đến một dịch vụ không vượt quá số phí người dùng thực trả cho dịch vụ đó trong [6/12] tháng trước sự kiện phát sinh, trừ khi pháp luật bắt buộc khác.',
    'Tổng trách nhiệm trực tiếp của Deals68 liên quan đến một dịch vụ không vượt quá số phí người dùng thực trả cho dịch vụ đó kể từ Tháng 6/2026 đến trước sự kiện phát sinh, trừ khi pháp luật bắt buộc khác.',
    'Terms liability period VI',
)
text = replace_once(
    text,
    'Deals68’s aggregate direct liability for a service will not exceed the fees actually paid by the user for that service during the [6/12] months preceding the event, unless mandatory law requires otherwise.',
    'Deals68’s aggregate direct liability for a service will not exceed the fees actually paid by the user for that service from June 2026 until the event giving rise to the claim, unless mandatory law requires otherwise.',
    'Terms liability period EN',
)
text = replace_once(
    text,
    'Điều khoản này được điều chỉnh bởi pháp luật [Việt Nam]. Tranh chấp trước hết được thương lượng thiện chí trong 30 ngày. Nếu không giải quyết được, tranh chấp thuộc thẩm quyền của [Tòa án/Trọng tài cụ thể tại Thành phố Hồ Chí Minh], trừ khi pháp luật bảo vệ người tiêu dùng hoặc quy định bắt buộc yêu cầu khác.',
    'Điều khoản này được điều chỉnh bởi pháp luật Việt Nam. Tranh chấp trước hết được thương lượng thiện chí trong 30 ngày. Nếu không giải quyết được, tranh chấp sẽ được giải quyết tại Việt Nam, trừ khi pháp luật bảo vệ người tiêu dùng hoặc quy định bắt buộc yêu cầu khác.',
    'Terms jurisdiction VI',
)
text = replace_once(
    text,
    'These Terms are governed by the laws of [Vietnam]. Disputes should first be subject to good-faith negotiation for 30 days. Unresolved disputes shall be submitted to [specified courts/arbitration institution in Ho Chi Minh City], except where mandatory consumer or other laws require otherwise.',
    'These Terms are governed by the laws of Vietnam. Disputes should first be subject to good-faith negotiation for 30 days. Unresolved disputes shall be resolved in Vietnam, except where mandatory consumer or other laws require otherwise.',
    'Terms jurisdiction EN',
)
text = text.replace('[legal@deals68.com]', 'partner@vietcapitalpartners.com')
write(path, text)

# Privacy: responsible entity and contact details.
path = 'src/content/staticPrivacyContent1.ts'
text = read(path)
text = replace_once(
    text,
    'Đơn vị kiểm soát dữ liệu chính là [Tên pháp nhân, địa chỉ, mã số doanh nghiệp].',
    'Đơn vị kiểm soát dữ liệu chính là Deals68.com.',
    'Privacy controller VI',
)
text = replace_once(
    text,
    'The primary data controller is [legal entity, address and registration number].',
    'The primary data controller is Deals68.com.',
    'Privacy controller EN',
)
write(path, text)

path = 'src/content/staticPrivacyContent2.ts'
text = read(path)
text = text.replace('[privacy@deals68.com]', 'partner@vietcapitalpartners.com')
text = replace_once(
    text,
    'Câu hỏi, yêu cầu hoặc khiếu nại về dữ liệu gửi tới partner@vietcapitalpartners.com, địa chỉ [●], điện thoại [●].',
    'Câu hỏi, yêu cầu hoặc khiếu nại về dữ liệu gửi tới partner@vietcapitalpartners.com.',
    'Privacy contact VI',
)
text = replace_once(
    text,
    'Privacy questions, requests or complaints may be sent to partner@vietcapitalpartners.com, address [●], telephone [●].',
    'Privacy questions, requests or complaints may be sent to partner@vietcapitalpartners.com.',
    'Privacy contact EN',
)
write(path, text)

# About-only flat editorial styling. Legal and Contact layouts remain unchanged.
path = 'src/styles/pages/static.css'
text = read(path)
marker = '/* About flat editorial layout — continuous pale-blue canvas, no content boxes. */'
styles = r'''

/* About flat editorial layout — continuous pale-blue canvas, no content boxes. */
.d68-static-about-page{
  background:#E7F6FD;
}
.d68-static-about-page .d68-static-hero{
  background:radial-gradient(760px 360px at 88% 18%,rgba(255,255,255,.12),transparent 62%),linear-gradient(135deg,#0789DA 0%,#0769C7 100%);
  border-bottom:0;
  color:#fff;
}
.d68-static-about-page .d68-static-hero p{
  color:rgba(255,255,255,.88);
}
.d68-static-about-page .d68-static-eyebrow{
  background:rgba(255,255,255,.12);
  border:1px solid rgba(255,255,255,.24);
  color:#fff;
}
.d68-static-about-page .d68-static-hero__slogan{
  color:#F2B51D;
}
.d68-static-about-page .d68-static-section,
.d68-static-about-page .d68-static-section--alt{
  background:#E7F6FD;
  border:0;
  padding:0;
}
.d68-static-about-page .d68-static-section>.d68-static-container{
  border-top:1px solid rgba(15,42,74,.12);
  padding-top:58px;
  padding-bottom:58px;
}
.d68-static-about-page .d68-static-hero+.d68-static-section>.d68-static-container{
  border-top:0;
}
.d68-static-about-page .d68-static-title{
  margin-bottom:30px;
}
.d68-static-about-page .d68-static-title h2{
  color:#0F2A4A;
  font-size:30px;
  position:relative;
}
.d68-static-about-page .d68-static-title h2:after{
  background:#F2B51D;
  border-radius:999px;
  content:"";
  display:block;
  height:3px;
  margin:13px auto 0;
  width:44px;
}
.d68-static-about-page .d68-static-title p,
.d68-static-about-page .d68-static-prose,
.d68-static-about-page .d68-static-card p,
.d68-static-about-page .d68-static-card div,
.d68-static-about-page .d68-static-bullets{
  color:#334155;
}
.d68-static-about-page .d68-static-prose{
  margin:0 auto;
  max-width:820px;
}
.d68-static-about-page .d68-static-card{
  background:transparent;
  border:0;
  border-radius:0;
  box-shadow:none;
  padding:0;
  transition:none;
}
.d68-static-about-page .d68-static-card:hover{
  box-shadow:none;
  transform:none;
}
.d68-static-about-page .d68-static-card h3{
  color:#F2B51D;
  font-size:17px;
  line-height:1.45;
  margin-bottom:8px;
}
.d68-static-about-page .d68-static-card strong{
  color:#F2B51D;
  font-size:24px;
  margin:5px 0 6px;
}
.d68-static-about-page .d68-static-card__icon,
.d68-static-about-page .d68-static-card__icon--line{
  background:transparent;
  border-radius:0;
  color:#1BADEA;
  height:28px;
  margin-bottom:8px;
  width:28px;
}
.d68-static-about-page .d68-static-card__icon--line svg{
  height:25px;
  width:25px;
}
.d68-static-about-page .d68-static-grid{
  gap:30px 42px;
}
.d68-static-about-page .d68-static-grid--2>article+article{
  border-left:1px solid rgba(15,42,74,.12);
  padding-left:42px;
}
.d68-static-about-page .d68-static-grid--about-layers{
  counter-reset:d68AboutLayer;
  gap:34px 38px;
}
.d68-static-about-page .d68-static-grid--about-layers article{
  counter-increment:d68AboutLayer;
  padding-left:27px;
  position:relative;
}
.d68-static-about-page .d68-static-grid--about-layers article:before{
  color:#1BADEA;
  content:counter(d68AboutLayer) ".";
  font-size:14px;
  font-weight:900;
  left:0;
  position:absolute;
  top:1px;
}
.d68-static-about-page .d68-static-about-single{
  margin:0 auto;
  max-width:820px;
}
.d68-static-about-page .d68-static-card--wide{
  margin:0 auto;
  max-width:820px;
  padding:0;
}
.d68-static-about-page .d68-static-cta{
  background:transparent;
  border-radius:0;
  border-top:1px solid rgba(15,42,74,.12);
  box-shadow:none;
  color:#0F2A4A;
  margin-top:36px;
  padding:30px 0 0;
}
.d68-static-about-page .d68-static-cta p{
  color:#475569;
}
@media(max-width:900px){
  .d68-static-about-page .d68-static-section>.d68-static-container{padding-top:48px;padding-bottom:48px}
  .d68-static-about-page .d68-static-grid--about-layers{grid-template-columns:repeat(2,minmax(0,1fr))}
  .d68-static-about-page .d68-static-grid--about-layers article:last-child:nth-child(3n+2){grid-column:auto}
}
@media(max-width:620px){
  .d68-static-about-page .d68-static-section>.d68-static-container{padding-top:40px;padding-bottom:40px}
  .d68-static-about-page .d68-static-title h2{font-size:26px}
  .d68-static-about-page .d68-static-grid--about-layers{grid-template-columns:1fr}
  .d68-static-about-page .d68-static-grid--2>article+article{border-left:0;border-top:1px solid rgba(15,42,74,.12);padding-left:0;padding-top:28px}
  .d68-static-about-page .d68-static-cta{align-items:flex-start}
}
'''
if marker not in text:
    text = text.rstrip() + styles
write(path, text)

# Contract checks.
page = read('src/pages/StaticPages.tsx')
terms = read('src/content/staticTermsContent1.ts') + read('src/content/staticTermsContent2.ts')
privacy = read('src/content/staticPrivacyContent1.ts') + read('src/content/staticPrivacyContent2.ts')
css = read('src/styles/pages/static.css')
checks = {
    'About class': 'd68-static-about-page' in page,
    'About scope removed': 'Phạm vi và giới hạn' not in page and 'Scope and limitations' not in page,
    'About continuous background': 'background:#E7F6FD' in css,
    'About flat cards': '.d68-static-about-page .d68-static-card{' in css and 'background:transparent' in css,
    'About gold accents': 'color:#F2B51D' in css,
    'Terms date': 'Ngày hiệu lực: Tháng 6/2026' in page and 'Effective date: June 2026' in page,
    'Legal operator': 'Deals68.com được vận hành bởi Deals68.com' in terms,
    'Vietnam jurisdiction': 'tranh chấp sẽ được giải quyết tại Việt Nam' in terms,
    'Legal email': 'partner@vietcapitalpartners.com' in terms,
    'Privacy controller': 'Đơn vị kiểm soát dữ liệu chính là Deals68.com' in privacy,
    'Privacy email': 'partner@vietcapitalpartners.com' in privacy,
}
failed = [name for name, ok in checks.items() if not ok]
if failed:
    raise SystemExit('Static page checks failed: ' + ', '.join(failed))

for forbidden in [
    '[Ngày hiệu lực]', '[Effective date]', '[Tên pháp nhân đầy đủ]', '[full legal entity name]',
    '[6/12]', '[Việt Nam]', '[Vietnam]', '[Tòa án/Trọng tài', '[specified courts/arbitration',
    '[privacy@deals68.com]', '[legal@deals68.com]', '[Tên pháp nhân, địa chỉ, mã số doanh nghiệp]',
    '[legal entity, address and registration number]', 'địa chỉ [●]', 'address [●]',
]:
    if forbidden in page + terms + privacy:
        raise SystemExit(f'Unresolved legal placeholder: {forbidden}')
