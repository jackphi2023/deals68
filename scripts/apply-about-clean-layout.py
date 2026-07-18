from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 match, found {count}')
    return text.replace(old, new, 1)


# Update About JSX only.
page_path = Path('src/pages/StaticPages.tsx')
page = page_path.read_text(encoding='utf-8')
page = replace_once(
    page,
    '      slogan="Kết nối thương vụ, khai mở lộc phát."\n      sloganEn="Connecting Deals, Unlocking Prosperity."',
    '      slogan="Deals68 Kết nối thương vụ, khai mở lộc phát."\n      sloganEn="Deals68 Connecting Deals, Unlocking Prosperity."',
    'About slogan',
)
cta = '''      <CTA
        lang={lang}
        to="/"
        title="Bắt đầu từ một hồ sơ có chất lượng"
        titleEn="Start with a high-quality profile"
        text="Đăng hồ sơ doanh nghiệp, xác lập tiêu chí đầu tư hoặc tham gia với vai trò cố vấn và đối tác thị trường."
        textEn="Create a business profile, set your investment criteria or participate as an advisor or Market Partner."
        cta="Khám phá Deals68"
        ctaEn="Explore Deals68"
      />
'''
page = replace_once(page, cta, '', 'About CTA removal')
page_path.write_text(page, encoding='utf-8')

# Remove the migrated About block from the shared static stylesheet.
static_path = Path('src/styles/pages/static.css')
static_css = static_path.read_text(encoding='utf-8')
marker = '/* About flat editorial layout — continuous pale-blue canvas, no content boxes. */'
marker_index = static_css.find(marker)
if marker_index < 0:
    raise SystemExit('Legacy About CSS marker not found')
static_path.write_text(static_css[:marker_index].rstrip() + '\n', encoding='utf-8')

# Load dedicated About CSS after frozen release compatibility rules.
entry_path = Path('src/styles/index.css')
entry = entry_path.read_text(encoding='utf-8')
about_import = "@import './pages/about.css' layer(d68-overrides);"
if about_import not in entry:
    anchor = "@import './pages/release-cleanup.css' layer(d68-overrides);"
    entry = replace_once(entry, anchor, anchor + '\n' + about_import, 'About CSS import')
entry_path.write_text(entry, encoding='utf-8')

# Contract checks.
page = page_path.read_text(encoding='utf-8')
static_css = static_path.read_text(encoding='utf-8')
about_css = Path('src/styles/pages/about.css').read_text(encoding='utf-8')
entry = entry_path.read_text(encoding='utf-8')
checks = {
    'new Vietnamese slogan': 'Deals68 Kết nối thương vụ, khai mở lộc phát.' in page,
    'new English slogan': 'Deals68 Connecting Deals, Unlocking Prosperity.' in page,
    'CTA removed': 'Bắt đầu từ một hồ sơ có chất lượng' not in page and 'Explore Deals68' not in page,
    'legacy About CSS removed': marker not in static_css,
    'dedicated About CSS imported': about_import in entry,
    '1200 container': '1200px' in about_css,
    'equal two columns': 'grid-template-columns: repeat(2, minmax(0, 1fr));' in about_css,
    'equal three columns': 'grid-template-columns: repeat(3, minmax(0, 1fr));' in about_css,
    'uniform gold headings': '--d68-about-heading: #F2B51D;' in about_css and 'font-size: 18px;' in about_css,
    'white hero slogan': '.d68-static-about-page .d68-static-hero__slogan' in about_css and 'color: #FFFFFF;' in about_css,
    'black body text': '--d68-about-text: #111111;' in about_css,
}
failed = [name for name, ok in checks.items() if not ok]
if failed:
    raise SystemExit('About assertions failed: ' + ', '.join(failed))
