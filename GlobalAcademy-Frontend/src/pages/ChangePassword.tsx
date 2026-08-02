import React, { useState } from 'react';
import { apiClient } from '../api/apiClient';

export default function ChangePassword() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [uiMessage, setUiMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

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
    <div className="max-w-md mx-auto bg-white border border-slate-300 p-6 shadow-xl space-y-4">
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
          <label className="block font-bold uppercase text-slate-600">Fresh New Password</label>
          <input type="password" required disabled={isSubmitting} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full bg-white border border-slate-300 p-2.5 text-slate-800 focus:outline-none focus:border-purple-500" />
        </div>
        <div className="space-y-1">
          <label className="block font-bold uppercase text-slate-600">Confirm New Password Entry</label>
          <input type="password" required disabled={isSubmitting} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="w-full bg-white border border-slate-300 p-2.5 text-slate-800 focus:outline-none focus:border-purple-500" />
        </div>
        <button type="submit" disabled={isSubmitting} className="w-full bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white font-black p-2.5 transition text-xs">
          {isSubmitting ? 'Saving Changes...' : 'Save New Password'}
        </button>
      </form>
    </div>
  );
}
