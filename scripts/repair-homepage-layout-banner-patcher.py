from pathlib import Path

path = Path('scripts/apply-homepage-layout-banner-system.py')
text = path.read_text(encoding='utf-8')

old_function = '''def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 match, found {count}')
    return text.replace(old, new, 1)
'''
new_function = '''def replace_once(text: str, old: str, new: str, label: str) -> str:
    expected = 2 if label in {
        'investor title row selector',
        'investor title selector',
    } else 1
    count = text.count(old)
    if count != expected:
        raise SystemExit(
            f'{label}: expected {expected} match(es), found {count}'
        )
    return text.replace(old, new, expected)
'''
if old_function not in text:
    raise SystemExit('replace_once function marker not found')
text = text.replace(old_function, new_function, 1)

text = text.replace(
    '@media(max-width:1040px){.d68-home-industry-grid,.d68-home-investor-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important}.d68-home-container.d68-home-section:has(.d68-home-investor-grid) .d68-home-title h2,.d68-home-industries .d68-home-title h2{font-size:30px!important}}',
    '@media(max-width:1040px){.d68-home-industry-grid,.d68-home-investor-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important}.d68-home-investor-band .d68-home-title h2,.d68-home-industries .d68-home-title h2{font-size:30px!important}}',
    1,
)
text = text.replace(
    '.d68-home-container.d68-home-section:has(.d68-home-investor-grid) .d68-home-title--row{align-items:flex-start!important}',
    '.d68-home-investor-band .d68-home-title--row{align-items:flex-start!important}',
    1,
)

path.write_text(text, encoding='utf-8')
