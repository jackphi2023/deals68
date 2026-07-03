import fs from 'node:fs';
const text = fs.readFileSync('src/config/screenRegistry.ts','utf8');
const count = (text.match(/"path":/g) || []).length;
console.log(`Deals68 configured route screens: ${count}`);
if (count < 40) process.exit(1);
