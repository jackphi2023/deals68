import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import App from './App';
import InvestorAccessBoundary from './components/InvestorAccessBoundary';
import AdminReportsPortal from './features/adminReports/AdminReportsPortal';
import BusinessPublicRevenueControls from './features/businessRevenueVisibility/BusinessPublicRevenueControls';
import PublicBusinessRevenuePresentation from './features/businessRevenueVisibility/PublicBusinessRevenuePresentation';
import DashboardProfileReviewNoticePortal from './features/dashboardReview/DashboardProfileReviewNoticePortal';
import './styles/index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <InvestorAccessBoundary>
          <App />
          <AdminReportsPortal />
          <BusinessPublicRevenueControls />
          <PublicBusinessRevenuePresentation />
          <DashboardProfileReviewNoticePortal />
        </InvestorAccessBoundary>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
