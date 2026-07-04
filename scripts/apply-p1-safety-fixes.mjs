// Optional one-time safety patch for files not fully replaced by this bundle.
// It removes autoEnglishFromVietnamese write-paths and duplicate public_code defaults.
import fs from 'node:fs';

const replacements = [
  {
    file: 'src/pages/Register.tsx',
    edits: [
      [/import \{ autoEnglishFromVietnamese \} from '\.\.\/lib\/i18n';\n/g, ''],
      [/public_code:\s*'D68-NEW',\s*/g, ''],
      [/title_en:\s*autoEnglishFromVietnamese\(titleVi\)/g, 'title_en: titleVi'],
      [/highlights_en:\s*autoEnglishFromVietnamese\(highlights\)/g, "highlights_en: ''"],
      [/investment_reason_en:\s*autoEnglishFromVietnamese\(reason\)/g, "investment_reason_en: ''"],
      [/desc_en:\s*autoEnglishFromVietnamese\(desc\)/g, "desc_en: ''"]
    ]
  },
  {
    file: 'src/pages/BusinessDashboard.tsx',
    edits: [
      [/import \{ autoEnglishFromVietnamese \} from '\.\.\/lib\/i18n';\n/g, ''],
      [/title_en:\s*autoEnglishFromVietnamese\(String\(fd\.get\('title_vi'\) \|\| ''\)\)/g, "title_en: fd.get('title_en') || b.title_en || ''"],
      [/description_en:\s*autoEnglishFromVietnamese\(String\(fd\.get\('description_vi'\) \|\| ''\)\)/g, "description_en: fd.get('description_en') || b.description_en || ''"],
      [/highlights_en:\s*autoEnglishFromVietnamese\(String\(fd\.get\('highlights_vi'\) \|\| ''\)\)/g, "highlights_en: fd.get('highlights_en') || b.highlights_en || ''"],
      [/investment_reason_en:\s*autoEnglishFromVietnamese\(String\(fd\.get\('investment_reason_vi'\) \|\| ''\)\)/g, "investment_reason_en: fd.get('investment_reason_en') || b.investment_reason_en || ''"]
    ]
  },
  {
    file: 'src/pages/Admin.tsx',
    edits: [
      [/import \{ autoEnglishFromVietnamese \} from '\.\.\/lib\/i18n';\n/g, ''],
      [/title_en:\s*autoEnglishFromVietnamese\(String\(fd\.get\('title_vi'\)\|\|''\)\)/g, "title_en: fd.get('title_en') || b.title_en || ''"]
    ]
  }
];

for (const { file, edits } of replacements) {
  if (!fs.existsSync(file)) { console.warn('missing', file); continue; }
  let s = fs.readFileSync(file, 'utf8');
  const before = s;
  for (const [pattern, value] of edits) s = s.replace(pattern, value);
  if (s !== before) { fs.writeFileSync(file, s); console.log('patched', file); }
  else console.log('no changes', file);
}
