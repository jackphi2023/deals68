from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def write(path: str, text: str) -> None:
    (ROOT / path).write_text(text, encoding="utf-8")


def replace_once(path: str, old: str, new: str) -> None:
    text = read(path)
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{path}: expected one exact match, found {count}: {old[:120]!r}")
    write(path, text.replace(old, new, 1))


def replace_regex(path: str, pattern: str, replacement: str) -> None:
    text = read(path)
    updated, count = re.subn(pattern, replacement, text, count=1, flags=re.S)
    if count != 1:
        raise RuntimeError(f"{path}: regex did not match exactly once: {pattern[:120]!r}")
    write(path, updated)


def append_once(path: str, marker: str, addition: str) -> None:
    text = read(path)
    if marker in text:
        return
    write(path, text.rstrip() + "\n\n" + addition.strip() + "\n")


ENGINE = "src/lib/valuationEngine.ts"
VALUATION = "src/pages/Valuation.tsx"
REGISTER = "src/pages/Register.tsx"
DASHBOARD = "src/pages/BusinessDashboard.tsx"
VAL_CSS = "src/styles/pages/valuation.css"
AUTH_CSS = "src/styles/pages/auth.css"
DASH_CSS = "src/styles/pages/dashboard.css"
PACKAGE = "package.json"
QA_FILE = "scripts/deals68-asset-valuation-v1-check.mjs"
WORKFLOW = ".github/workflows/deals68-asset-valuation-v1-apply.yml"

# ---------------------------------------------------------------------------
# Valuation engine: additive-only asset-adjusted layer.
# ---------------------------------------------------------------------------
replace_once(
    ENGINE,
    "export type Currency = 'VND' | 'USD';\n",
    "export type Currency = 'VND' | 'USD';\n"
    "export type AssetValuationMode = 'earnings' | 'asset_floor' | 'asset_blend';\n"
    "export type AssetMethodConfidence = 'low' | 'medium' | 'high';\n",
)

replace_once(
    ENGINE,
    "  industry: Record<string, { ebitda: number; revenue: number }>;",
    "  industry: Record<string, {\n"
    "    ebitda: number;\n"
    "    revenue: number;\n"
    "    valuation_mode?: AssetValuationMode;\n"
    "    w_asset?: number;\n"
    "  }>;")

replace_once(
    ENGINE,
    "  offerStakePct?: number;\n  offerAmount?: number;\n};",
    "  offerStakePct?: number;\n"
    "  offerAmount?: number;\n"
    "  keyAssetValue?: number;\n"
    "  netDebt?: number;\n"
    "  assetCurrency?: Currency;\n"
    "};",
)

replace_regex(
    ENGINE,
    r"export type ValuationResult = \{.*?\n\};\n\nexport const DEFAULT_VALUATION_CONFIG",
    """export type ValuationResult = {
  low: number;
  mid: number;
  high: number;
  method: 'blend' | 'revenue_only';
  valuationMode: AssetValuationMode;
  assetMethodConfidence: AssetMethodConfidence | null;
  assetInputApplied: boolean;
  assetInputStoredOnly: boolean;
  currency: Currency;
  assetCurrency: Currency;
  revenueYear: number;
  ebitda: number;
  adjE: number;
  adjR: number;
  evFromEbitda: number;
  evFromRevenue: number;
  evOperating: number;
  equityOperating: number;
  keyAssetValueInput: number | null;
  keyAssetValue: number | null;
  netDebtInput: number | null;
  netDebt: number;
  netDebtProvided: boolean;
  assetReferenceEquity: number | null;
  assetWeight: number | null;
  assetValueWarning: boolean;
  netDebtExceedsAsset: boolean;
  self?: number;
  verdict?: 'low_of' | 'in_range' | 'above';
  pctAbove?: number;
  configVersion: number;
  industryKey: string;
  countryFactor: number;
  growthFactor: number;
  sizeFactor: number;
};

export const DEFAULT_VALUATION_CONFIG""",
)

