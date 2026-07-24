#!/usr/bin/env node
import fs from 'node:fs';

const MIGRATION = '20260724110000_business_public_financial_redaction_phase_b_v1.sql';
const failures = [];

function read(path) {
  if (!fs.existsSync(path)) throw new Error(`Missing ${path}`);
  return fs.readFileSync(path, 'utf8');
}
function write(path, content) {
  fs.writeFileSync(path, content);
}
function replaceOnce(path, from, to, label) {
  const content = read(path);
  if (!content.includes(from)) throw new Error(`${path}: missing ${label}`);
  write(path, content.replace(from, to));
}
function replaceAllExpected(path, from, to, expected, label) {
  const content = read(path);
  const count = content.split(from).length - 1;
  if (count !== expected) throw new Error(`${path}: ${label} expected ${expected}, found ${count}`);
  write(path, content.split(from).join(to));
}

// Data layer: retain redacted compatibility columns, use public bands for discovery,
// and hydrate only Business-specific summaries returned by the secure RPC.
replaceOnce(
  'src/lib/data.ts',
  `function firstValue(...values: any[]) {\n  return values.find((v) => clean(v)) ?? '';\n}\n`,
  `function firstValue(...values: any[]) {\n  return values.find((v) => clean(v)) ?? '';\n}\n\nfunction nullableNumber(...values: any[]): number | null {\n  const value = values.find(\n    (item) => item !== null && item !== undefined && String(item).trim() !== '',\n  );\n  if (value === undefined) return null;\n  const numberValue = Number(value);\n  return Number.isFinite(numberValue) ? numberValue : null;\n}\n`,
  'nullableNumber insertion',
);
replaceAllExpected(
  'src/lib/data.ts',
  `'revenue_2025','revenue_currency','ebitda_margin','ask_amount'`,
  `'revenue_2025','revenue_currency','ebitda_margin','revenue_band_key','revenue_band_rank','revenue_match_band_key','ebitda_band_key','has_financial_data','financial_data_updated_at','ask_amount'`,
  2,
  'Business public/detail select band fields',
);
replaceOnce(
  'src/lib/data.ts',
  `'revenue_2025','revenue_currency','ask_amount'`,
  `'revenue_2025','revenue_currency','revenue_band_key','revenue_band_rank','revenue_match_band_key','ebitda_band_key','has_financial_data','financial_data_updated_at','ask_amount'`,
  'Homepage select band fields',
);
replaceOnce(
  'src/lib/data.ts',
  `  const cityKey =\n    locationKeyFromLabel(rawCityKey, countryIso2) ||\n    locationKeyFromLabel(city, countryIso2) ||\n    clean(rawCityKey);\n  return {`,
  `  const cityKey =\n    locationKeyFromLabel(rawCityKey, countryIso2) ||\n    locationKeyFromLabel(city, countryIso2) ||\n    clean(rawCityKey);\n  const revenue2025 = nullableNumber(s.revenue_2025, row.revenue_2025);\n  const ebitdaMargin = nullableNumber(s.ebitda_margin, row.ebitda_margin);\n  const declaredHasFinancialData = s.has_financial_data ?? row.has_financial_data;\n  const hasFinancialData = declaredHasFinancialData === undefined\n    ? revenue2025 !== null || ebitdaMargin !== null\n    : Boolean(declaredHasFinancialData);\n  return {`,
  'public view financial normalization',
);
replaceOnce(
  'src/lib/data.ts',
  `    revenue_2025: Number(firstValue(s.revenue_2025, row.revenue_2025, 0) || 0),\n    revenue_currency: firstValue(s.revenue_currency, row.revenue_currency, 'VND'),\n    ebitda_margin: s.ebitda_margin ?? row.ebitda_margin,`,
  `    revenue_2025: revenue2025,\n    revenue_currency: firstValue(s.revenue_currency, row.revenue_currency, 'VND'),\n    ebitda_margin: ebitdaMargin,\n    revenue_band_key: firstValue(s.revenue_band_key, row.revenue_band_key, 'unknown'),\n    revenue_band_rank: Number(s.revenue_band_rank ?? row.revenue_band_rank ?? 0),\n    revenue_match_band_key: firstValue(s.revenue_match_band_key, row.revenue_match_band_key, 'unknown'),\n    ebitda_band_key: firstValue(s.ebitda_band_key, row.ebitda_band_key, 'unknown'),\n    has_financial_data: hasFinancialData,\n    financial_data_updated_at: s.financial_data_updated_at ?? row.financial_data_updated_at ?? null,\n    financial_summary_authorized: revenue2025 !== null || ebitdaMargin !== null,\n    financials_restricted: hasFinancialData && revenue2025 === null,`,
  'redacted public financial fields',
);
replaceOnce(
  'src/lib/data.ts',
  `}\n\nfunction safeLikeTerm(value: any) {`,
  `}\n\nexport async function getAuthorizedBusinessFinancialSummaries(\n  businessIds: string[],\n): Promise<any[]> {\n  const ids = Array.from(\n    new Set(businessIds.map((id) => String(id || '').trim()).filter(Boolean)),\n  );\n  if (!ids.length) return [];\n\n  const session = await supabase.auth.getSession().catch(() => null);\n  if (!session?.data?.session) return [];\n\n  const chunks: string[][] = [];\n  for (let index = 0; index < ids.length; index += 100) {\n    chunks.push(ids.slice(index, index + 100));\n  }\n\n  const responses = await Promise.all(\n    chunks.map((chunk) =>\n      supabase.rpc('d68_get_business_financial_summaries', {\n        p_business_ids: chunk,\n      }),\n    ),\n  );\n\n  const rows: any[] = [];\n  for (const response of responses) {\n    if (response.error) continue;\n    if (Array.isArray(response.data)) rows.push(...response.data);\n  }\n  return rows;\n}\n\nexport async function attachAuthorizedBusinessFinancials<T extends Record<string, any>>(\n  rows: T[],\n): Promise<T[]> {\n  if (!rows.length) return rows;\n  const summaries = await getAuthorizedBusinessFinancialSummaries(\n    rows.map((row) => String(row.id || '')).filter(Boolean),\n  );\n  if (!summaries.length) return rows;\n\n  const byBusinessId = new Map(\n    summaries.map((summary) => [String(summary.business_id), summary]),\n  );\n  return rows.map((row) => {\n    const summary = byBusinessId.get(String(row.id));\n    if (!summary) return row;\n    return {\n      ...row,\n      ...summary,\n      id: row.id,\n      financial_summary_authorized: true,\n      financials_restricted: false,\n    };\n  });\n}\n\nfunction safeLikeTerm(value: any) {`,
  'secure financial hydration helpers',
);
replaceOnce(
  'src/lib/data.ts',
  `  if (filters.revenueBand === 'small') {\n    q = q.or('and(revenue_currency.eq.VND,revenue_2025.lt.10000000000),and(revenue_currency.eq.USD,revenue_2025.lt.400000)');\n  } else if (filters.revenueBand === 'mid') {\n    q = q.or('and(revenue_currency.eq.VND,revenue_2025.gte.10000000000,revenue_2025.lte.100000000000),and(revenue_currency.eq.USD,revenue_2025.gte.400000,revenue_2025.lte.4000000)');\n  } else if (filters.revenueBand === 'large') {\n    q = q.or('and(revenue_currency.eq.VND,revenue_2025.gt.100000000000),and(revenue_currency.eq.USD,revenue_2025.gt.4000000)');\n  }`,
  `  if (['small', 'mid', 'large'].includes(filters.revenueBand)) {\n    q = q.eq('revenue_band_key', filters.revenueBand);\n  }`,
  'public revenue band filtering',
);
replaceAllExpected(
  'src/lib/data.ts',
  `if (sort === 'revenue') q = q.order('revenue_2025', { ascending: false, nullsFirst: false });`,
  `if (sort === 'revenue') q = q.order('revenue_band_rank', { ascending: false, nullsFirst: false }).order('quality_score', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false });`,
  2,
  'coarse revenue sorting',
);
replaceOnce(
  'src/lib/data.ts',
  `  return ((data || []) as any[]).map(getPublicBusinessView);\n}\n\nexport async function listBusinessesPage`,
  `  return attachAuthorizedBusinessFinancials(\n    ((data || []) as any[]).map(getPublicBusinessView),\n  );\n}\n\nexport async function listBusinessesPage`,
  'listBusinesses secure hydration',
);
replaceOnce(
  'src/lib/data.ts',
  `  const rows = ((data || []) as any[]).map(getPublicBusinessView);\n  return { rows, total: count ?? rows.length };`,
  `  const rows = await attachAuthorizedBusinessFinancials(\n    ((data || []) as any[]).map(getPublicBusinessView),\n  );\n  return { rows, total: count ?? rows.length };`,
  'listBusinessesPage secure hydration',
);
replaceOnce(
  'src/lib/data.ts',
  `  const byId = new Map(\n    ((data || []) as any[]).map((row) => [\n      String(row.id),\n      getPublicBusinessView(row),\n    ]),\n  );`,
  `  const homepageRows = await attachAuthorizedBusinessFinancials(\n    ((data || []) as any[]).map(getPublicBusinessView),\n  );\n  const byId = new Map(\n    homepageRows.map((row) => [String(row.id), row]),\n  );`,
  'Homepage secure hydration',
);
replaceOnce(
  'src/lib/data.ts',
  `  return data ? getPublicBusinessView(data) : null;\n}`,
  `  if (!data) return null;\n  const [row] = await attachAuthorizedBusinessFinancials([\n    getPublicBusinessView(data),\n  ]);\n  return row || null;\n}`,
  'Business detail secure hydration',
);

