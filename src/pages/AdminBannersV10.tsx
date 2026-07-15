import { useEffect, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { AdminBannerManager } from '../components/SiteBanners';
import AdminV10Shell from '../components/admin/AdminV10Shell';
import { useAuth } from '../contexts/AuthContext';
import {
  DEFAULT_INVESTOR_COVER,
  getDefaultInvestorCover,
  INVESTOR_COVER_HEIGHT,
  INVESTOR_COVER_MAX_BYTES,
  INVESTOR_COVER_WIDTH,
  replaceDefaultInvestorCover,
  type InvestorCoverBanner,
} from '../lib/investorProfileService';

function DefaultInvestorCoverManager() {
  const [cover, setCover] = useState<InvestorCoverBanner | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [warning, setWarning] = useState('');
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);

  async function loadCover() {
    const next = await getDefaultInvestorCover('vi', true);
    setCover(next);
    return next;
  }

  useEffect(() => {
    loadCover().catch((loadError: any) => {
      setError(loadError?.message || 'Không tải được ảnh Cover mặc định.');
    });
  }, []);

  async function save() {
    if (!file) {
      setError('Vui lòng chọn ảnh Cover mới.');
      return;
    }

    setBusy(true);
    setMessage('');
    setWarning('');
    setError('');

    try {
      const result = await replaceDefaultInvestorCover(file);
      setMessage('Đã cập nhật ảnh Cover Investor mặc định.');
      if (result.cleanupWarning) setWarning(result.cleanupWarning);
      setFile(null);
      if (inputRef.current) inputRef.current.value = '';

      try {
        await loadCover();
      } catch (refreshError: any) {
        setWarning(
          'Ảnh mới đã được lưu nhưng giao diện chưa tải lại được. ' +
            (refreshError?.message || 'Hãy bấm Làm mới.'),
        );
      }
    } catch (saveError: any) {
      setError(saveError?.message || 'Không cập nhật được ảnh Cover mặc định.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      className="d68-admin-card d68-v10-default-cover"
      data-testid="admin-default-investor-cover"
    >
      <div className="d68-v10-section-head">
        <div>
          <h2>Ảnh Cover Investor mặc định</h2>
          <p>
            Dùng chung cho mọi hồ sơ Nhà đầu tư chưa có ảnh riêng. Admin có
            thể thay ảnh này mà không ảnh hưởng ảnh riêng từng Investor.
          </p>
        </div>
        <span className="d68-v10-size-chip">
          {INVESTOR_COVER_WIDTH}×{INVESTOR_COVER_HEIGHT}px
        </span>
      </div>

      {message ? <div className="d68-admin-notice ok">{message}</div> : null}
      {warning ? <div className="d68-admin-notice warn">{warning}</div> : null}
      {error ? <div className="d68-admin-notice err">{error}</div> : null}

      <div className="d68-v10-cover-preview">
        <img
          src={cover?.image_url || DEFAULT_INVESTOR_COVER}
          alt="Investor cover mặc định"
          onError={(event) => {
            event.currentTarget.onerror = null;
            event.currentTarget.src = DEFAULT_INVESTOR_COVER;
          }}
        />
      </div>

      <div className="d68-v10-cover-controls">
        <label className="d68-admin-field">
          <span>Thay ảnh Cover mặc định</span>
          <small>
            PNG/JPEG/WebP, chính xác {INVESTOR_COVER_WIDTH}×
            {INVESTOR_COVER_HEIGHT}px, tối đa{' '}
            {Math.round(INVESTOR_COVER_MAX_BYTES / 1024 / 1024)} MB.
          </small>
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="d68-admin-input"
            onChange={(event) => setFile(event.target.files?.[0] || null)}
          />
        </label>
        <button
          type="button"
          className="d68-admin-btn green"
          disabled={busy || !file}
          onClick={save}
        >
          {busy ? 'Đang lưu...' : 'Lưu ảnh Cover mặc định'}
        </button>
      </div>
    </section>
  );
}

export default function AdminBannersV10() {
  const { profile, loading } = useAuth();

  if (loading) {
    return <section className="d68-admin-page"><div className="d68-admin-wrap">Đang tải...</div></section>;
  }
  if (profile?.role !== 'admin') {
    return <Navigate to="/login?next=/admin/banners" replace />;
  }

  return (
    <AdminV10Shell
      current="/admin/banners"
      title="Quản trị Banner"
      subtitle="Quản lý Hero, Promotion và ảnh Cover mặc định của Investor."
    >
      <AdminBannerManager />
      <DefaultInvestorCoverManager />
    </AdminV10Shell>
  );
}
