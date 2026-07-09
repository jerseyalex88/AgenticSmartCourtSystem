import { useState } from 'react';
import { useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Layout from './components/Layout';
import CourtsDashboard from './pages/CourtsDashboard';
import ChangePassword from './pages/ChangePassword';

export default function App() {
  const { isAuthenticated, user, loading } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center font-mono text-xs text-slate-500">
        Syncing Platform Security Identifiers...
      </div>
    );
  }

  // FORCE GATEWAY: Intercept unauthenticated users immediately
  if (!isAuthenticated || !user) {
    return <Login />;
  }

  // ADMINISTRATIVE CORE WORKSPACE PANEL MOUNT ROUTER
  const renderTabContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <CourtsDashboard />;
      case 'password':
        return <ChangePassword />;
      case 'bookings':
        return (
          <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl">
            <h2 className="text-sm font-black text-slate-100 uppercase tracking-wider mb-2">⏱️ Fixed Booking Grid Matrices</h2>
            <p className="text-xs text-slate-400 leading-relaxed max-w-xl">
              [DEVELOPMENT WORKSPACE BLOCK]: Daily 60- and 90-minute time-slot matrix trackers loading under standard UTC constraints.
            </p>
          </div>
        );
      case 'shadow-queue':
        return (
          <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl">
            <h2 className="text-sm font-black text-slate-100 uppercase tracking-wider mb-2">🔄 Displaced Player Shadow Queue</h2>
            <p className="text-xs text-slate-400 leading-relaxed max-w-xl">
              [DEVELOPMENT WORKSPACE BLOCK]: Live standby grid monitoring matches bumped out by executive clinic overrides, awaiting AI saver optimization routing.
            </p>
          </div>
        );
      case 'maintenance':
        return (
          <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl">
            <h2 className="text-sm font-black text-slate-100 uppercase tracking-wider mb-2">🔧 Facility Work Order Ticket Backlog</h2>
            <p className="text-xs text-slate-400 leading-relaxed max-w-xl">
              [DEVELOPMENT WORKSPACE BLOCK]: Operational panel mapping court wear coefficients and allowing groundskeepers to run asset clearance routines.
            </p>
          </div>
        );
      default:
        return <div className="text-slate-500 p-4">View container out of sync.</div>;
    }
  };

  return (
    <Layout activeTab={activeTab} setActiveTab={setActiveTab}>
      {renderTabContent()}
    </Layout>
  );
}
