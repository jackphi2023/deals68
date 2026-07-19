from pathlib import Path
import re


def replace_once(path: Path, old: str, new: str) -> None:
    text = path.read_text(encoding='utf-8')
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{path}: expected one match, found {count}')
    path.write_text(text.replace(old, new, 1), encoding='utf-8')


engine_path = Path('src/lib/valuationEngine.ts')
engine = engine_path.read_text(encoding='utf-8')

old_industry_type = """  industry: Record<string, {
    ebitda: number;
    revenue: number;
    valuation_mode?: AssetValuationMode;
    w_asset?: number;
  }>;
"""
new_industry_type = """  industry: Record<string, {
    ebitda: number;
    revenue: number;
    pb?: number;
    w?: [number, number, number];
    w_ebitda?: number;
    w_revenue?: number;
    w_pb?: number;
    valuation_mode?: AssetValuationMode;
    w_asset?: number;
  }>;
"""
if engine.count(old_industry_type) != 1:
    raise SystemExit('valuationEngine.ts: industry config type marker mismatch')
engine = engine.replace(old_industry_type, new_industry_type, 1)

old_input_tail = """  keyAssetValue?: number;
  netDebt?: number;
  assetCurrency?: Currency;
};
"""
new_input_tail = """  keyAssetValue?: number;
  netDebt?: number;
  assetCurrency?: Currency;
  bookEquity?: number;
  intangibles?: number;
  propertyMarketValue?: number;
  propertyBookValue?: number;
  surplusAssetValue?: number;
};
"""
if engine.count(old_input_tail) != 1:
    raise SystemExit('valuationEngine.ts: valuation input marker mismatch')
engine = engine.replace(old_input_tail, new_input_tail, 1)

old_result_tail = """  countryFactor: number;
  growthFactor: number;
  sizeFactor: number;
};
"""
new_result_tail = """  countryFactor: number;
  growthFactor: number;
  sizeFactor: number;
  formulaVersion?: '1.2';
  adjPb?: number;
  eqFromEbitda?: number | null;
  eqFromRevenue?: number;
  eqFromPb?: number | null;
  central?: number;
  floor?: number | null;
  bookEquity?: number | null;
  netTangibleBook?: number | null;
  surplusAssetValue?: number;
  weightsUsed?: { ebitda: number; revenue: number; pb: number };
};
"""
if engine.count(old_result_tail) != 1:
    raise SystemExit('valuationEngine.ts: valuation result marker mismatch')
engine = engine.replace(old_result_tail, new_result_tail, 1)

new_industry_defaults = """  industry: {
    agriculture: { ebitda: 5.5, revenue: 0.90, pb: 1.1, w: [0.40, 0.20, 0.40], valuation_mode: 'asset_floor' },
    automobile: { ebitda: 5.5, revenue: 0.65, pb: 1.2, w: [0.50, 0.30, 0.20] },
    beauty_personal_care: { ebitda: 7.5, revenue: 1.20, pb: 1.8, w: [0.60, 0.25, 0.15] },
    construction_materials: { ebitda: 5.0, revenue: 0.60, pb: 1.1, w: [0.45, 0.35, 0.20] },
    chemicals: { ebitda: 6.5, revenue: 1.10, pb: 1.4, w: [0.50, 0.25, 0.25] },
    education_training: { ebitda: 8.0, revenue: 1.50, pb: 2.0, w: [0.60, 0.25, 0.15] },
    energy_utilities: { ebitda: 7.0, revenue: 1.30, pb: 1.3, w: [0.45, 0.20, 0.35] },
    entertainment_leisure: { ebitda: 6.5, revenue: 1.20, pb: 1.5, w: [0.55, 0.25, 0.20] },
    finance: { ebitda: 8.0, revenue: 2.00, pb: 1.3, w: [0.30, 0.20, 0.50] },
    food_beverage: { ebitda: 5.5, revenue: 0.80, pb: 1.5, w: [0.55, 0.30, 0.15] },
    healthcare: { ebitda: 9.0, revenue: 2.00, pb: 2.2, w: [0.55, 0.25, 0.20] },
    hotels_resorts: { ebitda: 8.0, revenue: 2.20, pb: 1.3, w: [0.35, 0.20, 0.45], valuation_mode: 'asset_blend', w_asset: 0.50 },
    it_software: { ebitda: 11.0, revenue: 2.80, pb: 3.0, w: [0.55, 0.35, 0.10] },
    manufacturing: { ebitda: 6.0, revenue: 0.85, pb: 1.2, w: [0.45, 0.20, 0.35], valuation_mode: 'asset_floor' },
    media_advertising: { ebitda: 7.0, revenue: 1.30, pb: 1.8, w: [0.60, 0.30, 0.10] },
    real_estate: { ebitda: 9.0, revenue: 3.00, pb: 1.1, w: [0.20, 0.15, 0.65], valuation_mode: 'asset_blend', w_asset: 0.75 },
    retail: { ebitda: 5.5, revenue: 0.60, pb: 1.3, w: [0.50, 0.30, 0.20] },
    services: { ebitda: 7.0, revenue: 1.20, pb: 1.6, w: [0.60, 0.25, 0.15] },
    transportation_logistics: { ebitda: 6.0, revenue: 0.85, pb: 1.3, w: [0.45, 0.25, 0.30] },
    travel: { ebitda: 6.5, revenue: 1.20, pb: 1.6, w: [0.55, 0.30, 0.15] },
    ecommerce: { ebitda: 8.5, revenue: 1.40, pb: 2.2, w: [0.45, 0.45, 0.10] },
    textiles_apparel: { ebitda: 5.0, revenue: 0.70, pb: 1.1, w: [0.45, 0.30, 0.25] },
    seafood_export: { ebitda: 5.0, revenue: 0.70, pb: 1.1, w: [0.45, 0.30, 0.25] }
  },
  country:"""
