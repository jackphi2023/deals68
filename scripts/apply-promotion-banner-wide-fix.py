from pathlib import Path


def replace(path: str, old: str, new: str) -> None:
    target = Path(path)
    text = target.read_text()
    if old not in text:
        raise SystemExit(f"Expected source block not found in {path}")
    target.write_text(text.replace(old, new))


replace(
    "src/lib/bannerImagePipeline.ts",
    "  label: string;\n};",
    "  label: string;\n  acceptedRatioMin?: number;\n  acceptedRatioMax?: number;\n};",
)
replace(
    "src/lib/bannerImagePipeline.ts",
    "  return {\n    targetRatio: 32 / 11,\n    ratioTolerance: 0.3,\n    minWidth: 1200,\n    minHeight: 400,\n    maxWidth: 1920,\n    maxHeight: 660,\n    label: 'Promotion 1600×550',\n  };",
    "  return {\n    targetRatio: 9 / 2,\n    ratioTolerance: 0.2,\n    acceptedRatioMin: 3.6,\n    acceptedRatioMax: 5.4,\n    minWidth: 1200,\n    minHeight: 220,\n    maxWidth: 1920,\n    maxHeight: 480,\n    label: 'Promotion siêu ngang 4:1–5:1',\n  };",
)
replace(
    "src/lib/bannerImagePipeline.ts",
    "  const ratioDelta = Math.abs(ratio - rules.targetRatio) / rules.targetRatio;\n  if (ratioDelta > rules.ratioTolerance) {\n    warnings.push(`Tỷ lệ ${width}×${height} khác ${rules.label}; hãy kiểm tra vùng crop trong preview.`);\n  }",
    "  const ratioDelta = Math.abs(ratio - rules.targetRatio) / rules.targetRatio;\n  const ratioOutsideAcceptedRange =\n    rules.acceptedRatioMin !== undefined &&\n    rules.acceptedRatioMax !== undefined\n      ? ratio < rules.acceptedRatioMin || ratio > rules.acceptedRatioMax\n      : ratioDelta > rules.ratioTolerance;\n  if (ratioOutsideAcceptedRange) {\n    warnings.push(\n      `Tỷ lệ ${width}×${height} (${ratio.toFixed(2)}:1) nằm ngoài ${rules.label}; ảnh vẫn được giữ nguyên tỷ lệ và hiển thị toàn bộ.`,\n    );\n  }",
)

admin_path = Path("src/pages/AdminBanners.tsx")
admin = admin_path.read_text()
old_note = "note: 'Khuyến nghị 1600×550px. Ảnh lớn được tự thu nhỏ và chuyển WebP khi có lợi.',"
new_note = "note: 'Chấp nhận banner siêu ngang khoảng 4:1–5:1, ví dụ 1600×400 hoặc 1600×320. Ảnh lớn được tự resize, giữ nguyên tỷ lệ và chuyển WebP khi có lợi.',"
if admin.count(old_note) != 2:
    raise SystemExit("Expected two Promotion note blocks in AdminBanners.tsx")
admin_path.write_text(admin.replace(old_note, new_note))
replace(
    "src/pages/AdminBanners.tsx",
    "        <span>{formatBannerBytes(meta.bytes)} → {formatBannerBytes(meta.outputBytes)}</span>\n        <span>{meta.optimized ? 'Đã tối ưu WebP' : 'Giữ file gốc'}</span>",
    "        <span>{formatBannerBytes(meta.bytes)} → {formatBannerBytes(meta.outputBytes)}</span>\n        <span>Tỷ lệ {meta.ratio.toFixed(2)}:1</span>\n        <span>{meta.optimized ? 'Đã tối ưu WebP' : 'Giữ file gốc'}</span>",
)
replace(
    "src/pages/AdminBanners.tsx",
    "<figcaption>Preview responsive · cover</figcaption>",
    "<figcaption>Preview toàn ảnh · không crop</figcaption>",
)
replace(
    "src/pages/AdminBanners.tsx",
    "<small>{isHero ? 'Khuyến nghị 1600×600px.' : 'Ảnh được kiểm tra tỷ lệ và tối ưu trước upload.'}</small>",
    "<small>{isHero ? 'Khuyến nghị 1600×600px.' : 'Chấp nhận tỷ lệ khoảng 4:1–5:1. Ảnh được resize giữ nguyên tỷ lệ và tối ưu trước upload.'}</small>",
)
replace(
    "src/pages/AdminBanners.tsx",
    "<div><h1>Quản trị Banner</h1><p>Kiểm tra tỷ lệ, tối ưu WebP, cache dài hạn và preview đúng crop trước khi lưu.</p></div>",
    "<div><h1>Quản trị Banner</h1><p>Kiểm tra tỷ lệ, tối ưu WebP, cache dài hạn; Promotion preview toàn ảnh và không crop.</p></div>",
)

