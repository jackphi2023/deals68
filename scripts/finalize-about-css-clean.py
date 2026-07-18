from pathlib import Path


static_path = Path('src/styles/pages/static.css')
static_css = static_path.read_text(encoding='utf-8')
legacy_desktop = '''.d68-static-grid--about-layers article:last-child:nth-child(3n+2){
  grid-column:2 / 3;
}
'''
legacy_tablet = '''@media(max-width:900px){
  .d68-static-grid--about-layers article:last-child:nth-child(3n+2){grid-column:auto}
}
'''
if static_css.count(legacy_desktop) != 1:
    raise SystemExit('Legacy desktop About grid rule not found exactly once')
if static_css.count(legacy_tablet) != 1:
    raise SystemExit('Legacy tablet About grid rule not found exactly once')
static_css = static_css.replace(legacy_desktop, '', 1).replace(legacy_tablet, '', 1)
static_path.write_text(static_css, encoding='utf-8')

about_path = Path('src/styles/pages/about.css')
about_css = about_path.read_text(encoding='utf-8')
advisor_rule = '''
.d68-static-about-page .d68-static-about-single .d68-static-card h3 {
  color: var(--d68-about-heading);
  font-size: 18px;
}
'''
anchor = '''.d68-static-about-page .d68-static-card h3 {
  font-size: 17px;
  line-height: 1.45;
  margin: 0 0 8px;
}
'''
if advisor_rule.strip() not in about_css:
    if about_css.count(anchor) != 1:
        raise SystemExit('About card heading anchor not found exactly once')
    about_css = about_css.replace(anchor, anchor + advisor_rule, 1)
about_path.write_text(about_css, encoding='utf-8')

static_css = static_path.read_text(encoding='utf-8')
about_css = about_path.read_text(encoding='utf-8')
checks = {
    'legacy centering rule removed': 'd68-static-grid--about-layers article:last-child:nth-child(3n+2)' not in static_css,
    'advisor title is gold': '.d68-static-about-single .d68-static-card h3' in about_css and 'color: var(--d68-about-heading);' in advisor_rule,
    'advisor title is 18px': 'font-size: 18px;' in advisor_rule,
}
failed = [name for name, ok in checks.items() if not ok]
if failed:
    raise SystemExit('Final About CSS checks failed: ' + ', '.join(failed))
