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
  const [authMode, setAuthMode] = useState<'login' | 'register' | 'forgot'>(initialAuthMode);
  
  // Form input bindings
  const [email, setEmail] = useState(authMode === 'register' ? '' : 'chiki@wimbeldon.com');
  const [password, setPassword] = useState(authMode === 'register' ? '' : 'Password123!');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [loading, setLoading] = useState(false);
  
  // 🚀 ACCOUNT RECOVERY STATUS NOTICES
  const [forgotMessage, setForgotMessage] = useState<string | null>(null);
  const [isForgotSuccess, setIsForgotSuccess] = useState<boolean>(false);
   
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

  // Helper routine to cleanly cycle form views and wipe token chains safely
  const handleSwitchAuthMode = (mode: 'login' | 'register' | 'forgot') => {
    setAuthMode(mode);
    setForgotMessage(null);
    setTurnstileToken(null);
    turnstileRef.current?.reset();
  };

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
  // =========================================================================
  // 🚀 SELF-SERVICE PASSWORD RECOVERY LINK DISPATCHER
  // =========================================================================
  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotMessage(null);

    if (!academyIdFromUrl) {
      showAlert({
        title: 'Missing Academy Link ID',
        message: 'You cannot initiate account recovery parameters without an explicit multi-tenant link context.',
        type: 'error'
      });
      return;
    }

    if (!turnstileToken) {
      showAlert({
        title: 'Security Verification Missing',
        message: 'Please complete Cloudflare validation checks to authorize password recovery.',
        type: 'error'
      });
      return;
    }

    setLoading(true);
    try {
      // Fires token request to your new C# endpoint mapping contract
      const response = await apiClient.post('/Auth/forgot-password-request', {
        email: email.trim(),
        academyId: academyIdFromUrl
      });

      setIsForgotSuccess(true);
      setForgotMessage(response.data?.message || '✅ Security recovery link dispatched! Check your email inbox.');
    } catch (err: any) {
      console.error("Forgot password request exception caught:", err);
      setIsForgotSuccess(false);
      const serverErr = err.response?.data?.message || err.message || 'Failed to dispatch account recovery request.';
      setForgotMessage(`❌ Request Intercepted: ${serverErr}`);
    } finally {
      setLoading(false);
      setTurnstileToken(null);
      turnstileRef.current?.reset(); // Force fresh anti-bot challenge render
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
              {authMode === 'login' ? '🎾 Player Sign-In' : authMode === 'forgot' ? '🔐 Recover Account' : '🔐 Player Registration'}
            </h2>
            <p className="text-slate-500 mt-1">Multi-Tenant Client Onboarding Entry</p>
          </div>
          <span className="text-purple-600 font-bold bg-purple-100 border border-purple-300 px-2 py-0.5 text-[10px]">
            {authMode === 'login' ? 'LOGIN' : authMode === 'forgot' ? 'RECOVERY' : 'SIGNUP'}
          </span>
        </div>

        {/* Dynamic Inline Security Notification Banner for Recovery Mode */}
        {authMode === 'forgot' && forgotMessage && (
          <div className={`p-3 text-[11px] font-semibold mb-4 leading-normal ${
            isForgotSuccess ? 'bg-emerald-100 border border-emerald-300 text-emerald-700' : 'bg-rose-100 border border-rose-300 text-rose-700'
          }`}>
            {forgotMessage}
          </div>
        )}

        {/* INTERACTIVE DYNAMIC FORM CONTROL ENGINE */}
        <form onSubmit={authMode === 'forgot' ? handleForgotPasswordSubmit : handleAuthSubmit} className="space-y-4">
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

          {/* Render password inputs ONLY if not in password recovery state */}
          {authMode !== 'forgot' && (
            <div>
              <label className="block text-slate-600 font-bold uppercase tracking-wider text-[10px] mb-1">Password</label>
              <div className="relative flex items-center max-w-sm w-full">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-300 p-2 text-slate-900 focus:outline-none focus:border-purple-500 transition"
                  placeholder="••••••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 text-slate-400 hover:text-purple-600 transition focus:outline-none"
                  title={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" /></svg>
                  ) : (
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                  )}
                </button>
              </div>
              
              {/* 🚀 INLINE FORGOT PASSWORD TEXT LINK */}
              {authMode === 'login' && (
                <div className="text-right mt-1.5">
                  <button
                    type="button"
                    onClick={() => handleSwitchAuthMode('forgot')}
                    className="text-purple-600 hover:text-purple-500 font-semibold tracking-wide text-[10px] uppercase underline decoration-dotted transition"
                  >
                    Forgot Password?
                  </button>
                </div>
              )}
            </div>
          )}

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

          <div className="w-full pt-2 flex justify-center" key={authMode}>
            <Turnstile
              ref={turnstileRef}
              siteKey={TURNSTILE_SITE_KEY}
              onSuccess={(token) => setTurnstileToken(token)}
              onExpire={() => setTurnstileToken(null)}
              onError={() => setTurnstileToken(null)}
              options={{
                theme: 'light',
                size: 'flexible'
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
            {loading ? 'Processing Protocol...' : authMode === 'login' ? '🔐 Authorize Sign-In' : authMode === 'forgot' ? '⚡ Send Recovery Link' : '🚀 Submit Profile'}
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
              if (authMode === 'forgot') {
                handleSwitchAuthMode('login');
              } else {
                handleSwitchAuthMode(authMode === 'login' ? 'register' : 'login');
              }
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
