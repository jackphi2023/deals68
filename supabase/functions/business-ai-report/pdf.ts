import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage,
} from 'npm:pdf-lib@1.17.1';
import fontkit from 'npm:@pdf-lib/fontkit@1.1.1';
import type { ReportContent, ReportLanguage } from './types.ts';
import { SOURCE_LABEL, formatMoney } from './report.ts';

const A4: [number, number] = [595.28, 841.89];
const MARGIN_X = 48;
const TOP = 792;
const BOTTOM = 58;
const BODY_SIZE = 10.4;
const LINE_HEIGHT = 15;
const FONT_REGULAR_URL =
  Deno.env.get('REPORT_FONT_REGULAR_URL') ||
  'https://raw.githubusercontent.com/notofonts/noto-fonts/main/hinted/ttf/NotoSans/NotoSans-Regular.ttf';
const FONT_BOLD_URL =
  Deno.env.get('REPORT_FONT_BOLD_URL') ||
  'https://raw.githubusercontent.com/notofonts/noto-fonts/main/hinted/ttf/NotoSans/NotoSans-Bold.ttf';

let cachedFonts: Promise<{ regular: Uint8Array; bold: Uint8Array }> | null = null;

function fetchFonts() {
  if (!cachedFonts) {
    cachedFonts = Promise.all([
      fetch(FONT_REGULAR_URL).then(async (response) => {
        if (!response.ok) throw new Error(`font_regular_${response.status}`);
        return new Uint8Array(await response.arrayBuffer());
      }),
      fetch(FONT_BOLD_URL).then(async (response) => {
        if (!response.ok) throw new Error(`font_bold_${response.status}`);
        return new Uint8Array(await response.arrayBuffer());
      }),
    ]).then(([regular, bold]) => ({ regular, bold }));
  }
  return cachedFonts;
}

function plain(value: unknown) {
  return String(value ?? '').trim();
}

function asciiFallback(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/[^\x20-\x7E\n]/g, '?');
}

function display(value: unknown, unicode: boolean) {
  const result = plain(value);
  return unicode ? result : asciiFallback(result);
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number) {
  const paragraphs = text.replace(/\r/g, '').split('\n');
  const lines: string[] = [];
  for (const paragraph of paragraphs) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (!words.length) {
      lines.push('');
      continue;
    }
    let line = words.shift() || '';
    for (const word of words) {
      const next = `${line} ${word}`;
      if (font.widthOfTextAtSize(next, size) <= maxWidth) line = next;
      else {
        lines.push(line);
        line = word;
      }
    }
    lines.push(line);
  }
  return lines;
}

function valueText(value: unknown) {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'number') return new Intl.NumberFormat('vi-VN').format(value);
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

function factValue(fact: ReportContent['facts'][number]) {
  const base = fact.normalized_value ?? fact.value_json;
  const suffix = [fact.currency, fact.unit].filter(Boolean).join(' ');
  return `${valueText(base)}${suffix ? ` ${suffix}` : ''}`;
}

