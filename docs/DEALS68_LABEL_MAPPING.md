# Deals68 Label Mapping Standard

Áp dụng cho toàn bộ public pages, auth/register pages, dashboard và admin review.

## Nguyên tắc

- UI tiếng Việt chỉ hiển thị label tiếng Việt, trừ thuật ngữ không có bản dịch phổ biến như VC, PE, EBITDA, SaaS.
- UI English chỉ hiển thị English.
- Dữ liệu Supabase có thể chứa mixed English/Vietnamese; component phải map qua `src/lib/labels.ts` trước khi render.
- Không dùng raw values như `Fundraise`, `Primary shares`, `Health Care`, `Beauty & Personal Care` trực tiếp trên UI tiếng Việt.

## Industry mapping

| Raw / synonym | VI | EN |
|---|---|---|
| Finance, Financial, Fintech | Tài chính | Finance |
| Healthcare, Health Care, Clinic, Dental | Y tế & Sức khỏe | Healthcare |
| Beauty, Personal Care, Spa | Làm đẹp & Chăm sóc cá nhân | Beauty & Personal Care |
| Technology, Tech, Software, SaaS, AI | Công nghệ | Technology |
| F&B, Food & Beverage, Restaurant | F&B | F&B |
| Retail | Bán lẻ | Retail |
| Manufacturing | Sản xuất | Manufacturing |
| Real Estate | Bất động sản | Real Estate |
| Logistics, Warehouse, Cold Storage | Logistics & Kho vận | Logistics & Warehousing |
| Education | Giáo dục | Education |
| Energy | Năng lượng | Energy |
| E-commerce | Thương mại điện tử | E-commerce |
| Seafood, Export | Thủy sản & Xuất khẩu | Seafood & Export |
| Fashion, Apparel, Textile | Thời trang | Fashion |
| Business Services, Consulting | Dịch vụ doanh nghiệp | Business Services |

## Business deal type mapping

| Raw / synonym | VI | EN |
|---|---|---|
| Fundraise, Primary shares, Equity, Investment | Gọi vốn | Fundraise |
| Loan, Debt, Credit | Vay vốn | Debt financing |
| Sale, M&A, Acquisition, Transfer, Asset transfer | M&A / Chuyển nhượng | M&A / Sale |
| JV, Joint Venture, Partnership | Đối tác / Liên doanh | Partnership / JV |

## Investor deal type mapping

| Business-side concept | Investor-side VI | Investor-side EN |
|---|---|---|
| Fundraise / Equity | Đầu tư | Investment |
| Loan / Debt | Cho vay | Lending |
| Sale / M&A | M&A | M&A |
| Partnership / JV | Đối tác / Liên doanh | Partnership / JV |

## Investor type mapping

| Raw | VI | EN |
|---|---|---|
| VC | Quỹ đầu tư mạo hiểm | VC |
| PE | Quỹ đầu tư tư nhân | PE |
| Institutional | Nhà đầu tư tổ chức | Institutional |
| Corporate/Strategic | Doanh nghiệp chiến lược | Corporate / Strategic |
| Individual/Angel | Nhà đầu tư cá nhân / Angel | Individual / Angel |
| Family Office | Family Office | Family Office |
| Lender/Debt | Bên cho vay / Tín dụng | Lender / Debt |

## Country / market mapping

| ISO | VI | EN | Dial |
|---|---|---|---|
| VN | Việt Nam | Vietnam | +84 |
| SG | Singapore | Singapore | +65 |
| US | Hoa Kỳ | United States | +1 |
| JP | Nhật Bản | Japan | +81 |
| KR | Hàn Quốc | South Korea | +82 |
| HK | Hồng Kông | Hong Kong | +852 |
| AU | Úc | Australia | +61 |
| DE | Đức | Germany | +49 |
| CA | Canada | Canada | +1 |
| TH | Thái Lan | Thailand | +66 |
| AE | UAE | UAE | +971 |

## Implementation

- Source of truth: `src/lib/labels.ts`
- New public components must use:
  - `labelIndustry`
  - `labelDealType`
  - `labelInvestorType`
  - `labelStage`
  - `labelCountry`
  - `labelRegion`
  - `formatMoneyForLang`