// Compatibility presentation until Phase C replaces the restricted text with the final blur component.
replaceOnce(
  'src/pages/Home.tsx',
  `    revenue: formatMoneyForLang(b.revenue_2025, b.revenue_currency || 'VND', lang),`,
  `    revenue:\n      b.revenue_2025 === null || b.revenue_2025 === undefined\n        ? T(lang, 'Được bảo mật', 'Restricted')\n        : formatMoneyForLang(b.revenue_2025, b.revenue_currency || 'VND', lang),`,
  'Homepage restricted revenue fallback',
);
replaceOnce(
  'src/pages/Businesses.tsx',
  `  revenueValue: number; revenueCurrency: string; askValue: number; askCurrency: string; stakePct: number;\n  ebitda: string; quality: number | null; featured: boolean;`,
  `  revenueValue: number | null; revenueCurrency: string; askValue: number; askCurrency: string; stakePct: number;\n  ebitda: string; financialRestricted: boolean; quality: number | null; featured: boolean;`,
  'Business card financial type',
);
replaceOnce(
  'src/pages/Businesses.tsx',
  `    revenueValue: Number(b.revenue_2025 || 0),`,
  `    revenueValue:\n      b.revenue_2025 === null || b.revenue_2025 === undefined\n        ? null\n        : Number(b.revenue_2025),`,
  'Business card nullable revenue',
);
replaceOnce(
  'src/pages/Businesses.tsx',
  `    ebitda: b.ebitda_margin === null || b.ebitda_margin === undefined ? 'Đang cập nhật' : percent(b.ebitda_margin),\n    quality:`,
  `    ebitda: b.ebitda_margin === null || b.ebitda_margin === undefined ? 'Đang cập nhật' : percent(b.ebitda_margin),\n    financialRestricted: Boolean(b.has_financial_data) && b.revenue_2025 === null,\n    quality:`,
  'Business card restricted state',
);
replaceOnce(
  'src/pages/Businesses.tsx',
  `<div><span>{T(lang, 'Doanh thu', 'Revenue')}</span><b>{formatMoneyForLang(d.revenueValue, d.revenueCurrency, lang)}</b></div>\n          <div><span>EBITDA</span><b>{d.ebitda === 'Đang cập nhật' ? T(lang, 'Đang cập nhật', 'Pending') : d.ebitda}</b></div>`,
  `<div><span>{T(lang, 'Doanh thu', 'Revenue')}</span><b>{d.revenueValue === null ? T(lang, 'Được bảo mật', 'Restricted') : formatMoneyForLang(d.revenueValue, d.revenueCurrency, lang)}</b></div>\n          <div><span>EBITDA</span><b>{d.financialRestricted ? T(lang, 'Được bảo mật', 'Restricted') : d.ebitda === 'Đang cập nhật' ? T(lang, 'Đang cập nhật', 'Pending') : d.ebitda}</b></div>`,
  'Business card restricted financial display',
);