for old, new in {
    "    agriculture: { ebitda: 5.5, revenue: 0.90 },": "    agriculture: { ebitda: 5.5, revenue: 0.90, valuation_mode: 'asset_floor' },",
    "    hotels_resorts: { ebitda: 8.0, revenue: 2.20 },": "    hotels_resorts: { ebitda: 8.0, revenue: 2.20, valuation_mode: 'asset_blend', w_asset: 0.50 },",
    "    manufacturing: { ebitda: 6.0, revenue: 0.85 },": "    manufacturing: { ebitda: 6.0, revenue: 0.85, valuation_mode: 'asset_floor' },",
    "    real_estate: { ebitda: 9.0, revenue: 3.00 },": "    real_estate: { ebitda: 9.0, revenue: 3.00, valuation_mode: 'asset_blend', w_asset: 0.75 },",
}.items():
    replace_once(ENGINE, old, new)

replace_once(
    ENGINE,
    "function safeConfig(row: any): ValuationConfig {",
    """function mergeIndustryConfig(raw: any): ValuationConfig['industry'] {
  const source = raw && typeof raw === 'object' ? raw : {};
  const keys = new Set([
    ...Object.keys(DEFAULT_VALUATION_CONFIG.industry),
    ...Object.keys(source),
  ]);
  return Object.fromEntries(
    [...keys].map((key) => [
      key,
      {
        ...(DEFAULT_VALUATION_CONFIG.industry[key] || {}),
        ...(source[key] || {}),
      },
    ]),
  ) as ValuationConfig['industry'];
}

function safeConfig(row: any): ValuationConfig {""",
)
replace_once(
    ENGINE,
    "    industry: { ...DEFAULT_VALUATION_CONFIG.industry, ...(row.industry || {}) },",
    "    industry: mergeIndustryConfig(row.industry),",
)

new_valuate = r"""export function valuate(input: ValuationInput, cfg: ValuationConfig = DEFAULT_VALUATION_CONFIG): ValuationResult | null {
  const p = cfg.params;
  const industryKey = input.industryKey || industryKeyFromLabel(input.industry) || '';
  const ind = cfg.industry[industryKey];
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
  const adjE = ind.ebitda * countryFactor * growthFactor * sizeFactor;
  const adjR = ind.revenue * countryFactor * growthFactor * sizeFactor;
  const evFromEbitda = ebitda * adjE;
  const evFromRevenue = revenueYear * adjR;
  const useEbitda = margin >= Number(p.ebitda_margin_floor || 5) && ebitda > 0;
  const evOperating = useEbitda
    ? Number(p.w_ebitda || 0.7) * evFromEbitda + Number(p.w_revenue || 0.3) * evFromRevenue
    : evFromRevenue;

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

  const keyAssetValueInputRaw = optionalNumber(input.keyAssetValue);
  const keyAssetValueInput = keyAssetValueInputRaw !== null && keyAssetValueInputRaw > 0
    ? keyAssetValueInputRaw
    : null;
  const netDebtInput = optionalNumber(input.netDebt);
  const netDebtProvided = netDebtInput !== null;
  const keyAssetValue = keyAssetValueInput !== null
    ? convertAmount(keyAssetValueInput, assetCurrency, currency)
    : null;
  const netDebt = netDebtProvided
    ? convertAmount(netDebtInput || 0, assetCurrency, currency)
    : 0;
  const equityOperating = evOperating - netDebt;
  const assetReferenceEquity = keyAssetValue !== null
    ? Math.max(keyAssetValue - netDebt, 0)
    : null;
  const configuredMode: AssetValuationMode = ind.valuation_mode || 'earnings';
  const assetInputApplied = assetReferenceEquity !== null && configuredMode !== 'earnings';
  const assetInputStoredOnly = assetReferenceEquity !== null && configuredMode === 'earnings';
  const valuationMode: AssetValuationMode = assetInputApplied ? configuredMode : 'earnings';

  let assetWeight: number | null = null;
  let mid: number;
  if (valuationMode === 'asset_blend' && assetReferenceEquity !== null) {
    assetWeight = Math.max(0, Math.min(1, Number(ind.w_asset ?? 0.5)));
    mid = assetWeight * assetReferenceEquity + (1 - assetWeight) * Math.max(equityOperating, 0);
  } else if (valuationMode === 'asset_floor' && assetReferenceEquity !== null) {
    mid = Math.max(equityOperating, assetReferenceEquity, 0);
  } else {
    mid = Math.max(equityOperating, 0);
  }

  const low = mid * (1 - Number(p.spread_low || 0.15));
  const high = mid * (1 + Number(p.spread_high || 0.15));
  const operatingEquityForWarning = Math.max(equityOperating, 0);
  const assetValueWarning = assetReferenceEquity !== null &&
    operatingEquityForWarning > 0 &&
    assetReferenceEquity > operatingEquityForWarning * 2;
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
    method: useEbitda ? 'blend' : 'revenue_only',
    valuationMode,
    assetMethodConfidence: keyAssetValueInput !== null ? 'low' : null,
    assetInputApplied,
    assetInputStoredOnly,
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
    assetReferenceEquity,
    assetWeight,
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
  };
}

"""
replace_regex(
    ENGINE,
    r"export function valuate\(.*?\n\}\n\n(?=export function valuationInputFromBusiness)",
    new_valuate,
)

