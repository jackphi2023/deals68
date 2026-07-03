export const supportedLanguages = [
  { code: 'vi', label: 'Tiếng Việt', country: 'VN' },
  { code: 'en', label: 'English', country: 'US' },
  { code: 'zh', label: '中文', country: 'CN' },
  { code: 'ko', label: '한국어', country: 'KR' },
  { code: 'ja', label: '日本語', country: 'JP' }
];

export function localTimeLabel(timezone = 'Asia/Ho_Chi_Minh') {
  try { return new Intl.DateTimeFormat('en-GB', { timeZone: timezone, hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' }).format(new Date()); }
  catch { return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' }).format(new Date()); }
}

export function syncBilingual(vi: string, fallbackEn = '') {
  const dictionary: Record<string,string> = {
    'Doanh nghiệp đang gọi vốn': 'Business seeking investment',
    'Nhà đầu tư chiến lược': 'Strategic investor',
    'Bán doanh nghiệp': 'Business for sale',
    'Sang nhượng cửa hàng': 'Store transfer',
    'Huy động vốn': 'Fundraising'
  };
  return dictionary[vi] || fallbackEn || vi.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}
