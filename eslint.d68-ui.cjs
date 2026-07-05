/**
 * Deals68 — ESLint flat-config bổ sung cho quy chuẩn UI.
 * Mục tiêu: chặn inline style trong JSX (nguồn gây xung đột/lệch UI),
 * ngoại trừ đúng 1 trường hợp hợp lệ: truyền CSS variable động --d68-*.
 *
 * Cách nối vào eslint.config.js hiện có:
 *   const d68ui = require('./eslint.d68-ui.cjs');
 *   module.exports = [ ...cấu hình cũ, ...d68ui ];
 *
 * Nếu chưa có ESLint, đây vẫn là "luật thành văn" để review PR bằng mắt.
 */
module.exports = [
  {
    files: ['src/**/*.tsx'],
    rules: {
      // Cấm style={{...}} — trừ khi CHỈ set biến CSS động (--d68-*).
      'no-restricted-syntax': [
        'warn',
        {
          selector:
            "JSXAttribute[name.name='style'][value.expression.type='ObjectExpression']:not(:has(Property[key.value=/^--d68-/]))",
          message:
            'Không dùng inline style. Đưa style vào src/styles/pages/<page>.css bằng class d68-*. ' +
            'Ngoại lệ duy nhất: truyền biến động qua style={{ ["--d68-dyn"]: value }}.'
        }
      ]
    }
  }
];