new_input_from_business = r"""export function valuationInputFromBusiness(b: any): ValuationInput {
  const financialInput = b?.financial_input && typeof b.financial_input === 'object' ? b.financial_input : {};
  const benchmark = financialInput.benchmark && typeof financialInput.benchmark === 'object'
    ? financialInput.benchmark
    : {};
  const assetInputs = benchmark.asset_inputs && typeof benchmark.asset_inputs === 'object'
    ? benchmark.asset_inputs
    : financialInput.asset_inputs && typeof financialInput.asset_inputs === 'object'
      ? financialInput.asset_inputs
      : {};
  const optionalNumber = (value: unknown) => {
    if (value === null || value === undefined || value === '') return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  };
  return {
    revenueYear: Number(b?.revenue_2025 || b?.revenue_year || 0),
    revenueMonth: Number(b?.revenue_month || financialInput.revenue_month || 0),
    ebitdaMargin: Number(b?.ebitda_margin || 0),
    growthPct: Number(b?.growth_pct ?? financialInput.growth_pct ?? 0),
    industryKey: b?.industry_key || industryKeyFromLabel(b?.industry),
    industry: b?.industry,
    countryKey: b?.country_iso2 || 'VN',
    currency: String(b?.revenue_currency || 'VND').toUpperCase() === 'USD' ? 'USD' : 'VND',
    offerStakePct: Number(b?.offer_stake_pct ?? b?.stake_pct ?? 0),
    offerAmount: Number(b?.offer_amount ?? b?.ask_amount ?? 0),
    keyAssetValue: optionalNumber(assetInputs.key_asset_value ?? assetInputs.keyAssetValue),
    netDebt: optionalNumber(assetInputs.net_debt ?? assetInputs.netDebt),
    assetCurrency: String(assetInputs.currency || b?.revenue_currency || 'VND').toUpperCase() === 'USD'
      ? 'USD'
      : 'VND',
  };
}

export function valuationMethodLabel(lang: Lang, result: ValuationResult | null) {
  if (!result) return '—';
  if (result.assetInputApplied) {
    return T(
      lang,
      'Bội số Tài sản, Bội số doanh thu & lợi nhuận',
      'Asset, revenue & profit multiples',
    );
  }
  return result.method === 'blend'
    ? T(lang, 'Thu nhập — Doanh thu & EBITDA', 'Earnings — Revenue & EBITDA')
    : T(lang, 'Thu nhập — Doanh thu', 'Earnings — Revenue');
}

export function valuationAssetMessages(lang: Lang, result: ValuationResult | null) {
  if (!result) return [] as string[];
  const messages: string[] = [];
  if (result.keyAssetValueInput === null) {
    messages.push(T(
      lang,
      'Chưa nhập giá trị tài sản chính. Hệ thống đang dùng phương pháp thu nhập dựa trên doanh thu, EBITDA và hệ số ngành.',
      'Key asset value has not been provided. The estimate is based on revenue, EBITDA and industry multiples.',
    ));
  } else if (result.assetInputStoredOnly) {
    messages.push(T(
      lang,
      'Ngành này hiện ưu tiên phương pháp thu nhập. Giá trị tài sản được lưu để tham khảo và có thể được Admin/Advisor xem xét thêm.',
      'This industry currently prioritizes the earnings method. The asset value is stored for reference and may be reviewed by an Admin/Advisor.',
    ));
  } else if (result.valuationMode === 'asset_blend') {
    messages.push(T(
      lang,
      'Hệ thống đang trộn giá trị vận hành và giá trị tài sản theo trọng số ngành.',
      'The estimate blends operating value and asset value using the industry weighting.',
    ));
  } else if (result.valuationMode === 'asset_floor') {
    messages.push(T(
      lang,
      'Hệ thống đang dùng giá trị tài sản như sàn tham chiếu, tránh định giá thấp hơn giá trị tài sản chính.',
      'The asset value is used as a reference floor to avoid valuing the business below its key asset value.',
    ));
  }
  if (!result.netDebtProvided) {
    messages.push(T(
      lang,
      'Chưa nhập nợ ròng, hệ thống tạm tính nợ ròng = 0.',
      'Net debt was not provided; the estimate assumes net debt = 0.',
    ));
  }
  if (result.assetValueWarning) {
    messages.push(T(
      lang,
      'Giá trị tài sản chính đang cao hơn đáng kể so với giá trị vận hành. Kết quả cần được kiểm chứng bằng giấy tờ tài sản, định giá độc lập hoặc dữ liệu giao dịch tương đương.',
      'The key asset value is significantly higher than the operating valuation. Validate it with asset documents, an independent appraisal or comparable transactions.',
    ));
  }
  if (result.netDebtExceedsAsset) {
    messages.push(T(
      lang,
      'Nợ ròng lớn hơn giá trị tài sản chính đã nhập. Giá trị vốn chủ theo tài sản có thể rất thấp hoặc bằng 0.',
      'Net debt is higher than the entered key asset value. Asset-based equity value may be very low or zero.',
    ));
  }
  return messages;
}

"""
replace_regex(
    ENGINE,
    r"export function valuationInputFromBusiness\(.*?\n\}\n\n(?=export function formatValuationMoney)",
    new_input_from_business,
)

