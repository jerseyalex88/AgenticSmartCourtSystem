import React, { useState, useEffect } from 'react';
import { useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Layout from './components/Layout';
import PlayerGateway from './pages/PlayerGateway';
import { PlayerBookingManager } from './pages/PlayerBookingManager';
import ShadowQueueManager from './components/ShadowQueueManager';
import AgentDispatchCenter from './components/AgentDispatchCenter';
import CourtsDashboard from './pages/CourtsDashboard';
import ChangePassword from './pages/ChangePassword';
import RosterDashboard from './pages/RosterDashboard';
import AdminTools from './pages/AdminTools'; 
import { AlertProvider } from './context/AlertContext';

export default function App() {
  const { isAuthenticated, user, loading } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');

  // Check if the current browser window path matches our new player entrance routing rule
  const isPlayerEntrancePath = window.location.pathname === '/player-gateway';

  // DYNAMIC INITIALIZATION HOOK: Automatically direct players to their booking hub!
  useEffect(() => {
    if (isAuthenticated && user) {
      // Assuming your user profile object exposes their database system role string
      const userRole = user.role || 'Player'; 
      if (userRole === 'Player') {
        setActiveTab('bookings'); // Initialize athletes straight onto their booking passport page view
      }
    }
  }, [isAuthenticated, user]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center font-mono text-xs text-slate-500">
        Syncing Platform Security Identifiers...
      </div>
    );
  }

  // 2. PUBLIC INTERCEPT BYPASS: If they are arriving via an invite link, let them in!
  if (isPlayerEntrancePath) {
    return (
      <AlertProvider>
        <PlayerGateway />
      </AlertProvider>
    );
  }

  // FORCE GATEWAY: Intercept unauthenticated users immediately
  if (!isAuthenticated || !user) {
    return (
      <AlertProvider>
        <Login />
      </AlertProvider>
    );
  }

  // ADMINISTRATIVE CORE WORKSPACE PANEL MOUNT ROUTER
  const renderTabContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <CourtsDashboard />;
      case 'bookings':
        return <PlayerBookingManager />;
      case 'roster':
        return <RosterDashboard />;
      case 'admin':
        return <AdminTools />; 
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
        return <ShadowQueueManager />;
      case 'maintenance':
        return (
          <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl">
            <h2 className="text-sm font-black text-slate-100 uppercase tracking-wider mb-2">🔧 Facility Work Order Ticket Backlog</h2>
            <p className="text-xs text-slate-400 leading-relaxed max-w-xl">
              [DEVELOPMENT WORKSPACE BLOCK]: Operational panel mapping court wear coefficients and allowing groundskeepers to run asset clearance routines.
            </p>
          </div>
        );
      case 'agent-dispatch':
        return <AgentDispatchCenter />;
      default:
        return <div className="text-slate-500 p-4">View container out of sync.</div>;
    }
  };

  return (
    <AlertProvider>
      <Layout activeTab={activeTab} setActiveTab={setActiveTab}>
        {renderTabContent()}
      </Layout>
    </AlertProvider>
  );
}
