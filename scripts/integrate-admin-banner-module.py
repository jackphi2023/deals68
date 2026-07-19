from pathlib import Path


def require(text: str, needle: str, label: str) -> None:
    if needle not in text:
        raise SystemExit(f"Missing {label}")


# Move the enhanced Banner editor into the shared Admin module directory.
source_path = Path("src/pages/AdminBanners.tsx")
source = source_path.read_text()
source = source.replace("import { Link, Navigate } from 'react-router-dom';\n", "")
source = source.replace("import { useAuth } from '../contexts/AuthContext';\n", "")
source = source.replace("from '../lib/supabase';", "from '../../lib/supabase';")
source = source.replace("} from '../lib/banners';", "} from '../../lib/banners';")
source = source.replace("} from '../lib/bannerImagePipeline';", "} from '../../lib/bannerImagePipeline';")
source = source.replace("} from '../components/HeroBannerMedia';", "} from '../HeroBannerMedia';")

old_start = "export default function AdminBanners() {\n  const { profile, loading } = useAuth();"
new_start = "export default function AdminBannerManager({\n  refreshKey = '',\n}: {\n  refreshKey?: string;\n}) {"
require(source, old_start, "AdminBanners component start")
source = source.replace(old_start, new_start)

old_effect = """  useEffect(() => {
    if (profile?.role === 'admin') load().catch((loadError) => setError(loadError?.message || 'Không tải được banner.'));
  }, [profile?.role]);"""
new_effect = """  useEffect(() => {
    load().catch((loadError) =>
      setError(loadError?.message || 'Không tải được banner.'),
    );
  }, [refreshKey]);"""
require(source, old_effect, "AdminBanners load effect")
source = source.replace(old_effect, new_effect)

old_guards = """  if (loading) return <main className="d68-admin-page"><div className="d68-admin-wrap"><div className="d68-admin-card">Loading admin...</div></div></main>;
  if (profile?.role !== 'admin') return <Navigate to="/login?next=/admin/banners" replace />;

"""
require(source, old_guards, "standalone AdminBanners guards")
source = source.replace(old_guards, "")

old_return = """  return (
    <main className="d68-admin-page d68-admin-banners-page">
      <div className="d68-admin-wrap">
        <div className="d68-admin-row-head d68-admin-banners-head">
          <div><h1>Quản trị Banner</h1><p>Kiểm tra tỷ lệ, tối ưu WebP, cache dài hạn; Promotion preview toàn ảnh và không crop.</p></div>
          <Link to="/admin" className="d68-admin-btn light">← Admin</Link>
        </div>
        {message ? <div className="d68-admin-notice ok">{message}</div> : null}
        {error ? <div className="d68-admin-notice err">{error}</div> : null}
        {PLACEMENTS.map((placement) => (
          <section key={placement.id} className="d68-admin-card d68-banner-admin__section">
            <h2>{placement.label}</h2><p className="d68-admin-subtle">{placement.note}</p>
            <div className="d68-banner-slot-grid">
              {Array.from({ length: placement.slots }).map((_, index) => {
                const slot = index + 1;
                const row = slotRow(rows, placement.id, slot);
                return <BannerEditor key={`${placement.id}-${slot}-${row?.id || 'new'}-${row?.updated_at || ''}`} row={row} placement={placement.id} slot={slot} busy={!!busyKey} onSave={save} onDelete={remove} />;
              })}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}"""
new_return = """  return (
    <div className="d68-admin-banners-module">
      <div className="d68-admin-card d68-admin-banners-head">
        <h2>Quản trị Banner</h2>
        <p>
          Quản lý Hero, Promotion và cover mặc định trong cùng hệ thống Admin.
          Promotion hỗ trợ ảnh siêu ngang, tối ưu WebP và hiển thị toàn ảnh không crop.
        </p>
      </div>
      {message ? <div className="d68-admin-notice ok">{message}</div> : null}
      {error ? <div className="d68-admin-notice err">{error}</div> : null}
      {PLACEMENTS.map((placement) => (
        <section key={placement.id} className="d68-admin-card d68-banner-admin__section">
          <h2>{placement.label}</h2><p className="d68-admin-subtle">{placement.note}</p>
          <div className="d68-banner-slot-grid">
            {Array.from({ length: placement.slots }).map((_, index) => {
              const slot = index + 1;
              const row = slotRow(rows, placement.id, slot);
              return <BannerEditor key={`${placement.id}-${slot}-${row?.id || 'new'}-${row?.updated_at || ''}`} row={row} placement={placement.id} slot={slot} busy={!!busyKey} onSave={save} onDelete={remove} />;
            })}
          </div>
        </section>
      ))}
    </div>
  );
}"""
require(source, old_return, "standalone AdminBanners return")
source = source.replace(old_return, new_return)