# ---------------------------------------------------------------------------
# Public valuation page.
# ---------------------------------------------------------------------------
replace_once(
    VALUATION,
    "  formatValuationMoney,\n  VALUATION_DISCLAIMER_EN,",
    "  formatValuationMoney,\n  valuationMethodLabel,\n  valuationAssetMessages,\n  VALUATION_DISCLAIMER_EN,",
)
replace_once(
    VALUATION,
    "  const [growth, setGrowth] = useState('');",
    "  const [growth, setGrowth] = useState('');\n  const [keyAssetValue, setKeyAssetValue] = useState('');",
)
replace_once(
    VALUATION,
    "  const parsedRevenue = parseFormattedNumber(revenueYear);",
    "  const parsedRevenue = parseFormattedNumber(revenueYear);\n  const parsedAssetValue = parseFormattedNumber(keyAssetValue);",
)
replace_once(
    VALUATION,
    "        currency,\n      },",
    "        currency,\n        keyAssetValue: parsedAssetValue > 0 ? parsedAssetValue : undefined,\n        assetCurrency: currency,\n      },",
)
replace_once(
    VALUATION,
    "    industryKey,\n    margin,\n    parsedRevenue,",
    "    industryKey,\n    keyAssetValue,\n    margin,\n    parsedAssetValue,\n    parsedRevenue,",
)
replace_once(
    VALUATION,
    "  const disclaimer = T(\n    lang,\n    VALUATION_DISCLAIMER_VI,\n    VALUATION_DISCLAIMER_EN,\n  );",
    "  const disclaimer = T(\n    lang,\n    VALUATION_DISCLAIMER_VI,\n    VALUATION_DISCLAIMER_EN,\n  );\n  const assetMessages = valuationAssetMessages(lang, result);",
)

