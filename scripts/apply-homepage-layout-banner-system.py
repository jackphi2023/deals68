from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 match, found {count}')
    return text.replace(old, new, 1)


# 1) Give every non-hero homepage section one explicit layout contract.
home_path = Path('src/pages/Home.tsx')
home = home_path.read_text(encoding='utf-8')
for old, new, label in [
    ('className="d68-home-container d68-home-section d68-home-investor-band"', 'className="d68-home-container d68-home-block d68-home-investor-band"', 'featured investor block'),
    ('className="d68-home-container d68-home-section d68-home-section--roles"', 'className="d68-home-container d68-home-block d68-home-section--roles"', 'roles block'),
    ('className="d68-home-container" />', 'className="d68-home-container d68-home-block" />', 'promotion block'),
    ('<section className="d68-home-container d68-home-section">', '<section className="d68-home-container d68-home-block d68-home-deals-section">', 'featured deals block'),
    ('<section className="d68-home-industries">', '<section className="d68-home-block d68-home-industries">', 'industries block'),
    ('<section className="d68-home-valuation">', '<section className="d68-home-block d68-home-valuation">', 'valuation block'),
    ('<section className="d68-home-how">', '<section className="d68-home-block d68-home-how">', 'how block'),
]:
    home = replace_once(home, old, new, label)
home_path.write_text(home, encoding='utf-8')

# 2) Remove legacy outer spacing from component CSS. home-layout.css is the owner.
home_css_path = Path('src/styles/pages/home.css')
home_css = home_css_path.read_text(encoding='utf-8')
for old, label in [
    ('.d68-home-section{padding:64px 0}.d68-home-section--roles{padding-top:26px;padding-bottom:72px}', 'legacy section padding'),
    ('.d68-home-industries{max-width:1200px;margin:0 auto;padding:72px 24px}', 'legacy industries geometry'),
    ('.d68-home-valuation{padding:8px 24px 72px}', 'legacy valuation geometry'),
    ('.d68-home-section{padding:48px 0}', 'legacy mobile section padding'),
]:
    home_css = replace_once(home_css, old, '', label)
home_css_path.write_text(home_css, encoding='utf-8')

# 3) Remove route geometry overrides from the generic UI-fixes file.
ui_path = Path('src/styles/pages/ui-fixes.css')
ui = ui_path.read_text(encoding='utf-8')
ui = replace_once(
    ui,
    '.d68-home-industries{max-width:none;margin:0;background:#F7FAFC;border-top:1px solid #E7EDF3;border-bottom:1px solid #E7EDF3;padding:72px 0}\n',
    '',
    'ui industries outer rule',
)
ui = replace_once(
    ui,
    '.d68-home-industries .d68-home-container{max-width:1200px;margin:0 auto;padding:0 24px}\n',
    '',
    'ui industries container rule',
)
ui = replace_once(
    ui,
    '.d68-home-container.d68-home-section:has(.d68-home-investor-grid){padding-top:66px;padding-bottom:72px}\n',
    '',
    'ui investor section padding',
)
ui = replace_once(
    ui,
    '@media(max-width:620px){.d68-home-industries{padding:54px 0}.d68-home-industry-grid,.d68-home-investor-grid{grid-template-columns:1fr}.d68-home-container.d68-home-section:has(.d68-home-investor-grid){padding-top:52px;padding-bottom:56px}.d68-home-industry-card{min-height:0}}',
    '@media(max-width:620px){.d68-home-industry-grid,.d68-home-investor-grid{grid-template-columns:1fr}.d68-home-industry-card{min-height:0}}',
    'ui mobile homepage spacing',
)
ui_path.write_text(ui, encoding='utf-8')

# 4) Remove old release compatibility spacing rules now owned by home-layout.css.
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
release = replace_once(release, legacy_promo, '', 'release homepage spacing block')
legacy_mobile_investor = '''  .d68-home-investor-band{
    border-radius:0!important;
    padding:38px 16px 48px!important;
    margin-left:auto!important;
    margin-right:auto!important;
    width:100%!important;
  }
'''
release = replace_once(release, legacy_mobile_investor, '', 'release mobile investor spacing')
release_path.write_text(release, encoding='utf-8')

# 5) Make public banner date filtering null-safe and consistent with DB policy.
banners_path = Path('src/lib/banners.ts')
banners = banners_path.read_text(encoding='utf-8')
banners = replace_once(
    banners,
    "      .eq('active', true)\n      .lte('starts_at', today)\n      .or(`ends_at.is.null,ends_at.gte.${today}`);",
    "      .eq('active', true)\n      .or(`starts_at.is.null,starts_at.lte.${today}`)\n      .or(`ends_at.is.null,ends_at.gte.${today}`);",
    'null-safe public banner query',
)
banners = replace_once(
    banners,
    "  const filtered = ((data || []) as SiteBanner[]).filter(\n    (row) => admin || bannerMatchesLang(row, lang),\n  );",
    "  const filtered = ((data || []) as SiteBanner[]).filter((row) =>\n    admin\n      ? true\n      : bannerMatchesLang(row, lang) && bannerIsActive(row),\n  );",
    'public banner client guard',
)
banners_path.write_text(banners, encoding='utf-8')

# 6) Persist Admin active/inactive state immediately when the checkbox changes.
site_path = Path('src/components/SiteBanners.tsx')
site = site_path.read_text(encoding='utf-8')
insert_before = '  async function remove(row: SiteBanner) {'
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
site = replace_once(site, insert_before, helper + insert_before, 'banner active helper')
old_checkbox = '''                          <input
                            name="active"
                            type="checkbox"
                            defaultChecked={row?.active !== false}
                          />{' '}
                          Đang hiển thị'''
new_checkbox = '''                          <input
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
                            : 'Hiển thị sau khi upload'}'''
site = replace_once(site, old_checkbox, new_checkbox, 'banner active checkbox')
site_path.write_text(site, encoding='utf-8')

# Contract checks.
home = home_path.read_text(encoding='utf-8')
home_css = home_css_path.read_text(encoding='utf-8')
ui = ui_path.read_text(encoding='utf-8')
release = release_path.read_text(encoding='utf-8')
banners = banners_path.read_text(encoding='utf-8')
site = site_path.read_text(encoding='utf-8')
checks = {
    'seven semantic home blocks': home.count('d68-home-block') == 7,
    'legacy home section padding removed': '.d68-home-section{padding:' not in home_css,
    'legacy industries geometry removed': '.d68-home-industries{max-width:1200px' not in home_css,
    'legacy valuation geometry removed': '.d68-home-valuation{padding:' not in home_css,
    'ui :has spacing removed': ':has(.d68-home-investor-grid)' not in ui,
    'release promo spacing removed': 'Promotion banner spacing:' not in release,
    'release mobile investor padding removed': 'padding:38px 16px 48px' not in release,
    'nullable start date query': 'starts_at.is.null,starts_at.lte' in banners,
    'client active guard': 'bannerMatchesLang(row, lang) && bannerIsActive(row)' in banners,
    'admin status autosave': 'async function setBannerActive' in site and 'lưu trạng thái ngay' in site,
}
failed = [name for name, ok in checks.items() if not ok]
if failed:
    raise SystemExit('Homepage/banner assertions failed: ' + ', '.join(failed))
