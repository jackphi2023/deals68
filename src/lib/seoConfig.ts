export type SeoLanguage = 'vi' | 'en';

export type SeoDefinition = {
  pageNameVi: string;
  pageNameEn: string;
  descriptionVi: string;
  descriptionEn: string;
  noindex?: boolean;
  type?: 'website' | 'article';
};

export const SITE_URL = 'https://deals68.com';
export const DEFAULT_SOCIAL_IMAGE = '/assets/deals68-image.jpg';
export const SEO_SUFFIX_VI =
  'Sàn mua bán Doanh nghiệp, M&A, Chuyển nhượng, Huy động vốn, Cho vay';
export const SEO_SUFFIX_EN =
  'Business Sale, M&A, Transfers, Fundraising & Business Loans Marketplace';

const exactRoutes: Record<string, SeoDefinition> = {
  '/': {
    pageNameVi: 'Deals68.com',
    pageNameEn: 'Deals68.com',
    descriptionVi:
      'Deals68 kết nối doanh nghiệp cần mua bán, chuyển nhượng, huy động vốn hoặc vay vốn với nhà đầu tư, bên mua và đối tác tài chính.',
    descriptionEn:
      'Deals68 connects businesses seeking a sale, transfer, fundraising or loans with investors, buyers and financial partners.',
  },
  '/businesses': {
    pageNameVi: 'Doanh nghiệp gọi vốn, chuyển nhượng & M&A',
    pageNameEn: 'Businesses for Fundraising, Sale & M&A',
    descriptionVi:
      'Khám phá các hồ sơ doanh nghiệp ẩn danh đang gọi vốn, bán doanh nghiệp, chuyển nhượng tài sản, tìm đối tác hoặc vay vốn.',
    descriptionEn:
      'Explore anonymous business opportunities for fundraising, business sales, asset transfers, partnerships and loans.',
  },
  '/businesses/featured': {
    pageNameVi: 'Doanh nghiệp nổi bật',
    pageNameEn: 'Featured Businesses',
    descriptionVi:
      'Danh sách doanh nghiệp và cơ hội đầu tư nổi bật đang được giới thiệu trên Deals68.',
    descriptionEn:
      'Featured businesses and investment opportunities currently highlighted on Deals68.',
  },
  '/businesses/fundraising': {
    pageNameVi: 'Doanh nghiệp đang huy động vốn',
    pageNameEn: 'Businesses Raising Capital',
    descriptionVi:
      'Tìm doanh nghiệp đang huy động vốn cổ phần, vốn tăng trưởng hoặc hợp tác đầu tư.',
    descriptionEn:
      'Find businesses raising equity, growth capital or strategic investment.',
  },
  '/businesses/sale': {
    pageNameVi: 'Mua bán & chuyển nhượng doanh nghiệp',
    pageNameEn: 'Businesses for Sale & Transfer',
    descriptionVi:
      'Cơ hội mua bán doanh nghiệp, M&A, sang nhượng cửa hàng và chuyển nhượng tài sản kinh doanh.',
    descriptionEn:
      'Business sale, M&A, store transfer and operating asset transfer opportunities.',
  },
  '/businesses/debt': {
    pageNameVi: 'Doanh nghiệp cần vay vốn',
    pageNameEn: 'Business Loan Opportunities',
    descriptionVi:
      'Hồ sơ doanh nghiệp đang tìm khoản vay, vốn lưu động hoặc giải pháp tài trợ phù hợp.',
    descriptionEn:
      'Businesses seeking loans, working capital and suitable financing solutions.',
  },
  '/investors': {
    pageNameVi: 'Danh sách Nhà đầu tư',
    pageNameEn: 'Investor Directory',
    descriptionVi:
      'Tìm nhà đầu tư cá nhân, quỹ đầu tư, doanh nghiệp chiến lược, bên mua và tổ chức cho vay phù hợp.',
    descriptionEn:
      'Find individual investors, funds, strategic buyers, corporations and lenders.',
  },
  '/investors/active': {
    pageNameVi: 'Nhà đầu tư đang hoạt động',
    pageNameEn: 'Active Investors',
    descriptionVi:
      'Danh sách nhà đầu tư đang tìm kiếm doanh nghiệp và cơ hội giao dịch trên Deals68.',
    descriptionEn:
      'Investors currently seeking businesses and transaction opportunities on Deals68.',
  },
  '/investors/funds': {
    pageNameVi: 'Quỹ đầu tư',
    pageNameEn: 'Investment Funds',
    descriptionVi:
      'Danh sách quỹ đầu tư quan tâm doanh nghiệp Việt Nam, Đông Nam Á và thị trường quốc tế.',
    descriptionEn:
      'Investment funds interested in Vietnam, Southeast Asia and international businesses.',
  },
  '/investors/strategic': {
    pageNameVi: 'Nhà đầu tư chiến lược',
    pageNameEn: 'Strategic Investors',
    descriptionVi:
      'Tìm doanh nghiệp, tập đoàn và bên mua chiến lược cho cơ hội hợp tác, đầu tư hoặc M&A.',
    descriptionEn:
      'Find corporations and strategic buyers for partnerships, investments and M&A.',
  },
  '/pricing': {
    pageNameVi: 'Bảng giá Deals68',
    pageNameEn: 'Deals68 Pricing',
    descriptionVi:
      'So sánh các gói dịch vụ dành cho doanh nghiệp, nhà đầu tư và đối tác trên Deals68.',
    descriptionEn:
      'Compare Deals68 service plans for businesses, investors and partners.',
  },
  '/pricing/business': {
    pageNameVi: 'Gói dịch vụ Doanh nghiệp',
    pageNameEn: 'Business Plans',
    descriptionVi:
      'Gói đăng hồ sơ doanh nghiệp, tiếp cận nhà đầu tư và quản lý cơ hội giao dịch trên Deals68.',
    descriptionEn:
      'Business listing, investor outreach and transaction management plans on Deals68.',
  },
  '/pricing/investor': {
    pageNameVi: 'Gói dịch vụ Nhà đầu tư',
    pageNameEn: 'Investor Plans',
    descriptionVi:
      'Gói tìm kiếm, lưu hồ sơ, yêu cầu dữ liệu và kết nối doanh nghiệp dành cho nhà đầu tư.',
    descriptionEn:
      'Search, save, data request and business connection plans for investors.',
  },
  '/valuation': {
    pageNameVi: 'Định giá doanh nghiệp',
    pageNameEn: 'Business Valuation',
    descriptionVi:
      'Ước tính giá trị doanh nghiệp dựa trên doanh thu, EBITDA, tăng trưởng, ngành và cấu trúc giao dịch.',
    descriptionEn:
      'Estimate business value using revenue, EBITDA, growth, industry and transaction structure.',
  },
  '/valuation/rules': {
    pageNameVi: 'Nguyên tắc định giá',
    pageNameEn: 'Valuation Methodology',
    descriptionVi:
      'Tìm hiểu nguyên tắc và dữ liệu tham chiếu được Deals68 sử dụng để hỗ trợ kiểm tra định giá.',
    descriptionEn:
      'Learn the methodology and benchmark inputs used by Deals68 for valuation checks.',
  },
  '/about': {
    pageNameVi: 'Về Deals68',
    pageNameEn: 'About Deals68',
    descriptionVi:
      'Tìm hiểu sứ mệnh, tầm nhìn và định hướng kết nối doanh nghiệp Việt Nam với nhà đầu tư toàn cầu của Deals68.',
    descriptionEn:
      'Learn about Deals68’s mission to connect Vietnamese businesses with global investors.',
  },
  '/how-it-works': {
    pageNameVi: 'Cách Deals68 hoạt động',
    pageNameEn: 'How Deals68 Works',
    descriptionVi:
      'Quy trình đăng hồ sơ, tìm kiếm, kết nối, yêu cầu dữ liệu và làm việc giữa doanh nghiệp với nhà đầu tư.',
    descriptionEn:
      'How businesses and investors list, discover, connect, request data and progress transactions.',
  },
  '/faq': {
    pageNameVi: 'Câu hỏi thường gặp',
    pageNameEn: 'Frequently Asked Questions',
    descriptionVi:
      'Giải đáp các câu hỏi thường gặp về đăng hồ sơ, bảo mật, kết nối nhà đầu tư, chi phí và giao dịch.',
    descriptionEn:
      'Answers about listings, privacy, investor connections, pricing and transactions.',
  },
  '/contact': {
    pageNameVi: 'Liên hệ Deals68',
    pageNameEn: 'Contact Deals68',
    descriptionVi:
      'Liên hệ Deals68 để được hỗ trợ đăng hồ sơ doanh nghiệp, tìm nhà đầu tư hoặc phát triển đối tác.',
    descriptionEn:
      'Contact Deals68 for business listings, investor search and partnership support.',
  },
  '/partners': {
    pageNameVi: 'Đối tác thị trường Deals68',
    pageNameEn: 'Deals68 Market Partners',
    descriptionVi:
      'Hợp tác phát triển thị trường, giới thiệu doanh nghiệp và nhà đầu tư cùng Deals68.',
    descriptionEn:
      'Partner with Deals68 to introduce businesses, investors and develop local markets.',
  },
  '/market-partner': {
    pageNameVi: 'Đối tác thị trường Deals68',
    pageNameEn: 'Deals68 Market Partners',
    descriptionVi:
      'Hợp tác phát triển thị trường, giới thiệu doanh nghiệp và nhà đầu tư cùng Deals68.',
    descriptionEn:
      'Partner with Deals68 to introduce businesses, investors and develop local markets.',
  },
  '/terms': {
    pageNameVi: 'Điều khoản sử dụng',
    pageNameEn: 'Terms of Use',
    descriptionVi:
      'Điều khoản sử dụng nền tảng Deals68 dành cho doanh nghiệp, nhà đầu tư, đối tác và người truy cập.',
    descriptionEn:
      'Deals68 terms of use for businesses, investors, partners and visitors.',
  },
  '/privacy': {
    pageNameVi: 'Chính sách bảo mật',
    pageNameEn: 'Privacy Policy',
    descriptionVi:
      'Chính sách thu thập, sử dụng và bảo vệ dữ liệu cá nhân, doanh nghiệp và nhà đầu tư trên Deals68.',
    descriptionEn:
      'How Deals68 collects, uses and protects personal, business and investor data.',
  },
  '/market-intelligence': {
    pageNameVi: 'Thông tin thị trường đầu tư & M&A',
    pageNameEn: 'Investment & M&A Market Intelligence',
    descriptionVi:
      'Thông tin thị trường, thương vụ đầu tư, M&A và xu hướng vốn dành cho doanh nghiệp và nhà đầu tư.',
    descriptionEn:
      'Market intelligence, investment deals, M&A activity and capital trends.',
  },
  '/localization': {
    pageNameVi: 'Deals68 tại các thị trường',
    pageNameEn: 'Deals68 Markets',
    descriptionVi:
      'Định hướng bản địa hóa Deals68 cho doanh nghiệp và nhà đầu tư tại Việt Nam cùng các thị trường quốc tế.',
    descriptionEn:
      'Deals68 localization for businesses and investors in Vietnam and international markets.',
  },
  '/login': {
    pageNameVi: 'Đăng nhập',
    pageNameEn: 'Log In',
    descriptionVi: 'Đăng nhập tài khoản Deals68.',
    descriptionEn: 'Log in to your Deals68 account.',
    noindex: true,
  },
  '/forgot-password': {
    pageNameVi: 'Quên mật khẩu',
    pageNameEn: 'Forgot Password',
    descriptionVi: 'Khôi phục quyền truy cập tài khoản Deals68.',
    descriptionEn: 'Recover access to your Deals68 account.',
    noindex: true,
  },
  '/reset-password': {
    pageNameVi: 'Đặt lại mật khẩu',
    pageNameEn: 'Reset Password',
    descriptionVi: 'Đặt lại mật khẩu tài khoản Deals68.',
    descriptionEn: 'Reset your Deals68 account password.',
    noindex: true,
  },
  '/checkout': {
    pageNameVi: 'Thanh toán',
    pageNameEn: 'Checkout',
    descriptionVi: 'Hoàn tất đăng ký dịch vụ Deals68.',
    descriptionEn: 'Complete your Deals68 service registration.',
    noindex: true,
  },
  '/payment/pending': {
    pageNameVi: 'Thanh toán đang xử lý',
    pageNameEn: 'Payment Pending',
    descriptionVi: 'Trạng thái thanh toán Deals68 đang được xử lý.',
    descriptionEn: 'Your Deals68 payment is being processed.',
    noindex: true,
  },
  '/payment/success': {
    pageNameVi: 'Thanh toán thành công',
    pageNameEn: 'Payment Successful',
    descriptionVi: 'Thanh toán dịch vụ Deals68 đã được ghi nhận.',
    descriptionEn: 'Your Deals68 service payment was recorded.',
    noindex: true,
  },
  '/messages': {
    pageNameVi: 'Tin nhắn',
    pageNameEn: 'Messages',
    descriptionVi: 'Tin nhắn riêng tư trên Deals68.',
    descriptionEn: 'Private Deals68 messages.',
    noindex: true,
  },
  '/notifications': {
    pageNameVi: 'Thông báo',
    pageNameEn: 'Notifications',
    descriptionVi: 'Thông báo tài khoản Deals68.',
    descriptionEn: 'Deals68 account notifications.',
    noindex: true,
  },
  '/support': {
    pageNameVi: 'Hỗ trợ tài khoản',
    pageNameEn: 'Account Support',
    descriptionVi: 'Trung tâm hỗ trợ tài khoản Deals68.',
    descriptionEn: 'Deals68 account support.',
    noindex: true,
  },
};

