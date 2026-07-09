import { useState } from 'react';
import { useAuth } from './context/AuthContext';
import { apiClient } from './api/apiClient';
import Login from './pages/Login'; // ◄--- IMPORT YOUR NEW GATEWAY PAGE

export default function Test3_App() {
  const { isAuthenticated, user, clearSession, loading } = useAuth();
  const [statusText, setStatusText] = useState('Awaiting multi-tenant operation validation tests.');

  // Verification helper: Proves that your Axios interceptor carries the token smoothly past the firewall
  const handleFetchBranchesVerification = async () => {
    try {
      setStatusText('Contacting PostgreSQL clusters...');
      const response = await apiClient.get('/Facility/branches');
      setStatusText(`🎉 Live Database Match! past the multi-tenant query filter, your token read [ ${response.data.length} ] branches successfully!`);
    } catch (err: any) {
      setStatusText(`❌ Network Data Query Crash: ${err.response?.status} - ${err.response?.data || err.message}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center font-mono text-xs text-slate-500">
        Syncing Platform Security Identifiers...
      </div>
    );
  }

  // INTERCEPT CONDITION: If unauthorized, force them to stand at the secure login front door!
  if (!isAuthenticated || !user) {
    return <Login />;
  }

  // SUCCESS HUD VIEW: This screen renders only when a user possesses a valid passport token!
  return (
    <div className="min-h-screen bg-slate-950 p-8 flex flex-col items-center justify-center space-y-6">
      <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
        
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h2 className="text-lg font-black text-emerald-400">Authenticated Environment Hub</h2>
            <p className="text-[11px] text-slate-400">Secure data session successfully mapped via your token payload claims.</p>
          </div>
          <button 
            onClick={clearSession}
            className="text-xs bg-slate-800 hover:bg-rose-950/40 hover:text-rose-400 hover:border-rose-900 text-slate-300 border border-slate-700 px-3 py-1.5 rounded-lg transition font-medium"
          >
            Log Out Session
          </button>
        </div>

        {/* Live Active Profile Panel Matrix */}
        <div className="bg-slate-950 border border-slate-850 p-4 rounded-xl font-mono text-xs text-slate-300 space-y-2 shadow-inner">
          <p><span className="text-slate-500">Active Account:</span> <span className="text-slate-200 font-bold">{user.email}</span></p>
          <p><span className="text-slate-500">Assigned Role:</span> <span className="bg-emerald-950 text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-900/60 font-sans font-bold text-[10px] tracking-wide uppercase">{user.role}</span></p>
          <p><span className="text-slate-500">AcademyId Hex:</span> <span className="text-blue-400 break-all">{user.academyId}</span></p>
        </div>

        {/* Operational Query Action Bar */}
        <div className="space-y-2 pt-2">
          <button
            onClick={handleFetchBranchesVerification}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold p-2.5 rounded-xl text-xs transition shadow-lg shadow-blue-950/20"
          >
            Verify Axios Token Interceptor: Query Branch Assets Live (GET /api/Facility/branches)
          </button>
          
          <div className="p-3 bg-slate-950/50 border border-slate-850 rounded-lg text-center font-mono text-[10px] text-slate-400">
            <span className="text-blue-400 font-bold">[TELEMETRY RESPONSE]:</span> {statusText}
          </div>
        </div>

      </div>
    </div>
  );
}
