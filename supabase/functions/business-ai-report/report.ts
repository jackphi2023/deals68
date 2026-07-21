import type {
  AiNarrative,
  GeneratorMode,
  ReportContent,
  ReportGrade,
  ReportLanguage,
  ReportPreflight,
  ReportSourceSnapshot,
  SourceFact,
  SourceFile,
} from './types.ts';

const SOURCE_LABEL = 'Deals68 AI Report' as const;

function text(value: unknown) {
  return String(value ?? '').trim();
}

function numberOrNull(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function objectOf(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function arrayOf(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function itemMessage(value: unknown, language: ReportLanguage) {
  if (typeof value === 'string') return value.replaceAll('_', ' ');
  const row = objectOf(value);
  return language === 'en'
    ? text(row.message_en || row.message_vi || row.code)
    : text(row.message_vi || row.message_en || row.code);
}

function fileName(file?: SourceFile | null) {
  return text(file?.display_name || file?.file_name) || 'Tài liệu';
}

function citationFor(fact: SourceFact, file?: SourceFile | null) {
  const parts = [fileName(file)];
  if (fact.page_number) parts.push(`trang ${fact.page_number}`);
  if (fact.sheet_name) parts.push(`sheet ${fact.sheet_name}`);
  if (fact.cell_range) parts.push(`ô ${fact.cell_range}`);
  return `[${parts.join(' · ')}]`;
}

function isUsable(file: SourceFile) {
  const processing = file.processing || {};
  const processed =
    processing.parse_status === 'processed' ||
    processing.ocr_status === 'processed';
  const visible = !['reviewed_hidden', 'rejected'].includes(
    text(file.review_status).toLowerCase(),
  );
  return processed && visible && processing.entity_match_status !== 'mismatch';
}

function excludedReason(file: SourceFile, language: ReportLanguage) {
  const processing = file.processing || {};
  if (processing.entity_match_status === 'mismatch') {
    return language === 'en'
      ? 'Entity or asset mismatch; excluded from report.'
      : 'Không khớp doanh nghiệp hoặc tài sản; đã loại khỏi báo cáo.';
  }
  if (['reviewed_hidden', 'rejected'].includes(text(file.review_status).toLowerCase())) {
    return language === 'en'
      ? 'Not approved for report use.'
      : 'Không được duyệt để sử dụng trong báo cáo.';
  }
  if (
    processing.parse_status === 'unreadable' ||
    processing.ocr_status === 'unreadable' ||
    processing.parse_status === 'error' ||
    processing.ocr_status === 'error'
  ) {
    return language === 'en'
      ? 'Unreadable or processing error.'
      : 'Không đọc được hoặc lỗi xử lý.';
  }
  return language === 'en'
    ? 'Not fully processed; excluded from this report version.'
    : 'Chưa xử lý hoàn tất; không dùng trong phiên bản báo cáo này.';
}

function formatMoney(value: unknown, currency: unknown, language: ReportLanguage) {
  const n = numberOrNull(value);
  if (n === null) return language === 'en' ? 'Not provided' : 'Chưa cung cấp';
  try {
    return `${new Intl.NumberFormat(language === 'en' ? 'en-US' : 'vi-VN', {
      maximumFractionDigits: 0,
    }).format(n)} ${text(currency) || 'VND'}`;
  } catch {
    return `${n} ${text(currency) || 'VND'}`;
  }
}

function baseNarrative(
  snapshot: ReportSourceSnapshot,
  preflight: ReportPreflight,
  facts: SourceFact[],
  language: ReportLanguage,
): AiNarrative {
  const business = snapshot.business || {};
  const documentedRevenue = facts.some((fact) =>
    ['revenue_net', 'revenue_annual', 'revenue_2025'].includes(fact.field_key) &&
    fact.confidence >= 0.7 &&
    ['extracted', 'validated'].includes(fact.validation_status),
  );
  const strengths: string[] = [];
  const risks: string[] = [];
  const recommendations: string[] = [];

  if (text(business.industry || business.industry_key)) {
    strengths.push(
      language === 'en'
        ? 'The Business profile identifies a clear operating sector.'
        : 'Hồ sơ đã xác định rõ lĩnh vực hoạt động.',
    );
  }
  if (facts.length) {
    strengths.push(
      language === 'en'
        ? `${facts.length} document-backed or derived facts are available for this report.`
        : `Báo cáo sử dụng ${facts.length} dữ kiện có nguồn tài liệu hoặc dữ kiện suy dẫn.`,
    );
  }
  if (!documentedRevenue) {
    risks.push(
      language === 'en'
        ? 'Revenue is self-declared or has not reached the document-backed confidence threshold.'
        : 'Doanh thu đang là dữ liệu tự kê khai hoặc chưa đạt ngưỡng tin cậy từ tài liệu.',
    );
    recommendations.push(
      language === 'en'
        ? 'Add recent financial statements, tax/accounting records and monthly revenue evidence.'
        : 'Bổ sung báo cáo tài chính gần nhất, chứng từ kế toán/thuế và dữ liệu doanh thu theo tháng.',
    );
  }
  if (preflight.authority_notice_required) {
    risks.push(
      language === 'en'
        ? 'The listing authority is not fully verified or does not cover the full transaction scope.'
        : 'Thẩm quyền đăng tin chưa được xác minh đầy đủ hoặc chưa bao phủ toàn bộ phạm vi giao dịch.',
    );
  }
  if (arrayOf(preflight.warnings).length) {
    recommendations.push(
      language === 'en'
        ? 'Resolve the open data-quality warnings before investor due diligence.'
        : 'Xử lý các cảnh báo chất lượng dữ liệu trước khi nhà đầu tư thẩm định.',
    );
  }

  const name =
    text(business.title_vi || business.title_en || business.public_code) ||
    (language === 'en' ? 'the Business' : 'doanh nghiệp');
  const summary = language === 'en'
    ? `${name} is presented as a ${text(business.industry || business.industry_key) || 'business'} opportunity. This report separates self-declared information from document-backed facts and does not treat unverified data as verified.`
    : `${name} được trình bày là cơ hội thuộc lĩnh vực ${text(business.industry || business.industry_key) || 'chưa xác định'}. Báo cáo tách riêng dữ liệu tự kê khai và dữ kiện có tài liệu, không coi dữ liệu chưa kiểm chứng là đã xác minh.`;

  return {
    executive_summary: summary,
    strengths,
    risks,
    recommendations,
  };
}

export function buildGroundedReportContent(params: {
  snapshot: ReportSourceSnapshot;
  preflight: ReportPreflight;
  facts: SourceFact[];
  language: ReportLanguage;
  aiNarrative?: AiNarrative | null;
  generatorMode: GeneratorMode;
}) {
  const { snapshot, preflight, facts, language, aiNarrative, generatorMode } = params;
  const files = Array.isArray(snapshot.files) ? snapshot.files : [];
  const fileMap = new Map(files.map((file) => [file.id, file]));
  const usableFiles = files.filter(isUsable);
  const excludedFiles = files.filter((file) => !isUsable(file));
  const cleanFacts = facts
    .filter((fact) => {
      if (!fact.business_file_id) return fact.fact_kind === 'derived';
      return isUsable(fileMap.get(fact.business_file_id) || ({ id: '' } as SourceFile));
    })
    .map((fact) => {
      const file = fact.business_file_id ? fileMap.get(fact.business_file_id) : null;
      return {
        ...fact,
        citation: citationFor(fact, file),
        file_name: fileName(file),
      };
    });

  const reportGrade: ReportGrade = preflight.grade === 'full' ? 'full' : 'limited';
  const warnings = arrayOf(preflight.warnings).map((item) => itemMessage(item, language)).filter(Boolean);
  const missing = arrayOf(preflight.missing).map((item) => itemMessage(item, language)).filter(Boolean);
  const authority = snapshot.authority ? objectOf(snapshot.authority) : null;
  const authorityNotice = language === 'en'
    ? text(preflight.authority_notice_en || preflight.authority_notice_vi)
    : text(preflight.authority_notice_vi || preflight.authority_notice_en);
  if (authorityNotice && !warnings.includes(authorityNotice)) warnings.push(authorityNotice);

  const content: ReportContent = {
    source_label: SOURCE_LABEL,
    language,
    report_grade: reportGrade,
    generator_mode: generatorMode,
    generated_at: new Date().toISOString(),
    business: snapshot.business || {},
    preflight,
    authority,
    ai_narrative: aiNarrative || baseNarrative(snapshot, preflight, cleanFacts, language),
    facts: cleanFacts,
    usable_files: usableFiles.map((file) => ({
      id: file.id,
      name: fileName(file),
      category: text(file.category) || 'other',
      status: text(file.processing?.detected_document_type || file.review_status) || 'processed',
    })),
    excluded_files: excludedFiles.map((file) => ({
      id: file.id,
      name: fileName(file),
      reason: excludedReason(file, language),
    })),
    warnings,
    missing,
    disclaimer: language === 'en'
      ? 'This report is generated from information supplied by the Business and available Data Room evidence. Self-declared information is not independently verified. The report is not an investment recommendation, legal opinion, audit opinion or guarantee of transaction authority.'
      : 'Báo cáo được tạo từ thông tin doanh nghiệp cung cấp và bằng chứng hiện có trong Data Room. Dữ liệu tự kê khai chưa được kiểm chứng độc lập. Báo cáo không phải khuyến nghị đầu tư, ý kiến pháp lý, ý kiến kiểm toán hoặc bảo đảm về thẩm quyền giao dịch.',
  };

  return {
    content,
    manifest: [
      ...content.usable_files.map((file) => ({ ...file, usage: 'included' })),
      ...content.excluded_files.map((file) => ({ ...file, usage: 'excluded' })),
    ],
  };
}

export function reportFileName(snapshot: ReportSourceSnapshot, generatedAt: Date) {
  const business = snapshot.business || {};
  const code = text(business.public_code || business.id || 'Business')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .slice(0, 60) || 'Business';
  const day = generatedAt.toISOString().slice(0, 10).replaceAll('-', '');
  return `Deals68_AI_Report_${code}_${day}.pdf`;
}

export function reportSummaryForAi(
  snapshot: ReportSourceSnapshot,
  preflight: ReportPreflight,
  facts: SourceFact[],
) {
  const business = snapshot.business || {};
  return {
    source_label: SOURCE_LABEL,
    instruction: 'Use only the supplied fields and facts. Do not introduce new numbers, valuations, legal conclusions or investment recommendations.',
    business: {
      public_code: business.public_code,
      title_vi: business.title_vi,
      title_en: business.title_en,
      industry: business.industry || business.industry_key,
      deal_type: business.deal_type,
      city: business.city,
      revenue_2025_self_declared: business.revenue_2025,
      revenue_month_self_declared: business.revenue_month,
      revenue_currency: business.revenue_currency,
      ebitda_margin_self_declared: business.ebitda_margin,
      growth_pct_self_declared: business.growth_pct,
      ask_amount_self_declared: business.ask_amount,
      ask_currency: business.ask_currency,
      stake_pct_self_declared: business.stake_pct,
      description_vi: business.description_vi,
      description_en: business.description_en,
    },
    preflight,
    facts: facts.slice(0, 80).map((fact) => ({
      field_key: fact.field_key,
      period_key: fact.period_key,
      value_json: fact.value_json,
      normalized_value: fact.normalized_value,
      unit: fact.unit,
      currency: fact.currency,
      confidence: fact.confidence,
      validation_status: fact.validation_status,
      source_excerpt: fact.source_excerpt,
    })),
  };
}

export { SOURCE_LABEL, formatMoney };
