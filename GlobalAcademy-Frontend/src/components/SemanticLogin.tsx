import React, { useState, useRef, useEffect } from 'react';
import { useAlert } from '../context/AlertContext';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../api/apiClient';

interface ChatBubble {
  id: string;
  role: 'player' | 'kernel';
  messageText: string;
}

export default function SemanticLogin({ onSwitchBack }: { onSwitchBack: () => void }) {
  const [chatLog, setChatLog] = useState<ChatBubble[]>([
    {
      id: 'sem-init',
      role: 'kernel',
      messageText: '🧠 [Semantic Kernel Engine Online]: Open-ended text mapping active. Try typing "I want to log in as chiki@wimbledon.com" or just say hello!'
    }
  ]);
  const [textInput, setTextInput] = useState('');
  const [engineStage, setEngineStage] = useState('AwaitingEmail');
  const [emailStore, setEmailStore] = useState('');
  const [processing, setProcessing] = useState(false);

  const { saveSession } = useAuth();
  const { showAlert } = useAlert();
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollerRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatLog]);

  const dispatchSemanticQuery = async (e: React.FormEvent) => {
    e.preventDefault();
    const rawText = textInput.trim();
    if (!rawText) return;

    const userBubble: ChatBubble = {
      id: Math.random().toString(),
      role: 'player',
      messageText: engineStage === 'AwaitingPassword' ? '••••••••••••' : rawText
    };

    setChatLog(prev => [...prev, userBubble]);
    setTextInput('');
    setProcessing(true);

    try {
      // Connects directly to our new dedicated Semantic Kernel orchestrator endpoint
      const response = await apiClient.post('/SemanticAuth/ai/conversational-auth', {
        userInput: rawText,
        currentStage: engineStage,
        cachedEmail: emailStore
      });

      //console.log("Semantic Kernel response payload:", response.data);

      // FIX: Extract the true network keys utilizing standard lower camelCase properties!
        const { nextStage, cachedEmail, agentResponse, token } = response.data;

        // Update your state handlers to map to the new lowercase variables cleanly
        if (cachedEmail) setEmailStore(cachedEmail);
        setEngineStage(nextStage);

        setChatLog(prev => [...prev, {
        id: Math.random().toString(),
        role: 'kernel',
        messageText: agentResponse // Maps to lowercase
        }]);

        // Update your completion security check block
        if (nextStage === 'Completed' && token) {
            localStorage.setItem('token', token);
            if (typeof saveSession === 'function') {
                saveSession(token);
                window.location.href = '/';
            }

            // showAlert({
            //     title: 'Semantic Agent Verified',
            //     message: 'Identity tokens parsed and verified. Booting main app framework...',
            //     type: 'success',
            //     onConfirm: () => {
            //     window.location.href = '/';
            //     }
            // });
        }
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || 'Kernel translation pipeline connection lost.';
      setChatLog(prev => [...prev, {
        id: Math.random().toString(),
        role: 'kernel',
        messageText: `🚨 [KERNEL ERROR]: ${errorMsg}\n\nResetting tracking perimeter. Please re-state your account email address:`
      }]);
      setEngineStage('AwaitingEmail');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 font-mono text-xs text-slate-300">
      <div className="bg-slate-900 border-2 border-indigo-900/60 rounded-3xl shadow-2xl max-w-md w-full flex flex-col h-[520px]">
        
        {/* HEADER BRAND DECK */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-indigo-950/20 rounded-t-3xl">
          <div>
            <h2 className="text-sm font-black text-indigo-400 uppercase tracking-widest animate-pulse">🌌 Semantic Kernel Gate</h2>
            <p className="text-slate-500 mt-0.5 text-[10px]">LLM Powered Access Framework</p>
          </div>
          <button
            type="button"
            onClick={onSwitchBack}
            className="bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 px-3 py-1.5 rounded-xl uppercase text-[10px] transition"
          >
            ↩️ standard gateway
          </button>
        </div>

        {/* LOG SCROLLER STREAM */}
        <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-slate-950/20">
          {chatLog.map((bubble) => (
            <div key={bubble.id} className={`flex ${bubble.role === 'player' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-2xl p-3 leading-relaxed ${
                bubble.role === 'player'
                  ? 'bg-indigo-950/30 text-indigo-400 border border-indigo-900/50 font-bold'
                  : 'bg-slate-900 border border-slate-800 text-slate-300'
              }`}>
                <span className="font-black block uppercase text-[8px] mb-1 tracking-widest text-slate-500">
                  {bubble.role === 'player' ? '👤 Player Intent Stream' : '🧠 Semantic Engine Node'}
                </span>
                {bubble.messageText}
              </div>
            </div>
          ))}
          {processing && (
            <div className="text-indigo-500/70 animate-pulse italic text-[10px] pl-2 flex items-center gap-1">
              <span>🧬</span> Kernel parsing entity embeddings...
            </div>
          )}
          <div ref={scrollerRef} />
        </div>

        {/* CONTROLS TEXTBOX SUBMISSION ELEMENT */}
        <form onSubmit={dispatchSemanticQuery} className="p-3 border-t border-slate-800 bg-slate-900/60 rounded-b-3xl flex gap-2">
          <input
            type={engineStage === 'AwaitingPassword' ? 'password' : 'text'}
            required
            disabled={processing}
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            className="flex-1 bg-slate-950 border border-slate-800 focus:border-indigo-800 rounded-xl p-2.5 text-slate-200 focus:outline-none transition text-xs"
            placeholder={
              engineStage === 'AwaitingPassword' 
                ? 'Provide masked account password...' 
                : 'Type query (e.g., "Sign me in as chiki@wimbledon.com")...'
            }
          />
          <button
            type="submit"
            disabled={processing || !textInput.trim()}
            className={`px-4 rounded-xl font-bold uppercase tracking-wider text-[10px] transition ${
              processing || !textInput.trim()
                ? 'bg-slate-800 text-slate-600'
                : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20'
            }`}
          >
            SEND 🧬
          </button>
        </form>

      </div>
    </div>
  );
}
