/* Deals68 — shared client-side mock backend (prototype only, no real server).
   Provides: seeded 624-investor generator, business seed w/ quota, session,
   proposals and localStorage-backed dashboard state helpers. */
(function (global) {
  function mulberry32(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  var rand = mulberry32(68240701);
  function pick(arr) { return arr[Math.floor(rand() * arr.length)]; }
  function pickN(arr, n) {
    var pool = arr.slice(), out = [];
    n = Math.min(n, pool.length);
    for (var i = 0; i < n; i++) { var idx = Math.floor(rand() * pool.length); out.push(pool.splice(idx, 1)[0]); }
    return out;
  }
  function pad(n, len) { var s = String(n); while (s.length < len) s = '0' + s; return s; }

  var INDUSTRIES = ['Finance', 'IT & Software', 'Health Care', 'Food & Beverage', 'Manufacturing', 'Real Estate', 'Retail & E-commerce', 'Logistics', 'Media & Advertising', 'Education', 'Energy', 'Services'];
  var DEAL_TYPES = ['Fundraise', 'Partial Stake Sale', 'Full Acquisition', 'Strategic Partnership', 'Debt/Loan'];
  var DEAL_TYPES_VI = { 'Fundraise': 'Gọi vốn', 'Partial Stake Sale': 'Bán một phần cổ phần', 'Full Acquisition': 'Mua lại toàn bộ', 'Strategic Partnership': 'Đối tác chiến lược', 'Debt/Loan': 'Vay vốn / Nợ' };
  function dealTypeLabel(name, vi) { return vi ? (DEAL_TYPES_VI[name] || name) : name; }
  function dealTypeLabelList(names, vi) { return (names || []).map(function (n) { return dealTypeLabel(n, vi); }); }
  var STAGES = ['Seed', 'Early stage', 'Growth stage', 'Mature / Buyout'];

  var COUNTRY_REGION = {
    'Singapore': 'asia', 'Japan': 'asia', 'South Korea': 'asia', 'Vietnam': 'asia', 'Hong Kong': 'asia',
    'United States': 'americas', 'Israel': 'mideast', 'N/A': 'asia',
    'Malaysia': 'asia', 'Indonesia': 'asia', 'Thailand': 'asia', 'Taiwan': 'asia', 'China': 'asia', 'Philippines': 'asia'
  };
  var VI_COUNTRY = {
    'Singapore': 'Singapore', 'Japan': 'Nhật Bản', 'South Korea': 'Hàn Quốc', 'Vietnam': 'Việt Nam',
    'Hong Kong': 'Hồng Kông', 'United States': 'Hoa Kỳ', 'Israel': 'Israel', 'N/A': 'Chưa xác định',
    'Malaysia': 'Malaysia', 'Indonesia': 'Indonesia', 'Thailand': 'Thái Lan', 'Taiwan': 'Đài Loan', 'China': 'Trung Quốc', 'Philippines': 'Philippines'
  };
  var TYPE_VI = { 'VC': 'Quỹ VC', 'PE': 'Quỹ PE', 'Institutional': 'Định chế tài chính', 'Corporate/Strategic': 'Nhà đầu tư chiến lược', 'Individual/Angel': 'Nhà đầu tư cá nhân', 'Family Office': 'Family Office', 'Lender/Debt': 'Bên cho vay' };
  var TICKET_BY_TYPE = {
    'VC': [100000, 5000000], 'PE': [5000000, 50000000], 'Institutional': [2000000, 40000000],
    'Corporate/Strategic': [1000000, 100000000], 'Individual/Angel': [10000, 500000],
    'Family Office': [1000000, 20000000], 'Lender/Debt': [500000, 30000000]
  };

  var INSTITUTIONAL_COUNTRY_COUNTS = [
    ['Singapore', 175], ['Japan', 149], ['South Korea', 62], ['N/A', 31], ['Vietnam', 12],
    ['United States', 1], ['Hong Kong', 1], ['Israel', 1]
  ]; // sums to 432
  var INSTITUTIONAL_TYPE_COUNTS = [
    ['VC', 264], ['PE', 63], ['Institutional', 59], ['Corporate/Strategic', 31], ['Individual/Angel', 8], ['Family Office', 6], ['Lender/Debt', 1]
  ]; // sums to 432
  var PERSONAL_COUNTRY_COUNTS = [
    ['Vietnam', 55], ['Singapore', 40], ['Japan', 35], ['South Korea', 25], ['Malaysia', 12], ['Indonesia', 10],
    ['Thailand', 8], ['Taiwan', 4], ['China', 2], ['Philippines', 1]
  ]; // sums to 192 personal/angel investors

  function expandCounts(counts) {
    var out = [];
    counts.forEach(function (pair) { for (var i = 0; i < pair[1]; i++) out.push(pair[0]); });
    return out;
  }

  function activityLevel(idx) {
    var r = rand();
    if (r < 0.18) return 'high';
    if (r < 0.55) return 'medium';
    return 'low';
  }

  function rankingScore(inv) {
    var s = 0;
    s += inv.activity_level === 'high' ? 20 : inv.activity_level === 'medium' ? 12 : 4;
    s += Math.min(inv.deals68_deals_invested_count * 5, 25);
    s += inv.verified ? 8 : 0;
    s += inv.admin_priority ? 12 : 0;
    s += inv.type === 'PE' || inv.type === 'Institutional' ? 6 : 0;
    return s;
  }

  function genInvestors() {
    var countryPool = pickN(expandCounts(INSTITUTIONAL_COUNTRY_COUNTS), 432);
    var typePool = pickN(expandCounts(INSTITUTIONAL_TYPE_COUNTS), 432);
    var personalCountryPool = pickN(expandCounts(PERSONAL_COUNTRY_COUNTS), 192);
    var list = [];
    var n = 1;

    function makeOne(type, country, isPersonal) {
      var code = 'INV-' + pad(n, 4); n++;
      var region = COUNTRY_REGION[country] || 'asia';
      var ticketRange = TICKET_BY_TYPE[type] || [50000, 1000000];
      var ticketMin = ticketRange[0], ticketMax = ticketRange[1];
      var industries = pickN(INDUSTRIES, 1 + Math.floor(rand() * 2));
      var dealTypes = pickN(DEAL_TYPES, 1 + Math.floor(rand() * 2));
      var stage = pick(STAGES);
      var invested = rand() < 0.35 ? Math.floor(rand() * 6) : 0;
      var verified = rand() < 0.55;
      var priority = rand() < 0.08;
      var level = activityLevel(n);
      var countryViDisp = VI_COUNTRY[country] || country;
      var titleVi = (isPersonal ? 'Nhà đầu tư cá nhân tại ' : (TYPE_VI[type] + ' ')) + (isPersonal ? countryViDisp : (stage === 'Seed' || stage === 'Early stage' ? 'giai đoạn sớm tại ' + countryViDisp : (stage === 'Growth stage' ? 'tăng trưởng tại ' + countryViDisp : 'M&A tại ' + countryViDisp))) + ' quan tâm ' + industries[0];
      var titleEn = (isPersonal ? 'Individual investor in ' + country : (type + ' ' + (stage === 'Seed' || stage === 'Early stage' ? 'early-stage ' : (stage === 'Growth stage' ? 'growth ' : 'M&A ')) + 'investor in ' + country)) + ' interested in ' + industries[0];
      var descVi = 'Nhà đầu tư ẩn danh quan tâm ' + industries.join(', ') + ', ưu tiên thương vụ ' + dealTypes.join(', ') + ' ở giai đoạn ' + stage + '.';
      var descEn = 'Anonymous investor interested in ' + industries.join(', ') + ', prioritizing ' + dealTypes.join(', ') + ' deals at the ' + stage + ' stage.';
      return {
        code: code, type: isPersonal ? 'Individual/Angel' : type, country: country, countryVi: countryViDisp, region: region,
        ticketMin: ticketMin, ticketMax: ticketMax, industries: industries, dealTypes: dealTypes, stage: stage,
        titleVi: titleVi, titleEn: titleEn, descVi: descVi, descEn: descEn,
        deals68_deals_invested_count: invested, verified: verified, admin_priority: priority, activity_level: level,
        // admin/private only — never render on public pages:
        _privateName: 'Investor Entity ' + code, _privateWebsite: 'https://profile-' + n + '.deals68-partners.internal', _privateEmail: 'contact' + n + '@deals68-partners.internal'
      };
    }

    for (var i = 0; i < 432; i++) list.push(makeOne(typePool[i], countryPool[i], false));
    for (var j = 0; j < 192; j++) list.push(makeOne('Individual/Angel', personalCountryPool[j], true));

    list.forEach(function (inv) { inv.ranking_score = rankingScore(inv); });
    list.sort(function (a, b) { return b.ranking_score - a.ranking_score; });
    return list;
  }

  var _cache = null;
  // Admin-created investors (V1.6.1) are merged on top of the generated seed list.
  var LS_ADMIN_INVESTORS = 'd68_admin_investors';
  function getAdminInvestors() { return readJSON(LS_ADMIN_INVESTORS, []); }
  function getInvestors() {
    if (!_cache) {
      // V1.6.1: prefer the real imported investor dataset (assets/deals68-investors-import.js) over the
      // synthetic generator. Falls back to genInvestors() only if that file failed to load.
      var real = global.D68_REAL_INVESTORS;
      _cache = (real && real.length) ? real.slice() : genInvestors();
      _cache.forEach(function (inv) { inv.ranking_score = rankingScore(inv); });
      _cache.sort(function (a, b) { return b.ranking_score - a.ranking_score; });
    }
    return _cache.concat(getAdminInvestors());
  }
  function investorStateId(code) { return 'investor_' + String(code || '').toLowerCase().replace(/[^a-z0-9]/g, ''); }

  function addAdminInvestor(data) {
    var email = (data.email || '').trim().toLowerCase();
    if (email) {
      var dup = checkInvestorEmailDuplicate(email);
      if (dup.duplicate) return { ok: false, reason: 'duplicate_email', detail: dup };
    }
    var list = getAdminInvestors();
    var code = (data.code && data.code.trim()) || ('INV-' + pad(9000 + list.length + 1, 4));
    if (getInvestors().some(function (x) { return x.code === code; })) return { ok: false, reason: 'duplicate_code' };
    var inv = {
      code: code, type: data.type || 'VC', country: data.country || 'Vietnam', countryVi: data.country || 'Vietnam', region: data.region || '',
      ticketMin: Number(data.ticketMin) || 100000, ticketMax: Number(data.ticketMax) || 5000000,
      industries: data.industries || [], dealTypes: data.dealTypes || [], stage: data.stage || 'Growth',
      titleVi: data.titleVi || (data.type || 'Investor') + ' quan tâm ' + (data.country || ''), titleEn: data.titleEn || '',
      descVi: data.descVi || '', descEn: data.descEn || '',
      deals68_deals_invested_count: 0, verified: !!data.verified, admin_priority: false, activity_level: 'medium',
      _privateName: data.name || ('Investor ' + code), _privateWebsite: data.website || '', _privateEmail: data.email || '',
      _adminCreated: true
    };
    list.push(inv);
    writeJSON(LS_ADMIN_INVESTORS, list);
    var sid = investorStateId(code);
    var s = getInvestorState(sid);
    s.code = code;
    s.contacts = (data.contacts && data.contacts.length) ? data.contacts
      : [{ name: data.contactName || data.name || 'Primary Contact', email: data.email || '', phone: data.phone || '', role: 'Primary', isPrimary: true }];
    saveInvestorState(sid, s);
    logAudit('investor_created', 'Admin tạo NĐT ' + code + ' (' + (data.name || '') + ')');
    return { ok: true, code: code };
  }

  var BUSINESS_SEED = [
    { id: 'hkmedi', username: 'hkmedi', password: 'deals687U8', titleVi: 'Chuỗi phòng khám da liễu & thẩm mỹ 5 chi nhánh đang gọi vốn mở rộng toàn quốc', titleEn: '5-branch dermatology & aesthetics clinic chain raising growth capital', industry: 'Health Care; Beauty & Personal Care', dealType: 'Fundraise; Primary shares', plan: 'Featured', quotaTotal: 200, bizid: 'hkmedi' },
    { id: 'infinitytech', username: 'infinitytech', password: 'deals68gQ5', titleVi: 'Công ty mobile app global đang gọi vốn USD 2.0M cho 30%', titleEn: 'Global mobile app studio raising USD 2.0M for 30%', industry: 'IT & Software; Mobile Apps; Consumer Apps', dealType: 'Fundraise; Equity fundraising', plan: 'Standard', quotaTotal: 100, bizid: 'infinitytech' },
    { id: 'dunniotailor', username: 'dunniotailor', password: 'deals68koM', titleVi: 'Nền tảng may đo cá nhân hóa gọi vốn Seed USD 300K cho 22,6%', titleEn: 'Personalized custom-tailoring platform raising Seed USD 300K for 22.6%', industry: 'Fashion Tech; E-commerce; Retail', dealType: 'Fundraise; Seed fundraising', plan: 'Standard', quotaTotal: 100, bizid: 'dunnio' },
    { id: 'phongcua', username: 'phongcua', password: 'deals68rV4', titleVi: 'Bán 2 nhà hàng hải sản tại TP.HCM - giá chào 15 tỷ VNĐ', titleEn: 'Two seafood restaurants in HCMC for sale — asking VND 15B', industry: 'Food & Beverage; Seafood Restaurant', dealType: 'Full Acquisition; Full business sale', plan: 'Featured', quotaTotal: 200, bizid: 'phongcua' },
    { id: 'trongnhanseafoods', username: 'trongnhanseafoods', password: 'deals68ebk', titleVi: 'Nhà máy chế biến thủy sản xuất khẩu quy mô lớn tìm nhà đầu tư chiến lược', titleEn: 'Large-scale seafood export processing plant seeking a strategic investor', industry: 'Manufacturing; Seafood Export; Food Processing', dealType: 'Strategic investor; M&A; Growth capital', plan: 'Featured', quotaTotal: 200, bizid: 'trongnhan' },
    { id: 'automatedcoldstore', username: 'automatedcoldstore', password: 'deals68pJY', titleVi: 'Kho lạnh tự động quy mô lớn tại TP.HCM chuyển nhượng USD 50M', titleEn: 'Large automated cold storage in HCMC for transfer — USD 50M', industry: 'Transportation & Logistics; Cold Chain; Real Estate/Infrastructure', dealType: 'Asset transfer; Company transfer', plan: 'Featured', quotaTotal: 200, bizid: 'coldstore' }
  ];

  // ---------- Business Quality Score V1.6.1 (separate from Data Confidence) ----------
  // Curated demo profiles so seed businesses show a realistic Quality Score on every surface.
  // Figures feed the score breakdown; revenue/ask strings are the public display copy.
  var SEED_PROFILES = {
    hkmedi: {
      companyName: 'HK Medi Clinic Group', country: 'Vietnam',
      highlights: 'Chuỗi 5 phòng khám da liễu & thẩm mỹ vận hành ổn định\nĐội ngũ bác sĩ chuyên khoa & KOL nội bộ\nBiên lợi nhuận cao, khách hàng thân thiết lặp lại lớn',
      investmentReason: 'Gọi vốn mở rộng 5 chi nhánh mới tại Hà Nội & Đà Nẵng trong 18 tháng, đầu tư thiết bị laser thế hệ mới và hệ thống CRM.',
      revenue: '20.000.000.000 ₫', ebitda: '22%', ask: '25.000.000.000 ₫ / 30%',
      financialInput: { avg_monthly_sales: 1800000000, latest_annual_sales: 20000000000, ebitda_margin_pct: 22, growth_rate_pct: 35, max_stake_pct: 30, investment_amount_sought: 25000000000, data_source: 'accounting_data' },
      documents: [
        { id:'d1', name:'Hồ sơ / Profile DN', category:'profile', visibility:'public', uploaded:true, seed:true },
        { id:'d2', name:'Báo cáo tài chính 2024–2025', category:'financials', visibility:'locked', uploaded:true, seed:true },
        { id:'d3', name:'Teaser / IM', category:'im', visibility:'public', uploaded:true, seed:true },
        { id:'d4', name:'Giấy phép hoạt động khám chữa bệnh', category:'legal', visibility:'locked', uploaded:true, seed:true }
      ],
      imagesMeta: [{ title:'Cơ sở chính' }, { title:'Phòng điều trị' }, { title:'Khu lễ tân' }],
      qualityReview: 'approved'
    },
    infinitytech: {
      companyName: 'Infinity Tech Studio', country: 'Singapore',
      highlights: 'Studio phát triển mobile app quy mô toàn cầu\n4 app trên App Store/Google Play, MAU tăng trưởng đều\nĐội ngũ kỹ sư & UA giàu kinh nghiệm',
      investmentReason: 'Gọi vốn USD 2.0M mở rộng User Acquisition và ra mắt 2 sản phẩm mới trong 12 tháng.',
      revenue: '$2,000,000', ebitda: '18%', ask: '$2,000,000 / 30%',
      financialInput: { avg_monthly_sales: 180000, latest_annual_sales: 2000000, ebitda_margin_pct: 18, growth_rate_pct: '', max_stake_pct: 30, investment_amount_sought: 2000000, data_source: 'owner_estimate' },
      documents: [
        { id:'d1', name:'Company profile', category:'profile', visibility:'public', uploaded:true, seed:true },
        { id:'d2', name:'Financial summary 2025', category:'financials', visibility:'locked', uploaded:true, seed:true },
        { id:'d3', name:'Pitch deck / IM', category:'im', visibility:'public', uploaded:false, seed:true }
      ],
      imagesMeta: [{ title:'Product screenshot' }],
      qualityReview: 'approved'
    },
    dunniotailor: {
      companyName: 'Dunnio Tailor', country: 'Singapore',
      highlights: 'Nền tảng may đo cá nhân hóa ứng dụng công nghệ số đo\nMô hình D2C biên cao, đơn hàng lặp lại tốt',
      investmentReason: 'Gọi vốn Seed USD 300K cho 22,6% để hoàn thiện sản phẩm và mở rộng marketing.',
      revenue: '$300,000', ebitda: '', ask: '$300,000 / 22.6%',
      financialInput: { avg_monthly_sales: 25000, latest_annual_sales: 300000, ebitda_margin_pct: '', growth_rate_pct: 40, max_stake_pct: 22.6, investment_amount_sought: 300000, data_source: 'owner_estimate' },
      documents: [
        { id:'d1', name:'Company profile', category:'profile', visibility:'public', uploaded:true, seed:true },
        { id:'d2', name:'Financials', category:'financials', visibility:'locked', uploaded:false, seed:true }
      ],
      imagesMeta: [],
      qualityReview: 'pending'
    },
    phongcua: {
      companyName: 'Phong Cua Seafood Restaurants', country: 'Vietnam',
      highlights: '2 nhà hàng hải sản vị trí đắc địa tại TP.HCM\nThương hiệu lâu năm, lượng khách ổn định\nĐầy đủ giấy phép, mặt bằng thuê dài hạn',
      investmentReason: 'Chủ chuyển hướng đầu tư nên sang nhượng toàn bộ 2 nhà hàng, giá chào 15 tỷ VNĐ đã gồm thương hiệu và thiết bị.',
      revenue: '11.000.000.000 ₫', ebitda: '20%', ask: '15.000.000.000 ₫ / 100%',
      financialInput: { avg_monthly_sales: 900000000, latest_annual_sales: 11000000000, ebitda_margin_pct: 20, growth_rate_pct: 8, max_stake_pct: 100, investment_amount_sought: 15000000000, data_source: 'pos_export' },
      documents: [
        { id:'d1', name:'Hồ sơ nhà hàng', category:'profile', visibility:'public', uploaded:true, seed:true },
        { id:'d2', name:'Doanh thu POS 2024–2025', category:'financials', visibility:'locked', uploaded:true, seed:true },
        { id:'d3', name:'Hợp đồng thuê mặt bằng', category:'legal', visibility:'locked', uploaded:true, seed:true }
      ],
      imagesMeta: [{ title:'Mặt tiền nhà hàng' }, { title:'Không gian trong' }],
      qualityReview: 'approved'
    },
    trongnhanseafoods: {
      companyName: 'Trong Nhan Seafoods', country: 'Vietnam',
      highlights: 'Nhà máy chế biến thủy sản xuất khẩu quy mô lớn\nĐạt chứng nhận HACCP, khách hàng EU/Nhật\nCông suất còn dư địa mở rộng',
      investmentReason: 'Tìm nhà đầu tư chiến lược cùng mở rộng công suất và thị trường xuất khẩu, chào bán tối đa 40% cổ phần.',
      revenue: '230.000.000.000 ₫', ebitda: '16%', ask: '190.000.000.000 ₫ / 40%',
      financialInput: { avg_monthly_sales: 20000000000, latest_annual_sales: 230000000000, ebitda_margin_pct: 16, growth_rate_pct: 12, max_stake_pct: 40, investment_amount_sought: 190000000000, data_source: 'accounting_data' },
      documents: [
        { id:'d1', name:'Hồ sơ nhà máy', category:'profile', visibility:'public', uploaded:true, seed:true },
        { id:'d2', name:'BCTC kiểm toán 2024', category:'financials', visibility:'locked', uploaded:true, seed:true },
        { id:'d3', name:'Chứng nhận HACCP', category:'legal', visibility:'public', uploaded:true, seed:true }
      ],
      imagesMeta: [{ title:'Dây chuyền sản xuất' }, { title:'Kho lạnh' }],
      qualityReview: 'approved'
    },
    automatedcoldstore: {
      companyName: 'HCMC Automated Cold Store', country: 'Vietnam',
      highlights: 'Kho lạnh tự động quy mô lớn, công nghệ ASRS\nVị trí logistics chiến lược tại TP.HCM\nHợp đồng thuê kho dài hạn ổn định',
      investmentReason: 'Chủ sở hữu chuyển nhượng toàn bộ tài sản vận hành, giá chào USD 50M gồm đất, nhà xưởng và hệ thống tự động.',
      revenue: '335.000.000.000 ₫', ebitda: '30%', ask: '1.200.000.000.000 ₫ / 100%',
      financialInput: { avg_monthly_sales: 28000000000, latest_annual_sales: 335000000000, ebitda_margin_pct: 30, growth_rate_pct: 10, max_stake_pct: 100, investment_amount_sought: 1200000000000, data_source: 'accounting_data' },
      documents: [
        { id:'d1', name:'Hồ sơ tài sản', category:'profile', visibility:'public', uploaded:true, seed:true },
        { id:'d2', name:'Định giá tài sản độc lập', category:'financials', visibility:'locked', uploaded:true, seed:true },
        { id:'d3', name:'Sổ đỏ & pháp lý', category:'legal', visibility:'locked', uploaded:true, seed:true }
      ],
      imagesMeta: [{ title:'Toàn cảnh kho' }],
      qualityReview: 'approved'
    }
  };

  // Deep-ish copy so each business gets its own mutable seed profile object.
  function cloneSeedProfile(id) {
    var src = SEED_PROFILES[id];
    if (!src) return null;
    return JSON.parse(JSON.stringify(src));
  }

  function qualityBand(score) {
    if (score >= 80) return { key:'excellent', labelVi:'Xuất sắc', labelEn:'Excellent', color:'#16A34A', bg:'#E9F9EF' };
    if (score >= 60) return { key:'good', labelVi:'Tốt', labelEn:'Good', color:'#1596cc', bg:'#E7F6FD' };
    if (score >= 40) return { key:'fair', labelVi:'Khá', labelEn:'Fair', color:'#B8860B', bg:'#FEF3D3' };
    return { key:'low', labelVi:'Cần cải thiện', labelEn:'Needs work', color:'#DC2626', bg:'#FDECEC' };
  }

  // ---------- Quality Score criteria config (Admin-editable) ----------
  var LS_QUALITY_CFG = 'd68_quality_criteria';
  function defaultQualityCriteria() {
    return [
      { key:'profile',    labelVi:'Hoàn thiện hồ sơ',        labelEn:'Profile completeness', weight:15, enabled:true, builtin:true },
      { key:'financials', labelVi:'Số liệu tài chính',        labelEn:'Financials',           weight:20, enabled:true, builtin:true },
      { key:'deal',       labelVi:'Điều khoản giao dịch',     labelEn:'Deal terms',           weight:15, enabled:true, builtin:true },
      { key:'reason',     labelVi:'Lý do định giá / gọi vốn', labelEn:'Valuation reason',     weight:10, enabled:true, builtin:true },
      { key:'images',     labelVi:'Ảnh doanh nghiệp',         labelEn:'Images',               weight:10, enabled:true, builtin:true },
      { key:'documents',  labelVi:'Tài liệu',                 labelEn:'Documents',            weight:15, enabled:true, builtin:true },
      { key:'dataroom',   labelVi:'Sẵn sàng Data Room',       labelEn:'Data room readiness',  weight:5,  enabled:true, builtin:true },
      { key:'admin',      labelVi:'Admin duyệt chất lượng',   labelEn:'Admin quality review', weight:10, enabled:true, builtin:true }
    ];
  }
  function getQualityCriteria() {
    var l = readJSON(LS_QUALITY_CFG, null);
    if (!l || !l.length) { l = defaultQualityCriteria(); writeJSON(LS_QUALITY_CFG, l); }
    return l;
  }
  function saveQualityCriteria(list) { writeJSON(LS_QUALITY_CFG, list); logAudit('quality_criteria_saved', (list ? list.length : 0) + ' criteria'); return list; }
  function resetQualityCriteria() { var d = defaultQualityCriteria(); writeJSON(LS_QUALITY_CFG, d); logAudit('quality_criteria_reset', ''); return d; }

  // Fraction 0..1 a business satisfies each built-in signal. Returns null for custom criteria.
  function qualitySignalFraction(key, ctx) {
    var p = ctx.p, fin = ctx.fin, seed = ctx.seed, st = ctx.st, num = ctx.num;
    switch (key) {
      case 'profile': {
        var pc = 0; if (p.companyName || seed.username) pc += 4; if (p.highlights) pc += 6; if (p.segment || seed.dealType) pc += 2; if (p.industry || seed.industry) pc += 3;
        return pc / 15;
      }
      case 'financials': {
        var fk = ['avg_monthly_sales', 'latest_annual_sales', 'ebitda_margin_pct', 'growth_rate_pct'];
        return fk.filter(function (k) { return num(fin[k]); }).length / 4;
      }
      case 'deal': { var dt = 0; if (num(fin.max_stake_pct)) dt += 7; if (num(fin.investment_amount_sought)) dt += 8; return dt / 15; }
      case 'reason': return p.investmentReason ? 1 : 0;
      case 'images': return Math.min(1, ctx.imgs.length / 3);
      case 'documents': return Math.min(1, ctx.uploadedDocs.length / 3);
      case 'dataroom': { var dr = 0; if (fin.data_source && fin.data_source !== 'owner_estimate') dr += 3; if (ctx.lockedDocs.length >= 1) dr += 2; return dr / 5; }
      case 'admin': return st.qualityReview === 'approved' ? 1 : 0;
      default: return null;
    }
  }

  // Business Quality Score: weighted 0–100 over Admin-editable criteria. Returns { score, band, parts[] }.
  function computeQualityScore(bizId) {
    var seed = getBusinessSeed(bizId) || {};
    var st = getBusinessState(bizId);
    var p = st.profile || {};
    var fin = p.financialInput || {};
    var docs = st.documents || [];
    var imgs = (st.imagesMeta || []).filter(function (m) { return m && String(m.title || '').trim(); });
    var uploadedDocs = docs.filter(function (d) { return d.uploaded; });
    var lockedDocs = uploadedDocs.filter(function (d) { return d.visibility === 'locked'; });
    var num = function (v) { return v !== undefined && v !== null && v !== '' && !isNaN(Number(v)) && Number(v) > 0; };
    var ctx = { seed: seed, st: st, p: p, fin: fin, imgs: imgs, uploadedDocs: uploadedDocs, lockedDocs: lockedDocs, num: num };

    var criteria = getQualityCriteria().filter(function (c) { return c.enabled !== false; });
    var totalWeight = criteria.reduce(function (a, c) { return a + (Number(c.weight) || 0); }, 0) || 1;
    var parts = [];
    var earned = 0;
    criteria.forEach(function (c) {
      var w = Number(c.weight) || 0;
      var frac = c.builtin ? qualitySignalFraction(c.key, ctx) : null;
      if (frac == null) frac = (Number(c.defaultPct) || 0) / 100;
      frac = Math.max(0, Math.min(1, frac));
      var pts = frac * w;
      earned += pts;
      parts.push({ key: c.key, labelVi: c.labelVi, labelEn: c.labelEn, points: Math.round(pts), max: w, ok: frac >= 0.6 });
    });
    var score = Math.max(0, Math.min(100, Math.round(earned / totalWeight * 100)));
    return { score: score, parts: parts, band: qualityBand(score), reviewStatus: st.qualityReview || 'pending' };
  }

  // Admin: approve / reset the Business Quality review flag (the 10-pt admin-review signal).
  function setQualityReview(bizId, status) {
    var st = getBusinessState(bizId);
    st.qualityReview = status;
    saveBusinessState(bizId, st);
    logAudit('quality_review', bizId + ' → ' + status);
    return computeQualityScore(bizId);
  }

  var INVESTOR_SAMPLE_ACCOUNT = { id: 'investor_inv0001', investorCode: 'INV-0001', username: 'investor_inv0001', password: 'deals68dzU' };

  // ---------- localStorage-backed state (prototype persistence) ----------
  var LS = { SESSION: 'd68_session', BIZ_STATE: 'd68_biz_state_', INV_STATE: 'd68_inv_state_', ADV_STATE: 'd68_adv_state_', PROPOSALS: 'd68_proposals', CREDS: 'd68_credentials', REGISTRY: 'd68_registry' };

  function readJSON(key, fallback) { try { var v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch (e) { return fallback; } }
  function writeJSON(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {} }

  function getSession() { return readJSON(LS.SESSION, null); }
  function setSession(s) { writeJSON(LS.SESSION, s); }
  function clearSession() { try { localStorage.removeItem(LS.SESSION); } catch (e) {} }

  function getBusinessSeed(id) { return BUSINESS_SEED.find(function (b) { return b.id === id; }); }

  function getBusinessState(id) {
    var seed = getBusinessSeed(id);
    var state = readJSON(LS.BIZ_STATE + id, null);
    if (!state) {
      // Seed/demo businesses are pre-activated (payment gate applies to newly self-registered accounts).
      var sp = cloneSeedProfile(id);
      state = { id: id, plan: seed ? seed.plan : 'Standard', quotaTotal: seed ? seed.quotaTotal : 100, quotaUsed: 0, paid: true, profileStatus: 'Live', sentProposalCodes: [], profile: sp, documents: (sp && sp.documents) || null, imagesMeta: (sp && sp.imagesMeta) || null, qualityReview: (sp && sp.qualityReview) || 'pending', pendingChanges: null, accountStatus: 'active', dashboardLoginEnabled: true, paymentMethod: null, pendingExpiresAt: null, orderCode: null };
      writeJSON(LS.BIZ_STATE + id, state);
    } else if (!state.profile && SEED_PROFILES[id] && !state._seededProfile) {
      // Backfill curated profile into pre-existing seed-business states (so Quality Score works on old demos).
      var sp2 = cloneSeedProfile(id);
      state.profile = sp2; state._seededProfile = true;
      if (!state.documents) state.documents = sp2.documents;
      if (!state.imagesMeta) state.imagesMeta = sp2.imagesMeta;
      if (!state.qualityReview) state.qualityReview = sp2.qualityReview || 'pending';
      writeJSON(LS.BIZ_STATE + id, state);
    }
    if (state.accountStatus === undefined) {
      // Backfill: record was saved before the V1.5 payment-gate fields existed — treat it as already active
      // (it was created/paid under the pre-gate flow) rather than silently locking out existing accounts.
      state.accountStatus = 'active'; state.dashboardLoginEnabled = true;
      if (state.paymentMethod === undefined) state.paymentMethod = null;
      if (state.pendingExpiresAt === undefined) state.pendingExpiresAt = null;
      if (state.orderCode === undefined) state.orderCode = null;
      writeJSON(LS.BIZ_STATE + id, state);
    }
    return state;
  }
  function saveBusinessState(id, state) { writeJSON(LS.BIZ_STATE + id, state); }

  function getInvestorState(id) {
    var state = readJSON(LS.INV_STATE + id, null);
    if (!state) {
      // Seed the default contact from the real imported/admin-private record when one matches this state id
      // (Admin_Private_Source name/email) — only fall back to the generic placeholder if no real data exists.
      var matched = null;
      try { matched = getInvestors().find(function (inv) { return investorStateId(inv.code) === id; }); } catch (e) {}
      var defaultContact = (matched && (matched._privateName || matched._privateEmail))
        ? { name: matched._privateName || 'Primary Contact', email: matched._privateEmail || '', phone: '', role: matched._adminPosition || 'Primary', isPrimary: true }
        : { name: 'Primary Contact', email: 'contact@example.com', phone: '+65 0000 0000', role: 'Managing Partner', isPrimary: true };
      // Imported/seed investor accounts are pre-activated by Admin (payment gate applies to newly self-registered accounts).
      state = { id: id, contacts: [defaultContact], overrides: {}, accountStatus: 'active', dashboardLoginEnabled: true, paid: true, plan: null, paymentMethod: null, pendingExpiresAt: null, orderCode: null };
      writeJSON(LS.INV_STATE + id, state);
    } else if (state.accountStatus === undefined) {
      // Backfill: record predates the V1.5 payment-gate fields — treat as already active rather than locking it out.
      state.accountStatus = 'active'; state.dashboardLoginEnabled = true;
      if (state.paid === undefined) state.paid = true;
      if (state.paymentMethod === undefined) state.paymentMethod = null;
      if (state.pendingExpiresAt === undefined) state.pendingExpiresAt = null;
      if (state.orderCode === undefined) state.orderCode = null;
      writeJSON(LS.INV_STATE + id, state);
    }
    return state;
  }
  function saveInvestorState(id, state) { writeJSON(LS.INV_STATE + id, state); }

  function getAdvisorState(id) {
    var state = readJSON(LS.ADV_STATE + id, null);
    if (!state) {
      state = { id: id, accountStatus: 'payment_pending', dashboardLoginEnabled: false, paid: false, plan: null, dealCount: 1, paymentMethod: null, pendingExpiresAt: null, orderCode: null };
      writeJSON(LS.ADV_STATE + id, state);
    } else if (state.accountStatus === undefined) {
      state.accountStatus = 'active'; state.dashboardLoginEnabled = true;
      writeJSON(LS.ADV_STATE + id, state);
    }
    return state;
  }
  function saveAdvisorState(id, state) { writeJSON(LS.ADV_STATE + id, state); }

  // ---------- Registry of self-registered accounts (so Admin can find/approve them) ----------
  function getRegistry() { return readJSON(LS.REGISTRY, []); }
  function addToRegistry(role, id) {
    var reg = getRegistry();
    if (!reg.some(function (r) { return r.role === role && r.id === id; })) {
      reg.push({ role: role, id: id, createdAt: new Date().toISOString() });
      writeJSON(LS.REGISTRY, reg);
    }
  }

  // ---------- Payment gate V1.5 ----------
  // canAccessDashboard: account must be fully paid/approved AND explicitly unlocked by Admin.
  function canAccessDashboard(acct) {
    if (!acct) return false;
    return acct.accountStatus === 'active' && acct.dashboardLoginEnabled === true;
  }
  function getAccountState(role, id) {
    if (role === 'business') return getBusinessState(id);
    if (role === 'investor') return getInvestorState(id);
    if (role === 'advisor') return getAdvisorState(id);
    if (role === 'affiliate') return getAffiliateAccount(id);
    return null;
  }
  function saveAccountState(role, id, state) {
    if (role === 'business') return saveBusinessState(id, state);
    if (role === 'investor') return saveInvestorState(id, state);
    if (role === 'advisor') return saveAdvisorState(id, state);
    if (role === 'affiliate') return saveAffiliateAccount(id, state);
  }
  function daysLeft(iso) {
    if (!iso) return null;
    var ms = new Date(iso).getTime() - Date.now();
    return Math.max(0, Math.ceil(ms / 86400000));
  }
  // Called when the user ticks the bank-transfer form: profile saved in payment_pending for 7 days.
  function submitBankTransferOrder(role, id, extra) {
    var acct = getAccountState(role, id);
    var patch = Object.assign({}, extra, {
      accountStatus: 'payment_pending', dashboardLoginEnabled: false, paid: false,
      paymentMethod: 'bank_qr', pendingExpiresAt: new Date(Date.now() + 7 * 86400000).toISOString()
    });
    var next = Object.assign({}, acct, patch);
    saveAccountState(role, id, next);
    addToRegistry(role, id);
    logAudit('payment_order_created', role + ' ' + id + ' → payment_pending (7-day hold)');
    return next;
  }
  // Admin: confirms the bank transfer arrived → content still needs profile/content review before going live.
  function confirmBankTransfer(role, id) {
    var acct = getAccountState(role, id);
    var next = Object.assign({}, acct, { paid: true, accountStatus: 'pending_admin_review' });
    saveAccountState(role, id, next);
    logAudit('payment_confirmed', role + ' ' + id + ' → pending_admin_review');
    return next;
  }
  // Admin: approves content/profile → account fully active, Dashboard unlocked.
  function approveAccount(role, id) {
    var acct = getAccountState(role, id);
    var patch = { accountStatus: 'active', dashboardLoginEnabled: true };
    if (role === 'business') patch.profileStatus = 'Live';
    var next = Object.assign({}, acct, patch);
    saveAccountState(role, id, next);
    logAudit('account_approved', role + ' ' + id + ' → active');
    return next;
  }
  function setAccountStatus(role, id, status) {
    var acct = getAccountState(role, id);
    var patch = { accountStatus: status };
    if (status !== 'active') patch.dashboardLoginEnabled = false;
    if (role === 'business' && status === 'expired') patch.profileStatus = 'Expired';
    if (role === 'business' && status === 'hidden') patch.profileStatus = 'Hidden';
    var next = Object.assign({}, acct, patch);
    saveAccountState(role, id, next);
    logAudit('account_status_changed', role + ' ' + id + ' → ' + status);
    return next;
  }

  function getProposals() { return readJSON(LS.PROPOSALS, []); }
  function saveProposals(list) { writeJSON(LS.PROPOSALS, list); }

  function canSendProposal(bizId, investorCode) {
    var session = getSession();
    if (!session || session.role !== 'business') return { ok: false, reason: 'not_logged_in' };
    var biz = getBusinessState(session.id);
    if (!biz.paid) return { ok: false, reason: 'not_paid' };
    if (biz.profileStatus !== 'Live') return { ok: false, reason: 'not_live' };
    if (biz.quotaUsed >= biz.quotaTotal) return { ok: false, reason: 'quota' };
    if (biz.sentProposalCodes.indexOf(investorCode) !== -1) return { ok: false, reason: 'duplicate' };
    return { ok: true };
  }

  function sendProposal(investorCode, message) {
    var session = getSession();
    if (!session || session.role !== 'business') return { ok: false, reason: 'not_logged_in' };
    var check = canSendProposal(session.id, investorCode);
    if (!check.ok) return check;
    var biz = getBusinessState(session.id);
    biz.quotaUsed += 1;
    biz.sentProposalCodes.push(investorCode);
    saveBusinessState(session.id, biz);
    var proposals = getProposals();
    var code = 'PR-' + pad(proposals.length + 1, 4);
    proposals.push({ code: code, businessId: session.id, investorCode: investorCode, status: 'sent', sentAt: new Date().toISOString(), message: message || '' });
    saveProposals(proposals);
    return { ok: true, code: code, quotaUsed: biz.quotaUsed, quotaTotal: biz.quotaTotal };
  }

  // ---------- Admin-only helpers ----------
  var LS_ADMIN_INV = 'd68_admin_inv_', LS_AUDIT = 'd68_audit_log';

  function getInvestorAdminOverride(code) {
    return readJSON(LS_ADMIN_INV + code, { live: true, verified: null, priority: false, activityLevel: null, quotaNote: '' });
  }
  function setInvestorAdminOverride(code, patch) {
    var cur = getInvestorAdminOverride(code);
    var next = Object.assign({}, cur, patch);
    writeJSON(LS_ADMIN_INV + code, next);
    return next;
  }

  function getAuditLog() { return readJSON(LS_AUDIT, []); }
  function logAudit(action, detail) {
    var log = getAuditLog();
    log.unshift({ ts: new Date().toISOString(), action: action, detail: detail || '' });
    if (log.length > 200) log.length = 200;
    writeJSON(LS_AUDIT, log);
    return log;
  }

  function adminOverrideQuota(bizId, mode, value) {
    var biz = getBusinessState(bizId);
    if (mode === 'set') biz.quotaTotal = value;
    else if (mode === 'add') biz.quotaTotal = biz.quotaTotal + value;
    else if (mode === 'reset') biz.quotaUsed = 0;
    saveBusinessState(bizId, biz);
    logAudit('quota_override', bizId + ' → ' + mode + ' ' + value + ' (total now ' + biz.quotaTotal + ', used ' + biz.quotaUsed + ')');
    return biz;
  }

  function setBusinessProfileStatus(bizId, status) {
    var biz = getBusinessState(bizId);
    biz.profileStatus = status;
    saveBusinessState(bizId, biz);
    logAudit('business_status', bizId + ' → ' + status);
    return biz;
  }

  // NEW: sending a Live profile back to Admin review after the DN edits sensitive data (financials/deal terms).
  function flagBusinessForReview(bizId, reasonVi, reasonEn) {
    var biz = getBusinessState(bizId);
    if (biz.profileStatus === 'Live') {
      biz.profileStatus = 'Pending review';
      biz.pendingReviewReasonVi = reasonVi || 'Cập nhật thông tin nhạy cảm';
      biz.pendingReviewReasonEn = reasonEn || reasonVi || 'Updated sensitive information';
      biz.pendingReviewSince = Date.now();
      saveBusinessState(bizId, biz);
      logAudit('business_flagged_review', bizId + ' → Pending review (' + biz.pendingReviewReasonVi + ')');
    }
    return biz;
  }
  // Admin: re-approve a business flagged for review, back to Live.
  function approveBusinessReview(bizId) {
    var biz = getBusinessState(bizId);
    biz.profileStatus = 'Live';
    biz.pendingReviewReasonVi = null; biz.pendingReviewReasonEn = null; biz.pendingReviewSince = null;
    saveBusinessState(bizId, biz);
    logAudit('business_review_approved', bizId + ' → Live');
    return biz;
  }

  // ---------- Request Data workflow: Investor → Admin queue → Business tab ----------
  var LS_REQDATA = 'd68_request_data_queue';
  function seedRequestData() {
    var now = Date.now(), day = 86400000;
    return [
      { id:'rq1', investorCode:'INV-0004', bizId:'infinitytech', requestedAt: now-2*day, fields:'Sao kê ngân hàng 6 tháng gần nhất', status:'pending' },
      { id:'rq2', investorCode:'INV-0011', bizId:'trongnhanseafoods', requestedAt: now-1*day, fields:'Hợp đồng xuất khẩu 2025', status:'pending' },
      { id:'rq3', investorCode:'INV-0002', bizId:'hkmedi', requestedAt: now-6*day, fields:'BCTC kiểm toán 2024', status:'fulfilled' }
    ];
  }
  function getRequestDataQueue() {
    var q = readJSON(LS_REQDATA, null);
    if (!q) { q = seedRequestData(); writeJSON(LS_REQDATA, q); }
    return q;
  }
  function addRequestData(bizId, investorCode, fields) {
    var q = getRequestDataQueue();
    var rec = { id: 'rq' + Date.now(), investorCode: investorCode, bizId: bizId, requestedAt: Date.now(), fields: fields, status: 'pending' };
    q = q.concat([rec]);
    writeJSON(LS_REQDATA, q);
    logAudit('request_data_created', investorCode + ' → ' + bizId + ': ' + fields);
    return rec;
  }
  function setRequestDataStatus(id, status) {
    var q = getRequestDataQueue().map(function (r) { return r.id === id ? Object.assign({}, r, { status: status }) : r; });
    writeJSON(LS_REQDATA, q);
    logAudit('request_data_status', id + ' → ' + status);
    return q;
  }
  function getRequestDataForBusiness(bizId) { return getRequestDataQueue().filter(function (r) { return r.bizId === bizId; }); }
  function getRequestDataForInvestor(code) { return getRequestDataQueue().filter(function (r) { return r.investorCode === code; }); }

  function decideProposalAdmin(code, status) {
    var list = getProposals().map(function (p) { return p.code === code ? Object.assign({}, p, { status: status }) : p; });
    saveProposals(list);
    logAudit('proposal_decision', code + ' → ' + status);
  }

  function markEmailSent(code) {
    var list = getProposals().map(function (p) { return p.code === code ? Object.assign({}, p, { status: p.status === 'sent' ? 'email_sent' : p.status, adminEmailSentAt: new Date().toISOString() }) : p; });
    saveProposals(list);
    logAudit('email_sent', code);
  }

  function buildMailto(proposal, investor, business, contact) {
    var to = (contact && contact.email) || investor._privateEmail || '';
    var subject = '[Deals68] DN ' + (business ? (business.titleVi || business.id) : proposal.businessId) + ' muốn Nhà đầu tư xem xét cơ hội đầu tư';
    var bizLabel = business ? (business.titleVi || business.id) : proposal.businessId;
    var invLabel = (contact && contact.name) || investor.titleVi || investor.code;
    var loginUrl = location.origin + location.pathname.replace(/[^/]+$/, '') + 'Deals68 Investor Dashboard.dc.html';
    var body = 'Kính gửi ' + invLabel + ',\n\n' +
      'DN ' + bizLabel + ' đã gửi hồ sơ/proposal tới Nhà đầu tư qua Deals68.com.\n' +
      'Link xem hồ sơ DN: Deals68 Deal.dc.html?bizid=' + (business ? business.bizid : '') + '\n' +
      'Tài khoản NĐT: ' + investor.code + '\n' +
      'Link đăng nhập: ' + loginUrl + '\n\n' +
      'Vui lòng đăng nhập để xem thông tin, tài liệu được phép hiển thị và chọn Duyệt phù hợp / Từ chối.\n' +
      'Lưu ý: thông tin được chia sẻ theo điều khoản bảo mật của Deals68.com.\n\nDeals68 Team';
    var mailto = 'mailto:' + encodeURIComponent(to) + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
    return mailto;
  }

  // ---------- Credentials (login / forgot / reset password) ----------
  function getCredentials() {
    var creds = readJSON(LS.CREDS, null);
    if (!creds) {
      creds = BUSINESS_SEED.map(function (b) { return { role: 'business', username: b.username, password: b.password, id: b.id }; })
        .concat([{ role: 'investor', username: INVESTOR_SAMPLE_ACCOUNT.username, password: INVESTOR_SAMPLE_ACCOUNT.password, id: INVESTOR_SAMPLE_ACCOUNT.id }]);
      writeJSON(LS.CREDS, creds);
    }
    // Safe public demo aliases (never expose a real business username on the login page).
    var changed = false;
    if (!creds.find(function (c) { return c.role === 'business' && c.username === 'demo_business'; })) {
      creds.push({ role: 'business', username: 'demo_business', password: 'deals68demo', id: BUSINESS_SEED[0].id });
      changed = true;
    }
    if (!creds.find(function (c) { return c.role === 'investor' && c.username === 'demo_investor'; })) {
      creds.push({ role: 'investor', username: 'demo_investor', password: 'deals68demo', id: INVESTOR_SAMPLE_ACCOUNT.id });
      changed = true;
    }
    if (!creds.find(function (c) { return c.role === 'affiliate' && c.username === 'affiliate@deals68.com'; })) {
      creds.push({ role: 'affiliate', username: 'affiliate@deals68.com', password: 'deals68aff', id: 'aff' });
      changed = true;
    }
    if (changed) writeJSON(LS.CREDS, creds);
    return creds;
  }
  function addCredential(role, username, password, id) {
    var creds = getCredentials().filter(function (c) { return !(c.role === role && c.username === username); });
    creds.push({ role: role, username: username, password: password, id: id });
    writeJSON(LS.CREDS, creds);
  }
  function findCredential(role, username, password) {
    return getCredentials().find(function (c) { return c.role === role && c.username === username && c.password === password; });
  }
  function findCredentialByUsername(role, username) {
    return getCredentials().find(function (c) { return c.role === role && c.username === username; });
  }
  function updateCredentialPassword(role, username, newPassword) {
    var creds = getCredentials();
    var c = creds.find(function (x) { return x.role === role && x.username === username; });
    if (c) { c.password = newPassword; writeJSON(LS.CREDS, creds); return true; }
    return false;
  }

  // ---------- Promo codes V1.5 (Admin > Growth > Promo Codes) ----------
  var LS_PROMOS = 'd68_promo_codes';
  function normalizePromoCode(code) { return (code || '').trim().toUpperCase(); }

  function defaultPromoSeed() {
    return [
      { code:'DEALS68', name:'Beta launch –10%', discountPercent:10, appliesToRoles:['business','investor','advisor'], usageLimitTotal:null, usageLimitByRole:{business:null,investor:null,advisor:null}, usedTotal:0, usedByRole:{business:0,investor:0,advisor:0}, validFrom:null, validTo:null, status:'active' },
      { code:'LAUNCH20', name:'Launch campaign –20%', discountPercent:20, appliesToRoles:['business','investor','advisor'], usageLimitTotal:null, usageLimitByRole:{business:null,investor:null,advisor:null}, usedTotal:0, usedByRole:{business:0,investor:0,advisor:0}, validFrom:null, validTo:null, status:'active' },
      { code:'VCPC15', name:'VCPC partner –15%', discountPercent:15, appliesToRoles:['business','investor','advisor'], usageLimitTotal:null, usageLimitByRole:{business:null,investor:null,advisor:null}, usedTotal:0, usedByRole:{business:0,investor:0,advisor:0}, validFrom:null, validTo:null, status:'active' },
      { code:'DEALS68BETA', name:'Deals68Beta — 100% Business + Investor', discountPercent:100, appliesToRoles:['business','investor'], usageLimitTotal:null, usageLimitByRole:{business:68,investor:68,advisor:0}, usedTotal:0, usedByRole:{business:0,investor:0,advisor:0}, validFrom:null, validTo:'2026-07-30T23:59:59', status:'active' }
    ];
  }

  function getPromoCodes() {
    var list = readJSON(LS_PROMOS, null);
    if (!list) { list = defaultPromoSeed(); writeJSON(LS_PROMOS, list); }
    return list;
  }
  function savePromoCodes(list) { writeJSON(LS_PROMOS, list); }

  function computedPromoStatus(p) {
    var now = Date.now();
    if (p.status === 'paused' || p.status === 'draft') return p.status;
    if (p.validTo && now > new Date(p.validTo).getTime()) return 'expired';
    var totalExhausted = p.usageLimitTotal != null && p.usedTotal >= p.usageLimitTotal;
    var roleLimits = p.usageLimitByRole || {};
    var roleKeys = Object.keys(roleLimits).filter(function (r) { return p.appliesToRoles.indexOf(r) !== -1; });
    var allRoleExhausted = roleKeys.length > 0 && roleKeys.every(function (r) { return roleLimits[r] != null && (p.usedByRole[r] || 0) >= roleLimits[r]; });
    if (totalExhausted || allRoleExhausted) return 'exhausted';
    return 'active';
  }

  function validatePromo(codeRaw, role) {
    var code = normalizePromoCode(codeRaw);
    if (!code) return { ok:false, reason:'not_found' };
    var promo = getPromoCodes().find(function (p) { return p.code === code; });
    if (!promo) return { ok:false, reason:'not_found' };
    var effStatus = computedPromoStatus(promo);
    if (effStatus === 'paused' || effStatus === 'draft') return { ok:false, reason:'paused', promo:promo };
    if (effStatus === 'expired') return { ok:false, reason:'expired', promo:promo };
    if (effStatus === 'exhausted') return { ok:false, reason:'exhausted', promo:promo };
    if (promo.validFrom && Date.now() < new Date(promo.validFrom).getTime()) return { ok:false, reason:'not_started', promo:promo };
    if (promo.appliesToRoles.indexOf(role) === -1) return { ok:false, reason:'wrong_role', promo:promo };
    return { ok:true, promo:promo };
  }

  function redeemPromo(codeRaw, role) {
    var code = normalizePromoCode(codeRaw);
    var list = getPromoCodes();
    var idx = list.findIndex(function (p) { return p.code === code; });
    if (idx === -1) return false;
    var p = list[idx];
    p.usedTotal = (p.usedTotal || 0) + 1;
    p.usedByRole = p.usedByRole || {};
    p.usedByRole[role] = (p.usedByRole[role] || 0) + 1;
    p.status = computedPromoStatus(p);
    list[idx] = p;
    savePromoCodes(list);
    logAudit('promo_redeemed', code + ' by ' + role + ' (used ' + p.usedTotal + (p.usageLimitTotal ? '/' + p.usageLimitTotal : '') + ')');
    return true;
  }

  function adminSavePromo(promo) {
    var list = getPromoCodes();
    var code = normalizePromoCode(promo.code);
    promo.code = code;
    var idx = list.findIndex(function (p) { return p.code === code; });
    if (!promo.usedTotal) promo.usedTotal = idx !== -1 ? list[idx].usedTotal : 0;
    if (!promo.usedByRole) promo.usedByRole = idx !== -1 ? list[idx].usedByRole : {business:0,investor:0,advisor:0};
    if (idx === -1) list.push(promo); else list[idx] = promo;
    savePromoCodes(list);
    logAudit('promo_saved', code);
    return promo;
  }
  function adminSetPromoStatus(code, status) {
    var list = getPromoCodes();
    var p = list.find(function (x) { return x.code === normalizePromoCode(code); });
    if (p) { p.status = status; savePromoCodes(list); logAudit('promo_status', p.code + ' → ' + status); }
    return p;
  }
  function adminDeletePromo(code) {
    savePromoCodes(getPromoCodes().filter(function (p) { return p.code !== normalizePromoCode(code); }));
    logAudit('promo_deleted', normalizePromoCode(code));
  }

  // V1.6: duplicate investor email check — against investor accounts AND investor contact emails.
  function checkInvestorEmailDuplicate(emailRaw) {
    var email = (emailRaw || '').trim().toLowerCase();
    if (!email) return { duplicate: false };
    // 1) existing investor account
    var acc = findCredentialByUsername('investor', email);
    if (acc) return { duplicate: true, kind: 'account' };
    // 2) imported/seed investor contact emails (admin-only data — never exposed, only used for the check)
    var inv = getInvestors().find(function (i) { return (i._privateEmail || '').toLowerCase() === email; });
    if (inv) return { duplicate: true, kind: 'contact', profile: { code: inv.code, titleVi: inv.titleVi, titleEn: inv.titleEn, type: inv.type, country: inv.country, countryVi: inv.countryVi } };
    // 3) self-registered investor contacts
    var reg = getRegistry().filter(function (r) { return r.role === 'investor'; });
    for (var k = 0; k < reg.length; k++) {
      var s = getInvestorState(reg[k].id);
      if ((s.contacts || []).some(function (c) { return (c.email || '').toLowerCase() === email; })) {
        return { duplicate: true, kind: 'contact', profile: { code: s.code || reg[k].id, titleVi: '', titleEn: '', type: (s.overrides && s.overrides.type) || '', country: (s.overrides && s.overrides.country) || '' } };
      }
    }
    return { duplicate: false };
  }

  // ---------- Business plan pricing V1.6.1 ----------
  // Featured (Ưu tiên) = Standard × 1.3. Upgrade Standard→Featured charges only the difference.
  var BIZ_PLAN_MULT = { Standard: 1.0, Featured: 1.3 };
  function bizBaseUnit(country) { return country === 'Vietnam' ? 500000 : 20; }
  function bizPlanUnitPrice(plan, country) { return Math.round(bizBaseUnit(country) * (BIZ_PLAN_MULT[plan] || 1)); }
  // Prorated upgrade cost: difference in plan price for the remaining paid term (units).
  function bizUpgradeCost(fromPlan, toPlan, country, units) {
    var diff = (BIZ_PLAN_MULT[toPlan] || 1) - (BIZ_PLAN_MULT[fromPlan] || 1);
    if (diff <= 0) return 0;
    return Math.round(bizBaseUnit(country) * diff * (units || 1));
  }

  // Zero-value (100%-off) order: no bank transfer to wait for, straight to admin content review.
  function submitPromoFreeOrder(role, id, extra) {
    var acct = getAccountState(role, id);
    var patch = Object.assign({}, extra, {
      accountStatus: 'pending_admin_review', dashboardLoginEnabled: false, paid: true, paymentMethod: 'promo_100', pendingExpiresAt: null
    });
    var next = Object.assign({}, acct, patch);
    saveAccountState(role, id, next);
    addToRegistry(role, id);
    logAudit('promo_100_order', role + ' ' + id + ' → pending_admin_review (promo 100%)');
    return next;
  }

  // ---------- Affiliate program V1.6 ----------
  var LS_AFFILIATE = 'd68_affiliate_state';

  // Commission tier by number of paid conversions: <5 = Referral Partner 12%, 5–14 = Market Partner 18%, 15+ = Senior Market Partner 22%.
  function affiliateTier(conversions) {
    if (conversions >= 15) return { rate: 0.22, name: 'Senior Market Partner', nameVi: 'Đối tác thị trường cấp cao' };
    if (conversions >= 5) return { rate: 0.18, name: 'Market Partner', nameVi: 'Đối tác thị trường' };
    return { rate: 0.12, name: 'Referral Partner', nameVi: 'Đối tác giới thiệu' };
  }

  function affiliateSeed() {
    var now = Date.now();
    var day = 86400000;
    return {
      code: 'D68MP-VN-014',
      name: 'Phi Nguyen',
      email: 'affiliate@deals68.com',
      country: 'VN',
      customerDiscountPercent: 15,
      status: 'active',
      joinedAt: new Date(now - 74 * day).toISOString(),
      payoutMethod: { type: 'bank', bank: 'Vietcombank', account: '0011•••••713', holder: 'NGUYEN VAN PHI' },
      referrals: [
        { id:'r1', maskedName:'DN Chuỗi F&B (HCM)', role:'business', clickedAt:new Date(now-40*day).toISOString(), status:'paid',      plan:'Featured', grossVnd:6800000, ts:now-38*day },
        { id:'r2', maskedName:'NĐT Cá nhân (Hà Nội)', role:'investor', clickedAt:new Date(now-36*day).toISOString(), status:'paid',      plan:'Investor 6 tháng', grossVnd:6000000, ts:now-34*day },
        { id:'r3', maskedName:'DN Sản xuất (Bình Dương)', role:'business', clickedAt:new Date(now-30*day).toISOString(), status:'paid',  plan:'Standard', grossVnd:2000000, ts:now-28*day },
        { id:'r4', maskedName:'DN EdTech (HCM)', role:'business', clickedAt:new Date(now-22*day).toISOString(), status:'pending',        plan:'Featured', grossVnd:6800000, ts:now-22*day },
        { id:'r5', maskedName:'NĐT Family Office (SG)', role:'investor', clickedAt:new Date(now-18*day).toISOString(), status:'paid',    plan:'Investor 12 tháng', grossVnd:10800000, ts:now-16*day },
        { id:'r6', maskedName:'DN Logistics (Hải Phòng)', role:'business', clickedAt:new Date(now-12*day).toISOString(), status:'clicked', plan:null, grossVnd:0, ts:now-12*day },
        { id:'r7', maskedName:'Cố vấn M&A (HCM)', role:'advisor', clickedAt:new Date(now-9*day).toISOString(), status:'signup',          plan:null, grossVnd:0, ts:now-9*day },
        { id:'r8', maskedName:'DN Bán lẻ (Đà Nẵng)', role:'business', clickedAt:new Date(now-4*day).toISOString(), status:'clicked',     plan:null, grossVnd:0, ts:now-4*day }
      ],
      payouts: [
        { id:'p1', periodLabel:'Tháng 5/2026', amountVnd:1920000, status:'paid', paidAt:new Date(now-20*day).toISOString() },
        { id:'p2', periodLabel:'Tháng 6/2026', amountVnd:2520000, status:'processing', paidAt:null }
      ]
    };
  }

  function getAffiliateState() {
    var s = readJSON(LS_AFFILIATE, null);
    if (!s) { s = affiliateSeed(); writeJSON(LS_AFFILIATE, s); }
    return s;
  }
  function saveAffiliateState(s) { writeJSON(LS_AFFILIATE, s); }

  // ---------- Self-registered affiliates (NEW): Register → Admin approval gate → Login ----------
  var LS_AFF_ACCOUNTS = 'd68_affiliate_accounts';
  function getAffAccounts() { return readJSON(LS_AFF_ACCOUNTS, {}); }
  function saveAffAccounts(map) { writeJSON(LS_AFF_ACCOUNTS, map); }
  // Unifies the legacy single demo affiliate ('aff') with newly self-registered ones under one account-state shape.
  function getAffiliateAccount(id) {
    if (id === 'aff' || !id) {
      var demo = getAffiliateState();
      return { id: 'aff', name: demo.name, email: demo.email, code: demo.code, country: demo.country, payoutMethod: demo.payoutMethod, accountStatus: 'active', dashboardLoginEnabled: true, paid: true };
    }
    var map = getAffAccounts();
    return map[id] || null;
  }
  function saveAffiliateAccount(id, state) {
    if (id === 'aff') return;
    var map = getAffAccounts();
    map[id] = state;
    saveAffAccounts(map);
  }
  function registerAffiliate(data) {
    var code = 'D68MP-' + (data.country || 'INTL') + '-' + Math.floor(100 + Math.random() * 900);
    var id = 'aff_' + code.toLowerCase().replace(/[^a-z0-9]/g, '');
    var state = {
      id: id, code: code, name: data.name, email: data.email, phone: data.phone || '', country: data.country || '', intro: data.intro || '',
      payoutMethod: data.payoutMethod || { type: 'bank', bank: '', account: '', holder: '' },
      accountStatus: 'pending_admin_review', dashboardLoginEnabled: false, paid: true,
      joinedAt: new Date().toISOString(), referrals: [], payouts: []
    };
    saveAffiliateAccount(id, state);
    addCredential('affiliate', data.email, data.password, id);
    addToRegistry('affiliate', id);
    logAudit('market_partner_registered', id + ' — pending admin approval');
    return state;
  }

  function affiliateStats() {
    var s = getAffiliateState();
    var refs = s.referrals || [];
    var clicks = refs.length;
    var signups = refs.filter(function (r) { return r.status !== 'clicked'; }).length;
    var paid = refs.filter(function (r) { return r.status === 'paid'; });
    var conversions = paid.length;
    var tier = affiliateTier(conversions);
    var grossPaid = paid.reduce(function (a, r) { return a + (r.grossVnd || 0); }, 0);
    var commissionEarned = Math.round(grossPaid * tier.rate);
    var pendingConv = refs.filter(function (r) { return r.status === 'pending'; });
    var pendingGross = pendingConv.reduce(function (a, r) { return a + (r.grossVnd || 0); }, 0);
    var commissionPending = Math.round(pendingGross * tier.rate);
    var paidOut = (s.payouts || []).filter(function (p) { return p.status === 'paid'; }).reduce(function (a, p) { return a + (p.amountVnd || 0); }, 0);
    var available = Math.max(0, commissionEarned - paidOut);
    // Next tier progress
    var nextThreshold = conversions >= 15 ? null : (conversions >= 5 ? 15 : 5);
    return {
      clicks: clicks, signups: signups, conversions: conversions, convRate: signups > 0 ? Math.round(conversions / signups * 100) : 0,
      tier: tier, grossPaid: grossPaid, commissionEarned: commissionEarned, commissionPending: commissionPending,
      paidOut: paidOut, available: available, nextThreshold: nextThreshold, toNextTier: nextThreshold ? (nextThreshold - conversions) : 0
    };
  }

  // ---------- Fit Score + Watchlist + Alerts (V1.6.1 investor matching) ----------
  function computeFitScore(criteria, biz) {
    // criteria: { industries[], dealTypes[], stage, ticketMin, ticketMax, country }
    // biz: BUSINESS_SEED entry merged with profile (industry/dealType strings, country, ask/revenue)
    var score = 0; var max = 0;
    var bizIndustries = (biz.industry || '').split(';').map(function (s) { return s.trim().toLowerCase(); }).filter(Boolean);
    var bizDealTypes = (biz.dealType || '').split(';').map(function (s) { return s.trim().toLowerCase(); }).filter(Boolean);
    max += 40;
    if (criteria.industries && criteria.industries.length) {
      var indHit = criteria.industries.some(function (ci) { return bizIndustries.some(function (bi) { return bi.indexOf(ci.toLowerCase()) !== -1 || ci.toLowerCase().indexOf(bi) !== -1; }); });
      if (indHit) score += 40;
    } else { score += 20; }
    max += 30;
    if (criteria.dealTypes && criteria.dealTypes.length) {
      var dealHit = criteria.dealTypes.some(function (cd) { return bizDealTypes.some(function (bd) { return bd.indexOf(cd.toLowerCase()) !== -1 || cd.toLowerCase().indexOf(bd) !== -1; }); });
      if (dealHit) score += 30;
    } else { score += 15; }
    max += 20;
    var bizCountry = (biz.country || 'Vietnam');
    if (!criteria.country || criteria.country === bizCountry) score += 20; else score += 4;
    max += 10;
    score += 10; // ticket-fit placeholder — refine once deal-size figures are structured for matching
    return Math.round((score / max) * 100);
  }

  function getRecommendedBusinesses(criteria, limit) {
    var out = BUSINESS_SEED.map(function (b) {
      var st = getBusinessState(b.id);
      var prof = st.profile || {};
      var merged = { industry: prof.industry || b.industry, dealType: prof.dealType || b.dealType, country: prof.country || 'Vietnam' };
      return { biz: b, fitScore: computeFitScore(criteria, merged), status: st.profileStatus };
    }).filter(function (x) { return x.status === 'Live'; })
      .sort(function (a, b) { return b.fitScore - a.fitScore; });
    return limit ? out.slice(0, limit) : out;
  }

  var LS_WATCHLIST = 'd68_investor_watchlist_';
  function getWatchlist(investorId) { return readJSON(LS_WATCHLIST + investorId, []); }
  function toggleWatchlist(investorId, bizId) {
    var list = getWatchlist(investorId);
    var idx = list.indexOf(bizId);
    if (idx === -1) list.push(bizId); else list.splice(idx, 1);
    writeJSON(LS_WATCHLIST + investorId, list);
    return list;
  }

  var LS_ALERTS = 'd68_investor_alerts_';
  function getAlerts(investorId) {
    var a = readJSON(LS_ALERTS + investorId, null);
    if (!a) {
      var now = Date.now(), day = 86400000;
      a = {
        prefs: { newMatch: true, priceChange: true, proposalUpdate: true, weeklyDigest: false },
        items: [
          { id:'al1', type:'new_match', ts: now - 2*day, read:false, text: 'Hồ sơ mới phù hợp tiêu chí của bạn vừa được đăng.' },
          { id:'al2', type:'proposal_update', ts: now - 5*day, read:false, text: 'Một proposal bạn nhận được đã được Business cập nhật số liệu.' },
          { id:'al3', type:'price_change', ts: now - 9*day, read:true, text: 'Một hồ sơ trong danh sách theo dõi đã điều chỉnh mức định giá.' }
        ]
      };
      writeJSON(LS_ALERTS + investorId, a);
    }
    return a;
  }
  function saveAlerts(investorId, a) { writeJSON(LS_ALERTS + investorId, a); }
  function markAlertRead(investorId, alertId) {
    var a = getAlerts(investorId);
    a.items = a.items.map(function (x) { return x.id === alertId ? Object.assign({}, x, { read:true }) : x; });
    saveAlerts(investorId, a);
    return a;
  }

  // ---------- Investor interest / connection (NEW-3) ----------
  var LS_INTERESTS = 'd68_interests';
  function seedInterests() {
    var now = Date.now(), day = 86400000;
    var seed = [
      { bizId:'hkmedi', investorCode:'INV-0002', ts: now-6*day, status:'connected' },
      { bizId:'hkmedi', investorCode:'INV-0001', ts: now-3*day, status:'interested' },
      { bizId:'hkmedi', investorCode:'INV-0005', ts: now-1*day, status:'interested' },
      { bizId:'phongcua', investorCode:'INV-0003', ts: now-2*day, status:'interested' }
    ];
    writeJSON(LS_INTERESTS, seed);
    return seed;
  }
  function getInterests() { var l = readJSON(LS_INTERESTS, null); return l || seedInterests(); }
  function saveInterests(list) { writeJSON(LS_INTERESTS, list); }
  function expressInterest(bizId, investorCode) {
    var list = getInterests();
    if (!list.some(function (x) { return x.bizId === bizId && x.investorCode === investorCode; })) {
      list.push({ bizId: bizId, investorCode: investorCode, ts: Date.now(), status: 'interested' });
      saveInterests(list);
      logAudit('interest_expressed', investorCode + ' → ' + bizId);
    }
    return list;
  }
  function setInterestStatus(bizId, investorCode, status) {
    var list = getInterests().map(function (x) { return (x.bizId === bizId && x.investorCode === investorCode) ? Object.assign({}, x, { status: status }) : x; });
    saveInterests(list);
    logAudit('interest_status', investorCode + ' @ ' + bizId + ' → ' + status);
    return list;
  }
  function getInterestsForBusiness(bizId) { return getInterests().filter(function (x) { return x.bizId === bizId; }); }
  function hasExpressedInterest(bizId, investorCode) { return getInterests().some(function (x) { return x.bizId === bizId && x.investorCode === investorCode; }); }

  global.D68 = {
    getInvestors: getInvestors, rankingScore: rankingScore,
    getInterests: getInterests, expressInterest: expressInterest, setInterestStatus: setInterestStatus, getInterestsForBusiness: getInterestsForBusiness, hasExpressedInterest: hasExpressedInterest,
    addCredential: addCredential, findCredential: findCredential, findCredentialByUsername: findCredentialByUsername, updateCredentialPassword: updateCredentialPassword,
    BUSINESS_SEED: BUSINESS_SEED, getBusinessSeed: getBusinessSeed, INVESTOR_SAMPLE_ACCOUNT: INVESTOR_SAMPLE_ACCOUNT,
    getSession: getSession, setSession: setSession, clearSession: clearSession,
    getBusinessState: getBusinessState, saveBusinessState: saveBusinessState,
    computeQualityScore: computeQualityScore, qualityBand: qualityBand, setQualityReview: setQualityReview,
    getQualityCriteria: getQualityCriteria, saveQualityCriteria: saveQualityCriteria, resetQualityCriteria: resetQualityCriteria,
    getInvestorState: getInvestorState, saveInvestorState: saveInvestorState,
    getAdvisorState: getAdvisorState, saveAdvisorState: saveAdvisorState,
    getRegistry: getRegistry, addToRegistry: addToRegistry,
    canAccessDashboard: canAccessDashboard, getAccountState: getAccountState, saveAccountState: saveAccountState,
    daysLeft: daysLeft, submitBankTransferOrder: submitBankTransferOrder, submitPromoFreeOrder: submitPromoFreeOrder,
    checkInvestorEmailDuplicate: checkInvestorEmailDuplicate,
    BIZ_PLAN_MULT: BIZ_PLAN_MULT, bizBaseUnit: bizBaseUnit, bizPlanUnitPrice: bizPlanUnitPrice, bizUpgradeCost: bizUpgradeCost,
    computeFitScore: computeFitScore, getRecommendedBusinesses: getRecommendedBusinesses,
    getWatchlist: getWatchlist, toggleWatchlist: toggleWatchlist,
    getAlerts: getAlerts, saveAlerts: saveAlerts, markAlertRead: markAlertRead,
    getAffiliateState: getAffiliateState, saveAffiliateState: saveAffiliateState, affiliateStats: affiliateStats, affiliateTier: affiliateTier,
    getAffiliateAccount: getAffiliateAccount, saveAffiliateAccount: saveAffiliateAccount, registerAffiliate: registerAffiliate,
    confirmBankTransfer: confirmBankTransfer, approveAccount: approveAccount, setAccountStatus: setAccountStatus,
    getPromoCodes: getPromoCodes, savePromoCodes: savePromoCodes, validatePromo: validatePromo, redeemPromo: redeemPromo,
    adminSavePromo: adminSavePromo, adminSetPromoStatus: adminSetPromoStatus, adminDeletePromo: adminDeletePromo, computedPromoStatus: computedPromoStatus,
    getProposals: getProposals, saveProposals: saveProposals,
    canSendProposal: canSendProposal, sendProposal: sendProposal,
    INDUSTRIES: INDUSTRIES, DEAL_TYPES: DEAL_TYPES, STAGES: STAGES,
    DEAL_TYPES_VI: DEAL_TYPES_VI, dealTypeLabel: dealTypeLabel, dealTypeLabelList: dealTypeLabelList,
    getInvestorAdminOverride: getInvestorAdminOverride, setInvestorAdminOverride: setInvestorAdminOverride,
    getAdminInvestors: getAdminInvestors, addAdminInvestor: addAdminInvestor, investorStateId: investorStateId,
    getAuditLog: getAuditLog, logAudit: logAudit,
    adminOverrideQuota: adminOverrideQuota, setBusinessProfileStatus: setBusinessProfileStatus,
    flagBusinessForReview: flagBusinessForReview, approveBusinessReview: approveBusinessReview,
    decideProposalAdmin: decideProposalAdmin, markEmailSent: markEmailSent, buildMailto: buildMailto,
    getRequestDataQueue: getRequestDataQueue, addRequestData: addRequestData, setRequestDataStatus: setRequestDataStatus,
    getRequestDataForBusiness: getRequestDataForBusiness, getRequestDataForInvestor: getRequestDataForInvestor
  };
})(window);
