import React, { useState } from 'react';
import { useAlert } from '../context/AlertContext';
import { apiClient } from '../api/apiClient';
import { useAuth } from '../context/AuthContext';
import SemanticLogin from '../components/SemanticLogin';
import SemanticRegister from '../components/SemanticRegister';
import PublicHeader from '../components/PublicHeader';

interface PlayerGatewayProps {
  onNavigate: (route: string) => void;
  initialAuthMode?: 'login' | 'register'; // 👈 ADD THIS OPTIONAL PROP
}

export default function PlayerGateway({ onNavigate, initialAuthMode = 'login' }: PlayerGatewayProps) {
  // Toggle state: 'login' or 'register'
  const [authMode, setAuthMode] = useState<'login' | 'register'>(initialAuthMode);
  
  // Form input bindings
  const [email, setEmail] = useState(authMode === 'register' ? '' : 'chiki@wimbeldon.com');
  const [password, setPassword] = useState(authMode === 'register' ? '' : 'Password123!');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const { showAlert } = useAlert();
  const { saveSession } = useAuth();
  const [isSemanticMode, setIsSemanticMode] = useState(false);

  // Extract the multi-tenant Academy partition key straight out of the active URL string parameters
  const queryParams = new URLSearchParams(window.location.search);
  const academyIdFromUrl = queryParams.get('academyId') || '';

  if (isSemanticMode) {
    if (authMode === 'register')
      return <SemanticRegister onSwitchBack={() => setIsSemanticMode(false)} />;
    else
      return <SemanticLogin onSwitchBack={() => setIsSemanticMode(false)} />;
  }
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!academyIdFromUrl) {
      showAlert({
        title: 'Missing Academy Link ID',
        message: 'You cannot access the platform without an explicit invitation link key. Please request a valid signup link from your club administration office.',
        type: 'error'
      });
      return;
    }

    setLoading(true);
    try {
      if (authMode === 'register' || initialAuthMode === 'register') {
        // OPTION 1. ROUTE PUBLIC REGISTRATION THROUGH THE PIPELINE WRAPPER
        // Match the text capitalization of your working endpoints (e.g. '/Auth/...' or '/auth/...')
        const response = await apiClient.post('/Auth/register-player-public', {
          email,
          password,
          phoneNumber,
          academyId: academyIdFromUrl
        });

        showAlert({
          title: 'New Account Provisioned Successfully!',
          message: 'Your player profile passport has been securely stamped into this academy partition. You can now toggle to the login screen and sign in!',
          type: 'success',
          onConfirm: () => {
            setAuthMode('login'); // Flip view straight to sign-in matrix
            setPassword('');      // Clear security inputs
          }
        });
      } else {
        // OPTION 2: CALL THE EXISTING CENTRAL LOGIN LOGIC MIDDLEWARE
        const response = await apiClient.post('/Auth/login', { email, password });

        // Extracting data fields from your standard Axios/Fetch envelope mapping structure
        const token = response.data?.token || response.data?.Token;
        if (!token) throw new Error('Backend authorization payload returned an empty token signature.');
        
        localStorage.setItem('token', token); 
        
        if (typeof saveSession === 'function') {
            saveSession(token);
            window.location.href = '/';
        }

        // console.log('Role claim extracted from backend response:', response.data);

        // const userRole = 'Player'; 

        // showAlert({
        //   title: 'Handshake Validated',
        //   message: `Security flags confirmed. Authenticated as a ${userRole}. Syncing platform core layout grids...`,
        //   type: 'success',
        //   onConfirm: () => {
        //     // EXECUTE REDIRECTION OR FORCED LAYOUT RELOAD
        //     // If the user is a player, we force the active tab configuration state or refresh 
        //     // the boot-tree so the top-level App hook routes them directly onto 'bookings'! [2]
        //     if (userRole === 'Player') {
        //       // Reloading the page clears memory caches and lets App.tsx catch the fresh player state
        //       window.location.href = '/'; 
        //     } else {
        //       window.location.href = '/'; // Directors go straight to main executive matrix
        //     }
        //   }
        // });
      }
    } catch (err: any) {
      showAlert({
        title: 'Security Boundary Intercept',
        message: err.message || 'The authorization handshake failed.',
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  return (    
    <div className="min-h-screen bg-white text-slate-900 font-sans selection:bg-teal-500 selection:text-slate-950 overflow-x-hidden">      
      {/* SHARED PUBLIC LINK HEADER BAR */}
      <PublicHeader 
        onNavigate={onNavigate} 
        activeAuthMode={authMode} 
        onSetAuthMode={(mode) => setAuthMode(mode)} 
      />
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 font-mono text-xs text-slate-300">
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-2xl max-w-sm w-full">
        
        {/* UPPER VIEW CONSOLE STATUS */}
        <div className="border-b border-slate-800 pb-3 mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-black text-slate-100 uppercase tracking-wider">
              {authMode === 'login' ? '🎾 Player Sign-In' : '🔐 Player Registration'}
            </h2>
            <p className="text-slate-400 mt-1">Multi-Tenant Client Onboarding Entry</p>
          </div>
          <span className="text-emerald-500 font-bold bg-emerald-950/40 border border-emerald-900 px-2 py-0.5 rounded text-[10px]">
            {authMode === 'login' ? 'LOGIN' : 'SIGNUP'}
          </span>
        </div>

        {/* INTERACTIVE FORM ENGINE */}
        <form onSubmit={handleAuthSubmit} className="space-y-4">
          <div>
            <label className="block text-slate-400 font-bold uppercase tracking-wider text-[10px] mb-1">Email Account Address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200 focus:outline-none focus:border-slate-700 transition"
              placeholder="player@tennis.com"
            />
          </div>

          <div>
            <label className="block text-slate-400 font-bold uppercase tracking-wider text-[10px] mb-1">Secure Password String</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200 focus:outline-none focus:border-slate-700 transition"
              placeholder="••••••••••••"
            />
          </div>

          {/* DYNAMIC FIELD CONDITIONAL INTERCEPT: Only capture digits during registration loops */}
          {authMode === 'register' && (
            <div className="animate-fade-in">
              <label className="block text-slate-400 font-bold uppercase tracking-wider text-[10px] mb-1">Phone Number (For SMS Dispatches)</label>
              <input
                type="tel"
                required
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200 focus:outline-none focus:border-slate-700 transition"
                placeholder="+15550123456"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className={`w-full mt-2 font-bold py-2 px-4 rounded-lg uppercase tracking-wider transition ${
              loading ? 'bg-slate-800 text-slate-600 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-500 text-white'
            }`}
          >
            {loading ? 'Processing Protocol...' : authMode === 'login' ? '🔐 Authorize Sign-In' : '🚀 Submit Profile'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button type="button" onClick={() => setIsSemanticMode(true)} 
            className="mt-2 text-purple-400 hover:text-purple-300 font-black uppercase text-[10px] tracking-widest underline decoration-dotted transition"
          >
            🧠 OR, Open Agentic Conversational Interface
          </button>
        </div>

        {/* DUAL MODE SELECTION TOGGLE SLIDER ANCHOR */}
        <div className="mt-6 border-t border-slate-800 pt-4 text-center">
          <p className="text-slate-500 text-[11px]">
            {authMode === 'login' ? "Don't have an academy account profile yet?" : "Already registered inside this tenant database?"}
          </p>
          <button
            type="button"
            onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}
            className="mt-2 text-emerald-400 hover:text-emerald-300 font-black uppercase text-[10px] tracking-widest underline decoration-dotted transition"
          >
            {authMode === 'login' ? '⚡ Switch to Registration Form' : '🔐 Switch to Secure Login Panel'}
          </button>
        </div>
      </div>
      </div>
    </div>
  );
}
