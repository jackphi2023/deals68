from pathlib import Path
import re

ROOT = Path.cwd()

def p(rel):
    return ROOT / rel

def write(rel, content):
    path = p(rel)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content.strip() + "\n", encoding='utf-8')
    print(f"wrote {rel}")

def patch_file(rel, fn):
    path = p(rel)
    text = path.read_text(encoding='utf-8')
    new = fn(text)
    if new == text:
        print(f"unchanged {rel}")
    else:
        path.write_text(new, encoding='utf-8')
        print(f"patched {rel}")

PROPOSALS_TS = r'''
import { supabase } from './supabase';
import type { Lang } from './i18n';

export type ProposalStatus = 'sent' | 'approved' | 'declined' | 'request_data' | 'connected';
export type ProposalSendReason = 'duplicate' | 'quota_exceeded' | 'missing_profile' | 'error';

export type ProposalSendResult = {
  ok: boolean;
  reason?: ProposalSendReason;
  proposal?: any;
  quotaTotal?: number;
  quotaUsed?: number;
  remainingQuota?: number;
  message?: string;
};

const VALID_STATUSES: ProposalStatus[] = ['sent', 'approved', 'declined', 'request_data', 'connected'];

function cleanText(value: any) {
  return String(value ?? '').trim();
}

export function proposalQuotaTotal(business: any) {
  const explicit = Number(business?.quota_total || 0);
  if (explicit > 0) return explicit;
  const plan = cleanText(business?.plan).toLowerCase();
  return plan.includes('featured') ? 200 : 100;
}

export function proposalStatusLabel(status: any, lang: Lang = 'vi') {
  const value = cleanText(status || 'sent') as ProposalStatus;
  const map: Record<ProposalStatus, { vi: string; en: string; cls: 'blue' | 'green' | 'gold' | 'red' }> = {
    sent: { vi: 'Chưa duyệt', en: 'Sent', cls: 'blue' },
    approved: { vi: 'Đã duyệt', en: 'Approved', cls: 'green' },
    declined: { vi: 'Bỏ qua', en: 'Declined', cls: 'red' },
    request_data: { vi: 'Yêu cầu tài liệu', en: 'Data requested', cls: 'gold' },
    connected: { vi: 'Đã kết nối', en: 'Connected', cls: 'green' },
  };
  const item = map[VALID_STATUSES.includes(value) ? value : 'sent'];
  return { label: lang === 'en' ? item.en : item.vi, cls: item.cls };
}

export async function getBusinessProposalForInvestor(businessId: string, investorId: string) {
  if (!businessId || !investorId) return null;
  const { data, error } = await supabase
    .from('proposals')
    .select('id,business_id,investor_id,status,sent_at,updated_at,message')
    .eq('business_id', businessId)
    .eq('investor_id', investorId)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

export async function listBusinessProposalStatuses(businessId: string) {
  if (!businessId) return [];
  const { data, error } = await supabase
    .from('proposals')
    .select('id,investor_id,status,sent_at,updated_at')
    .eq('business_id', businessId)
    .order('sent_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

async function countBusinessProposals(businessId: string) {
  const { count, error } = await supabase
    .from('proposals')
    .select('id', { count: 'exact', head: true })
    .eq('business_id', businessId);
  if (error) throw error;
  return count || 0;
}

async function fetchProposalByIdOrPair(id: any, businessId: string, investorId: string) {
  if (id) {
    const { data } = await supabase
      .from('proposals')
      .select('id,business_id,investor_id,status,sent_at,updated_at,message')
      .eq('id', id)
      .maybeSingle()
      .catch(() => ({ data: null } as any));
    if (data) return data;
  }
  return getBusinessProposalForInvestor(businessId, investorId).catch(() => null);
}

export async function sendBusinessProposalToInvestor(input: {
  business?: any;
  businessId?: string;
  investorId: string;
  message?: string;
}): Promise<ProposalSendResult> {
  const businessId = cleanText(input.businessId || input.business?.id);
  const investorId = cleanText(input.investorId);
  if (!businessId || !investorId) {
    return { ok: false, reason: 'missing_profile', message: 'Missing business or investor profile.' };
  }

  const [existing, sentCount] = await Promise.all([
    getBusinessProposalForInvestor(businessId, investorId).catch(() => null),
    countBusinessProposals(businessId).catch(() => Number(input.business?.quota_used || 0)),
  ]);

  const quotaTotal = proposalQuotaTotal(input.business);
  const quotaUsed = Number(input.business?.quota_used ?? sentCount ?? 0);
  const remainingQuota = Math.max(0, quotaTotal - quotaUsed);

  if (existing) {
    return { ok: true, reason: 'duplicate', proposal: existing, quotaTotal, quotaUsed, remainingQuota };
  }

  if (quotaUsed >= quotaTotal) {
    return { ok: false, reason: 'quota_exceeded', quotaTotal, quotaUsed, remainingQuota: 0 };
  }

  const sentAt = new Date().toISOString();
  const message = input.message || `Business profile sent from Deals68 on ${sentAt}`;

  const rpc = await supabase
    .rpc('submit_business_proposal', { business_uuid: businessId, investor_uuid: investorId, proposal_note: message })
    .catch((error: any) => ({ data: null, error }));

  if (!rpc.error) {
    const proposal = await fetchProposalByIdOrPair(rpc.data, businessId, investorId);
    return {
      ok: true,
      proposal: proposal || { id: rpc.data, business_id: businessId, investor_id: investorId, status: 'sent', sent_at: sentAt, message },
      quotaTotal,
      quotaUsed: quotaUsed + 1,
      remainingQuota: Math.max(0, remainingQuota - 1),
    };
  }

  const { data, error } = await supabase
    .from('proposals')
    .insert({ business_id: businessId, investor_id: investorId, message, status: 'sent', sent_at: sentAt })
    .select('id,business_id,investor_id,status,sent_at,updated_at,message')
    .single();

  if (error) {
    const text = cleanText(error.message).toLowerCase();
    if (text.includes('duplicate') || text.includes('unique')) {
      const duplicate = await getBusinessProposalForInvestor(businessId, investorId).catch(() => null);
      return { ok: true, reason: 'duplicate', proposal: duplicate, quotaTotal, quotaUsed, remainingQuota };
    }
    return { ok: false, reason: 'error', quotaTotal, quotaUsed, remainingQuota, message: error.message };
  }

  return { ok: true, proposal: data, quotaTotal, quotaUsed: quotaUsed + 1, remainingQuota: Math.max(0, remainingQuota - 1) };
}

export async function updateProposalStatus(proposalId: string, status: ProposalStatus) {
  const safeStatus = VALID_STATUSES.includes(status) ? status : 'sent';
  const { data, error } = await supabase
    .from('proposals')
    .update({ status: safeStatus, updated_at: new Date().toISOString() })
    .eq('id', proposalId)
    .select()
    .single();
  if (error) throw error;
  return data;
}
'''

