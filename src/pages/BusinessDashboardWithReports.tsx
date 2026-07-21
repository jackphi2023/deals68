import BusinessDashboard from './BusinessDashboard';
import BusinessReportPanelPortal from '../features/businessReports/BusinessReportPanelPortal';

export default function BusinessDashboardWithReports() {
  return (
    <>
      <BusinessDashboard />
      <BusinessReportPanelPortal />
    </>
  );
}
