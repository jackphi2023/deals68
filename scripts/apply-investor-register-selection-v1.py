from pathlib import Path
import re


def read(path: str) -> str:
    return Path(path).read_text(encoding='utf-8')


def write(path: str, content: str) -> None:
    Path(path).write_text(content, encoding='utf-8')


def replace_once(content: str, old: str, new: str, label: str) -> str:
    count = content.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 match, found {count}')
    return content.replace(old, new, 1)


path = 'src/pages/Register.tsx'
text = read(path)

text = replace_once(
    text,
    "  const [investorPackageSelected, setInvestorPackageSelected] =\n    useState<boolean>(\n      () => checkoutIntentMatchesRole && normalized === 'investor',\n    );\n",
    '',
    'remove explicit investor package selection state',
)
text = replace_once(
    text,
    "  const [investorTypes, setInvestorTypes] = useState<string[]>([\n    'Individual/Angel',\n  ]);\n  const [selectedIndustries, setSelectedIndustries] = useState<string[]>([\n    'food_beverage',\n    'it_software',\n  ]);\n  const [investorStages, setInvestorStages] = useState<string[]>(['Growth']);\n  const [investorDealTypes, setInvestorDealTypes] = useState<string[]>([\n    'Investment',\n  ]);",
    "  const [investorTypes, setInvestorTypes] = useState<string[]>([]);\n  const [selectedIndustries, setSelectedIndustries] = useState<string[]>([]);\n  const [investorStages, setInvestorStages] = useState<string[]>([]);\n  const [investorDealTypes, setInvestorDealTypes] = useState<string[]>([]);",
    'clear investor criteria defaults',
)
text = replace_once(
    text,
    "  const [ticketMin, setTicketMin] = useState(\n    formatNumberTyping('100000'),\n  );\n  const [ticketMax, setTicketMax] = useState(\n    formatNumberTyping('5000000'),\n  );",
    "  const [ticketMin, setTicketMin] = useState('');\n  const [ticketMax, setTicketMax] = useState('');",
    'clear investor ticket defaults',
)
text = replace_once(
    text,
    "    : isInvestor\n      ? investorPackageSelected && Boolean(investorMonths)\n      : true;",
    "    : isInvestor\n      ? Boolean(investorMonths)\n      : true;",
    'implicit investor package selection',
)
text = replace_once(
    text,
    "      if (!investorPackageSelected) {\n        missing.push(T(lang, 'Gói dịch vụ', 'Service package'));\n      }\n      if (!investorMonths) {\n        missing.push(T(lang, 'Kỳ hạn', 'Term'));\n      } else if (investorPackageSelected && !paymentAck) {",
    "      if (!investorMonths) {\n        missing.push(T(lang, 'Kỳ hạn', 'Term'));\n      } else if (!paymentAck) {",
    'investor validation only requires term and payment confirmation',
)

text = replace_once(
    text,
    "      <h2>{T(lang, 'Gói dịch vụ và Thanh toán', 'Service package and Payment')}</h2>\n      <div className=\"d68-bizreg-options\">",
    "      <h2>{T(lang, 'Gói dịch vụ và Thanh toán', 'Service package and Payment')}</h2>\n      {isInvestor ? (\n        <p className=\"d68-bizreg-section-help\">\n          {T(lang, 'Vui lòng chọn thời gian sử dụng.', 'Please select the service duration.')}\n        </p>\n      ) : null}\n      <div className=\"d68-bizreg-options\">",
    'investor service duration help',
)

options_pattern = re.compile(
    r'''      <div className="d68-bizreg-options">\n        \{isBusiness \? \(\n(?P<body>.*?)        \) : \(\n          <>\n.*?          </>\n        \)\}\n      </div>\n''',
    re.S,
)
match = options_pattern.search(text)
if not match:
    raise SystemExit('investor package cards block not found')
business_body = match.group('body')
replacement = (
    '      {isBusiness ? (\n'
    '        <div className="d68-bizreg-options">\n'
    f'{business_body}'
    '        </div>\n'
    '      ) : null}\n'
)
text = text[:match.start()] + replacement + text[match.end():]