HEADER_TSX = r'''
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { Lang } from '../lib/i18n';
import { stripLangPrefix, switchLanguagePath, toLocalizedPath } from '../lib/i18nRoutes';
import { useAuth } from '../contexts/AuthContext';

const T = (lang: Lang, vi: string, en: string) => lang === 'en' ? en : vi;
const buttonReset: CSSProperties = { border: 'none', cursor: 'pointer', fontFamily: 'inherit' };

function langBtnStyle(active: boolean): CSSProperties {
  return { ...buttonReset, padding: '7px 14px', fontWeight: 700, fontSize: 13, background: active ? '#0F2A4A' : 'transparent', color: active ? '#fff' : '#64748B' };
}

function dashboardForRole(role?: string) {
  if (role === 'admin') return '/admin';
  if (role === 'investor') return '/dashboard/investor';
  if (role === 'affiliate') return '/dashboard/market-partner';
  return '/dashboard/business';
}

function menuForRole(role: string | undefined, lang: Lang) {
  if (role === 'admin') return [
    { label: T(lang, 'Dashboard', 'Dashboard'), to: '/admin' },
    { label: T(lang, 'Proposal', 'Proposals'), to: '/admin/proposals' },
    { label: T(lang, 'Doanh nghiệp', 'Businesses'), to: '/admin/businesses' },
    { label: T(lang, 'Nhà đầu tư', 'Investors'), to: '/admin/investors' },
    { label: T(lang, 'Yêu cầu tài liệu', 'Data requests'), to: '/admin/data-requests' },
  ];
  if (role === 'investor') return [
    { label: T(lang, 'Dashboard', 'Dashboard'), to: '/dashboard/investor' },
    { label: T(lang, 'Hồ sơ nhà đầu tư', 'Investor profile'), to: '/dashboard/investor/profile' },
    { label: T(lang, 'Proposal đã nhận', 'Received proposals'), to: '/dashboard/investor/proposals' },
    { label: T(lang, 'DN đã quan tâm / đã lưu', 'Saved businesses'), to: '/dashboard/investor/saved' },
    { label: T(lang, 'Yêu cầu tài liệu', 'Data requests'), to: '/dashboard/investor/alerts' },
    { label: T(lang, 'Invoices / Thanh toán', 'Invoices / Billing'), to: '/dashboard/investor/privacy' },
    { label: T(lang, 'Inbox / Tin nhắn', 'Inbox / Messages'), to: '/messages' },
    { label: T(lang, 'Notifications', 'Notifications'), to: '/notifications' },
    { label: T(lang, 'Settings', 'Settings'), to: '/dashboard/investor/security' },
  ];
  return [
    { label: T(lang, 'Dashboard', 'Dashboard'), to: '/dashboard/business' },
    { label: T(lang, 'Hồ sơ doanh nghiệp', 'Business profile'), to: '/dashboard/business/profile' },
    { label: T(lang, 'Proposal đã gửi', 'Sent proposals'), to: '/dashboard/business/proposals' },
    { label: T(lang, 'Nhà đầu tư quan tâm', 'Investor interests'), to: '/dashboard/business/proposals' },
    { label: T(lang, 'Yêu cầu tài liệu', 'Data requests'), to: '/dashboard/business/data-requests' },
    { label: T(lang, 'Invoices / Thanh toán', 'Invoices / Billing'), to: '/dashboard/business/payments' },
    { label: T(lang, 'Inbox / Tin nhắn', 'Inbox / Messages'), to: '/messages' },
    { label: T(lang, 'Notifications', 'Notifications'), to: '/notifications' },
    { label: T(lang, 'Settings', 'Settings'), to: '/dashboard/business/profile' },
  ];
}

export default function Header({ lang }: { lang: Lang }) {
  const { pathname, search } = useLocation();
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [avatarOpen, setAvatarOpen] = useState(false);
  const avatarRef = useRef<HTMLDivElement | null>(null);
  const basePath = stripLangPrefix(pathname);
  const maxWidth = basePath === '/' ? 1200 : 1240;
  const zIndex = basePath.startsWith('/businesses') || basePath.startsWith('/investors') ? 60 : 50;
  const nav = (path: string) => toLocalizedPath(path, lang);
  const closeDrawer = () => setMobileOpen(false);
  const displayEmail = profile?.email || '';
  const displayName = displayEmail ? displayEmail.split('@')[0] : T(lang, 'Tài khoản', 'Account');
  const initial = (displayName || profile?.role || 'U').trim().charAt(0).toUpperCase();
  const roleMenu = menuForRole(profile?.role, lang);

  useEffect(() => {
    if (!avatarOpen) return;
    function handleClickOutside(event: MouseEvent) {
      if (avatarRef.current && !avatarRef.current.contains(event.target as Node)) setAvatarOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [avatarOpen]);

  const navLinkStyle = ({ isActive }: { isActive: boolean }): CSSProperties => ({ whiteSpace: 'nowrap', color: isActive ? '#1BADEA' : '#14315A', fontWeight: isActive ? 700 : 500 });
  const switchLang = (target: Lang) => {
    closeDrawer();
    setAvatarOpen(false);
    if (typeof window !== 'undefined') window.localStorage.setItem('d68_lang', target);
    navigate(switchLanguagePath(pathname, search, target));
  };
  const logout = async () => {
    closeDrawer();
    setAvatarOpen(false);
    await signOut();
    navigate(nav('/'));
  };

  const authDesktop = profile
    ? <div ref={avatarRef} style={{ display: 'flex', alignItems: 'center', gap: 10, position: 'relative' }}>
        <Link to={nav(dashboardForRole(profile.role))} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#1BADEA', color: '#fff', fontWeight: 800, fontSize: 15, padding: '11px 18px', borderRadius: 10, boxShadow: '0 6px 16px rgba(27,173,234,.28)', whiteSpace: 'nowrap' }}>{T(lang, 'Dashboard', 'Dashboard')}</Link>
        <button type="button" aria-label={T(lang, 'Mở menu tài khoản', 'Open account menu')} aria-expanded={avatarOpen} onClick={() => setAvatarOpen((v) => !v)} style={{ width: 38, height: 38, borderRadius: '50%', border: '2px solid #E2E8F0', background: '#065F46', color: '#fff', fontWeight: 900, cursor: 'pointer', boxShadow: '0 8px 18px rgba(15,42,74,.14)' }}>{initial}</button>
        {avatarOpen ? <div style={{ position: 'absolute', right: 0, top: 48, width: 265, background: '#fff', border: '1px solid #E7EDF3', borderRadius: 14, boxShadow: '0 18px 40px rgba(15,42,74,.18)', zIndex: 120, overflow: 'hidden' }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', padding: 14, borderBottom: '1px solid #EEF2F6' }}><div style={{ width: 48, height: 48, borderRadius: 10, background: '#065F46', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 22 }}>{initial}</div><div style={{ minWidth: 0 }}><b style={{ display: 'block', color: '#0F2A4A' }}>{displayName}</b>{displayEmail ? <small style={{ display: 'block', color: '#1596cc', overflow: 'hidden', textOverflow: 'ellipsis' }}>{displayEmail}</small> : null}</div></div>
          <div style={{ padding: 6 }}>{roleMenu.map((item) => <Link key={item.to} to={nav(item.to)} onClick={() => setAvatarOpen(false)} style={{ display: 'block', padding: '11px 12px', borderRadius: 9, color: '#334155', fontSize: 14, fontWeight: 650 }}>{item.label}</Link>)}</div>
          <button type="button" onClick={logout} style={{ width: '100%', border: 0, borderTop: '1px solid #EEF2F6', background: '#F8FAFC', padding: '13px 14px', textAlign: 'left', color: '#475569', fontWeight: 800, cursor: 'pointer' }}>{T(lang, 'Thoát / Logout', 'Logout')}</button>
        </div> : null}
      </div>
    : <>
        <Link to={nav('/login')} style={{ fontSize: 15, fontWeight: 600, color: '#14315A', whiteSpace: 'nowrap' }}><span className="l-vi">Đăng nhập</span><span className="l-en">Log in</span></Link>
        <div className="d68-reg-dd" style={{ position: 'relative' }}>
          <button type="button" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#1BADEA', color: '#fff', fontWeight: 700, fontSize: 15, padding: '11px 20px', borderRadius: 10, boxShadow: '0 6px 16px rgba(27,173,234,.28)', whiteSpace: 'nowrap', border: 'none', cursor: 'pointer' }}><span className="l-vi">Đăng ký</span><span className="l-en">Register</span> <span style={{ fontSize: 11 }}>▾</span></button>
          <div className="d68-reg-menu" style={{ display: 'none', position: 'absolute', top: '100%', right: 0, paddingTop: 8, minWidth: 230, flexDirection: 'column', zIndex: 80 }}>
            <div style={{ background: '#fff', border: '1px solid #E7EDF3', borderRadius: 12, boxShadow: '0 14px 34px rgba(15,42,74,.16)', padding: 8, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Link to={nav('/register/business')} style={{ padding: '11px 14px', borderRadius: 8, fontSize: 14.5, fontWeight: 600, color: '#14315A' }}><span className="l-vi">Đăng ký Doanh nghiệp</span><span className="l-en">Register as Business</span></Link>
              <Link to={nav('/register/investor')} style={{ padding: '11px 14px', borderRadius: 8, fontSize: 14.5, fontWeight: 600, color: '#14315A' }}><span className="l-vi">Đăng ký Nhà đầu tư</span><span className="l-en">Register as Investor</span></Link>
            </div>
          </div>
        </div>
      </>;

  return <header style={{ position: 'sticky', top: 0, zIndex, background: 'rgba(255,255,255,.94)', backdropFilter: 'blur(10px)', borderBottom: '1px solid #E7EDF3' }}>
    <div style={{ maxWidth, margin: '0 auto', padding: '0 24px', height: 70, display: 'flex', alignItems: 'center', gap: 28 }}>
      <Link to={nav('/')} onClick={closeDrawer} style={{ display: 'flex', alignItems: 'center', flexShrink: 0, background: 'transparent' }} aria-label="Deals68.com">
        <img src="/assets/logo-nav.png" alt="Deals68.com" style={{ height: 34, width: 'auto', display: 'block', background: 'transparent' }} />
      </Link>

      <nav className="d68-nav" style={{ display: 'flex', alignItems: 'center', gap: 26, marginLeft: 8, fontSize: 15, fontWeight: 500, color: '#14315A' }} aria-label="Main navigation">
        <NavLink to={nav('/businesses')} style={navLinkStyle}><span className="l-vi">Doanh nghiệp</span><span className="l-en">Businesses</span></NavLink>
        <NavLink to={nav('/investors')} style={navLinkStyle}><span className="l-vi">Nhà đầu tư</span><span className="l-en">Investors</span></NavLink>
        <NavLink to={nav('/valuation')} style={navLinkStyle}><span className="l-vi">Định giá</span><span className="l-en">Valuation</span></NavLink>
        <NavLink to={nav('/pricing')} style={navLinkStyle}><span className="l-vi">Bảng giá</span><span className="l-en">Pricing</span></NavLink>
      </nav>

      <button type="button" className="d68-burger" aria-label={mobileOpen ? T(lang, 'Đóng menu', 'Close menu') : T(lang, 'Mở menu', 'Open menu')} aria-expanded={mobileOpen} onClick={() => setMobileOpen((v) => !v)} style={{ marginLeft: 'auto', width: 44, height: 44, alignItems: 'center', justifyContent: 'center', border: '1px solid #E2E8F0', borderRadius: 10, fontSize: 22, color: '#14315A', cursor: 'pointer', flexShrink: 0, background: '#fff' }}>{mobileOpen ? '×' : '☰'}</button>

      <div className={`d68-mdrawer${mobileOpen ? ' is-open' : ''}`} style={{ position: 'absolute', top: 70, left: 0, right: 0, flexDirection: 'column', gap: 2, background: '#fff', borderTop: '1px solid #E7EDF3', boxShadow: '0 18px 34px rgba(15,42,74,.14)', padding: '12px 20px 18px', maxHeight: 'calc(100vh - 70px)', overflowY: 'auto' }}>
        <Link to={nav('/businesses')} onClick={closeDrawer} style={{ padding: '13px 6px', fontSize: 16, fontWeight: 600, color: '#14315A', borderBottom: '1px solid #F1F5F9' }}><span className="l-vi">Doanh nghiệp</span><span className="l-en">Businesses</span></Link>
        <Link to={nav('/investors')} onClick={closeDrawer} style={{ padding: '13px 6px', fontSize: 16, fontWeight: 600, color: '#14315A', borderBottom: '1px solid #F1F5F9' }}><span className="l-vi">Nhà đầu tư</span><span className="l-en">Investors</span></Link>
        <Link to={nav('/valuation')} onClick={closeDrawer} style={{ padding: '13px 6px', fontSize: 16, fontWeight: 600, color: '#14315A', borderBottom: '1px solid #F1F5F9' }}><span className="l-vi">Định giá</span><span className="l-en">Valuation</span></Link>
        <Link to={nav('/pricing')} onClick={closeDrawer} style={{ padding: '13px 6px', fontSize: 16, fontWeight: 600, color: '#14315A', borderBottom: '1px solid #F1F5F9' }}><span className="l-vi">Bảng giá</span><span className="l-en">Pricing</span></Link>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '14px 6px 8px' }}><span style={{ fontSize: 14, fontWeight: 600, color: '#64748B' }}><span className="l-vi">Ngôn ngữ</span><span className="l-en">Language</span></span><div style={{ display: 'flex', alignItems: 'center', border: '1px solid #E2E8F0', borderRadius: 999, overflow: 'hidden', fontSize: 13, fontWeight: 700 }}><button type="button" onClick={() => switchLang('vi')} style={langBtnStyle(lang === 'vi')}>VI</button><button type="button" onClick={() => switchLang('en')} style={langBtnStyle(lang === 'en')}>EN</button></div></div>
        {profile ? <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}><div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 6px' }}><span style={{ width: 38, height: 38, borderRadius: '50%', background: '#065F46', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900 }}>{initial}</span><div><b>{displayName}</b>{displayEmail ? <small style={{ display: 'block', color: '#1596cc' }}>{displayEmail}</small> : null}</div></div>{roleMenu.map((item) => <Link key={item.to} to={nav(item.to)} onClick={closeDrawer} style={{ padding: '11px 8px', borderBottom: '1px solid #F1F5F9', color: '#334155', fontWeight: 700 }}>{item.label}</Link>)}<button type="button" onClick={logout} style={{ ...buttonReset, padding: '13px 8px', background: '#F8FAFC', color: '#475569', fontWeight: 800, textAlign: 'left' }}>{T(lang, 'Thoát / Logout', 'Logout')}</button></div> : <><Link to={nav('/login')} onClick={closeDrawer} style={{ padding: '13px 6px', fontSize: 16, fontWeight: 700, color: '#14315A' }}><span className="l-vi">Đăng nhập</span><span className="l-en">Log in</span></Link><div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}><Link to={nav('/register/business')} onClick={closeDrawer} style={{ textAlign: 'center', background: '#1BADEA', color: '#fff', fontWeight: 700, fontSize: 15, padding: 13, borderRadius: 10 }}><span className="l-vi">Đăng ký Doanh nghiệp</span><span className="l-en">Register as Business</span></Link><Link to={nav('/register/investor')} onClick={closeDrawer} style={{ textAlign: 'center', border: '1px solid #E2E8F0', color: '#14315A', fontWeight: 700, fontSize: 15, padding: 13, borderRadius: 10 }}><span className="l-vi">Đăng ký Nhà đầu tư</span><span className="l-en">Register as Investor</span></Link></div></>}
      </div>

      <div className="d68-hdr-actions" style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #E2E8F0', borderRadius: 999, overflow: 'hidden', fontSize: 13, fontWeight: 700 }}><button type="button" onClick={() => switchLang('vi')} style={langBtnStyle(lang === 'vi')}>VI</button><button type="button" onClick={() => switchLang('en')} style={langBtnStyle(lang === 'en')}>EN</button></div>
        {authDesktop}
      </div>
    </div>
  </header>;
}
'''

