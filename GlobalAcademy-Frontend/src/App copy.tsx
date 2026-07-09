import { useState } from 'react';
import { apiClient } from './api/apiClient';

export default function Backup_App() {
  const [email, setEmail] = useState('director@londonvanguard.com');
  const [password, setPassword] = useState('LondonPass123!');
  const [statusMessage, setStatusMessage] = useState('System ready for network handshake testing.');
  const [tokenFound, setTokenFound] = useState(false);

  // Diagnostic Test A: Hit your .NET identity login router endpoint
  const handleTestLogin = async () => {
    try {
      setStatusMessage('Executing authentication handshake over network tunnels...');
      
      const response = await apiClient.post('/Auth/login', { email, password });
      const { token } = response.data;
      
      // Save token to satisfy our Axios automation interceptor logic parameters
      localStorage.setItem('global_academy_jwt_token', token);
      setTokenFound(true);
      setStatusMessage('🎉 Authentication Success! Cryptographic bearer passport secured inside browser storage.');
    } catch (err: any) {
      setTokenFound(false);
      setStatusMessage(`❌ Authentication Failure: ${err.response?.data || err.message}`);
    }
  };

  // Diagnostic Test B: Execute multi-tenant data lookup query through the filter firewalls
  const handleFetchBranchesTest = async () => {
    try {
      setStatusMessage('Polling multi-tenant backend infrastructure layers...');
      
      const response = await apiClient.get('/Facility/branches');
      const count = response.data.length;
      
      setStatusMessage(`🎉 Database Read Success! Past multi-tenant filter firewall, your token discovered [ ${count} ] active Branch records sitting inside PostgreSQL!`);
    } catch (err: any) {
      setStatusMessage(`❌ Database Read Failure (Query filter block?): ${err.response?.status} - ${err.response?.data || err.message}`);
    }
  };

  // Helper utility to clear context state trees
  const handleClearTokens = () => {
    localStorage.removeItem('global_academy_jwt_token');
    setTokenFound(false);
    setStatusMessage('Browser storage cleared cleanly. Identity context reset to anonymous.');
  };

  return (
    <div className="flex flex-col items-center justify-center p-8 max-w-2xl mx-auto space-y-6 mt-12 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl">
      <div className="text-center">
        <h1 className="text-3xl font-extrabold tracking-tight text-emerald-400">GlobalAcademy Setup Verification</h1>
        <p className="text-slate-400 mt-2 text-sm">Validating Tailwind Processing, CORS Gateway Allowances, & Axios Automatic Interceptors.</p>
      </div>

      {/* Tailwind Utility Box Verification Block */}
      <div className="w-full bg-slate-900/50 p-4 rounded-lg border border-slate-700/50 text-xs font-mono text-slate-300">
        <span className="text-emerald-500 font-bold">[CONSOLE DIAGNOSTIC LOG]:</span> {statusMessage}
      </div>

      {/* Manual Verification Form Arrays */}
      <div className="w-full space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Testing Profile Email</label>
            <input type="text" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-slate-900 border border-slate-700 p-2 rounded text-sm text-slate-100 focus:outline-none focus:border-emerald-500" />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Testing Profile Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-slate-900 border border-slate-700 p-2 rounded text-sm text-slate-100 focus:outline-none focus:border-emerald-500" />
          </div>
        </div>

        <div className="flex flex-col gap-2 pt-2">
          <button onClick={handleTestLogin} className="w-full bg-emerald-600 hover:bg-emerald-500 font-semibold text-white p-2.5 rounded text-sm transition shadow-lg shadow-emerald-900/20">
            Step 1: Test Authentication Handshake (POST /Auth/login)
          </button>
          
          <button onClick={handleFetchBranchesTest} disabled={!tokenFound} className="w-full disabled:opacity-40 disabled:cursor-not-allowed bg-blue-600 hover:bg-blue-500 font-semibold text-white p-2.5 rounded text-sm transition shadow-lg shadow-blue-900/20">
            Step 2: Test Multi-Tenant Database Query (GET /Facility/branches)
          </button>

          <button onClick={handleClearTokens} className="w-full text-slate-400 hover:text-slate-200 text-xs underline pt-2 text-center transition">
            Reset Identity Token Cache Profile
          </button>
        </div>
      </div>
    </div>
  );
}
