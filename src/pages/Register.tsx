import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  createSignupBundle,
  uploadBusinessFile,
  uploadBusinessImage,
} from '../lib/data';
import {
  queuePendingBusinessSignupAssets,
  resumePendingBusinessSignupUploads,
} from '../lib/pendingBusinessUploads';
import { supabase } from '../lib/supabase';
import { slugify } from '../lib/format';
import {
  calculatePricing,
  lookupPromo,
  normaliseRole,
  roleLabel,
  type BusinessPlan,
  type PricingRole,
} from '../lib/pricing';
import { toLocalizedPath } from '../lib/i18nRoutes';
import type { Role } from '../lib/supabase';
import type { Lang } from '../lib/i18n';
import {
  T,
  countryOptions,
  industryOptions,
  businessDealOptions,
  phoneDialFromIso,
  industryKeyFromLabel,
  getLocationOptionsForCountry,
  locationKeyFromLabel,
  labelIndustry,
  labelInvestorType,
} from '../lib/labels';
import {
  DEFAULT_VALUATION_CONFIG,
  getActiveValuationConfig,
  valuate,
  formatValuationMoney,
  valuationVerdictMessage,
} from '../lib/valuationEngine';
import {
  BUSINESS_FEATURED_PROPOSAL_QUOTA,
  BUSINESS_STANDARD_PROPOSAL_QUOTA,
  businessProposalQuotaForPlan,
} from '../lib/businessPlans';
import { makePaymentOrderCode } from '../lib/paymentOrders';
import {
  IndustryTagPicker,
  InvestorDealTypeTagPicker,
} from '../components/investor/IndustryTagPicker';
import {
  InvestorMarketTagPicker,
  InvestorStageTagPicker,
  InvestorTypeTagPicker,
} from '../components/investor/InvestorCriteriaTagPickers';

const countryIso: Record<string, string> = Object.fromEntries(
  countryOptions
    .map((country) => [country.vi, country.iso2])
    .concat(countryOptions.map((country) => [country.en, country.iso2])),
);
const MAX_BUSINESS_IMAGES = 5;
const MAX_BUSINESS_DOCS = 5;
const DOC_EXTENSIONS = [
  '.pdf',
  '.doc',
  '.docx',
  '.ppt',
  '.pptx',
  '.xls',
  '.xlsx',
];
const STATIC_VIETQR_URL = '/assets/vietqr-vcb.png';

type PendingAsset = {
  id: string;
  file: File;
  displayName: string;
};

type ValuationCheck = {
  level: string;
  label: string;
  message: string;
  impliedValue: number | null;
  revenueMultiple: number | null;
  ebitdaMultiple: number | null;
  benchLow?: number | null;
  benchMid?: number | null;
  benchHigh?: number | null;
  method?: string;
  adjE?: number;
  adjR?: number;
  configVersion?: number;
};

function safeUsername(email: string, name: string) {
  return (email.split('@')[0] || slugify(name))
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '')
    .slice(0, 42);
}

function money(value: number, currency: string) {
  return currency === 'VND'
    ? `${Math.round(value).toLocaleString('vi-VN')} ₫`
    : `$${Math.round(value).toLocaleString('en-US')}`;
}

function splitNumberParts(value: any, allowDecimal = false) {
  const raw = String(value ?? '')
    .replace(/\s/g, '')
    .replace(/[^0-9,.-]/g, '');
  const negative = raw.startsWith('-') ? '-' : '';
  let body = raw.replace(/-/g, '');
  let decimal = '';
  let hasDecimal = false;

  if (allowDecimal) {
    const commaIndex = body.lastIndexOf(',');
    if (commaIndex >= 0) {
      hasDecimal = true;
      decimal = body
        .slice(commaIndex + 1)
        .replace(/\D/g, '')
        .slice(0, 2);
      body = body.slice(0, commaIndex);
    }
  }

  const integer = body.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
  return { negative, integer, decimal, hasDecimal };
}

