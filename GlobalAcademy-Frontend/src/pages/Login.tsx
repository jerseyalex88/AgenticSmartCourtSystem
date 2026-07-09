import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../api/apiClient';

export default function Login() {
  const { saveSession } = useAuth();
  const [email, setEmail] = useState('director@londonvanguard.com');
  const [password, setPassword] = useState('LondonPass123!');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      // Execute network handshake over your dynamic Axios base client route
      const response = await apiClient.post('/Auth/login', { email, password });
      const { token } = response.data;
      
      // Save token directly into the AuthContext memory stream loop
      saveSession(token);
    } catch (err: any) {
      console.error("Authentication capture exception caught:", err);
      // Clean fallback reads explicit error messages returned natively from your C# identity controller
      const errorText = err.response?.data || "Cryptographic handshake failed. Ensure server connection is live.";
      setErrorMessage(typeof errorText === 'string' ? errorText : "Invalid email or password parameters.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-4">
      <div className="w-full max-w-md bg-slate-900/80 backdrop-blur-md border border-slate-800 p-8 rounded-2xl shadow-2xl space-y-6">
        
        {/* Core Application Logo Identity Anchor */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center h-12 w-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-black text-xl tracking-tight shadow-inner shadow-emerald-500/10">
            🎾
          </div>
          <h1 className="text-2xl font-black tracking-tight bg-gradient-to-r from-slate-100 to-slate-300 bg-clip-text text-transparent">
            Global Academy Portal
          </h1>
          <p className="text-slate-400 text-xs">
            Enter enterprise credentials to unlock your multi-tenant workspace matrix.
          </p>
        </div>

        {/* Dynamic Context Validation Error Alert Panel */}
        {errorMessage && (
          <div className="p-3.5 bg-rose-950/40 border border-rose-900/60 rounded-xl text-rose-300 text-xs font-medium animate-shake flex items-start space-x-2">
            <span className="pt-0.5">⚠️</span>
            <span className="flex-1 leading-normal">{errorMessage}</span>
          </div>
        )}

        {/* Secure Credential Input Form Container */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Identity User Email Address
            </label>
            <input
              type="email"
              required
              disabled={isSubmitting}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="director@clubdomain.com"
              className="w-full bg-slate-950/80 border border-slate-800 disabled:opacity-50 p-3 rounded-xl text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition font-medium shadow-inner"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Security Account Password
            </label>
            <input
              type="password"
              required
              disabled={isSubmitting}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              className="w-full bg-slate-950/80 border border-slate-800 disabled:opacity-50 p-3 rounded-xl text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition font-medium shadow-inner"
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-600 disabled:cursor-not-allowed font-bold text-slate-900 p-3 rounded-xl text-sm transition shadow-xl shadow-emerald-950/20 flex items-center justify-center space-x-2"
            >
              {isSubmitting ? (
                <div className="h-4 w-4 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
              ) : (
                <span>Access Protected Environment Dashboard</span>
              )}
            </button>
          </div>
        </form>

        <div className="text-center pt-2 border-t border-slate-800/60">
          <p className="text-[10px] font-mono text-slate-500 tracking-normal uppercase">
            Secured Layer // Multi-Tenant Data Firewall Enforced Natively
          </p>
        </div>

      </div>
    </div>
  );
}
