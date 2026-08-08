import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../api/apiClient';
import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile'; // 🚀 FIXED: Standardized Import
import ConversationalLogin from '../components/ConversationalLogin'; 
import SemanticLogin from '../components/SemanticLogin';
import PublicHeader from '../components/PublicHeader';

export default function Login({ onNavigate }: { onNavigate: (route: string) => void }) {
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');

  const { saveSession } = useAuth();
  const [email, setEmail] = useState('director@londonvanguard.com');
  const [password, setPassword] = useState('LondonPass123!');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  
  // Mode tracking state hooks
  const [isConversationalMode, setIsConversationalMode] = useState(false);
  const [isSemanticMode, setIsSemanticMode] = useState(false);
  
  // 🚀 TURNSTILE STATE & DOM REF ANCHORS
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileInstance>(null);

  // Grab the site key baked into your Vite compilation bundle variables
  const TURNSTILE_SITE_KEY = (import.meta.env.VITE_TURNSTILE_SITE_KEY as string) || '1x00000000000000000000AA';

  if (isConversationalMode) {
    return <ConversationalLogin onToggleMode={() => setIsConversationalMode(false)} />;
  }

  if (isSemanticMode) {
    return <SemanticLogin onSwitchBack={() => setIsSemanticMode(false)} />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    // 🚀 ANTI-BOT PASS GATE INTERCEPT
    if (!turnstileToken) {
      setErrorMessage("Security Verification Missing: Please complete Cloudflare checks to authorize entry.");
      setIsSubmitting(false);
      return;
    }

    try {
      // Execute network handshake over your dynamic Axios base client route, passing the Turnstile token
      const response = await apiClient.post('/Auth/login', { 
        email, 
        password,
        turnstileToken: turnstileToken // 🚀 SENT TO .NET BACKEND
      });
      
      const token = response.data?.token || response.data?.Token;
      if (!token) throw new Error('Backend authorization payload returned an empty token signature.');

      // Save token directly into the AuthContext memory stream loop
      saveSession(token);
    } catch (err: any) {
      console.error("Authentication capture exception caught:", err);
      
      // Security Failure: Force reset Turnstile widget to generate a fresh dynamic token validation challenge
      setTurnstileToken(null);
      turnstileRef.current?.reset();

      // Clean fallback reads explicit error messages returned natively from your C# identity controller
      const errorText = err.response?.data?.message || err.response?.data || "Cryptographic handshake failed. Ensure server connection is live.";
      setErrorMessage(typeof errorText === 'string' ? errorText : "Invalid email or password parameters.");
    } finally {
      setIsSubmitting(false);
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
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="w-full max-w-md bg-white border border-gray-200 p-8 shadow-lg space-y-6">
          
          {/* Core Application Logo Identity Anchor */}
          <div className="text-center space-y-2">
            <div className="inline-flex items-center justify-center h-12 w-12 bg-purple-100 border border-purple-300 text-purple-600 font-black text-xl tracking-tight">
              🎾
            </div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900">
              Global Academy Portal
            </h1>
            <p className="text-slate-500 text-xs">
              Enter enterprise credentials to unlock your multi-tenant workspace matrix.
            </p>
          </div>

          {/* Dynamic Context Validation Error Alert Panel */}
          {errorMessage && (
            <div className="p-3.5 bg-rose-100 border border-rose-300 text-rose-700 text-xs font-medium animate-shake flex items-start space-x-2">
              <span className="pt-0.5">⚠️</span>
              <span className="flex-1 leading-normal">{errorMessage}</span>
            </div>
          )}

          {/* Secure Credential Input Form Container */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600">
                Identity User Email Address
              </label>
              <input
                type="email"
                required
                disabled={isSubmitting}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="director@clubdomain.com"
                className="w-full bg-gray-50 border border-gray-300 disabled:opacity-50 p-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-purple-500 transition font-medium"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600">
                Security Account Password
              </label>
              <input
                type="password"
                required
                disabled={isSubmitting}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full bg-gray-50 border border-gray-300 disabled:opacity-50 p-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-purple-500 transition font-medium"
              />
            </div>

            {/* =========================================================================
                🚀 FIXED: OFFICIAL COMPONENT MOUNT TO MATCH PLAYER GATEWAY EXACTLY
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

            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting || !turnstileToken}
                className={`w-full font-bold p-3 text-sm transition flex items-center justify-center space-x-2 ${
                  isSubmitting || !turnstileToken
                    ? 'bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed'
                    : 'bg-purple-600 hover:bg-purple-500 text-white'
                }`}
              >
                {isSubmitting ? (
                  <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <span>Access Protected Environment Dashboard</span>
                )}
              </button>
            </div>
          </form>

          <div className="text-center">
            <button type="button" onClick={() => setIsSemanticMode(true)} 
              className="mt-2 text-purple-600 hover:text-purple-500 font-black uppercase text-[10px] tracking-widest underline decoration-dotted transition"
            >
              🧠 OR, Open Agentic Conversational Interface
            </button>
          </div>

          <div className="text-center pt-2 border-t border-gray-200">
            <p className="text-[10px] text-slate-500 tracking-normal uppercase">
              Secured Layer // Multi-Tenant Data Firewall Enforced Natively
            </p>
          </div>

        </div>
      </div>
    </div>
  );
}
