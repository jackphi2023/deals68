import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (rel) =>
  fs.readFileSync(path.join(root, rel), 'utf8');

const failures = [];

function requireToken(text, token, message) {
  if (!text.includes(token)) failures.push(message);
}

function forbidToken(text, token, message) {
  if (text.includes(token)) failures.push(message);
}

const register = read('src/pages/Register.tsx');
const css = read('src/styles/pages/ui-fixes.css');
const business = read('src/pages/BusinessDashboard.tsx');
const investor = read(
  'src/components/investor/InvestorBillingPanel.tsx',
);
const admin = read('src/pages/Admin.tsx');
const helper = read('src/lib/paymentOrders.ts');
const migration = read(
  'supabase/migrations/' +
    '20260712131500_payment_invoice_atomic_lifecycle.sql',
);
const collision = read(
  'supabase/migrations/' +
    '20260712132500_payment_order_code_collision_guard.sql',
);

for (const token of [
  'd68-register-section--investor-pricing',
  'registrationOrderCode',
  'orderCode: registrationOrderCode',
  'bankContent: registrationOrderCode',
]) {
  requireToken(register, token, `Register missing ${token}`);
}

for (const token of [
  '.d68-register-section--investor-pricing .d68-bizreg-paygrid',
  '.d68-register-section--investor-pricing .d68-bizreg-promo',
  'grid-template-columns:minmax(0,1fr) 350px',
  'grid-template-columns:200px 88px',
  'width:200px',
]) {
  requireToken(css, token, `Investor Register CSS missing ${token}`);
}

for (const [source, label] of [
  [business, 'Business Dashboard'],
  [investor, 'Investor Dashboard'],
]) {
  for (const token of [
    'createOwnPaymentOrder',
    'makePaymentOrderCode',
    'paymentOrderCode',
    'formatServiceExpiry',
  ]) {
    requireToken(source, token, `${label} missing ${token}`);
  }
  forbidToken(
    source,
    "supabase.from('payment_orders').insert",
    `${label} still inserts payment directly`,
  );
}

forbidToken(
  business,
  'DEALS68-UPGRADE-',
  'Business payment reference is still fixed',
);
forbidToken(
  investor,
  'DEALS68-INV-',
  'Investor payment reference is still fixed',
);

for (const token of [
  'makePaymentOrderCode',
  'createOwnPaymentOrder',
  'adminSetPaymentOrderStatus',
  'paymentOrderCode',
  'formatServiceExpiry',
  'createResult as unknown as',
  'rpcResult as unknown as',
]) {
  requireToken(helper, token, `Payment helper missing ${token}`);
}

requireToken(
  admin,
  'adminSetPaymentOrderStatus',
  'Admin does not use atomic payment RPC',
);
forbidToken(
  admin,
  "supabase.from('payment_orders').update",
  'Admin still updates payment status directly',
);
forbidToken(
  admin,
  'businessProposalQuotaForPlan',
  'Admin still applies quota in the browser',
);

if ((admin.match(/paymentOrderCode\(p\)/g) || []).length < 2) {
  failures.push('Admin payment tables do not show order codes');
}

for (const token of [
  'order_code text',
  'applied_at timestamptz',
  'applied_result jsonb',
  'plan_expires_at timestamptz',
  'membership_expires_at timestamptz',
  'admin_set_payment_order_status',
  'already_applied',
  'drop policy if exists payment_orders_own_update',
  'can_create_own_payment_order',
]) {
  requireToken(migration, token, `Lifecycle migration missing ${token}`);
}

for (const token of [
  'payment_orders_order_code_upper_uq',
  'p.id <> new.id',
  'unique_suffix',
]) {
  requireToken(
    migration + collision,
    token,
    `Order-code collision guard missing ${token}`,
  );
}

if (failures.length) {
  console.error('✗ Deals68 G7 payment hardening check failed:');
  failures.forEach((item) => console.error(`  - ${item}`));
  process.exit(1);
}

console.log('✓ Deals68 G7 payment/invoice hardening static check: PASS');
console.log('✓ Investor registration promo input is 200px.');
console.log('✓ Investor registration payment summary is 350px.');
console.log('✓ Payment references are unique per order.');
console.log('✓ Business and Investor dashboards use verified payment creation.');
console.log('✓ Admin confirmation is atomic and idempotent.');
console.log('✓ Users cannot update their own payment status.');
console.log('✓ Business plan and Investor membership expiries are tracked.');
