import fs from 'node:fs';

const path = 'src/pages/Register.tsx';
let source = fs.readFileSync(path, 'utf8');

const industryState = "const [industry, setIndustry] = useState('');";
if (!source.includes(industryState)) {
  throw new Error('Business industry must start empty so no category is preselected.');
}

const categoryPlaceholder = `<option value="" disabled>\n                        {T(lang, 'Chọn danh mục', 'Select category')}\n                      </option>`;
if (!source.includes(categoryPlaceholder)) {
  throw new Error('Business category placeholder contract was not found.');
}

const oldCatch = `      setMsg(\n        submitError?.message ||\n          T(\n            lang,\n            'Tài khoản đã tạo, nhưng hồ sơ/đơn thanh toán cần Admin kiểm tra lại.',\n            'Account created, but profile/payment order needs Admin review.',\n          ),\n      );`;
const newCatch = `      setMsg(\n        registrationErrorMessage(\n          lang,\n          submitError?.message ||\n            T(\n              lang,\n              'Tài khoản đã tạo, nhưng hồ sơ/đơn thanh toán cần Admin kiểm tra lại.',\n              'Account created, but profile/payment order needs Admin review.',\n            ),\n          submitError?.code,\n        ),\n      );`;

if (!source.includes(oldCatch)) {
  throw new Error('Expected registration catch block was not found.');
}
source = source.replace(oldCatch, newCatch);

fs.writeFileSync(path, source);
console.log('Applied Business Register category and localized email error contract.');
