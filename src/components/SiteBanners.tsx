import {
  type CSSProperties,
  type FormEvent,
  type ReactNode,
  useEffect,
  useState,
} from 'react';
import type { Lang } from '../lib/i18n';
import { supabase } from '../lib/supabase';
import {
  listSiteBanners,
  uploadSiteBannerImage,
  type BannerPlacement,
  type SiteBanner,
} from '../lib/banners';
import HeroBannerMedia, {
  heroFocusPosition,
} from './HeroBannerMedia';

const PLACEMENTS: {
  id: BannerPlacement;
  label: string;
  note: string;
  slotCount: number;
  size: string;
}[] = [
  {
    id: 'home_hero',
    label: 'Trang chủ Hero',
    note:
      'Slider nền trang chủ. Ảnh desktop 1600×600px; ' +
      'ảnh mobile 900×1200px là tùy chọn nhưng nên có. ' +
      'Có thể chọn điểm trọng tâm X/Y để kiểm soát phần bị cắt.',
    slotCount: 5,
    size: 'Desktop 1600×600 · Mobile 900×1200',
  },
  {
    id: 'home_promotion',
    label: 'Trang chủ Promotion',
    note:
      'Banner dưới box vai trò tại trang chủ. Upload 1-2 ảnh, ' +
      'khuyến nghị 1600×550px.',
    slotCount: 2,
    size: '1600×550px',
  },
  {
    id: 'listing_promotion',
    label: 'Trang danh sách Promotion',
    note:
      'Banner dưới danh sách Business/Investor. Upload 1-2 ảnh, ' +
      'khuyến nghị 1600×550px.',
    slotCount: 2,
    size: '1600×550px',
  },
  {
    id: 'investor_cover_default',
    label: 'Ảnh cover mặc định Nhà đầu tư',
    note:
      'Một ảnh cover mặc định dùng cho các hồ sơ Nhà đầu tư chưa có ' +
      'cover riêng đã được duyệt. Thay ảnh mặc định không ghi đè ' +
      'cover riêng của từng Nhà đầu tư.',
    slotCount: 1,
    size: '1600×560px',
  },
];