text = replace_once(
    text,
    "  const qrUrl = `https://img.vietqr.io/image/VCB-0011004000713-compact2.png?${qrAmountParam}addInfo=${encodeURIComponent(\n    bankContent,\n  )}&accountName=${encodeURIComponent('Tieu Vo Dinh Phi')}`;",
    "  const qrUrl = hasSelectedPackage\n    ? `https://img.vietqr.io/image/VCB-0011004000713-compact2.png?${qrAmountParam}addInfo=${encodeURIComponent(\n        bankContent,\n      )}&accountName=${encodeURIComponent('Tieu Vo Dinh Phi')}`\n    : STATIC_VIETQR_URL;",
    'hide QR amount and transfer note before term selection',
)
text = replace_once(
    text,
    "      {hasSelectedPackage ? (\n        <div className=\"d68-bizreg-qrbox\">",
    "      {isInvestor || hasSelectedPackage ? (\n        <div className=\"d68-bizreg-qrbox\">",
    'always show investor QR box',
)
text = replace_once(
    text,
    "            <p>{T(lang, 'Nội dung:', 'Transfer note:')} <b>{bankContent}</b></p>\n            <p>{T(lang, 'Số tiền:', 'Amount:')} <b>{money(price.total, price.currency)}</b></p>",
    "            {hasSelectedPackage ? (\n              <>\n                <p>{T(lang, 'Nội dung:', 'Transfer note:')} <b>{bankContent}</b></p>\n                <p>{T(lang, 'Số tiền:', 'Amount:')} <b>{money(price.total, price.currency)}</b></p>\n              </>\n            ) : null}",
    'conditionally display transfer note and amount',
)
ack_block = '''          <label>
            <input
              type="checkbox"
              checked={paymentAck}
              onChange={(event) => setPaymentAck(event.target.checked)}
            />{' '}
            {T(
              lang,
              'Tôi đã chuyển khoản đúng số tiền và nội dung ở trên',
              'I have transferred the exact amount with the transfer note above',
            )}
          </label>'''
text = replace_once(
    text,
    ack_block,
    "          {hasSelectedPackage ? (\n" + ack_block.replace('\n', '\n  ') + "\n          ) : null}",
    'hide payment acknowledgement before term selection',
)

if 'investorPackageSelected' in text or 'setInvestorPackageSelected' in text:
    raise SystemExit('legacy investor package selection references remain')

write(path, text)

css_path = 'src/styles/pages/auth.css'
css = read(css_path)
help_css = '''

/* Investor registration: membership is implicit; user selects only the service duration. */
.d68-register-page .d68-bizreg-section-help {
  color: #64748b;
  font-size: 14px;
  line-height: 1.55;
  margin: -8px 0 16px;
}
'''
if '.d68-bizreg-section-help' not in css:
    css += help_css
write(css_path, css)

register = read(path)
assertions = [
    ('ticket minimum blank', "const [ticketMin, setTicketMin] = useState('');" in register),
    ('ticket maximum blank', "const [ticketMax, setTicketMax] = useState('');" in register),
    ('investor types blank', 'const [investorTypes, setInvestorTypes] = useState<string[]>([]);' in register),
    ('stages blank', 'const [investorStages, setInvestorStages] = useState<string[]>([]);' in register),
    ('deal types blank', 'const [investorDealTypes, setInvestorDealTypes] = useState<string[]>([]);' in register),
    ('industries blank', 'const [selectedIndustries, setSelectedIndustries] = useState<string[]>([]);' in register),
    ('Vietnam market active', "const [preferredCountries, setPreferredCountries] = useState<string[]>([\n    'VN',\n  ]);" in register),
    ('package cards removed', 'Gói Nhà đầu tư' not in register and 'Gói Tổ chức / Ưu tiên' not in register),
    ('duration help shown', 'Vui lòng chọn thời gian sử dụng.' in register),
    ('QR box always shown for investor', '{isInvestor || hasSelectedPackage ? (' in register),
    ('transfer fields conditional', "{hasSelectedPackage ? (\n              <>\n                <p>{T(lang, 'Nội dung:'" in register),
    ('no package validation', "missing.push(T(lang, 'Gói dịch vụ', 'Service package'));" in register),
]
# The remaining package validation belongs to Business registration only.
failed = [name for name, ok in assertions if not ok]
if failed:
    raise SystemExit('Investor registration contract assertions failed: ' + ', '.join(failed))
