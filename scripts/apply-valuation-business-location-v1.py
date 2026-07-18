from pathlib import Path


def read(path: str) -> str:
    return Path(path).read_text(encoding='utf-8')


def write(path: str, content: str) -> None:
    Path(path).write_text(content, encoding='utf-8')


def replace_once(content: str, old: str, new: str, label: str) -> str:
    count = content.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 match, found {count}')
    return content.replace(old, new, 1)


# Valuation: align the annual revenue/currency row with the two-column form grid.
path = 'src/styles/pages/valuation.css'
text = read(path)
text = replace_once(
    text,
    '''.d68-val-revenue-row {
  grid-template-columns: minmax(0, 1fr) minmax(140px, .42fr);
}''',
    '''.d68-val-revenue-row {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}''',
    'valuation revenue columns',
)
metrics_block = '''.d68-val-metrics-row {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
'''
metrics_replacement = metrics_block + '''
@media (min-width: 621px) {
  .d68-val-revenue-row > label,
  .d68-val-metrics-row > label {
    justify-content: flex-end;
  }
}
'''
text = replace_once(text, metrics_block, metrics_replacement, 'valuation field alignment')
write(path, text)

# Public business data: canonicalize legacy location keys and filter by key/label aliases.
path = 'src/lib/data.ts'
text = read(path)
text = replace_once(
    text,
    "import { locationKeyFromLabel } from './locationTaxonomy';",
    "import { locationKeyFromLabel, locationOptionFromValue } from './locationTaxonomy';",
    'location taxonomy import',
)
text = replace_once(
    text,
    '''  const cityKey = firstValue(
    s.city_key,
    row.city_key,
    locationKeyFromLabel(city, countryIso2),
  );''',
    '''  const rawCityKey = firstValue(s.city_key, row.city_key);
  const cityKey =
    locationKeyFromLabel(rawCityKey, countryIso2) ||
    locationKeyFromLabel(city, countryIso2) ||
    clean(rawCityKey);''',
    'public business canonical city key',
)

safe_like_block = '''function safeLikeTerm(value: any) {
  return String(value || '').trim().replace(/[,()%]/g, ' ');
}
'''
location_filter_helper = safe_like_block + '''
function businessLocationFilter(raw: any, countryIso2 = '') {
  const requested = clean(raw);
  if (!requested) return { countryIso2: '', clauses: [] as string[] };

  const option =
    locationOptionFromValue(requested, countryIso2) ||
    locationOptionFromValue(requested);
  const canonicalKey =
    option?.key ||
    locationKeyFromLabel(requested, countryIso2) ||
    requested;
  const keyCandidates = [
    canonicalKey,
    requested,
    option?.key?.replace(/^[A-Z]{2}-/, ''),
    ...(option?.aliases || []),
  ];
  const labelCandidates = option
    ? [option.vi, option.en, ...(option.aliases || [])]
    : [];
  const clauses = [
    ...keyCandidates.map((value) => clean(value)).filter(Boolean).map((value) => `city_key.eq.${safeLikeTerm(value)}`),
    ...labelCandidates.map((value) => safeLikeTerm(value)).filter(Boolean).map((value) => `city.ilike.%${value}%`),
  ];

  return {
    countryIso2: option?.countryIso2 || '',
    clauses: Array.from(new Set(clauses)),
  };
}
'''
text = replace_once(text, safe_like_block, location_filter_helper, 'business location filter helper')

text = replace_once(
    text,
    '''  if (filters.cityKey || filters.city) {
    const requestedCity = filters.cityKey || filters.city;
    const cityKey = locationKeyFromLabel(requestedCity, filters.country || '') || String(requestedCity).trim();
    if (cityKey) q = q.eq('city_key', cityKey);
  }''',
    '''  if (filters.cityKey || filters.city) {
    const requestedCity = filters.cityKey || filters.city;
    const locationFilter = businessLocationFilter(requestedCity, filters.country || '');
    if (!filters.country && locationFilter.countryIso2) {
      q = q.eq('country_iso2', locationFilter.countryIso2);
    }
    if (locationFilter.clauses.length) {
      q = q.or(locationFilter.clauses.join(','));
    }
  }''',
    'legacy-compatible business city filter',
)

text = replace_once(
    text,
    '''  return (data || []) as any[];
}''',
    '''  return ((data || []) as any[]).map((row) => {
    const countryIso2 = clean(row.country_iso2) || 'VN';
    const cityKey =
      locationKeyFromLabel(row.city_key, countryIso2) ||
      locationKeyFromLabel(row.city, countryIso2) ||
      clean(row.city_key);
    return { ...row, country_iso2: countryIso2, city_key: cityKey };
  });
}''',
    'canonicalize business facet locations',
)
write(path, text)

# Business list facet aggregation must retry the city label when a legacy key is stale.
path = 'src/pages/Businesses.tsx'
text = read(path)
text = replace_once(
    text,
    '''    facets.forEach((f) => {
      const key = locationKeyFromLabel(f.city_key || f.city, f.country_iso2 || '');
      if (!key) return;
      m.set(key, (m.get(key) || 0) + 1);
    });''',
    '''    facets.forEach((f) => {
      const countryIso2 = f.country_iso2 || '';
      const key =
        locationKeyFromLabel(f.city_key, countryIso2) ||
        locationKeyFromLabel(f.city, countryIso2);
      if (!key) return;
      m.set(key, (m.get(key) || 0) + 1);
    });''',
    'business city facet fallback',
)
write(path, text)

# Static assertions before production build.
valuation = read('src/styles/pages/valuation.css')
data = read('src/lib/data.ts')
businesses = read('src/pages/Businesses.tsx')
checks = [
    ('valuation equal columns', '.d68-val-revenue-row {\n  grid-template-columns: repeat(2, minmax(0, 1fr));' in valuation),
    ('valuation aligned labels', '.d68-val-revenue-row > label' in valuation and 'justify-content: flex-end' in valuation),
    ('canonical city key', 'locationKeyFromLabel(rawCityKey, countryIso2)' in data and 'locationKeyFromLabel(city, countryIso2)' in data),
    ('location alias filter', 'function businessLocationFilter' in data and 'locationOptionFromValue' in data),
    ('facet canonicalization', 'locationKeyFromLabel(row.city_key, countryIso2)' in data and 'locationKeyFromLabel(row.city, countryIso2)' in data),
    ('UI facet fallback', 'locationKeyFromLabel(f.city_key, countryIso2)' in businesses and 'locationKeyFromLabel(f.city, countryIso2)' in businesses),
]
failed = [name for name, ok in checks if not ok]
if failed:
    raise SystemExit('Contract assertions failed: ' + ', '.join(failed))
