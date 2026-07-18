from pathlib import Path


def replace_required(text: str, old: str, new: str, label: str, minimum: int = 1) -> str:
    count = text.count(old)
    if count < minimum:
        raise SystemExit(f'{label}: expected at least {minimum}, found {count}')
    return text.replace(old, new)


# Semantic direct-child blocks: the parent flex gap is the only external spacing.
home_path = Path('src/pages/Home.tsx')
home = home_path.read_text(encoding='utf-8')
for old, new, label in [
    ('className="d68-home-container d68-home-section d68-home-investor-band"', 'className="d68-home-container d68-home-block d68-home-investor-band"', 'featured investor block'),
    ('className="d68-home-container d68-home-section d68-home-section--roles"', 'className="d68-home-container d68-home-block d68-home-section--roles"', 'roles block'),
    ('<PromotionBanner placement="home_promotion" lang={lang} className="d68-home-container" />', '<PromotionBanner placement="home_promotion" lang={lang} className="d68-home-container d68-home-block" />', 'promotion block'),
    ('<section className="d68-home-container d68-home-section">', '<section className="d68-home-container d68-home-block d68-home-deals-section">', 'featured deals block'),
    ('<section className="d68-home-industries">', '<section className="d68-home-block d68-home-industries">', 'industries block'),
    ('<section className="d68-home-valuation">', '<section className="d68-home-block d68-home-valuation">', 'valuation block'),
    ('<section className="d68-home-how">', '<section className="d68-home-block d68-home-how">', 'how block'),
]:
    home = replace_required(home, old, new, label)
home_path.write_text(home, encoding='utf-8')

# Remove outer layout geometry from the visual/component stylesheet.
home_css_path = Path('src/styles/pages/home.css')
home_css = home_css_path.read_text(encoding='utf-8')
for old, label in [
    ('.d68-home-section{padding:64px 0}.d68-home-section--roles{padding-top:26px;padding-bottom:72px}', 'legacy section padding'),
    ('.d68-home-industries{max-width:1200px;margin:0 auto;padding:72px 24px}', 'legacy industries geometry'),
    ('.d68-home-valuation{padding:8px 24px 72px}', 'legacy valuation geometry'),
    ('.d68-home-section{padding:48px 0}', 'legacy mobile section padding'),
    ('.d68-home-page{\n  background:#fff;\n}\n\n', 'legacy homepage canvas'),
    ('.d68-home-page .d68-home-container.d68-home-investor-band{\n  background:#fff!important;\n}\n', 'legacy investor background'),
    ('''  .d68-home-page .d68-home-container.d68-home-investor-band{
    width:100%!important;
    max-width:100%!important;
    margin-left:auto!important;
    margin-right:auto!important;
    padding-left:16px!important;
    padding-right:16px!important;
  }
''', 'legacy mobile investor geometry'),
]:
    home_css = replace_required(home_css, old, '', label)
home_css_path.write_text(home_css, encoding='utf-8')

# Generic UI fixes must not own homepage section geometry. Keep card typography and
# responsive grids, but point selectors at semantic classes instead of :has().
ui_path = Path('src/styles/pages/ui-fixes.css')
ui = ui_path.read_text(encoding='utf-8')
ui = replace_required(
    ui,
    '.d68-home-container.d68-home-section:has(.d68-home-investor-grid)',
    '.d68-home-investor-band',
    'semantic investor selectors',
    minimum=2,
)
for old, label in [
    ('.d68-home-industries{max-width:none;margin:0;background:#F7FAFC;border-top:1px solid #E7EDF3;border-bottom:1px solid #E7EDF3;padding:72px 0}\n', 'industries outer v1'),
    ('.d68-home-industries .d68-home-container{max-width:1200px;margin:0 auto;padding:0 24px}\n', 'industries container override'),
    ('.d68-home-investor-band{padding-top:66px;padding-bottom:72px}\n', 'investor outer v1'),
    ('.d68-home-industries{background:#fff!important;padding:68px 0 58px!important;border:0!important}\n', 'industries outer v2'),
    ('.d68-home-investor-band{padding-top:62px!important;padding-bottom:64px!important;background:#fff!important}\n', 'investor outer v2'),
    ('.d68-promo-banner.d68-home-container{padding-top:50px!important;padding-bottom:50px!important}\n', 'promotion outer spacing'),
    ('.d68-home-investor-band{background:transparent!important}\n', 'investor compatibility background'),
    ('.d68-home-industries{padding:54px 0}', 'industries mobile outer v1'),
    ('.d68-home-investor-band{padding-top:52px;padding-bottom:56px}', 'investor mobile outer v1'),
    ('.d68-home-industries{padding:52px 0 44px!important}', 'industries mobile outer v2'),
    ('.d68-home-investor-band{padding-top:50px!important;padding-bottom:52px!important}', 'investor mobile outer v2'),
]:
    ui = replace_required(ui, old, '', label)
ui_path.write_text(ui, encoding='utf-8')

