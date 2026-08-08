import React, { useState, useEffect, useRef } from 'react';
import { useAlert } from '../context/AlertContext';
import { apiClient } from '../api/apiClient';
import { useAuth } from '../context/AuthContext';
import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile'; // 🚀 INJECTED
import SemanticLogin from '../components/SemanticLogin';
import SemanticRegister from '../components/SemanticRegister';
import PublicHeader from '../components/PublicHeader';

interface PlayerGatewayProps {
  onNavigate: (route: string) => void;
  initialAuthMode?: 'login' | 'register';
}

export default function PlayerGateway({ onNavigate, initialAuthMode = 'login' }: PlayerGatewayProps) {
  const [authMode, setAuthMode] = useState<'login' | 'register'>(initialAuthMode);
  
  // Form input bindings
  const [email, setEmail] = useState(authMode === 'register' ? '' : 'chiki@wimbeldon.com');
  const [password, setPassword] = useState(authMode === 'register' ? '' : 'Password123!');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [loading, setLoading] = useState(false);
  
  // 🚀 TURNSTILE STATE & DOM REF ANCHORS
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileInstance>(null);

  const { showAlert } = useAlert();
  const { saveSession } = useAuth();
  const [isSemanticMode, setIsSemanticMode] = useState(false);

  const queryParams = new URLSearchParams(window.location.search);
  const academyIdFromUrl = queryParams.get('academyId') || '';

  // Grab the site key baked into your Vite compilation bundle variables
  const TURNSTILE_SITE_KEY = (import.meta.env.VITE_TURNSTILE_SITE_KEY as string) || '1x00000000000000000000AA';
  useEffect(() => {
    const tokenFromUrl = queryParams.get('token');
    const errorFromUrl = queryParams.get('error');

    if (tokenFromUrl) {
      localStorage.setItem('global_academy_jwt_token', tokenFromUrl);
      localStorage.setItem('token', tokenFromUrl); 
      if (typeof saveSession === 'function') {
        saveSession(tokenFromUrl);
        window.location.href = '/';
      }
      setTimeout(() => {
        window.location.href = '/';
      }, 150);
    } else if (errorFromUrl) {
      showAlert({
        title: 'OAuth Handshake Intercept',
        message: errorFromUrl,
        type: 'error'
      });
    }
  }, []);

  const handleGoogleAuthRedirect = () => {
    if (!academyIdFromUrl) {
      showAlert({
        title: 'Missing Academy Link ID',
        message: 'You cannot access the platform without an explicit invitation link key.',
        type: 'error'
      });
      return;
    }
    
    let baseApi = import.meta.env.VITE_API_BASE_URL || 'https://localhost:7290/api';
    baseApi = baseApi.endsWith('/api') ? baseApi.slice(0, -4) : baseApi;

    if (baseApi.includes('localhost:5162')) {
      baseApi = 'https://localhost:7290';
    }

    window.location.href = `${baseApi}/api/Auth/external-login?provider=Google&academyId=${academyIdFromUrl}`;
  };

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

    // 🚀 ANTI-BOT PASS GATE INTERCEPT
    if (!turnstileToken) {
      showAlert({
        title: 'Security Verification Missing',
        message: 'Please wait for Cloudflare verification checks to resolve before attempting authentication entries.',
        type: 'error'
      });
      return;
    }

    setLoading(true);
    try {
      if (authMode === 'register' || initialAuthMode === 'register') {
        // APPEND TURNSTILE TOKEN TO SIGNUP DTO PAYLOAD
        await apiClient.post('/Auth/register-player-public', {
          email,
          password,
          phoneNumber,
          academyId: academyIdFromUrl,
          turnstileToken: turnstileToken // 🚀 SENT TO .NET BACKEND
        });

        showAlert({
          title: 'New Account Provisioned Successfully!',
          message: 'Your player profile passport has been securely stamped into this academy partition. You can now toggle to the login screen and sign in!',
          type: 'success',
          onConfirm: () => {
            setAuthMode('login');
            setPassword('');
            setTurnstileToken(null);
            turnstileRef.current?.reset(); // Clear old validation tokens
          }
        });
      } else {
        // APPEND TURNSTILE TOKEN TO LOGIN DTO PAYLOAD
        const response = await apiClient.post('/Auth/login', { 
          email, 
          password,
          turnstileToken: turnstileToken // 🚀 SENT TO .NET BACKEND
        });

        const token = response.data?.token || response.data?.Token;
        if (!token) throw new Error('Backend authorization payload returned an empty token signature.');
        
        localStorage.setItem('token', token); 
        
        if (typeof saveSession === 'function') {
            saveSession(token);
            window.location.href = '/';
        }
      }
    } catch (err: any) {
      // Security Failure: Force reset Turnstile widget to generate a fresh dynamic validation challenge
      setTurnstileToken(null);
      turnstileRef.current?.reset();
      
      showAlert({
        title: 'Security Boundary Intercept',
        message: err.response?.data?.message || err.message || 'The authorization handshake failed.',
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  if (isSemanticMode) {
    if (authMode === 'register')
      return <SemanticRegister onSwitchBack={() => setIsSemanticMode(false)} />;
    else
      return <SemanticLogin onSwitchBack={() => setIsSemanticMode(false)} />;
  }
  return (    
    <div className="min-h-screen bg-white text-slate-900 font-sans selection:bg-teal-500 selection:text-slate-950 overflow-x-hidden">      
      <PublicHeader 
        onNavigate={onNavigate} 
        activeAuthMode={authMode} 
        onSetAuthMode={(mode) => setAuthMode(mode)} 
      />
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4 font-sans text-xs text-slate-600">
      <div className="bg-white border border-gray-200 p-6 shadow-lg max-w-sm w-full">
        
        <div className="border-b border-gray-200 pb-3 mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider">
              {authMode === 'login' ? '🎾 Player Sign-In' : '🔐 Player Registration'}
            </h2>
            <p className="text-slate-500 mt-1">Multi-Tenant Client Onboarding Entry</p>
          </div>
          <span className="text-purple-600 font-bold bg-purple-100 border border-purple-300 px-2 py-0.5 text-[10px]">
            {authMode === 'login' ? 'LOGIN' : 'SIGNUP'}
          </span>
        </div>

        <form onSubmit={handleAuthSubmit} className="space-y-4">
          <div>
            <label className="block text-slate-600 font-bold uppercase tracking-wider text-[10px] mb-1">Email Account Address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-gray-50 border border-gray-300 p-2 text-slate-900 focus:outline-none focus:border-purple-500 transition"
              placeholder="player@tennis.com"
            />
          </div>

          <div>
            <label className="block text-slate-600 font-bold uppercase tracking-wider text-[10px] mb-1">Secure Password String</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-gray-50 border border-gray-300 p-2 text-slate-900 focus:outline-none focus:border-purple-500 transition"
              placeholder="••••••••••••"
            />
          </div>

          {authMode === 'register' && (
            <div className="animate-fade-in">
              <label className="block text-slate-600 font-bold uppercase tracking-wider text-[10px] mb-1">Phone Number (For SMS Dispatches)</label>
              <input
                type="tel"
                required
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="w-full bg-gray-50 border border-gray-300 p-2 text-slate-900 focus:outline-none focus:border-purple-500 transition"
                placeholder="+15550123456"
              />
            </div>
          )}

          {/* =========================================================================
              🚀 CLOUDFLARE TURNSTILE WIDGET EMBED LOCATION
             ========================================================================= */}
          <div className="flex justify-center pt-2">
            <Turnstile
              ref={turnstileRef}
              siteKey={TURNSTILE_SITE_KEY}
              onSuccess={(token) => setTurnstileToken(token)}
              onExpire={() => setTurnstileToken(null)}
              onError={() => setTurnstileToken(null)}
              options={{
                theme: 'light',
                size: 'normal'
              }}
            />
          </div>

          <button
            type="submit"
            disabled={loading || !turnstileToken}
            className={`w-full mt-2 font-bold py-2 px-4 uppercase tracking-wider transition ${
              loading || !turnstileToken
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200' 
                : 'bg-purple-600 hover:bg-purple-500 text-white'
            }`}
          >
            {loading ? 'Processing Protocol...' : authMode === 'login' ? '🔐 Authorize Sign-In' : '🚀 Submit Profile'}
          </button>
        </form>

        <div className="relative flex py-4 items-center">
          <div className="flex-grow border-t border-gray-200"></div>
          <span className="flex-shrink mx-3 text-gray-400 font-black tracking-widest text-[9px] uppercase">OR CONNECT IDENTITY</span>
          <div className="flex-grow border-t border-gray-200"></div>
        </div>

        <button
          type="button"
          onClick={handleGoogleAuthRedirect}
          className="w-full flex items-center justify-center gap-2 bg-white border border-gray-200 hover:bg-gray-50 active:bg-gray-100 text-slate-700 font-black py-2 px-4 uppercase tracking-wider text-[10px] transition shadow-xs cursor-pointer"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
            <path fill="#EA4335" d="M12 5.04c1.62 0 3.08.56 4.22 1.65l3.15-3.15C17.45 1.68 14.93 1 12 1 7.35 1 3.39 3.67 1.39 7.56l3.74 2.9C6.01 7.22 8.79 5.04 12 5.04z"/>
            <path fill="#4285F4" d="M23.49 12.27c0-.81-.07-1.59-.2-2.36H12v4.51h6.46c-.28 1.48-1.12 2.74-2.38 3.58l3.7 2.87c2.16-1.99 3.41-4.92 3.41-8.6z"/>
            <path fill="#FBBC05" d="M5.13 14.74c-.24-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29L1.39 7.56C.5 9.34 0 11.32 0 13.4s.5 4.06 1.39 5.84l3.74-2.5z"/>
            <path fill="#34A853" d="M12 23c3.24 0 5.97-1.07 7.96-2.91l-3.7-2.87c-1.03.69-2.35 1.11-4.26 1.11-3.21 0-5.99-2.18-6.87-5.42l-3.74 2.9C3.39 20.33 7.35 23 12 23z"/>
          </svg>
          Continue with Google Profile
        </button>

        <div className="mt-6 text-center">
          <button type="button" onClick={() => setIsSemanticMode(true)} 
            className="mt-2 text-purple-600 hover:text-purple-500 font-black uppercase text-[10px] tracking-widest underline decoration-dotted transition"
          >
            🧠 OR, Open Agentic Conversational Interface
          </button>
        </div>

        <div className="mt-6 border-t border-gray-200 pt-4 text-center">
          <p className="text-slate-500 text-[11px]">
            {authMode === 'login' ? "Don't have an academy account profile yet?" : "Already registered inside this tenant database?"}
          </p>
          <button
            type="button"
            onClick={() => {
              setAuthMode(authMode === 'login' ? 'register' : 'login');
              setTurnstileToken(null);
              turnstileRef.current?.reset();
            }}
            className="mt-2 text-purple-600 hover:text-purple-500 font-black uppercase text-[10px] tracking-widest underline decoration-dotted transition"
          >
            {authMode === 'login' ? '⚡ Switch to Registration Form' : '🔐 Switch to Secure Login Panel'}
          </button>
        </div>
      </div>
      </div>
    </div>
  );
}