replaceOnce(
  'src/pages/BusinessDetail.tsx',
  `function money(lang: Lang, value: any, currency: string) { return formatMoneyForLang(Number(value || 0), currency || 'VND', lang); }`,
  `function money(lang: Lang, value: any, currency: string) { return formatMoneyForLang(Number(value || 0), currency || 'VND', lang); }\nfunction restrictedFinancialText(lang: Lang) { return T(lang, 'Được bảo mật', 'Restricted'); }`,
  'Business detail restricted helper',
);
replaceOnce(
  'src/pages/BusinessDetail.tsx',
  `  return { id: String(row.id || slug), slug, title, industry: labelIndustry(primaryIndustry(row.industry), lang), city: labelLocation(row.city_key || row.city || row.country_iso2, lang), revenue: money(lang, row.revenue_2025, row.revenue_currency || 'VND'), ask: money(lang, row.ask_amount, row.ask_currency || row.revenue_currency || 'VND'), image: row.image_url || row.hero_image_url || null };`,
  `  return { id: String(row.id || slug), slug, title, industry: labelIndustry(primaryIndustry(row.industry), lang), city: labelLocation(row.city_key || row.city || row.country_iso2, lang), revenue: row.revenue_2025 === null || row.revenue_2025 === undefined ? restrictedFinancialText(lang) : money(lang, row.revenue_2025, row.revenue_currency || 'VND'), ask: money(lang, row.ask_amount, row.ask_currency || row.revenue_currency || 'VND'), image: row.image_url || row.hero_image_url || null };`,
  'Similar Business restricted revenue',
);
replaceOnce(
  'src/pages/BusinessDetail.tsx',
  `  const revenue = business ? money(lang, business.revenue_2025, business.revenue_currency || 'VND') : '';`,
  `  const revenue = business\n    ? business.revenue_2025 === null || business.revenue_2025 === undefined\n      ? restrictedFinancialText(lang)\n      : money(lang, business.revenue_2025, business.revenue_currency || 'VND')\n    : '';`,
  'Business detail restricted revenue',
);
replaceOnce(
  'src/pages/BusinessDetail.tsx',
  `{ label: T(lang, 'Tỷ suất lợi nhuận/EBITDA', 'EBITDA margin'), value: business.ebitda_margin === null || business.ebitda_margin === undefined ? T(lang, 'Đang cập nhật', 'Pending') : percent(business.ebitda_margin) },`,
  `{ label: T(lang, 'Tỷ suất lợi nhuận/EBITDA', 'EBITDA margin'), value: business.ebitda_margin === null || business.ebitda_margin === undefined ? (business.has_financial_data ? restrictedFinancialText(lang) : T(lang, 'Đang cập nhật', 'Pending')) : percent(business.ebitda_margin) },`,
  'Business detail restricted EBITDA',
);
replaceOnce(
  'src/pages/BusinessDetail.tsx',
  `{ ok: !!business.revenue_2025, vi: 'Có doanh thu năm gần nhất', en: 'Latest annual revenue provided' },\n    { ok: business.ebitda_margin !== null && business.ebitda_margin !== undefined, vi: 'Có tỷ suất lợi nhuận/EBITDA', en: 'EBITDA margin provided' },`,
  `{ ok: !!business.revenue_2025 || (business.revenue_band_key && business.revenue_band_key !== 'unknown'), vi: 'Có doanh thu năm gần nhất', en: 'Latest annual revenue provided' },\n    { ok: business.ebitda_margin !== null && business.ebitda_margin !== undefined || (business.ebitda_band_key && business.ebitda_band_key !== 'unknown'), vi: 'Có tỷ suất lợi nhuận/EBITDA', en: 'EBITDA margin provided' },`,
  'Business detail quality evidence bands',
);