const englishPublicBasePaths = new Set([
  '/',
  '/businesses',
  '/investors',
  '/pricing',
  '/valuation',
  '/about',
  '/terms',
  '/privacy',
  '/contact',
  '/partners',
  '/market-partner',
]);

export function seoLanguageFromPath(pathname: string): SeoLanguage {
  return pathname === '/en' || pathname.startsWith('/en/') ? 'en' : 'vi';
}

export function stripSeoLanguagePrefix(pathname: string): string {
  const clean = `/${String(pathname || '/').split('?')[0].split('#')[0]}`
    .replace(/\/+/g, '/')
    .replace(/\/+$/, '') || '/';
  if (clean === '/en') return '/';
  if (clean.startsWith('/en/')) return clean.slice(3) || '/';
  if (clean === '/vi') return '/';
  if (clean.startsWith('/vi/')) return clean.slice(3) || '/';
  return clean;
}

export function localizedSeoPath(
  basePath: string,
  lang: SeoLanguage,
): string {
  const base = stripSeoLanguagePrefix(basePath);
  if (lang === 'en') return base === '/' ? '/en' : `/en${base}`;
  return base;
}

export function supportsEnglishSeoPath(basePath: string): boolean {
  const base = stripSeoLanguagePrefix(basePath);
  return (
    englishPublicBasePaths.has(base) ||
    /^\/businesses\/[^/]+$/.test(base) ||
    /^\/investors\/[^/]+$/.test(base)
  );
}

