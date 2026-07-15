import { useEffect, useState } from 'react';
import type { InvestorRow } from '../../lib/investorAdminV10';
import {
  approveInvestorAppetite,
  approvedInvestorAppetite,
  INVESTOR_APPETITE_MAX_LENGTH,
  pendingInvestorAppetite,
} from '../../lib/investorProfileService';

export default function InvestorAppetiteEditorV10({
  investor,
  onRefresh,
}: {
  investor: InvestorRow;
  onRefresh: () => Promise<void>;
}) {
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [warning, setWarning] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    setDraft(
      pendingInvestorAppetite(investor) || approvedInvestorAppetite(investor),
    );
    setMessage('');
    setWarning('');
    setError('');
  }, [investor.id, investor.updated_at]);

  async function approve() {
    setBusy(true);
    setMessage('');
    setWarning('');
    setError('');
    try {
      await approveInvestorAppetite(String(investor.id), draft);
      setMessage('Đã duyệt và cập nhật Khẩu vị đầu tư public.');
      try {
        await onRefresh();
      } catch (refreshError: any) {
        setWarning(
          'Nội dung đã được duyệt nhưng giao diện chưa tải lại được. ' +
            (refreshError?.message || 'Hãy bấm Làm mới.'),
        );
      }
    } catch (approveError: any) {
      setError(approveError?.message || 'Không duyệt được Khẩu vị đầu tư.');
    } finally {
      setBusy(false);
    }
  }

  const pending = pendingInvestorAppetite(investor);
  return (
    <section className="d68-admin-card">
      <div className="d68-v10-section-head">
        <div>
          <h2>Khẩu vị đầu tư</h2>
          <p>Investor gửi → Admin xem/sửa → Admin duyệt → public.</p>
        </div>
        {pending ? <span className="d68-admin-badge warn">Đang chờ duyệt</span> : <span className="d68-admin-badge ok">Không có bản chờ</span>}
      </div>
      {message ? <div className="d68-admin-notice ok">{message}</div> : null}
      {warning ? <div data-testid="admin-investor-profile-warning" className="d68-admin-notice warn">{warning}</div> : null}
      {error ? <div data-testid="admin-investor-profile-error" className="d68-admin-notice err">{error}</div> : null}
      <div className="d68-v10-appetite-columns">
        <div>
          <span className="d68-v10-field-label">Đang public</span>
          <div className="d68-v10-readonly-box">
            {approvedInvestorAppetite(investor) || 'Chưa có nội dung public.'}
          </div>
        </div>
        <label className="d68-admin-field">
          <span>Nội dung Admin sẽ duyệt</span>
          <textarea
            className="d68-admin-input d68-v10-textarea"
            value={draft}
            maxLength={INVESTOR_APPETITE_MAX_LENGTH}
            onChange={(event) => setDraft(event.target.value)}
          />
          <small>{draft.length}/{INVESTOR_APPETITE_MAX_LENGTH} ký tự. Để trống và lưu để ẩn.</small>
        </label>
      </div>
      <button type="button" className="d68-admin-btn blue" disabled={busy} onClick={approve}>
        {busy ? 'Đang duyệt...' : 'Lưu & duyệt Khẩu vị đầu tư'}
      </button>
    </section>
  );
}
