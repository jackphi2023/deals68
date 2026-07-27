#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';

const login = fs.readFileSync('src/pages/Login.tsx', 'utf8');
const partnerLogin = fs.readFileSync('src/pages/MarketPartnerLogin.tsx', 'utf8');
const app = fs.readFileSync('src/App.tsx', 'utf8');

assert.match(login, /type LoginRole = 'business' \| 'investor' \| 'admin';/);
assert.match(login, /key: 'business'[\s\S]*key: 'investor'/);
assert.match(login, /Đăng nhập vào tài khoản Doanh nghiệp hoặc Nhà đầu tư\./);
assert.match(login, /Sign in to your Business or Investor account\./);
assert.doesNotMatch(login, /key: 'affiliate'/);
assert.doesNotMatch(login, /Đối tác thị trường/);
assert.doesNotMatch(login, /Market Partner/);
assert.doesNotMatch(login, /dashboard\/market-partner/);

assert.match(partnerLogin, /Đăng nhập Market Partner/);
assert.match(partnerLogin, /\/market-partner\/dashboard/);
assert.match(app, /path="\/market-partner\/login" element=\{<MarketPartnerLogin\/>\}/);

console.log('✓ Public Login role contract: PASS');
console.log('✓ Login shows only Business/Investor; Market Partner remains on its separate login route.');
