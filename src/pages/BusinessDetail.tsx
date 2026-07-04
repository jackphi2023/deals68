import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { getBusinessBySlug, getInvestorByOwner } from '../lib/data';
import { formatMoney, percent } from '../lib/format';
import { useAuth } from '../contexts/AuthContext';
import type { Lang } from '../lib/i18n';

const T = (lang: Lang, vi: string, en: string) => lang === 'en' ? en : vi;

type Fact = [vi: string, en: string, value: string];
type FAQ = [qVi: string, qEn: string, aVi: string, aEn: string];
type Detail = {
  slug: string;
  image: string;
  catVi: string;
  catEn: string;
  industryVi: string;
  industryEn: string;
  badges: string[];
  titleVi: string;
  titleEn: string;
  subtitleVi: string;
  subtitleEn: string;
  facts: Fact[];
  profileVi: string[];
  profileEn: string[];
  highlightsVi: string[];
  highlightsEn: string[];
  txTypeVi: string;
  txTypeEn: string;
  txAmountLabelVi: string;
  txAmountLabelEn: string;
  txBig: string;
  txSubVi: string;
  txSubEn: string;
  terms: Fact[];
  useOfFundsVi?: string[] | null;
  useOfFundsEn?: string[] | null;
  reasonVi: string;
  reasonEn: string;
  finHeaders: string[];
  finRows: string[][];
  finNoteVi: string;
  finNoteEn: string;
  docs: string[];
  verifs: string[];
  hasFactory?: boolean;
  factoryFlowVi?: string[];
  factoryFlowEn?: string[];
  factoryTechVi?: string[];
  factoryTechEn?: string[];
  faqs: FAQ[];
  similar: string[];
  qualityScore: number;
};

const pillBase: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  fontSize: 12,
  fontWeight: 700,
  padding: '5px 10px',
  borderRadius: 7,
  whiteSpace: 'nowrap'
};

