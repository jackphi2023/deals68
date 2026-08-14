import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, useLocation } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import App from './App';
import InvestorAccessBoundary from './components/InvestorAccessBoundary';
import AdminReportsPortal from './features/adminReports/AdminReportsPortal';
import BusinessPublicRevenueControls from './features/businessRevenueVisibility/BusinessPublicRevenueControls';
import PublicBusinessRevenuePresentation from './features/businessRevenueVisibility/PublicBusinessRevenuePresentation';
import DashboardProfileReviewNoticePortal from './features/dashboardReview/DashboardProfileReviewNoticePortal';
import AdminAdvisorIntakes from './pages/AdminAdvisorIntakes';
import './styles/index.css';

const AdminNewsPortal = React.lazy(() => import('./components/admin/AdminNewsPortal'));

function Deals68RouteRoot() {
  const location = useLocation();
  if (location.pathname === '/admin/advisor-intakes') {
    return <AdminAdvisorIntakes />;
  }
  return <App />;
}

function AdminNewsPortalRuntime() {
  const location = useLocation();
  const normalized = location.pathname.replace(/\/+$/, '');
  if (!(normalized === '/admin/news' || normalized.startsWith('/admin/news/'))) return null;
  return (
    <React.Suspense fallback={null}>
      <AdminNewsPortal />
    </React.Suspense>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <InvestorAccessBoundary>
          <Deals68RouteRoot />
          <AdminReportsPortal />
          <AdminNewsPortalRuntime />
          <BusinessPublicRevenueControls />
          <PublicBusinessRevenuePresentation />
          <DashboardProfileReviewNoticePortal />
        </InvestorAccessBoundary>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
