import fs from 'node:fs';

const businesses = fs.readFileSync('src/pages/Businesses.tsx', 'utf8');
const data = fs.readFileSync('src/lib/data.ts', 'utf8');
const taxonomy = fs.readFileSync('src/lib/locationTaxonomy.ts', 'utf8');

const checks = [
  [
    data.includes("supabase.from('public_businesses_safe').select('city, city_key"),
    'Business facets must read from public_businesses_safe.',
  ],
  [
    data.includes("q = q.eq('city_key', cityKey)"),
    'Business list/count filtering must use canonical city_key equality.',
  ],
  [
    businesses.includes('f.city_key || f.city'),
    'Business city facets must prefer approved city_key over legacy city text.',
  ],
  [
    taxonomy.includes('locationByCanonicalKey'),
    'Location taxonomy must preserve canonical keys without lossy remapping.',
  ],
  [
    taxonomy.includes('canonicalLocationOption(raw, countryIso2)'),
    'Canonical location lookup must run before legacy label/alias matching.',
  ],
];

const failed = checks.filter(([ok]) => !ok);
if (failed.length) {
  failed.forEach(([, message]) => console.error(`FAIL: ${message}`));
  process.exit(1);
}

console.log(`PASS: ${checks.length}/${checks.length} business city facet contracts.`);