function formatNumberTyping(value: any, allowDecimal = false) {
  const { negative, integer, decimal, hasDecimal } = splitNumberParts(
    value,
    allowDecimal,
  );
  if (!integer && !decimal) return '';
  const grouped = (integer || '0').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${negative}${grouped}${hasDecimal ? `,${decimal}` : ''}`;
}

function parseFormattedNumber(value: any, allowDecimal = false) {
  const { negative, integer, decimal } = splitNumberParts(
    value,
    allowDecimal,
  );
  if (!integer && !decimal) return 0;
  return (
    Number(
      `${negative}${integer || '0'}${
        allowDecimal && decimal ? `.${decimal}` : ''
      }`,
    ) || 0
  );
}

function formatBytes(size: number) {
  if (!Number.isFinite(size)) return '';
  if (size >= 1_048_576) return `${(size / 1_048_576).toFixed(1)} MB`;
  if (size >= 1024) return `${Math.round(size / 1024)} KB`;
  return `${size} B`;
}

function Field({
  label,
  children,
  wide = false,
  hint,
  spaced = false,
}: {
  label: string;
  children: any;
  wide?: boolean;
  hint?: string;
  spaced?: boolean;
}) {
  return (
    <label
      className={`d68-auth-field${
        wide ? ' d68-auth-field--wide' : ''
      }${spaced ? ' d68-auth-field--spaced' : ''}`}
    >
      <span>{label}</span>
      {children}
      {hint ? <small>{hint}</small> : null}
    </label>
  );
}

function assetId(file: File) {
  return `${file.name}-${file.size}-${file.lastModified}-${Math.random()
    .toString(36)
    .slice(2)}`;
}

function isBusinessDoc(file: File) {
  const lower = file.name.toLowerCase();
  return DOC_EXTENSIONS.some((extension) => lower.endsWith(extension));
}

function planText(plan: BusinessPlan, lang: Lang) {
  return plan === 'featured'
    ? T(lang, 'Ưu tiên', 'Priority')
    : T(lang, 'Thường', 'Standard');
}

function RowMini({
  a,
  b,
  good = false,
}: {
  a: string;
  b: string;
  good?: boolean;
}) {
  return (
    <div className={good ? 'good' : ''}>
      <span>{a}</span>
      <b>{b}</b>
    </div>
  );
}

export default function Register({ lang = 'vi' }: { lang?: Lang }) {
  const { role = 'business' } = useParams();
  const normalized = normaliseRole(role);
  const accountRole = (
    normalized === 'affiliate' ? 'affiliate' : normalized
  ) as Role;
  const { signUp, signOut } = useAuth();
  const navigate = useNavigate();
  const intent = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('d68_checkout_intent') || '{}');
    } catch {
      return {};
    }
  }, []);
  const checkoutIntentCreatedAt = Date.parse(String(intent.createdAt || ''));
  const checkoutIntentAge = Date.now() - checkoutIntentCreatedAt;
  const checkoutIntentMatchesRole =
    String(intent.role || intent.internalRole || '') === normalized &&
    Number.isFinite(checkoutIntentCreatedAt) &&
    checkoutIntentAge >= 0 &&
    checkoutIntentAge <= 30 * 60 * 1000;

  const [plan, setPlan] = useState<BusinessPlan | ''>(() =>
    checkoutIntentMatchesRole &&
    (intent.businessPlan === 'featured' || intent.businessPlan === 'standard')
      ? (intent.businessPlan as BusinessPlan)
      : '',
  );
  const [investorPackageSelected, setInvestorPackageSelected] =
    useState<boolean>(
      () => checkoutIntentMatchesRole && normalized === 'investor',
    );
  const [serviceWeeks, setServiceWeeks] = useState<number>(
    Number(intent.termWeeks || intent.units || 16),
  );
  const [investorMonths, setInvestorMonths] = useState<number>(
    Number(
      intent.units ||
        (intent.termWeeks
          ? Math.max(1, Math.round(Number(intent.termWeeks) / 4))
          : 12),
    ),
  );
  const [promoCode, setPromoCode] = useState(String(intent.promoCode || ''));
  const [promoPct, setPromoPct] = useState<number>(
    Number(intent.price?.promoDiscountPct || 0),
  );
  const [promoMsg, setPromoMsg] = useState('');
  const [promoLoading, setPromoLoading] = useState(false);
  const [paymentAck, setPaymentAck] = useState(false);
  const [msgType, setMsgType] = useState<'ok' | 'err' | ''>('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [country, setCountry] = useState(
    intent.country === 'GLOBAL' ? 'Singapore' : 'Việt Nam',
  );
  const [industry, setIndustry] = useState('Thực phẩm & Đồ uống (F&B)');
  const [city, setCity] = useState('TP. Hồ Chí Minh');
  const [companyName, setCompanyName] = useState('');
  const [highlights, setHighlights] = useState('');
  const [dealType, setDealType] = useState('Gọi vốn');
  const [revenueMonth, setRevenueMonth] = useState('');
  const [revenue, setRevenue] = useState('');
  const [ebitda, setEbitda] = useState('');
  const [growthPct, setGrowthPct] = useState('');
  const [ask, setAsk] = useState('');
  const [stake, setStake] = useState('');
  const [reason, setReason] = useState('');
  const [assetsOwned, setAssetsOwned] = useState('');
  const [excludedAssetValue, setExcludedAssetValue] = useState('');
  const [financialSource, setFinancialSource] = useState(
    'management_accounts',
  );
  const [businessImages, setBusinessImages] = useState<PendingAsset[]>([]);
  const [businessDocs, setBusinessDocs] = useState<PendingAsset[]>([]);

  const [investorTypes, setInvestorTypes] = useState<string[]>([
    'Individual/Angel',
  ]);
  const [selectedIndustries, setSelectedIndustries] = useState<string[]>([
    'food_beverage',
    'it_software',
  ]);
  const [investorStages, setInvestorStages] = useState<string[]>(['Growth']);
  const [investorDealTypes, setInvestorDealTypes] = useState<string[]>([
    'Investment',
  ]);
  const [preferredCountries, setPreferredCountries] = useState<string[]>([
    'VN',
  ]);
  const [ticketMin, setTicketMin] = useState(
    formatNumberTyping('100000'),
  );
  const [ticketMax, setTicketMax] = useState(
    formatNumberTyping('5000000'),
  );
  const [generalDesc, setGeneralDesc] = useState('');
  const [appetiteDesc, setAppetiteDesc] = useState('');
  const [phoneIso, setPhoneIso] = useState('VN');
  const [phone, setPhone] = useState('');
  const [website, setWebsite] = useState('');
  const [agree, setAgree] = useState(false);
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [valuationConfig, setValuationConfig] = useState(
    DEFAULT_VALUATION_CONFIG,
  );

  useEffect(() => {
    getActiveValuationConfig()
      .then(setValuationConfig)
      .catch(() => setValuationConfig(DEFAULT_VALUATION_CONFIG));
  }, []);

  const isBusiness = normalized === 'business';
  const isInvestor = normalized === 'investor';
  const [registrationOrderCode] = useState(() =>
    makePaymentOrderCode(
      isInvestor ? 'INVREG' : isBusiness ? 'BIZREG' : 'PARTNER',
    ),
  );
  const countryCode = countryIso[country] || 'VN';
  const locationChoices = getLocationOptionsForCountry(countryCode);
  const effectiveWeeks = isBusiness ? serviceWeeks : investorMonths * 4;
  const pricingRole = (
    isInvestor ? 'investor' : isBusiness ? 'business' : normalized
  ) as PricingRole;
  const selectedBusinessPlan: BusinessPlan = plan || 'standard';
  const hasSelectedPackage = isBusiness
    ? Boolean(plan)
    : isInvestor
      ? investorPackageSelected
      : true;

  useEffect(() => {
    const options = getLocationOptionsForCountry(countryCode);
    if (
      isBusiness &&
      options.length &&
      !options.some(
        (option) =>
          option.vi === city || option.en === city || option.key === city,
      )
    ) {
      setCity(lang === 'en' ? options[0].en : options[0].vi);
    }
  }, [countryCode, isBusiness, lang, city]);

  const price = calculatePricing(
    {
      role: pricingRole,
      country: countryCode,
      termWeeks: effectiveWeeks,
      businessPlan: selectedBusinessPlan,
      promoCode,
    },
    promoPct,
  );
  const pricingSummary = hasSelectedPackage
    ? isInvestor
      ? `${money(price.total, price.currency)} · ${investorMonths} ${T(
          lang,
          'tháng',
          'months',
        )}`
      : `${money(price.total, price.currency)} · ${price.termWeeks} ${T(
          lang,
          'tuần',
          'weeks',
        )}`
    : '-';
  const termOptions = [4, 8, 12, 16, 24];
  const currentTermValue = isInvestor ? investorMonths : serviceWeeks;
  const termUnitLabel = isInvestor
    ? T(lang, 'tháng', 'months')
    : T(lang, 'tuần', 'weeks');
  const bankContent = registrationOrderCode;
  const qrAmountParam =
    hasSelectedPackage && price.currency === 'VND'
      ? `amount=${Math.round(price.total)}&`
      : '';
  const qrUrl = `https://img.vietqr.io/image/VCB-0011004000713-compact2.png?${qrAmountParam}addInfo=${encodeURIComponent(
    bankContent,
  )}&accountName=${encodeURIComponent('Tieu Vo Dinh Phi')}`;
  const [qrImageSrc, setQrImageSrc] = useState(qrUrl);

  useEffect(() => {
    setQrImageSrc(qrUrl);
  }, [qrUrl]);

  const benchmarkResult = useMemo(
    () =>
      valuate(
        {
          revenueYear: parseFormattedNumber(revenue),
          revenueMonth: parseFormattedNumber(revenueMonth),
          ebitdaMargin: parseFormattedNumber(ebitda, true),
          growthPct: parseFormattedNumber(growthPct, true),
          industryKey: industryKeyFromLabel(industry),
          industry,
          countryKey: countryCode,
          currency: countryCode === 'VN' ? 'VND' : 'USD',
          offerAmount: parseFormattedNumber(ask),
          offerStakePct: parseFormattedNumber(stake, true),
        },
        valuationConfig,
      ),
    [
      ask,
      countryCode,
      ebitda,
      growthPct,
      industry,
      revenue,
      revenueMonth,
      stake,
      valuationConfig,
    ],
  );

  const valuationCheck: ValuationCheck = useMemo(() => {
    if (!benchmarkResult) {
      return {
        level: 'pending',
        label: T(lang, 'Chưa đủ dữ liệu', 'Need more inputs'),
        message: T(
          lang,
          'Cần nhập doanh thu tháng/năm và ngành để hệ thống tính định giá tham chiếu.',
          'Annual/monthly revenue and industry are required for the benchmark.',
        ),
        impliedValue: null,
        revenueMultiple: null,
        ebitdaMultiple: null,
      };
    }

    const revenueYear = benchmarkResult.revenueYear;
    const ebitdaAmount = benchmarkResult.ebitda;
    const impliedValue = benchmarkResult.self || null;
    const revenueMultiple =
      impliedValue && revenueYear > 0 ? impliedValue / revenueYear : null;
    const ebitdaMultiple =
      impliedValue && ebitdaAmount > 0 ? impliedValue / ebitdaAmount : null;
    const level =
      benchmarkResult.verdict === 'above'
        ? 'high'
        : benchmarkResult.verdict === 'low_of'
          ? 'low'
          : benchmarkResult.verdict === 'in_range'
            ? 'balanced'
            : 'pending';
    const label =
      benchmarkResult.verdict === 'above'
        ? T(lang, 'Cao hơn tham chiếu', 'Above benchmark')
        : benchmarkResult.verdict === 'low_of'
          ? T(lang, 'Thấp hơn tham chiếu', 'Below benchmark')
          : benchmarkResult.verdict === 'in_range'
            ? T(lang, 'Trong khoảng tham chiếu', 'Within benchmark')
            : T(lang, 'Định giá tham chiếu', 'Benchmark valuation');

    return {
      level,
      label,
      message: valuationVerdictMessage(lang, benchmarkResult),
      impliedValue,
      revenueMultiple,
      ebitdaMultiple,
      benchLow: benchmarkResult.low,
      benchMid: benchmarkResult.mid,
      benchHigh: benchmarkResult.high,
      method: benchmarkResult.method,
      adjE: benchmarkResult.adjE,
      adjR: benchmarkResult.adjR,
      configVersion: benchmarkResult.configVersion,
    };
  }, [benchmarkResult, lang]);

  function addImages(files: FileList | null) {
    const incoming = Array.from(files || [])
      .filter((file) => file.type.startsWith('image/'))
      .slice(0, Math.max(0, MAX_BUSINESS_IMAGES - businessImages.length));
    if (!incoming.length) return;
    setBusinessImages((current) => [
      ...current,
      ...incoming.map((file) => ({
        id: assetId(file),
        file,
        displayName: file.name.replace(/\.[^.]+$/, ''),
      })),
    ]);
  }

  function addDocs(files: FileList | null) {
    const incoming = Array.from(files || [])
      .filter(isBusinessDoc)
      .slice(0, Math.max(0, MAX_BUSINESS_DOCS - businessDocs.length));
    if (!incoming.length) return;
    setBusinessDocs((current) => [
      ...current,
      ...incoming.map((file) => ({
        id: assetId(file),
        file,
        displayName: file.name.replace(/\.[^.]+$/, ''),
      })),
    ]);
  }

  function updateAssetName(
    kind: 'image' | 'doc',
    id: string,
    displayName: string,
  ) {
    const setter = kind === 'image' ? setBusinessImages : setBusinessDocs;
    setter((current) =>
      current.map((asset) =>
        asset.id === id ? { ...asset, displayName } : asset,
      ),
    );
  }

  function removeAsset(kind: 'image' | 'doc', id: string) {
    const setter = kind === 'image' ? setBusinessImages : setBusinessDocs;
    setter((current) => current.filter((asset) => asset.id !== id));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setMsgType('');
    const missing: string[] = [];

    if (!email.trim()) missing.push(T(lang, 'Email đăng nhập', 'Login email'));
    if (password.length < 8) {
      missing.push(
        T(
          lang,
          'Mật khẩu tối thiểu 8 ký tự',
          'Password min. 8 characters',
        ),
      );
    }
    if (!name.trim()) {
      missing.push(T(lang, 'Tên người phụ trách', 'Contact name'));
    }

    if (isBusiness) {
      if (!companyName.trim()) {
        missing.push(T(lang, 'Tên doanh nghiệp', 'Business name'));
      }
      if (!city.trim()) missing.push(T(lang, 'Tỉnh/Thành phố', 'Province/City'));
      if (!industry.trim()) missing.push(T(lang, 'Ngành', 'Industry'));
      if (!revenue.trim() && !revenueMonth.trim()) {
        missing.push(
          T(
            lang,
            'Doanh thu năm gần nhất hoặc doanh thu tháng',
            'Latest annual revenue or monthly revenue',
          ),
        );
      }
      if (!ebitda.trim()) {
        missing.push(
          T(
            lang,
            'Tỷ suất lợi nhuận/EBITDA (%)',
            'EBITDA margin (%)',
          ),
        );
      }
      if (!ask.trim()) {
        missing.push(
          T(
            lang,
            'Số tiền gọi vốn / giá trị giao dịch mong muốn',
            'Capital sought / desired transaction value',
          ),
        );
      }
      if (!stake.trim()) {
        missing.push(T(lang, 'Tỷ lệ cổ phần', 'Stake percentage'));
      }
      if (!plan) {
        missing.push(T(lang, 'Gói dịch vụ', 'Service package'));
      } else if (!paymentAck) {
        missing.push(
          T(
            lang,
            'Xác nhận đã chuyển khoản đúng nội dung',
            'Payment transfer confirmation',
          ),
        );
      }
    }

    if (isInvestor) {
      if (!investorTypes.length) {
        missing.push(
          T(lang, 'Loại hình nhà đầu tư', 'Investor type'),
        );
      }
      if (!investorStages.length) {
        missing.push(T(lang, 'Giai đoạn phù hợp', 'Preferred stages'));
      }
      if (!selectedIndustries.length) {
        missing.push(T(lang, 'Ngành quan tâm', 'Preferred industries'));
      }
      if (!investorDealTypes.length) {
        missing.push(
          T(lang, 'Loại giao dịch quan tâm', 'Interested deal types'),
        );
      }
      if (!preferredCountries.length) {
        missing.push(
          T(lang, 'Thị trường quan tâm', 'Investment markets'),
        );
      }
      if (!generalDesc.trim()) {
        missing.push(T(lang, 'Giới thiệu chung', 'General introduction'));
      }
      if (!appetiteDesc.trim()) {
        missing.push(T(lang, 'Khẩu vị đầu tư', 'Investment appetite'));
      }
      if (!ticketMin.trim() || !ticketMax.trim()) {
        missing.push(T(lang, 'Khoản đầu tư/ticket size', 'Ticket size'));
      }
      if (!investorPackageSelected) {
        missing.push(T(lang, 'Gói dịch vụ', 'Service package'));
      } else if (!paymentAck) {
        missing.push(
          T(
            lang,
            'Xác nhận đã chuyển khoản đúng nội dung',
            'Payment transfer confirmation',
          ),
        );
      }
    }

    if (!agree) {
      missing.push(
        T(
          lang,
          'Đồng ý Điều khoản & Chính sách bảo mật',
          'Agree to Terms & Privacy Policy',
        ),
      );
    }

    if (missing.length) {
      setMsgType('err');
      setMsg(
        T(
          lang,
          `Anh/Chị chưa điền/nhập thông tin: ${missing.join(', ')}. Vui lòng kiểm tra.`,
          `Missing/invalid fields: ${missing.join(', ')}. Please check again.`,
        ),
      );
      return;
    }

    setLoading(true);
    setMsg('');

    if (isInvestor) {
      let duplicateVisible = false;
      try {
        const duplicateResult: any = await (
          supabase.rpc('investor_public_email_exists', {
            email_text: email.trim(),
          }) as any
        );
        duplicateVisible = !!duplicateResult?.data;
      } catch {
        duplicateVisible = false;
      }

      if (duplicateVisible) {
        setMsgType('err');
        setMsg(
          T(
            lang,
            'Email đã được đăng ký, vui lòng liên hệ partner@vietcapitalpartners.com để được hỗ trợ.',
            'This email has already been registered. Please contact partner@vietcapitalpartners.com for support.',
          ),
        );
        setLoading(false);
        return;
      }
    }

    const realName = name || companyName || email;
    const username = safeUsername(email, realName);
    const signupNonce =
      typeof globalThis.crypto?.randomUUID === 'function'
        ? globalThis.crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random()
            .toString(36)
            .slice(2)}`;
    const signupResult = await signUp(accountRole, email.trim(), password, {
      username,
      display_name: realName,
      country_iso2: countryCode,
      language_code: lang,
      signup_nonce: signupNonce,
    });

    if (signupResult.error || !signupResult.user) {
      setMsgType('err');
      setMsg(
        signupResult.error ||
          T(lang, 'Không thể tạo tài khoản', 'Could not create account'),
      );
      setLoading(false);
      return;
    }

    try {
      const profilePayload = {
        username,
        display_name: realName,
        country_iso2: countryCode,
        language_code: lang,
        timezone: 'Asia/Ho_Chi_Minh',
        phone_country_iso2: phoneIso,
        phone: `${phoneDialFromIso(phoneIso)} ${phone}`.trim(),
      };

      let businessPayload: any = null;
      let investorPayload: any = null;

      if (isBusiness) {
        const titleVi = `${dealType} · ${industry} · ${city}`;
        const revenueCurrency = countryCode === 'VN' ? 'VND' : 'USD';
        const uploadPlan = {
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

        businessPayload = {
          username,
          slug: `${slugify(titleVi || realName)}-${Date.now().toString(36)}`,
          company_name_private: companyName || realName,
          title_vi: titleVi,
          title_en: '',
          description_vi: '',
          description_en: '',
          country_iso2: countryCode,
          city,
          city_key: locationKeyFromLabel(city, countryCode),
          industry,
          industry_key: industryKeyFromLabel(industry),
          deal_type: dealType,
          plan: selectedBusinessPlan,
          revenue_month: parseFormattedNumber(revenueMonth),
          revenue_2025:
            parseFormattedNumber(revenue) ||
            parseFormattedNumber(revenueMonth) * 12,
          revenue_currency: revenueCurrency,
          ebitda_margin: parseFormattedNumber(ebitda, true),
          growth_pct: parseFormattedNumber(growthPct, true),
          ask_amount: parseFormattedNumber(ask),
          ask_currency: revenueCurrency,
          stake_pct: parseFormattedNumber(stake, true),
          offer_amount: parseFormattedNumber(ask),
          offer_stake_pct: parseFormattedNumber(stake, true),
          self_valuation: benchmarkResult?.self || null,
          bench_low: benchmarkResult?.low || null,
          bench_mid: benchmarkResult?.mid || null,
          bench_high: benchmarkResult?.high || null,
          bench_verdict: benchmarkResult?.verdict || null,
          bench_config_version: benchmarkResult?.configVersion || null,
          bench_calculated_at: benchmarkResult
            ? new Date().toISOString()
            : null,
          quota_total: businessProposalQuotaForPlan(selectedBusinessPlan),
          highlights_vi: highlights,
          highlights_en: '',
          investment_reason_vi: reason,
          investment_reason_en: '',
          financial_input: {
            city_key: locationKeyFromLabel(city, countryCode),
            assets_owned: assetsOwned,
            excluded_physical_asset_value:
              parseFormattedNumber(excludedAssetValue),
            financial_source: financialSource,
            valuation_check: valuationCheck,
            benchmark: benchmarkResult,
            revenue_month: parseFormattedNumber(revenueMonth),
            growth_pct: parseFormattedNumber(growthPct, true),
            upload_plan: uploadPlan,
          },
          valuation_reasonableness: valuationCheck.level,
          data_confidence:
            [
              revenue,
              ebitda,
              ask,
              stake,
              highlights,
              reason,
              financialSource,
              assetsOwned,
            ].filter((value) => String(value || '').trim()).length * 8,
          quality_score: 0,
        };
      } else if (isInvestor) {
        const countryName =
          countryOptions.find((item) => item.iso2 === countryCode)?.en ||
          country;
        const typeVi = investorTypes
          .map((value) => labelInvestorType(value, 'vi'))
          .join(' / ');
        const typeEn = investorTypes
          .map((value) => labelInvestorType(value, 'en'))
          .join(' / ');
        const industriesVi = selectedIndustries
          .map((value) => labelIndustry(value, 'vi'))
          .join(', ');
        const industriesEn = selectedIndustries
          .map((value) => labelIndustry(value, 'en'))
          .join(', ');

        investorPayload = {
          username,
          title_vi: `${typeVi} quan tâm ${industriesVi}`,
          title_en: `${typeEn} interested in ${industriesEn}`,
          desc_vi: lang === 'vi' ? generalDesc : '',
          desc_en: lang === 'en' ? generalDesc : '',
          country_iso2: countryCode,
          country: countryName,
          region: countryCode === 'VN' ? 'asia' : 'global',
          industries: selectedIndustries,
          deal_types: investorDealTypes,
          ticket_min: parseFormattedNumber(ticketMin),
          ticket_max: parseFormattedNumber(ticketMax),
          type: investorTypes[0],
          stage: investorStages[0],
          criteria: {
            investorTypes,
            stages: investorStages,
            sectors: selectedIndustries,
            dealTypes: investorDealTypes,
            targetCountries: preferredCountries,
            preferredCountries,
            targetCountriesCache: preferredCountries,
            investment_appetite_vi: lang === 'vi' ? appetiteDesc : '',
            investment_appetite_en: lang === 'en' ? appetiteDesc : '',
          },
          privacy: {
            shareEmail: false,
            email,
            sharePhone: false,
            phone: `${phoneDialFromIso(phoneIso)} ${phone}`.trim(),
            website,
            preferredCountries,
          },
        };
      }

      const bundle = await createSignupBundle({
        userId: signupResult.user.id,
        email: email.trim(),
        signupNonce,
        role: isInvestor
          ? 'investor'
          : isBusiness
            ? 'business'
            : 'affiliate',
        profile: profilePayload,
        business: businessPayload,
        investor: investorPayload,
        payment: {
          title: `${roleLabel(normalized as any, lang)} · ${pricingSummary}`,
          role: normalized,
          country: countryCode,
          plan: isBusiness ? selectedBusinessPlan : 'membership',
          checkout_intent: intent,
          price,
          orderCode: registrationOrderCode,
          bankContent: registrationOrderCode,
          source: 'register_main_release_safe',
        },
      });

      let uploadNote = '';
      if (
        isBusiness &&
        bundle?.business_id &&
        (businessImages.length || businessDocs.length)
      ) {
        try {
          const queuedCount = await queuePendingBusinessSignupAssets({
            userId: signupResult.user.id,
            businessId: bundle.business_id,
            images: businessImages,
            files: businessDocs,
          });
          const { data: sessionData } = await supabase.auth.getSession();

          if (sessionData?.session) {
            const upload = await resumePendingBusinessSignupUploads(
              signupResult.user.id,
            );
            uploadNote = upload.errors.length
              ? T(
                  lang,
                  ` Đã upload ${upload.uploadedImages} ảnh và ${upload.uploadedFiles} file; còn ${upload.remaining} file chờ thử lại.`,
                  ` Uploaded ${upload.uploadedImages} images and ${upload.uploadedFiles} files; ${upload.remaining} item(s) remain for retry.`,
                )
              : T(
                  lang,
                  ` Đã upload ${upload.uploadedImages} ảnh và ${upload.uploadedFiles} file hồ sơ.`,
                  ` Uploaded ${upload.uploadedImages} images and ${upload.uploadedFiles} profile files.`,
                );
          } else {
            uploadNote = T(
              lang,
              ` ${queuedCount} ảnh/file đã được lưu tạm an toàn trên trình duyệt. Vui lòng xác thực OTP trên cùng thiết bị và trình duyệt; hệ thống sẽ tự upload trước khi vào Dashboard.`,
              ` ${queuedCount} image/file item(s) were safely queued in this browser. Verify OTP on the same device and browser; the system will upload them automatically before opening the Dashboard.`,
            );
          }
        } catch (uploadError: any) {
          uploadNote = T(
            lang,
            ` Tài khoản đã tạo nhưng trình duyệt không thể giữ ảnh/file chờ OTP: ${
              uploadError?.message || 'unknown error'
            }. Vui lòng upload lại trong Dashboard.`,
            ` Account created, but the browser could not preserve files before OTP: ${
              uploadError?.message || 'unknown error'
            }. Please upload them again in the Dashboard.`,
          );
        }
      }

      setMsgType('ok');
      const successBase = isInvestor
        ? T(
            lang,
            'Anh/Chị đã tạo tài khoản Nhà đầu tư thành công. Hệ thống đã gửi mã OTP đến email. Sau vài giây, hệ thống sẽ chuyển sang trang đăng nhập để xác thực OTP.',
            'Your investor account has been created successfully. An OTP has been sent to your email. The system will redirect to login for OTP verification shortly.',
          )
        : T(
            lang,
            'Anh/Chị đã tạo tài khoản Doanh nghiệp thành công. Hệ thống đã gửi mã OTP đến email. Sau vài giây, hệ thống sẽ chuyển sang trang đăng nhập để xác thực OTP.',
            'Your business account has been created successfully. An OTP has been sent to your email. The system will redirect to login for OTP verification shortly.',
          );
      const spamNote = T(
        lang,
        'Hãy kiểm tra cả hòm thư Spam/Quảng cáo nếu email OTP không vào trực tiếp Inbox.',
        'Please also check your Spam/Promotions folder if the OTP email does not arrive in your Inbox.',
      );
      setMsg(`${successBase} ${spamNote}${uploadNote}`);
      await signOut().catch(() => undefined);
      const loginRole = isInvestor
        ? 'investor'
        : isBusiness
          ? 'business'
          : 'affiliate';
      const nextPath = isInvestor
        ? '/dashboard/investor'
        : isBusiness
          ? '/dashboard/business'
          : '/dashboard/market-partner';
      const loginPath = `/login?role=${loginRole}&email=${encodeURIComponent(
        email.trim(),
      )}&otp=1&signup=1&next=${encodeURIComponent(nextPath)}`;
      setTimeout(
        () => navigate(toLocalizedPath(loginPath, lang), { replace: true }),
        10_000,
      );
    } catch (submitError: any) {
      setMsgType('err');
      setMsg(
        submitError?.message ||
          T(
            lang,
            'Tài khoản đã tạo, nhưng hồ sơ/đơn thanh toán cần Admin kiểm tra lại.',
            'Account created, but profile/payment order needs Admin review.',
          ),
      );
    } finally {
      setLoading(false);
    }
  }

  const currentCurrency = countryCode === 'VN' ? 'VND' : 'USD';
  const paymentSection = (
    <section
      className={`d68-register-section d68-register-section--pricing${
        isBusiness
          ? ' d68-register-section--business-pricing'
          : isInvestor
            ? ' d68-register-section--investor-pricing'
            : ''
      }`}
    >
      <h2>{T(lang, 'Gói dịch vụ và Thanh toán', 'Service package and Payment')}</h2>
      <div className="d68-bizreg-options">
        {isBusiness ? (
          ([
            {
              key: 'standard' as BusinessPlan,
              title: T(lang, 'Gói Thường', 'Regular package'),
              desc: T(
                lang,
                `Hiển thị tại danh sách và gửi Hồ sơ doanh nghiệp tới tối đa ${BUSINESS_STANDARD_PROPOSAL_QUOTA} nhà đầu tư`,
                `Display in the listing and send your business profile to up to ${BUSINESS_STANDARD_PROPOSAL_QUOTA} investors`,
              ),
              badge: T(
                lang,
                `${BUSINESS_STANDARD_PROPOSAL_QUOTA} lượt gửi Hồ sơ doanh nghiệp`,
                `${BUSINESS_STANDARD_PROPOSAL_QUOTA} business profile sends`,
              ),
            },
            {
              key: 'featured' as BusinessPlan,
              title: T(lang, 'Gói Ưu tiên ★', 'Priority package ★'),
              desc: T(
                lang,
                `Hiển thị tại danh sách/trang chủ và gửi Hồ sơ doanh nghiệp tới tối đa ${BUSINESS_FEATURED_PROPOSAL_QUOTA} nhà đầu tư`,
                `Display in the listing/homepage and send your business profile to up to ${BUSINESS_FEATURED_PROPOSAL_QUOTA} investors`,
              ),
              badge: T(
                lang,
                `${BUSINESS_FEATURED_PROPOSAL_QUOTA} lượt gửi Hồ sơ doanh nghiệp`,
                `${BUSINESS_FEATURED_PROPOSAL_QUOTA} business profile sends`,
              ),
            },
          ] as const).map((item) => (
            <button
              key={item.key}
              type="button"
              className={plan === item.key ? 'active' : ''}
              onClick={() => {
                setPlan(item.key);
                setPaymentAck(false);
              }}
            >
              <h3>{item.title}</h3>
              <p>{item.desc}</p>
              <span>{item.badge}</span>
              {item.key === 'featured' ? (
                <em>+30% {T(lang, 'so với gói Thường', 'vs Standard')}</em>
              ) : null}
            </button>
          ))
        ) : (
          <>
            <button
              type="button"
              className={investorPackageSelected ? 'active' : ''}
              onClick={() => {
                setInvestorPackageSelected(true);
                setPaymentAck(false);
              }}
            >
              <h3>{T(lang, 'Gói Nhà đầu tư', 'Investor membership')}</h3>
              <p>
                {T(
                  lang,
                  'Tìm kiếm, lưu doanh nghiệp, gửi yêu cầu kết nối/data và nhận gợi ý thương vụ phù hợp.',
                  'Search, save businesses, request connection/data and receive matched opportunities.',
                )}
              </p>
              <span>{T(lang, 'Đã gồm Dashboard Nhà đầu tư', 'Investor dashboard included')}</span>
            </button>
            <button type="button" disabled>
              <h3>{T(lang, 'Gói Tổ chức / Ưu tiên', 'Institutional / Priority')}</h3>
              <p>
                {T(
                  lang,
                  'Dành cho quỹ/tổ chức cần thêm quy trình nhóm, phân quyền và hỗ trợ riêng.',
                  'For funds/institutions requiring team workflow, permissions and dedicated support.',
                )}
              </p>
              <span>{T(lang, 'Sắp ra mắt', 'Coming soon')}</span>
            </button>
          </>
        )}
      </div>

      <div className="d68-bizreg-paygrid">
        <div className="d68-bizreg-payleft">
          <label className="d68-bizreg-label">
            {T(lang, 'Kỳ hạn', 'Term')} <small>({termUnitLabel})</small>
          </label>
          <div className="d68-bizreg-terms">
            {termOptions.map((term) => {
              const termWeeks = isInvestor ? term * 4 : term;
              const temporary = calculatePricing(
                {
                  role: pricingRole,
                  country: countryCode,
                  termWeeks,
                  businessPlan: selectedBusinessPlan,
                  promoCode,
                },
                promoPct,
              );
              return (
                <button
                  type="button"
                  key={term}
                  className={currentTermValue === term ? 'active' : ''}
                  onClick={() => {
                    if (isInvestor) setInvestorMonths(term);
                    else setServiceWeeks(term);
                    setPaymentAck(false);
                  }}
                >
                  <b>{term}</b>
                  {temporary.termDiscountPct ? (
                    <span>-{temporary.termDiscountPct}%</span>
                  ) : null}
                </button>
              );
            })}
          </div>
          <label className="d68-bizreg-label">
            {T(lang, 'Mã khuyến mãi/giới thiệu', 'Promo/referral code')}
          </label>
          <div className="d68-bizreg-promo">
            <input
              value={promoCode}
              onChange={(event) =>
                setPromoCode(event.target.value.toUpperCase())
              }
              placeholder="DEALS68"
            />
            <button
              type="button"
              disabled={promoLoading}
              onClick={async () => {
                setPromoLoading(true);
                const result = await lookupPromo(promoCode, pricingRole).catch(
                  (promoError: any) => ({
                    discountPct: 0,
                    message:
                      promoError?.message || 'Could not check promo.',
                  }),
                );
                setPromoLoading(false);
                setPromoPct(Number(result.discountPct || 0));
                setPromoMsg(
                  result.discountPct
                    ? T(
                        lang,
                        'Mã hợp lệ, đã cập nhật số tiền giảm giá',
                        'Valid code, discount amount updated',
                      )
                    : result.message ||
                        T(lang, 'Mã không hợp lệ.', 'Invalid code.'),
                );
              }}
            >
              {promoLoading ? '...' : T(lang, 'Áp dụng', 'Apply')}
            </button>
          </div>
          {promoMsg ? (
            <p
              className={
                promoPct
                  ? 'd68-bizreg-promo-ok'
                  : 'd68-bizreg-promo-warn'
              }
            >
              {promoMsg}
            </p>
          ) : null}
        </div>

        <aside className="d68-bizreg-summary">
          <span>{T(lang, 'Tạm tính', 'Estimate')}</span>
          <RowMini
            a={T(
              lang,
              `Phí dịch vụ (${currentTermValue} ${
                isInvestor ? 'tháng' : 'tuần'
              })`,
              `Service fee (${currentTermValue} ${
                isInvestor ? 'months' : 'weeks'
              })`,
            )}
            b={hasSelectedPackage ? money(price.subtotal, price.currency) : '-'}
          />
          <RowMini
            a={T(lang, 'Chiết khấu kỳ hạn', 'Term discount')}
            b={
              hasSelectedPackage
                ? price.termDiscountPct
                  ? `-${money(price.termDiscount, price.currency)} (${price.termDiscountPct}%)`
                  : T(lang, 'Không', 'None')
                : '-'
            }
            good={hasSelectedPackage && !!price.termDiscountPct}
          />
          <RowMini
            a={T(lang, 'Giảm giá', 'Promo discount')}
            b={
              hasSelectedPackage
                ? price.promoDiscountPct
                  ? `-${money(price.promoDiscount, price.currency)} (${price.promoDiscountPct}%)`
                  : T(lang, 'Không', 'None')
                : '-'
            }
            good={hasSelectedPackage && !!price.promoDiscountPct}
          />
          <strong>
            {T(lang, 'Tổng thanh toán', 'Total due')}
            <b>{hasSelectedPackage ? money(price.total, price.currency) : '-'}</b>
          </strong>
        </aside>
      </div>

      <div className="d68-bizreg-payment-methods d68-bizreg-payment-methods--primary">
        <button type="button" className="active">
          <span>💵</span>
          {T(lang, 'Chuyển khoản QR', 'QR bank transfer')}
        </button>
      </div>

      {hasSelectedPackage ? (
        <div className="d68-bizreg-qrbox">
          <a href={qrImageSrc} target="_blank" rel="noreferrer">
            <img
              src={qrImageSrc}
              alt="QR Vietcombank"
              onError={() => setQrImageSrc(STATIC_VIETQR_URL)}
            />
          </a>
          <div>
            <p>{T(lang, 'Người nhận:', 'Recipient:')} <b>Tieu Vo Dinh Phi</b></p>
            <p>{T(lang, 'Số TK:', 'Account no.:')} <b>0011004000713</b></p>
            <p>{T(lang, 'Nội dung:', 'Transfer note:')} <b>{bankContent}</b></p>
            <p>{T(lang, 'Số tiền:', 'Amount:')} <b>{money(price.total, price.currency)}</b></p>
          </div>
          <label>
            <input
              type="checkbox"
              checked={paymentAck}
              onChange={(event) => setPaymentAck(event.target.checked)}
            />{' '}
            {T(
              lang,
              'Tôi đã chuyển khoản đúng số tiền và nội dung ở trên',
              'I have transferred the exact amount with the transfer note above',
            )}
          </label>
        </div>
      ) : (
        <div className="d68-bizreg-package-pending" role="status">
          <b>{T(lang, 'Vui lòng chọn gói dịch vụ', 'Please select a service package')}</b>
          <span>
            {T(
              lang,
              'Số tiền và thông tin thanh toán sẽ hiển thị sau khi chọn gói.',
              'The amount and payment information will appear after a package is selected.',
            )}
          </span>
        </div>
      )}

      <div className="d68-bizreg-payment-methods d68-bizreg-payment-methods--secondary">
        <button type="button" disabled>
          <span>💳</span>
          Sepay ({T(lang, 'Thẻ nội địa / tín dụng', 'Debit / credit card')}) ·{' '}
          {T(lang, 'Sắp ra mắt', 'Coming soon')}
        </button>
        <button type="button" disabled>
          <span>💳</span>
          Stripe / Paypal · {T(lang, 'Sắp ra mắt', 'Coming soon')}
        </button>
      </div>
    </section>
  );

  return (
    <main className="d68-auth-page d68-register-page">
      <section className="d68-auth-card d68-register-card">
        <div className="d68-auth-head">
          <span>
            {isBusiness ? '🏢' : isInvestor ? '📈' : '🤝'}{' '}
            {isBusiness
              ? T(lang, 'Đăng ký Doanh nghiệp', 'Register as Business')
              : isInvestor
                ? T(lang, 'Đăng ký Nhà đầu tư', 'Register as Investor')
                : roleLabel(normalized as any, lang)}
          </span>
          <h1>
            {isBusiness
              ? T(
                  lang,
                  'Đăng hồ sơ gọi vốn / bán doanh nghiệp',
                  'List your fundraise / business sale',
                )
              : isInvestor
                ? T(
                    lang,
                    'Tạo hồ sơ Nhà đầu tư',
                    'Create your Investor profile',
                  )
                : T(
                    lang,
                    'Tạo tài khoản Deals68',
                    'Create your Deals68 account',
                  )}
          </h1>
          <p>
            {isBusiness
              ? T(
                  lang,
                  'Hồ sơ doanh nghiệp luôn ẩn danh tên/thương hiệu và chỉ hiển thị với Nhà đầu tư quan tâm',
                  'Business profiles always anonymize names/brands and are shown to interested investors',
                )
              : T(
                  lang,
                  'Thông tin liên hệ riêng tư không hiển thị công khai. Chỉ doanh nghiệp kết nối mới xem được',
                  'Private contact details are not displayed publicly. Only connected businesses can view them',
                )}
          </p>
        </div>

        <form onSubmit={submit} className="d68-register-form">
          <section className="d68-register-section d68-register-section--account">
            <h2>{T(lang, 'Thông tin tài khoản', 'Account information')}</h2>
            <div className="d68-form-grid">
              <Field label={T(lang, 'Email đăng nhập', 'Login email')}>
                <input
                  required
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </Field>
              <Field label={T(lang, 'Mật khẩu', 'Password')}>
                <input
                  required
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder={T(
                    lang,
                    'Tối thiểu 8 ký tự',
                    'At least 8 characters',
                  )}
                />
              </Field>
              <Field label={T(lang, 'Tên người phụ trách', 'Contact name')}>
                <input
                  required
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              </Field>
              <Field label={T(lang, 'Quốc gia', 'Country')}>
                <select
                  value={country}
                  onChange={(event) => setCountry(event.target.value)}
                >
                  {countryOptions.map((item) => (
                    <option key={item.iso2} value={T(lang, item.vi, item.en)}>
                      {T(lang, item.vi, item.en)}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </section>

          {isBusiness ? (
            <>
              <section className="d68-register-section">
                <h2>{T(lang, 'Thông tin doanh nghiệp', 'Business information')}</h2>
                <div className="d68-form-grid">
                  <Field label={T(lang, 'Tên doanh nghiệp', 'Business name')}>
                    <input
                      value={companyName}
                      onChange={(event) => setCompanyName(event.target.value)}
                    />
                    <small>
                      {T(
                        lang,
                        'Giống tên DN trên Giấy phép ĐKKD.',
                        'Use the legal name on the business registration certificate.',
                      )}
                    </small>
                  </Field>
                  <Field label={T(lang, 'Ngành', 'Industry')}>
                    <select
                      value={industry}
                      onChange={(event) => setIndustry(event.target.value)}
                    >
                      {industryOptions.map((item) => (
                        <option key={item.key} value={item.vi}>
                          {T(lang, item.vi, item.en)}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label={T(lang, 'Tỉnh/Thành phố', 'Province/City')}>
                    <select
                      value={city}
                      onChange={(event) => setCity(event.target.value)}
                    >
                      {locationChoices.length ? (
                        locationChoices.map((item) => (
                          <option
                            key={item.key}
                            value={T(lang, item.vi, item.en)}
                          >
                            {T(lang, item.vi, item.en)}
                          </option>
                        ))
                      ) : (
                        <option value={city}>
                          {city || T(lang, 'Khác / nhập tự do', 'Other / free text')}
                        </option>
                      )}
                    </select>
                  </Field>
                  <Field label={T(lang, 'Loại giao dịch', 'Deal type')}>
                    <select
                      value={dealType}
                      onChange={(event) => setDealType(event.target.value)}
                    >
                      {businessDealOptions.map((item) => (
                        <option key={item.vi} value={item.vi}>
                          {T(lang, item.vi, item.en)}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field
                    label={T(
                      lang,
                      `Doanh thu tháng (${countryCode === 'VN' ? 'VNĐ' : currentCurrency})`,
                      `Monthly revenue (${currentCurrency})`,
                    )}
                    hint={T(
                      lang,
                      'Nếu không nhập doanh thu năm, hệ thống sẽ nhân 12.',
                      'If annual revenue is blank, the system annualizes monthly revenue × 12.',
                    )}
                  >
                    <input
                      inputMode="numeric"
                      value={revenueMonth}
                      onChange={(event) =>
                        setRevenueMonth(formatNumberTyping(event.target.value))
                      }
                    />
                  </Field>
                  <Field
                    label={T(
                      lang,
                      'Doanh thu năm gần nhất',
                      'Latest annual revenue',
                    )}
                  >
                    <input
                      inputMode="numeric"
                      value={revenue}
                      onChange={(event) =>
                        setRevenue(formatNumberTyping(event.target.value))
                      }
                    />
                  </Field>
                  <Field
                    label={T(
                      lang,
                      'Tỷ suất lợi nhuận/EBITDA (%)',
                      'EBITDA margin (%)',
                    )}
                  >
                    <input
                      inputMode="decimal"
                      value={ebitda}
                      onChange={(event) =>
                        setEbitda(formatNumberTyping(event.target.value, true))
                      }
                    />
                  </Field>
                  <Field label={T(lang, 'Tăng trưởng năm (%)', 'Annual growth (%)')}>
                    <input
                      inputMode="decimal"
                      value={growthPct}
                      onChange={(event) =>
                        setGrowthPct(formatNumberTyping(event.target.value, true))
                      }
                    />
                  </Field>
                  <Field
                    label={T(
                      lang,
                      'Số tiền gọi vốn / giá trị giao dịch mong muốn',
                      'Capital sought / desired transaction value',
                    )}
                  >
                    <input
                      inputMode="numeric"
                      value={ask}
                      onChange={(event) =>
                        setAsk(formatNumberTyping(event.target.value))
                      }
                    />
                  </Field>
                  <Field label={T(lang, 'Tỷ lệ cổ phần (%)', 'Stake (%)')}>
                    <input
                      inputMode="decimal"
                      value={stake}
                      onChange={(event) =>
                        setStake(formatNumberTyping(event.target.value, true))
                      }
                    />
                  </Field>
                </div>
                <Field
                  label={T(
                    lang,
                    'Điểm nổi bật của doanh nghiệp',
                    'Business highlights',
                  )}
                  wide
                  spaced
                >
                  <textarea
                    rows={4}
                    value={highlights}
                    onChange={(event) => setHighlights(event.target.value)}
                  />
                </Field>
                <Field
                  label={T(
                    lang,
                    'Lý do gọi vốn/chuyển nhượng',
                    'Reason for fundraising/sale',
                  )}
                  wide
                  spaced
                >
                  <input
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                  />
                </Field>
              </section>

              <section className="d68-register-section">
                <h2>{T(lang, 'Ảnh & hồ sơ doanh nghiệp', 'Business images & profile files')}</h2>
                <div className="d68-upload-grid">
                  <div className="d68-upload-box">
                    <div>
                      <b>{T(lang, 'Ảnh doanh nghiệp', 'Business images')}</b>
                      <p>
                        {T(
                          lang,
                          'Upload tối đa 5 ảnh. Admin sẽ làm sạch/ẩn thương hiệu nếu cần trước khi public.',
                          'Upload up to 5 images. Admin will sanitize/anonymize branding if needed before public display.',
                        )}
                      </p>
                    </div>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/*"
                      multiple
                      onChange={(event) => {
                        addImages(event.target.files);
                        event.currentTarget.value = '';
                      }}
                    />
                    <div className="d68-upload-list">
                      {businessImages.map((item) => (
                        <div key={item.id} className="d68-upload-item">
                          <span>
                            {item.file.name}
                            <small>{formatBytes(item.file.size)}</small>
                          </span>
                          <input
                            value={item.displayName}
                            onChange={(event) =>
                              updateAssetName('image', item.id, event.target.value)
                            }
                          />
                          <button
                            type="button"
                            onClick={() => removeAsset('image', item.id)}
                          >
                            {T(lang, 'Xóa', 'Remove')}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="d68-upload-box">
                    <div>
                      <b>{T(lang, 'File Hồ sơ doanh nghiệp', 'Business profile files')}</b>
                      <p>
                        {T(
                          lang,
                          'Upload tối đa 5 file PDF/Word/PowerPoint/Excel. File mặc định bị khóa, chỉ mở theo duyệt kết nối.',
                          'Upload up to 5 PDF/Word/PowerPoint/Excel files. Files are locked by default and only unlock through approved connection workflow.',
                        )}
                      </p>
                    </div>
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx"
                      multiple
                      onChange={(event) => {
                        addDocs(event.target.files);
                        event.currentTarget.value = '';
                      }}
                    />
                    <div className="d68-upload-list">
                      {businessDocs.map((item) => (
                        <div key={item.id} className="d68-upload-item">
                          <span>
                            {item.file.name}
                            <small>{formatBytes(item.file.size)}</small>
                          </span>
                          <input
                            value={item.displayName}
                            onChange={(event) =>
                              updateAssetName('doc', item.id, event.target.value)
                            }
                          />
                          <button
                            type="button"
                            onClick={() => removeAsset('doc', item.id)}
                          >
                            {T(lang, 'Xóa', 'Remove')}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </section>

              <section className="d68-register-section">
                <h2>{T(lang, 'Thông tin tài sản & nguồn số liệu', 'Assets & financial source')}</h2>
                <Field
                  label={T(
                    lang,
                    'Tài sản hữu hình & vô hình DN sở hữu',
                    'Tangible & intangible assets owned',
                  )}
                  wide
                >
                  <textarea
                    rows={3}
                    value={assetsOwned}
                    onChange={(event) => setAssetsOwned(event.target.value)}
                  />
                </Field>
                <div className="d68-form-grid d68-assets-source-grid">
                  <Field
                    label={T(
                      lang,
                      'Giá trị tài sản vật chất KHÔNG nằm trong giao dịch',
                      'Physical asset value excluded from transaction',
                    )}
                  >
                    <input
                      inputMode="numeric"
                      value={excludedAssetValue}
                      onChange={(event) =>
                        setExcludedAssetValue(
                          formatNumberTyping(event.target.value),
                        )
                      }
                    />
                  </Field>
                  <Field label={T(lang, 'Nguồn số liệu tài chính', 'Financial data source')}>
                    <select
                      value={financialSource}
                      onChange={(event) => setFinancialSource(event.target.value)}
                    >
                      <option value="management_accounts">
                        {T(lang, 'Số liệu quản trị nội bộ', 'Management accounts')}
                      </option>
                      <option value="tax_report">
                        {T(lang, 'Báo cáo thuế', 'Tax filings')}
                      </option>
                      <option value="audited_financials">
                        {T(lang, 'Báo cáo kiểm toán', 'Audited financials')}
                      </option>
                      <option value="bank_statement">
                        {T(lang, 'Sao kê ngân hàng / POS', 'Bank / POS statements')}
                      </option>
                      <option value="estimate">
                        {T(lang, 'Ước tính của chủ DN', 'Founder estimate')}
                      </option>
                    </select>
                  </Field>
                </div>
                <div className={`d68-valuation-check d68-valuation-check--${valuationCheck.level}`}>
                  <div>
                    <span>{T(lang, 'Gợi ý kiểm tra định giá', 'Valuation sanity check')}</span>
                    <b>{valuationCheck.label}</b>
                    <p>{valuationCheck.message}</p>
                  </div>
                  <dl>
                    <div>
                      <dt>{T(lang, 'Định giá quy đổi', 'Converted valuation')}</dt>
                      <dd>
                        {valuationCheck.impliedValue
                          ? formatValuationMoney(
                              valuationCheck.impliedValue,
                              currentCurrency,
                              lang,
                            )
                          : '—'}
                      </dd>
                    </div>
                    <div>
                      <dt>{T(lang, 'Định giá tham chiếu', 'Benchmark valuation')}</dt>
                      <dd>
                        {valuationCheck.benchLow && valuationCheck.benchHigh
                          ? `${formatValuationMoney(
                              valuationCheck.benchLow,
                              currentCurrency,
                              lang,
                            )} – ${formatValuationMoney(
                              valuationCheck.benchHigh,
                              currentCurrency,
                              lang,
                            )}`
                          : '—'}
                      </dd>
                    </div>
                    <div><dt>EV/Revenue</dt><dd>{valuationCheck.adjR ? `${valuationCheck.adjR.toFixed(2)}×` : '—'}</dd></div>
                    <div><dt>EV/EBITDA</dt><dd>{valuationCheck.adjE ? `${valuationCheck.adjE.toFixed(2)}×` : '—'}</dd></div>
                  </dl>
                </div>
              </section>

              {paymentSection}
            </>
          ) : null}

          {isInvestor ? (
            <>
              <section className="d68-register-section d68-register-section--investor-profile">
                <h2>{T(lang, 'Thông tin Nhà đầu tư', 'Investor information')}</h2>
                <div className="d68-form-grid">
                  <Field
                    label={T(
                      lang,
                      'Khoản đầu tư tối thiểu (USD)',
                      'Minimum ticket (USD)',
                    )}
                  >
                    <input
                      inputMode="numeric"
                      value={ticketMin}
                      onChange={(event) =>
                        setTicketMin(formatNumberTyping(event.target.value))
                      }
                    />
                  </Field>
                  <Field
                    label={T(
                      lang,
                      'Khoản đầu tư tối đa (USD)',
                      'Maximum ticket (USD)',
                    )}
                  >
                    <input
                      inputMode="numeric"
                      value={ticketMax}
                      onChange={(event) =>
                        setTicketMax(formatNumberTyping(event.target.value))
                      }
                    />
                  </Field>
                  <Field
                    label={T(
                      lang,
                      'Website riêng (không công khai)',
                      'Private website (not public)',
                    )}
                  >
                    <input
                      value={website}
                      onChange={(event) => setWebsite(event.target.value)}
                    />
                  </Field>
                  <Field
                    label={T(
                      lang,
                      'Số điện thoại riêng/WhatsApp/Zalo',
                      'Private phone / WhatsApp / Zalo',
                    )}
                  >
                    <div className="d68-phone-row">
                      <select
                        value={phoneIso}
                        onChange={(event) => setPhoneIso(event.target.value)}
                      >
                        {countryOptions.map((item) => (
                          <option key={item.iso2} value={item.iso2}>
                            {item.dial} · {item.iso2}
                          </option>
                        ))}
                      </select>
                      <input
                        value={phone}
                        onChange={(event) => setPhone(event.target.value)}
                        placeholder={T(lang, 'Số điện thoại', 'Phone number')}
                      />
                    </div>
                  </Field>
                </div>

                <Field
                  label={T(lang, 'Giới thiệu', 'Introduction')}
                  wide
                  hint={T(
                    lang,
                    'Nội dung giới thiệu công khai, không ghi email/số điện thoại.',
                    'Public introduction; do not include email or phone.',
                  )}
                >
                  <textarea
                    rows={4}
                    value={generalDesc}
                    onChange={(event) => setGeneralDesc(event.target.value)}
                  />
                </Field>

                <div className="d68-field-group">
                  <h3>{T(lang, 'Loại hình nhà đầu tư', 'Investor types')}</h3>
                  <InvestorTypeTagPicker
                    lang={lang}
                    values={investorTypes}
                    onChange={setInvestorTypes}
                  />
                </div>

                <div className="d68-field-group">
                  <h3>{T(lang, 'Giai đoạn phù hợp', 'Preferred stages')}</h3>
                  <InvestorStageTagPicker
                    lang={lang}
                    values={investorStages}
                    onChange={setInvestorStages}
                  />
                </div>

                <div className="d68-field-group">
                  <h3>{T(lang, 'Loại giao dịch quan tâm', 'Interested deal types')}</h3>
                  <InvestorDealTypeTagPicker
                    lang={lang}
                    values={investorDealTypes}
                    onChange={setInvestorDealTypes}
                  />
                </div>

                <div className="d68-field-group">
                  <h3>{T(lang, 'Thị trường quan tâm', 'Investment markets')}</h3>
                  <InvestorMarketTagPicker
                    lang={lang}
                    values={preferredCountries}
                    onChange={setPreferredCountries}
                  />
                </div>

                <div className="d68-field-group">
                  <h3>{T(lang, 'Ngành quan tâm', 'Preferred industries')}</h3>
                  <IndustryTagPicker
                    lang={lang}
                    values={selectedIndustries}
                    onChange={setSelectedIndustries}
                    expandVi="Mở rộng ngành"
                    expandEn="Expand industries"
                  />
                </div>

                <Field
                  label={T(lang, 'Khẩu vị đầu tư', 'Investment appetite')}
                  wide
                  spaced
                  hint={T(
                    lang,
                    'Mô tả doanh nghiệp, mô hình, mức độ tham gia và điều kiện mà anh/chị ưu tiên. Nội dung này cần Admin duyệt trước khi công khai.',
                    'Describe preferred businesses, models, involvement and conditions. Admin approval is required before public display.',
                  )}
                >
                  <textarea
                    rows={5}
                    value={appetiteDesc}
                    onChange={(event) => setAppetiteDesc(event.target.value)}
                  />
                </Field>
              </section>
              {paymentSection}
            </>
          ) : null}

          <label className="d68-agree">
            <input
              type="checkbox"
              checked={agree}
              onChange={(event) => setAgree(event.target.checked)}
            />{' '}
            {T(
              lang,
              'Tôi đồng ý Điều khoản & Chính sách bảo mật.',
              'I agree to Terms & Privacy Policy.',
            )}
          </label>
          {msg ? (
            <div
              className={`d68-auth-msg ${
                msgType === 'ok' ? 'ok' : msgType === 'err' ? 'err' : ''
              }`}
            >
              {msg}
            </div>
          ) : null}
          <button disabled={loading} className="d68-auth-submit">
            {loading
              ? T(lang, 'Đang tạo...', 'Creating...')
              : isBusiness
                ? T(
                    lang,
                    'Tạo tài khoản doanh nghiệp',
                    'Create business account',
                  )
                : isInvestor
                  ? T(
                      lang,
                      'Tạo tài khoản Nhà đầu tư',
                      'Create investor account',
                    )
                  : T(lang, 'Tạo tài khoản', 'Create account')}
          </button>
        </form>
      </section>
    </main>
  );
}
