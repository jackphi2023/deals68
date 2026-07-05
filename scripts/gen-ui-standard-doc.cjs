const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  Table, TableRow, TableCell, WidthType, BorderStyle, ShadingType, LevelFormat
} = require('docx');
const fs = require('fs');

const NAVY = '0F2A4A', BLUE = '1596CC', GOLD = 'B8860B', GREY = '64748B', LIGHT = 'F1F5F9';
const MONO = 'Consolas';

const H1 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 320, after: 140 }, children: [new TextRun({ text: t, bold: true, color: NAVY })] });
const H2 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 240, after: 100 }, children: [new TextRun({ text: t, bold: true, color: BLUE })] });
const H3 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_3, spacing: { before: 180, after: 80 }, children: [new TextRun({ text: t, bold: true, color: NAVY })] });
const P = (runs, opts = {}) => new Paragraph({ spacing: { after: 100, line: 276 }, ...opts, children: Array.isArray(runs) ? runs : [new TextRun(runs)] });
const T = (text, o = {}) => new TextRun({ text, ...o });
const code = (text) => new TextRun({ text, font: MONO, size: 19, color: '334155' });
const bullet = (runs) => new Paragraph({ numbering: { reference: 'd68-bullets', level: 0 }, spacing: { after: 60, line: 270 }, children: Array.isArray(runs) ? runs : [new TextRun(runs)] });
const num = (runs) => new Paragraph({ numbering: { reference: 'd68-nums', level: 0 }, spacing: { after: 60, line: 270 }, children: Array.isArray(runs) ? runs : [new TextRun(runs)] });

function codeBlock(lines) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: allBorders('E2E8F0'),
    rows: [new TableRow({ children: [new TableCell({
      shading: { type: ShadingType.CLEAR, fill: 'F8FAFC' },
      margins: { top: 120, bottom: 120, left: 160, right: 160 },
      children: lines.map((l) => new Paragraph({ spacing: { after: 20 }, children: [new TextRun({ text: l || ' ', font: MONO, size: 18, color: '1E293B' })] }))
    })] })]
  });
}
function allBorders(color = 'E2E8F0') {
  const b = { style: BorderStyle.SINGLE, size: 4, color };
  return { top: b, bottom: b, left: b, right: b, insideHorizontal: b, insideVertical: b };
}
function table(headers, rows, widths) {
  const totalDXA = 9360;
  const cols = widths ? widths.map((w) => Math.round(totalDXA * w)) : headers.map(() => Math.round(totalDXA / headers.length));
  const headRow = new TableRow({
    tableHeader: true,
    children: headers.map((h, i) => new TableCell({
      width: { size: cols[i], type: WidthType.DXA },
      shading: { type: ShadingType.CLEAR, fill: NAVY },
      margins: { top: 80, bottom: 80, left: 120, right: 120 },
      children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, color: 'FFFFFF', size: 19 })] })]
    }))
  });
  const bodyRows = rows.map((r, ri) => new TableRow({
    children: r.map((cell, i) => new TableCell({
      width: { size: cols[i], type: WidthType.DXA },
      shading: { type: ShadingType.CLEAR, fill: ri % 2 ? 'F7FAFC' : 'FFFFFF' },
      margins: { top: 70, bottom: 70, left: 120, right: 120 },
      children: (Array.isArray(cell) ? cell : [cell]).map((line, li) =>
        new Paragraph({ spacing: { after: 20 }, children: [
          typeof line === 'object' && line.mono
            ? new TextRun({ text: line.t, font: MONO, size: 17, color: '334155' })
            : new TextRun({ text: String(line), size: 18, bold: li === 0 && typeof line === 'object' && line.bold, color: '1E293B' })
        ] }))
    }))
  }));
  return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, columnWidths: cols, borders: allBorders(), rows: [headRow, ...bodyRows] });
}
const spacer = (n = 80) => new Paragraph({ spacing: { after: n }, children: [] });

