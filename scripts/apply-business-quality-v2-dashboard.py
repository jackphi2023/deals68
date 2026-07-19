from pathlib import Path

path = Path('src/pages/BusinessDashboard.tsx')
text = path.read_text(encoding='utf-8')

old = '''function buildQualityItems(lang: Lang, b: any, files: any[], images: any[]) {
  const financialInput = financialInputOf(b);
  const hasFinancialData = Number(b?.revenue_2025 || 0) > 0 && b?.ebitda_margin !== null && b?.ebitda_margin !== undefined;
  return [
    {
      ok: images.length > 0,
      label: T(lang, 'Ảnh doanh nghiệp', 'Business images'),
      detail: images.length ? T(lang, `${images.length} ảnh đã gửi`, `${images.length} image(s) submitted`) : T(lang, 'Chưa gửi ảnh doanh nghiệp', 'Missing business images')
    },
    {
      ok: files.some((f) => fileMatches(f, ['profile', 'im', 'teaser'], ['pdf', 'ppt', 'pptx', 'doc', 'docx'])),
      label: T(lang, 'Hồ sơ doanh nghiệp / Teaser / IM', 'Business profile / teaser / IM'),
      detail: T(lang, 'PDF, Word, PowerPoint hoặc hồ sơ giới thiệu', 'PDF, Word, PowerPoint or profile deck')
    },
    {
      ok: files.some((f) => fileMatches(f, ['financial'], ['xls', 'xlsx', 'pdf'])),
      label: T(lang, 'Báo cáo tài chính / Excel số liệu', 'Financial statements / Excel data'),
      detail: T(lang, 'Báo cáo tài chính, Excel doanh thu, lợi nhuận, EBITDA', 'Financial statements, revenue, profit or EBITDA files')
    },
    {
      ok: hasFinancialData,
      label: T(lang, 'Doanh thu & EBITDA', 'Revenue & EBITDA'),
      detail: hasFinancialData ? T(lang, 'Đã có số liệu tài chính chính', 'Core financial metrics provided') : T(lang, 'Cần bổ sung doanh thu và EBITDA', 'Revenue and EBITDA are missing')
    },
    {
      ok: !!(financialInput.assets_owned_vi || financialInput.assets_owned_en || financialInput.assets_owned || financialInput.included_tangible_assets_vi || financialInput.included_tangible_assets_en || financialInput.included_tangible_assets || financialInput.financial_source),
      label: T(lang, 'Tài sản & nguồn số liệu', 'Assets & data source'),
      detail: T(lang, 'Tài sản doanh nghiệp sở hữu, tài sản hữu hình đưa vào giao dịch và nguồn số liệu', 'Business-owned assets, tangible assets included in the transaction and data source')
    },
    {
      ok: Number(b?.ask_amount || 0) > 0 && Number(b?.stake_pct || 0) > 0,
      label: T(lang, 'Định giá / nhu cầu vốn', 'Valuation / capital ask'),
      detail: T(lang, 'Nhu cầu vốn hoặc giá chào và tỷ lệ cổ phần', 'Ask amount or asking price and stake percentage')
    }
  ];
}
'''

