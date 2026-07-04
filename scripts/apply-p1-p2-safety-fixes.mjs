#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const write = (p, s) => fs.writeFileSync(path.join(root, p), s);
function replace(src, from, to, label) {
  if (!src.includes(from)) {
    console.warn(`[skip] ${label}: pattern not found`);
    return src;
  }
  console.log(`[ok] ${label}`);
  return src.replace(from, to);
}
function replaceAll(src, from, to, label) {
  const before = src;
  src = src.split(from).join(to);
  console.log(before === src ? `[skip] ${label}` : `[ok] ${label}`);
  return src;
}

// 1) Remove machine-translation overwrite from Register.tsx.
{
  const file = 'src/pages/Register.tsx';
  let s = read(file);
  s = replaceAll(s, "import { autoEnglishFromVietnamese } from '../lib/i18n';\n", '', 'Register remove autoEnglish import');
  s = replace(s, "username, slug: slugify(titleVi || realName) + '-' + Date.now().toString(36), public_code: 'D68-NEW', company_name_private: companyName || realName,", "username, slug: slugify(titleVi || realName) + '-' + Date.now().toString(36), company_name_private: companyName || realName,", 'Register remove duplicate D68-NEW public_code');
  s = replaceAll(s, 'title_en: autoEnglishFromVietnamese(titleVi)', "title_en: ''", 'Register title_en blank');
  s = replaceAll(s, 'highlights_en: autoEnglishFromVietnamese(highlights)', "highlights_en: ''", 'Register highlights_en blank');
  s = replaceAll(s, 'investment_reason_en: autoEnglishFromVietnamese(reason)', "investment_reason_en: ''", 'Register reason_en blank');
  s = replaceAll(s, 'desc_en: autoEnglishFromVietnamese(desc)', "desc_en: ''", 'Register investor desc_en blank');
  write(file, s);
}

// 2) Remove machine-translation overwrite from BusinessDashboard.tsx.
{
  const file = 'src/pages/BusinessDashboard.tsx';
  let s = read(file);
  s = replaceAll(s, "import { autoEnglishFromVietnamese } from '../lib/i18n';\n", '', 'BusinessDashboard remove autoEnglish import');
  s = replaceAll(s, "title_en: autoEnglishFromVietnamese(String(fd.get('title_vi') || ''))", "title_en: b.title_en || ''", 'BusinessDashboard preserve title_en');
  s = replaceAll(s, "description_en: autoEnglishFromVietnamese(String(fd.get('description_vi') || ''))", "description_en: b.description_en || ''", 'BusinessDashboard preserve description_en');
  s = replaceAll(s, "highlights_en: autoEnglishFromVietnamese(String(fd.get('highlights_vi') || ''))", "highlights_en: b.highlights_en || ''", 'BusinessDashboard preserve highlights_en');
  s = replaceAll(s, "investment_reason_en: autoEnglishFromVietnamese(String(fd.get('investment_reason_vi') || ''))", "investment_reason_en: b.investment_reason_en || ''", 'BusinessDashboard preserve reason_en');
  write(file, s);
}

