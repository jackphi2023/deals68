import type { Lang } from './i18n';

const COPY_OVERRIDES: Record<string, string> = {
  'Các số liệu tài chính chính xác chỉ được chia sẻ với nhà đầu tư khi doanh nghiệp gửi Proposal hoặc chấp thuận yêu cầu dữ liệu. Người xem công khai và nhà đầu tư chưa được cấp quyền chỉ thấy trạng thái bảo mật hoặc khoảng dữ liệu tổng quát.':
    'Các số liệu tài chính chính xác chỉ được chia sẻ với nhà đầu tư khi doanh nghiệp gửi Proposal hoặc chấp thuận yêu cầu dữ liệu. Người xem công khai và nhà đầu tư chưa được cấp quyền chỉ thấy trạng thái bảo mật',
  'Exact financial figures are shared only when the Business sends a Proposal to an investor or approves the investor’s data request. Public visitors and investors without access see only restricted states or general data ranges.':
    'Exact financial figures are shared only when the Business sends a Proposal to an investor or approves the investor’s data request. Public visitors and investors without access see only a restricted state.',
  'Nhập số: đất đai, nhà máy, khách sạn, tòa nhà...':
    'Nhập số: giá trị đất đai/nhà máy/khách sạn/tòa nhà...',
  'Enter a number for land, factory, hotel, building...':
    'Enter a number: land/factory/hotel/building value...',
};

export function T(lang: Lang, vi: string, en: string) {
  const copy = lang === 'en' ? en : vi;
  return COPY_OVERRIDES[copy] || copy;
}
