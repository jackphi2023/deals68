export type Lang = 'vi' | 'en';
export const ui = {
  vi: {
    home: 'Trang chủ', businesses: 'Doanh nghiệp', investors: 'Nhà đầu tư', pricing: 'Bảng giá', valuation: 'Định giá', login: 'Đăng nhập', register: 'Tạo tài khoản', dashboard: 'Dashboard', admin: 'Admin', logout: 'Đăng xuất',
    searchBusinesses: 'Tìm doanh nghiệp', searchInvestors: 'Tìm nhà đầu tư', country: 'Quốc gia', industry: 'Lĩnh vực', dealType: 'Loại deal', revenue: 'Doanh thu 2025', ebitda: 'EBITDA', businessQuality: 'Business Quality Score', dataConfidence: 'Data Confidence', view: 'Xem chi tiết', save: 'Lưu', expressInterest: 'Bày tỏ quan tâm', requestData: 'Yêu cầu dữ liệu', sendProposal: 'Gửi proposal',
    onlyInvestorsQuality: 'Chỉ nhà đầu tư mới xem được chi tiết Business Quality Score.', noMatchedBusinesses: 'Chưa có doanh nghiệp phù hợp hiện tại, hãy cập nhật sau.', hiddenContact: 'Thông tin liên hệ chỉ mở khi hai bên được duyệt kết nối.',
  },
  en: {
    home: 'Home', businesses: 'Businesses', investors: 'Investors', pricing: 'Pricing', valuation: 'Valuation', login: 'Login', register: 'Register', dashboard: 'Dashboard', admin: 'Admin', logout: 'Logout',
    searchBusinesses: 'Search businesses', searchInvestors: 'Search investors', country: 'Country', industry: 'Sector', dealType: 'Deal type', revenue: '2025 Revenue', ebitda: 'EBITDA', businessQuality: 'Business Quality Score', dataConfidence: 'Data Confidence', view: 'View detail', save: 'Save', expressInterest: 'Express interest', requestData: 'Request data', sendProposal: 'Send proposal',
    onlyInvestorsQuality: 'Only logged-in investors can view the detailed Business Quality Score.', noMatchedBusinesses: 'No matching businesses are available right now. Please check again later.', hiddenContact: 'Contact information is unlocked only after approved connection.',
  },
} as const;

export function t(lang: Lang, key: keyof typeof ui.vi) {
  return ui[lang]?.[key] || ui.vi[key] || key;
}

const phraseMap: Record<string, string> = {
  'doanh nghiệp': 'business', 'nhà đầu tư': 'investor', 'gọi vốn': 'fundraising', 'sang nhượng': 'business transfer', 'bán doanh nghiệp': 'business sale', 'bán cổ phần': 'stake sale', 'vay vốn': 'debt financing', 'đối tác chiến lược': 'strategic partner', 'thẩm mỹ': 'aesthetics', 'da liễu': 'dermatology', 'nhà hàng': 'restaurant', 'hải sản': 'seafood', 'kho lạnh': 'cold storage', 'công nghệ': 'technology', 'may đo': 'custom tailoring', 'tăng trưởng': 'growth', 'doanh thu': 'revenue', 'lợi nhuận': 'profit', 'mở rộng': 'expansion'
};

export function autoEnglishFromVietnamese(input: string) {
  if (!input) return '';
  let out = input;
  Object.entries(phraseMap).forEach(([vi, en]) => {
    out = out.replace(new RegExp(vi, 'gi'), en);
  });
  return out
    .replace(/&/g, 'and')
    .replace(/\s+/g, ' ')
    .trim();
}