replaceOnce(
  'src/pages/InvestorDashboard.tsx',
  `  getInvestorByOwner,\n  listBusinessFacets,\n  listBusinesses,`,
  `  attachAuthorizedBusinessFinancials,\n  getInvestorByOwner,\n  listBusinessFacets,\n  listBusinesses,`,
  'Investor Dashboard secure hydration import',
);
replaceOnce(
  'src/pages/InvestorDashboard.tsx',
  `function matchesRevenueBand(business: any, band: string) {\n  if (!band) return true;\n  const value = revenueUsd(business);\n  if (band === 'under_1m') return value < 1_000_000;\n  if (band === '1_10m') return value >= 1_000_000 && value < 10_000_000;\n  if (band === '10_100m') return value >= 10_000_000 && value < 100_000_000;\n  if (band === 'over_100m') return value >= 100_000_000;\n  return true;\n}\n\nfunction matchesEbitdaBand(business: any, band: string) {\n  if (!band) return true;\n  const margin = Number(business?.ebitda_margin || 0);\n  if (band === '0_10') return margin < 10;\n  if (band === '10_20') return margin >= 10 && margin <= 20;\n  if (band === 'over_20') return margin > 20;\n  return true;\n}`,
  `function matchesRevenueBand(business: any, band: string) {\n  if (!band) return true;\n  if (business?.revenue_2025 === null || business?.revenue_2025 === undefined) {\n    return String(business?.revenue_match_band_key || 'unknown') === band;\n  }\n  const value = revenueUsd(business);\n  if (band === 'under_1m') return value < 1_000_000;\n  if (band === '1_10m') return value >= 1_000_000 && value < 10_000_000;\n  if (band === '10_100m') return value >= 10_000_000 && value < 100_000_000;\n  if (band === 'over_100m') return value >= 100_000_000;\n  return true;\n}\n\nfunction matchesEbitdaBand(business: any, band: string) {\n  if (!band) return true;\n  if (business?.ebitda_margin === null || business?.ebitda_margin === undefined) {\n    return String(business?.ebitda_band_key || 'unknown') === band;\n  }\n  const margin = Number(business.ebitda_margin);\n  if (band === '0_10') return margin >= 0 && margin < 10;\n  if (band === '10_20') return margin >= 10 && margin <= 20;\n  if (band === 'over_20') return margin > 20;\n  return true;\n}\n\nfunction investorRevenueText(business: any, lang: Lang) {\n  return business?.revenue_2025 === null || business?.revenue_2025 === undefined\n    ? T(lang, 'Được bảo mật', 'Restricted')\n    : formatCompactMoney(business.revenue_2025, business.revenue_currency);\n}`,
  'Investor Dashboard band matching and restricted text',
);
replaceAllExpected(
  'src/pages/InvestorDashboard.tsx',
  `{formatCompactMoney(business.revenue_2025, business.revenue_currency)}`,
  `{investorRevenueText(business, lang)}`,
  2,
  'Investor Dashboard restricted revenue display',
);
replaceOnce(
  'src/pages/InvestorDashboard.tsx',
  `      const relations = asObject(relationResult.data);\n      setInterests(Array.isArray(relations.interests) ? relations.interests : []);\n      setProposals(Array.isArray(relations.proposals) ? relations.proposals : []);`,
  `      const relations = asObject(relationResult.data);\n      const rawInterests = Array.isArray(relations.interests) ? relations.interests : [];\n      const rawProposals = Array.isArray(relations.proposals) ? relations.proposals : [];\n      const relationBusinesses = [...rawInterests, ...rawProposals]\n        .map((row: any) => row?.businesses)\n        .filter((row: any) => row?.id);\n      const hydratedRelationBusinesses = await attachAuthorizedBusinessFinancials(\n        relationBusinesses,\n      );\n      const relationBusinessMap = new Map(\n        hydratedRelationBusinesses.map((row: any) => [String(row.id), row]),\n      );\n      const hydrateRelations = (rows: any[]) => rows.map((row: any) => ({\n        ...row,\n        businesses: row?.businesses?.id\n          ? relationBusinessMap.get(String(row.businesses.id)) || row.businesses\n          : row.businesses,\n      }));\n      setInterests(hydrateRelations(rawInterests));\n      setProposals(hydrateRelations(rawProposals));`,
  'Investor relation secure hydration',
);

