from pathlib import Path

path = Path('src/styles/pages/business-detail.css')
text = path.read_text(encoding='utf-8')
old = ".d68-detail-transaction-row{display:grid;grid-template-columns:minmax(210px,.8fr) minmax(0,1.4fr);gap:22px;padding:16px 0;border-bottom:1px solid #EEF2F6}"
new = ".d68-detail-transaction-row{display:flex;flex-direction:column;gap:7px;padding:16px 0;border-bottom:1px solid #EEF2F6;min-width:0}"
if text.count(old) != 1:
    raise SystemExit(f'Expected one transaction row layout rule, found {text.count(old)}')
text = text.replace(old, new, 1)
old_mobile = "@media(max-width:620px){.d68-detail-transaction-row{grid-template-columns:1fr;gap:7px;padding:14px 0}}"
new_mobile = "@media(max-width:620px){.d68-detail-transaction-row{gap:7px;padding:14px 0}}"
if text.count(old_mobile) != 1:
    raise SystemExit(f'Expected one mobile transaction row rule, found {text.count(old_mobile)}')
text = text.replace(old_mobile, new_mobile, 1)
path.write_text(text, encoding='utf-8')

updated = path.read_text(encoding='utf-8')
checks = {
    'stacked layout': '.d68-detail-transaction-row{display:flex;flex-direction:column;gap:7px;' in updated,
    'legacy columns removed': 'grid-template-columns:minmax(210px,.8fr) minmax(0,1.4fr)' not in updated,
    'long text safety retained': 'white-space:pre-wrap;overflow-wrap:anywhere' in updated,
}
failed = [name for name, ok in checks.items() if not ok]
if failed:
    raise SystemExit('Business detail transaction layout checks failed: ' + ', '.join(failed))
