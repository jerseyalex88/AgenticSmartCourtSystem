import React, { useState } from 'react';
import { useAlert } from '../context/AlertContext';
import { apiClient } from '../api/apiClient';
import SemanticRegister from '../components/SemanticRegister';

export default function PlayerRegister() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const { showAlert } = useAlert();

  // Extract the multi-tenant Academy partition key straight out of the active URL string parameters
  const queryParams = new URLSearchParams(window.location.search);
  const academyIdFromUrl = queryParams.get('academyId') || '';

  const handlePlayerRegistrationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!academyIdFromUrl) {
      showAlert({
        title: 'Missing Academy Link ID',
        message: 'You cannot register without an explicit invitation link key. Please request a valid signup link from your club administration office.',
        type: 'error'
      });
      return;
    }

    setLoading(true);
    try {
      // Direct post request payload utilizing your public identity initialization routing rules
      const response = await fetch('/api/auth/register-player-public', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          phoneNumber,
          academyId: academyIdFromUrl
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Registration transaction rejected.');
      }

      showAlert({
        title: 'Account Provisioned Cleanly!',
        message: 'Your player profile passport has been securely stamped into this academy partition database. You can now return to the login panel and sign in!',
        type: 'success',
        onConfirm: () => {
          window.location.href = '/login'; // Reroute to default login portal canvas
        }
      });
    } catch (err: any) {
      showAlert({
        title: 'Identity Exception Block',
        message: err.message || 'Failed to communicate with identity tables.',
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 font-mono text-xs text-slate-300">
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-2xl max-w-sm w-full">
        
        {/* VIEW TITLE METADATA CARD */}
        <div className="border-b border-slate-800 pb-3 mb-6">
          <h2 className="text-sm font-black text-slate-100 uppercase tracking-wider">🎾 Player Network Registration</h2>
          <p className="text-slate-400 mt-1">Initialize your security passport profile credentials within this club tier system.</p>
        </div>

        <form onSubmit={handlePlayerRegistrationSubmit} className="space-y-4">
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
            <label className="block text-slate-400 font-bold uppercase tracking-wider text-[10px] mb-1">Secure Password Row</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200 focus:outline-none focus:border-slate-700 transition"
              placeholder="••••••••••••"
            />
          </div>

          <div>
            <label className="block text-slate-400 font-bold uppercase tracking-wider text-[10px] mb-1">Phone Number Digits (For SMS Alerts)</label>
            <input
              type="tel"
              required
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200 focus:outline-none focus:border-slate-700 transition"
              placeholder="+15550123456"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`w-full mt-2 font-bold py-2 px-4 rounded-lg uppercase tracking-wider transition ${
              loading ? 'bg-slate-800 text-slate-600 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-500 text-white'
            }`}
          >
            {loading ? 'Committing Identity...' : '🔐 Initialize My Profile'}
          </button>
        </form>
      </div>
    </div>
  );
}