export function buildSeoTitle(
  pageName: string,
  lang: SeoLanguage,
): string {
  const suffix = lang === 'en' ? SEO_SUFFIX_EN : SEO_SUFFIX_VI;
  const cleanName = String(pageName || 'Deals68.com').trim();
  return cleanName.includes(suffix)
    ? cleanName
    : `${cleanName} | ${suffix}`;
}

function privateDefinition(
  pageNameVi: string,
  pageNameEn: string,
): SeoDefinition {
  return {
    pageNameVi,
    pageNameEn,
    descriptionVi: 'Trang riêng tư dành cho tài khoản Deals68.',
    descriptionEn: 'Private page for Deals68 account users.',
    noindex: true,
  };
}

export function seoForPath(pathname: string): SeoDefinition {
  const base = stripSeoLanguagePrefix(pathname);
  const exact = exactRoutes[base];
  if (exact) return exact;

  if (/^\/register(?:\/[^/]+)?$/.test(base)) {
    return privateDefinition('Đăng ký tài khoản', 'Create Account');
  }

  if (/^\/businesses\/[^/]+$/.test(base)) {
    return {
      pageNameVi: 'Hồ sơ doanh nghiệp',
      pageNameEn: 'Business Opportunity',
      descriptionVi:
        'Thông tin doanh nghiệp ẩn danh, số liệu chính, nhu cầu giao dịch và tài liệu được duyệt trên Deals68.',
      descriptionEn:
        'Anonymous business profile, key metrics, transaction needs and approved materials on Deals68.',
      type: 'article',
    };
  }

  if (/^\/investors\/[^/]+$/.test(base)) {
    return {
      pageNameVi: 'Hồ sơ Nhà đầu tư',
      pageNameEn: 'Investor Profile',
      descriptionVi:
        'Khẩu vị đầu tư, lĩnh vực, thị trường và quy mô đầu tư của nhà đầu tư trên Deals68.',
      descriptionEn:
        'Investor appetite, sectors, target markets and investment size on Deals68.',
      type: 'article',
    };
  }

  if (
    base === '/admin' ||
    base.startsWith('/admin/') ||
    base === '/dashboard' ||
    base.startsWith('/dashboard/') ||
    base === '/data-room' ||
    base.startsWith('/data-room/')
  ) {
    if (base.startsWith('/admin')) {
      return privateDefinition('Quản trị Deals68', 'Deals68 Admin');
    }
    if (base.startsWith('/data-room')) {
      return privateDefinition('Phòng dữ liệu', 'Data Room');
    }
    return privateDefinition('Dashboard Deals68', 'Deals68 Dashboard');
  }

  return {
    pageNameVi: 'Không tìm thấy trang',
    pageNameEn: 'Page Not Found',
    descriptionVi: 'Trang yêu cầu không tồn tại hoặc đã được di chuyển.',
    descriptionEn: 'The requested page does not exist or has moved.',
    noindex: true,
  };
}