# Shorter generated pages are below. They intentionally preserve existing class names and use the shared proposal helper.
INVESTOR_DETAIL_TSX = r'''
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getInvestorByCode, getMyBusiness } from '../lib/data';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { toLocalizedPath } from '../lib/i18nRoutes';
import { sendBusinessProposalToInvestor } from '../lib/proposals';
import { formatMoneyForLang, labelCountry, labelDealType, labelIndustry, labelInvestorType, labelRegion, labelStage, T } from '../lib/labels';
import type { Lang } from '../lib/i18n';

type ContactAccess = { connected?: boolean; name?: string; email?: string; phone?: string; website?: string } | null;

function arr(v: any): string[] {
  if (Array.isArray(v)) return v.filter(Boolean).map(String).map((x) => x.trim()).filter(Boolean);
  if (!v) return [];
  return String(v).split(/[;,\n]/).map((x) => x.trim()).filter(Boolean);
}
function clean(v: any) { return String(v ?? '').trim(); }
function ticket(lang: Lang, min: any, max: any) {
  const a = Number(min || 0), b = Number(max || 0);
  if (!a && !b) return T(lang, 'Đang cập nhật', 'Updating');
  if (a && b) return `${formatMoneyForLang(a, 'USD', lang)} – ${formatMoneyForLang(b, 'USD', lang)}`;
  return b ? `≤ ${formatMoneyForLang(b, 'USD', lang)}` : `≥ ${formatMoneyForLang(a, 'USD', lang)}`;
}
function criteriaList(inv: any, lang: Lang): string[] {
  const criteria = inv?.criteria && typeof inv.criteria === 'object' ? inv.criteria : {};
  const out: string[] = [];
  const deals = arr(inv?.deal_types || criteria.dealTypes);
  const markets = arr(criteria.preferredCountries || inv?.country_iso2 || inv?.country);
  const sectors = arr(inv?.industries || criteria.sectors);
  if (deals.length) out.push(`${T(lang, 'Ưu tiên giao dịch', 'Preferred transactions')}: ${deals.map((x) => labelDealType(x, lang, true)).join(', ')}`);
  if (markets.length) out.push(`${T(lang, 'Địa lý quan tâm', 'Target geographies')}: ${markets.map((x) => labelCountry(x, lang)).join(', ')}`);
  if (inv?.stage) out.push(`${T(lang, 'Giai đoạn phù hợp', 'Preferred stage')}: ${labelStage(inv.stage, lang)}`);
  if (sectors.length) out.push(`${T(lang, 'Ngành quan tâm', 'Target sectors')}: ${sectors.map((x) => labelIndustry(x, lang)).join(', ')}`);
  if (criteria.investment_appetite) out.push(`${T(lang, 'Khẩu vị đầu tư', 'Investment appetite')}: ${criteria.investment_appetite}`);
  if (criteria.riskAppetite) out.push(`${T(lang, 'Khẩu vị rủi ro', 'Risk appetite')}: ${criteria.riskAppetite}`);
  if (criteria.returnExpectation) out.push(`${T(lang, 'Kỳ vọng lợi nhuận', 'Return expectation')}: ${criteria.returnExpectation}`);
  if (inv?.activity_level) out.push(`${T(lang, 'Mức độ hoạt động gần đây', 'Recent activity')}: ${inv.activity_level}`);
  return out;
}
function proposalHistory(inv: any): string[] {
  const raw = inv?.criteria?.proposal_history || inv?.criteria?.proposalHistory || [];
  return arr(raw).map(String).filter(Boolean);
}
function fmtDate(value: any, lang: Lang) {
  const d = value ? new Date(value) : new Date();
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(lang === 'en' ? 'en-US' : 'vi-VN');
}

export default function InvestorDetail({ lang }: { lang: Lang }) {
  const { code = '' } = useParams();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [inv, setInv] = useState<any>(null);
  const [contact, setContact] = useState<ContactAccess>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [proposalBusy, setProposalBusy] = useState(false);
  const [sentProposal, setSentProposal] = useState<any>(null);
  const [publicHistory, setPublicHistory] = useState<string[]>([]);

  useEffect(() => {
    let live = true;
    async function load() {
      setLoading(true); setError(''); setInv(null); setContact(null); setMsg(''); setPublicHistory([]);
      try {
        const data = await getInvestorByCode(code);
        if (!live) return;
        if (!data) setError(T(lang, 'Không tìm thấy hồ sơ nhà đầu tư hoặc hồ sơ chưa public.', 'Investor profile not found or not public.'));
        else {
          setInv(data);
          const fallback = proposalHistory(data).map((item) => `${item}`);
          setPublicHistory(fallback);
          const { data: hist } = await supabase
            .from('proposals')
            .select('id,sent_at,businesses(public_code,title_vi,title_en)')
            .eq('investor_id', data.id)
            .order('sent_at', { ascending: false })
            .limit(8)
            .catch(() => ({ data: null } as any));
          if (live && hist?.length) {
            setPublicHistory(hist.map((row: any) => `[${fmtDate(row.sent_at, lang)}] ${T(lang, 'DN XXX gửi hồ sơ', 'Business XXX sent a profile')}`));
          }
        }
      } catch (e: any) {
        if (live) setError(e?.message || T(lang, 'Không tải được hồ sơ nhà đầu tư.', 'Could not load investor profile.'));
      } finally { if (live) setLoading(false); }
    }
    load();
    return () => { live = false; };
  }, [code, lang]);

  useEffect(() => {
    let live = true;
    async function loadContact() {
      if (!profile || !inv?.id) { setContact(null); return; }
      const { data } = await supabase.rpc('get_investor_contact_if_connected', { investor_uuid: inv.id }).catch(() => ({ data: null } as any));
      if (live) setContact(data || null);
    }
    loadContact();
    return () => { live = false; };
  }, [profile?.id, inv?.id]);

  useEffect(() => {
    let live = true;
    async function loadSentProposal() {
      setSentProposal(null);
      if (!profile || profile.role !== 'business' || !inv?.id) return;
      try {
        const biz = await getMyBusiness(profile.id);
        if (!live || !biz?.id) return;
        const { data } = await supabase.from('proposals').select('id,status,sent_at').eq('business_id', biz.id).eq('investor_id', inv.id).maybeSingle();
        if (live) setSentProposal(data || null);
      } catch { if (live) setSentProposal(null); }
    }
    loadSentProposal();
    return () => { live = false; };
  }, [profile?.id, profile?.role, inv?.id]);

  const title = inv ? T(lang, inv.title_vi || inv.code || 'Nhà đầu tư', inv.title_en || inv.title_vi || inv.code || 'Investor') : '';
  const desc = inv ? T(lang, inv.desc_vi || 'Hồ sơ nhà đầu tư ẩn danh đang được cập nhật.', inv.desc_en || inv.desc_vi || 'Anonymous investor profile is being updated.') : '';
  const industries = useMemo(() => arr(inv?.industries), [inv]);
  const criteria = useMemo(() => criteriaList(inv, lang), [inv, lang]);
  const markets = useMemo(() => {
    const fromCriteria = arr(inv?.criteria?.preferredCountries);
    return fromCriteria.length ? fromCriteria : [inv?.country_iso2 || inv?.country || 'Global'];
  }, [inv]);
  const connected = !!contact?.connected;

  async function sendProposal() {
    if (!profile) { navigate(toLocalizedPath(`/register/business?next=/investors/${code}`, lang)); return; }
    if (profile.role !== 'business') { setMsg(T(lang, 'Chỉ tài khoản Doanh nghiệp được gửi hồ sơ DN.', 'Only Business accounts can send a business profile.')); return; }
    if (sentProposal) { setMsg(T(lang, 'Bạn đã gửi hồ sơ DN tới nhà đầu tư này. Vui lòng theo dõi tại Dashboard DN → Proposal.', 'You already sent your business profile to this investor. Please track it in Business Dashboard → Proposals.')); return; }
    setProposalBusy(true); setMsg('');
    try {
      const biz = await getMyBusiness(profile.id);
      if (!biz?.id) { navigate(toLocalizedPath('/dashboard/business', lang)); return; }
      const result = await sendBusinessProposalToInvestor({ business: biz, investorId: inv.id, message: 'Submitted from public investor detail page.' });
      if (!result.ok) {
        if (result.reason === 'quota_exceeded') setMsg(T(lang, 'Bạn đã hết hạn mức gửi Proposal. Vui lòng nâng gói hoặc gia hạn.', 'You have no proposal quota left. Please upgrade or renew your plan.'));
        else setMsg(result.message || T(lang, 'Không gửi được hồ sơ DN. Vui lòng thử lại.', 'Could not send business profile. Please try again.'));
        return;
      }
      setSentProposal(result.proposal || { status: 'sent', sent_at: new Date().toISOString() });
      const displayDate = new Date(result.proposal?.sent_at || Date.now()).toLocaleString(lang === 'en' ? 'en-US' : 'vi-VN');
      setMsg(result.reason === 'duplicate'
        ? T(lang, 'Bạn đã gửi hồ sơ DN tới nhà đầu tư này trước đó. Vui lòng theo dõi tại Dashboard DN → Proposal.', 'You already sent your business profile to this investor. Please track it in Business Dashboard → Proposals.')
        : T(lang, `Bạn đã gửi thành công ngày ${displayDate}. Hãy đợi nhà đầu tư xem xét duyệt.`, `Sent successfully on ${displayDate}. Please wait for the investor to review and approve.`));
    } catch (e: any) { setMsg(e?.message || T(lang, 'Không gửi được hồ sơ DN. Vui lòng thử lại.', 'Could not send business profile. Please try again.')); }
    finally { setProposalBusy(false); }
  }

  if (loading) return <main className="d68-investor-detail"><div className="d68-id-state">{T(lang, 'Đang tải hồ sơ nhà đầu tư...', 'Loading investor profile...')}</div></main>;
  if (error || !inv) return <main className="d68-investor-detail"><div className="d68-id-state"><h1>{T(lang, 'Không hiển thị được hồ sơ', 'Profile unavailable')}</h1><p>{error}</p><Link to={toLocalizedPath('/investors', lang)}>← {T(lang, 'Quay lại danh sách', 'Back to investors')}</Link></div></main>;

  return <main className="d68-investor-detail"><section className="d68-id-wrap">
    <div className="d68-id-breadcrumb"><Link to={toLocalizedPath('/', lang)}>{T(lang, 'Trang chủ', 'Home')}</Link> › <Link to={toLocalizedPath('/investors', lang)}>{T(lang, 'Nhà đầu tư', 'Investors')}</Link> › <b>{inv.code}</b></div>
    <div className="d68-id-layout">
      <div className="d68-id-main">
        <article className="d68-id-hero d68-id-section--card">
          <div className="d68-id-badges"><span>{labelInvestorType(inv.type, lang)}</span><span>📍 {labelCountry(inv.country_iso2 || inv.country, lang)}</span>{inv.activity_level ? <span className="gold">● {inv.activity_level}</span> : null}</div>
          <h1>{title}</h1><p>{desc}</p>
          <div className="d68-id-facts d68-id-facts--top">
            <Fact k={T(lang, 'Quốc gia', 'Country')} v={labelCountry(inv.country_iso2 || inv.country, lang)} />
            <Fact k={T(lang, 'Loại nhà đầu tư', 'Investor type')} v={labelInvestorType(inv.type, lang)} />
            <Fact k={T(lang, 'Khu vực', 'Region')} v={labelRegion(inv.region, lang)} />
            <Fact k={T(lang, 'Giai đoạn đầu tư', 'Investment stage')} v={labelStage(inv.stage, lang)} />
            <Fact k={T(lang, 'Khoản đầu tư / Ticket size', 'Ticket size')} v={ticket(lang, inv.ticket_min, inv.ticket_max)} />
            <Fact k={T(lang, 'Khu vực quan tâm', 'Target geographies')} v={markets.map((x) => labelCountry(x, lang)).join(', ')} />
          </div>
        </article>
        <section className="d68-id-section d68-id-section--card"><h2>{T(lang, 'Tiêu chí đầu tư', 'Investment criteria')}</h2><ul className="d68-id-bullets">{criteria.length ? criteria.map((x, i) => <li key={i}>{x}</li>) : <li>{T(lang, 'Chưa có tiêu chí chi tiết được Admin duyệt public.', 'No detailed Admin-approved criteria yet.')}</li>}</ul></section>
        <section className="d68-id-section d68-id-section--card"><h2>{T(lang, 'Ngành quan tâm', 'Sectors of interest')}</h2><div className="d68-id-tags">{industries.length ? industries.map((x) => <span key={x}>{labelIndustry(x, lang)}</span>) : <span>{T(lang, 'Đang cập nhật', 'Updating')}</span>}</div></section>
        <section className="d68-id-section d68-id-section--card"><h2>{T(lang, 'Lịch sử nhận Proposal', 'Proposal history')}</h2>{publicHistory.length ? <div className="d68-id-timeline">{publicHistory.map((item, idx) => <div key={idx}><i /> <span>{item}</span></div>)}</div> : <p className="d68-id-muted">{T(lang, 'Chưa có lịch sử proposal công khai được Admin duyệt.', 'No Admin-approved public proposal history yet.')}</p>}</section>
        <section className="d68-id-section d68-id-section--card"><h2>{T(lang, 'Thông tin liên hệ', 'Contact information')}</h2><p className="d68-id-muted">{T(lang, 'Chỉ Doanh nghiệp đã kết nối với Nhà đầu tư mới được xem.', 'Only businesses connected with this investor can view contact details.')}</p><div className="d68-id-contact-list"><ContactRow label={T(lang, 'Người liên hệ', 'Contact person')} value={contact?.name} unlocked={connected && !!contact?.name} /><ContactRow label="Email" value={contact?.email} unlocked={connected && !!contact?.email} /><ContactRow label={T(lang, 'Website', 'Website')} value={contact?.website} unlocked={connected && !!contact?.website} href={contact?.website} /></div></section>
      </div>
      <aside className="d68-id-side d68-id-side--sticky">
        <div className="d68-id-cta"><span>{T(lang, 'Gửi Hồ sơ Doanh nghiệp', 'Send business profile')}</span><p>{T(lang, 'Gửi hồ sơ doanh nghiệp của bạn tới nhà đầu tư này để bắt đầu kết nối.', 'Send your business profile to this investor to start the connection workflow.')}</p><button onClick={sendProposal} disabled={proposalBusy || !!sentProposal}>{sentProposal ? T(lang, 'Đã gửi hồ sơ DN', 'Profile sent') : proposalBusy ? T(lang, 'Đang gửi...', 'Sending...') : T(lang, 'Gửi hồ sơ DN', 'Send business profile')}</button><small>{sentProposal ? T(lang, 'Đã gửi. Theo dõi tại Dashboard DN → Proposal.', 'Sent. Track it in Business Dashboard → Proposals.') : T(lang, 'Proposal còn lại được kiểm tra trong Dashboard Business.', 'Remaining proposal quota is checked in the Business Dashboard.')}</small></div>
        <div className="d68-id-access"><h3>{T(lang, 'Ai được xem gì', 'Who can see what')}</h3><p>👤 {T(lang, 'Khách: chỉ xem teaser public.', 'Guests: public teaser only.')}</p><p>🏢 {T(lang, 'Business đã đăng nhập/trả phí: xem tiêu chí và gửi proposal.', 'Logged-in/paid businesses: view criteria and send proposals.')}</p><p>✅ {T(lang, 'Sau khi kết nối/duyệt: mở thông tin liên hệ theo cài đặt.', 'After approval/connection: contact details unlock according to settings.')}</p></div>
        {msg ? <div className="d68-id-msg">{msg}</div> : null}
      </aside>
    </div>
  </section></main>;
}

function Fact({ k, v }: { k: string; v: string }) { return <div className="d68-id-fact"><span>{k}</span><b>{v || '—'}</b></div>; }
function ContactRow({ label, value, unlocked, href }: { label: string; value?: string; unlocked: boolean; href?: string }) {
  const display = unlocked ? (href ? <a href={href.startsWith('http') ? href : `https://${href}`} target="_blank" rel="noreferrer">{value}</a> : value) : '🔒';
  return <div className={`d68-id-contact-row${unlocked ? ' unlocked' : ''}`}><span>{unlocked ? '✅' : '🔒'}</span><b>{label}</b><em>{display}</em></div>;
}
'''

# Write new helper and replacement pages.
write('src/lib/proposals.ts', PROPOSALS_TS)
write('src/components/Header.tsx', HEADER_TSX)
write('src/pages/InvestorDetail.tsx', INVESTOR_DETAIL_TSX)