const detailData: Record<string, Detail> = {
  hkmedi: {
    slug: 'hkmedi', image: '/assets/deal1.png', catVi: 'Healthcare / Beauty', catEn: 'Healthcare / Beauty', industryVi: 'Y tế · Làm đẹp', industryEn: 'Healthcare · Beauty', badges: ['Fundraise', 'Healthcare', 'Chain'],
    titleVi: 'Chuỗi phòng khám da liễu & thẩm mỹ 5 chi nhánh đang gọi vốn',
    titleEn: '5-branch dermatology & aesthetics clinic chain raising capital',
    subtitleVi: 'Chuỗi phòng khám da liễu – thẩm mỹ có 5 chi nhánh, hơn 5.500 khách hàng và nhu cầu gọi vốn để mở rộng toàn quốc. Hồ sơ hiển thị ẩn danh; tên doanh nghiệp và tài liệu mở sau kết nối/NDA.',
    subtitleEn: 'A 5-branch dermatology & aesthetics clinic chain with 5,500+ customers, raising growth capital to expand nationwide. The public profile is anonymous; company name and documents unlock after connection/NDA.',
    facts: [['Ngành','Industry','Dermatology · Aesthetics'],['Số cơ sở','Locations','5 chi nhánh'],['Địa điểm','Location','Hà Nội / Việt Nam'],['Giao dịch','Transaction','Gọi vốn tăng trưởng'],['Nhu cầu vốn','Capital sought','USD 2.0M · ~17%'],['Doanh thu 2025E','2025E revenue','164,3 tỷ ₫ · USD 6.2M'],['EBITDA 2025E','2025E EBITDA','~9.7%'],['Khách hàng','Customers','5.500+'],['Mục tiêu','Expansion','Mở rộng 40–60 chi nhánh'],['Trạng thái','Status','Ẩn danh · đã kiểm duyệt']],
    profileVi: ['Chuỗi phòng khám da liễu – thẩm mỹ đang vận hành 5 chi nhánh, tập trung dịch vụ điều trị da, chăm sóc da và thẩm mỹ không phẫu thuật.', 'Doanh nghiệp có cơ sở khách hàng lặp lại, năng lực chuyên môn y tế và thương hiệu địa phương đang tăng trưởng.', 'Nhu cầu vốn phục vụ mở rộng chi nhánh, chuẩn hóa vận hành, tuyển dụng bác sĩ/kỹ thuật viên và marketing tăng trưởng.', 'Thông tin tên pháp nhân, chủ sở hữu, báo cáo tài chính chi tiết và dữ liệu khách hàng chỉ mở sau khi nhà đầu tư được duyệt kết nối.'],
    profileEn: ['A dermatology & aesthetics clinic chain operating 5 branches, focused on skin treatment, skincare and non-surgical aesthetics.', 'The business has repeat customers, medical know-how and a growing local brand.', 'Capital is intended for branch expansion, operations standardization, doctor/technician hiring and growth marketing.', 'Legal name, ownership, detailed financials and customer data unlock only after an approved investor connection.'],
    highlightsVi: ['5 chi nhánh đang vận hành', 'Doanh thu 2025E khoảng 164,3 tỷ ₫', 'Nhu cầu vốn USD 2.0M · ~17%', 'Mục tiêu mở rộng 40–60 chi nhánh'],
    highlightsEn: ['5 operating branches', '2025E revenue around VND 164.3B', 'Capital sought USD 2.0M · ~17%', 'Expansion target of 40–60 branches'],
    txTypeVi: 'Gọi vốn tăng trưởng', txTypeEn: 'Growth fundraising', txAmountLabelVi: 'Nhu cầu vốn', txAmountLabelEn: 'Capital sought', txBig: 'USD 2.0M', txSubVi: 'Đổi lấy khoảng 17% cổ phần', txSubEn: 'For approximately 17% equity',
    terms: [['Vòng gọi vốn','Round','Growth'],['Cấu trúc','Structure','Equity / convertible'],['Tỷ lệ dự kiến','Indicative stake','~17%'],['Mốc mở rộng','Expansion target','40–60 chi nhánh']],
    useOfFundsVi: ['Mở thêm chi nhánh tại thành phố lớn', 'Marketing tăng trưởng và hệ thống CRM', 'Tuyển dụng & đào tạo bác sĩ/kỹ thuật viên', 'Chuẩn hóa vận hành, tài chính và dashboard'],
    useOfFundsEn: ['Open new branches in major cities', 'Growth marketing and CRM system', 'Hire and train doctors/technicians', 'Standardize operations, finance and dashboard'],
    reasonVi: 'Doanh nghiệp gọi vốn để mở rộng chuỗi và chuẩn hóa năng lực vận hành trước giai đoạn tăng tốc.',
    reasonEn: 'The business is raising capital to expand the chain and standardize operations before scaling faster.',
    finHeaders: ['Chỉ tiêu','2024E','2025E Thấp','2025E Cơ sở','2025E Cao'],
    finRows: [['Doanh thu','120–145 tỷ','150 tỷ','164,3 tỷ','180 tỷ'],['Biên EBITDA','8–10%','8.5%','9.7%','11%'],['EBITDA','10–14 tỷ','12,8 tỷ','15,9 tỷ','19,8 tỷ'],['Số chi nhánh','5','5','6–7','8+'],['Khách hàng','5.500+','6.500+','7.500+','8.500+']],
    finNoteVi: 'Ước tính minh họa dựa trên quy mô chuỗi, doanh thu bình quân theo chi nhánh và kế hoạch mở rộng. Cần thay bằng báo cáo quản trị, sao kê và báo cáo thuế sau thẩm định.',
    finNoteEn: 'Illustrative estimate based on chain scale, average branch revenue and expansion plan. Replace with management accounts, bank statements and tax filings after due diligence.',
    docs: ['Profile DN','Báo cáo tài chính 2024–2025','Danh sách chi nhánh','Số liệu khách hàng','Hợp đồng thuê mặt bằng','Giấy phép hoạt động','Kế hoạch mở rộng','Cap table'],
    verifs: ['Email','Điện thoại','Admin review','Cố vấn'],
    faqs: [['Thông tin doanh nghiệp có công khai tên không?','Is the company name public?','Không. Tên pháp nhân và chủ sở hữu chỉ mở sau khi hai bên chấp nhận kết nối/NDA.','No. Legal name and ownership unlock only after accepted connection/NDA.'],['Nhà đầu tư cần gì để xem tài liệu?','What is required to view documents?','Nhà đầu tư cần đăng nhập, bày tỏ quan tâm và được duyệt kết nối.','Investors must log in, express interest and be approved for connection.'],['Số liệu tài chính đã kiểm toán chưa?','Are the financials audited?','Số liệu public là ước tính/teaser; tài liệu chi tiết cần thẩm định sau NDA.','Public figures are teaser estimates; detailed files require due diligence after NDA.']],
    similar: ['dunnio','phongcua','coldstore'], qualityScore: 84
  },
  infinitytech: {
    slug: 'infinitytech', image: '/assets/deal2.png', catVi: 'Technology / Mobile Apps', catEn: 'Technology / Mobile Apps', industryVi: 'Công nghệ', industryEn: 'Technology', badges: ['Fundraise','Technology','Global Apps'],
    titleVi: 'Công ty mobile app global đang gọi vốn mở rộng hệ sinh thái', titleEn: 'Global mobile app studio raising to expand its ecosystem',
    subtitleVi: 'Studio mobile app toàn cầu với hơn 280 ứng dụng, doanh thu quốc tế và kế hoạch mở rộng user acquisition, AI/product và hệ sinh thái sản phẩm.', subtitleEn: 'A global mobile app studio with 280+ apps, international revenue and plans to scale user acquisition, AI/product and the product ecosystem.',
    facts: [['Ngành','Industry','Mobile apps · AI · SaaS'],['Sản phẩm','Products','280+ ứng dụng'],['Địa điểm','Location','Hà Nội / Global'],['Giao dịch','Transaction','Gọi vốn'],['Nhu cầu vốn','Capital sought','USD 2.0M · 30%'],['Doanh thu 2025E','2025E revenue','318–371 tỷ ₫ · USD 12–14M'],['Lợi nhuận','Profitability','Đang có lợi nhuận'],['Kênh doanh thu','Revenue model','App stores · subscriptions · ads']],
    profileVi: ['Doanh nghiệp công nghệ phát triển và vận hành danh mục mobile apps quy mô lớn cho thị trường quốc tế.', 'Nền tảng có kinh nghiệm phân phối, tối ưu tăng trưởng người dùng và khai thác doanh thu số.', 'Nguồn vốn dùng để tăng tốc user acquisition, mở rộng đội sản phẩm/AI và phát triển hệ sinh thái app có biên lợi nhuận cao.'],
    profileEn: ['A technology company building and operating a large portfolio of mobile apps for international markets.', 'The platform has experience in distribution, user-growth optimization and digital monetization.', 'Capital will accelerate user acquisition, expand product/AI teams and build a high-margin app ecosystem.'],
    highlightsVi: ['280+ ứng dụng mobile', 'Doanh thu 2025E USD 12–14M', 'Gọi vốn USD 2.0M cho 30%', 'Có kinh nghiệm vận hành thị trường quốc tế'],
    highlightsEn: ['280+ mobile apps', '2025E revenue USD 12–14M', 'Raising USD 2.0M for 30%', 'International operating experience'],
    txTypeVi: 'Gọi vốn', txTypeEn: 'Fundraise', txAmountLabelVi: 'Nhu cầu vốn', txAmountLabelEn: 'Capital sought', txBig: 'USD 2.0M', txSubVi: 'Đổi lấy 30% cổ phần', txSubEn: 'For 30% equity',
    terms: [['Cấu trúc','Structure','Equity'],['Tỷ lệ','Stake','30%'],['Doanh thu 2025E','2025E revenue','USD 12–14M'],['Mục tiêu','Goal','Scale UA + AI/product']],
    useOfFundsVi: ['User acquisition quốc tế', 'AI/product roadmap', 'Đội ngũ kỹ thuật và vận hành', 'M&A app/product nhỏ nếu phù hợp'],
    useOfFundsEn: ['International user acquisition', 'AI/product roadmap', 'Engineering and operations team', 'Small app/product M&A where relevant'],
    reasonVi: 'Gọi vốn để mở rộng danh mục app, tăng tốc tăng trưởng người dùng và nâng cấp năng lực AI/product.', reasonEn: 'Raising capital to expand the app portfolio, accelerate user growth and upgrade AI/product capability.',
    finHeaders: ['Chỉ tiêu','2024E','2025E Thấp','Cơ sở','Cao'],
    finRows: [['Doanh thu','230–280 tỷ','318 tỷ','345 tỷ','371 tỷ'],['Biên EBITDA','15–20%','18%','20%','22%'],['EBITDA','35–55 tỷ','57 tỷ','69 tỷ','82 tỷ'],['Số ứng dụng','250+','280+','300+','320+']],
    finNoteVi: 'Ước tính theo danh mục ứng dụng, tăng trưởng người dùng và monetization quốc tế. Cần DD app store analytics, doanh thu, chi phí UA và IP.', finNoteEn: 'Estimated from app portfolio, user growth and international monetization. DD app-store analytics, revenue, UA cost and IP.',
    docs: ['Profile DN','App portfolio','Báo cáo doanh thu 2024–2025','App store analytics','User acquisition report','IP / source ownership','Financial model','Cap table'], verifs: ['Email','Admin review','Financial teaser'],
    faqs: [['Doanh thu đến từ đâu?','Where does revenue come from?','Doanh thu có thể đến từ app store, quảng cáo, subscription và sản phẩm số.','Revenue may come from app stores, ads, subscriptions and digital products.'],['Rủi ro chính?','Key risks?','Chi phí user acquisition, thay đổi chính sách app stores, IP/source code và biến động doanh thu quảng cáo.','UA cost, app-store policy changes, IP/source code and ad revenue volatility.']],
    similar: ['dunnio','hkmedi','coldstore'], qualityScore: 81
  },
  dunnio: {
    slug: 'dunnio', image: '/assets/deal3.png', catVi: 'Fashion Tech / Retail', catEn: 'Fashion Tech / Retail', industryVi: 'Fashion Tech', industryEn: 'Fashion Tech', badges: ['Seed','Fashion Tech','Retail'],
    titleVi: 'Nền tảng may đo cá nhân hóa gọi vốn Seed', titleEn: 'Personalized custom-tailoring platform raising Seed',
    subtitleVi: 'Nền tảng may đo cá nhân hóa với 6 cửa hàng, e-commerce và tệp khách hàng lớn; gọi vốn Seed để mở rộng thị trường quốc tế và AI sizing.', subtitleEn: 'A personalized custom-tailoring platform with 6 stores, e-commerce and a large customer base; raising Seed to expand internationally and build AI sizing.',
    facts: [['Ngành','Industry','Fashion Tech · Retail'],['Số cửa hàng','Stores','6'],['Khách hàng','Customers','34.000+'],['Giao dịch','Transaction','Seed'],['Nhu cầu vốn','Capital sought','USD 300K · 22,6%'],['Doanh thu 2025E','2025E revenue','30,7 tỷ ₫ · USD 1.16M'],['AOV','AOV','~USD 114'],['Repeat','Repeat','>40%']],
    profileVi: ['Doanh nghiệp may đo cá nhân hóa kết hợp cửa hàng vật lý và e-commerce.', 'Có dữ liệu khách hàng, quy trình may đo và khả năng mở rộng qua online, AI sizing và thị trường quốc tế.', 'Vốn dùng cho US/EU e-commerce, AI sizing, marketing và mở thêm cửa hàng chọn lọc.'],
    profileEn: ['A personalized tailoring business combining physical stores and e-commerce.', 'It has customer data, tailoring workflows and scale potential via online, AI sizing and international markets.', 'Funds will support US/EU e-commerce, AI sizing, marketing and selective store expansion.'],
    highlightsVi: ['6 cửa hàng đang vận hành', '34.000+ khách hàng', 'Repeat >40%', 'Seed USD 300K · 22,6%'], highlightsEn: ['6 operating stores','34,000+ customers','Repeat >40%','Seed USD 300K · 22.6%'],
    txTypeVi: 'Seed', txTypeEn: 'Seed', txAmountLabelVi: 'Nhu cầu vốn', txAmountLabelEn: 'Capital sought', txBig: 'USD 300K', txSubVi: 'Đổi lấy 22,6% cổ phần', txSubEn: 'For 22.6% equity',
    terms: [['Cấu trúc','Structure','Equity'],['Tỷ lệ','Stake','22,6%'],['Doanh thu 2025E','2025E revenue','USD 1.16M'],['Kênh','Channel','Retail + e-commerce']],
    useOfFundsVi: ['US/EU e-commerce', 'AI sizing', 'Marketing tăng trưởng', 'Mở cửa hàng chọn lọc'], useOfFundsEn: ['US/EU e-commerce','AI sizing','Growth marketing','Selective store expansion'],
    reasonVi: 'Gọi vốn Seed để mở rộng kênh online quốc tế và nâng cấp công nghệ cá nhân hóa kích thước.', reasonEn: 'Raising Seed capital to expand international online channels and upgrade personalized sizing technology.',
    finHeaders: ['Chỉ tiêu','2024E','2025E Thấp','Cơ sở','Cao'], finRows: [['Doanh thu','18–23 tỷ','27 tỷ','30,7 tỷ','35 tỷ'],['Biên EBITDA','0–5%','1%','1,5%','4%'],['EBITDA','0–1 tỷ','0,27 tỷ','0,46 tỷ','1,4 tỷ'],['Khách hàng','30k+','34k+','36k+','40k+']],
    finNoteVi: 'Ước tính theo cửa hàng hiện hữu, e-commerce và AOV. Cần DD doanh thu cửa hàng, đơn online, gross margin và CAC.', finNoteEn: 'Estimated from stores, e-commerce and AOV. DD store revenue, online orders, gross margin and CAC.',
    docs: ['Profile DN','Báo cáo tài chính 2024–2025','Store sales','E-commerce analytics','Customer cohort','Product catalogue','Cap table','Growth plan'], verifs: ['Email','Điện thoại','Admin review'],
    faqs: [['Vì sao cần AI sizing?','Why AI sizing?','AI sizing giúp giảm lỗi kích thước, tăng chuyển đổi online và mở rộng xuyên biên giới.','AI sizing can reduce fitting errors, increase online conversion and enable cross-border scale.']],
    similar: ['hkmedi','infinitytech','phongcua'], qualityScore: 74
  },
  phongcua: {
    slug: 'phongcua', image: '/assets/deal4.png', catVi: 'F&B / Restaurant', catEn: 'F&B / Restaurant', industryVi: 'F&B · Nhà hàng hải sản', industryEn: 'F&B · Seafood Restaurant', badges: ['Full Sale','F&B','Restaurant'],
    titleVi: 'Bán 2 nhà hàng hải sản tại TP.HCM — giá chào 15 tỷ ₫', titleEn: 'Two seafood restaurants in HCMC for sale — asking VND 15B',
    subtitleVi: 'Cơ hội mua lại 2 nhà hàng hải sản đang vận hành tại khu Bình Quới, Bình Thạnh, TP.HCM; nổi bật với cua Cà Mau, hải sản tươi sống, tiệc gia đình, tiệc công ty và khách du lịch. Đất/mặt bằng thuê trả tiền hằng năm. Chủ nhà hàng bán do nghỉ hưu.',
    subtitleEn: 'Acquire two operating seafood restaurants in Binh Quoi, Binh Thanh, HCMC; known for Ca Mau crab, fresh seafood, family & corporate events and tourists. Land/premises leased on an annual basis. Owner is retiring.',
    facts: [['Ngành','Industry','F&B · Nhà hàng hải sản'],['Số cơ sở','Locations','2 nhà hàng'],['Địa điểm','Location','Bình Quới, Bình Thạnh, TP.HCM'],['Giờ hoạt động','Hours','10:00 – 23:00 hằng ngày'],['Sản phẩm chính','Key products','Cua Cà Mau, hải sản tươi, lẩu, tiệc nhóm'],['Giao dịch','Transaction','Bán 100% hoạt động kinh doanh'],['Giá chào bán','Asking price','15 tỷ ₫'],['Đất / mặt bằng','Land / premises','Thuê, trả hằng năm (không gồm quyền SH đất)'],['Doanh thu 2025E','2025E revenue','38–55 tỷ ₫'],['EBITDA 2025E','2025E EBITDA','3.8–6.6 tỷ ₫ (10–12%)'],['Lý do bán','Reason','Chủ nghỉ hưu']],
    profileVi: ['Nhà hàng hải sản/cua quy mô 2 cơ sở tại khu Bình Quới – Thanh Đa, phù hợp khách gia đình, nhóm bạn, khách du lịch và tiệc công ty.', 'Menu theo nhóm: cua chế biến, hải sản tươi sống, món cá/tôm/mực/sò/ốc, món heo/bò/gà, cơm/mì/miến, rau, lẩu, bia/nước.', 'Tài sản chuyển nhượng: thương hiệu/quyền khai thác, thiết bị bếp, bể hải sản, bàn ghế, POS, quy trình mua hàng, công thức, nhà cung cấp, đội ngũ nếu giữ được.', 'Không bao gồm quyền sở hữu đất. Người mua cần DD hợp đồng thuê: thời hạn, giá thuê, quyền gia hạn/chuyển giao.'],
    profileEn: ['Two operating seafood/crab restaurants in the Binh Quoi – Thanh Da area, suitable for families, groups, tourists and corporate events.', 'Menu includes crab, fresh seafood, fish/shrimp/squid/shellfish, meat dishes, rice/noodles, hotpot and drinks.', 'Transfer assets include brand/operating rights, kitchen equipment, seafood tanks, furniture, POS, purchasing process, recipes, suppliers and staff if retained.', 'Land ownership is excluded. Buyers should DD lease term, rent, renewal and transfer rights.'],
    highlightsVi: ['2 nhà hàng đang vận hành, đông khách','Doanh thu 2025E ước tính 38–55 tỷ ₫','Bán 100% hoạt động — giá 15 tỷ ₫','Thương hiệu, thiết bị, quy trình & nhà cung cấp'],
    highlightsEn: ['2 operating restaurants with active traffic','2025E revenue estimated at VND 38–55B','100% operating business sale — asking VND 15B','Brand, equipment, process & suppliers'],
    txTypeVi: 'Bán toàn bộ hoạt động', txTypeEn: 'Full business sale', txAmountLabelVi: 'Giá chào bán', txAmountLabelEn: 'Asking price', txBig: '15 tỷ ₫', txSubVi: 'Bán 100% hoạt động kinh doanh', txSubEn: '100% of the operating business',
    terms: [['Số cơ sở','Locations','2 nhà hàng'],['Đất / mặt bằng','Land','Thuê, trả hằng năm'],['Lý do bán','Reason','Chủ nghỉ hưu']],
    useOfFundsVi: null, useOfFundsEn: null, reasonVi: 'Chủ nhà hàng nghỉ hưu, cần chuyển nhượng toàn bộ hoạt động kinh doanh.', reasonEn: 'The owner is retiring and wants to transfer the entire operating business.',
    finHeaders: ['Chỉ tiêu','2024E','2025E Thấp','2025E Cơ sở','2025E Cao'], finRows: [['Doanh thu','35–48 tỷ','38 tỷ','46 tỷ','55 tỷ'],['Biên gộp','38–42%','38%','40%','42%'],['Biên EBITDA','9–11%','10%','11%','12%'],['EBITDA','3.2–5.3 tỷ','3.8 tỷ','5.1 tỷ','6.6 tỷ'],['LN ròng','1.8–3.8 tỷ','1.9 tỷ','3.0 tỷ','4.4 tỷ']],
    finNoteVi: 'Ước tính theo 2 nhà hàng x doanh thu bình quân 105–150 triệu ₫/ngày toàn hệ thống, có mùa cao điểm/cuối tuần/tiệc. Biên thận trọng do chi phí nguyên liệu, nhân sự, thuê mặt bằng. Cần thay bằng POS, sao kê, báo cáo thuế sau DD.',
    finNoteEn: 'Estimated from 2 restaurants at ~VND 105–150M/day system-wide, with peak/weekend/event upside. Margins are conservative. Replace with POS, bank statements and tax reports after DD.',
    docs: ['Profile DN','Báo cáo tài chính 2024–2025','POS sales 24–36 tháng','Sao kê ngân hàng','Hợp đồng thuê đất/mặt bằng','Danh sách tài sản cố định','Menu & giá bán','Giấy phép VSATTP / PCCC'], verifs: ['Giấy phép VSATTP','Email','Điện thoại','Cố vấn'], hasFactory: false,
    faqs: [['Giá 15 tỷ có gồm đất không?','Does VND 15B include the land?','Không. Đất/mặt bằng thuê trả tiền hằng năm; người mua cần DD hợp đồng thuê.','No. Land/premises are leased annually; buyers should DD the lease.'],['Rủi ro chính?','Key risks?','Hợp đồng thuê, doanh thu tiền mặt, biến động giá cua/hải sản, giữ chân bếp trưởng/quản lý, phụ thuộc chủ cũ, giấy phép.','Lease terms, cash revenue, seafood price volatility, retaining chef/manager, owner dependence and licenses.'],['Tài sản gì được chuyển nhượng?','What assets transfer?','Thương hiệu, thiết bị bếp, bể hải sản, POS, công thức, nhà cung cấp và đội ngũ nếu giữ được.','Brand, kitchen equipment, seafood tanks, POS, recipes, suppliers and staff if retained.']],
    similar: ['trongnhan','hkmedi','coldstore'], qualityScore: 76
  },
  trongnhan: {
    slug: 'trongnhan', image: '/assets/deal5.png', catVi: 'Manufacturing / Seafood Export', catEn: 'Manufacturing / Seafood Export', industryVi: 'Sản xuất · Thủy sản XK', industryEn: 'Manufacturing · Seafood Export', badges: ['Strategic Investor','Seafood Export','Factory'],
    titleVi: 'Nhà máy chế biến thủy sản xuất khẩu quy mô lớn tìm nhà đầu tư chiến lược', titleEn: 'Large-scale seafood export processing plant seeking a strategic investor',
    subtitleVi: 'Doanh nghiệp chế biến thủy sản xuất khẩu, tập trung sản phẩm tôm đông lạnh. Phù hợp nhà đầu tư chiến lược, quỹ PE, doanh nghiệp thủy sản hoặc buyer quốc tế muốn mở rộng năng lực chế biến/xuất khẩu tại Việt Nam.', subtitleEn: 'A seafood export processor focused on frozen shrimp. Suited to strategic investors, PE funds, seafood companies or international buyers expanding processing/export capacity in Vietnam.',
    facts: [['Ngành','Industry','Seafood processing & export'],['Sản phẩm chính','Key products','Tôm đông lạnh'],['Chứng chỉ','Certificates','HACCP · BRC · HALAL · ASC · BAP 4★ · SMETA'],['Công suất thiết kế','Design capacity','~50.000 tấn/năm (cần kiểm chứng)'],['Thị trường XK','Export markets','50+ quốc gia (cần kiểm chứng)'],['Giao dịch','Transaction','Nhà đầu tư chiến lược / M&A'],['Giá / tỷ lệ','Price / stake','TBD sau NDA'],['Doanh thu 2025E','2025E revenue','USD 120–170M (~3.000–4.250 tỷ ₫)'],['EBITDA 2025E','2025E EBITDA','USD 7–12M (5–8%)']],
    profileVi: ['Doanh nghiệp chế biến/xuất khẩu thủy sản tại Việt Nam, sản phẩm chủ lực là tôm đông lạnh/tôm chế biến cho thị trường xuất khẩu.', 'Lợi thế ngành: Việt Nam là trung tâm sản xuất/xuất khẩu thủy sản lớn, có vùng nguyên liệu tôm và hệ sinh thái xuất khẩu phát triển.', 'Lợi thế doanh nghiệp: công suất nhà máy lớn, hệ thống chứng chỉ quốc tế, kinh nghiệm xuất khẩu, buyer network, năng lực QC/traceability.', 'Thông tin nhạy cảm như tên thật, EU code, email chỉ mở sau kết nối/NDA nếu muốn bảo mật cao.'],
    profileEn: ['A seafood processing/export business in Vietnam, focused on frozen and processed shrimp for export markets.', 'Industry advantage: Vietnam is a major seafood production/export hub with shrimp raw-material areas and export ecosystem.', 'Business advantages include large plant capacity, international certifications, export experience, buyer network and QC/traceability.', 'Sensitive information such as legal name, EU code and email unlocks only after connection/NDA when confidentiality is required.'],
    highlightsVi: ['Công suất thiết kế ~50.000 tấn/năm','Hệ chứng chỉ quốc tế: HACCP, BRC, ASC, BAP, HALAL','Xuất khẩu tới 50+ quốc gia (cần kiểm chứng)','Doanh thu 2025E ước tính USD 120–170M'],
    highlightsEn: ['~50,000 t/yr design capacity','International certifications: HACCP, BRC, ASC, BAP, HALAL','Exports to 50+ countries (to verify)','2025E revenue estimated at USD 120–170M'],
    txTypeVi: 'Gọi vốn, Vay', txTypeEn: 'Fundraise, Loan', txAmountLabelVi: 'Điều khoản', txAmountLabelEn: 'Terms', txBig: 'TBD', txSubVi: 'Điều khoản có sau NDA', txSubEn: 'Terms available after NDA',
    terms: [['Doanh thu 2025E','2025E revenue','USD 120–170M'],['EBITDA 2025E','2025E EBITDA','USD 7–12M'],['Biên EBITDA','EBITDA margin','5–8%'],['Điều khoản','Terms','TBD sau NDA']],
    useOfFundsVi: null, useOfFundsEn: null, reasonVi: 'Huy động vốn / đối tác chiến lược để mở rộng năng lực chế biến và xuất khẩu.', reasonEn: 'Raise capital / a strategic partner to expand processing and export capacity.',
    finHeaders: ['Chỉ tiêu','2024E','2025E Thấp','Cơ sở','Cao'], finRows: [['Sản lượng thành phẩm','14–20k tấn','16k tấn','20k tấn','24k tấn'],['ASP xuất khẩu','6.5–7.5 $/kg','7.5 $/kg','7.8 $/kg','8.0 $/kg'],['Doanh thu','95–145M $','120M $','156M $','192M $'],['Biên gộp','10–14%','10.5%','12%','13.5%'],['Biên EBITDA','4.5–7%','5%','6.5%','8%'],['EBITDA','4.5–10M $','6.0M $','10.1M $','15.4M $']],
    finNoteVi: 'Ước tính theo công suất thiết kế 50.000 tấn/năm với mức sử dụng thận trọng 32–48%; ASP tôm đông lạnh USD 7.5–8.0/kg; biên lợi nhuận ngành thủy sản thấp do nguyên liệu, tồn kho, FX và working capital. Cần thay bằng audited/management accounts 2024–2025.',
    finNoteEn: 'Estimated from 50,000 t/yr design capacity at a conservative 32–48% utilization; frozen-shrimp ASP USD 7.5–8.0/kg; seafood margins are thin due to raw material, inventory, FX and working capital. Replace with audited/management accounts.',
    docs: ['Profile DN','Báo cáo tài chính 2024–2025','Mô tả nhà máy & công nghệ','Factory licenses & certificates','EU code / quality certificates','Capacity & utilization report','Buyer / export by market','Product catalogue','Asset list & valuation'], verifs: ['HACCP','BRC','ASC','HALAL','BAP 4★','SMETA'], hasFactory: true,
    factoryFlowVi: ['Tiếp nhận nguyên liệu','QC','Chế biến','Cấp đông','Đóng gói','Kho lạnh','Xuất khẩu'], factoryFlowEn: ['Raw intake','QC','Processing','Freezing','Packing','Cold storage','Export'], factoryTechVi: ['IQF / freezer','Kho lạnh','Máy dò kim loại','Xử lý nước','Traceability / ERP','Phòng QC / lab'], factoryTechEn: ['IQF / freezer','Cold room','Metal detector','Water treatment','Traceability / ERP','QC lab'],
    faqs: [['Vì sao chưa có giá?','Why no price yet?','Đây là thương vụ gọi vốn / vay vốn; điều khoản, giá và tỷ lệ có sau NDA và thẩm định.','This is a fundraising/loan deal; terms, price and stake follow NDA and due diligence.'],['Rủi ro chính?','Key risks?','Biến động giá tôm, nguồn nguyên liệu, tồn kho, FX, buyer concentration, tiêu chuẩn chất lượng và working capital/nợ vay.','Shrimp price volatility, raw material supply, inventory, FX, buyer concentration, quality standards and working capital/debt.']],
    similar: ['phongcua','coldstore','hkmedi'], qualityScore: 79
  },
  coldstore: {
    slug: 'coldstore', image: '/assets/deal6.png', catVi: 'Cold Chain / Logistics', catEn: 'Cold Chain / Logistics', industryVi: 'Cold Chain', industryEn: 'Cold Chain', badges: ['Transfer','Cold Chain','Asset'],
    titleVi: 'Kho lạnh tự động quy mô lớn tại TP.HCM chuyển nhượng', titleEn: 'Large automated cold storage in HCMC for transfer',
    subtitleVi: 'Kho lạnh tự động quy mô lớn với 50.000+ pallet, 14 robot và 4 kho độc lập; chuyển nhượng công ty/tài sản cho nhà đầu tư chiến lược, logistics/cold-chain operator hoặc quỹ hạ tầng.', subtitleEn: 'Large automated cold storage with 50,000+ pallets, 14 robots and 4 independent chambers; company/asset transfer for strategic investors, logistics/cold-chain operators or infrastructure funds.',
    facts: [['Ngành','Industry','Cold chain · Logistics'],['Quy mô','Scale','50.000+ pallet'],['Tự động hóa','Automation','14 robot · 4 kho độc lập'],['Địa điểm','Location','TP.HCM / Southern Vietnam'],['Giao dịch','Transaction','Chuyển nhượng công ty/tài sản'],['Giá chào','Asking price','USD 50M'],['Doanh thu 2025E','2025E revenue','USD 12–18M'],['EBITDA 2025E','2025E EBITDA','35–42%']],
    profileVi: ['Tài sản kho lạnh tự động quy mô lớn phục vụ thủy sản, thực phẩm đông lạnh, logistics lạnh và chuỗi cung ứng xuất khẩu.', 'Phù hợp nhà đầu tư hạ tầng, logistics, cold-chain operator hoặc buyer chiến lược cần mở rộng năng lực kho lạnh tại Việt Nam.', 'Cần DD pháp lý tài sản/công ty, công suất lấp đầy, hợp đồng khách hàng, chi phí năng lượng và bảo trì hệ thống tự động.'],
    profileEn: ['A large automated cold-storage asset serving seafood, frozen food, cold logistics and export supply chains.', 'Suited to infrastructure investors, logistics companies, cold-chain operators or strategic buyers expanding Vietnam storage capacity.', 'DD should cover asset/company legal status, occupancy, customer contracts, energy cost and automation maintenance.'],
    highlightsVi: ['50.000+ pallet', 'Hệ thống tự động 14 robot', 'Biên EBITDA 2025E 35–42%', 'Giá chào chuyển nhượng USD 50M'], highlightsEn: ['50,000+ pallets','14-robot automation system','2025E EBITDA margin 35–42%','Transfer asking price USD 50M'],
    txTypeVi: 'Chuyển nhượng', txTypeEn: 'Transfer', txAmountLabelVi: 'Giá chào', txAmountLabelEn: 'Asking price', txBig: 'USD 50M', txSubVi: 'Chuyển nhượng công ty/tài sản', txSubEn: 'Company/asset transfer',
    terms: [['Quy mô','Scale','50.000+ pallet'],['Doanh thu 2025E','2025E revenue','USD 12–18M'],['Biên EBITDA','EBITDA margin','35–42%'],['Cấu trúc','Structure','Company / asset transfer']],
    useOfFundsVi: null, useOfFundsEn: null, reasonVi: 'Chủ sở hữu tìm đối tác mua/chuyển nhượng tài sản kho lạnh tự động quy mô lớn.', reasonEn: 'The owner is seeking a buyer/transfer partner for a large automated cold-storage asset.',
    finHeaders: ['Chỉ tiêu','2024E','2025E Thấp','Cơ sở','Cao'], finRows: [['Doanh thu','USD 10–14M','USD 12M','USD 15M','USD 18M'],['Occupancy','55–70%','60%','70%','80%'],['Biên EBITDA','32–38%','35%','39%','42%'],['EBITDA','USD 3.5–5.3M','USD 4.2M','USD 5.9M','USD 7.6M']],
    finNoteVi: 'Ước tính theo công suất pallet, giá thuê kho lạnh, tỷ lệ lấp đầy và chi phí năng lượng/bảo trì. Cần thay bằng hợp đồng khách hàng, P&L, asset register và capex plan sau DD.', finNoteEn: 'Estimated from pallet capacity, cold-storage rates, occupancy and energy/maintenance cost. Replace with customer contracts, P&L, asset register and capex plan after DD.',
    docs: ['Profile DN','Báo cáo tài chính 2024–2025','Asset register','Layout kho lạnh','Hợp đồng khách hàng','Giấy phép / pháp lý tài sản','Báo cáo bảo trì robot','Energy cost report'], verifs: ['Asset teaser','Admin review','Cố vấn'], hasFactory: true,
    factoryFlowVi: ['Nhập hàng','Kiểm nhiệt','Lưu kho tự động','Robot picking','Xuất hàng'], factoryFlowEn: ['Inbound','Temperature check','Automated storage','Robot picking','Outbound'], factoryTechVi: ['AS/RS','Robot pallet','Cold room','WMS','Energy monitoring','Backup power'], factoryTechEn: ['AS/RS','Pallet robots','Cold room','WMS','Energy monitoring','Backup power'],
    faqs: [['Giá USD 50M gồm gì?','What does USD 50M include?','Cấu trúc công ty/tài sản cần xác nhận sau NDA, bao gồm pháp lý tài sản và nghĩa vụ nợ nếu có.','Company/asset structure must be confirmed after NDA, including asset legal status and liabilities if any.'],['Rủi ro chính?','Key risks?','Tỷ lệ lấp đầy, giá điện, bảo trì robot, pháp lý tài sản và hợp đồng khách hàng.','Occupancy, electricity cost, robot maintenance, asset legal status and customer contracts.']],
    similar: ['trongnhan','phongcua','hkmedi'], qualityScore: 80
  }
};

