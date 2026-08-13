import React, { useState, useEffect, useRef } from 'react';
import { apiClient } from '../api/apiClient';
import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile';

interface ResetPasswordProps {
  onNavigate: (route: string) => void;
}

export default function ResetPassword({ onNavigate }: ResetPasswordProps) {
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [uiMessage, setUiMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);
  
  // Turnstile state and ref anchors
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileInstance>(null);

  // Extract query parameters straight out of the active URL string parameters
  const queryParams = new URLSearchParams(window.location.search);
  const emailFromUrl = queryParams.get('email') || '';
  const tokenFromUrl = queryParams.get('token') || '';
  const academyIdFromUrl = queryParams.get('academyId') || '';

  const TURNSTILE_SITE_KEY = (import.meta.env.VITE_TURNSTILE_SITE_KEY as string) || '1x00000000000000000000AA';

  useEffect(() => {
    if (!emailFromUrl || !tokenFromUrl) {
      setIsSuccess(false);
      setUiMessage("⚠️ Security Exception: Missing critical recovery parameters or expired tracking links. Please request a fresh link.");
    }
  }, [emailFromUrl, tokenFromUrl]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUiMessage(null);

    if (!emailFromUrl || !tokenFromUrl) {
      setUiMessage("❌ Submission Blocked: Missing valid email configuration or token strings.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setUiMessage("Validation Error: The password entries do not match.");
      return;
    }

    if (newPassword.length < 6) {
      setUiMessage("Validation Error: Passwords must be at least 6 characters in length.");
      return;
    }

    if (!turnstileToken) {
      setUiMessage("Security Verification Missing: Please complete Cloudflare checks to authorize updates.");
      return;
    }

    try {
      setIsSubmitting(true);

      // Dispatches request payload to your new C# complete-password-reset backend contract
      await apiClient.post('/Auth/complete-password-reset', {
        email: emailFromUrl,
        token: tokenFromUrl,
        newPassword: newPassword.trim()
      });

      setIsSuccess(true);
      setUiMessage("🎉 Credentials updated successfully! Your account vault has been re-sealed with your new password string.");
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      console.error("Password reset error:", err);
      setIsSuccess(false);
      const serverErr = err.response?.data?.message || err.response?.data || 'Access Denied: The reset handshake failed.';
      setUiMessage(`❌ Error: ${serverErr}`);
      setTurnstileToken(null);
      turnstileRef.current?.reset(); // Force widget refresh on exception captures
    } {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4 font-sans text-xs text-slate-600 select-none">
      <div className="bg-white border border-gray-200 p-8 shadow-xl max-w-sm w-full space-y-6">
        
        {/* Upper Branding Header Panel */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center h-12 w-12 bg-purple-100 border border-purple-300 text-purple-600 font-black text-xl">
            🔐
          </div>
          <h1 className="text-xl font-black tracking-tight text-slate-900 uppercase">
            Reset Account Password
          </h1>
          <p className="text-slate-500 text-[11px] leading-normal">
            Configure new system login credentials for multi-tenant network access.
          </p>
        </div>

        {/* Dynamic Context Notice Banner Panel */}
        {uiMessage && (
          <div className={`p-3.5 font-semibold leading-normal border ${
            isSuccess 
              ? 'bg-emerald-100 border-emerald-300 text-emerald-700' 
              : 'bg-rose-100 border-rose-300 text-rose-700 animate-shake'
          }`}>
            {uiMessage}
          </div>
        )}

        {/* Verification Render Block Check */}
        {(!isSuccess && emailFromUrl && tokenFromUrl) && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-slate-600 font-bold uppercase tracking-wider text-[10px] mb-1">
                Target User Email Profile
              </label>
              <input
                type="email"
                disabled
                value={emailFromUrl}
                className="w-full bg-gray-100 border border-gray-300 p-2.5 text-slate-500 font-medium cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-slate-600 font-bold uppercase tracking-wider text-[10px] mb-1">
                Fresh New Password String
              </label>
              <div className="relative flex items-center w-full">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  disabled={isSubmitting}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full bg-gray-50 border border-gray-300 p-2.5 pr-10 text-slate-900 focus:outline-none focus:border-purple-500 transition font-medium"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 text-slate-400 hover:text-purple-600 focus:outline-none"
                >
                  {showPassword ? (
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" /></svg>
                  ) : (
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                  )}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-slate-600 font-bold uppercase tracking-wider text-[10px] mb-1">
                Confirm New Password Entry
              </label>
              <input
                type={showPassword ? "text" : "password"}
                required
                disabled={isSubmitting}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full bg-gray-50 border border-gray-300 p-2.5 text-slate-900 focus:outline-none focus:border-purple-500 transition font-medium"
              />
            </div>

            {/* Anti-Bot Cloudflare Challenge Frame Node */}
            <div className="flex justify-center pt-1">
              <Turnstile
                ref={turnstileRef}
                siteKey={TURNSTILE_SITE_KEY}
                onSuccess={(token) => setTurnstileToken(token)}
                onExpire={() => setTurnstileToken(null)}
                onError={() => setTurnstileToken(null)}
                options={{ theme: 'light', size: 'flexible' }}
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting || !turnstileToken}
                className={`w-full font-bold p-3 text-xs uppercase tracking-wider transition flex items-center justify-center space-x-2 ${
                  isSubmitting || !turnstileToken
                    ? 'bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed'
                    : 'bg-purple-600 hover:bg-purple-500 text-white shadow-md'
                }`}
              >
                {isSubmitting ? 'Updating Vault Hash...' : '🔒 Complete Password Reset'}
              </button>
            </div>
          </form>
        )}

        {/* Navigation Routing Footer Controls Block */}
        <div className="pt-4 border-t border-gray-200 text-center">
          <button
            type="button"
            onClick={() => {
              // Redirect back to main entry with invitation parameters if present
              const routeSuffix = academyIdFromUrl ? `?academyId=${academyIdFromUrl}` : '';
              window.location.href = `/login${routeSuffix}`;
            }}
            className="text-purple-600 hover:text-purple-500 font-black uppercase text-[10px] tracking-widest underline decoration-dotted transition"
          >
            ⬅️ Return to Player Gateway Sign-In Panel
          </button>
        </div>

      </div>
    </div>
  );
}