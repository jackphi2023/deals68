from pathlib import Path


def replace_once(path: Path, old: str, new: str) -> None:
    text = path.read_text(encoding='utf-8')
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{path}: expected one match, found {count}')
    path.write_text(text.replace(old, new, 1), encoding='utf-8')


valuation = Path('src/pages/Valuation.tsx')
replace_once(
    valuation,
    "  valuationMethodLabel,\n  valuationAssetMessages,\n  VALUATION_DISCLAIMER_EN,",
    "  valuationMethodLabel,\n  VALUATION_DISCLAIMER_EN,",
)
replace_once(
    valuation,
    "  const assetMessages = valuationAssetMessages(lang, result);\n",
    "",
)
replace_once(
    valuation,
    """                  <small>
                    {T(
                      lang,
                      'Tùy chọn. Nhập giá trị thị trường ước tính của đất, tòa nhà, máy móc, nhà máy, khách sạn, quyền sử dụng đất hoặc tài sản vận hành chính; không dùng giá trị sổ sách.',
                      'Optional. Enter the estimated market value of land, buildings, machinery, factory, hotel, land-use rights or key operating assets; do not use book value.',
                    )}
                  </small>
""",
    "",
)
replace_once(
    valuation,
    """                  {assetMessages.map((message) => (
                    <p key={message} className="d68-val-asset-note">{message}</p>
                  ))}
""",
    "",
)

register = Path('src/pages/Register.tsx')
replace_once(
    register,
    """                  {benchmarkResult ? <ul className="d68-valuation-asset-notes">{valuationAssetMessages(lang, benchmarkResult).map((note) => <li key={note}>{note}</li>)}</ul> : null}
""",
    """                  {benchmarkResult ? (
                    <ul className="d68-valuation-asset-notes">
                      {valuationAssetMessages(lang, benchmarkResult)
                        .filter(
                          (note) =>
                            note !==
                            T(
                              lang,
                              'Hệ thống đang trộn giá trị vận hành và giá trị tài sản theo trọng số ngành.',
                              'The estimate blends operating value and asset value using the industry weighting.',
                            ),
                        )
                        .map((note) => <li key={note}>{note}</li>)}
                    </ul>
                  ) : null}
""",
)

dashboard = Path('src/pages/BusinessDashboard.tsx')
replace_once(
    dashboard,
    'valuationVerdictMessage, valuationMethodLabel, valuationAssetMessages, VALUATION_DISCLAIMER_VI',
    'valuationVerdictMessage, valuationMethodLabel, VALUATION_DISCLAIMER_VI',
)
replace_once(
    dashboard,
    """  const currency = result?.currency || 'VND';
  const assetCurrency = result?.assetCurrency || currency;
  const hasKeyAsset = result?.keyAssetValueInput !== null &&
    result?.keyAssetValueInput !== undefined &&
    Number(result.keyAssetValueInput) > 0;
  const hasNetDebt = !!result?.netDebtProvided;
  const assetMessages = valuationAssetMessages(lang, result);
""",
    """  const currency = result?.currency || 'VND';
""",
)
replace_once(
    dashboard,
    """    {hasKeyAsset ? <div>
      <span>{T(lang, 'Giá trị tài sản chính', 'Key asset value')}</span>
      <strong>{formatValuationMoney(result.keyAssetValueInput, assetCurrency, lang)}</strong>
      <small>{T(lang, 'Số liệu đã nhập tại bước tạo tài khoản; Dashboard hiện chỉ hiển thị.', 'Value entered during registration; the Dashboard is currently read-only.')}</small>
    </div> : null}
    {hasNetDebt ? <div>
      <span>{T(lang, 'Giá trị nợ ròng', 'Net debt')}</span>
      <strong>{Number(result.netDebtInput) === 0 ? (assetCurrency === 'USD' ? 'US$0' : '0 VNĐ') : formatValuationMoney(result.netDebtInput, assetCurrency, lang)}</strong>
      <small>{T(lang, 'Nợ vay trừ tiền mặt và tương đương tiền.', 'Interest-bearing debt minus cash and cash equivalents.')}</small>
    </div> : null}
    <p>{assetMessages.length ? `${assetMessages.join(' ')} ` : ''}{T(lang, VALUATION_DISCLAIMER_VI, VALUATION_DISCLAIMER_EN)}</p>
""",
    """    <p>{T(lang, VALUATION_DISCLAIMER_VI, VALUATION_DISCLAIMER_EN)}</p>
""",
)

auth_css = Path('src/styles/pages/auth.css')
auth_text = auth_css.read_text(encoding='utf-8')
auth_rule = "\n\n/* Registration success message: compact borderless confirmation. */\n.d68-register-page .d68-auth-msg.ok{border:0;padding:10px}\n"
if '.d68-register-page .d68-auth-msg.ok{border:0;padding:10px}' not in auth_text:
    auth_css.write_text(auth_text.rstrip() + auth_rule, encoding='utf-8')
else:
    raise SystemExit('auth.css: success-message override already exists')

dashboard_css = Path('src/styles/pages/dashboard.css')
dashboard_css_text = dashboard_css.read_text(encoding='utf-8')
dashboard_rule = "\n\n/* Keep the three valuation overview values compact on every viewport. */\n.d68-dashboard-valuation-box--engine>div strong{font-size:16px;line-height:1.35;letter-spacing:0}\n"
if '.d68-dashboard-valuation-box--engine>div strong{font-size:16px;line-height:1.35;letter-spacing:0}' not in dashboard_css_text:
    dashboard_css.write_text(dashboard_css_text.rstrip() + dashboard_rule, encoding='utf-8')
else:
    raise SystemExit('dashboard.css: valuation typography override already exists')

qa = Path('scripts/deals68-asset-valuation-v1-check.mjs')
replace_once(
    qa,
    "  ['dashboard is read-only for asset values', dashboard.includes(\"'Giá trị tài sản chính'\") && dashboard.includes(\"'Giá trị nợ ròng'\") && !dashboard.includes('name=\"key_asset_value\"') && !dashboard.includes('name=\"net_debt\"')],",
    "  ['dashboard keeps private asset inputs out of overview UI', dashboard.includes('valuationInputFromBusiness') && !dashboard.includes(\"'Giá trị tài sản chính'\") && !dashboard.includes(\"'Giá trị nợ ròng'\") && !dashboard.includes('name=\"key_asset_value\"') && !dashboard.includes('name=\"net_debt\"')],",
)

print('Applied valuation UI cleanup successfully.')
