import { useEffect, useMemo, useRef, useState } from 'react';
import {
  getBusinessFiles,
  getBusinessImages,
  updateBusinessFile,
  updateBusinessImage,
  uploadBusinessFile,
  uploadBusinessImage,
} from '../../lib/data';
import { supabase } from '../../lib/supabase';
import '../../styles/pages/admin-assets.css';

type Row = Record<string, any>;

type Props = {
  business: Row;
  adminId?: string;
  onRefresh?: () => void | Promise<void>;
};

function objectOf(value: unknown): Row {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Row)
    : {};
}

function uploadPlanOf(business: Row) {
  const pending = objectOf(business.pending_changes_json);
  const pendingFinancial = objectOf(pending.financial_input);
  const currentFinancial = objectOf(business.financial_input);
  return objectOf(
    pendingFinancial.upload_plan || currentFinancial.upload_plan,
  );
}

function uploadPlanItems(plan: Row, key: 'images' | 'files') {
  return Array.isArray(plan[key]) ? plan[key] : [];
}

function bytesLabel(value: unknown) {
  const size = Number(value || 0);
  if (!Number.isFinite(size) || size <= 0) return '';
  if (size >= 1024 * 1024) {
    return `${(size / 1024 / 1024).toFixed(1)} MB`;
  }
  if (size >= 1024) return `${Math.round(size / 1024)} KB`;
  return `${size} B`;
}

function assetTitle(row: Row) {
  return String(
    row.display_title ||
      row.display_name ||
      row.title ||
      row.file_name ||
      'Tài sản doanh nghiệp',
  );
}