# Update businessQuality labels.
def patch_business_quality(text: str) -> str:
    return re.sub(
        r"export function qualityBand\(score: number \| null \| undefined, lang: Lang\) \{.*?\n\}",
        """export function qualityBand(score: number | null | undefined, lang: Lang) {\n  const n = Number(score);\n  if (!Number.isFinite(n)) return { label: lang === 'en' ? 'Pending' : 'Đang cập nhật', cls: 'gold' };\n  if (n >= 85) return { label: lang === 'en' ? 'Excellent' : 'Xuất sắc', cls: 'green' };\n  if (n >= 70) return { label: lang === 'en' ? 'Good' : 'Tốt', cls: 'blue' };\n  return { label: lang === 'en' ? 'Needs data' : 'Cần bổ sung', cls: 'gold' };\n}""",
        text,
        flags=re.S,
    )
patch_file('src/lib/businessQuality.ts', patch_business_quality)

# Patch BusinessDetail only where needed.
def patch_business_detail(text: str) -> str:
    text = text.replace(
        "businessQualityPublicExplanation, normalizeQualityBreakdown, qualityItemLabel, qualityItemNote, qualityPublicCriteria",
        "businessQualityPublicExplanation, normalizeQualityBreakdown, qualityBand, qualityItemLabel, qualityItemNote, qualityPublicCriteria",
    )
    text = text.replace(
        "        setBusiness(b);",
        """        setBusiness(b);\n        if (profile?.role === 'investor' || profile?.role === 'admin') {\n          const { data: qrow } = await supabase\n            .from('businesses')\n            .select('quality_score,quality_breakdown_json,quality_breakdown')\n            .eq('id', b.id)\n            .maybeSingle()\n            .catch(() => ({ data: null } as any));\n          if (live && qrow) setBusiness({ ...b, quality_score: qrow.quality_score ?? b.quality_score, quality_breakdown_json: qrow.quality_breakdown_json ?? qrow.quality_breakdown });\n        }"""
    )
    text = text.replace(
        "  const docsToShow = docs.filter((d) => d.public_visible !== false || investorAccess);",
        """  const docsToShow = docs.filter((d) => d.public_visible !== false || investorAccess);\n  const canViewRealQuality = profile?.role === 'investor' || profile?.role === 'admin';\n  const scoreNumber = business?.quality_score === null || business?.quality_score === undefined ? null : Math.round(Number(business.quality_score));\n  const bqsBand = qualityBand(scoreNumber, lang);"""
    )
    text = text.replace(
        "{ label: 'Business Quality Score', value: quality }",
        "{ label: 'Business Quality Score', value: canViewRealQuality ? quality : T(lang, 'Chỉ nhà đầu tư đăng nhập', 'Investor login required') }",
    )
    replacement_funcs = """  async function expressInterest() {\n    if (!profile) { setMsg(T(lang, 'Bạn cần là nhà đầu tư để thao tác. Hãy đăng ký/đăng nhập tài khoản nhà đầu tư để thực hiện.', 'You need an Investor account to perform this action. Please register or log in as an investor.')); return; }\n    if (profile.role !== 'investor') { setMsg(T(lang, 'Chỉ tài khoản Nhà đầu tư được bày tỏ quan tâm.', 'Only Investor accounts can express interest.')); return; }\n    const inv = await getInvestorByOwner(profile.id).catch(() => null);\n    if (!inv?.id || !business?.id) { setMsg(T(lang, 'Không tìm thấy hồ sơ nhà đầu tư.', 'Investor profile not found.')); return; }\n    let upErr: any = null;\n    try { const rpcRes = await supabase.rpc('express_investor_interest', { investor_uuid: inv.id, business_uuid: business.id, interest_note: 'Expressed from public business detail page.' }); upErr = rpcRes.error; } catch (err: any) { upErr = err; }\n    if (upErr) { const fallback = await supabase.from('investor_interests').upsert({ investor_id: inv.id, business_id: business.id, status: 'pending' }, { onConflict: 'investor_id,business_id' }); upErr = fallback.error; }\n    setMsg(upErr ? upErr.message : T(lang, 'Đã ghi nhận quan tâm. Admin/Doanh nghiệp sẽ duyệt kết nối trước khi mở thêm dữ liệu.', 'Interest recorded. Admin/Business approval is required before additional data unlocks.'));\n  }\n  async function requestData() {\n    if (!profile) { setMsg(T(lang, 'Bạn cần là nhà đầu tư để thao tác. Hãy đăng ký/đăng nhập tài khoản nhà đầu tư để thực hiện.', 'You need an Investor account to perform this action. Please register or log in as an investor.')); return; }\n    if (profile.role !== 'investor') { setMsg(T(lang, 'Chỉ tài khoản Nhà đầu tư được yêu cầu tài liệu.', 'Only Investor accounts can request documents.')); return; }\n    const inv = await getInvestorByOwner(profile.id).catch(() => null);\n    if (!inv?.id || !business?.id) { setMsg(T(lang, 'Không tìm thấy hồ sơ nhà đầu tư.', 'Investor profile not found.')); return; }\n    const { error: reqErr } = await supabase.from('request_data').insert({ investor_id: inv.id, business_id: business.id, requested_items: ['IM', 'Financials'], note: 'Requested from public business detail page. e-NDA placeholder pending Beta completion.', status: 'pending' });\n    setMsg(reqErr ? reqErr.message : T(lang, 'Đã gửi yêu cầu tài liệu qua Deals68. Luồng e-NDA sẽ được hoàn thiện ở bước tiếp theo.', 'Data request sent via Deals68. The e-NDA flow will be completed in the next step.'));\n  }"""
    text = re.sub(r"  async function expressInterest\(\) \{.*?\n  \}\n  async function requestData\(\) \{.*?\n  \}", replacement_funcs, text, flags=re.S)
    bqs_block = """<InfoSection title=\"Business Quality Score\"><div className={`d68-bqs-card ${canViewRealQuality ? 'is-real' : 'is-demo'}`}><div className=\"d68-bqs-ring-col\"><div className=\"d68-bqs-ring\" style={{ background: `conic-gradient(${bqsBand.cls === 'green' ? '#27A844' : bqsBand.cls === 'blue' ? '#1596cc' : '#B8860B'} ${Math.max(0, Math.min(100, scoreNumber ?? 68)) * 3.6}deg, #EEF2F6 0deg)` }}><div><b>{canViewRealQuality ? (scoreNumber ?? '—') : 'BQS'}</b><span>{canViewRealQuality ? '/100' : T(lang, 'Demo', 'Demo')}</span></div></div></div><div className=\"d68-bqs-body\"><div className=\"d68-bqs-head\"><h3>Business Quality Score</h3><span className={`d68-bqs-badge ${bqsBand.cls}`}>{canViewRealQuality ? bqsBand.label : T(lang, 'Demo tiêu chí', 'Criteria demo')}</span></div><p>{businessQualityPublicExplanation(lang)}</p><div className=\"d68-bqs-chips\">{canViewRealQuality ? qualityBreakdown?.items.map((item) => <span key={item.key}>• {qualityItemLabel(item, lang)}: {item.score}/{item.max}</span>) : qualityCriteria.map((x) => <span key={x}>• {x}</span>)}</div>{canViewRealQuality ? <div className=\"d68-bqs-breakdown\">{qualityBreakdown?.items.map((item) => <div key={item.key} className=\"d68-bqs-breakdown__row\"><b>{qualityItemLabel(item, lang)}</b><span>{item.score}/{item.max}</span><small>{qualityItemNote(item, lang)}</small></div>)}</div> : <div className=\"d68-bqs-alert\">🔒 {T(lang, 'Chỉ nhà đầu tư đã đăng nhập mới xem được chi tiết Business Quality Score.', 'Only logged-in investors can view the detailed Business Quality Score.')} <Link to={`/login?role=investor&next=/businesses/${slug}`}>{T(lang, 'Đăng nhập nhà đầu tư', 'Investor login')}</Link></div>}</div></div></InfoSection>"""
    text = re.sub(r"<InfoSection title=\"Business Quality Score\"><div className=\"d68-quality-panel\">.*?</div></InfoSection>", bqs_block, text, flags=re.S)
    return text
patch_file('src/pages/BusinessDetail.tsx', patch_business_detail)

