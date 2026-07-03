import { Route, Routes, Navigate } from 'react-router-dom';
import { useState } from 'react';
import Header from './components/Header';
import Footer from './components/Footer';
import Home from './pages/Home';
import Businesses from './pages/Businesses';
import BusinessDetail from './pages/BusinessDetail';
import Investors from './pages/Investors';
import InvestorDetail from './pages/InvestorDetail';
import Pricing from './pages/Pricing';
import Login from './pages/Login';
import Register from './pages/Register';
import BusinessDashboard from './pages/BusinessDashboard';
import InvestorDashboard from './pages/InvestorDashboard';
import Admin from './pages/Admin';
import Valuation from './pages/Valuation';
import NotFound from './pages/NotFound';
import type { Lang } from './lib/i18n';

function SimpleDashboard({ role }: { role: string }) { return <section className="section"><div className="container empty"><h1>{role} dashboard</h1><p>This role is prepared for beta expansion. Business and Investor dashboards are fully implemented first.</p></div></section> }

export default function App(){ const [lang,setLang]=useState<Lang>('vi'); return <><Header lang={lang} setLang={setLang}/><Routes><Route path="/" element={<Home lang={lang}/>}/><Route path="/businesses" element={<Businesses lang={lang}/>}/><Route path="/businesses/:slug" element={<BusinessDetail lang={lang}/>}/><Route path="/investors" element={<Investors lang={lang}/>}/><Route path="/investors/:code" element={<InvestorDetail lang={lang}/>}/><Route path="/pricing" element={<Pricing lang={lang}/>}/><Route path="/valuation" element={<Valuation lang={lang}/>}/><Route path="/login" element={<Login/>}/><Route path="/register/:role" element={<Register/>}/><Route path="/register" element={<Navigate to="/pricing" replace/>}/><Route path="/dashboard/business" element={<BusinessDashboard/>}/><Route path="/dashboard/investor" element={<InvestorDashboard/>}/><Route path="/dashboard/advisor" element={<SimpleDashboard role="Advisor"/>}/><Route path="/dashboard/affiliate" element={<SimpleDashboard role="Affiliate"/>}/><Route path="/admin" element={<Admin/>}/><Route path="*" element={<NotFound/>}/></Routes><Footer/></> }