asset_row = r"""
              <div className="d68-val-revenue-row d68-val-asset-row">
                <label>
                  {T(lang, 'Giá trị tài sản chính', 'Key asset value')}
                  <input
                    inputMode="numeric"
                    value={keyAssetValue}
                    placeholder={T(lang, 'Ví dụ: 50.000.000.000', 'Example: 2,000,000')}
                    onChange={(event: ChangeEvent<HTMLInputElement>) =>
                      setKeyAssetValue(formatNumberTyping(event.target.value))
                    }
                  />
                  <small>
                    {T(
                      lang,
                      'Tùy chọn. Nhập giá trị thị trường ước tính của đất, tòa nhà, máy móc, nhà máy, khách sạn, quyền sử dụng đất hoặc tài sản vận hành chính; không dùng giá trị sổ sách.',
                      'Optional. Enter the estimated market value of land, buildings, machinery, factory, hotel, land-use rights or key operating assets; do not use book value.',
                    )}
                  </small>
                </label>

                <label>
                  {T(lang, 'Đơn vị', 'Currency')}
                  <select
                    value={currency}
                    onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                      setCurrency(event.target.value as Currency)
                    }
                  >
                    <option value="VND">{T(lang, 'VNĐ', 'VND')}</option>
                    <option value="USD">USD</option>
                  </select>
                </label>
              </div>
"""
replace_once(
    VALUATION,
    "              <div className=\"d68-val-metrics-row\">",
    asset_row + "\n              <div className=\"d68-val-metrics-row\">",
)
replace_regex(
    VALUATION,
    r"b=\{\n\s*result\.method === 'blend'.*?\n\s*\}\n\s*/>",
    "b={valuationMethodLabel(lang, result)}\n                  />",
)
replace_once(
    VALUATION,
    "                  <Row\n                    a={T(lang, 'Quốc gia', 'Country')}\n                    b={T(\n                      lang,\n                      countryLabel.vi,\n                      countryLabel.en,\n                    )}\n                  />",
    "                  <Row\n                    a={T(lang, 'Quốc gia', 'Country')}\n                    b={T(\n                      lang,\n                      countryLabel.vi,\n                      countryLabel.en,\n                    )}\n                  />\n                  {assetMessages.map((message) => (\n                    <p key={message} className=\"d68-val-asset-note\">{message}</p>\n                  ))}",
)
replace_once(
    VALUATION,
    "'Dùng bội số EV/EBITDA và EV/Doanh thu theo 23 nhóm ngành chuẩn hóa.',\n                 'Uses EV/EBITDA and EV/Revenue multiples across the standardized 23 industries.',",
    "'Dùng bội số EV/EBITDA, EV/Doanh thu và lớp tài sản có kiểm soát cho ngành tài sản nặng khi có dữ liệu.',\n                 'Uses EV/EBITDA, EV/Revenue and a controlled asset layer for asset-heavy industries when data is provided.',",
)

# ---------------------------------------------------------------------------
# Register Business: optional asset inputs, private benchmark persistence.
# ---------------------------------------------------------------------------
replace_once(
    REGISTER,
    "  formatValuationMoney,\n  valuationVerdictMessage,",
    "  formatValuationMoney,\n  valuationVerdictMessage,\n  valuationMethodLabel,\n  valuationAssetMessages,",
)
replace_once(
    REGISTER,
    "  const [growthPct, setGrowthPct] = useState('');",
    "  const [growthPct, setGrowthPct] = useState('');\n  const [keyAssetValue, setKeyAssetValue] = useState('');\n  const [netDebt, setNetDebt] = useState('');",
)
replace_once(
    REGISTER,
    "  const countryCode = countryIso[country] || 'VN';",
    "  const countryCode = countryIso[country] || 'VN';\n  const assetInputCurrency: 'VND' | 'USD' = lang === 'en' ? 'USD' : 'VND';",
)
replace_once(
    REGISTER,
    "          currency: countryCode === 'VN' ? 'VND' : 'USD',\n          offerAmount:",
    "          currency: countryCode === 'VN' ? 'VND' : 'USD',\n          keyAssetValue: parseFormattedNumber(keyAssetValue) || undefined,\n          netDebt: netDebt.trim() ? parseFormattedNumber(netDebt) : undefined,\n          assetCurrency: assetInputCurrency,\n          offerAmount:",
)
replace_once(
    REGISTER,
    "      industry,\n      revenue,\n      revenueMonth,",
    "      industry,\n      keyAssetValue,\n      netDebt,\n      assetInputCurrency,\n      revenue,\n      revenueMonth,",
)

upload_plan_old = """        const uploadPlan = {
          images: businessImages.map((asset) => ({
            file_name: asset.file.name,
            display_name: asset.displayName,
            size_bytes: asset.file.size,
          })),
          files: businessDocs.map((asset) => ({
            file_name: asset.file.name,
            display_name: asset.displayName,
            size_bytes: asset.file.size,
          })),
        };
"""
upload_plan_new = upload_plan_old + """        const keyAssetAmount = parseFormattedNumber(keyAssetValue);
        const netDebtProvided = !!netDebt.trim();
        const netDebtAmount = netDebtProvided ? parseFormattedNumber(netDebt) : null;
        const benchmarkAssetInputs = {
          key_asset_value: keyAssetAmount > 0 ? keyAssetAmount : null,
          net_debt: netDebtAmount,
          currency: assetInputCurrency,
          source: 'user_estimate',
          asset_input_source: 'user_estimate',
          asset_valuation_mode_applied: benchmarkResult?.valuationMode || 'earnings',
          asset_method_confidence: keyAssetAmount > 0
            ? benchmarkResult?.assetMethodConfidence || 'low'
            : null,
        };
"""
replace_once(REGISTER, upload_plan_old, upload_plan_new)
replace_once(
    REGISTER,
    "            benchmark: benchmarkResult,",
    "            benchmark: {\n              ...(benchmarkResult || {}),\n              asset_inputs: benchmarkAssetInputs,\n            },",
)
replace_once(
    REGISTER,
    "              financialSource,\n              assetsOwned,",
    "              financialSource,\n              keyAssetValue,\n              netDebt,\n              assetsOwned,",
)