const defaultDocs = ['Profile DN','Báo cáo tài chính 2024–2025','Financial model','NDA','IM / Teaser','Cap table','Legal documents','Management report'];

function toLines(value?: string | null, fallback: string[] = []) {
  if (!value) return fallback;
  return String(value).split(/\n|\r|•|;|\./).map((x) => x.trim()).filter(Boolean).slice(0, 6);
}

function provinceText(city?: string | null) {
  const c = String(city || '').trim();
  if (!c) return 'Việt Nam';
  if (c === 'Ho Chi Minh City') return 'TP.HCM';
  if (c === 'Mekong Delta') return 'ĐBSCL';
  return c;
}

function industryText(value?: string | null) {
  return String(value || 'Doanh nghiệp').split(';')[0].trim() || 'Doanh nghiệp';
}

function fallbackDetailFromBusiness(b: any, lang: Lang): Detail {
  const titleVi = b?.title_vi || b?.title_en || 'Hồ sơ doanh nghiệp ẩn danh';
  const titleEn = b?.title_en || b?.title_vi || 'Anonymous business profile';
  const descVi = b?.description_vi || b?.highlights_vi || 'Hồ sơ doanh nghiệp ẩn danh trên Deals68. Thông tin chi tiết mở sau khi hai bên chấp nhận kết nối.';
  const descEn = b?.description_en || b?.highlights_en || 'Anonymous business profile on Deals68. Detailed information unlocks after both parties accept connection.';
  const revenue = formatMoney(b?.revenue_2025, b?.revenue_currency);
  const ask = b?.stake_pct ? `${formatMoney(b?.ask_amount, b?.ask_currency)} · ${percent(b?.stake_pct)}` : formatMoney(b?.ask_amount, b?.ask_currency);
  const city = provinceText(b?.city);
  const industry = industryText(b?.industry);
  const deal = b?.deal_type || T(lang, 'Cơ hội đầu tư', 'Investment opportunity');
  const score = Math.round(Number(b?.quality_score || b?.data_confidence || 70));
  return {
    slug: b?.slug || b?.username || b?.id || 'business',
    image: b?.image_url || '/assets/deal1.png',
    catVi: industry,
    catEn: industry,
    industryVi: industry,
    industryEn: industry,
    badges: [deal, industry, city].filter(Boolean).slice(0, 4),
    titleVi,
    titleEn,
    subtitleVi: descVi,
    subtitleEn: descEn,
    facts: [['Ngành','Industry',industry],['Địa điểm','Location',city],['Mã hồ sơ','Profile code',b?.public_code || 'D68'],['Giao dịch','Transaction',deal],['Doanh thu 2025E','2025E revenue',revenue],['EBITDA','EBITDA',percent(b?.ebitda_margin)],['Nhu cầu / giá trị','Ask / amount',ask],['Tỷ lệ chào','Stake offered',percent(b?.stake_pct)],['Độ tin cậy dữ liệu','Data confidence',b?.data_confidence ? `${b.data_confidence}/100` : 'Updating']],
    profileVi: toLines(b?.description_vi || b?.highlights_vi, [descVi]),
    profileEn: toLines(b?.description_en || b?.highlights_en, [descEn]),
    highlightsVi: toLines(b?.highlights_vi || b?.description_vi, [descVi]).slice(0, 4),
    highlightsEn: toLines(b?.highlights_en || b?.description_en, [descEn]).slice(0, 4),
    txTypeVi: deal,
    txTypeEn: deal,
    txAmountLabelVi: 'Nhu cầu / giá trị',
    txAmountLabelEn: 'Ask / amount',
    txBig: ask,
    txSubVi: b?.stake_pct ? `Tỷ lệ chào ${percent(b.stake_pct)}` : 'Điều khoản có sau kết nối',
    txSubEn: b?.stake_pct ? `Offered stake ${percent(b.stake_pct)}` : 'Terms available after connection',
    terms: [['Doanh thu 2025E','2025E revenue',revenue],['EBITDA','EBITDA',percent(b?.ebitda_margin)],['Nhu cầu / giá trị','Ask / amount',ask],['Trạng thái','Status','Anonymous · Reviewed']],
    useOfFundsVi: toLines(b?.investment_reason_vi, []),
    useOfFundsEn: toLines(b?.investment_reason_en, []),
    reasonVi: b?.investment_reason_vi || 'Thông tin mục đích giao dịch sẽ được cập nhật sau khi kết nối/NDA.',
    reasonEn: b?.investment_reason_en || 'Transaction rationale will be updated after connection/NDA.',
    finHeaders: ['Chỉ tiêu','2024E','2025E','Ghi chú'],
    finRows: [['Doanh thu', revenue, revenue, 'Estimated'],['Biên EBITDA', percent(b?.ebitda_margin), percent(b?.ebitda_margin), 'Subject to DD'],['Nhu cầu / giá trị', ask, ask, 'Indicative'],['Độ tin cậy dữ liệu', b?.data_confidence ? `${b.data_confidence}/100` : 'Updating', b?.data_confidence ? `${b.data_confidence}/100` : 'Updating', 'Admin review']],
    finNoteVi: 'Số liệu hiển thị là teaser/ước tính, cần thay bằng báo cáo tài chính, sao kê và tài liệu quản trị sau thẩm định.',
    finNoteEn: 'Displayed figures are teaser estimates and should be replaced by financial statements, bank records and management files after due diligence.',
    docs: defaultDocs,
    verifs: ['Email','Admin review','Data confidence'],
    faqs: [['Thông tin có được bảo mật không?','Is the information confidential?','Có. Hồ sơ public ở dạng ẩn danh; thông tin chi tiết chỉ mở sau kết nối được duyệt.','Yes. Public profiles are anonymous; detailed information unlocks after approved connection.'],['Tôi xem tài liệu bằng cách nào?','How do I view documents?','Nhà đầu tư cần đăng nhập, bày tỏ quan tâm và được duyệt kết nối/NDA.','Investors need to log in, express interest and be approved for connection/NDA.']],
    similar: ['hkmedi','phongcua','coldstore'],
    qualityScore: score
  };
}

