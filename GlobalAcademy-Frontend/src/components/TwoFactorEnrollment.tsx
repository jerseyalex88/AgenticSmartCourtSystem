import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react'; // 🚀 INJECTED FROM PACKAGE
import { apiClient } from '../api/apiClient';
import { useAlert } from '../context/AlertContext';

interface TwoFactorSetupResponse {
  sharedKey: string;
  authenticatorUri: string;
}

interface TwoFactorEnrollmentProps {
  onSetupComplete?: () => void;
}

export default function TwoFactorEnrollment({ onSetupComplete }: TwoFactorEnrollmentProps) {
  const [setupData, setSetupData] = useState<TwoFactorSetupResponse | null>(null);
  const [confirmCode, setConfirmCode] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isCompleted, setIsCompleted] = useState<boolean>(false);
  const { showAlert } = useAlert();

  // STEP 1: INITIALIZE HANDSHAKE ENGINE OVER AUTHCANCELLATION PROTECTED ROUTE
  const handleInitiateSetup = async () => {
    setIsLoading(true);
    try {
      const response = await apiClient.post<TwoFactorSetupResponse>('/Auth/setup-2fa');
      setSetupData(response.data);
    } catch (err: any) {
      showAlert({
        title: 'Vault Setup Failure',
        message: err.response?.data?.message || 'Could not communicate with security initialization channels.',
        type: 'error'
      });
    } finally {
      setIsLoading(false);
    }
  };

  // STEP 2: SUBMIT ROLLING CODE PASSCODE FOR BACKEND FINAL LOCKDOWN APPROVAL
  const handleVerifyAndLock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (confirmCode.length !== 6) return;
    setIsLoading(true);

    try {
      await apiClient.post('/Auth/confirm-2fa-setup', { code: confirmCode });
      
      // 🚀 INJECT THIS DYNAMIC CALLBACK INVOKE DETECTOR:
      if (typeof onSetupComplete === 'function') {
        onSetupComplete();
      }
      
      setIsCompleted(true);
    } catch (err: any) {
      showAlert({
        title: 'Verification Token Fault',
        message: err.response?.data?.message || 'Invalid passcode string. Check your smartphone application sync and try again.',
        type: 'error'
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isCompleted) {
    return (
      <div className="bg-white border-2 border-emerald-500 p-6 max-w-md w-full shadow-md text-slate-900 font-sans text-xs">
        <div className="flex items-center space-x-2 text-emerald-600 font-black uppercase tracking-wider mb-2">
          <span>🛡️ VAULT ARMED</span>
        </div>
        <p className="text-slate-600 leading-normal">
          Multi-factor verification parameters are locked onto this user profile passport. Standard authorization handshakes are fully enforced natively.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 p-6 max-w-md w-full shadow-lg text-slate-900 font-sans text-xs space-y-6">
      <div className="border-b border-gray-200 pb-3">
        <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider">🔒 Director Account Security</h2>
        <p className="text-slate-500 mt-1">Configure App-Based Multi-Factor Authenticator Vaults</p>
      </div>

      {!setupData ? (
        /* STAGE A: PROMPT WIZARD STATE INITIALIZATION CAPTURE BUTTON */
        <div className="space-y-4">
          <p className="text-slate-600 leading-normal">
            Protect your sports academy branch's financial ledgers, database configurations, and refund controllers by requiring a dynamic rolling 6-digit verification code string whenever you log in.
          </p>
          <button
            type="button"
            onClick={handleInitiateSetup}
            disabled={isLoading}
            className="w-full bg-purple-600 hover:bg-purple-500 disabled:bg-gray-100 disabled:text-gray-400 font-bold py-2.5 px-4 text-white uppercase tracking-wider transition text-center"
          >
            {isLoading ? 'Generating Keys...' : '⚡ Configure Multi-Factor Protection'}
          </button>
        </div>
      ) : (
        /* STAGE B: GRAPHICAL QR LAYOUT BLOCK MATRIX & CONFIRMATION BOX PANEL */
        <div className="space-y-4 animate-fade-in">
          <p className="text-slate-600 leading-normal">
            1. Open your physical smartphone mobile device and launch your preferred authenticator app (Google Authenticator, Microsoft Authenticator, or Bitwarden).
          </p>
          <p className="text-slate-600 leading-normal">
            2. Scan the generated QR matrix graphical layout square container asset below, or manually type in your secure alphanumeric seed parameter string.
          </p>

          {/* DYNAMIC QR ENVELOPE CANVAS MOUNT CONTAINER */}
          <div className="bg-gray-50 border border-gray-200 p-4 flex flex-col items-center justify-center space-y-3">
            <div className="p-3 bg-white border border-gray-300 shadow-sm">
              <QRCodeSVG 
                value={setupData.authenticatorUri}
                size={160}
                bgColor="#ffffff"
                fgColor="#000000"
                level="M"
                includeMargin={false}
              />
            </div>
            <div className="w-full text-center">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Manual Account Setup Seed String Key:</span>
              <code className="bg-white px-2 py-1 border border-gray-300 font-mono font-bold text-purple-700 block select-all break-all tracking-wider text-[11px]">
                {setupData.sharedKey}
              </code>
            </div>
          </div>

          <div className="space-y-2 pt-2 border-t border-gray-100">
            <p className="text-slate-600 leading-normal">
              3. Enter the rolling 6-digit verification passcode active on your app screen below to permanently lock down pairing configurations:
            </p>
            <input
              type="text"
              required
              maxLength={6}
              disabled={isLoading}
              value={confirmCode}
              onChange={(e) => setConfirmCode(e.target.value.replace(/\D/g, ''))}
              placeholder="000000"
              className="w-full bg-gray-50 border border-gray-300 tracking-widest text-center text-lg p-2.5 text-slate-900 font-black focus:outline-none focus:border-purple-500 transition"
            />
          </div>

          <button
            type="button" // 🚀 FIXED: Standard static button
            onClick={handleVerifyAndLock} // 🚀 FIXED: Explicit independent click listener
            disabled={isLoading || confirmCode.length !== 6}
            className="w-full bg-purple-600 hover:bg-purple-500 disabled:bg-gray-100 disabled:text-gray-400 font-bold py-2.5 px-4 text-white uppercase tracking-wider transition text-center text-xs"
          >
            {isLoading ? 'Verifying Tokens...' : '🔒 Confirm & Activate Protection'}
          </button>
        </div>
      )}
    </div>
  );
}
