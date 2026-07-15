import { type FormEvent, useEffect, useState } from 'react';
import type { Lang } from '../../lib/i18n';
import {
  hasPendingInvestorAppetiteV10,
  type InvestorRow,
} from '../../lib/investorAdminV10';
import {
  approvedInvestorAppetite,
  INVESTOR_APPETITE_MAX_LENGTH,
  pendingInvestorAppetite,
  submitMyInvestorAppetite,
} from '../../lib/investorProfileService';
import { T } from '../../lib/labels';

export default function InvestorAppetiteFormV10({
  investor,
  lang,
  onRefresh,
}: {
  investor: InvestorRow;
  lang: Lang;
  onRefresh: () => Promise<void>;
}) {
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [warning, setWarning] = useState('');
  const [error, setError] = useState('');

  const approved = approvedInvestorAppetite(investor);
  const pending = pendingInvestorAppetite(investor);
  const hasPending = hasPendingInvestorAppetiteV10(investor);

  useEffect(() => {
    setDraft(hasPending ? pending : approved);
  }, [investor.id, hasPending, pending, approved]);

  useEffect(() => {
    setMessage('');
    setWarning('');
    setError('');
  }, [investor.id]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    setWarning('');
    setError('');
    try {
      await submitMyInvestorAppetite(draft);
      setMessage(
        T(
          lang,
          'Đã gửi Khẩu vị đầu tư để Admin kiểm tra và duyệt.',
          'Investment appetite submitted for administrator review.',
        ),
      );
      try {
        await onRefresh();
      } catch (refreshError: any) {
        setWarning(
          T(
            lang,
            'Nội dung đã gửi nhưng giao diện chưa tải lại được. Hãy bấm Làm mới.',
            'The content was submitted, but the page could not refresh. Please reload.',
          ) + (refreshError?.message ? ` ${refreshError.message}` : ''),
        );
      }
    } catch (submitError: any) {
      setError(
        submitError?.message ||
          T(lang, 'Không gửi được Khẩu vị đầu tư.', 'Could not submit investment appetite.'),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      className="d68-dashboard-card d68-v10-appetite-card"
      onSubmit={submit}
    >
      <h2>{T(lang, 'Khẩu vị đầu tư', 'Investment appetite')}</h2>
      <p>
        {T(
          lang,
          'Mô tả loại doanh nghiệp, mô hình, quy mô và đặc điểm thương vụ bạn ưu tiên. Nội dung chỉ public sau khi Admin duyệt.',
          'Describe the businesses, models, sizes and deal characteristics you prefer. It is public only after administrator approval.',
        )}
      </p>
      {message ? <div data-testid="investor-appetite-success" className="d68-dashboard-notice ok">{message}</div> : null}
      {warning ? <div data-testid="investor-appetite-warning" className="d68-dashboard-notice warn">{warning}</div> : null}
      {error ? <div data-testid="investor-appetite-error" className="d68-dashboard-notice err">{error}</div> : null}

      <div className="d68-v10-appetite-status">
        <small>{T(lang, 'Đang public', 'Currently public')}</small>
        <p>{approved || T(lang, 'Chưa có nội dung.', 'No content yet.')}</p>
      </div>
      {hasPending ? (
        <div className="d68-dashboard-notice warn">
          {T(lang, 'Bản mới đang chờ Admin duyệt.', 'A new version is awaiting administrator approval.')}
        </div>
      ) : null}

      <label className="d68-dashboard-field">
        <span>{T(lang, 'Nội dung gửi duyệt', 'Content for review')}</span>
        <textarea
          className="d68-dashboard-input d68-v10-appetite-textarea"
          value={draft}
          maxLength={INVESTOR_APPETITE_MAX_LENGTH}
          onChange={(event) => setDraft(event.target.value)}
        />
        <small>{draft.length}/{INVESTOR_APPETITE_MAX_LENGTH}</small>
      </label>
      <button className="d68-dashboard-btn blue" disabled={busy}>
        {busy
          ? T(lang, 'Đang gửi...', 'Submitting...')
          : T(lang, 'Gửi Admin duyệt', 'Submit for review')}
      </button>
    </form>
  );
}