engine, defaults_count = re.subn(
    r"  industry: \{\n.*?\n  \},\n  country:",
    new_industry_defaults,
    engine,
    count=1,
    flags=re.S,
)
if defaults_count != 1:
    raise SystemExit('valuationEngine.ts: default industry block mismatch')

v12_function = r'''

export function valuateV12(input: ValuationInput, cfg: ValuationConfig = DEFAULT_VALUATION_CONFIG): ValuationResult | null {
  const p = cfg.params;
  const industryKey = input.industryKey || industryKeyFromLabel(input.industry) || '';
  const ind = cfg.industry[industryKey];
  const fallbackInd = DEFAULT_VALUATION_CONFIG.industry[industryKey];
  const revenueYear = Number(input.revenueYear || 0) || (Number(input.revenueMonth || 0) * 12);
  if (!ind || !Number.isFinite(revenueYear) || revenueYear <= 0) return null;

  const currency: Currency = String(input.currency || 'VND').toUpperCase() === 'USD' ? 'USD' : 'VND';
  const assetCurrency: Currency = String(input.assetCurrency || currency).toUpperCase() === 'USD' ? 'USD' : 'VND';
  const countryKey = String(input.countryKey || 'VN').toUpperCase();
  const margin = Number(input.ebitdaMargin ?? 0) || 0;
  const growth = Math.min(Number(input.growthPct ?? 0) || 0, Number(p.growth_cap || 50));
  const ebitda = revenueYear * margin / 100;
  const revUSD = currency === 'USD' ? revenueYear : revenueYear / Number(p.usd_vnd || 25000);
  const countryFactor = Number(cfg.country[countryKey] ?? cfg.country.OTHER ?? cfg.country.VN ?? 1);
  const growthFactor = factorFromCurve(growth, cfg.growth_curve);
  const sizeFactor = factorFromCurve(revUSD, cfg.size_bands.map((b) => ({ max: b.max_usd, factor: b.factor })));
  const earningsAdjustment = countryFactor * growthFactor * sizeFactor;
  const adjE = Number(ind.ebitda || 0) * earningsAdjustment;
  const adjR = Number(ind.revenue || 0) * earningsAdjustment;
  const basePb = Number(ind.pb ?? fallbackInd?.pb ?? 0);
  const adjPb = basePb * countryFactor;
  const evFromEbitda = ebitda * adjE;
  const evFromRevenue = revenueYear * adjR;
  const useEbitda = margin >= Number(p.ebitda_margin_floor || 5) && ebitda > 0;

  const optionalNumber = (value: unknown) => {
    if (value === null || value === undefined || value === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };
  const convertAmount = (value: number, from: Currency, to: Currency) => {
    if (from === to) return value;
    const usdVnd = Number(p.usd_vnd || 25000);
    return from === 'USD' ? value * usdVnd : value / usdVnd;
  };
  const convertedOptional = (value: unknown) => {
    const parsed = optionalNumber(value);
    return parsed === null ? null : convertAmount(parsed, assetCurrency, currency);
  };

  const keyAssetValueInputRaw = optionalNumber(input.keyAssetValue);
  const keyAssetValueInput = keyAssetValueInputRaw !== null && keyAssetValueInputRaw > 0
    ? keyAssetValueInputRaw
    : null;
  const keyAssetValue = keyAssetValueInput !== null
    ? convertAmount(keyAssetValueInput, assetCurrency, currency)
    : null;
  const netDebtInput = optionalNumber(input.netDebt);
  const netDebtProvided = netDebtInput !== null;
  const netDebt = netDebtProvided
    ? convertAmount(netDebtInput || 0, assetCurrency, currency)
    : 0;

  const explicitBookEquity = convertedOptional(input.bookEquity);
  const bookEquity = explicitBookEquity !== null
    ? explicitBookEquity
    : keyAssetValue !== null
      ? Math.max(keyAssetValue - netDebt, 0)
      : null;
  const intangibles = convertedOptional(input.intangibles) ?? 0;
  const propertyMarketValue = convertedOptional(input.propertyMarketValue);
  const propertyBookValue = convertedOptional(input.propertyBookValue);
  const surplusAssetValue = convertedOptional(input.surplusAssetValue) ?? 0;

  const sourceWeights = Array.isArray(ind.w) && ind.w.length === 3
    ? ind.w
    : [
        ind.w_ebitda ?? fallbackInd?.w?.[0] ?? p.w_ebitda ?? 0.70,
        ind.w_revenue ?? fallbackInd?.w?.[1] ?? p.w_revenue ?? 0.30,
        ind.w_pb ?? fallbackInd?.w?.[2] ?? 0,
      ];
  const cleanWeights = sourceWeights.map((value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
  });
  const baseWeightTotal = cleanWeights.reduce((sum, value) => sum + value, 0);
  const [wEbitda, wRevenue, wPb] = baseWeightTotal > 0
    ? cleanWeights.map((value) => value / baseWeightTotal)
    : [0.70, 0.30, 0];

  const eqFromEbitda = useEbitda ? evFromEbitda - netDebt : null;
  const eqFromRevenue = evFromRevenue - netDebt;
  const eqFromPb = bookEquity !== null && basePb > 0
    ? bookEquity * adjPb
    : null;

  type LensKey = 'ebitda' | 'revenue' | 'pb';
  let lenses: { key: LensKey; weight: number; equity: number }[] = [];
  if (eqFromEbitda !== null && wEbitda > 0) {
    lenses.push({ key: 'ebitda', weight: wEbitda, equity: eqFromEbitda });
  }
  if (wRevenue > 0) {
    lenses.push({ key: 'revenue', weight: wRevenue, equity: eqFromRevenue });
  }
  if (eqFromPb !== null && wPb > 0) {
    lenses.push({ key: 'pb', weight: wPb, equity: eqFromPb });
  }
  let availableWeightTotal = lenses.reduce((sum, lens) => sum + lens.weight, 0);
  if (!lenses.length || availableWeightTotal <= 0) {
    lenses = [{ key: 'revenue', weight: 1, equity: eqFromRevenue }];
    availableWeightTotal = 1;
  }

  const weightsUsed = { ebitda: 0, revenue: 0, pb: 0 };
  const central = lenses.reduce((sum, lens) => {
    const normalizedWeight = lens.weight / availableWeightTotal;
    weightsUsed[lens.key] = normalizedWeight;
    return sum + normalizedWeight * lens.equity;
  }, 0);

  const earningsWeightTotal = (useEbitda ? wEbitda : 0) + wRevenue;
  const evOperating = earningsWeightTotal > 0
    ? ((useEbitda ? wEbitda * evFromEbitda : 0) + wRevenue * evFromRevenue) / earningsWeightTotal
    : evFromRevenue;
  const equityOperating = evOperating - netDebt;

  const netTangibleBook = bookEquity !== null ? bookEquity - intangibles : null;
  let floor: number | null = null;
  if (netTangibleBook !== null && propertyMarketValue !== null && propertyBookValue !== null) {
    floor = netTangibleBook + (propertyMarketValue - propertyBookValue);
  } else if (netTangibleBook !== null) {
    floor = netTangibleBook;
  }

  const core = floor !== null ? Math.max(central, floor) : central;
  const mid = core + surplusAssetValue;
  if (!Number.isFinite(mid)) return null;
  const low = mid * (1 - Number(p.spread_low ?? 0.15));
  const high = mid * (1 + Number(p.spread_high ?? 0.15));
  const assetValueWarning = floor !== null && Math.max(equityOperating, 0) > 0 && floor > Math.max(equityOperating, 0) * 2;
  const netDebtExceedsAsset = keyAssetValue !== null && netDebt > keyAssetValue;

  let self: number | undefined;
  let verdict: ValuationResult['verdict'];
  let pctAbove: number | undefined;
  const stake = Number(input.offerStakePct || 0);
  const offer = Number(input.offerAmount || 0);
  if (stake > 0 && offer > 0) {
    self = offer / (stake / 100);
    if (self < low) verdict = 'low_of';
    else if (self <= high) verdict = 'in_range';
    else {
      verdict = 'above';
      pctAbove = Math.round((self - high) / Math.max(high, 1) * 100);
    }
  }

  return {
    low,
    mid,
    high,
    method: lenses.length > 1 ? 'blend' : 'revenue_only',
    valuationMode: bookEquity !== null ? 'asset_floor' : 'earnings',
    assetMethodConfidence: bookEquity !== null ? (explicitBookEquity !== null ? 'medium' : 'low') : null,
    assetInputApplied: bookEquity !== null,
    assetInputStoredOnly: false,
    currency,
    assetCurrency,
    revenueYear,
    ebitda,
    adjE,
    adjR,
    evFromEbitda,
    evFromRevenue,
    evOperating,
    equityOperating,
    keyAssetValueInput,
    keyAssetValue,
    netDebtInput,
    netDebt,
    netDebtProvided,
    assetReferenceEquity: floor,
    assetWeight: weightsUsed.pb || null,
    assetValueWarning,
    netDebtExceedsAsset,
    self,
    verdict,
    pctAbove,
    configVersion: cfg.version,
    industryKey,
    countryFactor,
    growthFactor,
    sizeFactor,
    formulaVersion: '1.2',
    adjPb,
    eqFromEbitda,
    eqFromRevenue,
    eqFromPb,
    central,
    floor,
    bookEquity,
    netTangibleBook,
    surplusAssetValue,
    weightsUsed,
  };
}
'''