new = '''function buildQualityItems(lang: Lang, b: any, files: any[], images: any[]) {
  const financialInput = financialInputOf(b);
  const approvedFiles = files.filter((file) => isApprovedStatus(file?.review_status));
  const approvedImages = images.filter(
    (image) => isApprovedStatus(image?.review_status) && image?.is_sanitized,
  );
  const hasProfileDocument = approvedFiles.some((file) =>
    fileMatches(file, ['profile', 'im', 'teaser'], ['ppt', 'pptx', 'doc', 'docx']),
  );
  const hasFinancialDocument = approvedFiles.some((file) =>
    fileMatches(file, ['financial'], ['xls', 'xlsx']),
  );
  const hasAssetDocument = approvedFiles.some((file) =>
    fileMatches(file, ['asset', 'legal', 'ownership'], []),
  );
  const hasFinancialData =
    Number(b?.revenue_2025 || 0) > 0 &&
    b?.ebitda_margin !== null &&
    b?.ebitda_margin !== undefined;
  const hasAssetDeclaration = !!(
    financialInput.assets_owned_vi ||
    financialInput.assets_owned_en ||
    financialInput.assets_owned ||
    financialInput.included_tangible_assets_vi ||
    financialInput.included_tangible_assets_en ||
    financialInput.included_tangible_assets
  );
  const financialSource = String(financialInput.financial_source || '').toLowerCase();
  const sourceIsVerified = !!financialSource && financialSource !== 'estimate';
  const valuationItem = Array.isArray(b?.quality_breakdown_json?.items)
    ? b.quality_breakdown_json.items.find((item: any) => item?.key === 'valuation')
    : null;
  const valuationStatus = T(
    lang,
    valuationItem?.status_vi || 'Cần bổ sung cơ sở định giá',
    valuationItem?.status_en || 'Valuation basis needs supporting evidence',
  );
  const valuationOk =
    Number(valuationItem?.max || 0) > 0 &&
    Number(valuationItem?.score || 0) >= Number(valuationItem?.max || 0) * 0.7;

  return [
    {
      ok: approvedImages.length > 0,
      label: T(lang, 'Ảnh doanh nghiệp', 'Business images'),
      detail: approvedImages.length
        ? T(lang, `${approvedImages.length} ảnh đã duyệt`, `${approvedImages.length} approved image(s)`)
        : images.length
          ? T(lang, 'Ảnh đã tải lên đang chờ duyệt', 'Uploaded images are pending review')
          : T(lang, 'Chưa gửi ảnh doanh nghiệp', 'Missing business images'),
    },
    {
      ok: hasProfileDocument,
      label: T(lang, 'Hồ sơ doanh nghiệp / Teaser / IM', 'Business profile / teaser / IM'),
      detail: hasProfileDocument
        ? T(lang, 'Đã có tài liệu được Admin duyệt', 'An Admin-approved document is available')
        : T(lang, 'Chưa có Teaser/IM được duyệt', 'No approved Teaser/IM is available'),
    },
    {
      ok: hasFinancialDocument,
      label: T(lang, 'Báo cáo tài chính / Excel số liệu', 'Financial statements / Excel data'),
      detail: hasFinancialDocument
        ? T(lang, 'Đã có tài liệu tài chính được duyệt', 'Approved financial evidence is available')
        : T(lang, 'Chưa có tài liệu tài chính được duyệt', 'No approved financial evidence is available'),
    },
    {
      ok: hasFinancialData && hasFinancialDocument,
      label: T(lang, 'Doanh thu & EBITDA', 'Revenue & EBITDA'),
      detail: !hasFinancialData
        ? T(lang, 'Cần bổ sung doanh thu và EBITDA', 'Revenue and EBITDA are missing')
        : hasFinancialDocument
          ? T(lang, 'Đã có số liệu và tài liệu chứng minh', 'Metrics are supported by approved evidence')
          : T(lang, 'Đã khai báo, chưa được chứng minh', 'Declared, not yet evidenced'),
    },
    {
      ok: hasAssetDeclaration && hasAssetDocument && sourceIsVerified,
      label: T(lang, 'Tài sản & nguồn số liệu', 'Assets & data source'),
      detail: !hasAssetDeclaration
        ? T(lang, 'Chưa khai báo tài sản đưa vào giao dịch', 'Transaction assets have not been declared')
        : hasAssetDocument && sourceIsVerified
          ? T(lang, 'Đã có khai báo và tài liệu/nguồn xác minh', 'Declaration is supported by evidence and source data')
          : T(lang, 'Đã khai báo, cần bổ sung tài liệu xác minh', 'Declared, supporting evidence is still required'),
    },
    {
      ok: valuationOk,
      label: T(lang, 'Định giá / nhu cầu vốn', 'Valuation / capital ask'),
      detail: valuationStatus,
    },
  ];
}
'''

if old not in text:
    raise SystemExit('BusinessDashboard buildQualityItems block not found')

path.write_text(text.replace(old, new), encoding='utf-8')
