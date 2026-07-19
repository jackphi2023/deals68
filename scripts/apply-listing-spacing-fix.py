from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 match, found {count}')
    return text.replace(old, new, 1)


businesses_path = Path('src/pages/Businesses.tsx')
businesses = businesses_path.read_text(encoding='utf-8')
businesses = replace_once(
    businesses,
    "const resultRangeText = total !== null ? `${T(lang, 'Hiển thị', 'Showing')} ${resultStart}-${resultEnd}/${total} ${T(lang, 'hồ sơ', 'profiles')}` : `${T(lang, 'Hiển thị', 'Showing')} ${rows.length} ${T(lang, 'hồ sơ', 'profiles')}`;",
    "const resultRangeText = total !== null ? `${T(lang, 'Hiển thị', 'Showing')} ${resultStart}-${resultEnd}/${total} ${T(lang, 'doanh nghiệp', 'businesses')}` : `${T(lang, 'Hiển thị', 'Showing')} ${rows.length} ${T(lang, 'doanh nghiệp', 'businesses')}`;",
    'business result wording',
)
businesses = replace_once(
    businesses,
    '        <section>\n          <div className="d68-businesses-toolbar">',
    '        <section>\n          <div className="d68-businesses-results-content">\n          <div className="d68-businesses-toolbar">',
    'business results wrapper open',
)
businesses = replace_once(
    businesses,
    '          <PromotionBanner placement="listing_promotion" lang={lang} className="d68-listing-promo" />',
    '          </div>\n          <PromotionBanner placement="listing_promotion" lang={lang} className="d68-listing-promo" />',
    'business results wrapper close',
)
businesses_path.write_text(businesses, encoding='utf-8')

investors_path = Path('src/pages/Investors.tsx')
investors = investors_path.read_text(encoding='utf-8')
investors = replace_once(
    investors,
    '        <div className="d68-investors-results">\n          <div className="d68-investors-toolbar">',
    '        <div className="d68-investors-results">\n          <div className="d68-investors-results-content">\n          <div className="d68-investors-toolbar">',
    'investor results wrapper open',
)
investors = replace_once(
    investors,
    '          <PromotionBanner\n            placement="listing_promotion"',
    '          </div>\n          <PromotionBanner\n            placement="listing_promotion"',
    'investor results wrapper close',
)
investors_path.write_text(investors, encoding='utf-8')

business_css_path = Path('src/styles/pages/businesses.css')
business_css = business_css_path.read_text(encoding='utf-8')
business_rule = '''\n\n/* Keep the result list visually separate from the listing Promotion banner. */\n.d68-businesses-page .d68-businesses-results-content {\n  padding-bottom: 80px;\n}\n'''
if 'd68-businesses-results-content' in business_css:
    raise SystemExit('business spacing rule already exists')
business_css_path.write_text(business_css.rstrip() + business_rule, encoding='utf-8')

investor_css_path = Path('src/styles/pages/investors.css')
investor_css = investor_css_path.read_text(encoding='utf-8')
investor_rule = '''\n\n/* Keep the result list visually separate from the listing Promotion banner. */\n.d68-investors-page .d68-investors-results-content {\n  padding-bottom: 80px;\n}\n'''
if 'd68-investors-results-content' in investor_css:
    raise SystemExit('investor spacing rule already exists')
investor_css_path.write_text(investor_css.rstrip() + investor_rule, encoding='utf-8')
