#!/usr/bin/env python3
from pathlib import Path

def read(path: str) -> str:
    p = Path(path)
    if not p.exists():
        raise SystemExit(f"Missing file: {path}")
    return p.read_text(encoding="utf-8")

def write(path: str, content: str):
    Path(path).write_text(content, encoding="utf-8")
    print(f"updated {path}")

def replace_once(content: str, old: str, new: str, path: str) -> str:
    if old not in content:
        raise SystemExit(f"Pattern not found in {path}:\n{old[:400]}")
    return content.replace(old, new, 1)

# 1) Header navigation: logged-in user sees Dashboard button, no login/register/logout in global nav.
path = "src/components/Header.tsx"
s = read(path)

s = replace_once(
    s,
    """function langBtnStyle(active: boolean): CSSProperties {
  return { ...buttonReset, padding: '7px 14px', fontWeight: 700, fontSize: 13, background: active ? '#0F2A4A' : 'transparent', color: active ? '#fff' : '#64748B' };
}""",
    """function langBtnStyle(active: boolean): CSSProperties {
  return { ...buttonReset, padding: '7px 14px', fontWeight: 700, fontSize: 13, background: active ? '#0F2A4A' : 'transparent', color: active ? '#fff' : '#64748B' };
}

function dashboardForRole(role?: string) {
  if (role === 'admin') return '/admin';
  if (role === 'investor') return '/dashboard/investor';
  if (role === 'affiliate') return '/dashboard/market-partner';
  return '/dashboard/business';
}""",
    path
)

old = """  const authDesktop = profile
    ? <button type="button" onClick={logout} style={{ ...buttonReset, background: '#EEF2F6', color: '#14315A', fontWeight: 800, fontSize: 14.5, padding: '10px 16px', borderRadius: 10, whiteSpace: 'nowrap' }}>{T(lang, 'Đăng xuất', 'Log out')}</button>
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
      </>;"""
new = """  const authDesktop = profile
    ? <Link to={nav(dashboardForRole(profile.role))} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#1BADEA', color: '#fff', fontWeight: 800, fontSize: 15, padding: '11px 20px', borderRadius: 10, boxShadow: '0 6px 16px rgba(27,173,234,.28)', whiteSpace: 'nowrap' }}>{T(lang, 'Dashboard', 'Dashboard')}</Link>
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
      </>;"""
s = replace_once(s, old, new, path)

s = replace_once(
    s,
    """        {profile
          ? <button type="button" onClick={logout} style={{ ...buttonReset, textAlign: 'left', padding: '13px 6px', fontSize: 16, fontWeight: 700, color: '#14315A', background: 'transparent' }}>{T(lang, 'Đăng xuất', 'Log out')}</button>
          : <><Link to={nav('/login')} onClick={closeDrawer} style={{ padding: '13px 6px', fontSize: 16, fontWeight: 700, color: '#14315A' }}><span className="l-vi">Đăng nhập</span><span className="l-en">Log in</span></Link><div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}><Link to={nav('/register/business')} onClick={closeDrawer} style={{ textAlign: 'center', background: '#1BADEA', color: '#fff', fontWeight: 700, fontSize: 15, padding: 13, borderRadius: 10 }}><span className="l-vi">Đăng ký Doanh nghiệp</span><span className="l-en">Register as Business</span></Link><Link to={nav('/register/investor')} onClick={closeDrawer} style={{ textAlign: 'center', border: '1px solid #E2E8F0', color: '#14315A', fontWeight: 700, fontSize: 15, padding: 13, borderRadius: 10 }}><span className="l-vi">Đăng ký Nhà đầu tư</span><span className="l-en">Register as Investor</span></Link></div></>}""",
    """        {profile
          ? <Link to={nav(dashboardForRole(profile.role))} onClick={closeDrawer} style={{ textAlign: 'center', background: '#1BADEA', color: '#fff', fontWeight: 800, fontSize: 15, padding: 13, borderRadius: 10, marginTop: 8 }}>Dashboard</Link>
          : <><Link to={nav('/login')} onClick={closeDrawer} style={{ padding: '13px 6px', fontSize: 16, fontWeight: 700, color: '#14315A' }}><span className="l-vi">Đăng nhập</span><span className="l-en">Log in</span></Link><div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}><Link to={nav('/register/business')} onClick={closeDrawer} style={{ textAlign: 'center', background: '#1BADEA', color: '#fff', fontWeight: 700, fontSize: 15, padding: 13, borderRadius: 10 }}><span className="l-vi">Đăng ký Doanh nghiệp</span><span className="l-en">Register as Business</span></Link><Link to={nav('/register/investor')} onClick={closeDrawer} style={{ textAlign: 'center', border: '1px solid #E2E8F0', color: '#14315A', fontWeight: 700, fontSize: 15, padding: 13, borderRadius: 10 }}><span className="l-vi">Đăng ký Nhà đầu tư</span><span className="l-en">Register as Investor</span></Link></div></>}""",
    path
)
write(path, s)