replaceOnce(
  'netlify/edge-functions/seo.ts',
  `  const business = (await fetchRows('businesses', params))[0];`,
  `  const business = (await fetchRows('public_businesses_safe', params))[0];`,
  'SEO safe Business view',
);

// Register permanent QA and migration ledger contracts.
const packageJson = JSON.parse(read('package.json'));
packageJson.scripts['qa:financial-redaction-phase-b'] =
  'node scripts/deals68-business-financial-redaction-phase-b-check.mjs';
write('package.json', `${JSON.stringify(packageJson, null, 2)}\n`);

replaceOnce(
  'scripts/deals68-package-checks.mjs',
  `  'scripts/deals68-admin-investor-plans-phase4-check.mjs',\n];`,
  `  'scripts/deals68-admin-investor-plans-phase4-check.mjs',\n  'scripts/deals68-business-financial-access-phase-a-check.mjs',\n  'scripts/deals68-business-financial-redaction-phase-b-check.mjs',\n];`,
  'package QA contracts',
);
replaceOnce(
  'scripts/deals68-migration-state-check.mjs',
  `  '20260724073247_business_financial_access_phase_a_v1.sql',\n];`,
  `  '20260724073247_business_financial_access_phase_a_v1.sql',\n  '${MIGRATION}',\n];`,
  'Phase B required migration',
);
replaceOnce(
  'scripts/deals68-migration-state-check.mjs',
  `  {\n    name: '20260724073247_business_financial_access_phase_a_v1.sql',\n    snippets: [\n      'create table if not exists public.business_financial_access_grants',\n      'create unique index if not exists request_data_one_open_pair_uidx',\n      'create or replace function public.d68_get_business_financial_access',\n      'create or replace function public.d68_request_business_financial_access',\n      'create or replace function public.d68_respond_business_financial_request',\n      'create or replace function public.d68_revoke_business_financial_access',\n      'proposals_financial_access_status_update',\n      'request_data_financial_access_update',\n      "'dataroom_inferred', false",\n      'business_financial_access_grants_parties_select',\n    ],\n  },`,
  `  {\n    name: '20260724073247_business_financial_access_phase_a_v1.sql',\n    snippets: [\n      'create table if not exists public.business_financial_access_grants',\n      'create unique index if not exists request_data_one_open_pair_uidx',\n      'create or replace function public.d68_get_business_financial_access',\n      'create or replace function public.d68_request_business_financial_access',\n      'create or replace function public.d68_respond_business_financial_request',\n      'create or replace function public.d68_revoke_business_financial_access',\n      'proposals_financial_access_status_update',\n      'request_data_financial_access_update',\n      "'dataroom_inferred', false",\n      'business_financial_access_grants_parties_select',\n    ],\n  },\n  {\n    name: '${MIGRATION}',\n    snippets: [\n      'null::numeric as revenue_2025',\n      'null::numeric as ebitda_margin',\n      'security_invoker = false',\n      'create or replace function public.d68_get_business_financial_summaries',\n      'business_financial_access_grants g',\n      'revoke select on table public.businesses from public, anon',\n      'business select owner or admin',\n      'd68_calculate_business_quality_score_payload_internal',\n      "'exact_revenue_public', false",\n    ],\n  },`,
  'Phase B migration contract',
);