export async function createReportPdf(content: ReportContent): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  let regular: PDFFont;
  let bold: PDFFont;
  let unicode = true;

  try {
    pdf.registerFontkit(fontkit);
    const fonts = await fetchFonts();
    regular = await pdf.embedFont(fonts.regular, { subset: true });
    bold = await pdf.embedFont(fonts.bold, { subset: true });
  } catch (error) {
    console.warn('Unicode report font unavailable; using ASCII fallback', error);
    unicode = false;
    regular = await pdf.embedFont(StandardFonts.Helvetica);
    bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  }

  const pages: PDFPage[] = [];
  let page = pdf.addPage(A4);
  pages.push(page);
  let y = TOP;

  const addPage = () => {
    page = pdf.addPage(A4);
    pages.push(page);
    y = TOP;
    return page;
  };

  const ensure = (height: number) => {
    if (y - height < BOTTOM) addPage();
  };

  const drawWrapped = (
    value: unknown,
    options: {
      size?: number;
      lineHeight?: number;
      font?: PDFFont;
      indent?: number;
      color?: ReturnType<typeof rgb>;
      gapAfter?: number;
    } = {},
  ) => {
    const size = options.size || BODY_SIZE;
    const lineHeight = options.lineHeight || LINE_HEIGHT;
    const chosenFont = options.font || regular;
    const indent = options.indent || 0;
    const text = display(value, unicode);
    const lines = wrapText(text || '—', chosenFont, size, A4[0] - MARGIN_X * 2 - indent);
    ensure(lines.length * lineHeight + (options.gapAfter || 0));
    for (const line of lines) {
      page.drawText(line || ' ', {
        x: MARGIN_X + indent,
        y,
        size,
        font: chosenFont,
        color: options.color || rgb(0.12, 0.2, 0.31),
      });
      y -= lineHeight;
    }
    y -= options.gapAfter || 0;
  };

  const heading = (title: string) => {
    ensure(34);
    y -= 4;
    page.drawText(display(title, unicode), {
      x: MARGIN_X,
      y,
      size: 15,
      font: bold,
      color: rgb(0.06, 0.17, 0.29),
    });
    y -= 8;
    page.drawLine({
      start: { x: MARGIN_X, y },
      end: { x: A4[0] - MARGIN_X, y },
      thickness: 1.2,
      color: rgb(0.11, 0.68, 0.92),
    });
    y -= 18;
  };

  const bulletList = (items: string[], emptyLabel: string) => {
    if (!items.length) {
      drawWrapped(emptyLabel, { color: rgb(0.4, 0.46, 0.54), gapAfter: 5 });
      return;
    }
    for (const item of items) drawWrapped(`• ${item}`, { indent: 8, gapAfter: 3 });
  };

  const language: ReportLanguage = content.language;
  const business = content.business || {};
  const title = language === 'en'
    ? 'BUSINESS PROFILE OPTIMIZATION REPORT'
    : 'BÁO CÁO TỐI ƯU HỒ SƠ DOANH NGHIỆP';
  const businessName = plain(
    business.company_name_private || business.title_vi || business.title_en || business.public_code,
  ) || 'Business';

  page.drawRectangle({
    x: 0,
    y: 0,
    width: A4[0],
    height: A4[1],
    color: rgb(0.97, 0.99, 1),
  });
  page.drawRectangle({
    x: 0,
    y: A4[1] - 125,
    width: A4[0],
    height: 125,
    color: rgb(0.11, 0.68, 0.92),
  });
  page.drawText(display(SOURCE_LABEL, unicode), {
    x: MARGIN_X,
    y: A4[1] - 57,
    size: 23,
    font: bold,
    color: rgb(1, 1, 1),
  });
  page.drawText(display(title, unicode), {
    x: MARGIN_X,
    y: A4[1] - 90,
    size: 13.5,
    font: bold,
    color: rgb(1, 1, 1),
  });
  y = A4[1] - 170;
  drawWrapped(businessName, { size: 19, lineHeight: 25, font: bold, gapAfter: 4 });
  drawWrapped(`${plain(business.public_code) || '—'} · ${plain(business.industry || business.industry_key) || '—'}`, {
    size: 11.5,
    color: rgb(0.21, 0.35, 0.5),
    gapAfter: 12,
  });
  drawWrapped(
    language === 'en'
      ? `Generated: ${new Date(content.generated_at).toLocaleString('en-US')} · Grade: ${content.report_grade} · Mode: ${content.generator_mode}`
      : `Ngày tạo: ${new Date(content.generated_at).toLocaleString('vi-VN')} · Mức báo cáo: ${content.report_grade} · Chế độ: ${content.generator_mode}`,
    { size: 10, gapAfter: 18 },
  );
  page.drawRectangle({
    x: MARGIN_X,
    y: y - 116,
    width: A4[0] - MARGIN_X * 2,
    height: 116,
    borderColor: rgb(0.91, 0.71, 0.11),
    borderWidth: 1,
    color: rgb(1, 0.98, 0.9),
  });
  y -= 23;
  drawWrapped(
    language === 'en'
      ? 'SOURCE AND RELIABILITY NOTICE'
      : 'LƯU Ý VỀ NGUỒN VÀ ĐỘ TIN CẬY',
    { font: bold, size: 11.5, indent: 14, gapAfter: 5 },
  );
  drawWrapped(content.disclaimer, { size: 9.4, lineHeight: 14, indent: 14, gapAfter: 22 });

  addPage();
  heading(language === 'en' ? '1. Executive summary' : '1. Tóm tắt điều hành');
  drawWrapped(content.ai_narrative.executive_summary, { gapAfter: 10 });

  drawWrapped(language === 'en' ? 'Strengths' : 'Điểm mạnh', { font: bold, gapAfter: 4 });
  bulletList(content.ai_narrative.strengths, language === 'en' ? 'No supported strength identified.' : 'Chưa xác định điểm mạnh có đủ dữ liệu hỗ trợ.');
  drawWrapped(language === 'en' ? 'Risks / limitations' : 'Rủi ro / hạn chế dữ liệu', { font: bold, gapAfter: 4 });
  bulletList(content.ai_narrative.risks, language === 'en' ? 'No additional risk stated.' : 'Không có rủi ro bổ sung được nêu.');
  drawWrapped(language === 'en' ? 'Recommended profile improvements' : 'Kiến nghị tối ưu hồ sơ', { font: bold, gapAfter: 4 });
  bulletList(content.ai_narrative.recommendations, language === 'en' ? 'No additional recommendation.' : 'Không có kiến nghị bổ sung.');

  heading(language === 'en' ? '2. Self-declared Business information' : '2. Thông tin doanh nghiệp tự kê khai');
  const profileRows: Array<[string, unknown]> = [
    [language === 'en' ? 'Sector' : 'Lĩnh vực', business.industry || business.industry_key],
    [language === 'en' ? 'Location' : 'Địa điểm', [business.city, business.country_iso2].filter(Boolean).join(', ')],
    [language === 'en' ? 'Transaction type' : 'Loại giao dịch', business.deal_type],
    [language === 'en' ? '2025 revenue' : 'Doanh thu 2025', formatMoney(business.revenue_2025, business.revenue_currency, language)],
    [language === 'en' ? 'Monthly revenue' : 'Doanh thu tháng', formatMoney(business.revenue_month, business.revenue_currency, language)],
    [language === 'en' ? 'EBITDA margin' : 'Biên EBITDA', business.ebitda_margin ? `${business.ebitda_margin}%` : '—'],
    [language === 'en' ? 'Growth' : 'Tăng trưởng', business.growth_pct ? `${business.growth_pct}%` : '—'],
    [language === 'en' ? 'Capital / asking amount' : 'Nhu cầu vốn / giá chào', formatMoney(business.ask_amount, business.ask_currency, language)],
    [language === 'en' ? 'Stake offered' : 'Tỷ lệ chào bán', business.stake_pct ? `${business.stake_pct}%` : '—'],
  ];
  for (const [label, value] of profileRows) {
    drawWrapped(`${label}: ${valueText(value)}`, { gapAfter: 3 });
  }
  drawWrapped(
    language === 'en'
      ? 'Status: self-declared; not independently verified unless supported by a cited document below.'
      : 'Trạng thái: dữ liệu tự kê khai; chưa được kiểm chứng độc lập trừ khi có tài liệu dẫn nguồn bên dưới.',
    { size: 9.4, color: rgb(0.68, 0.28, 0.1), gapAfter: 8 },
  );

  heading(language === 'en' ? '3. Document-backed evidence' : '3. Dữ kiện có tài liệu dẫn nguồn');
  if (!content.facts.length) {
    drawWrapped(language === 'en' ? 'No usable document-backed facts were available.' : 'Chưa có dữ kiện từ tài liệu đủ điều kiện sử dụng.', { gapAfter: 8 });
  } else {
    for (const fact of content.facts.slice(0, 120)) {
      drawWrapped(`${fact.field_key}${fact.period_key ? ` (${fact.period_key})` : ''}: ${factValue(fact)} ${fact.citation}`, {
        gapAfter: 3,
      });
      if (fact.source_excerpt) {
        drawWrapped(`“${fact.source_excerpt.slice(0, 320)}”`, {
          size: 8.8,
          lineHeight: 13,
          indent: 12,
          color: rgb(0.35, 0.42, 0.5),
          gapAfter: 4,
        });
      }
    }
  }

  heading(language === 'en' ? '4. Data quality and authority' : '4. Chất lượng dữ liệu và thẩm quyền');
  drawWrapped(`${language === 'en' ? 'Report grade' : 'Mức báo cáo'}: ${content.report_grade}`);
  drawWrapped(`${language === 'en' ? 'Data gate' : 'Cổng dữ liệu'}: ${plain(content.preflight.data_gate) || '—'}`);
  drawWrapped(`${language === 'en' ? 'Entity gate' : 'Cổng chủ thể'}: ${plain(content.preflight.entity_gate) || '—'}`);
  drawWrapped(`${language === 'en' ? 'Authority gate' : 'Cổng thẩm quyền'}: ${plain(content.preflight.authority_gate) || '—'}`, { gapAfter: 8 });
  if (content.warnings.length) {
    drawWrapped(language === 'en' ? 'Warnings' : 'Cảnh báo', { font: bold, gapAfter: 4 });
    bulletList(content.warnings, '—');
  }
  if (content.missing.length) {
    drawWrapped(language === 'en' ? 'Missing information' : 'Thông tin cần bổ sung', { font: bold, gapAfter: 4 });
    bulletList(content.missing, '—');
  }

  heading(language === 'en' ? '5. Source manifest' : '5. Danh mục nguồn');
  drawWrapped(language === 'en' ? 'Files included in this report' : 'Tài liệu được sử dụng', { font: bold, gapAfter: 4 });
  if (!content.usable_files.length) drawWrapped('—');
  for (const file of content.usable_files) drawWrapped(`• ${file.name} · ${file.category} · ${file.status}`, { indent: 8, gapAfter: 3 });
  drawWrapped(language === 'en' ? 'Files excluded from this report version' : 'Tài liệu bị loại khỏi phiên bản báo cáo', { font: bold, gapAfter: 4 });
  if (!content.excluded_files.length) drawWrapped('—');
  for (const file of content.excluded_files) drawWrapped(`• ${file.name}: ${file.reason}`, { indent: 8, gapAfter: 3 });

  heading(language === 'en' ? '6. Disclaimer' : '6. Miễn trừ trách nhiệm');
  drawWrapped(content.disclaimer, { gapAfter: 8 });
  drawWrapped(
    language === 'en'
      ? 'Investors may request authenticated authorization documents and additional due diligence before proceeding with a transaction on Deals68.com.'
      : 'Nhà đầu tư có thể yêu cầu Giấy ủy quyền có xác thực và tài liệu thẩm định bổ sung trước khi xúc tiến giao dịch tại Deals68.com.',
    { font: bold, gapAfter: 8 },
  );

  pages.forEach((current, index) => {
    current.drawLine({
      start: { x: MARGIN_X, y: 40 },
      end: { x: A4[0] - MARGIN_X, y: 40 },
      thickness: 0.6,
      color: rgb(0.82, 0.87, 0.91),
    });
    current.drawText(display(`Nguồn / Source: ${SOURCE_LABEL}`, unicode), {
      x: MARGIN_X,
      y: 24,
      size: 8.4,
      font: bold,
      color: rgb(0.18, 0.38, 0.55),
    });
    const pageText = `${index + 1}/${pages.length}`;
    current.drawText(pageText, {
      x: A4[0] - MARGIN_X - regular.widthOfTextAtSize(pageText, 8.4),
      y: 24,
      size: 8.4,
      font: regular,
      color: rgb(0.4, 0.46, 0.54),
    });
  });

  pdf.setTitle(`${SOURCE_LABEL} - ${businessName}`);
  pdf.setAuthor(SOURCE_LABEL);
  pdf.setSubject(language === 'en' ? 'Business Profile Optimization Report' : 'Báo cáo Tối ưu Hồ sơ Doanh nghiệp');
  pdf.setKeywords([SOURCE_LABEL, 'Deals68', 'Business Report']);
  pdf.setCreator(SOURCE_LABEL);
  pdf.setProducer(SOURCE_LABEL);
  pdf.setCreationDate(new Date(content.generated_at));
  pdf.setModificationDate(new Date(content.generated_at));

  return await pdf.save({ useObjectStreams: true });
}