# 2) App: add /en/dashboard routes to prevent 404 on language switch from dashboards.
path = "src/App.tsx"
s = read(path)
insert_after = """        <Route path="/en/market-partner" element={<MarketPartner lang="en"/>}/>
"""
routes = """        <Route path="/en/market-partner" element={<MarketPartner lang="en"/>}/>
        <Route path="/en/dashboard/business" element={<DashboardGate role="business"><BusinessDashboard/></DashboardGate>}/>
        <Route path="/en/dashboard/business/*" element={<DashboardGate role="business"><BusinessDashboard/></DashboardGate>}/>
        <Route path="/en/dashboard/investor" element={<DashboardGate role="investor"><InvestorDashboard/></DashboardGate>}/>
        <Route path="/en/dashboard/investor/*" element={<DashboardGate role="investor"><InvestorDashboard/></DashboardGate>}/>
"""
s = replace_once(s, insert_after, routes, path)
write(path, s)

# 3) InvestorDetail: send proposal directly from investor profile, disable after sent.
path = "src/pages/InvestorDetail.tsx"
s = read(path)
s = replace_once(s, "import { getInvestorByCode } from '../lib/data';", "import { getInvestorByCode, getMyBusiness } from '../lib/data';", path)
s = replace_once(
    s,
    """  const [msg, setMsg] = useState('');
""",
    """  const [msg, setMsg] = useState('');
  const [proposalBusy, setProposalBusy] = useState(false);
  const [sentProposal, setSentProposal] = useState<any>(null);
""",
    path
)

s = replace_once(
    s,
    """  useEffect(() => {
    let live = true;
    async function loadContact() {
      if (!profile || !inv?.id) { setContact(null); return; }
      const { data } = await supabase.rpc('get_investor_contact_if_connected', { investor_uuid: inv.id }).catch(() => ({ data: null } as any));
      if (live) setContact(data || null);
    }
    loadContact();
    return () => { live = false; };
  }, [profile?.id, inv?.id]);
""",
    """  useEffect(() => {
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
      } catch {
        if (live) setSentProposal(null);
      }
    }
    loadSentProposal();
    return () => { live = false; };
  }, [profile?.id, profile?.role, inv?.id]);
""",
    path
)

s = replace_once(
    s,
    """  function sendProposal() {
    if (!profile) { navigate(toLocalizedPath('/register/business', lang)); return; }
    if (profile.role !== 'business') { setMsg(T(lang, 'Chỉ tài khoản Doanh nghiệp được gửi hồ sơ DN.', 'Only Business accounts can send a business profile.')); return; }
    setMsg(T(lang, 'Vui lòng gửi proposal từ Business Dashboard để hệ thống ghi nhận hạn mức/quota và workflow duyệt.', 'Please send proposals from the Business Dashboard so quota and approval workflow are recorded.'));
  }
""",
    """  async function sendProposal() {
    if (!profile) { navigate(toLocalizedPath(`/login?role=business&next=/investors/${code}`, lang)); return; }
    if (profile.role !== 'business') { setMsg(T(lang, 'Chỉ tài khoản Doanh nghiệp được gửi hồ sơ DN.', 'Only Business accounts can send a business profile.')); return; }
    if (sentProposal) {
      setMsg(T(lang, 'Bạn đã gửi hồ sơ DN tới nhà đầu tư này. Vui lòng theo dõi tại Dashboard DN → Proposal.', 'You already sent your business profile to this investor. Please track it in Business Dashboard → Proposals.'));
      return;
    }
    setProposalBusy(true); setMsg('');
    try {
      const biz = await getMyBusiness(profile.id);
      if (!biz?.id) {
        navigate(toLocalizedPath('/dashboard/business', lang));
        return;
      }
      const now = new Date();
      const { data, error } = await supabase.from('proposals').insert({
        business_id: biz.id,
        investor_id: inv.id,
        message: `Business profile sent from investor profile on ${now.toISOString()}`,
        status: 'pending',
        sent_at: now.toISOString()
      }).select('id,status,sent_at').single();
      if (error) {
        const text = String(error.message || '').toLowerCase();
        if (text.includes('duplicate') || text.includes('unique')) {
          const { data: existing } = await supabase.from('proposals').select('id,status,sent_at').eq('business_id', biz.id).eq('investor_id', inv.id).maybeSingle();
          setSentProposal(existing || { status: 'pending', sent_at: now.toISOString() });
          setMsg(T(lang, 'Bạn đã gửi hồ sơ DN tới nhà đầu tư này trước đó. Vui lòng theo dõi tại Dashboard DN → Proposal.', 'You already sent your business profile to this investor. Please track it in Business Dashboard → Proposals.'));
          return;
        }
        throw error;
      }
      setSentProposal(data || { status: 'pending', sent_at: now.toISOString() });
      const displayDate = now.toLocaleString(lang === 'en' ? 'en-US' : 'vi-VN');
      setMsg(T(lang, `Bạn đã gửi thành công ngày ${displayDate}. Hãy đợi nhà đầu tư xem xét duyệt.`, `Sent successfully on ${displayDate}. Please wait for the investor to review and approve.`));
    } catch (e: any) {
      setMsg(e?.message || T(lang, 'Không gửi được hồ sơ DN. Vui lòng thử lại.', 'Could not send business profile. Please try again.'));
    } finally {
      setProposalBusy(false);
    }
  }
""",
    path
)