export function AdminBusinessAssets({
  business,
  adminId,
  onRefresh,
}: Props) {
  const [files, setFiles] = useState<Row[]>([]);
  const [images, setImages] = useState<Row[]>([]);
  const [imageDrafts, setImageDrafts] = useState<Record<string, Row>>({});
  const [fileDrafts, setFileDrafts] = useState<Record<string, Row>>({});
  const [heroImageId, setHeroImageId] = useState('');
  const [newImage, setNewImage] = useState<File | null>(null);
  const [newImageTitle, setNewImageTitle] = useState('');
  const [newImageHero, setNewImageHero] = useState(false);
  const [newFile, setNewFile] = useState<File | null>(null);
  const [newFileTitle, setNewFileTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'ok' | 'err'>('ok');
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const plan = useMemo(() => uploadPlanOf(business), [business]);
  const plannedImages = useMemo(
    () => uploadPlanItems(plan, 'images'),
    [plan],
  );
  const plannedFiles = useMemo(
    () => uploadPlanItems(plan, 'files'),
    [plan],
  );

  const missingPlannedUploads =
    (plannedImages.length > 0 && images.length === 0) ||
    (plannedFiles.length > 0 && files.length === 0);

  async function loadAssets(preferredHeroId = '') {
    const [nextFiles, nextImages] = await Promise.all([
      getBusinessFiles(business.id),
      getBusinessImages(business.id),
    ]);

    const nextFileDrafts = Object.fromEntries(
      nextFiles.map((file: Row) => [
        String(file.id),
        {
          display_name: file.display_name || file.file_name || '',
          public_visible: !!file.public_visible,
          privacy_level: file.privacy_level || 'locked',
        },
      ]),
    );

    const nextImageDrafts = Object.fromEntries(
      nextImages.map((image: Row) => [
        String(image.id),
        {
          display_title: image.display_title || image.title || '',
          public_visible: !!image.public_visible,
          is_sanitized: !!image.is_sanitized,
        },
      ]),
    );

    if (preferredHeroId && nextImageDrafts[preferredHeroId]) {
      nextImageDrafts[preferredHeroId] = {
        ...nextImageDrafts[preferredHeroId],
        public_visible: true,
        is_sanitized: true,
      };
    }

    setFiles(nextFiles);
    setImages(nextImages);
    setFileDrafts(nextFileDrafts);
    setImageDrafts(nextImageDrafts);
    setHeroImageId(
      preferredHeroId ||
        String(
          nextImages.find((image: Row) => image.is_hero)?.id || '',
        ),
    );
  }

  useEffect(() => {
    loadAssets().catch((error) => {
      setMessageType('err');
      setMessage(error?.message || 'Không tải được ảnh/file.');
    });
  }, [business.id]);

  function patchImageDraft(imageId: string, patch: Row) {
    setImageDrafts((current) => ({
      ...current,
      [imageId]: {
        ...(current[imageId] || {}),
        ...patch,
      },
    }));
  }

  function patchFileDraft(fileId: string, patch: Row) {
    setFileDrafts((current) => ({
      ...current,
      [fileId]: {
        ...(current[fileId] || {}),
        ...patch,
      },
    }));
  }

  async function uploadImage() {
    if (!newImage) {
      setMessageType('err');
      setMessage('Hãy chọn ảnh cần upload.');
      return;
    }

    if (!/^image\/(jpeg|png|webp)$/i.test(newImage.type)) {
      setMessageType('err');
      setMessage('Ảnh chỉ hỗ trợ JPG, PNG hoặc WebP.');
      return;
    }

    if (newImage.size > 10 * 1024 * 1024) {
      setMessageType('err');
      setMessage('Ảnh vượt quá giới hạn 10 MB.');
      return;
    }

    const ownerId = String(business.owner_id || adminId || '');
    if (!ownerId) {
      setMessageType('err');
      setMessage('Không xác định được owner của Business.');
      return;
    }

    setBusy(true);
    setMessage('');

    try {
      const title = newImageTitle.trim() || newImage.name;
      const created = await uploadBusinessImage(
        business.id,
        ownerId,
        newImage,
        title,
      );

      await updateBusinessImage(created.id, {
        display_title: title,
        public_visible: false,
        is_sanitized: true,
        is_hero: false,
        review_status: 'pending_admin_approval',
        admin_note:
          `Admin uploaded image; approval required at ${new Date().toISOString()}`,
      });

      await loadAssets(newImageHero ? String(created.id) : '');
      setNewImage(null);
      setNewImageTitle('');
      setNewImageHero(false);
      if (imageInputRef.current) imageInputRef.current.value = '';
      setMessageType('ok');
      setMessage(
        'Đã upload ảnh ở trạng thái chờ. Kiểm tra rồi bấm “Duyệt Cập nhật: Ảnh/Files”.',
      );
    } catch (error: any) {
      setMessageType('err');
      setMessage(error?.message || 'Upload ảnh thất bại.');
    } finally {
      setBusy(false);
    }
  }

  async function uploadFile() {
    if (!newFile) {
      setMessageType('err');
      setMessage('Hãy chọn file cần upload.');
      return;
    }

    if (newFile.size > 50 * 1024 * 1024) {
      setMessageType('err');
      setMessage('File vượt quá giới hạn 50 MB.');
      return;
    }

    const ownerId = String(business.owner_id || adminId || '');
    if (!ownerId) {
      setMessageType('err');
      setMessage('Không xác định được owner của Business.');
      return;
    }

    setBusy(true);
    setMessage('');

    try {
      const title = newFileTitle.trim() || newFile.name;
      const created = await uploadBusinessFile(
        business.id,
        ownerId,
        newFile,
        'profile',
        'locked',
        title,
      );

      await updateBusinessFile(created.id, {
        display_name: title,
        public_visible: false,
        privacy_level: 'locked',
        review_status: 'pending_admin_approval',
        admin_note:
          `Admin uploaded file; approval required at ${new Date().toISOString()}`,
      });

      await loadAssets();
      setNewFile(null);
      setNewFileTitle('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      setMessageType('ok');
      setMessage(
        'Đã upload file ở trạng thái chờ. Kiểm tra rồi bấm “Duyệt Cập nhật: Ảnh/Files”.',
      );
    } catch (error: any) {
      setMessageType('err');
      setMessage(error?.message || 'Upload file thất bại.');
    } finally {
      setBusy(false);
    }
  }

  async function openPrivateFile(file: Row) {
    if (!file.file_path) {
      setMessageType('err');
      setMessage('File chưa có đường dẫn Storage.');
      return;
    }

    const { data, error } = await supabase.storage
      .from('business-files-private')
      .createSignedUrl(file.file_path, 5 * 60);

    if (error || !data?.signedUrl) {
      setMessageType('err');
      setMessage(
        error?.message || 'Không tạo được link xem/tải file.',
      );
      return;
    }

    window.open(
      data.signedUrl,
      '_blank',
      'noopener,noreferrer',
    );
  }

  async function approveAssets() {
    if (heroImageId) {
      const heroDraft = imageDrafts[heroImageId];
      if (!heroDraft?.public_visible || !heroDraft?.is_sanitized) {
        setMessageType('err');
        setMessage(
          'Ảnh chính phải được tick “Đã xử lý logo/tên DN” và “Hiển thị frontend”.',
        );
        return;
      }
    }

    setBusy(true);
    setMessage('');

    try {
      const { data, error } = await supabase.rpc(
        'approve_business_assets',
        {
          business_uuid: business.id,
          image_updates: images.map((image) => ({
            id: image.id,
            display_title:
              imageDrafts[String(image.id)]?.display_title ||
              image.display_title ||
              image.title ||
              '',
            public_visible:
              !!imageDrafts[String(image.id)]?.public_visible,
            is_sanitized:
              !!imageDrafts[String(image.id)]?.is_sanitized,
          })),
          file_updates: files.map((file) => ({
            id: file.id,
            display_name:
              fileDrafts[String(file.id)]?.display_name ||
              file.display_name ||
              file.file_name ||
              '',
            public_visible:
              !!fileDrafts[String(file.id)]?.public_visible,
            privacy_level:
              fileDrafts[String(file.id)]?.privacy_level ||
              'locked',
          })),
          hero_image_uuid: heroImageId || null,
        },
      );

      if (error) throw error;

      setMessageType('ok');
      setMessage(
        `Đã duyệt ${data?.approved_images ?? images.length} ảnh và ` +
          `${data?.approved_files ?? files.length} file. ` +
          'Ảnh chính đã đồng bộ với list, Homepage và Business Detail.',
      );

      await loadAssets(
        String(data?.hero_image_id || heroImageId || ''),
      );
      await onRefresh?.();
    } catch (error: any) {
      setMessageType('err');
      setMessage(error?.message || 'Duyệt ảnh/file thất bại.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="d68-admin-assets">
      <div className="d68-admin-row-head">
        <div>
          <h3>
            {business.public_code || business.slug} · Hình ảnh & Files
          </h3>
          <p className="d68-admin-subtle">
            Upload mới chưa tự public. Admin kiểm tra, đặt tên,
            chọn ảnh chính rồi duyệt theo lô.
          </p>
        </div>
        <span className="d68-admin-badge blue">
          {images.length} ảnh · {files.length} file
        </span>
      </div>

      {message ? (
        <div
          className={`d68-admin-notice ${
            messageType === 'err' ? 'err' : 'ok'
          }`}
        >
          {message}
        </div>
      ) : null}

      {missingPlannedUploads ? (
        <div className="d68-admin-notice warn">
          DN đã chọn ảnh/file lúc đăng ký nhưng chưa thấy bản upload
          thực tế. Admin có thể yêu cầu upload lại hoặc upload thủ công.
        </div>
      ) : null}

      {plannedImages.length || plannedFiles.length ? (
        <details className="d68-admin-source">
          <summary>Ảnh/file DN đã chọn khi đăng ký</summary>
          <div className="d68-admin-assets__plan">
            {plannedImages.map((item: Row, index: number) => (
              <span key={`planned-image-${index}`}>
                Ảnh: {assetTitle(item)} {bytesLabel(item.size_bytes)}
              </span>
            ))}
            {plannedFiles.map((item: Row, index: number) => (
              <span key={`planned-file-${index}`}>
                File: {assetTitle(item)} {bytesLabel(item.size_bytes)}
              </span>
            ))}
          </div>
        </details>
      ) : null}

      <div className="d68-admin-assets__upload-grid">
        <section>
          <h4>Upload ảnh mới</h4>
          <label className="d68-admin-field">
            <span>Ảnh JPG, PNG hoặc WebP</span>
            <input
              ref={imageInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="d68-admin-input"
              onChange={(event) =>
                setNewImage(event.currentTarget.files?.[0] || null)
              }
            />
          </label>
          <label className="d68-admin-field">
            <span>Tên ảnh hiển thị</span>
            <input
              className="d68-admin-input"
              value={newImageTitle}
              onChange={(event) =>
                setNewImageTitle(event.currentTarget.value)
              }
              placeholder="VD: Nhà máy và dây chuyền sản xuất"
            />
          </label>
          <label className="d68-admin-check">
            <input
              type="checkbox"
              checked={newImageHero}
              onChange={(event) =>
                setNewImageHero(event.currentTarget.checked)
              }
            />
            Chọn làm ảnh chính sau khi duyệt
          </label>
          <button
            type="button"
            className="d68-admin-btn blue"
            onClick={uploadImage}
            disabled={busy}
          >
            Upload ảnh mới
          </button>
        </section>

        <section>
          <h4>Upload file mới</h4>
          <label className="d68-admin-field">
            <span>File hồ sơ, tài chính hoặc tài liệu hỗ trợ</span>
            <input
              ref={fileInputRef}
              type="file"
              className="d68-admin-input"
              onChange={(event) =>
                setNewFile(event.currentTarget.files?.[0] || null)
              }
            />
          </label>
          <label className="d68-admin-field">
            <span>Tên file hiển thị</span>
            <input
              className="d68-admin-input"
              value={newFileTitle}
              onChange={(event) =>
                setNewFileTitle(event.currentTarget.value)
              }
              placeholder="VD: Báo cáo tài chính 2025"
            />
          </label>
          <p className="d68-admin-subtle">
            File mặc định khóa tải. Admin có thể hiển thị tên file
            trên frontend nhưng vẫn yêu cầu kết nối để tải.
          </p>
          <button
            type="button"
            className="d68-admin-btn blue"
            onClick={uploadFile}
            disabled={busy}
          >
            Upload file mới
          </button>
        </section>
      </div>

      <div className="d68-admin-assets__review-grid">
        <section>
          <h4>Ảnh hiện có</h4>
          {images.length ? (
            images.map((image) => {
              const id = String(image.id);
              const draft = imageDrafts[id] || {};
              const isHero = heroImageId === id;

              return (
                <article
                  key={id}
                  className={`d68-admin-assets__image ${
                    isHero ? 'is-hero' : ''
                  }`}
                >
                  <div className="d68-admin-assets__preview">
                    {image.public_url ? (
                      <img
                        src={image.public_url}
                        alt={assetTitle(image)}
                      />
                    ) : (
                      <div>Chưa có URL ảnh</div>
                    )}
                    {image.public_url ? (
                      <a
                        href={image.public_url}
                        target="_blank"
                        rel="noreferrer"
                        download={assetTitle(image)}
                        className="d68-admin-btn light"
                      >
                        Mở/Tải ảnh
                      </a>
                    ) : null}
                  </div>

                  <div className="d68-admin-assets__controls">
                    <input
                      className="d68-admin-input"
                      value={draft.display_title || ''}
                      onChange={(event) =>
                        patchImageDraft(id, {
                          display_title: event.currentTarget.value,
                        })
                      }
                      placeholder="Tên ảnh hiển thị"
                    />
                    <label className="d68-admin-check">
                      <input
                        type="checkbox"
                        checked={!!draft.is_sanitized}
                        onChange={(event) =>
                          patchImageDraft(id, {
                            is_sanitized:
                              event.currentTarget.checked,
                          })
                        }
                      />
                      Đã xử lý logo/tên DN
                    </label>
                    <label className="d68-admin-check">
                      <input
                        type="checkbox"
                        checked={!!draft.public_visible}
                        onChange={(event) =>
                          patchImageDraft(id, {
                            public_visible:
                              event.currentTarget.checked,
                          })
                        }
                      />
                      Hiển thị frontend
                    </label>
                    <label className="d68-admin-check">
                      <input
                        type="radio"
                        name={`hero-${business.id}`}
                        checked={isHero}
                        onChange={() => setHeroImageId(id)}
                      />
                      Ảnh chính: list, Homepage, detail
                    </label>
                  </div>
                </article>
              );
            })
          ) : (
            <div className="d68-admin-empty">
              Chưa có ảnh nào được upload thành công.
            </div>
          )}
        </section>

        <section>
          <h4>Files hiện có</h4>
          {files.length ? (
            files.map((file) => {
              const id = String(file.id);
              const draft = fileDrafts[id] || {};

              return (
                <article
                  key={id}
                  className="d68-admin-assets__file"
                >
                  <div className="d68-admin-assets__file-head">
                    <div>
                      <b>{draft.display_name || assetTitle(file)}</b>
                      <small>
                        {file.file_name} · {bytesLabel(file.size_bytes)}
                      </small>
                    </div>
                    <button
                      type="button"
                      className="d68-admin-btn light"
                      onClick={() => openPrivateFile(file)}
                    >
                      Mở/Tải file
                    </button>
                  </div>

                  <input
                    className="d68-admin-input"
                    value={draft.display_name || ''}
                    onChange={(event) =>
                      patchFileDraft(id, {
                        display_name: event.currentTarget.value,
                      })
                    }
                    placeholder="Tên file hiển thị"
                  />

                  <label className="d68-admin-check">
                    <input
                      type="checkbox"
                      checked={!!draft.public_visible}
                      onChange={(event) =>
                        patchFileDraft(id, {
                          public_visible:
                            event.currentTarget.checked,
                        })
                      }
                    />
                    Hiển thị tên file ở frontend
                  </label>

                  <label className="d68-admin-field">
                    <span>Quyền tải file</span>
                    <select
                      className="d68-admin-input"
                      value={draft.privacy_level || 'locked'}
                      onChange={(event) =>
                        patchFileDraft(id, {
                          privacy_level:
                            event.currentTarget.value,
                        })
                      }
                    >
                      <option value="locked">
                        Khóa — chỉ tải sau kết nối
                      </option>
                      <option value="public">
                        Public theo cấu hình frontend
                      </option>
                    </select>
                  </label>
                </article>
              );
            })
          ) : (
            <div className="d68-admin-empty">
              Chưa có file nào được upload thành công.
            </div>
          )}
        </section>
      </div>

      <div className="d68-admin-assets__approve">
        <div>
          <b>Duyệt theo lô</b>
          <span>
            Đồng bộ tên, trạng thái frontend và ảnh chính trong một
            transaction.
          </span>
        </div>
        <button
          type="button"
          className="d68-admin-btn green"
          disabled={busy || (!images.length && !files.length)}
          onClick={approveAssets}
        >
          {busy
            ? 'Đang xử lý...'
            : 'Duyệt Cập nhật: Ảnh/Files'}
        </button>
      </div>
    </div>
  );
}
