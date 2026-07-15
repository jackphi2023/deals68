import { useEffect, useState } from 'react';
import type { InvestorRow } from '../../lib/investorAdminV10';
import {
  approvedInvestorReviewCriteria,
  approveInvestorCriteriaReview,
  changedInvestorReviewKeys,
  investorReviewCriteriaDraft,
  pendingInvestorReviewKeys,
  type InvestorReviewCriteria,
  type InvestorReviewCriteriaKey,
} from '../../lib/investorCriteriaReviewService';
import {
  REVENUE_RANGE_OPTIONS,
  RISK_APPETITE_OPTIONS,
  revenueRangeLabel,
  returnExpectationLabel,
  riskAppetiteLabel,
} from '../../lib/investorCriteriaOptions';
import { INVESTOR_APPETITE_MAX_LENGTH } from '../../lib/investorProfileService';

const FIELD_LABELS: Record<InvestorReviewCriteriaKey, string> = {
  investment_appetite: 'Khẩu vị đầu tư',
  riskAppetite: 'Khẩu vị rủi ro',
  returnExpectation: 'Kỳ vọng lợi nhuận',
  revenueRange: 'Quy mô doanh thu',
};

export default function InvestorAppetiteEditorV10({
  investor,
  onRefresh,
}: {
  investor: InvestorRow;
  onRefresh: () => Promise<void>;
}) {
  const [draft, setDraft] = useState<InvestorReviewCriteria>(() =>
    investorReviewCriteriaDraft(investor),
  );
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [warning, setWarning] = useState('');
  const [error, setError] = useState('');

  const approved = approvedInvestorReviewCriteria(investor);
  const pendingKeys = pendingInvestorReviewKeys(investor);
  const changedKeys = changedInvestorReviewKeys(investor);

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

  async function approve() {
    setBusy(true);
    setMessage('');
    setWarning('');
    setError('');
    try {
      await approveInvestorCriteriaReview(String(investor.id), draft);
      setMessage('Đã lưu, duyệt và cập nhật các tiêu chí Investor public.');
      try {
        await onRefresh();
      } catch (refreshError: any) {
        setWarning(
          'Nội dung đã được duyệt nhưng giao diện chưa tải lại được. ' +
            (refreshError?.message || 'Hãy bấm Làm mới.'),
        );
      }
    } catch (approveError: any) {
      setError(approveError?.message || 'Không duyệt được tiêu chí Investor.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="d68-admin-card" data-testid="admin-investor-reviewed-criteria">
      <div className="d68-v10-section-head">
        <div>
          <h2>Khẩu vị và tiêu chí đầu tư</h2>
          <p>Investor gửi → Admin xem/sửa → Admin duyệt → public.</p>
        </div>
        {pendingKeys.length ? (
          <span className="d68-admin-badge warn">Đang chờ duyệt</span>
        ) : (
          <span className="d68-admin-badge ok">Không có bản chờ</span>
        )}
      </div>

      {changedKeys.length ? (
        <div className="d68-admin-notice warn" data-testid="admin-investor-criteria-change-warning">
          <b>Investor vừa cập nhật:</b>{' '}
          {changedKeys.map((key) => FIELD_LABELS[key]).join(', ')}. Cần kiểm tra trước khi duyệt.
        </div>
      ) : null}
      {message ? <div data-testid="admin-investor-appetite-success" className="d68-admin-notice ok">{message}</div> : null}
      {warning ? <div data-testid="admin-investor-appetite-warning" className="d68-admin-notice warn">{warning}</div> : null}
      {error ? <div data-testid="admin-investor-appetite-error" className="d68-admin-notice err">{error}</div> : null}

      <div className="d68-v10-public-criteria-summary d68-v10-public-criteria-summary--admin">
        <div><span>Khẩu vị đầu tư đang public</span><b>{approved.investment_appetite || 'Chưa có nội dung public.'}</b></div>
        <div><span>Khẩu vị rủi ro đang public</span><b>{riskAppetiteLabel(approved.riskAppetite, 'vi')}</b></div>
        <div><span>Kỳ vọng lợi nhuận đang public</span><b>{returnExpectationLabel(approved.returnExpectation, 'vi')}</b></div>
        <div><span>Quy mô doanh thu đang public</span><b>{revenueRangeLabel(approved.revenueRange, 'vi')}</b></div>
      </div>

      <label className="d68-admin-field">
        <span>Khẩu vị đầu tư — nội dung Admin sẽ duyệt</span>
        <textarea
          className="d68-admin-input d68-v10-appetite-textarea"
          value={draft.investment_appetite}
          maxLength={INVESTOR_APPETITE_MAX_LENGTH}
          onChange={(event) => update('investment_appetite', event.target.value)}
        />
        <small>{draft.investment_appetite.length}/{INVESTOR_APPETITE_MAX_LENGTH} ký tự. Để trống và duyệt để ẩn.</small>
      </label>

      <div className="d68-admin-form2 d68-v10-reviewed-criteria-grid">
        <label className="d68-admin-field">
          <span>Khẩu vị rủi ro</span>
          <select
            className="d68-admin-input"
            value={draft.riskAppetite}
            onChange={(event) => update('riskAppetite', event.target.value)}
          >
            <option value="">Chọn</option>
            {RISK_APPETITE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.vi}</option>
            ))}
          </select>
        </label>

        <label className="d68-admin-field">
          <span>Kỳ vọng lợi nhuận</span>
          <input
            className="d68-admin-input"
            value={draft.returnExpectation}
            inputMode="decimal"
            placeholder="Ví dụ: 15 (%/năm)"
            onChange={(event) => update('returnExpectation', event.target.value)}
          />
        </label>

        <label className="d68-admin-field">
          <span>Quy mô doanh thu</span>
          <select
            className="d68-admin-input"
            value={draft.revenueRange}
            onChange={(event) => update('revenueRange', event.target.value)}
          >
            <option value="">Chọn</option>
            {REVENUE_RANGE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.vi}</option>
            ))}
          </select>
        </label>
      </div>

      <button type="button" className="d68-admin-btn blue" disabled={busy} onClick={approve}>
        {busy ? 'Đang duyệt...' : 'Lưu & duyệt tiêu chí Investor'}
      </button>
    </section>
  );
}
