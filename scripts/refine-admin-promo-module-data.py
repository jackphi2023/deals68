from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 match, found {count}')
    return text.replace(old, new, 1)


path = Path('src/pages/Admin.tsx')
text = path.read_text(encoding='utf-8')

for old, new, label in [
    ("  const [promos, setPromos] = useState<Row[]>([]);\n", '', 'promo parent state'),
    ("        promoResult,\n", '', 'promo result destructure'),
    ("        supabase.from('promo_codes').select('*').order('created_at', { ascending: false }).limit(500),\n", '', 'promo global query'),
    ("      setPromos(promoResult.data || []);\n", '', 'promo parent setter'),
    ("        promoResult.error ||\n", '', 'promo parent error'),
]:
    text = replace_once(text, old, new, label)

old_render = '''              <AdminPromoManager
                promos={promos}
                adminId={profile.id}
                busy={busy}
                onReload={load}
                setMessage={setMsg}
                setError={setError}
              />'''
new_render = '''              <AdminPromoManager
                adminId={profile.id}
                refreshKey={lastRefreshedAt}
                setMessage={setMsg}
                setError={setError}
              />'''
text = replace_once(text, old_render, new_render, 'promo module props')

checks = {
    'no promo parent state': 'setPromos' not in text and 'const [promos' not in text,
    'no global promo query': "from('promo_codes')" not in text,
    'refresh key passed': 'refreshKey={lastRefreshedAt}' in text,
    'module remains rendered': '<AdminPromoManager' in text,
}
failed = [name for name, ok in checks.items() if not ok]
if failed:
    raise SystemExit('Promo data-loading assertions failed: ' + ', '.join(failed))

path.write_text(text, encoding='utf-8')