marker = '\nexport function valuationInputFromBusiness'
if engine.count(marker) != 1:
    raise SystemExit('valuationEngine.ts: insertion marker mismatch')
engine = engine.replace(marker, v12_function + marker, 1)
engine_path.write_text(engine, encoding='utf-8')

valuation_path = Path('src/pages/Valuation.tsx')
replace_once(valuation_path, '  valuate,\n', '  valuateV12,\n')
replace_once(valuation_path, '    return valuate(\n', '    return valuateV12(\n')

register_path = Path('src/pages/Register.tsx')
replace_once(register_path, '  valuate,\n', '  valuateV12,\n')
replace_once(register_path, '      valuate(\n', '      valuateV12(\n')

qa_path = Path('scripts/deals68-asset-valuation-v1-check.mjs')
qa_path.write_text(r'''import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const read = (path) => fs.readFileSync(path, 'utf8');
const engineSource = read('src/lib/valuationEngine.ts');
const valuationSource = read('src/pages/Valuation.tsx');
const registerSource = read('src/pages/Register.tsx');
const dashboardSource = read('src/pages/BusinessDashboard.tsx');
const businessDetailSource = read('src/pages/BusinessDetail.tsx');

const transpiled = ts.transpileModule(engineSource, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
    esModuleInterop: true,
  },
}).outputText;

const moduleObject = { exports: {} };
const localRequire = (id) => {
  if (id === './supabase') return { supabase: {} };
  if (id === './labelsBase') return { T: (lang, vi, en) => (lang === 'en' ? en : vi) };
  if (id === './industryTaxonomy') return { industryKeyFromLabel: (value) => String(value || '') };
  throw new Error(`Unexpected module in valuation QA: ${id}`);
};
const execute = vm.runInThisContext(`(function(exports, require, module){${transpiled}\n})`);
execute(moduleObject.exports, localRequire, moduleObject);
const { DEFAULT_VALUATION_CONFIG, valuateV12 } = moduleObject.exports;

const closeTo = (actual, expected, tolerance = 1e-8) =>
  Number.isFinite(actual) && Math.abs(actual - expected) <= Math.max(1, Math.abs(expected)) * tolerance;

const checks = [];
const check = (name, condition) => checks.push([name, Boolean(condition)]);

check('v1.2 function is exported', typeof valuateV12 === 'function');
check('valuation page uses v1.2 only', valuationSource.includes('valuateV12(') && !valuationSource.includes('return valuate('));
check('business registration uses v1.2 only', registerSource.includes('valuateV12(') && !registerSource.includes('\n      valuate(\n'));
check('business dashboard remains on existing formula', dashboardSource.includes('const dashboardBenchmark = valuate(') && !dashboardSource.includes('valuateV12('));
check('public Business detail remains unchanged', !businessDetailSource.includes('bookEquity') && !businessDetailSource.includes('weightsUsed'));

const industries = Object.values(DEFAULT_VALUATION_CONFIG.industry);
check('all 23 industries have P/B and three weights', industries.length === 23 && industries.every((item) => Number(item.pb) > 0 && Array.isArray(item.w) && item.w.length === 3));
check('all industry weights sum to one', industries.every((item) => closeTo(item.w.reduce((sum, value) => sum + Number(value), 0), 1, 1e-12)));

const fnbAsset = valuateV12({
  revenueYear: 10_000_000_000,
  ebitdaMargin: 0,
  growthPct: 0,
  industryKey: 'food_beverage',
  countryKey: 'VN',
  currency: 'VND',
  keyAssetValue: 1_000_000_000_000,
  netDebt: 0,
  assetCurrency: 'VND',
}, DEFAULT_VALUATION_CONFIG);
check('F&B asset case applies universal floor', closeTo(fnbAsset?.mid, 1_000_000_000_000));
check('missing EBITDA renormalizes Revenue and P/B', closeTo(fnbAsset?.weightsUsed?.revenue, 2 / 3) && closeTo(fnbAsset?.weightsUsed?.pb, 1 / 3) && closeTo(fnbAsset?.weightsUsed?.ebitda, 0));
check('F&B asset case matches central reference', closeTo(fnbAsset?.central, 504_560_000_000));

const fnbRegular = valuateV12({
  revenueYear: 9_000_000_000,
  ebitdaMargin: 17,
  growthPct: 10,
  industryKey: 'food_beverage',
  countryKey: 'VN',
  currency: 'VND',
}, DEFAULT_VALUATION_CONFIG);
check('missing asset data renormalizes EBITDA and Revenue', closeTo(fnbRegular?.weightsUsed?.ebitda, 0.55 / 0.85) && closeTo(fnbRegular?.weightsUsed?.revenue, 0.30 / 0.85) && closeTo(fnbRegular?.weightsUsed?.pb, 0));
check('regular F&B case matches v1.2 benchmark', closeTo(fnbRegular?.mid, 6_708_388_235.294119));

const realEstate = valuateV12({
  revenueYear: 12_000_000_000,
  ebitdaMargin: 60,
  growthPct: 8,
  industryKey: 'real_estate',
  countryKey: 'VN',
  currency: 'VND',
  bookEquity: 70_000_000_000,
  propertyMarketValue: 150_000_000_000,
  propertyBookValue: 90_000_000_000,
  netDebt: 40_000_000_000,
  assetCurrency: 'VND',
}, DEFAULT_VALUATION_CONFIG);
check('real-estate P/B uses country only', closeTo(realEstate?.eqFromPb, 77_000_000_000));
check('RNAV floor is applied', closeTo(realEstate?.floor, 130_000_000_000) && closeTo(realEstate?.mid, 130_000_000_000));
check('negative Revenue equity remains one weighted lens', closeTo(realEstate?.eqFromRevenue, -5_980_000_000));

const software = valuateV12({
  revenueYear: 30_000_000_000,
  ebitdaMargin: 25,
  growthPct: 40,
  industryKey: 'it_software',
  countryKey: 'VN',
  currency: 'VND',
  bookEquity: 15_000_000_000,
  assetCurrency: 'VND',
}, DEFAULT_VALUATION_CONFIG);
check('asset floor does not cap profitable software', closeTo(software?.mid, 88_621_875_000) && software?.mid > software?.floor);
check('P/B excludes growth and size factors', closeTo(software?.adjPb, 3));
check('v1.2 result persists transparent formula data', software?.formulaVersion === '1.2' && software?.weightsUsed && software?.floor === 15_000_000_000);

check('formula is not additive asset plus earnings', !engineSource.includes('central + keyAssetValue') && !engineSource.includes('evOperating + keyAssetValue'));
check('current key asset input is converted to equity proxy after net debt', engineSource.includes('Math.max(keyAssetValue - netDebt, 0)'));

const failed = checks.filter(([, ok]) => !ok);
for (const [name, ok] of checks) console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`);
if (failed.length) {
  console.error(`Valuation v1.2 QA failed: ${failed.map(([name]) => name).join(', ')}`);
  process.exit(1);
}
console.log(`Valuation v1.2 QA passed: ${checks.length}/${checks.length}`);
''', encoding='utf-8')

print('Applied valuation formula v1.2 to Valuation and Business registration only.')