replaceOnce(
  'docs/release/MIGRATION_STATE.md',
  `| 20260724073247 | \`20260724073247_business_financial_access_phase_a_v1.sql\` |`,
  `| 20260724073247 | \`20260724073247_business_financial_access_phase_a_v1.sql\` |\n| 20260724110000 | \`${MIGRATION}\` |`,
  'Phase B migration ledger row',
);
replaceOnce(
  'docs/release/MIGRATION_STATE.md',
  `- \`20260724073247_business_financial_access_phase_a_v1.sql\` — Business Financial Access Phase A; adds the canonical access-grant ledger, Proposal summary grants, approved-request detail grants, idempotent request/response/revoke RPCs, trigger synchronization, audit history, RLS/ACL and legacy backfill. It intentionally does not modify the public Business view, financial display or Dataroom file policy.`,
  `- \`20260724073247_business_financial_access_phase_a_v1.sql\` — Business Financial Access Phase A; adds the canonical access-grant ledger, Proposal summary grants, approved-request detail grants, idempotent request/response/revoke RPCs, trigger synchronization, audit history, RLS/ACL and legacy backfill. It intentionally does not modify the public Business view, financial display or Dataroom file policy.\n- \`${MIGRATION}\` — Business Financial Redaction Phase B; removes exact revenue, EBITDA, growth and numeric asset values from public Business reads, preserves coarse discovery/matching bands, closes direct public base-table access, guards the quality calculator and adds a grant-aware batch summary RPC.`,
  'Phase B migration description',
);

