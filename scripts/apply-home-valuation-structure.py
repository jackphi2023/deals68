from pathlib import Path
import re


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 match, found {count}')
    return text.replace(old, new, 1)

# 1) Separate the full-width section from the horizontal container.
home_path = Path('src/pages/Home.tsx')
home = home_path.read_text(encoding='utf-8')
old_markup = '''      <section className="d68-home-container d68-home-valuation"><div className="d68-home-valuation__box"><div><span>{T(lang, 'Miễn phí - Không cần đăng nhập', 'Free - No login required')}</span><h2>{T(lang, 'Định giá sơ bộ doanh nghiệp của bạn', 'Estimate your business valuation')}</h2><p>{T(lang, 'Nhập một vài chỉ số để nhận khoảng định giá tham khảo trước khi đăng hồ sơ gọi vốn hoặc chuyển nhượng.', 'Enter a few metrics to get a reference valuation range before listing to raise capital or transfer.')}</p></div><Link to={nav('/valuation')}>{T(lang, 'Định giá ngay', 'Value my business')} →</Link></div></section>'''
new_markup = '''      <section className="d68-home-valuation">
        <div className="d68-home-container">
          <div className="d68-home-valuation__box">
            <div>
              <span>{T(lang, 'Miễn phí - Không cần đăng nhập', 'Free - No login required')}</span>
              <h2>{T(lang, 'Định giá sơ bộ doanh nghiệp của bạn', 'Estimate your business valuation')}</h2>
              <p>{T(lang, 'Nhập một vài chỉ số để nhận khoảng định giá tham khảo trước khi đăng hồ sơ gọi vốn hoặc chuyển nhượng.', 'Enter a few metrics to get a reference valuation range before listing to raise capital or transfer.')}</p>
            </div>
            <Link to={nav('/valuation')}>{T(lang, 'Định giá ngay', 'Value my business')} →</Link>
          </div>
        </div>
      </section>'''
home = replace_once(home, old_markup, new_markup, 'Home valuation markup')
home_path.write_text(home, encoding='utf-8')

# 2) Remove the legacy high-specificity white surface wherever it lives.
legacy_selector = re.compile(
    r'\.d68-home-page\s+\.d68-home-container\.d68-home-valuation\s*\{[^{}]*\}',
    re.MULTILINE,
)
removed = 0
for css_path in Path('src/styles').rglob('*.css'):
    css = css_path.read_text(encoding='utf-8')
    updated, count = legacy_selector.subn('', css)
    if count:
        css_path.write_text(updated, encoding='utf-8')
        removed += count
if removed == 0:
    raise SystemExit('Legacy white valuation selector was not found')

# 3) Make home-layout.css the single owner of the outer surface.
layout_path = Path('src/styles/pages/home-layout.css')
layout = layout_path.read_text(encoding='utf-8')
old_css = '''/* Valuation is a CSS-rendered branded box, not a cropped image. Its wrapper uses
   the common #F7FAFC canvas; only the inner box keeps the blue brand gradient. */
.d68-home-page > .d68-home-valuation {
  background: #F7FAFC !important;
  border: 0 !important;
  outline: 0;
  box-shadow: none;
}

.d68-home-page > .d68-home-valuation > .d68-home-valuation__box {
  border: 0 !important;
  outline: 0;
  background-clip: padding-box;
}'''
new_css = '''/* Valuation owns a full-width transparent section. Horizontal gutters belong
   to the nested container; only the branded inner box owns a visible surface. */
.d68-home-page > .d68-home-valuation {
  width: 100%;
  padding: 0 !important;
  background: transparent;
  border: 0;
  outline: 0;
  box-shadow: none;
}

.d68-home-page > .d68-home-valuation > .d68-home-container {
  background: transparent;
}

.d68-home-page > .d68-home-valuation .d68-home-valuation__box {
  border: 0;
  outline: 0;
  background-clip: padding-box;
}'''
layout = replace_once(layout, old_css, new_css, 'Homepage valuation ownership CSS')
layout_path.write_text(layout, encoding='utf-8')

# Contract checks.
all_css = '\n'.join(path.read_text(encoding='utf-8') for path in Path('src/styles').rglob('*.css'))
checks = {
    'combined class removed': 'd68-home-container d68-home-valuation' not in home,
    'nested container added': '<section className="d68-home-valuation">\n        <div className="d68-home-container">' in home,
    'legacy white selector removed': not legacy_selector.search(all_css),
    'transparent section owner': '.d68-home-page > .d68-home-valuation {' in layout and 'background: transparent;' in layout,
    'blue box retained': 'd68-home-valuation__box' in all_css and 'linear-gradient(120deg,#1BADEA 0%,#1596cc 100%)' in all_css,
}
failed = [name for name, ok in checks.items() if not ok]
if failed:
    raise SystemExit('Homepage valuation checks failed: ' + ', '.join(failed))