function svgData(
  title: string,
  subtitle: string,
  bg1: string,
  bg2: string,
  height = 800,
) {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="1600" ` +
    `height="${height}" viewBox="0 0 1600 ${height}">` +
    '<defs><linearGradient id="g" x1="0" x2="1">' +
    `<stop offset="0" stop-color="${bg1}"/>` +
    `<stop offset="1" stop-color="${bg2}"/>` +
    '</linearGradient></defs>' +
    `<rect width="1600" height="${height}" fill="url(#g)"/>` +
    '<circle cx="1300" cy="140" r="230" ' +
    'fill="rgba(255,255,255,.18)"/>' +
    `<circle cx="1220" cy="${height - 160}" r="320" ` +
    'fill="rgba(242,181,29,.20)"/>' +
    `<text x="120" y="180" font-family="Arial, sans-serif" ` +
    `font-size="54" font-weight="800" fill="white">${title}</text>` +
    `<text x="120" y="250" font-family="Arial, sans-serif" ` +
    'font-size="28" font-weight="600" ' +
    `fill="rgba(255,255,255,.82)">${subtitle}</text>` +
    '</svg>';

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

const HERO_FALLBACK = svgData(
  'Deals68.com',
  'Upload active Hero banners in Admin',
  '#0F2A4A',
  '#1596cc',
  600,
);

const PROMO_FALLBACK = svgData(
  'Deals68 Beta',
  'Upload promotion banner in Admin',
  '#F2B51D',
  '#1BADEA',
  550,
);

const HERO_FALLBACK_ROW: SiteBanner = {
  id: 'hero-fallback',
  placement: 'home_hero',
  title: 'Deals68 hero placeholder',
  image_url: '',
  mobile_image_url: null,
  focal_x: 50,
  focal_y: 50,
  sort_order: 1,
  lang_mode: 'both',
  active: true,
};

function cleanUrl(url?: string | null) {
  return String(url || '').trim();
}

function BannerImg({
  src,
  alt,
  fallback,
  eager = false,
}: {
  src?: string | null;
  alt: string;
  fallback: string;
  eager?: boolean;
}) {
  const [current, setCurrent] = useState(
    cleanUrl(src) || fallback,
  );

  useEffect(() => {
    setCurrent(cleanUrl(src) || fallback);
  }, [src, fallback]);

  return (
    <img
      src={current}
      alt={alt}
      loading={eager ? 'eager' : 'lazy'}
      fetchPriority={eager ? 'high' : 'auto'}
      onError={() => setCurrent(fallback)}
    />
  );
}

function MaybeLink({
  href,
  className,
  children,
}: {
  href?: string | null;
  className?: string;
  children: ReactNode;
}) {
  const clean = cleanUrl(href);

  if (!clean) {
    return <div className={className}>{children}</div>;
  }

  const external = clean.startsWith('http');

  return (
    <a
      className={className}
      href={clean}
      target={external ? '_blank' : undefined}
      rel={external ? 'noreferrer' : undefined}
    >
      {children}
    </a>
  );
}

export function HeroBannerSlider({
  lang,
}: {
  lang: Lang;
}) {
  const [rows, setRows] = useState<SiteBanner[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [active, setActive] = useState(0);

  useEffect(() => {
    let live = true;
    setLoaded(false);

    listSiteBanners('home_hero', lang)
      .then((data) => {
        if (!live) return;
        setRows(data.slice(0, 5));
        setLoaded(true);
      })
      .catch(() => {
        if (!live) return;
        setRows([]);
        setLoaded(true);
      });

    return () => {
      live = false;
    };
  }, [lang]);

  useEffect(() => {
    setActive(0);
  }, [rows.length]);

  useEffect(() => {
    if (rows.length <= 1) return;

    const timer = window.setInterval(() => {
      setActive((current) => (current + 1) % rows.length);
    }, 5500);

    return () => window.clearInterval(timer);
  }, [rows.length]);

  const activeBanner = rows[active] || null;
  const sliderClassName =
    `d68-hero-slider${
      cleanUrl(activeBanner?.mobile_image_url)
        ? ' has-mobile-image'
        : ''
    }`;

  if (!loaded || !rows.length) {
    return (
      <div className={sliderClassName} aria-hidden="true">
        <div className="d68-hero-slide is-active">
          <HeroBannerMedia
            banner={HERO_FALLBACK_ROW}
            fallback={HERO_FALLBACK}
            alt="Deals68 hero placeholder"
            eager
          />
        </div>
      </div>
    );
  }

  return (
    <div className={sliderClassName} aria-hidden="true">
      {rows.map((slide, index) => (
        <MaybeLink
          key={slide.id}
          href={slide.link_url}
          className={
            `d68-hero-slide${index === active ? ' is-active' : ''}`
          }
        >
          <HeroBannerMedia
            banner={slide}
            fallback={HERO_FALLBACK}
            alt={slide.title || 'Deals68 banner'}
            eager={index === 0}
          />
        </MaybeLink>
      ))}

      {rows.length > 1 ? (
        <div className="d68-hero-dots">
          {rows.map((slide, index) => (
            <button
              key={slide.id}
              type="button"
              aria-label={`Slide ${index + 1}`}
              className={index === active ? 'active' : ''}
              onClick={() => setActive(index)}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function PromotionBanner({
  placement,
  lang,
  className = '',
}: {
  placement: 'home_promotion' | 'listing_promotion';
  lang: Lang;
  className?: string;
}) {
  const [rows, setRows] = useState<SiteBanner[]>([]);

  useEffect(() => {
    let live = true;

    listSiteBanners(placement, lang)
      .then((data) => {
        if (live) setRows(data);
      })
      .catch(() => {
        if (live) setRows([]);
      });

    return () => {
      live = false;
    };
  }, [placement, lang]);

  const banner = rows[0] || null;
  if (!banner) return null;

  return (
    <section
      className={`d68-promo-banner ${className}`.trim()}
    >
      <MaybeLink
        href={banner.link_url}
        className="d68-promo-banner__link"
      >
        <BannerImg
          src={banner.image_url}
          fallback={PROMO_FALLBACK}
          alt={banner.title || 'Deals68 promotion'}
        />
      </MaybeLink>
    </section>
  );
}

function dateIn(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function firstSlotRow(
  rows: SiteBanner[],
  placement: BannerPlacement,
  slot: number,
) {
  return (
    rows
      .filter(
        (row) =>
          row.placement === placement &&
          Number(row.sort_order || 1) === slot,
      )
      .sort((a, b) => {
        const activeOrder =
          Number(b.active !== false) - Number(a.active !== false);

        if (activeOrder) return activeOrder;

        return String(
          b.updated_at || b.created_at || '',
        ).localeCompare(
          String(a.updated_at || a.created_at || ''),
        );
      })[0] || null
  );
}

function focusValue(value: FormDataEntryValue | null) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 50;
  return Math.max(0, Math.min(100, Math.round(numeric)));
}

function HeroAdminPreview({
  row,
}: {
  row: SiteBanner;
}) {
  const focus = heroFocusPosition(row);
  const imageStyle = {
    objectPosition: focus,
  } as CSSProperties;

  return (
    <div className="d68-banner-hero-previews">
      <div>
        <span>Desktop · 1600×600</span>
        <img
          src={row.image_url}
          alt={`${row.title || 'Hero'} desktop`}
          style={imageStyle}
        />
      </div>
      <div>
        <span>Mobile · 900×1200</span>
        <img
          src={row.mobile_image_url || row.image_url}
          alt={`${row.title || 'Hero'} mobile`}
          style={imageStyle}
        />
      </div>
    </div>
  );
}

export function AdminBannerManager() {
  const [rows, setRows] = useState<SiteBanner[]>([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busyKey, setBusyKey] = useState('');

  async function load() {
    setError('');

    const { data, error: loadError } = await supabase
      .from('site_banners')
      .select('*')
      .order('placement')
      .order('sort_order')
      .order('updated_at', { ascending: false })
      .order('created_at', { ascending: false });

    if (loadError) {
      setError(loadError.message);
      return;
    }

    setRows((data || []) as SiteBanner[]);
  }

  useEffect(() => {
    load();
  }, []);

  async function removeStoragePath(path?: string | null) {
    const clean = cleanUrl(path);
    if (!clean) return;

    const { error: removeError } = await supabase.storage
      .from('site-banners')
      .remove([clean]);

    if (removeError) throw removeError;
  }

  async function upsertSlot(
    event: FormEvent<HTMLFormElement>,
    placement: BannerPlacement,
    slot: number,
    row: SiteBanner | null,
  ) {
    event.preventDefault();

    const form = event.currentTarget;
    const formData = new FormData(form);
    const desktopFile = formData.get('file') as File | null;
    const mobileFile = formData.get('mobile_file') as File | null;
    const key = `${placement}-${slot}`;

    if (
      (!desktopFile || !desktopFile.name) &&
      !row?.image_url
    ) {
      setError(
        `Vui lòng chọn ảnh cho ${
          PLACEMENTS.find((item) => item.id === placement)?.label ||
          placement
        } · Banner ${slot}.`,
      );
      return;
    }

    setBusyKey(key);
    setError('');
    setMessage('');

    const newlyUploadedPaths: string[] = [];
    const stalePaths = new Set<string>();
    let databaseSaved = false;

    try {
      let imageUrl = row?.image_url || '';
      let imagePath = row?.image_path || null;
      let mobileImageUrl = row?.mobile_image_url || null;
      let mobileImagePath = row?.mobile_image_path || null;

      if (desktopFile?.name) {
        const uploaded = await uploadSiteBannerImage(
          desktopFile,
          placement,
          'desktop',
        );

        newlyUploadedPaths.push(uploaded.path);

        if (
          row?.image_path &&
          row.image_path !== uploaded.path
        ) {
          stalePaths.add(row.image_path);
        }

        imageUrl = uploaded.publicUrl;
        imagePath = uploaded.path;
      }

      const removeMobile =
        formData.get('remove_mobile') === 'on';

      if (removeMobile && mobileImagePath) {
        stalePaths.add(mobileImagePath);
        mobileImageUrl = null;
        mobileImagePath = null;
      }

      if (placement === 'home_hero' && mobileFile?.name) {
        const uploadedMobile = await uploadSiteBannerImage(
          mobileFile,
          placement,
          'mobile',
        );

        newlyUploadedPaths.push(uploadedMobile.path);

        if (
          mobileImagePath &&
          mobileImagePath !== uploadedMobile.path
        ) {
          stalePaths.add(mobileImagePath);
        }

        mobileImageUrl = uploadedMobile.publicUrl;
        mobileImagePath = uploadedMobile.path;
      }

      const payload = {
        placement,
        title: String(
          formData.get('title') ||
            row?.title ||
            `Banner ${slot}`,
        ),
        image_url: imageUrl,
        image_path: imagePath,
        mobile_image_url:
          placement === 'home_hero' ? mobileImageUrl : null,
        mobile_image_path:
          placement === 'home_hero' ? mobileImagePath : null,
        focal_x:
          placement === 'home_hero'
            ? focusValue(formData.get('focal_x'))
            : 50,
        focal_y:
          placement === 'home_hero'
            ? focusValue(formData.get('focal_y'))
            : 50,
        link_url:
          String(formData.get('link_url') || '').trim() || null,
        sort_order: slot,
        lang_mode: String(
          formData.get('lang_mode') || 'both',
        ),
        starts_at: String(
          formData.get('starts_at') || dateIn(0),
        ),
        ends_at:
          String(formData.get('ends_at') || '') || null,
        active: formData.get('active') === 'on',
        updated_at: new Date().toISOString(),
      };

      const saveResult = row?.id
        ? await supabase
            .from('site_banners')
            .update(payload)
            .eq('id', row.id)
            .select('id')
            .single()
        : await supabase
            .from('site_banners')
            .insert(payload)
            .select('id')
            .single();

      if (saveResult.error) throw saveResult.error;
      databaseSaved = true;

      const savedId = String(
        saveResult.data?.id || row?.id || '',
      );

      if (savedId) {
        const duplicateResult = await supabase
          .from('site_banners')
          .update({ active: false })
          .eq('placement', placement)
          .eq('sort_order', slot)
          .neq('id', savedId)
          .eq('active', true);

        if (duplicateResult.error) {
          throw duplicateResult.error;
        }
      }

      const activePaths = new Set(
        [imagePath, mobileImagePath].filter(Boolean) as string[],
      );
      const cleanupErrors: string[] = [];

      for (const stalePath of stalePaths) {
        if (activePaths.has(stalePath)) continue;

        try {
          await removeStoragePath(stalePath);
        } catch (cleanupError: any) {
          cleanupErrors.push(
            cleanupError?.message || stalePath,
          );
        }
      }

      setMessage(
        `Đã lưu ${
          PLACEMENTS.find((item) => item.id === placement)?.label ||
          placement
        } · Banner ${slot}.` +
          (cleanupErrors.length
            ? ' Cảnh báo: còn file ảnh cũ cần dọn trong Storage.'
            : ''),
      );

      await load();
    } catch (saveError: any) {
      if (!databaseSaved) {
        for (const uploadedPath of newlyUploadedPaths) {
          try {
            await removeStoragePath(uploadedPath);
          } catch {
            // Best-effort cleanup after a failed database save.
          }
        }
      }

      setError(
        saveError?.message || 'Upload/lưu banner thất bại.',
      );
    } finally {
      setBusyKey('');
    }
  }

  async function remove(row: SiteBanner) {
    if (!window.confirm('Xóa banner này?')) return;

    setBusyKey(`delete-${row.id}`);
    setError('');
    setMessage('');

    try {
      const { error: deleteError } = await supabase
        .from('site_banners')
        .delete()
        .eq('id', row.id);

      if (deleteError) throw deleteError;

      const cleanupErrors: string[] = [];

      for (const storagePath of [
        row.image_path,
        row.mobile_image_path,
      ]) {
        try {
          await removeStoragePath(storagePath);
        } catch (cleanupError: any) {
          cleanupErrors.push(
            cleanupError?.message || String(storagePath),
          );
        }
      }

      setMessage(
        cleanupErrors.length
          ? 'Đã xóa banner khỏi database; còn file Storage cần dọn.'
          : 'Đã xóa banner.',
      );
      await load();
    } catch (deleteError: any) {
      setError(
        deleteError?.message || 'Không xóa được banner.',
      );
    } finally {
      setBusyKey('');
    }
  }

  return (
    <div className="d68-banner-admin">
      <CardTitle
        title="Quản trị Banner"
        note={
          'Hero hỗ trợ ảnh desktop, ảnh mobile và điểm trọng tâm. ' +
          'Promotion dùng một ảnh responsive như hiện tại.'
        }
      />

      {message ? (
        <div className="d68-admin-notice ok">{message}</div>
      ) : null}
      {error ? (
        <div className="d68-admin-notice err">{error}</div>
      ) : null}
      {busyKey ? (
        <div className="d68-admin-notice warn">
          Đang xử lý {busyKey}...
        </div>
      ) : null}

      {PLACEMENTS.map((placement) => (
        <div
          key={placement.id}
          className="d68-admin-card d68-banner-admin__section"
        >
          <h3>{placement.label}</h3>
          <p className="d68-admin-subtle">
            {placement.note}
          </p>

          <div className="d68-banner-slot-grid">
            {Array.from({
              length: placement.slotCount,
            }).map((_, index) => {
              const slot = index + 1;
              const row = firstSlotRow(
                rows,
                placement.id,
                slot,
              );
              const key =
                `${placement.id}-${slot}:` +
                `${row?.id || 'new'}:` +
                `${row?.updated_at || ''}:` +
                `${row?.focal_x ?? 50}:` +
                `${row?.focal_y ?? 50}`;

              return (
                <form
                  key={key}
                  onSubmit={(
                    event: FormEvent<HTMLFormElement>,
                  ) =>
                    upsertSlot(
                      event,
                      placement.id,
                      slot,
                      row,
                    )
                  }
                  className="d68-banner-slot-card"
                >
                  <div className="d68-banner-slot-card__media">
                    {row?.image_url ? (
                      <img
                        src={row.image_url}
                        alt={row.title || `Banner ${slot}`}
                        style={{
                          objectPosition: heroFocusPosition(row),
                        }}
                      />
                    ) : (
                      <span>
                        Banner {slot}
                        <small>{placement.size}</small>
                      </span>
                    )}
                  </div>

                  <div className="d68-banner-slot-card__body">
                    <h4>
                      {placement.label} · Banner {slot}
                    </h4>

                    {placement.id === 'home_hero' && row ? (
                      <HeroAdminPreview row={row} />
                    ) : null}

                    <label className="d68-admin-field">
                      <span>Tên banner</span>
                      <input
                        name="title"
                        className="d68-admin-input"
                        defaultValue={
                          row?.title || `Banner ${slot}`
                        }
                      />
                    </label>

                    <label className="d68-admin-field">
                      <span>URL/Link nếu có</span>
                      <input
                        name="link_url"
                        className="d68-admin-input"
                        defaultValue={row?.link_url || ''}
                        placeholder="/pricing hoặc https://..."
                      />
                    </label>

                    <div className="d68-admin-form2">
                      <label className="d68-admin-field">
                        <span>Hiển thị</span>
                        <select
                          name="lang_mode"
                          defaultValue={row?.lang_mode || 'both'}
                          className="d68-admin-input"
                        >
                          <option value="both">VN + EN</option>
                          <option value="vi">Chỉ VN</option>
                          <option value="en">Chỉ EN</option>
                        </select>
                      </label>

                      <label className="d68-admin-field">
                        <span>Trạng thái</span>
                        <label className="d68-admin-check d68-banner-active">
                          <input
                            name="active"
                            type="checkbox"
                            defaultChecked={row?.active !== false}
                          />{' '}
                          Đang hiển thị
                        </label>
                      </label>

                      <label className="d68-admin-field">
                        <span>Từ ngày</span>
                        <input
                          name="starts_at"
                          type="date"
                          defaultValue={
                            row?.starts_at || dateIn(0)
                          }
                          className="d68-admin-input"
                        />
                      </label>

                      <label className="d68-admin-field">
                        <span>Đến ngày</span>
                        <input
                          name="ends_at"
                          type="date"
                          defaultValue={
                            row?.ends_at || dateIn(60)
                          }
                          className="d68-admin-input"
                        />
                      </label>
                    </div>

                    {placement.id === 'home_hero' ? (
                      <>
                        <div className="d68-admin-form2">
                          <label className="d68-admin-field">
                            <span>Trọng tâm ngang X (%)</span>
                            <input
                              name="focal_x"
                              type="number"
                              min="0"
                              max="100"
                              defaultValue={row?.focal_x ?? 50}
                              className="d68-admin-input"
                            />
                            <small>
                              0 = trái, 50 = giữa, 100 = phải.
                            </small>
                          </label>

                          <label className="d68-admin-field">
                            <span>Trọng tâm dọc Y (%)</span>
                            <input
                              name="focal_y"
                              type="number"
                              min="0"
                              max="100"
                              defaultValue={row?.focal_y ?? 50}
                              className="d68-admin-input"
                            />
                            <small>
                              0 = trên, 50 = giữa, 100 = dưới.
                            </small>
                          </label>
                        </div>

                        <label className="d68-admin-field">
                          <span>
                            {row
                              ? 'Thay ảnh desktop'
                              : 'Upload ảnh desktop'}
                          </span>
                          <small>
                            Khuyến nghị 1600×600px. Nội dung quan trọng
                            không nên sát mép ảnh.
                          </small>
                          <input
                            name="file"
                            type="file"
                            accept="image/png,image/jpeg,image/webp"
                            className="d68-admin-input"
                            required={!row}
                          />
                        </label>

                        <label className="d68-admin-field">
                          <span>Ảnh mobile riêng — không bắt buộc</span>
                          <small>
                            Khuyến nghị 900×1200px. Khi để trống, mobile
                            dùng ảnh desktop và điểm trọng tâm.
                          </small>
                          <input
                            name="mobile_file"
                            type="file"
                            accept="image/png,image/jpeg,image/webp"
                            className="d68-admin-input"
                          />
                        </label>

                        {row?.mobile_image_url ? (
                          <label className="d68-admin-check">
                            <input
                              name="remove_mobile"
                              type="checkbox"
                            />{' '}
                            Xóa ảnh mobile riêng và dùng lại ảnh desktop
                          </label>
                        ) : null}
                      </>
                    ) : (
                      <label className="d68-admin-field">
                        <span>
                          {row
                            ? 'Thay ảnh banner'
                            : 'Upload ảnh banner'}
                        </span>
                        <input
                          name="file"
                          type="file"
                          accept="image/png,image/jpeg,image/webp,image/gif"
                          className="d68-admin-input"
                          required={!row}
                        />
                      </label>
                    )}

                    <div className="d68-admin-actions">
                      <button
                        className="d68-admin-btn green"
                        disabled={!!busyKey}
                      >
                        {row ? 'Lưu / Thay ảnh' : 'Upload banner'}
                      </button>

                      {row ? (
                        <button
                          type="button"
                          className="d68-admin-btn red"
                          onClick={() => remove(row)}
                          disabled={!!busyKey}
                        >
                          Xóa
                        </button>
                      ) : null}
                    </div>
                  </div>
                </form>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function CardTitle({
  title,
  note,
}: {
  title: string;
  note: string;
}) {
  return (
    <div className="d68-admin-card">
      <h2>{title}</h2>
      <p>{note}</p>
    </div>
  );
}