register_asset_ui = r"""
                <div className="d68-asset-valuation-inputs">
                  <Field
                    label={T(
                      lang,
                      `Giá trị tài sản chính (${assetInputCurrency === 'VND' ? 'VNĐ' : 'USD'}) — tùy chọn`,
                      `Key asset value (${assetInputCurrency}) — optional`,
                    )}
                    hint={T(
                      lang,
                      'Giá trị thị trường ước tính của đất, tòa nhà, máy móc, nhà máy hoặc tài sản chính đi kèm giao dịch.',
                      'Estimated market value of land, buildings, machinery, factory or key assets included in the transaction.',
                    )}
                  >
                    <input
                      inputMode="numeric"
                      value={keyAssetValue}
                      onChange={(event) =>
                        setKeyAssetValue(formatNumberTyping(event.target.value))
                      }
                      placeholder={T(
                        lang,
                        'Nhập số: đất đai, nhà máy, khách sạn, tòa nhà...',
                        'Enter a number for land, factory, hotel, building...',
                      )}
                    />
                  </Field>
                  <Field
                    label={T(
                      lang,
                      `Giá trị nợ ròng (${assetInputCurrency === 'VND' ? 'VNĐ' : 'USD'}) — tùy chọn`,
                      `Net debt (${assetInputCurrency}) — optional`,
                    )}
                    hint={T(
                      lang,
                      'Nợ ròng = nợ vay trừ tiền mặt và tương đương tiền. Nếu chưa rõ, có thể để trống.',
                      'Net debt = interest-bearing debt minus cash and cash equivalents. Leave blank if unknown.',
                    )}
                  >
                    <input
                      inputMode="numeric"
                      value={netDebt}
                      onChange={(event) =>
                        setNetDebt(formatNumberTyping(event.target.value))
                      }
                      placeholder={T(lang, 'Không bắt buộc', 'Optional')}
                    />
                  </Field>
                </div>
"""
replace_once(
    REGISTER,
    "                <div className={`d68-valuation-check d68-valuation-check--${valuationCheck.level}`}>",
    register_asset_ui + "\n                <div className={`d68-valuation-check d68-valuation-check--${valuationCheck.level}`}>",
)
replace_once(
    REGISTER,
    "                    <div><dt>EV/EBITDA</dt><dd>{valuationCheck.adjE ? `${valuationCheck.adjE.toFixed(2)}×` : '—'}</dd></div>\n                  </dl>",
    "                    <div><dt>EV/EBITDA</dt><dd>{valuationCheck.adjE ? `${valuationCheck.adjE.toFixed(2)}×` : '—'}</dd></div>\n"
    "                    <div><dt>{T(lang, 'Phương pháp', 'Method')}</dt><dd>{benchmarkResult ? valuationMethodLabel(lang, benchmarkResult) : '—'}</dd></div>\n"
    "                    <div><dt>{T(lang, 'Giá trị tài sản ròng tham chiếu', 'Asset-adjusted reference equity')}</dt><dd>{benchmarkResult?.assetReferenceEquity !== null && benchmarkResult?.assetReferenceEquity !== undefined ? formatValuationMoney(benchmarkResult.assetReferenceEquity, benchmarkResult.currency, lang) : '—'}</dd></div>\n"
    "                  </dl>\n"
    "                  {benchmarkResult ? <ul className=\"d68-valuation-asset-notes\">{valuationAssetMessages(lang, benchmarkResult).map((note) => <li key={note}>{note}</li>)}</ul> : null}",
)