function qualityBand(score: number) {
  if (score >= 80) return { labelVi: 'Mạnh', labelEn: 'Strong', color: '#16A34A', bg: '#E9F9EF' };
  if (score >= 70) return { labelVi: 'Tốt', labelEn: 'Good', color: '#1596cc', bg: '#E7F6FD' };
  if (score >= 60) return { labelVi: 'Cần DD', labelEn: 'Needs DD', color: '#B8860B', bg: '#FEF3D3' };
  return { labelVi: 'Sơ bộ', labelEn: 'Preliminary', color: '#64748B', bg: '#F1F5F9' };
}

function badgeStyle(index: number): CSSProperties {
  const styles = [
    { color: '#1596cc', background: '#E7F6FD' },
    { color: '#B8860B', background: '#FEF3D3' },
    { color: '#334155', background: '#F1F5F9' },
    { color: '#16A34A', background: '#E9F9EF' }
  ];
  return { ...pillBase, ...styles[index % styles.length] };
}

function similarCard(slug: string, lang: Lang) {
  const d = detailData[slug] || detailData.hkmedi;
  return {
    slug,
    image: d.image,
    title: T(lang, d.titleVi, d.titleEn),
    industry: T(lang, d.industryVi, d.industryEn),
    txType: T(lang, d.txTypeVi, d.txTypeEn),
    amount: d.txBig
  };
}

