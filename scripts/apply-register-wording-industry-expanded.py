from pathlib import Path

path = Path('src/pages/Register.tsx')
text = path.read_text(encoding='utf-8')

replacements = {
    "'Tài sản hữu hình & vô hình doanh nghiệp sở hữu (Không bắt buộc điền)'": "'Tài sản hữu hình & vô hình doanh nghiệp sở hữu'",
    "'Tangible and intangible assets owned by the business (Optional)'": "'Tangible and intangible assets owned by the business'",
    "'Mô tả giá trị của các tài sản hữu hình thuộc sở hữu của doanh nghiệp sẽ được đưa vào giao dịch (Không bắt buộc điền)'": "'Mô tả giá trị của các tài sản hữu hình thuộc sở hữu của doanh nghiệp sẽ được đưa vào giao dịch'",
    "'Description and value of tangible assets owned by the business that will be included in the transaction (Optional)'": "'Description and value of tangible assets owned by the business that will be included in the transaction'",
}

for old, new in replacements.items():
    if old not in text:
        raise SystemExit(f'Missing expected wording: {old}')
    text = text.replace(old, new, 1)

old_picker = '''                  <IndustryTagPicker
                    lang={lang}
                    values={selectedIndustries}
                    onChange={setSelectedIndustries}
                    expandVi="Mở rộng ngành"
                    expandEn="Expand industries"
                  />'''
new_picker = '''                  <IndustryTagPicker
                    lang={lang}
                    values={selectedIndustries}
                    onChange={setSelectedIndustries}
                    defaultExpanded
                    expandVi="Mở rộng ngành"
                    expandEn="Expand industries"
                  />'''

if old_picker not in text:
    raise SystemExit('Investor IndustryTagPicker block not found')
text = text.replace(old_picker, new_picker, 1)

path.write_text(text, encoding='utf-8')