const doc = new Document({
  numbering: {
    config: [
      { reference: 'd68-bullets', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 360, hanging: 220 } } } }] },
      { reference: 'd68-nums', levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 360, hanging: 220 } } } }] }
    ]
  },
  styles: { default: { document: { run: { font: 'Calibri', size: 21, color: '1E293B' } } } },
  sections: [{
    properties: { page: { margin: { top: 1000, bottom: 1000, left: 1000, right: 1000 } } },
    children: [
      // COVER
      new Paragraph({ spacing: { before: 200, after: 60 }, children: [new TextRun({ text: 'DEALS68.COM', bold: true, size: 30, color: BLUE })] }),
      new Paragraph({ spacing: { after: 40 }, children: [new TextRun({ text: 'QUY CHUẨN DỰNG UI', bold: true, size: 52, color: NAVY })] }),
      new Paragraph({ spacing: { after: 40 }, children: [new TextRun({ text: 'UI Build Standard — Web & Mobile', size: 28, color: GREY })] }),
      new Paragraph({ spacing: { after: 200 }, children: [new TextRun({ text: 'Hệ thống thiết kế, tổ chức file, và quy tắc để dựng giao diện pixel-perfect, nhất quán, không vá inline.', italics: true, size: 22, color: GREY })] }),
      table(
        ['Mục', 'Nội dung'],
        [
          ['Phiên bản', 'UI Standard v1.0 · 05/07/2026'],
          ['Áp dụng cho', 'Nhánh beta-reference · beta-reference-deals68.netlify.app'],
          ['Nguồn chuẩn thị giác', 'UI Reference (glittering-unicorn-afbf10.netlify.app) + code trên GitHub'],
          ['Đối tượng', 'Dev, AI/Claude, PM, QA khi dựng/sửa UI'],
          ['Quan hệ với SPEC', 'Bổ trợ Phụ lục B (AI Hard Guardrails v1.3): cụ thể hóa "không inline redesign", "dùng design token/class hiện hữu", "QA screenshot".'],
          ['Mục tiêu', 'Đồng nhất H1–H6, form, input, label, button, font, màu, layout; hạn chế tối đa vá inline gây xung đột/lệch UI.']
        ],
        [0.24, 0.76]
      ),
      spacer(200),
      new Paragraph({ pageBreakBefore: true, children: [] }),

      // 0. TRIẾT LÝ
      H1('0. Nguyên tắc cốt lõi (đọc trước khi dựng bất kỳ trang nào)'),
      P([T('Một dòng tóm tắt: ', { bold: true }), T('mọi giá trị hiển thị — màu, cỡ chữ, khoảng cách, bo góc, bóng — phải đến từ '), code('design token'), T(' và '), code('class d68-*'), T('. Không viết số/màu trực tiếp vào JSX bằng '), code('style={{ }}'), T('. Đây là cách duy nhất để nhiều người (và AI) cùng dựng mà không lệch nhau.')]),
      P([T('Vì sao cấm inline style? ', { bold: true }), T('Hiện repo có 293 chỗ '), code('style={{}}'), T(' trong src/pages. Mỗi chỗ là một "phiên bản riêng" của cùng một nút/thẻ/tiêu đề — sửa chỗ này không lan sang chỗ kia, dẫn đến chính vấn đề bạn đang gặp: CSS rời rạc, thiếu hệ thống, dễ xung đột. Đưa vào class thì sửa 1 nơi, cả site đổi theo.')]),
      H3('Thứ tự ưu tiên khi có xung đột'),
      num([T('SPEC + UI Reference — chuẩn thị giác bắt buộc (layout, section, spacing, typography, responsive).')]),
      num([T('Design token ('), code('design-tokens.css'), T(') — nguồn giá trị duy nhất.')]),
      num([T('Class hệ thống ('), code('base.css'), T(', '), code('app.css'), T(', '), code('reference/*'), T(') — dùng lại, không viết lại.')]),
      num([T('Page CSS ('), code('src/styles/pages/<page>.css'), T(') — style riêng của 1 trang, vẫn bằng token/class.')]),
      num([T('Inline style — CẤM, trừ 1 ngoại lệ: truyền biến động '), code('style={{ ["--d68-dyn"]: value }}'), T('.')]),

      // 1. KIẾN TRÚC FILE
      H1('1. Kiến trúc & tổ chức file'),
      P([T('CSS được nạp qua đúng 1 entry: '), code('src/styles/index.css'), T('. Thứ tự ưu tiên do CSS '), code('@layer'), T(' quyết định (layer sau thắng layer trước) nên KHÔNG cần '), code('!important'), T('.')]),
      codeBlock([
        '@layer d68-legacy, d68-base, d68-components, d68-utilities, d68-overrides;',
        '',
        "@import './design-tokens.css';                    /* biến toàn cục */",
        "@import './base.css'  layer(d68-base);            /* H1–H6, form, button, layout */",
        "@import './app.css'   layer(d68-base);            /* component dùng chung */",
        "@import './reference/d68-components.css';         /* trích tự động từ UI Reference */",
        "@import './reference/d68-utilities.css';",
        "@import './pages/home.css';                       /* style riêng từng trang */",
        "@import './pages/businesses.css';",
        "@import './overrides.css';                        /* vá tạm — mục tiêu: rỗng */"
      ]),
      spacer(),
      table(
        ['File', 'Vai trò', 'Được sửa tay?'],
        [
          [{ t: 'design-tokens.css', mono: true }, 'Màu, font, cỡ chữ, spacing, radius, shadow, breakpoint. Nguồn giá trị DUY NHẤT.', 'Có — thêm token mới ở đây trước'],
          [{ t: 'base.css', mono: true }, 'Element gốc: H1–H6, p, a, input, select, textarea, label, .d68-btn, layout primitive.', 'Có — hiếm, khi đổi nền tảng'],
          [{ t: 'app.css', mono: true }, 'Component dùng chung: header, footer, card, table, modal, alert, badge, pagination…', 'Có'],
          [{ t: 'reference/*.css', mono: true }, 'Trích XUẤT TỰ ĐỘNG từ UI Reference bằng script.', 'KHÔNG — chạy npm run extract:reference'],
          [{ t: 'pages/<page>.css', mono: true }, 'Style riêng của 1 trang (vd businesses.css). Vẫn dùng token/class.', 'Có'],
          [{ t: 'legacy.css / overrides.css', mono: true }, 'Nợ cũ + vá tạm. Layer thấp/để dọn dần.', 'Chỉ XÓA dần'],
        ],
        [0.26, 0.54, 0.20]
      ),
      spacer(),
      H3('Quy ước đặt tên class (BEM rút gọn)'),
      P([code('.d68-<block>'), T('  ·  '), code('.d68-<block>__<element>'), T('  ·  '), code('.d68-<block>--<modifier>')]),
      P([T('Ví dụ: '), code('.d68-business-card'), T(' → '), code('.d68-business-card__media'), T(' → '), code('.d68-business-card--list'), T('. Mọi class đều tiền tố '), code('d68-'), T(' để không đụng thư viện ngoài.')]),

      new Paragraph({ pageBreakBefore: true, children: [] }),
      // 2. TOKEN
      H1('2. Design token — bảng tra nhanh'),
      P([T('Quy tắc vàng: '), T('nếu một giá trị đã có token, KHÔNG được gõ số/màu trực tiếp.', { bold: true }), T(' Cần màu/cỡ mới → thêm token vào '), code('design-tokens.css'), T(' rồi mới dùng.')]),
      H3('Màu (color)'),
      table(['Token', 'Giá trị', 'Dùng cho'],
        [
          [{ t: '--d68-navy', mono: true }, '#0F2A4A', 'Text chính, nền tối, tiêu đề'],
          [{ t: '--d68-blue', mono: true }, '#1BADEA', 'Accent chính: CTA, link'],
          [{ t: '--d68-blue-ink', mono: true }, '#1596CC', 'Link hover / active'],
          [{ t: '--d68-gold', mono: true }, '#F2B51D', 'Nhấn vàng: featured, checkout'],
          [{ t: '--d68-bg', mono: true }, '#F7FAFC', 'Nền trang'],
          [{ t: '--d68-surface', mono: true }, '#FFFFFF', 'Thẻ, panel'],
          [{ t: '--d68-text-muted', mono: true }, '#64748B', 'Text phụ, caption'],
          [{ t: '--d68-border', mono: true }, '#E2E8F0', 'Viền input/control'],
          [{ t: '--d68-success / danger / warn', mono: true }, '#16A34A / #DC2626 / #F2B51D', 'Trạng thái'],
        ], [0.34, 0.28, 0.38]),
      spacer(),
      H3('Chữ (typography) — thang H1–H6'),
      table(['Cấp', 'Cỡ (fluid)', 'Weight', 'Dùng cho'],
        [
          ['H1', 'clamp 26→40px', '800', 'Tiêu đề trang'],
          ['H2', 'clamp 22→30px', '800', 'Tiêu đề section'],
          ['H3', 'clamp 18→21px', '700', 'Tiêu đề thẻ/khối'],
          ['H4', '16px', '700', 'Nhãn nhóm'],
          ['H5', '14.5px', '700', 'Phụ đề nhỏ'],
          ['H6', '13.5px UPPER', '700', 'Eyebrow / label section'],
          ['body', '14.5px', '400', 'Nội dung, input'],
          ['small', '13.5px', '400', 'Caption, helper'],
        ], [0.14, 0.26, 0.16, 0.44]),
      P([T('H1–H6 đã được '), code('base.css'), T(' style sẵn — chỉ cần viết '), code('<h2>Tiêu đề</h2>'), T(', KHÔNG cần set '), code('fontSize/fontWeight'), T(' bằng inline. Hero title đặc biệt (58px) dùng class riêng '), code('.d68-home-hero__title'), T('.')]),
      spacer(),
      H3('Khoảng cách · bo góc · bóng'),
      table(['Nhóm', 'Token', 'Giá trị'],
        [
          ['Spacing', { t: '--d68-space-1..16', mono: true }, '4 · 8 · 12 · 16 · 24 · 32 · 48 · 64 px'],
          ['Radius', { t: '--d68-radius-sm..xl', mono: true }, '10 (input/btn) · 14 · 18 (card) · 20 (hero)'],
          ['Radius pill', { t: '--d68-radius-pill', mono: true }, '999px (badge, toggle)'],
          ['Shadow card', { t: '--d68-shadow-card', mono: true }, 'nền thẻ nghỉ'],
          ['Shadow raised', { t: '--d68-shadow-raised', mono: true }, 'thẻ hover / panel nổi'],
          ['Container', { t: '--d68-container', mono: true }, '1240px (max nội dung)'],
        ], [0.20, 0.34, 0.46]),

      new Paragraph({ pageBreakBefore: true, children: [] }),
      // 3. COMPONENT CHUẨN
      H1('3. Thư viện component chuẩn (dùng lại — không dựng lại)'),
      P('Mỗi thành phần dưới đây đã có class. Khi dựng trang mới, ghép class này thay vì tự viết style.'),
      H3('Button'),
      codeBlock([
        '<button class="d68-btn d68-btn--primary">Tìm kiếm</button>',
        '<button class="d68-btn d68-btn--gold d68-btn--lg">Định giá ngay</button>',
        '<a class="d68-btn d68-btn--outline">Xem chi tiết</a>',
        '<button class="d68-btn d68-btn--ghost d68-btn--sm">Xóa lọc</button>',
        '<button class="d68-btn d68-btn--primary d68-btn--block" disabled>…</button>'
      ]),
      P([T('Biến thể: '), code('--primary'), T(' (xanh, CTA chính) · '), code('--gold'), T(' · '), code('--navy'), T(' · '), code('--outline'), T(' · '), code('--ghost'), T(' · '), code('--danger'), T('. Cỡ: '), code('--sm / --lg / --block'), T('. Trạng thái disabled tự mờ.')]),
      H3('Form / input / label'),
      codeBlock([
        '<div class="d68-field">',
        '  <label class="d68-label">Ngành</label>',
        '  <input class="d68-input" placeholder="Tất cả" />',
        '  <span class="d68-help">Chọn ngành để lọc nhanh</span>',
        '  <span class="d68-error">Trường bắt buộc</span>  <!-- khi lỗi -->',
        '</div>'
      ]),
      P([T('Ngay cả '), code('<input>'), T(' / '), code('<select>'), T(' / '), code('<textarea>'), T(' thô (chưa gắn class) cũng đã đúng style nhờ '), code('base.css'), T('. Focus có ring xanh thống nhất. '), code('aria-invalid="true"'), T(' → viền đỏ tự động.')]),
      H3('Các component khác đã sẵn'),
      table(['Class', 'Thành phần'],
        [
          [{ t: '.d68-card / --pad / --hover', mono: true }, 'Thẻ nội dung, panel'],
          [{ t: '.d68-badge --info/--gold/--success', mono: true }, 'Nhãn trạng thái, featured, verified'],
          [{ t: '.d68-alert --info/--success/--warn/--danger', mono: true }, 'Banner thông báo'],
          [{ t: '.d68-table', mono: true }, 'Bảng admin/dashboard (số căn phải .num)'],
          [{ t: '.d68-modal + .d68-modal__scrim', mono: true }, 'Hộp thoại'],
          [{ t: '.d68-seg', mono: true }, 'Toggle phân đoạn (VD tab tìm kiếm)'],
          [{ t: '.d68-pagination', mono: true }, 'Phân trang (nút 40×40, trang hiện tại nền navy)'],
          [{ t: '.d68-empty / .d68-skeleton', mono: true }, 'Trạng thái rỗng / loading'],
          [{ t: '.d68-container / --narrow', mono: true }, 'Khung nội dung 1240 / 1040px'],
          [{ t: '.d68-grid + .d68-grid-2/3/4', mono: true }, 'Lưới responsive (tự co ở mobile)'],
        ], [0.46, 0.54]),

      new Paragraph({ pageBreakBefore: true, children: [] }),
      // 4. RESPONSIVE
      H1('4. Responsive & pixel-perfect (web ↔ mobile)'),
      H3('4 mốc màn hình bắt buộc test (theo SPEC)'),
      table(['Breakpoint', 'Chiều rộng', 'Kiểm tra chính'],
        [
          ['Desktop', '1440px', 'Bố cục đầy đủ, khớp UI Reference từng pixel'],
          ['Laptop', '1280px', 'Không vỡ grid, sidebar còn chỗ'],
          ['Tablet', '768px', 'Grid 3→2 cột, sidebar rơi xuống, nav → burger'],
          ['Mobile', '375px', 'Grid → 1 cột, KHÔNG cuộn ngang, nút đủ lớn'],
        ], [0.22, 0.20, 0.58]),
      H3('Quy tắc responsive'),
      bullet([T('Dùng '), code('clamp()'), T(' cho cỡ chữ tiêu đề (đã áp trong base.css) — co giãn mượt, không cần nhiều media query.')]),
      bullet([T('Grid dùng '), code('.d68-grid-3/4'), T(' tự về 2 cột ở ≤960px, 1 cột ở ≤620px. Không tự viết media query nếu class đã lo.')]),
      bullet([T('Mobile-first cho page CSS mới: viết style gốc cho mobile, rồi '), code('@media (min-width: 768px)'), T(' cho desktop.')]),
      bullet([T('Vùng chạm (nút, link) tối thiểu 40×40px trên mobile.')]),
      bullet([T('KHÔNG cuộn ngang ở 375px — đây là tiêu chí fail bắt buộc (TC-013). Test bằng: '), code('scrollWidth > clientWidth')]),
      bullet([T('Ảnh luôn '), code('max-width:100%'), T(' (đã set trong base.css) + '), code('loading="lazy"'), T(' cho ảnh dưới màn đầu.')]),
      H3('Pixel-perfect: quy trình đối chiếu'),
      num([T('Mở trang React và trang UI Reference tương ứng cạnh nhau ở cùng breakpoint.')]),
      num([T('Chạy screenshot diff tự động (đã có): '), code('npm run visual:pilots'), T(' — so pixel với ngưỡng ≤3%.')]),
      num([T('Kiểm tra thủ công: cỡ chữ tiêu đề, khoảng cách section, bo góc thẻ, màu nút, trạng thái hover/focus.')]),
      num([T('Lệch > 3% → sửa page CSS bằng token/class, KHÔNG vá inline. Sửa xong chạy lại diff.')]),

      new Paragraph({ pageBreakBefore: true, children: [] }),
      // 5. QUY TRÌNH THÊM TRANG
      H1('5. Quy trình dựng 1 trang mới (hoặc sửa trang cũ)'),
      num([T('Đọc trước: ', { bold: true }), T('file '), code('ui-reference/Deals68 <Page>.dc.html'), T(' + page CSS nếu đã có ('), code('src/styles/pages/<page>.css'), T(').')]),
      num([T('Copy cấu trúc markup từ .dc.html sang JSX, GIỮ NGUYÊN tên class. Thay '), code('{{ }}'), T(' bằng data Supabase.')]),
      num([T('Element có class + '), code('style="..."'), T(' trong reference → rule đã nằm trong '), code('reference/d68-components.css'), T(' (chạy '), code('npm run extract:reference'), T('). Xóa style attr.')]),
      num([T('Cần style riêng cho trang → thêm vào '), code('src/styles/pages/<page>.css'), T(' bằng class d68-*, dùng token. KHÔNG inline.')]),
      num([T('Chạy '), code('npm run ui:check'), T(' (lint CSS + build + routes). Sửa cho tới khi 0 error.')]),
      num([T('Screenshot diff 1440/768/375 so với reference. Đạt ≤3% mới merge.')]),
      num([T('Trang port xong → xóa khối tương ứng trong '), code('legacy.css'), T(' / '), code('overrides.css'), T('.')]),
      spacer(),
      H2('Ngoại lệ inline style DUY NHẤT được phép'),
      P([T('Khi cần truyền một giá trị ĐỘNG mà CSS không biết trước (VD màu nền theo dữ liệu), dùng CSS variable:')]),
      codeBlock([
        '// JSX — hợp lệ:',
        'style={{ ["--d68-dyn"]: business.tintColor }}',
        '',
        '/* CSS: */',
        '.d68-business-card__media { background: var(--d68-dyn, #E7F6FD); }'
      ]),

      new Paragraph({ pageBreakBefore: true, children: [] }),
      // 6. ENFORCE + DoD
      H1('6. Công cụ kiểm soát & Definition of Done'),
      H3('Lệnh kiểm tra (đã cấu hình sẵn trong repo)'),
      table(['Lệnh', 'Kiểm tra'],
        [
          [{ t: 'npm run lint:css', mono: true }, 'Stylelint: chặn !important ở CSS viết tay, cảnh báo hex không dùng token'],
          [{ t: 'npm run lint:inline', mono: true }, 'ESLint: cảnh báo style={{}} trong JSX (trừ --d68-dyn)'],
          [{ t: 'npm run build', mono: true }, 'tsc + vite: 0 lỗi TypeScript, build pass'],
          [{ t: 'npm run check:routes', mono: true }, 'Không route trắng/404'],
          [{ t: 'npm run visual:pilots', mono: true }, 'Screenshot diff so UI Reference'],
          [{ t: 'npm run ui:check', mono: true }, 'Gộp lint:css + build + routes (chạy trước khi giao file)'],
        ], [0.32, 0.68]),
      spacer(),
      H3('Definition of Done cho mỗi trang / thay đổi UI'),
      bullet('Giống UI Reference ở 1440/768/375 (screenshot diff ≤ 3%), hoặc lệch đã được PM duyệt bằng văn bản.'),
      bullet([T('0 inline '), code('style={{}}'), T(' mới (trừ '), code('--d68-dyn'), T('). Mọi style qua token/class.')]),
      bullet([T('0 '), code('!important'), T(' mới. 0 lỗi TypeScript. '), code('npm run ui:check'), T(' pass.')]),
      bullet('Có đủ trạng thái: loading (skeleton) · empty ("Đang cập nhật") · error · locked. Không trang trắng.'),
      bullet('Không cuộn ngang ở 375px. Vùng chạm ≥ 40px. Focus nhìn thấy được.'),
      bullet('Không lộ dữ liệu private trong DOM/Network. Data lấy từ Supabase, không mock.'),
      spacer(),
      H2('Quy tắc cấm — tuyệt đối'),
      bullet([T('KHÔNG dựng UI mới bằng inline style khi đã có CSS/class.')]),
      bullet([T('KHÔNG dùng '), code('!important'), T(' — layer đã lo thứ tự thắng/thua.')]),
      bullet([T('KHÔNG gõ hex/px trực tiếp khi đã có token tương ứng.')]),
      bullet([T('KHÔNG sửa tay file '), code('reference/*.css'), T(' — sửa ở UI Reference rồi chạy extract.')]),
      bullet([T('KHÔNG đổi layout/class/JSX structure khi task chỉ là sửa logic (theo SPEC Phụ lục B).')]),
      bullet([T('KHÔNG tự redesign khác UI Reference — phải hỏi PM/Founder trước.')]),

      new Paragraph({ pageBreakBefore: true, children: [] }),
      // 7. PROMPT
      H1('7. Prompt mẫu giao việc cho Dev/AI (copy dán thẳng)'),
      P([T('Đặt khối này ở đầu MỌI yêu cầu dựng/sửa UI để Dev hoặc Claude tuân thủ đúng quy chuẩn:')]),
      codeBlock([
        'TUÂN THỦ QUY CHUẨN UI DEALS68 (UI Standard v1.0) + SPEC/UI Reference.',
        '',
        'Nhiệm vụ: <mô tả — VD: port trang /investors theo UI Reference, gắn data Supabase>.',
        '',
        'Bắt buộc:',
        '- Chuẩn thị giác = UI Reference; giá trị = design-tokens.css; ghép class d68-*.',
        '- KHÔNG inline style (trừ --d68-dyn). KHÔNG !important. KHÔNG hex/px khi đã có token.',
        '- Style riêng của trang để trong src/styles/pages/<page>.css.',
        '- Đọc trước: ui-reference/<page>.dc.html + src/styles/pages/<page>.css (nếu có).',
        '- Chỉ sửa đúng file trong phạm vi; không đụng logic/RLS/file khác.',
        '- Trước khi giao: chạy npm run ui:check (lint CSS + build + routes) — báo kết quả.',
        '- Kèm: danh sách file đổi, route cần test 1440/768/375, cách rollback.',
        '',
        'Định dạng trả về: file hoàn chỉnh + hướng dẫn upload GitHub Web + Netlify.'
      ]),
      spacer(160),
      P([T('— Hết. Tài liệu này đi kèm bộ file code enforce: ', { italics: true, color: GREY }), code('design-tokens.css'), T(', ', { italics: true, color: GREY }), code('base.css'), T(', ', { italics: true, color: GREY }), code('.stylelintrc.json'), T(', ', { italics: true, color: GREY }), code('eslint.d68-ui.cjs'), T('. Cập nhật tài liệu khi thêm token/component mới.', { italics: true, color: GREY })])
    ]
  }]
});

Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync('/home/claude/out/Deals68_UI_Build_Standard_v1.docx', buf);
  console.log('docx written:', buf.length, 'bytes');
});
