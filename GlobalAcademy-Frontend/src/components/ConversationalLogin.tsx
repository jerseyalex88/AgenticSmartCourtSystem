import React, { useState, useRef, useEffect } from 'react';
import { useAlert } from '../context/AlertContext';
import { apiClient } from '../api/apiClient';
import { useAuth } from '../context/AuthContext'; // Verify this matches your directory path

interface Message {
  id: string;
  sender: 'user' | 'agent';
  text: string;
  isPassword?: boolean;
}

// Defining the tracking stages for our login conversational state machine
type LoginStage = 'AwaitingIntent' | 'AwaitingEmail' | 'AwaitingPassword' | 'ProcessingHandshake';

export default function ConversationalLogin({ onToggleMode }: { onToggleMode: () => void }) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'init-1',
      sender: 'agent',
      text: '⚡ [AI Onboarding Node Active]: Welcome to the Smart Court Hub gateway. Type "I want to login" or just tell me what you need to begin.'
    }
  ]);
  const [inputVal, setInputVal] = useState('');
  const [stage, setStage] = useState<LoginStage>('AwaitingIntent');
  const [loading, setLoading] = useState(false);
  
  // Internal cache arrays to hold credentials during the multi-turn exchange
  const [emailCache, setEmailCache] = useState('');
  const [passwordCache, setPasswordCache] = useState('');

  const { saveSession } = useAuth(); 
  const { showAlert } = useAlert();
  const terminalEndRef = useRef<HTMLDivElement>(null);

  // Auto-scrolling utility to keep the terminal window focused on the newest turn
  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanInput = inputVal.trim();
    if (!cleanInput) return;

    // 1. Log the real user text input onto the terminal screen view tracker
    const userMessageId = GuidStub();
    const userMsg: Message = {
      id: userMessageId,
      sender: 'user',
      text: stage === 'AwaitingPassword' ? '••••••••••••' : cleanInput,
      isPassword: stage === 'AwaitingPassword'
    };

    setMessages(prev => [...prev, userMsg]);
    setInputVal('');
    setLoading(true);

    try {
      // =========================================================================
      // FIX: ROUTE THE NATURAL LANGUAGE TEXT DYNAMICALLY TO YOUR NEW ENDPOINT
      // =========================================================================
      const response = await apiClient.post('/AiOrchestration/ai/conversational-auth', {
        userInput: cleanInput,
        currentStage: stage,
        cachedEmail: emailCache
      });

      const { nextStage, cachedEmail: returnedEmail, agentResponse, token } = response.data;

      // 2. STATE SYNCHRONIZATION OVERRIDES
      // Cache values returned by the backend data contract safely in local memory
      if (returnedEmail) setEmailCache(returnedEmail);
      
      // Update our frontend stage tracker to keep step with the C# controller state
      setStage(nextStage);

      // Render the AI's intelligent natural language response on screen
      setMessages(prev => [...prev, {
        id: GuidStub(),
        sender: 'agent',
        text: agentResponse
      }]);

      // 3. FINAL SECURITY LOGIN GATEWAY INTERCEPT
      // If the backend hands back an access token token, seal the login immediately!
      if (nextStage === 'Completed' && token) {
        localStorage.setItem('token', token);
        
        // This instantly flips isAuthenticated to true and populates user info.
        if (typeof saveSession === 'function') {
          await saveSession(token); // Invoke your global AuthContext hydration routine
          window.location.href = '/';
        }

        // showAlert({
        //   title: 'Handshake Authenticated',
        //   message: 'Conversational identity provisioning finalized. Launching workspace matrix...',
        //   type: 'success',
        //   onConfirm: () => {
        //     window.location.href = '/'; // Reload to boot up into the core landing layout grid
        //   }
        // });
      }

    } catch (err: any) {
      const serverErrorMessage = err.response?.data?.message || err.response?.data || err.message;
      
      setMessages(prev => [...prev, {
        id: GuidStub(),
        sender: 'agent',
        text: `🚨 [GATEWAY EXCEPTION INTERCEPT]: ${serverErrorMessage}\n\nResetting tracking parameters. Please enter your email address to re-verify:`
      }]);
      setStage('AwaitingEmail');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 font-mono text-xs text-slate-300">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl max-w-md w-full flex flex-col h-[500px]">
        
        {/* COMPONENT BANNER CONTROL HEADER */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/60 rounded-t-2xl">
          <div>
            <h2 className="text-sm font-black text-slate-100 uppercase tracking-wider">🤖 Agentic Terminal Gate</h2>
            <p className="text-slate-500 mt-0.5 text-[10px]">Natural language access engine node</p>
          </div>
          
          <button
            type="button"
            onClick={onToggleMode}
            className="bg-slate-950 hover:bg-slate-800 text-emerald-400 hover:text-emerald-300 font-bold border border-slate-800 px-2.5 py-1.5 rounded-xl uppercase text-[10px] tracking-wider transition"
          >
            📋 Traditional GUI Form
          </button>
        </div>

        {/* TERMINAL MESSAGES MONITOR CONTAINER VIEW */}
        <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-slate-950/40">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-xl p-3 leading-relaxed whitespace-pre-wrap ${
                msg.sender === 'user'
                  ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-900/60 font-bold'
                  : 'bg-slate-900 border border-slate-800 text-slate-300'
              }`}>
                <span className="font-black block uppercase text-[9px] mb-1 tracking-widest text-slate-500">
                  {msg.sender === 'user' ? '👤 Input Stream' : '🤖 Subagent Response'}
                </span>
                {msg.text}
              </div>
            </div>
          ))}
          {loading && (
            <div className="text-slate-600 animate-pulse italic text-[10px] pl-2">
              Agent analyzing stream input vectors...
            </div>
          )}
          <div ref={terminalEndRef} />
        </div>

        {/* INPUT INTERACTIVE TERMINAL TEXTBOX CONTROLS DECK */}
        <form onSubmit={handleSendMessage} className="p-3 border-t border-slate-800 bg-slate-900/40 rounded-b-2xl flex gap-2">
          <input
            // DYNAMIC INPUT MASK FIELD CHANGE: Automatically switch type to 'password' during pass step!
            type={stage === 'AwaitingPassword' ? 'password' : 'text'}
            required
            disabled={loading || stage === 'ProcessingHandshake'}
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            className="flex-1 bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-200 focus:outline-none focus:border-slate-700 transition"
            placeholder={
              stage === 'AwaitingIntent' ? 'Type "I want to log in"...' :
              stage === 'AwaitingEmail' ? 'Enter email address account...' :
              stage === 'AwaitingPassword' ? 'Type account password...' :
              'Processing secure protocol...'
            }
          />
          <button
            type="submit"
            disabled={loading || !inputVal.trim() || stage === 'ProcessingHandshake'}
            className={`px-4 rounded-xl font-bold uppercase tracking-wider text-[10px] transition ${
              loading || !inputVal.trim()
                ? 'bg-slate-800 text-slate-600 cursor-not-allowed'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white'
            }`}
          >
            Send ⚡
          </button>
        </form>

      </div>
    </div>
  );
}

// Quick unique ID factory helper to satisfy React list keys
function GuidStub() {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}
