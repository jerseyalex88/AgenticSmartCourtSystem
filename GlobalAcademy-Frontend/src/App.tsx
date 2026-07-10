import React, { useState } from 'react';
import { useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Layout from './components/Layout';
import CourtsDashboard from './pages/CourtsDashboard';
import ChangePassword from './pages/ChangePassword';
import RosterDashboard from './pages/RosterDashboard';
import AdminTools from './pages/AdminTools'; 
import { apiClient } from './api/apiClient';

function ShadowQueueManager() {
  const [report, setReport] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [seedMessage, setSeedMessage] = useState<string | null>(null);

  // TRIGGER 1: POPULATE DISPLACED MOCK DATA MATRIX
  const executeTestDataSeeder = async () => {
    setSeeding(true);
    setSeedMessage(null);
    try {
      // Clean, authenticated POST via your centralized client interceptor
      const response = await apiClient.post<{ message: string }>('/aiorchestration/ai/match-saver/seed-test-data');
      setSeedMessage(response.data.message || 'Sandbox rows injected successfully!');
    } catch (err: any) {
      setSeedMessage(`Seeding Error: ${err.response?.data || err.message}`);
    } finally {
      setSeeding(false);
    }
  };

  // TRIGGER 2: EXECUTE SEMANTIC KERNEL AUTO-INVOCATION AGENT
  const executeAiOptimizer = async () => {
    setRunning(true);
    setReport(null);
    try {
      // Routing directly through the client pipeline to ensure multi-tenant boundary compliance
      const response = await apiClient.post<{ report: string }>('/aiorchestration/ai/match-saver/run');
      setReport(response.data.report);
    } catch (err: any) {
      setReport(`Execution Failure: ${err.response?.data || err.message}`);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl font-mono text-xs">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4 border-b border-slate-800 pb-4 gap-4">
        <div>
          <h2 className="text-sm font-black text-slate-100 uppercase tracking-wider">🔄 Displaced Player Shadow Queue</h2>
          <p className="text-slate-400 mt-1">Autonomous backend optimization routing engine powered by gpt-5.4-mini.</p>
        </div>
        
        <div className="flex items-center gap-2 self-end md:self-auto">
          <button
            onClick={executeTestDataSeeder}
            disabled={seeding || running}
            className={`px-3 py-2 rounded-lg font-bold uppercase tracking-wider transition text-[10px] ${
              seeding ? 'bg-slate-800 text-slate-600 cursor-not-allowed' : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
            }`}
          >
            {seeding ? 'Injecting Mock Rows...' : '🧪 Seed Tenant Sandbox Data'}
          </button>

          <button
            onClick={executeAiOptimizer}
            disabled={running || seeding}
            className={`px-4 py-2 rounded-lg font-bold uppercase tracking-wider transition ${
              running ? 'bg-slate-800 text-slate-600 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-500 text-white'
            }`}
          >
            {running ? 'Running Agent Loop...' : '⚡ Launch AI Match-Saver'}
          </button>
        </div>
      </div>

      {seedMessage && (
        <div className="mb-4 p-2 bg-slate-950 border border-slate-800 rounded-lg text-amber-400 text-[11px] animate-pulse">
          ℹ️ [Data Engine Status]: {seedMessage}
        </div>
      )}

      {report && (
        <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl text-slate-300 whitespace-pre-wrap leading-relaxed max-w-4xl">
          <div className="text-emerald-400 font-bold mb-2 uppercase">[AI Agent Execution Report Summary]</div>
          {report}
        </div>
      )}
    </div>
  );
}

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
