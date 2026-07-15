import { type FormEvent, useEffect, useState } from 'react';
import type { Lang } from '../../lib/i18n';
import type { InvestorRow } from '../../lib/investorAdminV10';
import {
  approvedInvestorReviewCriteria,
  investorReviewCriteriaDraft,
  pendingInvestorReviewKeys,
  submitMyInvestorCriteriaReview,
  type InvestorReviewCriteria,
} from '../../lib/investorCriteriaReviewService';
import {
  REVENUE_RANGE_OPTIONS,
  RISK_APPETITE_OPTIONS,
  revenueRangeLabel,
  returnExpectationLabel,
  riskAppetiteLabel,
} from '../../lib/investorCriteriaOptions';
import { INVESTOR_APPETITE_MAX_LENGTH } from '../../lib/investorProfileService';
import { T } from '../../lib/labels';

const EMPTY_DRAFT: InvestorReviewCriteria = {
  investment_appetite: '',
  riskAppetite: '',
  returnExpectation: '',
  revenueRange: '',
};

export default function InvestorAppetiteFormV10({
  investor,
  lang,
  onRefresh,
}: {
  investor: InvestorRow;
  lang: Lang;
  onRefresh: () => Promise<void>;
}) {
  const [draft, setDraft] = useState<InvestorReviewCriteria>(EMPTY_DRAFT);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [warning, setWarning] = useState('');
  const [error, setError] = useState('');

  const approved = approvedInvestorReviewCriteria(investor);
  const pendingKeys = pendingInvestorReviewKeys(investor);

  useEffect(() => {
    setDraft(investorReviewCriteriaDraft(investor));
  }, [investor.id, investor.updated_at]);

  useEffect(() => {
    setMessage('');
    setWarning('');
    setError('');
  }, [investor.id]);

  function update<K extends keyof InvestorReviewCriteria>(
    key: K,
    value: InvestorReviewCriteria[K],
  ) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    setWarning('');
    setError('');
    try {
      await submitMyInvestorCriteriaReview(draft);
      setMessage(
        T(
          lang,
          'Đã gửi các tiêu chí thay đổi để Admin kiểm tra và duyệt.',
          'The updated criteria were submitted for administrator review.',
        ),
      );
      try {
        await onRefresh();
      } catch (refreshError: any) {
        setWarning(
          T(
            lang,
            'Dữ liệu đã gửi nhưng giao diện chưa tải lại được. Hãy bấm Làm mới.',
            'The data was submitted, but the page could not refresh. Please reload.',
          ) + (refreshError?.message ? ` ${refreshError.message}` : ''),
        );
      }
    } catch (submitError: any) {
      setError(
        submitError?.message ||
          T(lang, 'Không gửi được tiêu chí đầu tư.', 'Could not submit investment criteria.'),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      className="d68-dashboard-card d68-v10-appetite-card"
      onSubmit={submit}
      data-testid="investor-reviewed-criteria-form"
    >
      <div className="d68-v10-section-head">
        <div>
          <h2>{T(lang, 'Khẩu vị và tiêu chí đầu tư', 'Investment appetite and criteria')}</h2>
          <p>
            {T(
              lang,
              'Các nội dung dưới đây chỉ cập nhật trên hồ sơ hiển thị sau khi Admin duyệt.',
              'These values update the displayed profile only after administrator approval.',
            )}
          </p>
        </div>
        {pendingKeys.length ? (
          <span className="d68-admin-badge warn">
            {T(lang, 'Đang chờ duyệt', 'Pending review')}
          </span>
        ) : null}
      </div>

      {message ? <div data-testid="investor-appetite-success" className="d68-dashboard-notice ok">{message}</div> : null}
      {warning ? <div data-testid="investor-appetite-warning" className="d68-dashboard-notice warn">{warning}</div> : null}
      {error ? <div data-testid="investor-appetite-error" className="d68-dashboard-notice err">{error}</div> : null}

      <div className="d68-v10-public-criteria-summary">
        <div><span>{T(lang, 'Khẩu vị đầu tư đang hiển thị', 'Displayed investment appetite')}</span><b>{approved.investment_appetite || T(lang, 'Chưa có nội dung.', 'No content yet.')}</b></div>
        <div><span>{T(lang, 'Khẩu vị rủi ro đang hiển thị', 'Displayed risk appetite')}</span><b>{riskAppetiteLabel(approved.riskAppetite, lang)}</b></div>
        <div><span>{T(lang, 'Kỳ vọng lợi nhuận đang hiển thị', 'Displayed return expectation')}</span><b>{returnExpectationLabel(approved.returnExpectation, lang)}</b></div>
        <div><span>{T(lang, 'Quy mô doanh thu đang hiển thị', 'Displayed revenue scale')}</span><b>{revenueRangeLabel(approved.revenueRange, lang)}</b></div>
      </div>

      {pendingKeys.length ? (
        <div className="d68-dashboard-notice warn">
          {T(
            lang,
            'Bản mới đang chờ Admin duyệt. Bạn vẫn có thể chỉnh lại và gửi lại trước khi được duyệt.',
            'A new version is awaiting administrator approval. You can revise and resubmit it before approval.',
          )}
        </div>
      ) : null}

      <label className="d68-dashboard-field">
        <span>{T(lang, 'Khẩu vị đầu tư', 'Investment appetite')}</span>
        <small>
          {T(
            lang,
            'Mô tả loại doanh nghiệp, mô hình, quy mô và đặc điểm thương vụ ưu tiên.',
            'Describe preferred businesses, models, scale and deal characteristics.',
          )}
        </small>
        <textarea
          className="d68-dashboard-input d68-v10-appetite-textarea"
          value={draft.investment_appetite}
          maxLength={INVESTOR_APPETITE_MAX_LENGTH}
          onChange={(event) => update('investment_appetite', event.target.value)}
        />
        <small>{draft.investment_appetite.length}/{INVESTOR_APPETITE_MAX_LENGTH}</small>
      </label>

      <div className="d68-dashboard-form2 d68-v10-reviewed-criteria-grid">
        <label className="d68-dashboard-field">
          <span>{T(lang, 'Khẩu vị rủi ro', 'Risk appetite')}</span>
          <select
            className="d68-dashboard-input"
            value={draft.riskAppetite}
            onChange={(event) => update('riskAppetite', event.target.value)}
          >
            <option value="">{T(lang, 'Chọn', 'Select')}</option>
            {RISK_APPETITE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{T(lang, option.vi, option.en)}</option>
            ))}
          </select>
        </label>

        <label className="d68-dashboard-field">
          <span>{T(lang, 'Kỳ vọng lợi nhuận', 'Return expectation')}</span>
          <input
            className="d68-dashboard-input"
            value={draft.returnExpectation}
            inputMode="decimal"
            placeholder={T(lang, 'Ví dụ: 15 (%/năm)', 'Example: 15 (%/year)')}
            onChange={(event) => update('returnExpectation', event.target.value)}
          />
        </label>

        <label className="d68-dashboard-field">
          <span>{T(lang, 'Quy mô doanh thu', 'Revenue scale')}</span>
          <select
            className="d68-dashboard-input"
            value={draft.revenueRange}
            onChange={(event) => update('revenueRange', event.target.value)}
          >
            <option value="">{T(lang, 'Chọn', 'Select')}</option>
            {REVENUE_RANGE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{T(lang, option.vi, option.en)}</option>
            ))}
          </select>
        </label>
      </div>

      <button className="d68-dashboard-btn blue" disabled={busy}>
        {busy
          ? T(lang, 'Đang gửi...', 'Submitting...')
          : T(lang, 'Gửi Admin duyệt', 'Submit for review')}
      </button>
    </form>
  );
}
