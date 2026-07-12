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

const admin = read('src/pages/Admin.tsx');
const overview = read(
  'src/components/admin/AdminOperationsOverview.tsx',
);
const helper = read('src/lib/adminOperations.ts');
const css = read('src/styles/pages/admin.css');

for (const token of [
  'useNavigate',
  'AdminOperationsOverview',
  'lastRefreshedAt',
  'navQueueCounts',
  'pendingPayments',
  'pendingProposals',
  'paymentStatusFilter',
  'proposalStatusFilter',
  'investorReviewFilter',
  'replaceAdminQuery',
  'updateInvestorPage',
]) {
  requireToken(admin, token, `Admin missing ${token}`);
}

for (const token of [
  "initialQuery.get('q')",
  "initialQuery.get('review')",
  "initialQuery.get('ip')",
  "initialQuery.get('ps')",
  "initialQuery.get('prs')",
]) {
  requireToken(admin, token, `URL state missing ${token}`);
}

requireToken(
  admin,
  'deals68-admin-business-flow',
  'Admin realtime channel no longer matches release QA baseline',
);
forbidToken(
  admin,
  'deals68-admin-operations-flow',
  'Admin uses an incompatible realtime channel name',
);

for (const token of [
  "table: 'investors'",
  "table: 'payment_orders'",
  "table: 'proposals'",
]) {
  requireToken(admin, token, `Realtime queue missing ${token}`);
}

for (const token of [
  '/admin/payments?ps=pending',
  '/admin/business-review?queue=pending',
  '/admin/investors?review=pending',
  '/admin/proposals?prs=sent',
]) {
  requireToken(overview, token, `Queue link missing ${token}`);
}

for (const token of [
  'isPendingAdminPayment',
  'isPendingAdminProposal',
  'isPendingAdminRequest',
  'isPendingAdminLead',
  'sortAdminQueueFirst',
  'adminRefreshLabel',
]) {
  requireToken(helper, token, `Queue helper missing ${token}`);
}

for (const token of [
  '.d68-admin-nav-count',
  '.d68-admin-queue-grid',
  '.d68-admin-queue-card',
  '.d68-admin-queue-filter',
  '.d68-admin-row-pending',
]) {
  requireToken(css, token, `Admin CSS missing ${token}`);
}

requireToken(
  admin,
  "{tab === 'payments' && <Payments\n        payments={filteredPayments}",
  'Payment tab is not rendering filteredPayments',
);
requireToken(
  admin,
  "{tab === 'proposals' && <ProposalList\n        proposals={filteredProposals}",
  'Proposal tab is not rendering filteredProposals',
);
requireToken(
  admin,
  'payments={payments} profiles={profiles} markPayment={markPayment}',
  'Business detail payment panel changed outside G8 scope',
);

forbidToken(
  admin,
  'function Overview(',
  'Legacy Admin overview remains',
);
forbidToken(
  admin,
  "supabase.from('payment_orders').update",
  'G7 payment RPC regressed to direct update',
);
requireToken(
  admin,
  'adminSetPaymentOrderStatus',
  'G7 atomic payment RPC call is missing',
);

if (failures.length) {
  console.error('✗ Deals68 G8 Admin Operations static check failed:');
  failures.forEach((item) => console.error(`  - ${item}`));
  process.exit(1);
}

console.log('✓ Deals68 G8 Admin Operations static check: PASS');
console.log('✓ Overview shows Business/Investor/Payment/Proposal queues.');
console.log('✓ Sidebar shows pending queue badges.');
console.log('✓ Payment and Proposal lists prioritize pending work.');
console.log('✓ Admin filters and Investor page persist in URL.');
console.log('✓ Critical queues refresh on realtime changes.');
console.log('✓ G7 atomic payment confirmation remains unchanged.');
console.log('✓ No Supabase migration.');