INVESTORS_TSX = r'''
import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { countInvestors, getMyBusiness, listInvestors } from '../lib/data';
import { useAuth } from '../contexts/AuthContext';
import { toLocalizedPath } from '../lib/i18nRoutes';
import { sendBusinessProposalToInvestor, listBusinessProposalStatuses, proposalQuotaTotal } from '../lib/proposals';
import { formatMoneyForLang, labelCountry, labelDealType, labelIndustry, labelInvestorType, labelRegion, labelStage, T } from '../lib/labels';
import type { Lang } from '../lib/i18n';

const PAGE_SIZE = 12;
const investorTypes = ['VC', 'PE', 'Institutional', 'Corporate/Strategic', 'Individual/Angel', 'Family Office', 'Lender/Debt'];
const regions = ['asia', 'americas', 'europe', 'oceania', 'mideast'];
const countries = ['VN', 'SG', 'US', 'JP', 'KR', 'HK', 'AU', 'DE', 'CA'];
const stages = ['Seed', 'Series A', 'Growth', 'Mature', 'Buyout'];
const dealTypes = ['Investment', 'Lending', 'M&A', 'Partnership / JV'];

type Investor = { id: string; code: string; type: string; titleVi: string; titleEn: string; descVi: string; descEn: string; country: string; countryIso: string; region: string; industries: string[]; dealTypes: string[]; stage: string; ticketMin: number; ticketMax: number; verified: boolean; activity: string };
function arr(v: any): string[] { if (Array.isArray(v)) return v.filter(Boolean).map(String); if (!v) return []; return String(v).split(/[;,]/).map((x) => x.trim()).filter(Boolean); }
function normalize(inv: any): Investor { const code = inv.code || inv.id; const titleVi = inv.title_vi || code || 'Hồ sơ nhà đầu tư đang cập nhật'; return { id: String(inv.id || code), code: String(code), type: inv.type || 'Investor', titleVi, titleEn: inv.title_en || titleVi, descVi: inv.desc_vi || '', descEn: inv.desc_en || inv.desc_vi || '', country: inv.country || inv.country_iso2 || 'Global', countryIso: inv.country_iso2 || '', region: inv.region || 'global', industries: arr(inv.industries), dealTypes: arr(inv.deal_types), stage: inv.stage || 'Any', ticketMin: Number(inv.ticket_min || 0), ticketMax: Number(inv.ticket_max || 0), verified: inv.verified === true, activity: inv.activity_level || (inv.verified ? 'medium' : 'pending') }; }
function ticket(lang: Lang, i: Investor) { if (!i.ticketMin && !i.ticketMax) return T(lang, 'Đang cập nhật', 'Updating'); if (i.ticketMin && i.ticketMax) return `${formatMoneyForLang(i.ticketMin, 'USD', lang)} – ${formatMoneyForLang(i.ticketMax, 'USD', lang)}`; return i.ticketMax ? `≤ ${formatMoneyForLang(i.ticketMax, 'USD', lang)}` : `≥ ${formatMoneyForLang(i.ticketMin, 'USD', lang)}`; }
function activityLabel(lang: Lang, a: string) { const v = String(a || '').toLowerCase(); if (v.includes('high')) return T(lang, 'Hoạt động cao', 'High activity'); if (v.includes('medium')) return T(lang, 'Hoạt động vừa', 'Medium activity'); return T(lang, 'Đang cập nhật', 'Updating'); }
function Skeleton() { return <div className="d68-investor-card d68-investor-card--loading"><div/><section/></div>; }
function InvestorCard({ inv, lang, onProposal, proposalState, quotaExceeded, busy }: { inv: Investor; lang: Lang; onProposal: () => void; proposalState?: string; quotaExceeded?: boolean; busy?: boolean }) {
  const sent = !!proposalState;
  const disabled = busy || sent || quotaExceeded;
  return <article className="d68-investor-card"><div className="d68-investor-card__icon">{labelInvestorType(inv.type, lang).slice(0,2).toUpperCase()}</div><div className="d68-investor-card__body"><div className="d68-investor-card__badges"><span>{labelInvestorType(inv.type, lang)}</span><span>📍 {labelCountry(inv.countryIso || inv.country, lang)}</span>{inv.verified ? <span className="verified">✓ {T(lang,'Xác minh','Verified')}</span> : null}<em>● {activityLabel(lang, inv.activity)}</em></div><h3>{T(lang, inv.titleVi, inv.titleEn)}</h3><p>{T(lang, inv.descVi || 'Hồ sơ ẩn danh đang được cập nhật tiêu chí đầu tư.', inv.descEn || 'Anonymous profile updating investment criteria.')}</p><div className="d68-investor-card__meta"><span><b>{T(lang, 'Khoản đầu tư', 'Ticket')}:</b> {ticket(lang, inv)}</span><span><b>{T(lang,'Ngành','Industries')}:</b> {inv.industries.map((x) => labelIndustry(x, lang)).join(', ') || T(lang, 'Đang cập nhật', 'Updating')}</span><span><b>{T(lang,'Loại giao dịch','Deal type')}:</b> {inv.dealTypes.map((x) => labelDealType(x, lang, true)).join(', ') || T(lang, 'Đang cập nhật', 'Updating')}</span><span><b>{T(lang,'Giai đoạn','Stage')}:</b> {labelStage(inv.stage, lang)}</span></div></div><div className="d68-investor-card__actions"><Link to={toLocalizedPath(`/investors/${inv.code}`, lang)}>{T(lang, 'Xem chi tiết', 'View detail')}</Link><button onClick={onProposal} disabled={disabled}>{busy ? T(lang, 'Đang gửi...', 'Sending...') : sent ? T(lang, 'Đã gửi', 'Sent') : quotaExceeded ? T(lang, 'Hết hạn mức', 'Quota used') : T(lang, 'Gửi hồ sơ DN', 'Send business proposal')}</button></div></article>;
}

export default function Investors({ lang }: { lang: Lang }) {
  const { profile } = useAuth(); const navigate = useNavigate(); const location = useLocation();
  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const [items, setItems] = useState<Investor[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [total, setTotal] = useState<number | null>(null); const [page, setPage] = useState(1);
  const [type, setType] = useState(() => params.get('type') || ''); const [region, setRegion] = useState(() => params.get('region') || ''); const [country, setCountry] = useState(() => params.get('country') || ''); const [industry, setIndustry] = useState(() => params.get('industry') || ''); const [stage, setStage] = useState(() => params.get('stage') || ''); const [dealType, setDealType] = useState(() => params.get('dealType') || ''); const [minTicket, setMinTicket] = useState(() => params.get('minTicket') || ''); const [search, setSearch] = useState(() => params.get('search') || params.get('q') || ''); const [feedback, setFeedback] = useState('');
  const [myBusiness, setMyBusiness] = useState<any>(null); const [sentMap, setSentMap] = useState<Record<string, string>>({}); const [sendingId, setSendingId] = useState('');
  useEffect(() => { const p = new URLSearchParams(location.search); setType(p.get('type') || ''); setRegion(p.get('region') || ''); setCountry(p.get('country') || ''); setIndustry(p.get('industry') || ''); setStage(p.get('stage') || ''); setDealType(p.get('dealType') || ''); setMinTicket(p.get('minTicket') || ''); setSearch(p.get('search') || p.get('q') || ''); setPage(1); }, [location.search]);
  useEffect(() => { let live = true; async function load() { setLoading(true); setError(''); const filters = { limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE, type: type || undefined, region: region || undefined, country: country || undefined, industry: industry || undefined, stage: stage || undefined, dealType: dealType || undefined, minTicket: minTicket || undefined, search: search || undefined }; try { const [data, cnt] = await Promise.all([listInvestors(filters), countInvestors(filters).catch(() => null)]); if (!live) return; setItems((data || []).map(normalize)); setTotal(cnt); } catch (e: any) { if (!live) return; setItems([]); setTotal(0); setError(e?.message || T(lang, 'Không tải được dữ liệu nhà đầu tư.', 'Could not load investors.')); } finally { if (live) setLoading(false); } } load(); return () => { live = false; }; }, [page, type, region, country, industry, stage, dealType, minTicket, search, lang]);
  useEffect(() => { let live = true; async function loadBusinessProposalState() { setMyBusiness(null); setSentMap({}); if (!profile || profile.role !== 'business') return; const biz = await getMyBusiness(profile.id).catch(() => null); if (!live) return; setMyBusiness(biz || null); if (biz?.id) { const rows = await listBusinessProposalStatuses(biz.id).catch(() => []); if (live) setSentMap(Object.fromEntries(rows.map((r: any) => [r.investor_id, r.status || 'sent']))); } } loadBusinessProposalState(); return () => { live = false; }; }, [profile?.id, profile?.role, items.length]);
  const pages = useMemo(() => total === null ? null : Math.max(1, Math.ceil(total / PAGE_SIZE)), [total]);
  const quotaTotal = proposalQuotaTotal(myBusiness); const quotaUsed = Object.keys(sentMap).length; const quotaExceeded = !!myBusiness && quotaUsed >= quotaTotal;
  function clearFilters() { setType(''); setRegion(''); setCountry(''); setIndustry(''); setStage(''); setDealType(''); setMinTicket(''); setSearch(''); setPage(1); }
  async function proposal(inv: Investor) { if (!profile) { navigate(toLocalizedPath('/register/business', lang)); return; } if (profile.role !== 'business') { setFeedback(T(lang, 'Chỉ tài khoản Doanh nghiệp được gửi proposal.', 'Only Business accounts can send proposals.')); return; } const biz = myBusiness || await getMyBusiness(profile.id).catch(() => null); if (!biz?.id) { setFeedback(T(lang, 'Tài khoản chưa có hồ sơ Doanh nghiệp để gửi.', 'No Business profile found for this account.')); return; } setSendingId(inv.id); const result = await sendBusinessProposalToInvestor({ business: biz, investorId: inv.id, message: 'Submitted from Investors listing page.' }).catch((e) => ({ ok: false, reason: 'error' as const, message: e?.message })); setSendingId(''); if (!result.ok) { setFeedback(result.reason === 'quota_exceeded' ? T(lang, 'Bạn đã hết hạn mức gửi Proposal. Vui lòng nâng gói hoặc gia hạn.', 'You have no proposal quota left. Please upgrade or renew.') : (result.message || T(lang, 'Không gửi được proposal.', 'Could not send proposal.'))); return; } setSentMap((cur) => ({ ...cur, [inv.id]: result.proposal?.status || 'sent' })); setFeedback(result.reason === 'duplicate' ? T(lang, 'Bạn đã gửi proposal cho nhà đầu tư này trước đó.', 'You already sent a proposal to this investor.') : T(lang, 'Đã gửi proposal thành công với trạng thái sent.', 'Proposal sent successfully with status sent.')); }
  return <main className="d68-investors-page"><section className="d68-investors-title"><div><Link to={toLocalizedPath('/', lang)}>{T(lang, 'Trang chủ', 'Home')}</Link> › <b>{T(lang, 'Nhà đầu tư', 'Investors')}</b></div><h1>{T(lang, 'Nhà đầu tư trên Deals68', 'Investors on Deals68')}</h1><p>{T(lang, 'Danh sách lấy từ Supabase active/visible, không dùng hồ sơ nhà đầu tư giả khi tải lỗi.', 'List is loaded from active/visible Supabase records; no fake investor profiles are shown on error.')}</p></section><section className="d68-investors-layout"><aside className="d68-investors-sidebar"><header><b>{T(lang, 'Bộ lọc', 'Filters')}</b><button onClick={clearFilters}>{T(lang, 'Xóa lọc', 'Clear')}</button></header><label>{T(lang, 'Tìm kiếm', 'Search')}<input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="keyword..." /></label><label>{T(lang, 'Loại nhà đầu tư', 'Investor type')}<select value={type} onChange={(e) => { setType(e.target.value); setPage(1); }}><option value="">{T(lang, 'Tất cả', 'All')}</option>{investorTypes.map((x) => <option key={x} value={x}>{labelInvestorType(x, lang)}</option>)}</select></label><label>{T(lang, 'Khu vực', 'Region')}<select value={region} onChange={(e) => { setRegion(e.target.value); setPage(1); }}><option value="">{T(lang, 'Tất cả', 'All')}</option>{regions.map((x) => <option key={x} value={x}>{labelRegion(x, lang)}</option>)}</select></label><label>{T(lang, 'Quốc gia', 'Country')}<select value={country} onChange={(e) => { setCountry(e.target.value); setPage(1); }}><option value="">{T(lang, 'Tất cả', 'All')}</option>{countries.map((x) => <option key={x} value={x}>{labelCountry(x, lang)}</option>)}</select></label><label>{T(lang, 'Ngành quan tâm', 'Preferred industry')}<input value={industry} onChange={(e) => { setIndustry(e.target.value); setPage(1); }} placeholder={T(lang, 'F&B, Công nghệ...', 'F&B, Technology...')} /></label><label>{T(lang, 'Loại giao dịch', 'Deal type')}<select value={dealType} onChange={(e) => { setDealType(e.target.value); setPage(1); }}><option value="">{T(lang, 'Tất cả', 'All')}</option>{dealTypes.map((x) => <option key={x} value={x}>{labelDealType(x, lang, true)}</option>)}</select></label><label>{T(lang, 'Giai đoạn', 'Stage')}<select value={stage} onChange={(e) => { setStage(e.target.value); setPage(1); }}><option value="">{T(lang, 'Tất cả', 'All')}</option>{stages.map((x) => <option key={x} value={x}>{labelStage(x, lang)}</option>)}</select></label><label>{T(lang, 'Khoản đầu tư tối thiểu', 'Minimum ticket')}<select value={minTicket} onChange={(e) => { setMinTicket(e.target.value); setPage(1); }}><option value="">{T(lang, 'Tất cả', 'All')}</option><option value="100000">≤ $100K</option><option value="1000000">≤ $1M</option><option value="5000000">≤ $5M</option><option value="50000000">≤ $50M</option></select></label></aside><div className="d68-investors-results"><div className="d68-investors-toolbar"><span>{loading ? T(lang, 'Đang tải dữ liệu thật...', 'Loading live data...') : `${items.length}${total !== null ? ` / ${total}` : ''} ${T(lang, 'hồ sơ', 'profiles')}`}</span><span>{myBusiness ? `${T(lang, 'Proposal đã gửi', 'Proposals sent')}: ${quotaUsed}/${quotaTotal}` : T(lang, 'Nguồn: Supabase active + visible', 'Source: Supabase active + visible')}</span></div>{feedback ? <div className="d68-investors-feedback">{feedback}</div> : null}{error ? <div className="d68-investors-error">{error}</div> : null}<div className="d68-investor-list">{loading ? Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} />) : items.map((inv) => <InvestorCard key={inv.id} inv={inv} lang={lang} onProposal={() => proposal(inv)} proposalState={sentMap[inv.id]} quotaExceeded={quotaExceeded && !sentMap[inv.id]} busy={sendingId === inv.id} />)}</div>{!loading && !error && !items.length ? <div className="d68-investors-empty"><b>{T(lang, 'Chưa có nhà đầu tư phù hợp.', 'No matching investor profiles.')}</b></div> : null}<div className="d68-investors-pages"><button disabled={page <= 1 || loading} onClick={() => setPage((p) => Math.max(1, p - 1))}>←</button><span>{page}{pages ? ` / ${pages}` : ''}</span><button disabled={loading || (pages !== null && page >= pages)} onClick={() => setPage((p) => p + 1)}>→</button></div></div></section></main>;
}
'''
write('src/pages/Investors.tsx', INVESTORS_TSX)

# App route for admin proposals.
def patch_app(text: str) -> str:
    text = text.replace("const Admin = lazy(() => import('./pages/Admin'));", "const Admin = lazy(() => import('./pages/Admin'));\nconst AdminProposals = lazy(() => import('./pages/AdminProposals'));")
    text = text.replace("        <Route path=\"/admin/valuation-config\" element={<AdminValuation/>}/>", "        <Route path=\"/admin/valuation-config\" element={<AdminValuation/>}/>\n        <Route path=\"/admin/proposals\" element={<AdminProposals/>}/>")
    return text
patch_file('src/App.tsx', patch_app)

