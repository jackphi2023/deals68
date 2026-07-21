import BusinessDashboard from './BusinessDashboard';
import BusinessReportPanelPortal from '../features/businessReports/BusinessReportPanelPortal';
import BusinessReportViewerPortal from '../features/businessReports/BusinessReportViewerPortal';

export default function BusinessDashboardWithReports() {
  return (
    <>
      <BusinessDashboard />
      <BusinessReportPanelPortal />
      <BusinessReportViewerPortal />
    </>
  );
}
