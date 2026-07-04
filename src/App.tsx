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
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Register from './pages/Register';
import BusinessDashboard from './pages/BusinessDashboard';
import InvestorDashboard from './pages/InvestorDashboard';
import Admin from './pages/Admin';
import Valuation from './pages/Valuation';
import ModuleScreen from './pages/ModuleScreen';
import NotFound from './pages/NotFound';
import type { Lang } from './lib/i18n';

export default function App(){
  const [lang,setLang]=useState<Lang>('vi');
  return <>
    <Header lang={lang} setLang={setLang}/>
    <Routes>
      <Route path="/" element={<Home lang={lang}/>}/>
      <Route path="/businesses" element={<Businesses lang={lang}/>}/>
      <Route path="/businesses/:slug" element={<BusinessDetail lang={lang}/>}/>
      <Route path="/investors" element={<Investors lang={lang}/>}/>
      <Route path="/investors/:code" element={<InvestorDetail lang={lang}/>}/>
      <Route path="/pricing" element={<Pricing lang={lang}/>}/>
      <Route path="/valuation" element={<Valuation lang={lang}/>}/>
      <Route path="/login" element={<Login/>}/>
      <Route path="/admin/login" element={<Login/>}/>
      <Route path="/forgot-password" element={<ForgotPassword/>}/>
      <Route path="/reset-password" element={<ResetPassword/>}/>
      <Route path="/register/:role" element={<Register/>}/>
      <Route path="/register" element={<Navigate to="/pricing" replace/>}/>

      <Route path="/dashboard/business" element={<BusinessDashboard/>}/>
      <Route path="/dashboard/business/*" element={<BusinessDashboard/>}/>
      <Route path="/dashboard/investor" element={<InvestorDashboard/>}/>
      <Route path="/dashboard/investor/*" element={<InvestorDashboard/>}/>
      <Route path="/admin" element={<Admin/>}/>
      <Route path="/admin/*" element={<Admin/>}/>

      <Route path="/about" element={<ModuleScreen/>}/>
      <Route path="/how-it-works" element={<ModuleScreen/>}/>
      <Route path="/businesses/featured" element={<ModuleScreen/>}/>
      <Route path="/businesses/fundraising" element={<ModuleScreen/>}/>
      <Route path="/businesses/sale" element={<ModuleScreen/>}/>
      <Route path="/businesses/debt" element={<ModuleScreen/>}/>
      <Route path="/investors/active" element={<ModuleScreen/>}/>
      <Route path="/investors/funds" element={<ModuleScreen/>}/>
      <Route path="/investors/strategic" element={<ModuleScreen/>}/>
      <Route path="/pricing/business" element={<ModuleScreen/>}/>
      <Route path="/pricing/investor" element={<ModuleScreen/>}/>
      <Route path="/valuation/rules" element={<ModuleScreen/>}/>
      <Route path="/faq" element={<ModuleScreen/>}/>
      <Route path="/contact" element={<ModuleScreen/>}/>
      <Route path="/terms" element={<ModuleScreen/>}/>
      <Route path="/privacy" element={<ModuleScreen/>}/>
      <Route path="/security" element={<ModuleScreen/>}/>
      <Route path="/localization" element={<ModuleScreen/>}/>
      <Route path="/market-intelligence" element={<ModuleScreen/>}/>

      <Route path="/dashboard/advisor/profile" element={<ModuleScreen/>}/>
      <Route path="/dashboard/advisor/clients" element={<ModuleScreen/>}/>
      <Route path="/dashboard/advisor/opportunities" element={<ModuleScreen/>}/>
      <Route path="/dashboard/advisor/settings" element={<ModuleScreen/>}/>
      <Route path="/dashboard/market-partner" element={<ModuleScreen/>}/>
      <Route path="/dashboard/market-partner/register" element={<ModuleScreen/>}/>
      <Route path="/dashboard/market-partner/links" element={<ModuleScreen/>}/>
      <Route path="/dashboard/market-partner/conversions" element={<ModuleScreen/>}/>
      <Route path="/dashboard/market-partner/payouts" element={<ModuleScreen/>}/>
      <Route path="/dashboard/market-partner/settings" element={<ModuleScreen/>}/>
      <Route path="/dashboard/affiliate/register" element={<Navigate to="/dashboard/market-partner/register" replace/>}/>
      <Route path="/dashboard/affiliate/links" element={<Navigate to="/dashboard/market-partner/links" replace/>}/>
      <Route path="/dashboard/affiliate/conversions" element={<Navigate to="/dashboard/market-partner/conversions" replace/>}/>
      <Route path="/dashboard/affiliate/payouts" element={<Navigate to="/dashboard/market-partner/payouts" replace/>}/>
      <Route path="/dashboard/affiliate/settings" element={<Navigate to="/dashboard/market-partner/settings" replace/>}/>

      <Route path="/checkout" element={<ModuleScreen/>}/>
      <Route path="/payment/pending" element={<ModuleScreen/>}/>
      <Route path="/payment/success" element={<ModuleScreen/>}/>
      <Route path="/data-room/:businessId" element={<ModuleScreen/>}/>
      <Route path="/messages" element={<ModuleScreen/>}/>
      <Route path="/notifications" element={<ModuleScreen/>}/>
      <Route path="/support" element={<ModuleScreen/>}/>
      <Route path="*" element={<NotFound/>}/>
    </Routes>
    <Footer/>
  </>;
}
