import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext'; 
import { apiClient } from '../api/apiClient';

interface LayoutProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  children: React.ReactNode;
}

interface ChatBubbleLog {
  id: string;
  sender: 'player' | 'agent';
  text: string;
}

export default function Layout({ activeTab, setActiveTab, children }: LayoutProps) {
  const { user, clearSession } = useAuth();
  const { theme, toggleTheme } = useTheme(); 
  
  // =========================================================================
  // UNIVERSAL CONTEXT SIDEBAR STATE CONTROLS
  // =========================================================================
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [chatHistory, setChatHistory] = useState<ChatBubbleLog[]>([
    {
      id: 'univ-init',
      sender: 'agent',
      text: '🤖 [Universal Copilot Node Synchronized]: Hello! I am your ambient workspace subagent. I can book courts, clear schedules, or fetch operations metrics. State your intent below:'
    }
  ]);

  const terminalEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isAssistantOpen) {
      terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatHistory, isAssistantOpen]);

    const handleSendUniversalQuery = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanText = chatInput.trim();
    if (!cleanText) return;

    // 1. Commit player text string to your chat terminal scripter canvas view
    setChatHistory(prev => [...prev, { id: Math.random().toString(), sender: 'player', text: cleanText }]);
    setChatInput('');
    setLoading(true);

    try {
      // 2. DISPATCH TRANS-ORCHESTRATION PAYLOAD VIA API CLIENT HANDSHAKE
      const response = await apiClient.post('/AiOrchestration/universal-chat', {
        userInput: cleanText
      });

      // Extract the synchronized lower camelCase property parameter key
      const { agentResponse } = response.data;

      // =========================================================================
      // DYNAMIC APP-STATE DATA RE-SYNCHRONIZATION INJECTOR HOOK (NO REFRESH)
      // =========================================================================
      if (agentResponse.includes('[FRONTEND_ACTION:SET_DATE:')) {
        // Strip out the timestamp date string token using matching splits
        const extractedDate = agentResponse.split('[FRONTEND_ACTION:SET_DATE:')[1].replace(']', '').trim();
        
        // INTERCEPT TRIGGER: Call your existing main page calendar date setter hook!
        // If your active dashboard page passes its date setter up to layout props, 
        // triggering it here updates the horizontal tabs instantly with no reload!
        if (typeof (window as any).setDashboardGlobalDate === 'function') {
           (window as any).setDashboardGlobalDate(extractedDate);
        }
      }

      // Clean out the hidden command bracket block text parameters before displaying chat bubble to player
      const cleanDisplayMsg = agentResponse.split('\n[FRONTEND_ACTION')[0];

      setChatHistory(prev => [...prev, {
        id: Math.random().toString(),
        sender: 'agent',
        text: cleanDisplayMsg
      }]);

    } catch (err: any) {
      const serverErr = err.response?.data?.message || 'Universal Copilot connection timed out.';
      setChatHistory(prev => [...prev, {
        id: Math.random().toString(),
        sender: 'agent',
        text: `🚨 [COPILOT BLOCK]: ${serverErr}`
      }]);
    } finally {
      setLoading(false);
    }
  };

  const navItems = [
    { id: 'dashboard', label: '🏟️ Core Asset Matrix', roles: ['AcademyDirector', 'Groundskeeper'] },
    { id: 'bookings', label: '⏱️ Bookings & Intervals', roles: ['AcademyDirector', 'Groundskeeper', 'Player'] },
    { id: 'shadow-queue', label: '🔄 Displaced Player Queue', roles: ['AcademyDirector', 'Groundskeeper'] },
    { id: 'agent-dispatch', label: '⚡ AI Dispatch Center', roles: ['AcademyDirector', 'GlobalAdmin'] },
    { id: 'maintenance', label: '🔧 Work Order Tickets', roles: ['AcademyDirector', 'Groundskeeper'] },
    { id: 'roster', label: '👥 Staff Roster Manager', roles: ['AcademyDirector', 'GlobalAdmin'] },
    { id: 'admin', label: '⚙️ Role Administrator', roles: ['AcademyDirector', 'GlobalAdmin'] },
    { id: 'password', label: '🔐 Security Passwords', roles: ['AcademyDirector', 'Groundskeeper', 'Player'] },
  ];

  const filteredNavItems = navItems.filter(item => item.roles.includes(user?.role || ''));
  return (
    <div className="min-h-screen flex bg-transparent antialiased font-sans overflow-hidden">
      
      {/* SIDEBAR WRAPPER CONSTRAINTS */}
      <aside className="w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col justify-between shrink-0 h-screen">
        <div className="p-5 space-y-6 overflow-y-auto">
          <div className="flex items-center space-x-3 px-1">
            <span className="text-xl bg-emerald-500/10 p-2 rounded-lg border border-emerald-500/20 text-emerald-400">🎾</span>
            <div>
              <h2 className="text-sm font-black tracking-wide text-slate-800 dark:text-slate-200 uppercase">Smart Court OS</h2>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">v4.0.0 // Connected</p>
            </div>
          </div>

          <nav className="space-y-1">
            <span className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest px-2 mb-2">Database Tables Lifecycle</span>
            {filteredNavItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center px-3 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition ${
                  activeTab === item.id
                    ? 'bg-emerald-600 text-white dark:text-slate-950 shadow-lg shadow-emerald-600/10 font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-850 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>
        </div>

        {/* LOWER PROFILE AND DYNAMIC THEME SWITCH PANEL TOGGLE */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800/60 bg-slate-50 dark:bg-slate-950/40 space-y-3 shrink-0">
          <div className="flex items-center justify-between px-2">
            <div className="space-y-0.5 max-w-[140px]">
              <p className="text-xs font-bold text-slate-700 dark:text-slate-300 truncate">{user?.email}</p>
              <span className="inline-block bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900 px-1.5 py-0.5 rounded font-bold text-[9px] uppercase tracking-wider">{user?.role}</span>
            </div>
            
            <button 
              onClick={toggleTheme} 
              className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-emerald-500 dark:hover:text-emerald-400 text-xs transition-all shadow-sm"
              title="Toggle Workspace Visual Mode"
            >
              {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
            </button>
          </div>
          
          <button onClick={clearSession} className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/20 text-slate-600 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 px-3 py-2 rounded-xl text-xs transition font-medium flex items-center justify-center space-x-2">
            <span>Exit Active Session Workspace</span>
          </button>
        </div>
      </aside>
      {/* HORIZONTAL WRAPPER CHASSIS (Compresses content to the left when assistant opens) */}
      <div className="flex-1 flex flex-row min-w-0 transition-all duration-300 ease-in-out h-screen overflow-hidden">
        
        {/* RIGHT DISPLAY VIEWPORT CANVAS PANEL */}
        <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
          <header className="h-16 bg-white/60 dark:bg-slate-900/50 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-8 z-10 shrink-0">
            <div className="flex items-center space-x-2">
              <span className="text-[10px] font-mono bg-slate-100 dark:bg-slate-950 px-2 py-1 rounded text-slate-500 uppercase">Tenant Sandbox Key</span>
              <span className="text-xs font-mono text-blue-600 dark:text-blue-400 font-bold max-w-xs truncate">{user?.academyId}</span>
            </div>
            <div className="flex items-center space-x-1.5 bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 px-3 py-1.5 rounded-xl">
              <span className="h-2 w-2 bg-emerald-500 dark:bg-emerald-400 rounded-full animate-pulse" />
              <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">Multi-Tenant Firewall Active</span>
            </div>
            {user && (
              <div className="flex items-center gap-4 bg-slate-950/60 border border-slate-800/80 pl-3 pr-2 py-1.5 rounded-xl transition hover:border-slate-700">
                <div className="text-right hidden sm:block">
                  <div className="font-black text-slate-300 tracking-wide max-w-[275px] truncate">
                    {user.email || user.userName}
                  </div>
                  <div className="text-[9px] font-bold text-emerald-400 uppercase tracking-widest mt-0.5 flex items-center justify-end gap-1">
                    <span className="w-1 h-1 bg-emerald-500 rounded-full animate-pulse"></span>
                    {user.role || 'Player'}
                  </div>
                </div>
                <div className="w-px h-6 bg-slate-800 hidden sm:block"></div>
                <button
                  onClick={clearSession}
                  className="bg-slate-900 hover:bg-rose-950/40 border border-slate-800 hover:border-rose-900 text-slate-400 hover:text-rose-400 font-bold px-2.5 py-1 rounded-lg uppercase tracking-wider text-[9px] transition-all duration-200 flex items-center gap-1"
                  title="Terminate Session"
                >
                  <span>🔒</span>
                  <span className="hidden xs:inline">Sign Out</span>
                </button>
              </div>
            )}
          </header>

          <main className="flex-1 p-8 overflow-y-auto bg-slate-50 dark:bg-slate-950">
            <div className="max-w-6xl mx-auto">
              {children}
            </div>
          </main>
        </div>

        {/* UNIVERSAL CONTEXT ASSISTANT SIDEBAR CHASSIS */}
        <div 
          className={`bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 h-full flex flex-col shrink-0 transition-all duration-300 ease-in-out ${
            isAssistantOpen ? 'w-80 opacity-100' : 'w-0 opacity-0 pointer-events-none border-transparent'
          }`}
        >
          {isAssistantOpen && (
            <div className="flex flex-col h-full w-80 font-mono text-xs">
              <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-indigo-950/10 flex items-center justify-between shrink-0">
                <div>
                  <h3 className="text-xs font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">🧠 Context Assistant</h3>
                  <p className="text-[9px] text-slate-400 dark:text-slate-500 mt-0.5">Global Semantic Kernel Node</p>
                </div>
                <button onClick={() => setIsAssistantOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-bold text-xs p-1">✕</button>
              </div>

              <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-slate-50/50 dark:bg-slate-950/40">
                {chatHistory.map((bubble) => (
                  <div key={bubble.id} className={`flex ${bubble.sender === 'player' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[90%] rounded-xl p-2.5 leading-relaxed border ${
                      bubble.sender === 'player'
                        ? 'bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-900/40 font-bold'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-300'
                    }`}>
                      {bubble.text}
                    </div>
                  </div>
                ))}
                {loading && (
                  <div className="text-[10px] text-indigo-500/70 animate-pulse italic pl-1">🔮 Parsing workspace vectors...</div>
                )}
                <div ref={terminalEndRef} />
              </div>

              <form onSubmit={handleSendUniversalQuery} className="p-3 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/40 flex gap-2 shrink-0">
                <textarea
                  rows={2}
                  required
                  disabled={loading}
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => {
                    // Allows pressing Enter to submit, and Shift+Enter to drop a new line
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendUniversalQuery(e as any);
                    }
                  }}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-indigo-500 dark:focus:border-indigo-900 text-slate-800 dark:text-slate-200 rounded-lg p-2 text-[11px] focus:outline-none resize-none font-sans"
                  placeholder="Ask copilot..."
                />
                <button type="submit" disabled={loading || !chatInput.trim()} className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-1 px-3 rounded-lg text-[10px]">⚡</button>
              </form>
            </div>
          )}
        </div>

      </div>

      {/* PERSISTENT FLOATING ORB BUTTON (Toggles dynamically between top and bottom coordinates) */}
      <button
        type="button"
        onClick={() => setIsAssistantOpen(!isAssistantOpen)}
        className={`fixed right-6 w-12 h-12 rounded-full shadow-2xl flex items-center justify-center text-lg z-50 transition-all duration-300 hover:scale-110 active:scale-95 ${
          isAssistantOpen 
            ? 'top-6 bg-indigo-600 text-white border border-indigo-500 rotate-180' 
            : 'bottom-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-indigo-600 dark:text-indigo-400'
        }`}
        title={isAssistantOpen ? "Close Assistant Space" : "Summon Universal Assistant"}
      >
        {isAssistantOpen ? '✕' : '🧠'}
      </button>

    </div>
  );
}
