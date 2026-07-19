from pathlib import Path
import re


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected exactly 1 match, found {count}')
    return text.replace(old, new, 1)


home_path = Path('src/pages/Home.tsx')
home = home_path.read_text(encoding='utf-8')
home = replace_once(
    home,
    "T(lang, 'Bạn tham gia với vai trò nào?', 'Which role fits you?')",
    "T(lang, 'Tham gia Deals68', 'Which role fits you?')",
    'Homepage roles heading',
)
home = replace_once(
    home,
    "T(lang, 'Deals68 phục vụ nhiều nhu cầu: gọi vốn, mua bán, cho vay và phát triển thị trường.', 'Deals68 serves many needs: fundraising, M&A, lending and market development.')",
    "T(lang, 'Nền tảng mua bán doanh nghiệp, M&A, huy động vốn và kết nối nhà đầu tư trong nước và quốc tế cho doanh nghiệp Việt Nam trên toàn cầu.', 'Deals68 serves many needs: fundraising, M&A, lending and market development.')",
    'Homepage roles description',
)
home = replace_once(
    home,
    "<h2 style={{ color: '#0F2A4A' }}>{T(lang, 'Cách hoạt động', 'How it works')}</h2>",
    "<h2>{T(lang, 'Cách hoạt động', 'How it works')}</h2>",
    'How-it-works inline heading style',
)
home_path.write_text(home, encoding='utf-8')

home_css_path = Path('src/styles/pages/home.css')
home_css = home_css_path.read_text(encoding='utf-8')
home_css = replace_once(
    home_css,
    '.d68-home-how{background:#EEF2F6;color:#0F2A4A}',
    '.d68-home-how{color:#0F2A4A}',
    'Legacy How-it-works gray surface',
)
home_css_path.write_text(home_css, encoding='utf-8')

layout_path = Path('src/styles/pages/home-layout.css')
layout = layout_path.read_text(encoding='utf-8')
layout = replace_once(
    layout,
    """/* How-it-works keeps its own section surface and internal content padding.
   No additional external spacing is introduced here. */
.d68-home-page > .d68-home-how {
  margin-block: 0;
}
""",
    """/* How-it-works inherits the common Homepage canvas. Its nested container
   keeps only internal content padding; step cards remain white surfaces. */
.d68-home-page > .d68-home-how,
.d68-home-page > .d68-home-how > .d68-home-container {
  background: transparent;
}

.d68-home-page > .d68-home-how {
  margin-block: 0;
  border: 0;
  box-shadow: none;
}
""",
    'How-it-works layout ownership block',
)
layout_path.write_text(layout, encoding='utf-8')

# Source contracts: only the layout owner may declare a background for the
# How-it-works outer section, and that background must be transparent.
expected_vi = 'Nền tảng mua bán doanh nghiệp, M&A, huy động vốn và kết nối nhà đầu tư trong nước và quốc tế cho doanh nghiệp Việt Nam trên toàn cầu.'
assert "T(lang, 'Tham gia Deals68', 'Which role fits you?')" in home
assert expected_vi in home
assert "Bạn tham gia với vai trò nào?" not in home
assert "Deals68 phục vụ nhiều nhu cầu: gọi vốn, mua bán, cho vay và phát triển thị trường." not in home
assert "<h2 style={{ color: '#0F2A4A' }}>" not in home
assert '.d68-home-how{background:#EEF2F6' not in home_css
assert '.d68-home-page > .d68-home-how > .d68-home-container' in layout

violations = []
for css_path in Path('src/styles').rglob('*.css'):
    css = css_path.read_text(encoding='utf-8')
    for match in re.finditer(r'([^{}]*\.d68-home-how[^{}]*)\{([^{}]*)\}', css, re.S):
        selector, body = match.group(1), match.group(2)
        backgrounds = re.findall(r'background(?:-color)?\s*:\s*([^;]+)', body, re.I)
        for value in backgrounds:
            if value.strip().lower() != 'transparent':
                violations.append(f'{css_path}: {selector.strip()} -> {value.strip()}')

if violations:
    raise SystemExit('Conflicting How-it-works backgrounds remain:\n' + '\n'.join(violations))

print('Homepage wording and How-it-works background contracts: PASS')