site_path = Path("src/components/SiteBanners.tsx")
site = site_path.read_text()
site = site.replace(
    "       'Banner dưới box vai trò tại trang chủ. Upload 1-2 ảnh, ' +\n       'khuyến nghị 1600×550px.',",
    "       'Banner dưới box vai trò tại trang chủ. Upload 1-2 ảnh, ' +\n       'chấp nhận tỷ lệ khoảng 4:1–5:1; khuyến nghị rộng từ 1600px.',",
)
site = site.replace(
    "       'Banner dưới danh sách Business/Investor. Upload 1-2 ảnh, ' +\n       'khuyến nghị 1600×550px.',",
    "       'Banner dưới danh sách Business/Investor. Upload 1-2 ảnh, ' +\n       'chấp nhận tỷ lệ khoảng 4:1–5:1; khuyến nghị rộng từ 1600px.',",
)
if site.count("    size: '1600×550px',") != 2:
    raise SystemExit("Expected two legacy Promotion size labels")
site = site.replace("    size: '1600×550px',", "    size: 'Tỷ lệ 4:1–5:1 · rộng từ 1600px',")
site = site.replace("  550,\n);\n\nconst HERO_FALLBACK_ROW", "  360,\n);\n\nconst HERO_FALLBACK_ROW")
site_path.write_text(site)

Path("src/styles/pages/admin-banners-performance.css").write_text("""/* Admin Banner image report and Promotion preview. */
.d68-admin-banners-page .d68-banner-image-report {
  margin: -2px 0 16px;
  padding: 12px 14px;
  border: 1px solid #DCE8F0;
  border-radius: 12px;
  background: #F8FBFD;
  color: #334155;
}

.d68-admin-banners-page .d68-banner-image-report > div {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.d68-admin-banners-page .d68-banner-image-report b { color: #0F2A4A; }
.d68-admin-banners-page .d68-banner-image-report span {
  font-size: 12px;
  font-weight: 700;
  color: #64748B;
}
.d68-admin-banners-page .d68-banner-image-report p {
  margin: 8px 0 0;
  color: #9A6700;
  font-size: 12.5px;
  line-height: 1.5;
}

.d68-admin-banners-page .d68-banner-live-preview--promotion {
  width: 100%;
  margin: 0 0 18px;
  overflow: hidden;
  border: 1px solid #DCE8F0;
  border-radius: 14px;
  background: transparent;
  position: relative;
  line-height: 0;
}

.d68-admin-banners-page .d68-banner-live-preview--promotion img {
  width: 100%;
  height: auto;
  display: block;
  object-fit: contain;
  object-position: center;
}

.d68-admin-banners-page .d68-banner-live-preview--promotion figcaption {
  position: absolute;
  left: 10px;
  top: 10px;
  z-index: 1;
  padding: 5px 8px;
  border-radius: 7px;
  background: rgba(15,42,74,.76);
  color: #fff;
  font-size: 11px;
  font-weight: 800;
  line-height: 1.2;
}

.d68-admin-banners-page input[type=file]:disabled,
.d68-admin-banners-page button:disabled {
  cursor: not-allowed;
  opacity: .58;
}

@media (max-width: 700px) {
  .d68-admin-banners-page .d68-banner-image-report > div {
    align-items: flex-start;
    flex-direction: column;
    gap: 4px;
  }
}
""")

Path("src/styles/components/promotion-banner.css").write_text("""/* Shared Promotion Banner owner: Homepage and listing pages. */
.d68-promo-banner {
  width: 100%;
  max-width: 100%;
  margin-block: 0;
  padding-block: 0;
  background: transparent;
  border: 0;
  box-shadow: none;
}

.d68-promo-banner__link {
  display: block;
  width: 100%;
  overflow: hidden;
  border-radius: 18px;
  background: transparent;
  line-height: 0;
}

.d68-promo-banner__link img {
  display: block;
  width: 100%;
  max-width: 100%;
  height: auto;
  aspect-ratio: auto;
  object-fit: contain;
  object-position: center;
  background: transparent;
}

.d68-home-page > .d68-promo-banner.d68-home-block {
  margin-block: 0;
  padding-block: 0;
}
""")

foundation_path = Path("src/styles/final/release-foundation.css")
foundation = foundation_path.read_text()
for line in (
    ".d68-promo-banner.d68-home-container{padding-top:50px!important;padding-bottom:50px!important}\n",
    ".d68-promo-banner__link{display:block;width:100%;overflow:hidden;border-radius:18px}\n",
    ".d68-promo-banner__link img{display:block;width:100%;height:auto}\n",
):
    if line not in foundation:
        raise SystemExit(f"Legacy Promotion rule missing: {line.strip()}")
    foundation = foundation.replace(line, "")
foundation_path.write_text(foundation)

index_path = Path("src/styles/index.css")
index = index_path.read_text()
anchor = "@import './pages/home-layout.css' layer(d68-overrides);\n"
if "./components/promotion-banner.css" not in index:
    if anchor not in index:
        raise SystemExit("CSS import anchor not found")
    index = index.replace(anchor, anchor + "@import './components/promotion-banner.css' layer(d68-overrides);\n")
index_path.write_text(index)
