#!/usr/bin/env node
import fs from 'node:fs';

const path = 'src/pages/Pricing.tsx';
const source = fs.readFileSync(path, 'utf8');
const marker = '  const faqs = [\n';

if (!source.includes(marker)) {
  throw new Error('Pricing FAQ marker not found.');
}

if (source.includes('Báo cáo Tối ưu hồ sơ Doanh nghiệp là gì?')) {
  console.log('Pricing FAQ copy is already present.');
  process.exit(0);
}

const additions = `  const faqs = [
    {
      qVi: 'Báo cáo Tối ưu hồ sơ Doanh nghiệp là gì?',
      qEn: 'What is the Business Profile Optimization Report?',
      aVi: 'Là chức năng tổng hợp toàn bộ thông tin doanh nghiệp đăng lên tại Dataroom để tổng hợp và đưa ra các đề xuất tối ưu. Chỉ doanh nghiệp dùng gói Ưu tiên mới được sử dụng. Nhà đầu tư cũng có thể xem Báo cáo Tóm lượt cơ hội đầu tư, thay vì cần nhiều ngày để đọc hàng trăm trang tài liệu trong Dataroom của doanh nghiệp.',
      aEn: 'It consolidates all information uploaded by the Business to the Dataroom and provides optimization recommendations. The feature is available only to Businesses using the Priority plan. Investors can also view an Investment Opportunity Summary Report instead of spending days reading hundreds of pages of documents in the Business Dataroom.',
    },
    {
      qVi: 'Dataroom và eNDA là gì?',
      qEn: 'What are the Dataroom and eNDA?',
      aVi: 'Dataroom là phòng chứa toàn bộ các tài liệu doanh nghiệp cung cấp, và chỉ mở cho nhà đầu tư xem sau khi đã ký eNDA. eNDA là văn bản số chứng thực nhà đầu tư cam kết bảo mật thông tin doanh nghiệp cung cấp tại Dataroom để được cấp quyền xem.',
      aEn: "The Dataroom contains all documents provided by the Business and is opened to an investor only after the investor has signed the eNDA. The eNDA is a digitally executed agreement confirming the investor's commitment to keep the information provided in the Dataroom confidential before access is granted.",
    },
`;

const updated = source.replace(marker, additions);
fs.writeFileSync(path, updated);
console.log('Pricing FAQ copy added.');
