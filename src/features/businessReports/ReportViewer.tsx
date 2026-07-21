import {
  AlertTriangle,
  BadgeCheck,
  BookOpenText,
  ChevronDown,
  FileWarning,
  ShieldCheck,
} from 'lucide-react';
import { T } from './reportCore';
import type {
  BusinessReportArtifact,
  ReportAudience,
  ReportContent,
  ReportFact,
  ReportLang,
} from './reportTypes';
import './report-viewer.css';

function text(value: unknown) {
  return String(value ?? '').trim();
}

function displayValue(fact: ReportFact, lang: ReportLang) {
  const value = fact.normalized_value ?? fact.value_json;
  if (value === null || value === undefined || value === '') {
    return T(lang, 'Không có dữ liệu', 'No data');
  }
  const base = typeof value === 'object' ? JSON.stringify(value) : String(value);
  return [base, fact.currency, fact.unit].filter(Boolean).join(' ');
}

function formatDate(value: string | undefined, lang: ReportLang) {
  const date = new Date(value || 0);
  if (!Number.isFinite(date.getTime())) return '';
  return date.toLocaleString(lang === 'en' ? 'en-US' : 'vi-VN');
}

function ListSection({
  title,
  items,
  empty,
  tone = 'neutral',
}: {
  title: string;
  items: string[];
  empty: string;
  tone?: 'neutral' | 'risk' | 'positive';
}) {
  return (
    <section className={`d68-report-viewer__list ${tone}`}>
      <h4>{title}</h4>
      {items.length ? (
        <ul>{items.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}</ul>
      ) : (
        <p>{empty}</p>
      )}
    </section>
  );
}

