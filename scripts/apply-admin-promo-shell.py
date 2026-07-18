from pathlib import Path
import re


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 match, found {count}')
    return text.replace(old, new, 1)


admin_path = Path('src/pages/Admin.tsx')
admin = admin_path.read_text(encoding='utf-8')

admin = replace_once(
    admin,
    "import { AdminOperationsOverview } from '../components/admin/AdminOperationsOverview';\n",
    "import { AdminOperationsOverview } from '../components/admin/AdminOperationsOverview';\n"
    "import AdminPromoManager from '../components/admin/AdminPromoManager';\n"
    "import {\n"
    "  ADMIN_NAV_SECTIONS,\n"
    "  adminTabUsesGlobalSearch,\n"
    "  resolveAdminTab,\n"
    "  type AdminTab,\n"
    "} from '../config/adminNavigation';\n",
    'admin module imports',
)

admin = replace_once(
    admin,
    "type AdminTab =\n"
    "  | 'overview'\n"
    "  | 'payments'\n"
    "  | 'proposals'\n"
    "  | 'banners'\n"
    "  | 'businesses'\n"
    "  | 'business_review'\n"
    "  | 'assets'\n"
    "  | 'investors'\n"
    "  | 'promos'\n"
    "  | 'requests'\n"
    "  | 'leads'\n"
    "  | 'logs'\n"
    "  | 'settings';\n\n",
    '',
    'local admin tab type',
)

path_tabs_pattern = re.compile(
    r"const pathTabs: Record<string, AdminTab> = \{.*?\n\};\n\n",
    re.S,
)
admin, path_count = path_tabs_pattern.subn('', admin, count=1)
if path_count != 1:
    raise SystemExit(f'local pathTabs: expected 1 match, found {path_count}')

tabs_pattern = re.compile(
    r"const tabs: \{ id: AdminTab; label: string; icon: string; href: string \}\[\] = \[.*?\n\];\n\n",
    re.S,
)
admin, tabs_count = tabs_pattern.subn('', admin, count=1)
if tabs_count != 1:
    raise SystemExit(f'local tabs: expected 1 match, found {tabs_count}')

resolve_pattern = re.compile(
    r"function resolveTab\(pathname: string\): AdminTab \{.*?\n\}\n\n",
    re.S,
)
admin, resolve_count = resolve_pattern.subn('', admin, count=1)
if resolve_count != 1:
    raise SystemExit(f'local resolveTab: expected 1 match, found {resolve_count}')

admin = admin.replace('resolveTab(location.pathname)', 'resolveAdminTab(location.pathname)')
if 'resolveTab(' in admin:
    raise SystemExit('unmigrated resolveTab reference remains')

create_promo_pattern = re.compile(
    r"\n  async function createPromo\(event: FormEvent\) \{.*?\n  \}\n\n  async function markLead\(",
    re.S,
)
admin, create_count = create_promo_pattern.subn('\n  async function markLead(', admin, count=1)
if create_count != 1:
    raise SystemExit(f'inline createPromo: expected 1 match, found {create_count}')

old_nav = '''            {tabs.map((item) => {
              const queueCount = navQueueCounts[item.id] || 0;
              return (
                <Link
                  key={item.id}
                  to={item.href}
                  onClick={() => setTab(item.id)}
                  className={`d68-admin-nav-link ${tab === item.id ? 'active' : ''}`}
                >
                  <span>{item.icon} {item.label}</span>
                  {queueCount ? <b className="d68-admin-nav-count">{queueCount}</b> : null}
                </Link>
              );
            })}'''
new_nav = '''            {ADMIN_NAV_SECTIONS.map((section) => (
              <section key={section.id} className="d68-admin-nav-section">
                <span className="d68-admin-nav-section__label">{section.label}</span>
                {section.items.map((item) => {
                  const queueCount = navQueueCounts[item.id] || 0;
                  return (
                    <Link
                      key={item.id}
                      to={item.href}
                      onClick={() => setTab(item.id)}
                      className={`d68-admin-nav-link ${tab === item.id ? 'active' : ''}`}
                    >
                      <span>{item.icon} {item.label}</span>
                      {queueCount ? <b className="d68-admin-nav-count">{queueCount}</b> : null}
                    </Link>
                  );
                })}
              </section>
            ))}'''
admin = replace_once(admin, old_nav, new_nav, 'grouped admin navigation')

old_search = '''            <input
              className="d68-admin-input d68-admin-search"
              value={search}
              onChange={(event) => updateSearch(event.target.value)}
              placeholder="Search businesses/investors/profiles..."
            />'''
new_search = '''            {adminTabUsesGlobalSearch(tab) ? (
              <input
                className="d68-admin-input d68-admin-search"
                value={search}
                onChange={(event) => updateSearch(event.target.value)}
                placeholder="Tìm doanh nghiệp, nhà đầu tư hoặc hồ sơ..."
              />
            ) : null}'''
admin = replace_once(admin, old_search, new_search, 'tab-scoped admin search')

admin = replace_once(
    admin,
    "            {tab === 'promos' && <Promos promos={promos} createPromo={createPromo} />}\n",
    "            {tab === 'promos' && (\n"
    "              <AdminPromoManager\n"
    "                promos={promos}\n"
    "                adminId={profile.id}\n"
    "                busy={busy}\n"
    "                onReload={load}\n"
    "                setMessage={setMsg}\n"
    "                setError={setError}\n"
    "              />\n"
    "            )}\n",
    'promo manager render',
)