s = replace_once(
    s,
    """<button onClick={sendProposal}>{T(lang, 'Gửi hồ sơ DN', 'Send business profile')}</button><small>{T(lang, 'Proposal còn lại được kiểm tra trong Dashboard Business.', 'Remaining proposal quota is checked in the Business Dashboard.')}</small>""",
    """<button onClick={sendProposal} disabled={proposalBusy || !!sentProposal}>{sentProposal ? T(lang, 'Đã gửi hồ sơ DN', 'Profile sent') : proposalBusy ? T(lang, 'Đang gửi...', 'Sending...') : T(lang, 'Gửi hồ sơ DN', 'Send business profile')}</button><small>{sentProposal ? T(lang, 'Đã gửi. Theo dõi tại Dashboard DN → Proposal.', 'Sent. Track it in Business Dashboard → Proposals.') : T(lang, 'Proposal còn lại được kiểm tra trong Dashboard Business.', 'Remaining proposal quota is checked in the Business Dashboard.')}</small>""",
    path
)
write(path, s)

# 4) BusinessDashboard: darker logout, Proposals tab, show sent proposals list.
path = "src/pages/BusinessDashboard.tsx"
s = read(path)
s = replace_once(
    s,
    """  { id: 'interests' as Tab, Icon: Users, vi: 'Nhà đầu tư', en: 'Investors', href: '/dashboard/business/investor-interest' },""",
    """  { id: 'interests' as Tab, Icon: Users, vi: 'Proposal', en: 'Proposals', href: '/dashboard/business/proposals' },""",
    path
)
s = replace_once(
    s,
    """<button className="d68-dashboard-btn light" onClick={() => signOut().then(() => navigate('/'))}>{T(lang,'Thoát','Exit')}</button>""",
    """<button className="d68-dashboard-btn light" style={{ background: '#475569', color: '#fff', borderColor: '#334155' }} onClick={() => signOut().then(() => navigate('/'))}>{T(lang,'Thoát','Exit')}</button>""",
    path
)
s = replace_once(
    s,
    """      {tab === 'interests' ? <Rows title={T(lang,'Nhà đầu tư quan tâm','Investor interests')} rows={interests} empty={T(lang,'Chưa có nhà đầu tư quan tâm.','No investor interests yet.')} actions={(row: any) => <><button onClick={() => acceptInterest(row)} className="d68-dashboard-btn green">Accept</button><button onClick={() => rejectInterest(row)} className="d68-dashboard-btn red">Reject</button></>} /> : null}""",
    """      {tab === 'interests' ? <><Rows title={T(lang,'Proposal đã gửi','Sent proposals')} rows={proposals} empty={T(lang,'Chưa gửi hồ sơ DN tới nhà đầu tư nào.','No business profile proposals sent yet.')} /><Rows title={T(lang,'Nhà đầu tư quan tâm','Investor interests')} rows={interests} empty={T(lang,'Chưa có nhà đầu tư quan tâm.','No investor interests yet.')} actions={(row: any) => <><button onClick={() => acceptInterest(row)} className="d68-dashboard-btn green">Accept</button><button onClick={() => rejectInterest(row)} className="d68-dashboard-btn red">Reject</button></>} /></> : null}""",
    path
)
write(path, s)

