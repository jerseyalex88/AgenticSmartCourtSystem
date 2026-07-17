import React, { useState, useRef, useEffect } from 'react';
import { useAlert } from '../context/AlertContext';
import { apiClient } from '../api/apiClient';

interface LogBubble {
  id: string;
  sender: 'player' | 'kernel';
  text: string;
}

export default function SemanticRegister({ onSwitchBack }: { onSwitchBack: () => void }) {
  const queryParams = new URLSearchParams(window.location.search);
  const academyIdFromUrl = queryParams.get('academyId') || '';

    const [chatLog, setChatLog] = useState<LogBubble[]>([
    {
      id: 'reg-init',
      sender: 'kernel',
      text: academyIdFromUrl 
        ? `🧬 [Semantic Onboarding Active]: Academy isolation perimeter [${academyIdFromUrl.substring(0,8)}...] locked down via URL context.\n\nPlease state your account email address and contact phone number to begin profile compilation:`
        : '🧬 [Semantic Onboarding Active]: Please state your account email address, contact phone number, and unique Academy Link GUID to begin profile compilation:'
    }
  ]);

  const [inputValue, setInputValue] = useState('');
  const [stage, setStage] = useState('ExtractingDetails');
  const [emailCache, setEmailCache] = useState('');
  const [phoneCache, setPhoneCache] = useState('');

  const [academyCache, setAcademyCache] = useState(academyIdFromUrl);
  // Synchronize state immediately if the user shifts between URL links dynamically
  useEffect(() => {
    if (academyIdFromUrl) {
      setAcademyCache(academyIdFromUrl);
    }
  }, [academyIdFromUrl]);

  const [loading, setLoading] = useState(false);
  const { showAlert } = useAlert();
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollerRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatLog]);

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanText = inputValue.trim();
    if (!cleanText) return;

    setChatLog(prev => [...prev, {
      id: Math.random().toString(),
      sender: 'player',
      text: stage === 'AwaitingPassword' ? '••••••••••••' : cleanText
    }]);
    setInputValue('');
    setLoading(true);

    try {
      // FIXED: Directing network requests straight into the shared SemanticAuth routing channel
        const response = await apiClient.post('/SemanticAuth/ai/conversational-register', {
        userInput: cleanText,
        currentStage: stage,
        cachedEmail: emailCache,
        cachedPhone: phoneCache,
        cachedAcademyId: academyCache
        });

      // Standard camelCase payload structure matching backend output models
      const { nextStage, cachedEmail, cachedPhone, cachedAcademyId, agentResponse } = response.data;

      setStage(nextStage);
      setEmailCache(cachedEmail);
      setPhoneCache(cachedPhone);
      setAcademyCache(cachedAcademyId);

      setChatLog(prev => [...prev, {
        id: Math.random().toString(),
        sender: 'kernel',
        text: agentResponse
      }]);

      if (nextStage === 'Completed') {
        showAlert({
          title: 'Account Compiled Cleanly!',
          message: 'Your player identity passport was successfully committed. You can now toggle back to the login screen and authenticate.',
          type: 'success',
          onConfirm: () => {
            onSwitchBack(); // Route them straight back onto the login portal
          }
        });
      }

    } catch (err: any) {
      const serverErr = err.response?.data?.message || 'Failed to parse registration sequence.';
      setChatLog(prev => [...prev, {
        id: Math.random().toString(),
        sender: 'kernel',
        text: `🚨 [ONBOARDING EXCEPTION]: ${serverErr}\n\nResetting pipeline attributes. Please re-state your email address:`
      }]);
      setStage('ExtractingDetails');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 font-mono text-xs text-slate-300">
      <div className="bg-slate-900 border-2 border-emerald-900/60 rounded-3xl shadow-2xl max-w-md w-full flex flex-col h-[520px]">
        
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-emerald-950/20 rounded-t-3xl">
          <div>
            <h2 className="text-sm font-black text-emerald-400 uppercase tracking-widest animate-pulse">🧬 AI Registration Gate</h2>
            <p className="text-slate-500 mt-0.5 text-[10px]">Slot-Filling Identity Engine</p>
          </div>
          <button
            type="button"
            onClick={onSwitchBack}
            className="bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 px-3 py-1.5 rounded-xl uppercase text-[10px] transition"
          >
            ↩️ switch back
          </button>
        </div>

        <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-slate-950/20">
          {chatLog.map((bubble) => (
            <div key={bubble.id} className={`flex ${bubble.sender === 'player' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-2xl p-3 leading-relaxed ${
                bubble.sender === 'player'
                  ? 'bg-emerald-950/30 text-emerald-400 border border-emerald-900/50 font-bold'
                  : 'bg-slate-900 border border-slate-800 text-slate-300'
              }`}>
                <span className="font-black block uppercase text-[8px] mb-1 tracking-widest text-slate-500">
                  {bubble.sender === 'player' ? '👤 Profile Data Input' : '🧠 Registration Kernel'}
                </span>
                {bubble.text}
              </div>
            </div>
          ))}
          {loading && (
            <div className="text-emerald-500/70 animate-pulse italic text-[10px] pl-2">
              🧬 Compiling identity structures...
            </div>
          )}
          <div ref={scrollerRef} />
        </div>

        <form onSubmit={handleRegisterSubmit} className="p-3 border-t border-slate-800 bg-slate-900/60 rounded-b-3xl flex gap-2">
          <input
            type={stage === 'AwaitingPassword' ? 'password' : 'text'}
            required
            disabled={loading}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            className="flex-1 bg-slate-950 border border-slate-800 focus:border-emerald-800 rounded-xl p-2.5 text-slate-200 focus:outline-none transition text-xs"
            placeholder={
              stage === 'AwaitingPassword' 
                ? 'Type separate secure account password...' 
                : 'Provide credentials or chat to sign up...'
            }
          />
          <button
            type="submit"
            disabled={loading || !inputValue.trim()}
            className={`px-4 rounded-xl font-bold uppercase tracking-wider text-[10px] transition ${
              loading || !inputValue.trim()
                ? 'bg-slate-800 text-slate-600'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20'
            }`}
          >
            Submit ⚡
          </button>
        </form>

      </div>
    </div>
  );
}