promos_pattern = re.compile(
    r"\nfunction Promos\(\{ promos, createPromo \}: any\) \{.*?\n\}\n\nfunction Requests\(",
    re.S,
)
admin, promos_count = promos_pattern.subn('\nfunction Requests(', admin, count=1)
if promos_count != 1:
    raise SystemExit(f'legacy Promos component: expected 1 match, found {promos_count}')

admin_path.write_text(admin, encoding='utf-8')

app_path = Path('src/App.tsx')
app = app_path.read_text(encoding='utf-8')
app = replace_once(
    app,
    "const AdminPromos = lazy(() => import('./pages/AdminPromos'));\n",
    '',
    'AdminPromos lazy import',
)
app = replace_once(
    app,
    '        <Route path="/admin/promo" element={<AdminPromos/>}/>\n'
    '        <Route path="/admin/promos" element={<AdminPromos/>}/>\n',
    '        <Route path="/admin/promo" element={<Admin/>}/>\n'
    '        <Route path="/admin/promos" element={<Admin/>}/>\n',
    'promo routes into admin shell',
)
app_path.write_text(app, encoding='utf-8')

legacy_page = Path('src/pages/AdminPromos.tsx')
if not legacy_page.exists():
    raise SystemExit('legacy AdminPromos page not found')
legacy_page.unlink()

admin_css_path = Path('src/styles/pages/admin.css')
admin_css = admin_css_path.read_text(encoding='utf-8')
nav_css = '''

/* Config-driven Admin navigation. Groups scale without changing the shell. */
.d68-admin-nav-section{display:flex;flex-direction:column;gap:2px;padding:4px 0 8px}
.d68-admin-nav-section+.d68-admin-nav-section{border-top:1px solid #EEF2F6;padding-top:12px}
.d68-admin-nav-section__label{padding:0 12px 5px;color:#94A3B8;font-size:10.5px;font-weight:900;letter-spacing:.55px;text-transform:uppercase}
.d68-admin-nav-link{display:flex!important;align-items:center;justify-content:space-between;gap:10px;min-width:0}
.d68-admin-nav-link>span{min-width:0}
.d68-admin-nav-count{display:inline-flex;align-items:center;justify-content:center;min-width:22px;height:22px;padding:0 6px;border-radius:999px;background:#FEF3D3;color:#92400E;font-size:11px;font-weight:900}
.d68-admin-nav-link.active .d68-admin-nav-count{background:#fff;color:#0F2A4A}
'''
if '/* Config-driven Admin navigation.' in admin_css:
    raise SystemExit('admin navigation styles already present')
admin_css_path.write_text(admin_css.rstrip() + nav_css + '\n', encoding='utf-8')

promo_css_path = Path('src/styles/pages/admin-promos.css')
promo_css = promo_css_path.read_text(encoding='utf-8')
promo_css = replace_once(
    promo_css,
    '.d68-admin-promos-page .d68-admin-wrap{max-width:1240px}\n',
    '.d68-admin-promo-manager{display:flex;flex-direction:column;gap:18px}\n',
    'promo module root',
)
promo_css = replace_once(
    promo_css,
    '.d68-admin-promo-toolbar h1{margin:8px 0 6px;font-size:32px;color:#0F2A4A}\n',
    '.d68-admin-promo-toolbar h2{margin:0 0 6px;font-size:26px;color:#0F2A4A}\n',
    'promo title style',
)
promo_css = promo_css.replace('.d68-admin-promo-back{color:#1596cc;font-weight:800;text-decoration:none}\n', '')
status_css = '''
.d68-admin-promo-card__status-actions{display:flex;align-items:center;justify-content:flex-end;gap:8px;flex-wrap:wrap}
.d68-admin-promo-card__status-actions .d68-admin-btn{white-space:nowrap}
'''
if '.d68-admin-promo-card__status-actions' not in promo_css:
    promo_css = promo_css.rstrip() + status_css
promo_css = promo_css.replace(
    '  .d68-admin-promo-card__head{flex-direction:column}\n',
    '  .d68-admin-promo-card__head{flex-direction:column}\n'
    '  .d68-admin-promo-card__status-actions{width:100%;justify-content:space-between}\n',
)
promo_css_path.write_text(promo_css.rstrip() + '\n', encoding='utf-8')

# Architecture and route contracts.
admin = admin_path.read_text(encoding='utf-8')
app = app_path.read_text(encoding='utf-8')
checks = {
    'central navigation imported': 'ADMIN_NAV_SECTIONS' in admin,
    'promo module imported': 'AdminPromoManager' in admin,
    'promo module rendered': "tab === 'promos'" in admin and '<AdminPromoManager' in admin,
    'legacy inline promo removed': 'function Promos(' not in admin and 'async function createPromo' not in admin,
    'global search scoped': 'adminTabUsesGlobalSearch(tab)' in admin,
    'promo routes use shell': app.count('path="/admin/promo" element={<Admin/>}') == 1 and app.count('path="/admin/promos" element={<Admin/>}') == 1,
    'standalone promo import removed': 'AdminPromos' not in app,
    'standalone page deleted': not legacy_page.exists(),
}
failed = [name for name, ok in checks.items() if not ok]
if failed:
    raise SystemExit('Admin promo shell assertions failed: ' + ', '.join(failed))