# ---------------------------------------------------------------------------
# Business Dashboard: read-only reuse of registration inputs.
# ---------------------------------------------------------------------------
replace_once(
    DASHBOARD,
    "valuationInputFromBusiness, formatValuationMoney, valuationVerdictMessage, VALUATION_DISCLAIMER_VI, VALUATION_DISCLAIMER_EN",
    "valuationInputFromBusiness, formatValuationMoney, valuationVerdictMessage, valuationMethodLabel, valuationAssetMessages, VALUATION_DISCLAIMER_VI, VALUATION_DISCLAIMER_EN",
)

new_overview = r"""function ValuationOverviewBox({ lang, result }: any) {
  const currency = result?.currency || 'VND';
  const assetCurrency = result?.assetCurrency || currency;
  const hasKeyAsset = result?.keyAssetValueInput !== null &&
    result?.keyAssetValueInput !== undefined &&
    Number(result.keyAssetValueInput) > 0;
  const hasNetDebt = !!result?.netDebtProvided;
  const assetMessages = valuationAssetMessages(lang, result);
  return <div className="d68-dashboard-valuation-box d68-dashboard-valuation-box--engine">
    <div>
      <span>{T(lang, 'Giá trị doanh nghiệp tự định giá', 'Implied self valuation')}</span>
      <strong>{result?.self ? formatValuationMoney(result.self, currency, lang) : T(lang, 'Chưa đủ dữ liệu', 'Not enough data')}</strong>
      <small>{T(lang, 'Suy từ số tiền đề xuất và tỷ lệ cổ phần.', 'Derived from proposed amount and stake percentage.')}</small>
    </div>
    <div>
      <span>{T(lang, 'Tham chiếu ngành', 'Industry benchmark')}</span>
      <strong>{result ? `${formatValuationMoney(result.low, currency, lang)} – ${formatValuationMoney(result.high, currency, lang)}` : T(lang, 'Đang cập nhật', 'Pending')}</strong>
      <small>{result ? valuationVerdictMessage(lang, result) : T(lang, 'Cần doanh thu, ngành và biên EBITDA/tăng trưởng để tính tham chiếu.', 'Revenue, industry and EBITDA/growth inputs are needed for a benchmark.')}</small>
    </div>
    <div>
      <span>{T(lang, 'Phương pháp đang áp dụng', 'Applied method')}</span>
      <strong>{valuationMethodLabel(lang, result)}</strong>
      <small>{result ? `EV/EBITDA ${result.adjE.toFixed(2)}× · EV/Revenue ${result.adjR.toFixed(2)}×` : T(lang, 'Không trả số giả nếu thiếu dữ liệu.', 'No fake numbers when inputs are missing.')}</small>
    </div>
    {hasKeyAsset ? <div>
      <span>{T(lang, 'Giá trị tài sản chính', 'Key asset value')}</span>
      <strong>{formatValuationMoney(result.keyAssetValueInput, assetCurrency, lang)}</strong>
      <small>{T(lang, 'Số liệu đã nhập tại bước tạo tài khoản; Dashboard hiện chỉ hiển thị.', 'Value entered during registration; the Dashboard is currently read-only.')}</small>
    </div> : null}
    {hasNetDebt ? <div>
      <span>{T(lang, 'Giá trị nợ ròng', 'Net debt')}</span>
      <strong>{formatValuationMoney(result.netDebtInput, assetCurrency, lang)}</strong>
      <small>{T(lang, 'Nợ vay trừ tiền mặt và tương đương tiền.', 'Interest-bearing debt minus cash and cash equivalents.')}</small>
    </div> : null}
    <p>{assetMessages.length ? `${assetMessages.join(' ')} ` : ''}{T(lang, VALUATION_DISCLAIMER_VI, VALUATION_DISCLAIMER_EN)}</p>
  </div>;
}

"""
replace_regex(
    DASHBOARD,
    r"function ValuationOverviewBox\(.*?\n\}\n\n(?=export default function BusinessDashboard)",
    new_overview,
)