ADMIN_PROPOSALS_TSX = r'''
import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { proposalStatusLabel, updateProposalStatus, type ProposalStatus } from '../lib/proposals';

type Row = Record<string, any>;
const statuses: ProposalStatus[] = ['sent', 'approved', 'declined', 'request_data', 'connected'];
function text(v: any) { return String(v ?? '').trim(); }
function dt(v: any) { const d = v ? new Date(v) : new Date(); return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('vi-VN'); }

export default function AdminProposals() {
  const { profile, loading, signOut } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  async function load() {
    if (profile?.role !== 'admin') return;
    setBusy(true); setError('');
    const { data, error } = await supabase
      .from('proposals')
      .select('id,business_id,investor_id,message,status,sent_at,updated_at,businesses(id,slug,company_name_private,title_vi,title_en,public_code),investors(id,code,private_name,title_vi,title_en,private_email)')
      .order('sent_at', { ascending: false })
      .limit(1000);
    setRows(data || []);
    setError(error?.message || '');
    setBusy(false);
  }
  useEffect(() => { if (profile?.role === 'admin') load(); }, [profile?.role]);

  const filtered = useMemo(() => rows.filter((row) => {
    if (status && row.status !== status) return false;
    const key = [row.status, row.businesses?.company_name_private, row.businesses?.title_vi, row.businesses?.title_en, row.businesses?.public_code, row.investors?.private_name, row.investors?.title_vi, row.investors?.title_en, row.investors?.code, row.investors?.private_email].join(' ').toLowerCase();
    return !search.trim() || key.includes(search.toLowerCase());
  }), [rows, status, search]);

  async function mark(row: Row, next: ProposalStatus) {
    try { await updateProposalStatus(row.id, next); setMsg('Proposal updated.'); await load(); }
    catch (e: any) { setError(e?.message || 'Could not update proposal.'); }
  }

  if (loading) return <section className="d68-admin-page"><div className="d68-admin-wrap"><div className="d68-admin-card">Loading admin...</div></div></section>;
  if (profile?.role !== 'admin') return <Navigate to="/login?next=/admin/proposals" replace />;

  return <section className="d68-admin-page"><header className="d68-admin-head"><div className="d68-admin-head__inner"><Link to="/"><img src="/assets/logo-nav.svg" alt="Deals68" /></Link><b>Admin Proposals</b><span>👤 {profile.email || 'admin'}</span><button onClick={() => signOut()}>Thoát</button></div></header><div className="d68-admin-wrap"><div className="d68-admin-cols"><nav className="d68-admin-side"><Link to="/admin">📊 Tổng quan</Link><Link to="/admin/proposals" className="active">📨 Proposal</Link><Link to="/admin/businesses">🏢 Doanh nghiệp</Link><Link to="/admin/investors">📈 Nhà đầu tư</Link><Link to="/admin/data-requests">📂 Yêu cầu data</Link></nav><main><div className="d68-admin-title"><div><h1>Proposal Business → Investor</h1><p>Theo dõi toàn bộ proposal, trạng thái và link hồ sơ liên quan.</p></div><button onClick={load} className="d68-admin-btn">{busy ? 'Loading...' : 'Refresh'}</button></div>{msg ? <div className="d68-admin-notice ok">{msg}</div> : null}{error ? <div className="d68-admin-notice err">{error}</div> : null}<div className="d68-admin-form4 d68-admin-form-gap"><input className="d68-admin-input d68-admin-span2" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search DN / Investor / email / status..."/><select className="d68-admin-input" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">Tất cả trạng thái</option>{statuses.map((s) => <option key={s} value={s}>{proposalStatusLabel(s, 'vi').label}</option>)}</select></div><div className="d68-admin-table-wrap"><table className="d68-admin-table"><thead><tr><th>Thời gian</th><th>Doanh nghiệp</th><th>Investor</th><th>Email</th><th>Status</th><th>Action</th></tr></thead><tbody>{filtered.map((row) => { const st = proposalStatusLabel(row.status, 'vi'); return <tr key={row.id}><td>{dt(row.sent_at)}</td><td><b>{text(row.businesses?.company_name_private) || 'Tên thật chưa có'}</b><br/><span className="d68-admin-badge warn">{row.businesses?.public_code || row.business_id}</span><br/>{row.businesses?.slug ? <Link to={`/businesses/${row.businesses.slug}`}>Public DN ↗</Link> : null}</td><td><b>{text(row.investors?.private_name) || text(row.investors?.title_vi) || row.investors?.code || row.investor_id}</b><br/><span>{row.investors?.title_vi || row.investors?.title_en || 'Public investor'}</span><br/>{row.investors?.code ? <Link to={`/investors/${row.investors.code}`}>Public Investor ↗</Link> : null}</td><td>{row.investors?.private_email || '—'}</td><td><span className={`d68-admin-badge ${st.cls === 'green' ? 'ok' : st.cls === 'red' ? 'err' : 'warn'}`}>{st.label}</span></td><td><div className="d68-admin-actions"><button className="d68-admin-btn green" onClick={() => mark(row, 'approved')}>Duyệt</button><button className="d68-admin-btn red" onClick={() => mark(row, 'declined')}>Bỏ qua</button><button className="d68-admin-btn blue" onClick={() => mark(row, 'connected')}>Connected</button></div></td></tr>; })}</tbody></table>{!filtered.length ? <div className="d68-admin-empty">No proposals.</div> : null}</div></main></div></div></section>;
}
'''
write('src/pages/AdminProposals.tsx', ADMIN_PROPOSALS_TSX)

