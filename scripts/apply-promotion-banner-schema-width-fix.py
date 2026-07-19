from pathlib import Path


def replace_required(text: str, old: str, new: str, label: str, count: int = 1) -> str:
    found = text.count(old)
    if found != count:
        raise SystemExit(f'{label}: expected {count}, found {found}')
    return text.replace(old, new)


# Keep the shared banner contract aligned with the responsive Hero schema.
banners_path = Path('src/lib/banners.ts')
banners = banners_path.read_text(encoding='utf-8')
banners = replace_required(
    banners,
    "  focal_x?: number | null;\n  focal_y?: number | null;\n",
    "  focal_x?: number | null;\n  focal_y?: number | null;\n  mobile_focal_x?: number | null;\n  mobile_focal_y?: number | null;\n",
    'SiteBanner mobile focal fields',
)
banners_path.write_text(banners, encoding='utf-8')

# Promotion rows must not send Hero-only focal fields. Hero rows still persist
# independent mobile focal points now supported by the database migration.
manager_path = Path('src/components/admin/AdminBannerManager.tsx')
manager = manager_path.read_text(encoding='utf-8')
manager = replace_required(
    manager,
    "type BannerRow = SiteBanner & {\n  mobile_focal_x?: number | null;\n  mobile_focal_y?: number | null;\n};\n",
    "type BannerRow = SiteBanner;\n",
    'BannerRow shared type',
)
manager = replace_required(
    manager,
    "        focal_x: placement === 'home_hero' ? clampFocus(draft.desktopX) : 50,\n        focal_y: placement === 'home_hero' ? clampFocus(draft.desktopY) : 50,\n        mobile_focal_x: placement === 'home_hero' ? clampFocus(draft.mobileX) : 50,\n        mobile_focal_y: placement === 'home_hero' ? clampFocus(draft.mobileY) : 50,\n        link_url: clean(data.get('link_url')) || null,",
    "        focal_x: placement === 'home_hero' ? clampFocus(draft.desktopX) : 50,\n        focal_y: placement === 'home_hero' ? clampFocus(draft.desktopY) : 50,\n        ...(placement === 'home_hero'\n          ? {\n              mobile_focal_x: clampFocus(draft.mobileX),\n              mobile_focal_y: clampFocus(draft.mobileY),\n            }\n          : {}),\n        link_url: clean(data.get('link_url')) || null,",
    'Hero-only mobile focal payload',
)
manager_path.write_text(manager, encoding='utf-8')

# Shared Promotion CSS owns rendering only. The surrounding page/container owns
# available width: Homepage uses d68-home-container; listings use their result column.
css_path = Path('src/styles/components/promotion-banner.css')
css = css_path.read_text(encoding='utf-8')
outer_width_block = "  width: 100%;\n  max-width: 100%;\n  margin-block: 0;"
css = replace_required(
    css,
    outer_width_block,
    "  width: 100%;\n  margin-block: 0;",
    'remove global max-width override',
)
css = css.replace(
    '/* Shared Promotion Banner owner: Homepage and listing pages. */',
    '/* Shared Promotion Banner rendering owner. Page containers own width. */',
)
css_path.write_text(css, encoding='utf-8')

checks = {
    'shared mobile focal type': 'mobile_focal_x?: number | null;' in banners,
    'promotion excludes mobile focal': "...(placement === 'home_hero'" in manager,
    'no unconditional mobile focal': "mobile_focal_x: placement === 'home_hero'" not in manager,
    'outer banner no longer overrides container max width': outer_width_block not in css,
    'image max width retained': '.d68-promo-banner__link img' in css and 'max-width: 100%;' in css,
    'homepage keeps container class': 'd68-home-container d68-home-block' in Path('src/pages/Home.tsx').read_text(encoding='utf-8'),
}
failed = [name for name, ok in checks.items() if not ok]
if failed:
    raise SystemExit('Promotion banner assertions failed: ' + ', '.join(failed))