# 5) InvestorDashboard: darker logout, internal fields private_name/private_website, text placement.
path = "src/pages/InvestorDashboard.tsx"
s = read(path)
s = replace_once(
    s,
    """      criteria: { ...(inv.criteria || {}), riskAppetite: fd.get('risk_appetite'), returnExpectation: fd.get('return_expectation'), preferredDealSize: fd.get('preferred_deal_size'), excludedSectors: fd.get('excluded_sectors') }
    };
    const privacy = { ...(inv.privacy || {}), pending_profile_changes: next, pending_submitted_at: new Date().toISOString() };
    const { error } = await supabase.from('investors').update({ privacy }).eq('id', inv.id);
    setErr(error?.message || ''); setMsg(error ? '' : T(lang, 'Đã lưu thay đổi, chờ Admin duyệt trước khi public.', 'Saved changes, pending Admin approval before public display.'));""",
    """      criteria: { ...(inv.criteria || {}), riskAppetite: fd.get('risk_appetite'), returnExpectation: fd.get('return_expectation'), preferredDealSize: fd.get('preferred_deal_size'), excludedSectors: fd.get('excluded_sectors') }
    };
    const privacy = { ...(inv.privacy || {}), pending_profile_changes: next, pending_submitted_at: new Date().toISOString() };
    const privatePatch = {
      privacy,
      private_name: String(fd.get('private_name') || '').trim(),
      private_website: String(fd.get('private_website') || '').trim()
    };
    const { error } = await supabase.from('investors').update(privatePatch).eq('id', inv.id);
    setErr(error?.message || ''); setMsg(error ? '' : T(lang, 'Đã lưu thay đổi, chờ Admin duyệt để hiển thị các cập nhật và đảm bảo luôn ẩn danh.', 'Saved changes, pending Admin approval to display updates while keeping the profile anonymous.'));""",
    path
)
s = replace_once(
    s,
    """<button onClick={() => signOut().then(() => navigate('/'))} className="d68-dashboard-btn light">{T(lang,'Thoát','Exit')}</button>""",
    """<button onClick={() => signOut().then(() => navigate('/'))} className="d68-dashboard-btn light" style={{ background: '#475569', color: '#fff', borderColor: '#334155' }}>{T(lang,'Thoát','Exit')}</button>""",
    path
)
s = replace_once(
    s,
    """<form onSubmit={saveProfile} className="d68-dashboard-card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}><h2>{T(lang,'Hồ sơ đầu tư','Investor profile')}</h2><p>{T(lang,'Public profile không đổi ngay. Admin phải duyệt thay đổi mới.', 'Public profile does not change immediately. Admin must approve new changes.')}</p><label className="d68-dashboard-field"><span>{T(lang,'Tên nhà đầu tư public','Public investor title')}</span>""",
    """<form onSubmit={saveProfile} className="d68-dashboard-card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}><h2>{T(lang,'Hồ sơ đầu tư','Investor profile')}</h2><label className="d68-dashboard-field"><span>{T(lang,'Tên Quỹ đầu tư / Nhà đầu tư — nội bộ, không public','Fund / investor name — internal, not public')}</span><input className="d68-dashboard-input" name="private_name" defaultValue={inv.private_name || inv.privacy?.private_name || ''}/></label><label className="d68-dashboard-field"><span>Website</span><input className="d68-dashboard-input" name="private_website" defaultValue={inv.private_website || inv.privacy?.website || ''}/></label><label className="d68-dashboard-field"><span>{T(lang,'Tên nhà đầu tư public','Public investor title')}</span>""",
    path
)
s = replace_once(
    s,
    """<div style={{ display: 'flex', justifyContent: 'flex-end' }}><button className="d68-dashboard-btn">{T(lang,'Lưu & gửi Admin duyệt','Save & submit to Admin')}</button></div></form>""",
    """<p>{T(lang,'Public profile không đổi ngay. Admin duyệt để hiển thị các cập nhật, đảm bảo luôn ẩn danh.', 'Public profile does not change immediately. Admin approval is required to display updates while keeping the profile anonymous.')}</p><div style={{ display: 'flex', justifyContent: 'flex-end' }}><button className="d68-dashboard-btn">{T(lang,'Lưu & gửi Admin duyệt','Save & submit to Admin')}</button></div></form>""",
    path
)
write(path, s)

print("\nUX patch applied. Next run: npm run build")
