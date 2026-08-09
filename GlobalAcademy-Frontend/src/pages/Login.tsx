import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../api/apiClient';
import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile';
import ConversationalLogin from '../components/ConversationalLogin'; 
import SemanticLogin from '../components/SemanticLogin';
import PublicHeader from '../components/PublicHeader';

export default function Login({ onNavigate }: { onNavigate: (route: string) => void }) {
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');

  const { saveSession } = useAuth();
  // const [email, setEmail] = useState('director@londonvanguard.com');
  const [email, setEmail] = useState('areyesbiz@hotmail.com');
  const [password, setPassword] = useState('LondonPass123!');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [showPassword, setShowPassword] = useState<boolean>(false);
  
  // Mode tracking state hooks
  const [isConversationalMode, setIsConversationalMode] = useState(false);
  const [isSemanticMode, setIsSemanticMode] = useState(false);
  
  // 🚀 PHASE 2: TWO-FACTOR LAYER STATE HOOKS & REF ANCHORS
  const [isTwoFactorChallenge, setIsTwoFactorChallenge] = useState<boolean>(false);
  const [twoFactorCode, setTwoFactorCode] = useState<string>('');
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileInstance>(null);

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

    if (!turnstileToken) {
      setErrorMessage("Security Verification Missing: Please complete Cloudflare checks to authorize entry.");
      setIsSubmitting(false);
      return;
    }

    try {
      if (isTwoFactorChallenge) {
        // 🚀 LAYER B INTERCEPT: DISPATCH THE ROLLING AUTHENTICATOR PIN TO THE BACKEND
        const response = await apiClient.post('/Auth/verify-2fa', { 
          email, 
          code: twoFactorCode,
          turnstileToken: turnstileToken 
        });
        
        const token = response.data?.token || response.data?.Token;
        if (!token) throw new Error('Backend authentication payload failed to issue a token signature.');
        saveSession(token);
      } else {
        // 🚀 LAYER A INITIAL ENTRY: SEND EMAIL/PASSWORD CHECK
        const response = await apiClient.post('/Auth/login', { 
          email, 
          password,
          turnstileToken: turnstileToken 
        });

        // Detect if high-privilege user account hits the C# security partition roadblock
        const responseStatus = response.data?.status || response.data?.Status;
        if (responseStatus === "2FA_CHALLENGE_REQUIRED") {
          setIsTwoFactorChallenge(true);
          setTwoFactorCode('');
          setTurnstileToken(null);
          turnstileRef.current?.reset(); // Force clear old token strings to trigger a fresh challenge block
          setIsSubmitting(false);
          return;
        }

        const token = response.data?.token || response.data?.Token;
        if (!token) throw new Error('Backend authorization payload returned an empty token signature.');
        saveSession(token);
      }
    } catch (err: any) {
      console.error("Authentication capture exception caught:", err);
      setTurnstileToken(null);
      turnstileRef.current?.reset();

      const errorText = err.response?.data?.message || err.response?.data || "Handshake verification fault.";
      setErrorMessage(typeof errorText === 'string' ? errorText : "Invalid email parameters or validation code exception.");
    } finally {
      setIsSubmitting(false);
    }
  };
  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans selection:bg-teal-500 selection:text-slate-950 overflow-x-hidden">      
      <PublicHeader 
        onNavigate={onNavigate} 
        activeAuthMode={authMode} 
        onSetAuthMode={(mode) => setAuthMode(mode)} 
      />
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="w-full max-w-md bg-white border border-gray-200 p-8 shadow-lg space-y-6">
          
          <div className="text-center space-y-2">
            <div className="inline-flex items-center justify-center h-12 w-12 bg-purple-100 border border-purple-300 text-purple-600 font-black text-xl tracking-tight">
              {isTwoFactorChallenge ? '🔒' : '🎾'}
            </div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900">
              {isTwoFactorChallenge ? 'Two-Factor Challenge' : 'Global Academy Portal'}
            </h1>
            <p className="text-slate-500 text-xs">
              {isTwoFactorChallenge 
                ? 'Multi-factor verification required for high-privilege management nodes.' 
                : 'Enter enterprise credentials to unlock your multi-tenant workspace matrix.'}
            </p>
          </div>

          {errorMessage && (
            <div className="p-3.5 bg-rose-100 border border-rose-300 text-rose-700 text-xs font-medium animate-shake flex items-start space-x-2">
              <span className="pt-0.5">⚠️</span>
              <span className="flex-1 leading-normal">{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isTwoFactorChallenge ? (
              /* PANEL STAGE A: BASELINE PASSPORT FORMS (EMAIL & PASSWORD) */
              <>
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
                  <div className="relative flex items-center max-w-sm w-full">
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      disabled={isSubmitting}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full bg-gray-50 border border-gray-300 disabled:opacity-50 p-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-purple-500 transition font-medium"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 text-slate-400 hover:text-purple-600 transition focus:outline-none"
                      title={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? (
                        /* EYE CLOSED ICON PATH */
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                        </svg>
                      ) : (
                        /* EYE OPEN ICON PATH */
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              /* PANEL STAGE B: VAULT ENTRANCE (6-DIGIT ROLLING TOTP FIELD) */
              <div className="space-y-2 animate-fade-in">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-purple-600">
                  Verification PIN String Code
                </label>
                <input
                  type="text"
                  required
                  maxLength={6}
                  disabled={isSubmitting}
                  value={twoFactorCode}
                  onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, ''))} // Strips text inputs to maintain numeric strings
                  placeholder="000000"
                  className="w-full bg-purple-50 border border-purple-300 tracking-widest text-center text-xl p-3 text-purple-950 font-black focus:outline-none focus:border-purple-600 transition"
                />
              </div>
            )}

            {/* CLOUDFLARE ANTI-BOT PROTECTION CANVAS (Forcing fresh lifecycle rendering across view flips) */}
            <div className="flex justify-center pt-2" key={isTwoFactorChallenge ? "2fa_stage" : "auth_stage"}>
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
                  <span>
                    {isTwoFactorChallenge ? '🔒 Authorize Management Vault' : 'Access Protected Environment Dashboard'}
                  </span>
                )}
              </button>
            </div>
          </form>

          {!isTwoFactorChallenge && (
            <div className="text-center">
              <button type="button" onClick={() => setIsSemanticMode(true)} 
                className="mt-2 text-purple-600 hover:text-purple-500 font-black uppercase text-[10px] tracking-widest underline decoration-dotted transition"
              >
                🧠 OR, Open Agentic Conversational Interface
              </button>
            </div>
          )}

          <div className="text-center pt-2 border-t border-gray-200">
            <p className="text-[10px] text-slate-500 tracking-normal uppercase">
              {isTwoFactorChallenge ? 'Verification Gateway Channel' : 'Secured Layer // Multi-Tenant Data Firewall Enforced Natively'}
            </p>
          </div>

        </div>
      </div>
    </div>
  );
}