# Frozen release compatibility no longer owns homepage spacing.
release_path = Path('src/styles/final/release-foundation.css')
release = release_path.read_text(encoding='utf-8')
legacy_promo = '''/* Promotion banner spacing: reduce large white gaps above/below homepage banner. */
.d68-promo-banner.d68-home-container{
  padding-top:50px!important;
  padding-bottom:50px!important;
  margin-top:0!important;
  margin-bottom:0!important;
}
.d68-home-section--roles{
  padding-bottom:50px!important;
}
.d68-promo-banner.d68-home-container + .d68-home-section,
.d68-promo-banner.d68-home-container + .d68-home-container{
  padding-top:50px!important;
}
@media(max-width:700px){
  .d68-promo-banner.d68-home-container{
    padding-top:36px!important;
    padding-bottom:36px!important;
  }
  .d68-home-section--roles{
    padding-bottom:36px!important;
  }
  .d68-promo-banner.d68-home-container + .d68-home-section,
  .d68-promo-banner.d68-home-container + .d68-home-container{
    padding-top:36px!important;
  }
}

'''
release = replace_required(release, legacy_promo, '', 'release promotion spacing block')
release = replace_required(
    release,
    '''  .d68-home-investor-band{
    border-radius:0!important;
    padding:38px 16px 48px!important;
    margin-left:auto!important;
    margin-right:auto!important;
    width:100%!important;
  }
''',
    '',
    'release mobile investor geometry',
)
release_path.write_text(release, encoding='utf-8')

# Public banner query: nullable bounds are valid, and client filtering mirrors RLS.
banners_path = Path('src/lib/banners.ts')
banners = banners_path.read_text(encoding='utf-8')
banners = replace_required(
    banners,
    "      .eq('active', true)\n      .lte('starts_at', today)\n      .or(`ends_at.is.null,ends_at.gte.${today}`);",
    "      .eq('active', true)\n      .or(`starts_at.is.null,starts_at.lte.${today}`)\n      .or(`ends_at.is.null,ends_at.gte.${today}`);",
    'null-safe public banner query',
)
banners = replace_required(
    banners,
    "  const filtered = ((data || []) as SiteBanner[]).filter(\n    (row) => admin || bannerMatchesLang(row, lang),\n  );",
    "  const filtered = ((data || []) as SiteBanner[]).filter((row) =>\n    admin\n      ? true\n      : bannerMatchesLang(row, lang) && bannerIsActive(row),\n  );",
    'public banner client guard',
)
banners_path.write_text(banners, encoding='utf-8')

# Admin status checkbox is now an actual action, not unsaved form state.
site_path = Path('src/components/SiteBanners.tsx')
site = site_path.read_text(encoding='utf-8')
helper = '''  async function setBannerActive(
    row: SiteBanner,
    active: boolean,
  ) {
    const key = `status-${row.id}`;
    setBusyKey(key);
    setError('');
    setMessage('');

    try {
      const updatedAt = new Date().toISOString();
      const updateResult = await supabase
        .from('site_banners')
        .update({ active, updated_at: updatedAt })
        .eq('id', row.id)
        .select('id')
        .single();

      if (updateResult.error) throw updateResult.error;

      if (active) {
        const duplicateResult = await supabase
          .from('site_banners')
          .update({ active: false, updated_at: updatedAt })
          .eq('placement', row.placement)
          .eq('sort_order', row.sort_order)
          .neq('id', row.id)
          .eq('active', true);

        if (duplicateResult.error) throw duplicateResult.error;
      }

      setMessage(
        active
          ? `Đã bật hiển thị ${row.title || 'banner'}.`
          : `Đã tắt hiển thị ${row.title || 'banner'}.`,
      );
      await load();
    } catch (statusError: any) {
      setError(
        statusError?.message || 'Không cập nhật được trạng thái banner.',
      );
      await load();
    } finally {
      setBusyKey('');
    }
  }

'''
site = replace_required(site, '  async function remove(row: SiteBanner) {', helper + '  async function remove(row: SiteBanner) {', 'banner active helper')
site = replace_required(
    site,
    '''                          <input
                            name="active"
                            type="checkbox"
                            defaultChecked={row?.active !== false}
                          />{' '}
                          Đang hiển thị''',
    '''                          <input
                            name="active"
                            type="checkbox"
                            defaultChecked={row?.active !== false}
                            disabled={!!busyKey}
                            onChange={(event) => {
                              if (row) {
                                void setBannerActive(
                                  row,
                                  event.currentTarget.checked,
                                );
                              }
                            }}
                          />{' '}
                          {row
                            ? 'Đang hiển thị · lưu trạng thái ngay'
                            : 'Hiển thị sau khi upload'}''',
    'banner active checkbox',
)
site_path.write_text(site, encoding='utf-8')

# Contracts.
home = home_path.read_text(encoding='utf-8')
home_css = home_css_path.read_text(encoding='utf-8')
ui = ui_path.read_text(encoding='utf-8')
release = release_path.read_text(encoding='utf-8')
banners = banners_path.read_text(encoding='utf-8')
site = site_path.read_text(encoding='utf-8')
checks = {
    'seven direct home blocks': home.count('d68-home-block') == 7,
    'no legacy section padding': '.d68-home-section{padding:' not in home_css,
    'no legacy industry geometry': '.d68-home-industries{max-width:1200px' not in home_css,
    'no legacy valuation geometry': '.d68-home-valuation{padding:' not in home_css,
    'no :has investor selectors': ':has(.d68-home-investor-grid)' not in ui,
    'no UI promotion padding': 'd68-promo-banner.d68-home-container{padding-top' not in ui,
    'no release promotion spacing': 'Promotion banner spacing:' not in release,
    'nullable public start date': 'starts_at.is.null,starts_at.lte' in banners,
    'client active guard': 'bannerMatchesLang(row, lang) && bannerIsActive(row)' in banners,
    'admin status autosave': 'async function setBannerActive' in site and 'lưu trạng thái ngay' in site,
}
failed = [name for name, ok in checks.items() if not ok]
if failed:
    raise SystemExit('Homepage/banner assertions failed: ' + ', '.join(failed))