# ---------------------------------------------------------------------------
# Styling.
# ---------------------------------------------------------------------------
append_once(
    VAL_CSS,
    "/* Asset-adjusted valuation v1 */",
    """/* Asset-adjusted valuation v1 */
.d68-val-asset-note{
  margin:0;
  padding:9px 11px;
  border-radius:10px;
  background:rgba(255,255,255,.08);
  color:#cfe0ef!important;
  font-size:12.5px;
  line-height:1.55;
}
.d68-val-asset-row small{line-height:1.45}
""",
)
append_once(
    AUTH_CSS,
    "/* Register asset-adjusted valuation inputs */",
    """/* Register asset-adjusted valuation inputs */
.d68-asset-valuation-inputs{
  display:grid;
  grid-template-columns:repeat(2,minmax(0,1fr));
  gap:16px;
  margin:16px 0;
}
.d68-asset-valuation-inputs .d68-auth-field{margin:0}
.d68-valuation-asset-notes{
  grid-column:1/-1;
  margin:12px 0 0;
  padding:12px 14px 12px 30px;
  border-radius:12px;
  background:#F8FAFC;
  color:#64748B;
  font-size:12.5px;
  line-height:1.55;
}
@media(max-width:700px){
  .d68-asset-valuation-inputs{grid-template-columns:1fr}
}
""",
)
replace_once(
    DASH_CSS,
    ".d68-dashboard-valuation-box--engine{grid-template-columns:1fr 1.4fr 1fr}",
    ".d68-dashboard-valuation-box--engine{grid-template-columns:repeat(3,minmax(0,1fr))}",
)

# ---------------------------------------------------------------------------
# Permanent static regression check.
# ---------------------------------------------------------------------------
qa = r"""import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const engine = read('src/lib/valuationEngine.ts');
const valuation = read('src/pages/Valuation.tsx');
const register = read('src/pages/Register.tsx');
const dashboard = read('src/pages/BusinessDashboard.tsx');
const businessDetail = read('src/pages/BusinessDetail.tsx');

const checks = [
  ['engine keeps earnings fallback', engine.includes("valuationMode: AssetValuationMode") && engine.includes("configuredMode: AssetValuationMode")],
  ['real estate uses 75% asset blend', engine.includes("valuation_mode: 'asset_blend', w_asset: 0.75")],
  ['hotel uses 50% asset blend', engine.includes("valuation_mode: 'asset_blend', w_asset: 0.50")],
  ['manufacturing uses asset floor', engine.includes("manufacturing: { ebitda: 6.0, revenue: 0.85, valuation_mode: 'asset_floor'")],
  ['agriculture uses asset floor', engine.includes("agriculture: { ebitda: 5.5, revenue: 0.90, valuation_mode: 'asset_floor'")],
  ['asset floor is greater-of, not additive', engine.includes('Math.max(equityOperating, assetReferenceEquity, 0)') && !engine.includes('evOperating + keyAssetValue')],
  ['asset reference cannot be negative', engine.includes('Math.max(keyAssetValue - netDebt, 0)')],
  ['public valuation has key asset input', valuation.includes("'Giá trị tài sản chính'") && valuation.includes('setKeyAssetValue')],
  ['public valuation shares currency state', valuation.includes('assetCurrency: currency')],
  ['register has both optional private inputs', register.includes('setKeyAssetValue') && register.includes('setNetDebt')],
  ['register stores benchmark asset_inputs', register.includes('asset_inputs: benchmarkAssetInputs') && register.includes('key_asset_value') && register.includes('net_debt')],
  ['dashboard is read-only for asset values', dashboard.includes("'Giá trị tài sản chính'") && dashboard.includes("'Giá trị nợ ròng'") && !dashboard.includes('name="key_asset_value"') && !dashboard.includes('name="net_debt"')],
  ['asset and debt are not added to public Business detail', !businessDetail.includes('key_asset_value') && !businessDetail.includes('net_debt')],
  ['net debt missing warning is present', engine.includes('Chưa nhập nợ ròng, hệ thống tạm tính nợ ròng = 0.')],
];

const failed = checks.filter(([, ok]) => !ok);
for (const [name, ok] of checks) console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`);
if (failed.length) {
  console.error(`Asset valuation QA failed: ${failed.map(([name]) => name).join(', ')}`);
  process.exit(1);
}
console.log(`Asset valuation QA passed: ${checks.length}/${checks.length}`);
"""
write(QA_FILE, qa)

package = json.loads(read(PACKAGE))
package.setdefault("scripts", {})["qa:asset-valuation"] = "node scripts/deals68-asset-valuation-v1-check.mjs"
write(PACKAGE, json.dumps(package, ensure_ascii=False, indent=2) + "\n")

# Remove temporary applicator and workflow in the final tested commit.
for temporary in [ROOT / "scripts/apply_asset_valuation_v1.py", ROOT / WORKFLOW]:
    if temporary.exists():
        temporary.unlink()

print("Asset-adjusted valuation v1 source patch applied.")
