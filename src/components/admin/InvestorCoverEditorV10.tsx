import { useEffect, useRef, useState } from 'react';
import type { InvestorRow } from '../../lib/investorAdminV10';
import {
  clearInvestorCover,
  DEFAULT_INVESTOR_COVER,
  INVESTOR_COVER_HEIGHT,
  INVESTOR_COVER_WIDTH,
  investorCoverUrl,
  replaceInvestorCover,
  type InvestorCoverBanner,
} from '../../lib/investorProfileService';

export default function InvestorCoverEditorV10({
  investor,
  defaultCover,
  onRefresh,
}: {
  investor: InvestorRow;
  defaultCover: InvestorCoverBanner | null;
  onRefresh: () => Promise<void>;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [warning, setWarning] = useState('');
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);
  const hasCustomCover = Boolean(investor.criteria?.cover_image_url);

  useEffect(() => {
    setFile(null);
    setMessage('');
    setWarning('');
    setError('');
    if (inputRef.current) inputRef.current.value = '';
  }, [investor.id]);

  async function refreshAfterCommit(success: string) {
    setMessage(success);
    try {
      await onRefresh();
    } catch (refreshError: any) {
      setWarning(
        'Dữ liệu đã được lưu nhưng giao diện chưa tải lại được. ' +
          (refreshError?.message || 'Hãy bấm Làm mới.'),
      );
    }
  }

  async function save() {
    if (!file) {
      setError('Vui lòng chọn ảnh Cover riêng.');
      return;
    }
    setBusy(true);
    setMessage('');
    setWarning('');
    setError('');
    try {
      const result = await replaceInvestorCover(String(investor.id), file);
      if (result.cleanupWarning) setWarning(result.cleanupWarning);
      setFile(null);
      if (inputRef.current) inputRef.current.value = '';
      await refreshAfterCommit('Đã cập nhật ảnh Cover riêng của Investor.');
    } catch (saveError: any) {
      setError(saveError?.message || 'Không cập nhật được ảnh Cover riêng.');
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    setMessage('');
    setWarning('');
    setError('');
    try {
      const result = await clearInvestorCover(String(investor.id));
      if (result.cleanupWarning) setWarning(result.cleanupWarning);
      await refreshAfterCommit(
        'Đã xóa ảnh riêng; hồ sơ dùng lại ảnh Cover mặc định.',
      );
    } catch (removeError: any) {
      setError(removeError?.message || 'Không xóa được ảnh Cover riêng.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="d68-admin-card">
      <div className="d68-v10-section-head">
        <div>
          <h2>Ảnh Cover riêng</h2>
          <p>Ảnh riêng thay thế ảnh mặc định trên hồ sơ {investor.code}.</p>
        </div>
        <span className="d68-v10-size-chip">
          {INVESTOR_COVER_WIDTH}×{INVESTOR_COVER_HEIGHT}px
        </span>
      </div>
      {message ? <div className="d68-admin-notice ok">{message}</div> : null}
      {warning ? <div data-testid="admin-investor-profile-warning" className="d68-admin-notice warn">{warning}</div> : null}
      {error ? <div data-testid="admin-investor-profile-error" className="d68-admin-notice err">{error}</div> : null}
      <div className="d68-v10-cover-preview">
        <img
          src={investorCoverUrl(investor, defaultCover)}
          alt={`Cover ${investor.code}`}
          onError={(event) => {
            event.currentTarget.src = DEFAULT_INVESTOR_COVER;
          }}
        />
      </div>
      <div className="d68-v10-cover-controls">
        <label className="d68-admin-field">
          <span>Chọn ảnh Cover riêng</span>
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="d68-admin-input"
            onChange={(event) => setFile(event.target.files?.[0] || null)}
          />
        </label>
        <div className="d68-admin-actions">
          <button type="button" className="d68-admin-btn green" disabled={!file || busy} onClick={save}>
            {busy ? 'Đang xử lý...' : 'Lưu ảnh riêng'}
          </button>
          <button type="button" className="d68-admin-btn red" disabled={!hasCustomCover || busy} onClick={remove}>
            Dùng lại ảnh mặc định
          </button>
        </div>
      </div>
    </section>
  );
}
