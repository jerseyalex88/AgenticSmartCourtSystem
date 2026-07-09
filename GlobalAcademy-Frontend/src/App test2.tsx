import { useState } from 'react';
import { useAuth } from './context/AuthContext';
import { apiClient } from './api/apiClient';

export default function Test2_App() {
  const { isAuthenticated, user, saveSession, clearSession, loading } = useAuth();
  const [email] = useState('director@londonvanguard.com');
  const [password] = useState('LondonPass123!');
  const [status, setStatus] = useState('Standby. Click button to test token decoding memory loops.');

  const handleTestLoginAndExtraction = async () => {
    try {
      setStatus('Firing authentication request to .NET server...');
      const response = await apiClient.post('/Auth/login', { email, password });
      
      // Pass token directly to the AuthContext context manager layer
      saveSession(response.data.token);
      setStatus('🎉 Session Committed! Claims parsed cleanly out of the token.');
    } catch (err: any) {
      setStatus(`❌ Token Handshake Error: ${err.message}`);
    }
  };

  if (loading) return <div className="text-center mt-12 text-slate-400">Warming up Auth Engines...</div>;

  return (
    <div className="flex flex-col items-center justify-center p-8 max-w-2xl mx-auto space-y-6 mt-12 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl">
      <div className="text-center">
        <h1 className="text-2xl font-black text-amber-400">Milestone 1 Test: Context Claim Decoded</h1>
        <p className="text-slate-400 text-xs mt-1">Verifying that AuthContext extracts user credentials from token metadata array structures.</p>
      </div>

      <div className="w-full bg-slate-900/60 p-3 rounded border border-slate-700 font-mono text-xs text-slate-300">
        <span className="text-amber-500 font-bold">[ENGINE STATE]:</span> {status}
      </div>

      {/* RENDER ACTIVE MEMORY INSIDE STATE PANELS */}
      <div className="w-full grid grid-cols-2 gap-4 text-sm">
        <div className="p-4 bg-slate-900 rounded border border-slate-700/60 space-y-2">
          <h2 className="font-bold text-slate-300 border-b border-slate-700 pb-1 text-xs uppercase tracking-wider">React State Matrix</h2>
          <p>Authenticated: <span className={isAuthenticated ? "text-emerald-400 font-bold" : "text-rose-400"}>{isAuthenticated ? "TRUE" : "FALSE"}</span></p>
          <p className="text-xs text-slate-400 font-mono">User Profile Object: {user ? "Loaded" : "Null"}</p>
        </div>

        <div className="p-4 bg-slate-900 rounded border border-slate-700/60 space-y-2">
          <h2 className="font-bold text-slate-300 border-b border-slate-700 pb-1 text-xs uppercase tracking-wider">Decoded Token Claims</h2>
          {isAuthenticated && user ? (
            <div className="space-y-1 font-mono text-xs text-slate-300">
              <p><span className="text-purple-400">Email:</span> {user.email}</p>
              <p><span className="text-purple-400">Role:</span> <span className="bg-purple-900/40 text-purple-300 px-1 rounded">{user.role}</span></p>
              <p><span className="text-purple-400">AcademyId:</span> <span className="text-emerald-400 text-[10px] break-all">{user.academyId}</span></p>
            </div>
          ) : (
            <p className="text-xs text-slate-500 italic pt-2">No token parsed. Claims unextracted.</p>
          )}
        </div>
      </div>

      <div className="w-full pt-2">
        {!isAuthenticated ? (
          <button onClick={handleTestLoginAndExtraction} className="w-full bg-amber-600 hover:bg-amber-500 text-slate-900 font-black p-3 rounded transition shadow-lg shadow-amber-900/10">
            Execute Milestone 1 Login & Claim Extraction Test
          </button>
        ) : (
          <button onClick={clearSession} className="w-full bg-rose-900/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800 font-bold p-3 rounded transition">
            Clear Active Context Session Memory
          </button>
        )}
      </div>
    </div>
  );
}