// 3) Admin: remove machine-translation overwrite and add Contact/Partner lead inbox.
{
  const file = 'src/pages/Admin.tsx';
  let s = read(file);
  s = replaceAll(s, "import { autoEnglishFromVietnamese } from '../lib/i18n';\n", '', 'Admin remove autoEnglish import');
  s = replaceAll(s, "title_en: autoEnglishFromVietnamese(String(fd.get('title_vi') || ''))", "title_en: b.title_en || ''", 'Admin preserve title_en');

  s = replace(s,
    "type AdminTab = 'overview' | 'approvals' | 'businesses' | 'business_review' | 'investors' | 'investor_contacts' | 'payments' | 'promos' | 'quality' | 'requests' | 'market_partners' | 'logs' | 'settings';",
    "type AdminTab = 'overview' | 'approvals' | 'businesses' | 'business_review' | 'investors' | 'investor_contacts' | 'payments' | 'promos' | 'quality' | 'requests' | 'leads' | 'market_partners' | 'logs' | 'settings';",
    'Admin add leads tab type');
  s = replace(s,
    "affiliates: 'market_partners', 'market-partners': 'market_partners', audit: 'logs', logs: 'logs', settings: 'settings', seo: 'settings', imports: 'settings', security: 'settings'",
    "affiliates: 'market_partners', 'market-partners': 'market_partners', leads: 'leads', messages: 'leads', contact: 'leads', audit: 'logs', logs: 'logs', settings: 'settings', seo: 'settings', imports: 'settings', security: 'settings'",
    'Admin route map for leads');
  s = replace(s,
    "{ id: 'requests', label: 'Yêu cầu data', icon: '📂', href: '/admin/data-requests' },\n  { id: 'market_partners', label: 'Đối tác', icon: '🌍', href: '/admin/market-partners' },",
    "{ id: 'requests', label: 'Yêu cầu data', icon: '📂', href: '/admin/data-requests' },\n  { id: 'leads', label: 'Tin nhắn/Leads', icon: '✉️', href: '/admin/leads' },\n  { id: 'market_partners', label: 'Đối tác', icon: '🌍', href: '/admin/market-partners' },",
    'Admin nav add leads');
  s = replace(s,
    "const [logs, setLogs] = useState<any[]>([]);\n  const [msg, setMsg] = useState('');",
    "const [logs, setLogs] = useState<any[]>([]);\n  const [contactMessages, setContactMessages] = useState<any[]>([]);\n  const [partnerLeads, setPartnerLeads] = useState<any[]>([]);\n  const [msg, setMsg] = useState('');",
    'Admin lead state');
  s = replace(s,
    "const [biz, invRes, profRes, promoRes, criteriaRes, reqRes, payRes, logRes] = await Promise.all([",
    "const [biz, invRes, profRes, promoRes, criteriaRes, reqRes, payRes, logRes, contactRes, partnerLeadRes] = await Promise.all([",
    'Admin load destructuring add leads');
  s = replace(s,
    "supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(80)\n      ]);",
    "supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(80),\n        supabase.from('contact_messages').select('*').order('created_at', { ascending: false }).limit(500),\n        supabase.from('partner_leads').select('*').order('created_at', { ascending: false }).limit(500)\n      ]);",
    'Admin load lead queries');
  s = replace(s,
    "setBusinesses(biz || []); setInvestors(invRes.data || []); setProfiles(profRes.data || []); setPromos(promoRes.data || []); setCriteria(criteriaRes.data || []); setRequests(reqRes.data || []); setPayments(payRes.data || []); setLogs(logRes.data || []);",
    "setBusinesses(biz || []); setInvestors(invRes.data || []); setProfiles(profRes.data || []); setPromos(promoRes.data || []); setCriteria(criteriaRes.data || []); setRequests(reqRes.data || []); setPayments(payRes.data || []); setLogs(logRes.data || []); setContactMessages(contactRes.data || []); setPartnerLeads(partnerLeadRes.data || []);",
    'Admin set lead state');
  s = replace(s,
    "const firstErr = invRes.error || profRes.error || promoRes.error || criteriaRes.error || reqRes.error || payRes.error || logRes.error;",
    "const firstErr = invRes.error || profRes.error || promoRes.error || criteriaRes.error || reqRes.error || payRes.error || logRes.error || contactRes.error || partnerLeadRes.error;",
    'Admin include lead errors');
  s = replace(s,
    "{tab === 'requests' && <Requests requests={requests} markRequest={markRequest} />}\n          {tab === 'market_partners' && <MarketPartners rows={marketPartners} approveProfile={approveProfile} hideProfile={hideProfile} />}",
    "{tab === 'requests' && <Requests requests={requests} markRequest={markRequest} />}\n          {tab === 'leads' && <LeadInbox contactMessages={contactMessages} partnerLeads={partnerLeads} />}\n          {tab === 'market_partners' && <MarketPartners rows={marketPartners} approveProfile={approveProfile} hideProfile={hideProfile} />}",
    'Admin render leads tab');
  if (!s.includes('function LeadInbox(')) {
    s += `\n\nfunction LeadInbox({ contactMessages, partnerLeads }: any) {\n  const rows = [\n    ...contactMessages.map((x: any) => ({ kind: 'Contact', name: x.name, email: x.email, message: x.message, country: '', status: x.status || 'new', created_at: x.created_at })),\n    ...partnerLeads.map((x: any) => ({ kind: 'Partner', name: x.full_name, email: x.email, message: x.intro, country: x.country, status: x.status || 'new', created_at: x.created_at }))\n  ].sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());\n  return <Card><h2 style={{ marginTop: 0 }}>Contact messages / Partner leads</h2><p style={{ color: '#64748B', lineHeight: 1.6 }}>Dữ liệu lấy thật từ contact_messages và partner_leads. Nếu tab trống, kiểm tra migration và RLS.</p>{rows.length ? <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr style={{ color: '#94A3B8', textAlign: 'left', fontSize: 12 }}><th>Type</th><th>Name</th><th>Email</th><th>Country</th><th>Status</th><th>Message</th><th>Created</th></tr></thead><tbody>{rows.map((r, i) => <tr key={i} style={{ borderTop: '1px solid #F1F5F9', fontSize: 13 }}><td style={{ padding: '10px 8px', fontWeight: 800 }}>{r.kind}</td><td style={{ padding: '10px 8px' }}>{r.name || '-'}</td><td style={{ padding: '10px 8px' }}>{r.email || '-'}</td><td style={{ padding: '10px 8px' }}>{r.country || '-'}</td><td style={{ padding: '10px 8px' }}>{r.status}</td><td style={{ padding: '10px 8px', maxWidth: 420 }}>{r.message || '-'}</td><td style={{ padding: '10px 8px', color: '#94A3B8' }}>{r.created_at ? new Date(r.created_at).toLocaleString('vi-VN') : '-'}</td></tr>)}</tbody></table></div> : <Empty text=\"No contact messages or partner leads yet.\" />}</Card>;\n}\n`;
    console.log('[ok] Admin append LeadInbox');
  }
  write(file, s);
}

// 4) Optional cleanup of dead CSS files.
for (const dead of ['src/styles.css', 'src/reference-overrides.css']) {
  const p = path.join(root, dead);
  if (fs.existsSync(p)) { fs.rmSync(p); console.log(`[ok] removed ${dead}`); }
}

console.log('\nP1/P2 safety fixes applied. Run npm run build next.');