module_path = Path("src/components/admin/AdminBannerManager.tsx")
module_path.write_text(source)
source_path.unlink()

# Route all Banner aliases through the single Admin shell.
app_path = Path("src/App.tsx")
app = app_path.read_text()
app = app.replace("const AdminBanners = lazy(() => import('./pages/AdminBanners'));\n", "")
app = app.replace('<Route path="/admin/banners" element={<AdminBanners/>}/>', '<Route path="/admin/banners" element={<Admin/>}/>')
app = app.replace('<Route path="/admin/banner" element={<AdminBanners/>}/>', '<Route path="/admin/banner" element={<Admin/>}/>')
require(app, '<Route path="/admin/banners" element={<Admin/>}/>', "Admin Banner route")
if "AdminBanners" in app:
    raise SystemExit("Standalone AdminBanners reference remains in App.tsx")
app_path.write_text(app)

# Render the enhanced module from Admin.tsx; remove the legacy manager import.
admin_path = Path("src/pages/Admin.tsx")
admin = admin_path.read_text()
old_import = "import { AdminBannerManager } from '../components/SiteBanners';"
new_import = "import AdminBannerManager from '../components/admin/AdminBannerManager';"
require(admin, old_import, "legacy Admin Banner import")
admin = admin.replace(old_import, new_import)
admin = admin.replace(
    "{tab === 'banners' && <AdminBannerManager />}",
    "{tab === 'banners' && (\n              <AdminBannerManager refreshKey={lastRefreshedAt} />\n            )}",
)
require(admin, "<AdminBannerManager refreshKey={lastRefreshedAt} />", "Admin Banner module render")
admin_path.write_text(admin)

# SiteBanners becomes public-only; remove the obsolete second Admin implementation.
site_path = Path("src/components/SiteBanners.tsx")
site = site_path.read_text()
marker = "\nfunction dateIn(days: number) {"
require(site, marker, "legacy Admin Banner manager marker")
site = site.split(marker, 1)[0].rstrip() + "\n"
site = site.replace(
    "import {\n  type CSSProperties,\n  type FormEvent,\n  type ReactNode,\n  useEffect,\n  useState,\n} from 'react';",
    "import { type ReactNode, useEffect, useState } from 'react';",
)
site = site.replace(
    "  listSiteBanners,\n  uploadSiteBannerImage,\n  type BannerPlacement,\n  type SiteBanner,",
    "  listSiteBanners,\n  type SiteBanner,",
)
site = site.replace(
    "import HeroBannerMedia, {\n  heroFocusPosition,\n} from './HeroBannerMedia';",
    "import HeroBannerMedia from './HeroBannerMedia';",
)
for forbidden in ("AdminBannerManager", "uploadSiteBannerImage", "BannerPlacement", "CSSProperties", "FormEvent"):
    if forbidden in site:
        raise SystemExit(f"Legacy public SiteBanners dependency remains: {forbidden}")
site_path.write_text(site)

# Module-scoped styles: no standalone page background, wrapper or route padding.
responsive_path = Path("src/styles/pages/admin-banners-responsive.css")
responsive = responsive_path.read_text()
responsive = responsive.replace(".d68-admin-banners-page", ".d68-admin-banners-module")
responsive = responsive.replace(
    ".d68-admin-banners-module{background:#f7fafc;min-height:100vh;padding:32px 0 64px}",
    ".d68-admin-banners-module{display:flex;flex-direction:column;gap:20px;min-width:0}",
)
responsive = responsive.replace(
    "@media(max-width:700px){.d68-admin-banners-module{padding-top:18px}",
    "@media(max-width:700px){",
)
responsive_path.write_text(responsive)

performance_path = Path("src/styles/pages/admin-banners-performance.css")
performance = performance_path.read_text().replace(
    ".d68-admin-banners-page",
    ".d68-admin-banners-module",
)
performance_path.write_text(performance)

# Architecture contracts.
checks = {
    "module exists": module_path.exists(),
    "standalone page removed": not source_path.exists(),
    "App routes use Admin": app.count('path="/admin/banner') == 2 and "AdminBanners" not in app,
    "Admin uses enhanced module": "components/admin/AdminBannerManager" in admin,
    "public SiteBanners is public-only": "AdminBannerManager" not in site,
    "module CSS scope": ".d68-admin-banners-page" not in responsive and ".d68-admin-banners-page" not in performance,
}
failed = [name for name, ok in checks.items() if not ok]
if failed:
    raise SystemExit("Admin Banner integration failed: " + ", ".join(failed))