const qa = `#!/usr/bin/env node\nimport fs from 'node:fs';\n\nconst migrationName = '${MIGRATION}';\nconst failures = [];\nconst read = (path) => fs.existsSync(path) ? fs.readFileSync(path, 'utf8') : '';\nconst sql = read(\`supabase/migrations/\${migrationName}\`);\nconst data = read('src/lib/data.ts');\nconst home = read('src/pages/Home.tsx');\nconst businesses = read('src/pages/Businesses.tsx');\nconst detail = read('src/pages/BusinessDetail.tsx');\nconst investor = read('src/pages/InvestorDashboard.tsx');\nconst seo = read('netlify/edge-functions/seo.ts');\n\nconst requiredSql = [\n  'null::numeric as revenue_2025',\n  'null::numeric as ebitda_margin',\n  'security_invoker = false',\n  'revenue_band_key',\n  'revenue_match_band_key',\n  'ebitda_band_key',\n  'create or replace function public.d68_get_business_financial_summaries',\n  "'financial_summary' = any(g.scopes)",\n  'revoke select on table public.businesses from public, anon',\n  'create policy "business select owner or admin"',\n  'd68_calculate_business_quality_score_payload_internal',\n  "'exact_revenue_public', false",\n];\nfor (const snippet of requiredSql) if (!sql.includes(snippet)) failures.push(\`Migration missing: \${snippet}\`);\n\nconst publicSnapshotStart = sql.indexOf("jsonb_build_object(\\n      'title_vi'");\nconst publicSnapshotEnd = sql.indexOf(') as public_snapshot_json', publicSnapshotStart);\nconst publicSnapshot = sql.slice(publicSnapshotStart, publicSnapshotEnd);\nfor (const forbidden of ["'revenue_2025', base.", "'ebitda_margin', base.", "'growth_pct', base.", 'excluded_physical_asset_value']) {\n  if (publicSnapshot.includes(forbidden)) failures.push(\`Public snapshot still exposes: \${forbidden}\`);\n}\n\nfor (const snippet of [\n  'attachAuthorizedBusinessFinancials',\n  'd68_get_business_financial_summaries',\n  "q = q.eq('revenue_band_key', filters.revenueBand)",\n  "q.order('revenue_band_rank'",\n  'financials_restricted',\n]) if (!data.includes(snippet)) failures.push(\`Data layer missing: \${snippet}\`);\n\nif (!home.includes("T(lang, 'Được bảo mật', 'Restricted')")) failures.push('Homepage restricted fallback missing');\nif (!businesses.includes('financialRestricted')) failures.push('Business cards restricted state missing');\nif (!detail.includes('restrictedFinancialText')) failures.push('Business detail restricted fallback missing');\nif (!investor.includes('revenue_match_band_key') || !investor.includes('attachAuthorizedBusinessFinancials')) failures.push('Investor Dashboard band/grant hydration missing');\nif (!seo.includes("fetchRows('public_businesses_safe', params)")) failures.push('SEO still bypasses safe Business view');\nif (seo.includes("fetchRows('businesses', params)")) failures.push('SEO directly reads businesses table');\n\nconst pkg = JSON.parse(read('package.json') || '{}');\nif (pkg.scripts?.['qa:financial-redaction-phase-b'] !== 'node scripts/deals68-business-financial-redaction-phase-b-check.mjs') failures.push('Phase B package script missing');\n\nif (failures.length) {\n  console.error('✗ Deals68 Business financial redaction Phase B check failed:');\n  failures.forEach((failure) => console.error(\`  - \${failure}\`));\n  process.exit(1);\n}\nconsole.log('✓ Deals68 Business financial redaction Phase B contract: PASS');\n`;
write('scripts/deals68-business-financial-redaction-phase-b-check.mjs', qa);

console.log('Phase B patch applied.');
