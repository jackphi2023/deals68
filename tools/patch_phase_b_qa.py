from pathlib import Path

path = Path('scripts/deals68-business-financial-redaction-phase-b-check.mjs')
text = path.read_text()
replacements = {
    "if (!home.includes(\"T(lang, 'Được bảo mật', 'Restricted')\")) failures.push('Homepage restricted fallback missing');": "if (!home.includes('SensitiveFinancialValue') || !home.includes('value={null}')) failures.push('Homepage restricted component or public-only value missing');",
    "if (!businesses.includes('financialRestricted')) failures.push('Business cards restricted state missing');": "if (!businesses.includes('SensitiveFinancialValue')) failures.push('Business cards restricted component missing');",
    "if (!detail.includes('restrictedFinancialText')) failures.push('Business detail restricted fallback missing');": "if (!detail.includes('SensitiveFinancialValue')) failures.push('Business detail restricted component missing');",
}
for old, new in replacements.items():
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f'Expected one Phase B QA contract match, found {count}: {old}')
    text = text.replace(old, new, 1)
path.write_text(text)
print('Phase B QA contract updated for Phase C shared component.')
