import fs from 'node:fs';

const file = 'src/pages/Register.tsx';
let source = fs.readFileSync(file, 'utf8');

function replaceOnce(search, replacement, label) {
  const count = source.split(search).length - 1;
  if (count !== 1) {
    throw new Error(`${label}: expected exactly one match, found ${count}`);
  }
  source = source.replace(search, replacement);
}

replaceOnce(
  `function safeUsername(email: string, name: string) {\n  return (email.split('@')[0] || slugify(name))\n    .toLowerCase()\n    .replace(/[^a-z0-9._-]/g, '')\n    .slice(0, 42);\n}\n`,
  `function safeUsername(email: string, name: string) {\n  return (email.split('@')[0] || slugify(name))\n    .toLowerCase()\n    .replace(/[^a-z0-9._-]/g, '')\n    .slice(0, 42);\n}\n\nfunction isValidEmail(value: string) {\n  return /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(value.trim());\n}\n\nfunction registrationErrorMessage(\n  lang: Lang,\n  rawError?: string,\n  errorCode?: string,\n) {\n  const raw = String(rawError || '').trim();\n  const normalized = (String(errorCode || '') + ' ' + raw).toLowerCase();\n  const isEmailError =\n    normalized.includes('email_address_invalid') ||\n    normalized.includes('invalid email') ||\n    normalized.includes('email address is invalid') ||\n    normalized.includes('user_already_exists') ||\n    normalized.includes('user already registered') ||\n    normalized.includes('already been registered') ||\n    normalized.includes('already registered') ||\n    normalized.includes('email already') ||\n    normalized.includes('email exists') ||\n    (normalized.includes('duplicate key') && normalized.includes('email'));\n\n  if (isEmailError) {\n    return T(\n      lang,\n      'Email không hợp lệ/đã đăng ký.',\n      'Invalid email or already registered.',\n    );\n  }\n\n  return raw || T(lang, 'Không thể tạo tài khoản', 'Could not create account');\n}\n`,
  'email helpers',
);

replaceOnce(
  `  const [industry, setIndustry] = useState('Thực phẩm & Đồ uống (F&B)');`,
  `  const [industry, setIndustry] = useState('');`,
  'business industry default',
);

replaceOnce(
  `    const missing: string[] = [];\n\n    if (!email.trim()) missing.push(T(lang, 'Email đăng nhập', 'Login email'));`,
  `    const missing: string[] = [];\n    const normalizedEmail = email.trim();\n\n    if (!isValidEmail(normalizedEmail)) {\n      setMsgType('err');\n      setMsg(\n        T(\n          lang,\n          'Email không hợp lệ/đã đăng ký.',\n          'Invalid email or already registered.',\n        ),\n      );\n      return;\n    }`,
  'custom email validation',
);

replaceOnce(
  `    if (signupResult.error || !signupResult.user) {\n      setMsgType('err');\n      setMsg(\n        signupResult.error ||\n          T(lang, 'Không thể tạo tài khoản', 'Could not create account'),\n      );`,
  `    if (\n      signupResult.error ||\n      !signupResult.user ||\n      signupResult.user.identities?.length === 0\n    ) {\n      setMsgType('err');\n      setMsg(\n        signupResult.user?.identities?.length === 0\n          ? T(\n              lang,\n              'Email không hợp lệ/đã đăng ký.',\n              'Invalid email or already registered.',\n            )\n          : registrationErrorMessage(\n              lang,\n              signupResult.error,\n              signupResult.code,\n            ),\n      );`,
  'signup email error normalization',
);

replaceOnce(
  `        <form onSubmit={submit} className="d68-register-form">`,
  `        <form noValidate onSubmit={submit} className="d68-register-form">`,
  'disable native browser validation',
);

replaceOnce(
  `                    <select\n                      value={industry}\n                      onChange={(event) => setIndustry(event.target.value)}\n                    >\n                      {industryOptions.map((item) => (`,
  `                    <select\n                      value={industry}\n                      onChange={(event) => setIndustry(event.target.value)}\n                    >\n                      <option value="" disabled>\n                        {T(lang, 'Chọn danh mục', 'Select category')}\n                      </option>\n                      {industryOptions.map((item) => (`,
  'business industry placeholder',
);

fs.writeFileSync(file, source);
console.log('Register Business category/email fix applied.');