function tableCellStyle(first: boolean, head = false): CSSProperties {
  return {
    padding: head ? '0 10px 10px 0' : '11px 10px 11px 0',
    borderBottom: '1px solid #EEF2F6',
    fontWeight: first ? 700 : head ? 700 : 600,
    color: first ? '#334155' : head ? '#94A3B8' : '#0F2A4A',
    whiteSpace: first ? 'nowrap' : undefined
  };
}

export default function BusinessDetail({ lang }: { lang: Lang }) {
  const { slug = '' } = useParams();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [business, setBusiness] = useState<any>(null);
  const [investor, setInvestor] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      setErr('');
      try {
        const row = await getBusinessBySlug(slug);
        if (mounted) setBusiness(row);
      } catch (e: any) {
        if (mounted && !detailData[slug]) setErr(e?.message || 'Cannot load business detail');
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, [slug]);

  useEffect(() => {
    if (profile?.role === 'investor') getInvestorByOwner(profile.id).then(setInvestor).catch(() => {});
  }, [profile?.id, profile?.role]);

  const detail = useMemo(() => detailData[slug] || (business ? fallbackDetailFromBusiness(business, lang) : null), [slug, business, lang]);
  const canViewQuality = profile?.role === 'investor' || profile?.role === 'admin';
  const qsScore = Math.max(0, Math.min(100, Math.round(Number(business?.quality_score || detail?.qualityScore || 0))));
  const qsBand = qualityBand(qsScore);
  const qsDeg = Math.round(qsScore * 3.6);
  const title = detail ? T(lang, detail.titleVi, detail.titleEn) : '';
  const subtitle = detail ? T(lang, detail.subtitleVi, detail.subtitleEn) : '';
  const useOfFunds = detail ? (lang === 'en' ? detail.useOfFundsEn : detail.useOfFundsVi) || [] : [];
  const factoryFlow = detail ? (lang === 'en' ? detail.factoryFlowEn : detail.factoryFlowVi) || [] : [];
  const factoryTech = detail ? (lang === 'en' ? detail.factoryTechEn : detail.factoryTechVi) || [] : [];

  async function expressInterest() {
    if (!profile) { navigate('/login?next=' + encodeURIComponent(window.location.pathname)); return; }
    if (profile.role !== 'investor' || !investor) { setMsg(T(lang, 'Chỉ tài khoản Nhà đầu tư mới bày tỏ quan tâm.', 'Only investor accounts can express interest.')); return; }
    if (!business?.id) { setMsg(T(lang, 'Hồ sơ demo cần được đồng bộ database trước khi gửi quan tâm.', 'This demo profile needs database sync before interest can be submitted.')); return; }
    const { error } = await supabase.from('investor_interests').upsert({ business_id: business.id, investor_id: investor.id, status: 'interested' }, { onConflict: 'business_id,investor_id' });
    setMsg(error ? error.message : T(lang, 'Đã gửi quan tâm. Doanh nghiệp/Admin sẽ xem xét kết nối.', 'Interest submitted. Business/Admin can review the connection.'));
  }

  async function requestData() {
    if (!profile) { navigate('/login?next=' + encodeURIComponent(window.location.pathname)); return; }
    if (!investor) { setMsg(T(lang, 'Không tìm thấy hồ sơ nhà đầu tư.', 'Investor profile not found.')); return; }
    if (!business?.id) { setMsg(T(lang, 'Hồ sơ demo cần được đồng bộ database trước khi yêu cầu dữ liệu.', 'This demo profile needs database sync before requesting data.')); return; }
    const { error } = await supabase.from('request_data').insert({ business_id: business.id, investor_id: investor.id, requested_items: ['IM', 'NDA', 'Financial statements'], note: 'Investor requested IM/NDA from business detail.' });
    setMsg(error ? error.message : T(lang, 'Đã gửi yêu cầu dữ liệu tới Deals68/Admin và doanh nghiệp.', 'Data request sent to Deals68/Admin and the business.'));
  }

  if (loading) return <section style={{ maxWidth: 1240, margin: '0 auto', padding: '56px 24px' }}><div style={{ background: '#fff', border: '1px solid #E7EDF3', borderRadius: 16, padding: 28, color: '#64748B' }}>Loading...</div></section>;
  if (err || !detail) return <section style={{ maxWidth: 1240, margin: '0 auto', padding: '56px 24px' }}><div style={{ background: '#fff', border: '1px solid #E7EDF3', borderRadius: 16, padding: 28, color: '#64748B' }}>{err || T(lang, 'Không tìm thấy doanh nghiệp.', 'Business not found.')}</div></section>;

  return <>
    <div style={{ maxWidth: 1240, margin: '0 auto', padding: '22px 24px 0' }}>
      <div style={{ fontSize: 13, color: '#94A3B8' }}>
        <Link to="/"><span className="l-vi">Trang chủ</span><span className="l-en">Home</span></Link><span style={{ margin: '0 8px' }}>›</span>
        <Link to="/businesses"><span className="l-vi">Doanh nghiệp</span><span className="l-en">Businesses</span></Link><span style={{ margin: '0 8px' }}>›</span>
        <Link to="/businesses">Việt Nam</Link><span style={{ margin: '0 8px' }}>›</span>
        <span style={{ color: '#475569', fontWeight: 600 }}>{T(lang, detail.catVi, detail.catEn)}</span>
      </div>
    </div>

    <div className="d68-detail-cols" style={{ maxWidth: 1240, margin: '0 auto', padding: '14px 24px 40px', display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 348px', gap: 28, alignItems: 'start' }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          {detail.badges.map((bg, i) => <span key={bg} style={badgeStyle(i)}>{bg}</span>)}
          {qsScore ? <span style={{ ...pillBase, color: qsBand.color, background: qsBand.bg }}>◆ Quality {qsScore}/100 · {T(lang, qsBand.labelVi, qsBand.labelEn)}</span> : null}
        </div>
        <h1 className="d68-h1" style={{ fontSize: 29, fontWeight: 800, letterSpacing: -.7, margin: '0 0 8px', lineHeight: 1.18 }}>{title}</h1>
        <p style={{ fontSize: 16, color: '#64748B', lineHeight: 1.6, margin: '0 0 18px', maxWidth: 780 }}>{subtitle}</p>

        <div style={{ border: '1px solid #E7EDF3', borderRadius: 18, overflow: 'hidden', background: '#0F2A4A', boxShadow: '0 1px 2px rgba(15,42,74,.04)' }}>
          <img className="d68-hero-img" src={detail.image} alt={title} style={{ width: '100%', height: 420, objectFit: 'cover', display: 'block' }} />
        </div>

        <h2 style={{ fontSize: 19, fontWeight: 800, margin: '26px 0 12px' }}><span className="l-vi">Thông tin chính</span><span className="l-en">Key facts</span></h2>
        <div className="d68-facts" style={{ background: '#fff', border: '1px solid #E7EDF3', borderRadius: 16, padding: '8px 24px', display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: 44, boxShadow: '0 1px 2px rgba(15,42,74,.04)' }}>
          {detail.facts.map((ft) => <div key={ft[0] + ft[2]} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: '13px 0', borderBottom: '1px solid #F1F5F9' }}>
            <span style={{ fontSize: 13.5, color: '#64748B', flexShrink: 0 }}>{T(lang, ft[0], ft[1])}</span>
            <span style={{ fontSize: 13.5, fontWeight: 700, color: '#0F2A4A', textAlign: 'right' }}>{ft[2]}</span>
          </div>)}
        </div>

        {qsScore ? <div style={{ marginTop: 22, background: '#fff', border: '1px solid #E7EDF3', borderRadius: 16, padding: '22px 24px', boxShadow: '0 1px 2px rgba(15,42,74,.04)', display: 'flex', alignItems: 'center', gap: 22, flexWrap: 'wrap' }}>
          <div style={{ flexShrink: 0, width: 104, height: 104, borderRadius: '50%', background: `conic-gradient(${qsBand.color} ${qsDeg}deg, #EEF2F6 0deg)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: 80, height: 80, borderRadius: '50%', background: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 25, fontWeight: 800, color: qsBand.color }}>{qsScore}</span>
              <span style={{ fontSize: 9.5, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase' }}>/ 100</span>
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 230 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}><span style={{ fontSize: 15.5, fontWeight: 800 }}>Business Quality Score</span><span style={{ ...pillBase, color: qsBand.color, background: qsBand.bg }}>{T(lang, qsBand.labelVi, qsBand.labelEn)}</span></div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {['Profile', 'Financials', 'Deal terms', 'Documents', 'Admin review'].map((label) => <span key={label} style={{ ...pillBase, color: '#334155', background: '#F1F5F9', fontSize: 12 }}>✓ {label}</span>)}
            </div>
            {!canViewQuality ? <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, padding: '10px 14px', background: '#FEF3D3', border: '1px solid #F5D98B', borderRadius: 10 }}>
              <span style={{ fontSize: 15 }}>🔒</span>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: '#8a6400' }}>{T(lang, 'Chi tiết điểm chất lượng mở cho nhà đầu tư đã đăng nhập.', 'Quality details unlock for logged-in investors.')} <Link to="/login" style={{ color: '#B8860B', textDecoration: 'underline', fontWeight: 700 }}><span className="l-vi">Đăng nhập nhà đầu tư</span><span className="l-en">Investor login</span></Link></span>
            </div> : <p style={{ fontSize: 12, color: '#94A3B8', margin: '10px 0 0', lineHeight: 1.5 }}><span className="l-vi">Điểm chất lượng do Deals68 tổng hợp từ độ hoàn thiện hồ sơ, tài chính, điều khoản giao dịch, lý do định giá, ảnh, tài liệu, mức sẵn sàng data room và thẩm định của Admin.</span><span className="l-en">Quality Score is compiled by Deals68 from profile completeness, financials, deal terms, valuation reason, images, documents, data-room readiness and Admin review.</span></p>}
          </div>
        </div> : null}

        <div style={{ marginTop: 22, background: '#fff', border: '1px solid #E7EDF3', borderRadius: 16, padding: '26px 28px', boxShadow: '0 1px 2px rgba(15,42,74,.04)' }}>
          <h2 style={{ fontSize: 19, fontWeight: 800, margin: '0 0 14px' }}><span className="l-vi">Hồ sơ doanh nghiệp</span><span className="l-en">Business profile</span></h2>
          <ul style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 9 }}>
            {(lang === 'en' ? detail.profileEn : detail.profileVi).map((p) => <li key={p} style={{ fontSize: 15, color: '#475569', lineHeight: 1.6 }}>{p}</li>)}
          </ul>
        </div>

        <div style={{ marginTop: 22, background: '#fff', border: '1px solid #E7EDF3', borderRadius: 16, padding: '26px 28px', boxShadow: '0 1px 2px rgba(15,42,74,.04)' }}>
          <h2 style={{ fontSize: 19, fontWeight: 800, margin: '0 0 16px' }}><span className="l-vi">Điểm nổi bật thương vụ</span><span className="l-en">Deal highlights</span></h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {(lang === 'en' ? detail.highlightsEn : detail.highlightsVi).map((h) => <div key={h} style={{ display: 'flex', gap: 11, alignItems: 'flex-start', padding: 14, background: '#F7FAFC', border: '1px solid #EEF2F6', borderRadius: 12 }}>
              <span style={{ flexShrink: 0, width: 26, height: 26, borderRadius: 8, background: '#E7F6FD', color: '#1596cc', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13 }}>✓</span>
              <span style={{ fontSize: 14, color: '#334155', lineHeight: 1.5 }}>{h}</span>
            </div>)}
          </div>
        </div>

        {detail.hasFactory ? <div style={{ marginTop: 22, background: '#fff', border: '1px solid #E7EDF3', borderRadius: 16, padding: '26px 28px', boxShadow: '0 1px 2px rgba(15,42,74,.04)' }}>
          <h2 style={{ fontSize: 19, fontWeight: 800, margin: '0 0 16px' }}><span className="l-vi">Mô tả nhà máy & công nghệ</span><span className="l-en">Facility & technology</span></h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 20 }}>
            {factoryFlow.map((step, i) => <span key={step} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><span style={{ background: '#0F2A4A', color: '#fff', fontSize: 13, fontWeight: 700, padding: '9px 14px', borderRadius: 9 }}>{step}</span>{i < factoryFlow.length - 1 ? <span style={{ color: '#94A3B8', fontSize: 16 }}>→</span> : null}</span>)}
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: .5, color: '#94A3B8', marginBottom: 10 }}><span className="l-vi">Công nghệ & thiết bị</span><span className="l-en">Technology & equipment</span></div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 9 }}>{factoryTech.map((ft) => <span key={ft} style={{ fontSize: 13.5, fontWeight: 600, color: '#14315A', background: '#EAF0F6', border: '1px solid #dbe6f2', padding: '8px 13px', borderRadius: 9 }}>{ft}</span>)}</div>
        </div> : null}

        <div style={{ marginTop: 22, background: '#fff', border: '1px solid #E7EDF3', borderRadius: 16, padding: '26px 28px', boxShadow: '0 1px 2px rgba(15,42,74,.04)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
            <h2 style={{ fontSize: 19, fontWeight: 800, margin: 0 }}><span className="l-vi">Báo cáo tài chính 2024–2025</span><span className="l-en">Financials 2024–2025</span></h2>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: '#B8860B', background: '#FEF3D3', padding: '5px 11px', borderRadius: 7 }}>Estimated · Subject to DD</span>
          </div>
          <div style={{ overflowX: 'auto', minWidth: 0 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5, minWidth: 480 }}>
              <thead><tr style={{ textAlign: 'left', color: '#94A3B8' }}>{detail.finHeaders.map((hd, i) => <th key={hd} style={tableCellStyle(i === 0, true)}>{hd}</th>)}</tr></thead>
              <tbody>{detail.finRows.map((row, ri) => <tr key={ri}>{row.map((cell, ci) => <td key={ci} style={tableCellStyle(ci === 0)}>{cell}</td>)}</tr>)}</tbody>
            </table>
          </div>
          <p style={{ fontSize: 12.5, color: '#94A3B8', lineHeight: 1.55, margin: '14px 0 0' }}>{T(lang, detail.finNoteVi, detail.finNoteEn)}</p>
        </div>

        <div style={{ marginTop: 22, background: '#fff', border: '1px solid #E7EDF3', borderRadius: 16, padding: '26px 28px', boxShadow: '0 1px 2px rgba(15,42,74,.04)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 8, flexWrap: 'wrap' }}>
            <h2 style={{ fontSize: 19, fontWeight: 800, margin: 0 }}><span className="l-vi">Tài liệu</span><span className="l-en">Documents</span></h2>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 700, color: '#B8860B', background: '#FEF3D3', padding: '5px 11px', borderRadius: 7 }}>🔒 <span className="l-vi">Mở khóa sau kết nối / NDA</span><span className="l-en">Unlocks after connection / NDA</span></span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 28px' }}>{detail.docs.map((dc) => <div key={dc} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: '1px solid #F1F5F9' }}><span style={{ flexShrink: 0, width: 34, height: 34, borderRadius: 8, background: '#EAF0F6', color: '#0F2A4A', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}>📄</span><span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: '#334155' }}>{dc}</span><span style={{ flexShrink: 0, color: '#94A3B8' }}>🔒</span></div>)}</div>
        </div>

        <p style={{ marginTop: 20, fontSize: 12.5, color: '#94A3B8', lineHeight: 1.6 }}>
          <span className="l-vi"><b>Miễn trừ trách nhiệm:</b> Số liệu tài chính là ước tính minh họa (Estimated / Subject to Due Diligence), không phải cam kết lợi nhuận. Thông tin do doanh nghiệp cung cấp, chưa được Deals68 bảo đảm đầy đủ. Người dùng chịu trách nhiệm thẩm định trước khi giao dịch.</span>
          <span className="l-en"><b>Disclaimer:</b> Financials are illustrative estimates (subject to due diligence), not profit guarantees. Information is user-provided and not guaranteed by Deals68. Users are responsible for their own due diligence before transacting.</span>
        </p>
      </div>

      <aside className="d68-side" style={{ position: 'sticky', top: 90, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ background: '#fff', border: '1px solid #E7EDF3', borderRadius: 18, overflow: 'hidden', boxShadow: '0 8px 26px rgba(15,42,74,.08)' }}>
          <div style={{ background: '#0F2A4A', color: '#fff', padding: '18px 22px' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#9db4cc', textTransform: 'uppercase', letterSpacing: .6, marginBottom: 6 }}><span className="l-vi">Loại giao dịch</span><span className="l-en">Transaction</span></div>
            <div style={{ fontSize: 17, fontWeight: 800 }}>{T(lang, detail.txTypeVi, detail.txTypeEn)}</div>
          </div>
          <div style={{ padding: '20px 22px' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: .5 }}>{T(lang, detail.txAmountLabelVi, detail.txAmountLabelEn)}</div>
            <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: -.8, color: '#0F2A4A', margin: '2px 0' }}>{detail.txBig}</div>
            <div style={{ fontSize: 12.5, color: '#94A3B8' }}>{T(lang, detail.txSubVi, detail.txSubEn)}</div>
            <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 9 }}>{detail.terms.map((tt) => <div key={tt[0]} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 13 }}><span style={{ color: '#64748B' }}>{T(lang, tt[0], tt[1])}</span><span style={{ fontWeight: 700, textAlign: 'right' }}>{tt[2]}</span></div>)}</div>
            {useOfFunds.length ? <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid #EEF2F6' }}><div style={{ fontSize: 12, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: .5, marginBottom: 9 }}><span className="l-vi">Mục đích sử dụng vốn</span><span className="l-en">Use of funds</span></div><div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>{useOfFunds.map((uf) => <div key={uf} style={{ display: 'flex', gap: 8, fontSize: 13, color: '#475569', lineHeight: 1.4 }}><span style={{ color: '#1BADEA', flexShrink: 0 }}>▪</span>{uf}</div>)}</div></div> : null}
            <div style={{ marginTop: 16, padding: '12px 14px', background: '#F7FAFC', border: '1px solid #EEF2F6', borderRadius: 11, fontSize: 13, color: '#64748B', lineHeight: 1.55 }}><b style={{ color: '#334155' }}><span className="l-vi">Lý do giao dịch:</span><span className="l-en">Reason:</span></b> {T(lang, detail.reasonVi, detail.reasonEn)}</div>
          </div>
        </div>

        <div style={{ background: '#fff', border: '1px solid #E7EDF3', borderRadius: 18, padding: 22, boxShadow: '0 1px 2px rgba(15,42,74,.04)' }}>
          <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 4 }}><span className="l-vi">Kết nối với doanh nghiệp</span><span className="l-en">Connect with the business</span></div>
          <p style={{ fontSize: 13, color: '#64748B', lineHeight: 1.55, margin: '0 0 14px' }}><span className="l-vi">Tên, liên hệ và toàn bộ tài liệu mở sau khi hai bên chấp nhận kết nối / ký NDA.</span><span className="l-en">Name, contact and all documents unlock after both parties accept the connection / sign an NDA.</span></p>
          <button onClick={expressInterest} style={{ display: 'block', width: '100%', textAlign: 'center', background: msg ? '#D9FBE7' : '#F2B51D', color: '#0F2A4A', fontWeight: 800, fontSize: 16, padding: 14, borderRadius: 12, boxShadow: '0 8px 20px rgba(242,181,29,.32)', border: 'none', cursor: 'pointer' }}>{msg ? T(lang, 'Đã ghi nhận / xem thông báo', 'Recorded / see notice') : T(lang, 'Bày tỏ quan tâm', 'Express interest')}</button>
          <button onClick={requestData} style={{ display: 'block', width: '100%', textAlign: 'center', marginTop: 10, border: '1px solid #1BADEA', color: '#1596cc', background: '#fff', fontWeight: 700, fontSize: 14.5, padding: 12, borderRadius: 11, cursor: 'pointer' }}><span className="l-vi">Yêu cầu IM / NDA</span><span className="l-en">Request IM / NDA</span></button>
          {msg ? <div style={{ marginTop: 12, padding: 10, borderRadius: 10, background: '#F7FAFC', border: '1px solid #EEF2F6', fontSize: 12.5, color: '#475569', lineHeight: 1.5 }}>{msg}</div> : null}
          <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: '#16A34A', fontWeight: 600 }}>📈 <span className="l-vi">Nhiều nhà đầu tư đang quan tâm thương vụ này</span><span className="l-en">Several investors are tracking this deal</span></div>
        </div>

        <div style={{ background: '#fff', border: '1px solid #E7EDF3', borderRadius: 18, padding: '20px 22px', boxShadow: '0 1px 2px rgba(15,42,74,.04)' }}>
          <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 12, color: '#334155' }}><span className="l-vi">Đã xác minh</span><span className="l-en">Verified</span></div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>{detail.verifs.map((v) => <span key={v} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 600, color: '#16A34A', background: '#E9F9EF', padding: '6px 11px', borderRadius: 8 }}>✓ {v}</span>)}</div>
        </div>
      </aside>
    </div>

    <section style={{ background: '#fff', borderTop: '1px solid #E7EDF3' }}>
      <div style={{ maxWidth: 1240, margin: '0 auto', padding: '52px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
          <h2 style={{ fontSize: 25, fontWeight: 800, letterSpacing: -.6, margin: 0 }}><span className="l-vi">Thương vụ tương tự</span><span className="l-en">Similar deals</span></h2>
          <Link to="/businesses" style={{ fontWeight: 700, color: '#1BADEA', fontSize: 15 }}><span className="l-vi">Xem tất cả</span><span className="l-en">View all</span> →</Link>
        </div>
        <div className="d68-sim" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 20 }}>
          {detail.similar.map((s) => similarCard(s, lang)).map((s) => <Link key={s.slug} to={`/businesses/${s.slug}`} style={{ background: '#fff', border: '1px solid #E7EDF3', borderRadius: 16, overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 1px 2px rgba(15,42,74,.04)', transition: 'transform .18s, box-shadow .18s' }}>
            <div style={{ height: 150, overflow: 'hidden', background: '#0F2A4A' }}><img src={s.image} alt={s.title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} /></div>
            <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', flex: 1 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#1596cc', background: '#E7F6FD', padding: '3px 9px', borderRadius: 6, alignSelf: 'flex-start', marginBottom: 9 }}>{s.industry}</span>
              <h3 style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.35, margin: '0 0 12px', flex: 1 }}>{s.title}</h3>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 12, borderTop: '1px solid #EEF2F6', fontSize: 13 }}><span style={{ color: '#94A3B8', fontWeight: 600 }}>{s.txType}</span><span style={{ fontWeight: 800, color: '#1596cc' }}>{s.amount}</span></div>
            </div>
          </Link>)}
        </div>
      </div>
    </section>

    <section style={{ maxWidth: 900, margin: '0 auto', padding: '52px 24px' }}>
      <h2 style={{ fontSize: 25, fontWeight: 800, letterSpacing: -.5, margin: '0 0 22px' }}><span className="l-vi">Câu hỏi thường gặp</span><span className="l-en">Frequently asked questions</span></h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{detail.faqs.map((f) => <div key={f[0]} style={{ background: '#fff', border: '1px solid #E7EDF3', borderRadius: 14, padding: '20px 22px' }}><div style={{ fontSize: 16, fontWeight: 700, marginBottom: 7 }}>{T(lang, f[0], f[1])}</div><p style={{ fontSize: 14.5, color: '#64748B', lineHeight: 1.6, margin: 0 }}>{T(lang, f[2], f[3])}</p></div>)}</div>
    </section>
  </>;
}