export default function ReportViewer({
  content,
  artifact,
  lang,
  audience = 'business_owner',
  stale = false,
}: {
  content: ReportContent;
  artifact: BusinessReportArtifact;
  lang: ReportLang;
  audience?: ReportAudience;
  stale?: boolean;
}) {
  const narrative = content.ai_narrative || {};
  const facts = Array.isArray(content.facts) ? content.facts : [];
  const usableFiles = Array.isArray(content.usable_files) ? content.usable_files : [];
  const excludedFiles = Array.isArray(content.excluded_files) ? content.excluded_files : [];
  const warnings = Array.isArray(content.warnings) ? content.warnings.filter(Boolean) : [];
  const missing = Array.isArray(content.missing) ? content.missing.filter(Boolean) : [];
  const grade = content.report_grade || artifact.report_grade || 'limited';
  const generatedAt = formatDate(content.generated_at || artifact.generated_at, lang);
  const source = content.source_label || artifact.source_label || 'Deals68 AI Report';

  return (
    <article className="d68-report-viewer" aria-labelledby="d68-report-viewer-title">
      <header className="d68-report-viewer__header">
        <div>
          <span className="d68-report-viewer__eyebrow">
            <BookOpenText size={15} aria-hidden="true" /> {source}
          </span>
          <h3 id="d68-report-viewer-title">
            {audience === 'investor'
              ? T(lang, 'Báo cáo Đầu tư', 'Investment Report')
              : T(lang, 'Báo cáo Tối ưu Hồ sơ Doanh nghiệp', 'Business Profile Optimization Report')}
          </h3>
          <p>
            {generatedAt
              ? T(lang, `Tạo lúc ${generatedAt}`, `Generated ${generatedAt}`)
              : T(lang, 'Báo cáo mới nhất', 'Latest report')}
          </p>
        </div>
        <div className="d68-report-viewer__badges">
          <span className={`d68-report-viewer__badge ${grade === 'full' ? 'full' : 'limited'}`}>
            <BadgeCheck size={14} aria-hidden="true" />
            {grade === 'full'
              ? T(lang, 'Đầy đủ', 'Full')
              : T(lang, 'Giới hạn', 'Limited')}
          </span>
          <span className="d68-report-viewer__badge source">
            <ShieldCheck size={14} aria-hidden="true" />
            {content.generator_mode === 'openai_assisted' || artifact.generator_mode === 'openai_assisted'
              ? T(lang, 'AI hỗ trợ · có kiểm soát nguồn', 'AI-assisted · source controlled')
              : T(lang, 'Phân tích theo dữ liệu nguồn', 'Source-grounded analysis')}
          </span>
        </div>
      </header>

      {stale ? (
        <div className="d68-report-viewer__stale" role="status">
          <AlertTriangle size={18} aria-hidden="true" />
          <span>
            {T(
              lang,
              'Hồ sơ hoặc tài liệu đã thay đổi sau thời điểm tạo báo cáo. Báo cáo vẫn xem được nhưng cần tạo lại để cập nhật.',
              'The profile or its documents changed after this report was generated. The report remains viewable, but should be regenerated for current data.',
            )}
          </span>
        </div>
      ) : null}

      <section className="d68-report-viewer__summary">
        <h4>{T(lang, 'Tóm tắt điều hành', 'Executive summary')}</h4>
        <p>
          {text(narrative.executive_summary) ||
            T(lang, 'Chưa có nội dung tóm tắt.', 'No executive summary is available.')}
        </p>
      </section>

      <div className="d68-report-viewer__grid">
        <ListSection
          title={T(lang, 'Điểm mạnh có dữ liệu hỗ trợ', 'Data-supported strengths')}
          items={Array.isArray(narrative.strengths) ? narrative.strengths : []}
          empty={T(lang, 'Chưa xác định điểm mạnh đủ dữ liệu.', 'No sufficiently supported strength identified.')}
          tone="positive"
        />
        <ListSection
          title={T(lang, 'Rủi ro và giới hạn', 'Risks and limitations')}
          items={Array.isArray(narrative.risks) ? narrative.risks : []}
          empty={T(lang, 'Không có rủi ro bổ sung được nêu.', 'No additional risk was stated.')}
          tone="risk"
        />
        <ListSection
          title={T(lang, 'Kiến nghị tối ưu hồ sơ', 'Profile improvement actions')}
          items={Array.isArray(narrative.recommendations) ? narrative.recommendations : []}
          empty={T(lang, 'Không có kiến nghị bổ sung.', 'No additional recommendation.')}
        />
      </div>

      <section className="d68-report-viewer__facts">
        <h4>{T(lang, 'Dữ kiện có nguồn tài liệu', 'Document-backed facts')}</h4>
        {facts.length ? (
          <div className="d68-report-viewer__fact-list">
            {facts.slice(0, 120).map((fact, index) => (
              <details key={fact.id || `${fact.field_key}-${index}`}>
                <summary>
                  <span>
                    <b>{text(fact.field_key) || T(lang, 'Dữ kiện', 'Fact')}</b>
                    {fact.period_key ? ` · ${fact.period_key}` : ''}
                  </span>
                  <span>{displayValue(fact, lang)}</span>
                  <ChevronDown size={16} aria-hidden="true" />
                </summary>
                <div>
                  <p>
                    <b>{T(lang, 'Nguồn', 'Source')}:</b>{' '}
                    {text(fact.citation) || text(fact.file_name) || T(lang, 'Không có dữ liệu', 'No data')}
                  </p>
                  {fact.source_excerpt ? (
                    <blockquote>{fact.source_excerpt}</blockquote>
                  ) : null}
                  <p className="d68-report-viewer__fact-meta">
                    {T(lang, 'Độ tin cậy', 'Confidence')}: {Math.round(Number(fact.confidence || 0) * 100)}%
                    {fact.validation_status ? ` · ${fact.validation_status}` : ''}
                  </p>
                </div>
              </details>
            ))}
          </div>
        ) : (
          <p className="d68-report-viewer__empty">
            {T(
              lang,
              'Chưa có dữ kiện từ tài liệu đủ điều kiện sử dụng. Báo cáo chỉ phản ánh dữ liệu tự kê khai và các giới hạn tương ứng.',
              'No eligible document-backed facts are available. The report only reflects self-declared data and its limitations.',
            )}
          </p>
        )}
      </section>

      {(warnings.length || missing.length) ? (
        <section className="d68-report-viewer__quality">
          <h4><FileWarning size={17} aria-hidden="true" /> {T(lang, 'Chất lượng dữ liệu', 'Data quality')}</h4>
          <div className="d68-report-viewer__grid two">
            <ListSection
              title={T(lang, 'Cảnh báo', 'Warnings')}
              items={warnings}
              empty="—"
              tone="risk"
            />
            <ListSection
              title={T(lang, 'Thông tin cần bổ sung', 'Missing information')}
              items={missing}
              empty="—"
            />
          </div>
        </section>
      ) : null}

      <section className="d68-report-viewer__sources">
        <h4>{T(lang, 'Danh mục nguồn', 'Source manifest')}</h4>
        <div className="d68-report-viewer__grid two">
          <div>
            <h5>{T(lang, 'Tài liệu được sử dụng', 'Included files')}</h5>
            {usableFiles.length ? (
              <ul>{usableFiles.map((file, index) => (
                <li key={file.id || `${file.name}-${index}`}>
                  {file.name || '—'}{file.category ? ` · ${file.category}` : ''}
                </li>
              ))}</ul>
            ) : <p>—</p>}
          </div>
          <div>
            <h5>{T(lang, 'Tài liệu bị loại', 'Excluded files')}</h5>
            {excludedFiles.length ? (
              <ul>{excludedFiles.map((file, index) => (
                <li key={file.id || `${file.name}-${index}`}>
                  {file.name || '—'}{file.reason ? `: ${file.reason}` : ''}
                </li>
              ))}</ul>
            ) : <p>—</p>}
          </div>
        </div>
      </section>

      <footer className="d68-report-viewer__footer">
        <strong>{T(lang, 'Miễn trừ trách nhiệm', 'Disclaimer')}</strong>
        <p>
          {content.disclaimer || T(
            lang,
            'Báo cáo được tạo từ dữ liệu doanh nghiệp cung cấp và bằng chứng hiện có. Đây không phải khuyến nghị đầu tư, ý kiến pháp lý hoặc ý kiến kiểm toán.',
            'This report is generated from Business-supplied data and available evidence. It is not an investment recommendation, legal opinion or audit opinion.',
          )}
        </p>
      </footer>
    </article>
  );
}