# Investor dashboard replacement.
INVESTOR_DASHBOARD_TSX = r'''
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getInvestorByOwner, listBusinesses } from '../lib/data';
import { supabase } from '../lib/supabase';
import { computeFitScore } from '../lib/scoring';
import { formatCompactMoney } from '../lib/format';
import { proposalStatusLabel, updateProposalStatus, type ProposalStatus } from '../lib/proposals';

type Lang = 'vi' | 'en';
type Tab = 'profile' | 'recommended' | 'watchlist' | 'proposals' | 'alerts' | 'contacts' | 'security';
const T = (lang: Lang, vi: string, en: string) => lang === 'en' ? en : vi;
const tabs: { id: Tab; icon: string; vi: string; en: string; href: string }[] = [
  { id: 'profile', icon: '✎', vi: 'Hồ sơ', en: 'Profile', href: '/dashboard/investor/profile' },
  { id: 'recommended', icon: '◆', vi: 'Tiêu chí & gợi ý', en: 'Criteria & matches', href: '/dashboard/investor/recommended' },
  { id: 'watchlist', icon: '★', vi: 'Đã lưu', en: 'Watchlist', href: '/dashboard/investor/saved' },
  { id: 'proposals', icon: '📨', vi: 'Proposal đã nhận', en: 'Received proposals', href: '/dashboard/investor/proposals' },
  { id: 'alerts', icon: '🔔', vi: 'Cảnh báo', en: 'Alerts', href: '/dashboard/investor/alerts' },
  { id: 'contacts', icon: '🔒', vi: 'Liên hệ & bảo mật', en: 'Contacts & privacy', href: '/dashboard/investor/privacy' },
  { id: 'security', icon: '⚙', vi: 'Bảo mật', en: 'Security', href: '/dashboard/investor/security' }
];
const tabMap: Record<string, Tab> = { '': 'profile', profile: 'profile', criteria: 'recommended', recommended: 'recommended', saved: 'watchlist', watchlist: 'watchlist', proposals: 'proposals', alerts: 'alerts', privacy: 'contacts', contacts: 'contacts', security: 'security' };
const INVESTOR_TYPES = ['VC','PE','Institutional','Corporate/Strategic','Individual/Angel','Family Office','Lender/Debt'];
const INDUSTRIES = ['F&B','Y tế & Sức khỏe','Bán lẻ','Sản xuất','Công nghệ','Logistics','Giáo dục','Bất động sản','Thủy sản & Xuất khẩu','Business Services'];
const DEAL_TYPES = ['Gọi vốn','M&A','Bán cổ phần','Vay vốn','JV / Đối tác'];
const STAGES = ['Seed','Series A','Growth','Mature','Buyout'];
const COUNTRIES = ['Việt Nam','Singapore','United States','Japan','South Korea','Hong Kong','UAE'];
function resolveTab(pathname: string): Tab { const suffix = pathname.replace('/dashboard/investor','').replace(/^\//,'').split('/')[0]; return tabMap[suffix] || 'profile'; }
function arr(value: any): string[] { if (Array.isArray(value)) return value.filter(Boolean).map(String); if (!value) return []; return String(value).split(/[;,]/).map((x) => x.trim()).filter(Boolean); }
function businessTitle(b: any, lang: Lang) { return lang === 'en' ? (b.title_en || b.title_vi || b.public_code) : (b.title_vi || b.title_en || b.public_code); }
function countryIsoFromName(c: string) { const m: Record<string,string> = { 'Việt Nam':'VN', Vietnam:'VN', Singapore:'SG', 'United States':'US', Japan:'JP', 'South Korea':'KR', 'Hong Kong':'HK', UAE:'AE' }; return m[c] || ''; }
function regionFromCountry(c: string) { if (['United States'].includes(c)) return 'americas'; if (['UAE'].includes(c)) return 'mideast'; return 'asia'; }
function qBadge(score: any) { const n = Number(score || 0); if (n >= 85) return 'green'; if (n >= 70) return 'blue'; return 'gold'; }
function fmtDate(value: any) { const d = value ? new Date(value) : new Date(); return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString(); }

export default function InvestorDashboard() {
  const { profile, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [lang, setLang] = useState<Lang>('vi');
  const [tab, setTab] = useState<Tab>(() => resolveTab(location.pathname));
  const [inv, setInv] = useState<any>(null);
  const [allBiz, setAllBiz] = useState<any[]>([]);
  const [saved, setSaved] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [interests, setInterests] = useState<any[]>([]);
  const [proposals, setProposals] = useState<any[]>([]);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [filterIndustries, setFilterIndustries] = useState<string[]>([]);
  const [revBand, setRevBand] = useState('all');
  const [ebBand, setEbBand] = useState('all');

  useEffect(() => setTab(resolveTab(location.pathname)), [location.pathname]);

  async function load() {
    if (!profile) return;
    setBusy(true); setErr('');
    try {
      const i = await getInvestorByOwner(profile.id);
      setInv(i);
      const biz = await listBusinesses({ limit: 60 });
      setAllBiz(biz || []);
      if (i) {
        const [{ data: s }, { data: r }, { data: int }, { data: prop, error: propErr }] = await Promise.all([
          supabase.from('saved_businesses').select('*, businesses(public_code,title_vi,title_en,slug,quality_score,industry,revenue_2025,revenue_currency,ask_amount,ask_currency,image_url)').eq('investor_id', i.id).order('created_at', { ascending: false }),
          supabase.from('request_data').select('*, businesses(public_code,title_vi,title_en,slug,quality_score)').eq('investor_id', i.id).order('created_at', { ascending: false }),
          supabase.from('investor_interests').select('*, businesses(public_code,title_vi,title_en,slug,quality_score,ask_amount,ask_currency,stake_pct)').eq('investor_id', i.id).order('created_at', { ascending: false }),
          supabase.from('proposals').select('*, businesses(public_code,title_vi,title_en,slug,city,industry,ask_amount,ask_currency,revenue_currency,quality_score,quality_breakdown_json)').eq('investor_id', i.id).order('sent_at', { ascending: false })
        ]);
        setSaved(s || []); setRequests(r || []); setInterests(int || []); setProposals(propErr ? [] : (prop || []));
        setFilterIndustries(arr(i.industries).slice(0, 4));
      }
    } catch (e: any) { setErr(e?.message || 'Could not load investor dashboard.'); }
    finally { setBusy(false); }
  }
  useEffect(() => { if (!loading && !profile) navigate('/login?next=/dashboard/investor'); if (profile) load(); }, [profile?.id, loading]);

  const recommended = useMemo(() => { if (!inv) return []; return allBiz.map((b) => ({ ...b, fit: computeFitScore(b, inv) })).filter((b) => { if (filterIndustries.length && !filterIndustries.some((x) => String(b.industry || '').toLowerCase().includes(x.toLowerCase()))) return false; const rev = Number(b.revenue_2025 || 0); const cur = String(b.revenue_currency || 'VND'); const revUsd = cur === 'USD' ? rev : rev / 26000; if (revBand === '0-1m' && revUsd > 1_000_000) return false; if (revBand === '1-10m' && (revUsd < 1_000_000 || revUsd > 10_000_000)) return false; if (revBand === '10m+' && revUsd < 10_000_000) return false; const eb = Number(b.ebitda_margin || 0); if (ebBand === '0-10' && eb > 10) return false; if (ebBand === '10-20' && (eb < 10 || eb > 20)) return false; if (ebBand === '20+' && eb < 20) return false; return b.fit >= 20; }).sort((a, b) => b.fit - a.fit).slice(0, 12); }, [allBiz, inv, filterIndustries, revBand, ebBand]);

  if (loading) return <main className="d68-dashboard-page"><div className="d68-dashboard-wrap"><div className="d68-dashboard-card">Loading investor dashboard...</div></div></main>;
  if (!profile) return <Navigate to="/login?next=/dashboard/investor" replace />;
  if (profile.role !== 'investor' && profile.role !== 'admin') return <main className="d68-dashboard-page"><div className="d68-dashboard-wrap"><div className="d68-dashboard-card"><h2>Investor access only</h2><p>Role hiện tại: {profile.role}</p><Link to="/">Back home</Link></div></div></main>;
  if (!inv) return <main className="d68-dashboard-page"><div className="d68-dashboard-wrap"><div className="d68-dashboard-card" style={{ textAlign: 'center' }}><h2>{T(lang, 'Chưa có hồ sơ nhà đầu tư', 'Investor profile not found')}</h2><p>{T(lang, 'Tài khoản này chưa có hồ sơ NĐT hoặc đang chờ Admin duyệt.', 'This account has no investor profile yet or is pending Admin review.')}</p><Link to="/register/investor" className="d68-dashboard-btn">{T(lang, 'Tạo hồ sơ NĐT', 'Create investor profile')}</Link></div></div></main>;

  const invName = lang === 'en' ? (inv.title_en || inv.title_vi || 'Investor') : (inv.title_vi || inv.title_en || 'Nhà đầu tư');
  const pendingProfile = inv.privacy?.pending_profile_changes;
  const invIndustries = arr(inv.industries);
  const invDealTypes = arr(inv.deal_types);
  const country = inv.country || 'Việt Nam';

  async function saveProfile(e: FormEvent) { e.preventDefault(); const fd = new FormData(e.currentTarget as HTMLFormElement); const sectors = String(fd.get('industries') || '').split(',').map((x) => x.trim()).filter(Boolean); const dealTypes = String(fd.get('deal_types') || '').split(',').map((x) => x.trim()).filter(Boolean); const next = { title_vi: String(fd.get('title_vi') || '').trim(), title_en: String(fd.get('title_en') || '').trim(), desc_vi: String(fd.get('desc_vi') || '').trim(), desc_en: String(fd.get('desc_en') || '').trim(), type: String(fd.get('type') || '').trim(), country: String(fd.get('country') || '').trim(), country_iso2: countryIsoFromName(String(fd.get('country') || '')) || inv.country_iso2, region: regionFromCountry(String(fd.get('country') || country)), industries: sectors, deal_types: dealTypes, stage: String(fd.get('stage') || '').trim(), ticket_min: Number(fd.get('ticket_min') || 0), ticket_max: Number(fd.get('ticket_max') || 0), criteria: { ...(inv.criteria || {}), riskAppetite: fd.get('risk_appetite'), returnExpectation: fd.get('return_expectation'), preferredDealSize: fd.get('preferred_deal_size'), excludedSectors: fd.get('excluded_sectors') } }; const privacy = { ...(inv.privacy || {}), pending_profile_changes: next, pending_submitted_at: new Date().toISOString() }; const privatePatch = { privacy, private_name: String(fd.get('private_name') || '').trim(), private_website: String(fd.get('private_website') || '').trim() }; const { error } = await supabase.from('investors').update(privatePatch).eq('id', inv.id); setErr(error?.message || ''); setMsg(error ? '' : T(lang, 'Đã lưu thay đổi, chờ Admin duyệt để hiển thị các cập nhật và đảm bảo luôn ẩn danh.', 'Saved changes, pending Admin approval to display updates while keeping the profile anonymous.')); load(); }
  async function savePrivacy(e: FormEvent) { e.preventDefault(); const fd = new FormData(e.currentTarget as HTMLFormElement); const privacy = { ...(inv.privacy || {}), shareEmail: fd.get('shareEmail') === 'on', email: fd.get('email'), sharePhone: fd.get('sharePhone') === 'on', phone: fd.get('phone'), website: fd.get('website'), shareWebsite: fd.get('shareWebsite') === 'on' }; const { error } = await supabase.from('investors').update({ privacy, private_email: fd.get('email'), private_phone: fd.get('phone'), private_website: fd.get('website') }).eq('id', inv.id); setErr(error?.message || ''); setMsg(error ? '' : T(lang, 'Đã cập nhật bảo mật liên hệ.', 'Contact privacy updated.')); load(); }
  async function requestMoreData(businessId: string) { const { error } = await supabase.from('request_data').insert({ business_id: businessId, investor_id: inv.id, requested_items: ['IM', 'Financial statements', 'NDA'], note: 'Investor requested more data from dashboard.', status: 'pending' }); setErr(error?.message || ''); setMsg(error ? '' : T(lang, 'Đã gửi yêu cầu dữ liệu.', 'Data request sent.')); load(); }
  async function saveBusiness(businessId: string) { const { error } = await supabase.from('saved_businesses').upsert({ business_id: businessId, investor_id: inv.id }, { onConflict: 'investor_id,business_id' }); setErr(error?.message || ''); setMsg(error ? '' : T(lang, 'Đã lưu doanh nghiệp.', 'Business saved.')); load(); }
  async function markProposal(row: any, status: ProposalStatus) { try { await updateProposalStatus(row.id, status); setMsg(T(lang, 'Đã cập nhật trạng thái Proposal.', 'Proposal status updated.')); await load(); } catch (e: any) { setErr(e?.message || 'Could not update proposal.'); } }
  async function requestProposalData(row: any) { try { await updateProposalStatus(row.id, 'request_data'); await supabase.from('request_data').insert({ business_id: row.business_id, investor_id: inv.id, requested_items: ['IM', 'Financial statements', 'NDA'], note: 'Investor requested documents from received proposal. e-NDA placeholder pending Beta completion.', status: 'pending' }).catch(() => ({ error: null } as any)); setMsg(T(lang, 'Đã chuyển Proposal sang trạng thái yêu cầu tài liệu.', 'Proposal moved to data-request status.')); await load(); } catch (e: any) { setErr(e?.message || 'Could not request data.'); } }

  function businessCard(b: any) { const q = Number(b.quality_score || b.data_confidence || 0); return <article key={b.id || b.slug} className="d68-match-card"><div className="d68-match-card__media">{b.image_url ? <img src={b.image_url} alt={businessTitle(b, lang)} /> : null}<span>Fit {b.fit ?? q}</span></div><div className="d68-match-card__body"><span className="d68-dashboard-badge blue" style={{ alignSelf: 'flex-start' }}>{b.industry || 'Business'}</span><h3>{businessTitle(b, lang)}</h3><div className="d68-match-card__metrics"><div><small>{T(lang,'Doanh thu','Revenue')}</small><b>{formatCompactMoney(b.revenue_2025, b.revenue_currency)}</b></div><div><small>{T(lang,'Nhu cầu','Ask')}</small><b>{formatCompactMoney(b.ask_amount, b.ask_currency)}</b></div></div><div style={{ display: 'flex', gap: 8 }}><Link to={`/businesses/${b.slug}`} className="d68-dashboard-btn" style={{ flex: 1, textAlign: 'center' }}>{T(lang,'Xem hồ sơ','View')}</Link><button onClick={() => saveBusiness(b.id)} className="d68-dashboard-btn light">★</button><button onClick={() => requestMoreData(b.id)} className="d68-dashboard-btn light">📂</button></div></div></article>; }

  return <main className="d68-dashboard-page"><div className="d68-dashboard-wrap"><header className="d68-dashboard-head"><div><div className="d68-dashboard-kicker">Investor Dashboard</div><h1>{invName} <span className="d68-dashboard-muted" style={{ fontSize: 16, fontWeight: 500 }}>· {inv.type}</span> <span className="d68-dashboard-mini">{inv.code}</span></h1></div><div className="d68-dashboard-actions"><button onClick={() => setLang(lang === 'vi' ? 'en' : 'vi')} className="d68-dashboard-btn light">{lang.toUpperCase()}</button><button onClick={() => signOut().then(() => navigate('/'))} className="d68-dashboard-btn light" style={{ background: '#475569', color: '#fff', borderColor: '#334155' }}>{T(lang,'Thoát','Exit')}</button></div></header>{msg ? <div className="d68-dashboard-notice ok">{msg}</div> : null}{err ? <div className="d68-dashboard-notice err">{err}</div> : null}{busy ? <div className="d68-dashboard-notice warn">{T(lang,'Đang tải dữ liệu...','Loading data...')}</div> : null}{pendingProfile ? <div className="d68-dashboard-notice warn">{T(lang,'Có thay đổi hồ sơ đang chờ Admin duyệt. Public profile vẫn dùng bản đang được duyệt trước đó.', 'Profile changes are pending Admin review. Public profile still uses the current approved data.')}</div> : null}<div className="d68-dashboard-cols"><nav className="d68-dashboard-side">{tabs.map((t) => <Link key={t.id} to={t.href} onClick={() => setTab(t.id)} className={tab === t.id ? 'active' : ''}>{t.icon} {T(lang,t.vi,t.en)}</Link>)}<div style={{ borderTop: '1px solid #EEF2F6', marginTop: 6, paddingTop: 10 }}><Link to={`/investors/${inv.code}`} style={{ textAlign: 'center', color: '#1596cc' }}>{T(lang,'Xem public profile','View public profile')} ↗</Link></div></nav><section>
    {tab === 'profile' ? <form onSubmit={saveProfile} className="d68-dashboard-card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}><h2>{T(lang,'Hồ sơ đầu tư','Investor profile')}</h2><label className="d68-dashboard-field"><span>{T(lang,'Tên Quỹ đầu tư / Nhà đầu tư — nội bộ, không public','Fund / investor name — internal, not public')}</span><input className="d68-dashboard-input" name="private_name" defaultValue={inv.private_name || inv.privacy?.private_name || ''}/></label><label className="d68-dashboard-field"><span>Website</span><input className="d68-dashboard-input" name="private_website" defaultValue={inv.private_website || inv.privacy?.website || ''}/></label><label className="d68-dashboard-field"><span>{T(lang,'Tên nhà đầu tư public','Public investor title')}</span><input className="d68-dashboard-input" name="title_vi" defaultValue={pendingProfile?.title_vi || inv.title_vi || inv.title_en || ''}/></label><label className="d68-dashboard-field"><span>Investor title EN</span><input className="d68-dashboard-input" name="title_en" defaultValue={pendingProfile?.title_en || inv.title_en || inv.title_vi || ''}/></label><div className="d68-dashboard-form2"><label className="d68-dashboard-field"><span>{T(lang,'Loại nhà đầu tư','Investor type')}</span><select className="d68-dashboard-input" name="type" defaultValue={pendingProfile?.type || inv.type || 'Individual/Angel'}>{INVESTOR_TYPES.map((x) => <option key={x}>{x}</option>)}</select></label><label className="d68-dashboard-field"><span>{T(lang,'Quốc gia','Country')}</span><select className="d68-dashboard-input" name="country" defaultValue={pendingProfile?.country || country}>{COUNTRIES.map((x) => <option key={x}>{x}</option>)}</select></label><label className="d68-dashboard-field"><span>Ticket min (USD)</span><input className="d68-dashboard-input" name="ticket_min" type="number" defaultValue={pendingProfile?.ticket_min || inv.ticket_min || 0}/></label><label className="d68-dashboard-field"><span>Ticket max (USD)</span><input className="d68-dashboard-input" name="ticket_max" type="number" defaultValue={pendingProfile?.ticket_max || inv.ticket_max || 0}/></label></div><label className="d68-dashboard-field"><span>{T(lang,'Mô tả ẩn danh công khai','Public anonymous description')}</span><textarea className="d68-dashboard-input d68-dashboard-textarea" name="desc_vi" defaultValue={pendingProfile?.desc_vi || inv.desc_vi || ''}/></label><label className="d68-dashboard-field"><span>Public anonymous description EN</span><textarea className="d68-dashboard-input d68-dashboard-textarea" name="desc_en" defaultValue={pendingProfile?.desc_en || inv.desc_en || inv.desc_vi || ''}/></label><label className="d68-dashboard-field"><span>{T(lang,'Ngành quan tâm','Industries of interest')}</span><input className="d68-dashboard-input" name="industries" defaultValue={(pendingProfile?.industries || invIndustries).join(', ')}/></label><label className="d68-dashboard-field"><span>{T(lang,'Loại giao dịch quan tâm','Deal types of interest')}</span><input className="d68-dashboard-input" name="deal_types" defaultValue={(pendingProfile?.deal_types || invDealTypes).join(', ')}/></label><div className="d68-dashboard-form2"><label className="d68-dashboard-field"><span>{T(lang,'Giai đoạn ưu tiên','Preferred stage')}</span><select className="d68-dashboard-input" name="stage" defaultValue={pendingProfile?.stage || inv.stage || 'Growth'}>{STAGES.map((x) => <option key={x}>{x}</option>)}</select></label><label className="d68-dashboard-field"><span>{T(lang,'Khẩu vị rủi ro','Risk appetite')}</span><select className="d68-dashboard-input" name="risk_appetite" defaultValue={pendingProfile?.criteria?.riskAppetite || inv.criteria?.riskAppetite || 'balanced'}><option value="conservative">Conservative</option><option value="balanced">Balanced</option><option value="aggressive">Aggressive</option></select></label><label className="d68-dashboard-field"><span>{T(lang,'Kỳ vọng lợi nhuận','Return expectation')}</span><input className="d68-dashboard-input" name="return_expectation" defaultValue={pendingProfile?.criteria?.returnExpectation || inv.criteria?.returnExpectation || ''}/></label><label className="d68-dashboard-field"><span>{T(lang,'Quy mô ưa thích','Preferred deal size')}</span><input className="d68-dashboard-input" name="preferred_deal_size" defaultValue={pendingProfile?.criteria?.preferredDealSize || inv.criteria?.preferredDealSize || ''}/></label></div><label className="d68-dashboard-field"><span>{T(lang,'Ngành loại trừ','Excluded sectors')}</span><input className="d68-dashboard-input" name="excluded_sectors" defaultValue={pendingProfile?.criteria?.excludedSectors || inv.criteria?.excludedSectors || ''}/></label><p>{T(lang,'Public profile không đổi ngay. Admin duyệt để hiển thị các cập nhật, đảm bảo luôn ẩn danh.', 'Public profile does not change immediately. Admin approval is required to display updates while keeping the profile anonymous.')}</p><div style={{ display: 'flex', justifyContent: 'flex-end' }}><button className="d68-dashboard-btn">{T(lang,'Lưu & gửi Admin duyệt','Save & submit to Admin')}</button></div></form> : null}
    {tab === 'recommended' ? <><div className="d68-dashboard-card" style={{ marginBottom: 18 }}><h2>{T(lang,'Tiêu chí & gợi ý','Criteria & matches')}</h2><p>{T(lang,'Chọn bộ lọc để tìm doanh nghiệp phù hợp theo dữ liệu public.', 'Use filters to find matching businesses from public data.')}</p><div className="d68-chip-select">{INDUSTRIES.map((x) => <button key={x} type="button" className={filterIndustries.includes(x) ? 'active' : ''} onClick={() => setFilterIndustries((cur) => cur.includes(x) ? cur.filter((i) => i !== x) : [...cur, x])}>{x}</button>)}</div><div className="d68-dashboard-form2" style={{ marginTop: 16 }}><label className="d68-dashboard-field"><span>{T(lang,'Quy mô doanh thu','Revenue size')}</span><select className="d68-dashboard-input" value={revBand} onChange={(e) => setRevBand(e.target.value)}><option value="all">Any</option><option value="0-1m">0–1M USD</option><option value="1-10m">1–10M USD</option><option value="10m+">10M+ USD</option></select></label><label className="d68-dashboard-field"><span>EBITDA margin</span><select className="d68-dashboard-input" value={ebBand} onChange={(e) => setEbBand(e.target.value)}><option value="all">Any</option><option value="0-10">0–10%</option><option value="10-20">10–20%</option><option value="20+">20%+</option></select></label></div></div>{recommended.length ? <div className="d68-dashboard-grid3">{recommended.map(businessCard)}</div> : <div className="d68-dashboard-empty">{T(lang,'Chưa có doanh nghiệp phù hợp.','No matching businesses yet.')}</div>}</> : null}
    {tab === 'watchlist' ? <Rows title={T(lang,'Doanh nghiệp đã lưu','Saved businesses')} rows={saved} empty={T(lang,'Chưa lưu doanh nghiệp nào.','No saved businesses yet.')} /> : null}
    {tab === 'proposals' ? <ProposalRows lang={lang} proposals={proposals} onMark={markProposal} onRequestData={requestProposalData} /> : null}
    {tab === 'alerts' ? <Rows title={T(lang,'Yêu cầu dữ liệu / tương tác','Data requests / interactions')} rows={[...requests, ...interests]} empty={T(lang,'Chưa có cảnh báo.','No alerts yet.')} /> : null}
    {tab === 'contacts' ? <form onSubmit={savePrivacy} className="d68-dashboard-card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}><h2>{T(lang,'Liên hệ & bảo mật','Contacts & privacy')}</h2><p>{T(lang,'Các thông tin này không hiển thị public trừ khi Admin/workflow cho phép.', 'These details are not public unless approved by Admin/workflow.')}</p><label className="d68-dashboard-field"><span>Email</span><input className="d68-dashboard-input" name="email" defaultValue={inv.privacy?.email || inv.private_email || ''}/></label><label><input name="shareEmail" type="checkbox" defaultChecked={!!inv.privacy?.shareEmail}/> {T(lang,'Cho phép chia sẻ email sau khi kết nối được duyệt','Allow email sharing after approved connection')}</label><label className="d68-dashboard-field"><span>Phone</span><input className="d68-dashboard-input" name="phone" defaultValue={inv.privacy?.phone || inv.private_phone || ''}/></label><label><input name="sharePhone" type="checkbox" defaultChecked={!!inv.privacy?.sharePhone}/> {T(lang,'Cho phép chia sẻ số điện thoại sau khi kết nối được duyệt','Allow phone sharing after approved connection')}</label><label className="d68-dashboard-field"><span>Website</span><input className="d68-dashboard-input" name="website" defaultValue={inv.privacy?.website || inv.private_website || ''}/></label><label><input name="shareWebsite" type="checkbox" defaultChecked={!!inv.privacy?.shareWebsite}/> {T(lang,'Cho phép chia sẻ website sau khi kết nối được duyệt','Allow website sharing after approved connection')}</label><div><button className="d68-dashboard-btn">{T(lang,'Lưu bảo mật','Save privacy')}</button></div></form> : null}
    {tab === 'security' ? <div className="d68-dashboard-card"><h2>{T(lang,'Bảo mật','Security')}</h2><p>{T(lang,'Đổi mật khẩu qua luồng quên mật khẩu để Supabase gửi email xác thực.', 'Change password through the forgot password flow so Supabase sends a verified email.')}</p><Link to="/forgot-password?role=investor" className="d68-dashboard-btn">{T(lang,'Đặt lại mật khẩu','Reset password')}</Link></div> : null}
  </section></div></div></main>;
}
function ProposalRows({ lang, proposals, onMark, onRequestData }: any) { const newCount = proposals.filter((p: any) => p.status === 'sent').length; const approved = proposals.filter((p: any) => ['approved','connected'].includes(p.status)).length; const declined = proposals.filter((p: any) => p.status === 'declined').length; return <div className="d68-dashboard-card"><h2>{T(lang,'Proposal đã nhận','Received proposals')}</h2><div className="d68-dashboard-grid4" style={{ margin: '14px 0' }}><div className="d68-proposal-metric"><b>{newCount}</b><span>{T(lang,'Proposal mới','New')}</span></div><div className="d68-proposal-metric"><b>{approved}</b><span>{T(lang,'Đã duyệt','Approved')}</span></div><div className="d68-proposal-metric"><b>{declined}</b><span>{T(lang,'Bỏ qua','Declined')}</span></div><div className="d68-proposal-metric"><b>{proposals.length}</b><span>{T(lang,'Tổng','Total')}</span></div></div>{proposals.length ? proposals.map((row: any) => { const b = row.businesses || {}; const st = proposalStatusLabel(row.status, lang); return <div key={row.id} className="d68-dashboard-row d68-proposal-row"><div style={{ flex: 1 }}><b>{businessTitle(b, lang) || b.public_code || row.business_id}</b><div className="d68-dashboard-mini">{fmtDate(row.sent_at)} · {b.city || '—'} · {b.industry || '—'}</div><p>{T(lang,'Nhu cầu vốn/giá chào','Ask')}: <b>{formatCompactMoney(b.ask_amount, b.ask_currency || b.revenue_currency)}</b> · <span className={`d68-dashboard-badge ${qBadge(b.quality_score)}`}>BQS {Number(b.quality_score || 0)}/100</span> · <span className={`d68-dashboard-badge ${st.cls}`}>{st.label}</span></p>{b.slug ? <Link to={`/businesses/${b.slug}`} className="d68-dashboard-btn light">{T(lang,'Xem profile DN','View business profile')}</Link> : null}</div><div className="d68-dashboard-actions"><button onClick={() => onMark(row, 'approved')} className="d68-dashboard-btn green">{T(lang,'Duyệt','Approve')}</button><button onClick={() => onMark(row, 'declined')} className="d68-dashboard-btn red">{T(lang,'Bỏ qua','Decline')}</button><button onClick={() => onRequestData(row)} className="d68-dashboard-btn gold">{T(lang,'Yêu cầu tài liệu','Request data')}</button></div></div>; }) : <div className="d68-dashboard-empty">{T(lang,'Chưa có proposal nào gửi tới bạn.','No received proposals yet.')}</div>}</div>; }
function Rows({ title, rows, empty }: any) { return <div className="d68-dashboard-card"><h2>{title}</h2>{rows.length ? rows.map((r: any) => <div key={r.id} className="d68-dashboard-row"><div style={{ flex: 1 }}><b>{r.businesses?.title_vi || r.businesses?.title_en || r.businesses?.public_code || r.id}</b><div className="d68-dashboard-mini">{r.status || 'pending'} · {new Date(r.created_at || r.sent_at || Date.now()).toLocaleString()}</div></div></div>) : <div className="d68-dashboard-empty">{empty}</div>}</div>; }
'''
write('src/pages/InvestorDashboard.tsx', INVESTOR_DASHBOARD_TSX)

