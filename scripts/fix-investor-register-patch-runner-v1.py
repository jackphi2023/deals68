from pathlib import Path

path = Path('scripts/apply-investor-register-selection-v1.py')
text = path.read_text(encoding='utf-8')
old = '''replacement = (
    '      {isBusiness ? (\\n'
    '        <div className="d68-bizreg-options">\\n'
    f'{business_body}'
    '        </div>\\n'
    '      ) : null}\\n'
)'''
new = '''replacement = (
    '      {isBusiness ? (\\n'
    '        <div className="d68-bizreg-options">\\n'
    '          {\\n'
    f'{business_body}'
    '          }\\n'
    '        </div>\\n'
    '      ) : null}\\n'
)'''
if text.count(old) != 1:
    raise SystemExit('Could not patch package JSX expression')
path.write_text(text.replace(old, new, 1), encoding='utf-8')
