import React, { useState, useEffect } from 'react';
import { apiClient } from '../api/apiClient';
import { useAuth } from '../context/AuthContext';
import TwoFactorEnrollment from '../components/TwoFactorEnrollment';
import { useAlert } from '../context/AlertContext';

export default function ChangePassword() {
  const { user: loggedInUser } = useAuth(); 
  const isPrivilegedManager = loggedInUser?.role === 'AcademyDirector' || loggedInUser?.role === 'GlobalAdmin';
  
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState<boolean>(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState<boolean>(false);
  
  const [uiMessage, setUiMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  
  const [is2FaActive, setIs2FaActive] = useState<boolean>(false);
  const [showWizard, setShowWizard] = useState<boolean>(false);
  const [loadingSecurity, setLoadingSecurity] = useState<boolean>(false);
  const { showAlert } = useAlert();

  useEffect(() => {
    if (isPrivilegedManager) {
      fetchSecurityState();
    }
  }, []);

  const fetchSecurityState = async () => {
    try {
      setLoadingSecurity(true);
      const response = await apiClient.get('/Auth/user-security-state');
      setIs2FaActive(response.data.isTwoFactorEnabled);
    } catch (err) {
      console.error("Failed to synchronize account security metadata loops:", err);
    } finally {
      setLoadingSecurity(false);
    }
  };

  const handleToggleChange = async () => {
    setUiMessage(null);

    if (is2FaActive) {
      showAlert({
          title: 'Disable Multi-Factor Authentication?',
            message: `Are you completely sure you want to disable multi-factor protection? Your account tools will revert to single-factor password parameters.`,
            type: 'warning',
            onConfirm: async () => {
              try {
                setLoadingSecurity(true);
                await apiClient.post('/Auth/disable-2fa');
                setIs2FaActive(false);
                setShowWizard(false);
                setIsSuccess(true);

                showAlert({ 
                  title: 'Multi-Factor Authentication Disabled', 
                  message: "🎉 Multi-factor protection disabled and authenticator keys purged cleanly.",
                  type: 'success' 
                });

              } catch (err: any) {
                // 5. Extract specific business rule failures (e.g., your 24-hour player lockout rule text string)
                const serverErrorMessage = err.response?.data 
                  || err.response?.data?.message 
                  || 'Access Denied.';

                showAlert({ 
                  title: 'Error', 
                  message: serverErrorMessage, // ◄--- Renders "Cancellation Locked: Less than 24 hours..." accurately
                  type: 'error' 
                });
                setIsSuccess(false);
              } finally {
                setLoadingSecurity(false);
              }
            }
          });

    } else {
      // 🔓 ACTIVATION LIFECYCLE: REVEAL SLIDEOUT ONBOARDING GRAPHICAL QR WIZARD PANEL NATIVELY
      // The database remains FALSE until they scan, compile hashes, and submit a valid confirmation code.
      setShowWizard(!showWizard);
    }
  };

  const handlePasswordRotation = async (e: React.FormEvent) => {
    e.preventDefault();
    setUiMessage(null);

    if (newPassword !== confirmPassword) {
      setUiMessage("Validation Error: New password entries do not match.");
      setIsSuccess(false);
      return;
    }

    try {
      setIsSubmitting(true);
      // Calls your existing C# backend identity account controller endpoint
      await apiClient.post('/Auth/change-password', { currentPassword, newPassword });
      
      setIsSuccess(true);
      setUiMessage("🎉 Security Credentials updated successfully!");
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setIsSuccess(false);
      setUiMessage(`❌ Update Failed: ${err.response?.data || err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-md mx-auto space-y-4">
      {/* PASSWORD ROTATION COMPONENT BOX PANEL */}
      <div className="bg-white border border-slate-300 p-6 shadow-xl space-y-4">
        <div>
          <h2 className="text-base font-black text-slate-900">Account Security Manager</h2>
          <p className="text-xs text-slate-600">Update your multi-tenant portal login password safely.</p>
        </div>

        {uiMessage && (
          <div className={`p-3 text-xs font-semibold ${
            isSuccess ? 'bg-emerald-100 border border-emerald-300 text-emerald-600' : 'bg-rose-100 border border-rose-300 text-rose-600'
          }`}>
            {uiMessage}
          </div>
        )}

        <form onSubmit={handlePasswordRotation} className="space-y-4 text-xs">
          <div className="space-y-1">
            <label className="block font-bold uppercase text-slate-600">Current Login Password</label>
            <input type="password" required disabled={isSubmitting} value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className="w-full bg-white border border-slate-300 p-2.5 text-slate-800 focus:outline-none focus:border-purple-500" />
          </div>
          <div className="space-y-1">
            <label className="block font-bold uppercase text-slate-600">New Password</label>
            <div className="relative flex items-center w-full">
              <input type={showNewPassword ? "text" : "password"} required disabled={isSubmitting} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full bg-white border border-slate-300 p-2.5 text-slate-800 focus:outline-none focus:border-purple-500" />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-3 text-slate-400 hover:text-purple-600 transition focus:outline-none"
                title={showNewPassword ? "Hide password" : "Show password"}
              >
                {showNewPassword ? (
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
          <div className="space-y-1">
            <label className="block font-bold uppercase text-slate-600">Confirm New Password</label>
            <div className="relative flex items-center w-full">
              <input type={showConfirmPassword ? "text" : "password"} required disabled={isSubmitting} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="w-full bg-white border border-slate-300 p-2.5 text-slate-800 focus:outline-none focus:border-purple-500" />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 text-slate-400 hover:text-purple-600 transition focus:outline-none"
                title={showConfirmPassword ? "Hide password" : "Show password"}
              >
                {showConfirmPassword ? (
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
          <button type="submit" disabled={isSubmitting} className="w-full bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white font-black p-2.5 transition text-xs">
            {isSubmitting ? 'Saving Changes...' : 'Save New Password'}
          </button>
        </form>
      </div>

      {/* =========================================================================
          🚀 TARGETED ADDITION: DYNAMIC INTERACTIVE SLIDER HOOK (DIRECTORS ONLY)
         ========================================================================= */}
      {isPrivilegedManager && (
        <div className="bg-white border border-slate-300 p-6 shadow-xl space-y-4 text-xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="space-y-0.5">
              <h3 className="font-black text-slate-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
                <span>🛡️ Two-Factor Authentication</span>
                {is2FaActive && (
                  <span className="text-[9px] bg-purple-100 text-purple-700 font-bold px-1.5 py-0.5 border border-purple-200">
                    SECURE ACTIVE
                  </span>
                )}
              </h3>
              <p className="text-slate-500 text-[11px] leading-normal">
                Enforce rolling smartphone token passcodes across all dashboard entry loops.
              </p>
            </div>

            {/* HIGH FIDELITY TAILWIND CSS TOGGLE SLIDER WIDGET */}
            <button
              type="button"
              disabled={loadingSecurity}
              onClick={handleToggleChange}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-0 disabled:opacity-50 ${
                is2FaActive || showWizard ? 'bg-purple-600' : 'bg-slate-200'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                  is2FaActive || showWizard ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* RENDERING GATE: ONBOARDING ACCORDION MOUNT DRAWERS */}
          {showWizard && !is2FaActive && (
            <div className="pt-2 animate-fade-in">
              {/* To instantly sync the toggle button state when setup finishes, we inject a quick completion refresher */}
              <TwoFactorEnrollment onSetupComplete={() => {
                setIs2FaActive(true);
                setShowWizard(false);
              }} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