# CSS append patches.
BQS_CSS = r'''

/* Deals68 Beta v1.3 — Business Quality Score UI */
.d68-bqs-card{display:flex;gap:22px;align-items:flex-start;background:#fff;border:1px solid #E7EDF3;border-radius:18px;padding:22px;box-shadow:0 1px 2px rgba(15,42,74,.04);min-width:0;overflow:hidden}.d68-bqs-ring-col{flex:0 0 auto}.d68-bqs-ring{width:104px;height:104px;border-radius:50%;display:flex;align-items:center;justify-content:center}.d68-bqs-ring>div{width:78px;height:78px;border-radius:50%;background:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;box-shadow:inset 0 0 0 1px #EEF2F6}.d68-bqs-ring b{font-size:27px;line-height:1;font-weight:900;color:#27A844}.d68-bqs-ring span{font-size:10px;color:#64748B;font-weight:800;text-transform:uppercase}.d68-bqs-body{flex:1;min-width:0}.d68-bqs-head{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:8px}.d68-bqs-head h3{margin:0;font-size:18px;font-weight:900}.d68-bqs-badge{display:inline-flex;border-radius:8px;padding:6px 12px;font-size:12.5px;font-weight:900}.d68-bqs-badge.green{background:#DCFCE7;color:#16A34A}.d68-bqs-badge.blue{background:#E7F6FD;color:#1596cc}.d68-bqs-badge.gold{background:#FEF3D3;color:#B8860B}.d68-bqs-body p{margin:0 0 12px;color:#64748B;line-height:1.55;font-size:13.5px}.d68-bqs-chips{display:flex;flex-wrap:wrap;gap:7px;margin-bottom:12px}.d68-bqs-chips span{background:#F1F5F9;color:#64748B;border-radius:8px;padding:6px 10px;font-size:12.5px;font-weight:800}.d68-bqs-breakdown{display:grid;grid-template-columns:1fr 1fr;gap:8px}.d68-bqs-breakdown__row{background:#F8FAFC;border:1px solid #EEF2F6;border-radius:10px;padding:10px 12px}.d68-bqs-breakdown__row b{display:block;font-size:13px;color:#0F2A4A}.d68-bqs-breakdown__row span{font-weight:900;color:#1596cc}.d68-bqs-breakdown__row small{display:block;color:#64748B;margin-top:2px}.d68-bqs-alert{background:#FFF3CD;border:1px solid #F2CF72;color:#8a6413;border-radius:10px;padding:12px 14px;font-size:13px;font-weight:800;line-height:1.45}.d68-bqs-alert a{color:#8a6413;text-decoration:underline}.d68-bqs-card.is-demo .d68-bqs-ring b{font-size:18px;color:#0F2A4A}.d68-bqs-card.is-demo .d68-bqs-ring{background:conic-gradient(#27A844 245deg,#EEF2F6 0deg)!important}@media(max-width:620px){.d68-bqs-card{flex-direction:column;padding:18px}.d68-bqs-breakdown{grid-template-columns:1fr}.d68-bqs-ring{width:92px;height:92px}.d68-bqs-ring>div{width:70px;height:70px}.d68-detail-facts{grid-template-columns:1fr!important}.d68-detail-cols{grid-template-columns:1fr!important}.d68-detail-side{position:static!important}}
'''
patch_file('src/styles/pages/business-detail.css', lambda t: t + BQS_CSS if 'Deals68 Beta v1.3 — Business Quality Score UI' not in t else t)

INVESTOR_DETAIL_CSS = r'''

/* Deals68 Beta v1.3 — Investor detail two-column cleanup */
.d68-id-layout{display:grid;grid-template-columns:minmax(0,1fr)332px;gap:24px;align-items:start}.d68-id-main{min-width:0}.d68-id-side--sticky{position:sticky;top:86px}.d68-id-tags{display:flex;flex-wrap:wrap;gap:8px}.d68-id-tags span{background:#E7F6FD;color:#1596cc;border-radius:999px;padding:7px 11px;font-size:12.5px;font-weight:900}.d68-id-cta button:disabled{opacity:.72;cursor:not-allowed}.d68-id-section--card:first-child{margin-top:0}@media(max-width:980px){.d68-id-layout{grid-template-columns:1fr}.d68-id-side--sticky{position:static}}@media(max-width:620px){.d68-id-layout{gap:16px}.d68-id-tags span{font-size:12px}}
'''
patch_file('src/styles/pages/investor-detail.css', lambda t: t + INVESTOR_DETAIL_CSS if 'Investor detail two-column cleanup' not in t else t)

INVESTORS_CSS = r'''

/* Deals68 Beta v1.3 — Proposal button states */
.d68-investor-card__actions button:disabled{opacity:.62;cursor:not-allowed;background:#94A3B8!important;border-color:#94A3B8!important;color:#fff!important}.d68-investors-toolbar span:last-child{font-weight:800;color:#0F2A4A}
'''
patch_file('src/styles/pages/investors.css', lambda t: t + INVESTORS_CSS if 'Proposal button states' not in t else t)

DASHBOARD_CSS = r'''

/* Deals68 Beta v1.3 — Investor received proposals */
.d68-proposal-metric{background:#F8FAFC;border:1px solid #E7EDF3;border-radius:14px;padding:14px}.d68-proposal-metric b{display:block;font-size:28px;font-weight:900;color:#0F2A4A}.d68-proposal-metric span{display:block;color:#64748B;font-size:12.5px;font-weight:800}.d68-proposal-row{align-items:flex-start}.d68-proposal-row p{margin:8px 0 10px}.d68-proposal-row .d68-dashboard-actions{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}@media(max-width:700px){.d68-proposal-row .d68-dashboard-actions{width:100%;justify-content:stretch}.d68-proposal-row .d68-dashboard-actions .d68-dashboard-btn{flex:1}}
'''
patch_file('src/styles/pages/dashboard.css', lambda t: t + DASHBOARD_CSS if 'Investor received proposals' not in t else t)

print('\nPatch script completed. Run npm run build and test routes manually.')
