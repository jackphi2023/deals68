import fs from 'node:fs';
import assert from 'node:assert/strict';

const authCss = fs.readFileSync('src/styles/pages/auth.css', 'utf8');
const staticCss = fs.readFileSync('src/styles/pages/static.css', 'utf8');
const staticPages = fs.readFileSync('src/pages/StaticPages.tsx', 'utf8');

assert.match(authCss, /\.d68-register-page \.d68-auth-submit\{[\s\S]*min-height:50px/);
assert.match(authCss, /\.d68-register-page \.d68-auth-submit\{[\s\S]*font-size:18px/);

assert.match(staticPages, /Hân hạnh được hợp tác và đồng hành/);
assert.match(staticPages, /Honoured to collaborate and grow together/);
assert.doesNotMatch(staticPages, /cta="Xem doanh nghiệp"/);

assert.match(staticCss, /\.d68-static-cta--partnership\{[\s\S]*background:#0F2A4A/);
assert.match(staticCss, /\.d68-static-cta--partnership p\{[\s\S]*color:#F2B51D/);
assert.match(staticCss, /\.d68-static-cta--partnership p\{[\s\S]*font-size:20px/);
assert.match(staticCss, /\.d68-static-cta--partnership p\{[\s\S]*text-align:center/);

console.log('✓ G10 static QA: PASS');
