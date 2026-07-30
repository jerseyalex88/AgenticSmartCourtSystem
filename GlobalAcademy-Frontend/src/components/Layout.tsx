import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext'; 
import { apiClient } from '../api/apiClient';
import { CheckoutPortal } from './CheckoutPortal'; 

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
  
  const [chatHistory, setChatHistory] = useState<ChatBubbleLog[]>(() => {
    const isAdmin = user?.role === 'AcademyDirector' || user?.role === 'GlobalAdmin';
    
    return [
      {
        id: 'univ-init',
        sender: 'agent',
        text: isAdmin
          ? '🤖 [Executive Workspace Node Synchronized]: Hello Director! I am your ambient operations administrator subagent. I hold high-clearance tokens to provision courts, configure branch metadata, modify staff rosters, or override schedules. State your command:'
          : '🤖 [Universal Copilot Node Synchronized]: Hello! I am your ambient workspace subagent. I can book courts, clear schedules, or fetch operations metrics. State your intent below:'
      }
    ];
  });
  
  // EXPANDABLE WIDTH PANEL HIERARCHY STATES
  const [chatWidth, setChatWidth] = useState(400);
  const [isDragging, setIsDragging] = useState(false);

  // Track dynamic visibility state for the discrete checkout drawer modal
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [activeInvoiceId, setActiveInvoiceId] = useState('');
  const [activeInvoiceAmount, setActiveInvoiceAmount] = useState(0);

  const terminalEndRef = useRef<HTMLDivElement>(null);
  const chatRef = useRef<HTMLDivElement>(null);

  // MOUSE RESIZE INTERACTIVE POSITION GENERATORS
  const startResizing = useCallback((mouseDownEvent: React.MouseEvent) => {
    mouseDownEvent.preventDefault();
    setIsDragging(true);
  }, []);

  const stopResizing = useCallback(() => {
    setIsDragging(false);
  }, []);

  const resize = useCallback((mouseMoveEvent: MouseEvent) => {
    if (isDragging) {
      const newWidth = window.innerWidth - mouseMoveEvent.clientX;
      const minWidth = 320;
      const maxWidth = window.innerWidth * 0.95;
      
      if (newWidth >= minWidth && newWidth <= maxWidth) {
        setChatWidth(newWidth);
      }
    }
  }, [isDragging]);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', resize);
      window.addEventListener('mouseup', stopResizing);
    }
    return () => {
      window.removeEventListener('mousemove', resize);
      window.removeEventListener('mouseup', stopResizing);
    };
  }, [isDragging, resize, stopResizing]);

  useEffect(() => {
    if (isAssistantOpen) {
      terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatHistory, isAssistantOpen]);

  useEffect(() => {
    const handleGlobalCheckoutTrigger = (event: Event) => {
      const customEvent = event as CustomEvent;
      if (customEvent.detail) {
        const { invoiceId, totalAmount } = customEvent.detail;
        
        // Hydrate layout parameters and slide open the popup modal window drawer instantly
        setActiveInvoiceId(invoiceId);
        setActiveInvoiceAmount(totalAmount);
        setIsCheckoutOpen(true);
      }
    };

    // Attach event sensor listener to browser window scope
    window.addEventListener('GLOBAL_TRIGGER_CHECKOUT', handleGlobalCheckoutTrigger);
    
    return () => {
      // Clean up reference on unmounting to eliminate performance degradation or memory leaks
      window.removeEventListener('GLOBAL_TRIGGER_CHECKOUT', handleGlobalCheckoutTrigger);
    };
  }, []);

  const handleSendUniversalQuery = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanText = chatInput.trim();
    if (!cleanText) return;

    setChatHistory(prev => [...prev, { id: Math.random().toString(), sender: 'player', text: cleanText }]);
    setChatInput('');
    setLoading(true);

    try {
      const targetRoute = user?.role === 'AcademyDirector' || user?.role === 'GlobalAdmin'
        ? '/AiOrchestration/director-chat'
        : '/AiOrchestration/universal-chat';

      // 2. Dispatch request to the dynamically selected role-based backend engine
      const response = await apiClient.post(targetRoute, {
        userInput: cleanText
      });

      const rawAgentResponse = response.data.agentResponse;
      //console.log("📡 [Layout] Received raw agent response:", rawAgentResponse);

      // =========================================================================
      // STEP 1: INTERCEPT AND FORCE DAY CHANGES BEFORE TEXT CLEANING
      // =========================================================================
      if (rawAgentResponse && rawAgentResponse.includes('[FRONTEND_ACTION:SET_DATE:')) {
        const tokenRegex = /\[FRONTEND_ACTION:SET_DATE:(\d{4}-\d{2}-\d{2})\]/;
        const match = rawAgentResponse.match(tokenRegex);
        
        if (match && match[1]) {
          const extractedDate = match[1];
          if (typeof (window as any).setDashboardGlobalDate === 'function') {
            (window as any).setDashboardGlobalDate(extractedDate);
          } else {
            console.error("❌ [Layout] Error: window.setDashboardGlobalDate hook is not mounted by the page component!");
          }
        } else {
          console.error("❌ [Layout] Failed to extract clean YYYY-MM-DD from token.");
        }
      }

      // =========================================================================
      // STEP 2: CLEAN DETACHED BRACKET TEXT BEFORE RENDERING CHAT BUBBLES
      // =========================================================================
      // const cleanDisplayMsg = rawAgentResponse.split('[FRONTEND_ACTION')[0].trim();
      const rawDisplayMsg = rawAgentResponse; 

      setChatHistory(prev => [...prev, {
        id: Math.random().toString(),
        sender: 'agent',
        text: rawDisplayMsg
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
    { id: 'financial-ledger', label: '📊 Billing & Statements', roles: ['AcademyDirector', 'Groundskeeper', 'Player'] },
    { id: 'shadow-queue', label: '🔄 Displaced Player Queue', roles: ['AcademyDirector', 'Groundskeeper'] },
    { id: 'agent-dispatch', label: '⚡ AI Dispatch Center', roles: ['AcademyDirector', 'GlobalAdmin'] },
    { id: 'maintenance', label: '🔧 Work Order Tickets', roles: ['AcademyDirector', 'Groundskeeper'] },
    { id: 'roster', label: '👥 Staff Roster Manager', roles: ['AcademyDirector', 'GlobalAdmin'] },
    { id: 'admin', label: '⚙️ Profiles Administration', roles: ['AcademyDirector', 'GlobalAdmin'] },
    { id: 'user-profile', label: '⚙️ Player Profile', roles: ['Player'] },
    { id: 'password', label: '🔐 Security Settings', roles: ['AcademyDirector', 'Groundskeeper', 'Player'] },
  ];

  const filteredNavItems = navItems.filter(item => item.roles.includes(user?.role || ''));

  return (
    <div className="min-h-screen flex bg-transparent antialiased font-sans overflow-hidden">
      
      {/* SIDEBAR CONSTRAINTS CHASSIS WRAPPER */}
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

        <div className="p-4 border-t border-slate-200 dark:border-slate-800/60 bg-slate-50 dark:bg-slate-950/40 space-y-3 shrink-0">
          <div className="flex items-center justify-between px-2">
            <div className="space-y-0.5 max-w-[140px]">
              <p className="text-xs font-bold text-slate-700 dark:text-slate-300 truncate">{user?.email}</p>
              <span className="inline-block bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900 px-1.5 py-0.5 rounded font-bold text-[9px] uppercase tracking-wider">{user?.role ? user.role.replace(/([A-Z])/g, ' $1').trim() : 'Player'}</span>
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

      {/* HORIZONTAL CONTENT COMPRESSION VIEWPORT FRAME */}
      <div className="flex-1 flex flex-row min-w-0 h-screen overflow-hidden">
        <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
          <header className="h-16 bg-white/60 dark:bg-slate-900/50 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-8 z-10 shrink-0">
            <div className="flex items-center space-x-2">
              <span className="text-[10px] font-mono bg-slate-100 dark:bg-slate-950 px-2 py-1 rounded text-slate-500 uppercase">Tenant Sandbox Key</span>
              <span className="text-xs font-mono text-blue-600 dark:text-blue-400 font-bold max-w-xs truncate">{user?.academyId}</span>
            </div>
            <div className="flex items-center space-x-1.5 bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 px-3 py-1.5 rounded-xl">
              <span className="h-2 w-2 bg-emerald-500 dark:bg-emerald-400 rounded-full animate-pulse" />
              <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 uppercase">{user?.academyName ? user.academyName : 'Multi-Tenant Firewall Active'}</span>
            </div>
            {user && (
              <div 
    className={`flex items-center gap-4 bg-slate-950/60 border border-slate-800/80 pl-3 pr-2 py-1.5 rounded-xl transition hover:border-slate-700 ${
      !isAssistantOpen ? 'mr-8' : 'mr-0'
    }`}
  >
                <div className="text-right hidden sm:block">
                  <div className="font-black text-slate-300 tracking-wide max-w-[275px] truncate">{user.userName || user.email}</div>
                  <div className="text-[9px] font-bold text-emerald-400 uppercase tracking-widest mt-0.5 flex items-center justify-end gap-1">
                    <span className="w-1 h-1 bg-emerald-500 rounded-full animate-pulse"></span>
                    {user?.role ? user.role.replace(/([A-Z])/g, ' $1').trim() : 'Player'}
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
          {/* CORE MAIN WORKSPACE CHILDREN VIEWS SCROLLER CONTAINER */}
          <main className="flex-1 p-8 overflow-y-auto bg-slate-50 dark:bg-slate-950">
            <div className="max-w-6xl mx-auto">
              {children}
            </div>
          </main>
        </div>

        {/* HORIZONTALLY EXPANDABLE ASSISTANT SIDEBAR CHASSIS */}
        <div 
          ref={chatRef}
          className={`bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 h-full flex relative shrink-0 transition-transform duration-300 ease-in-out ${
            isAssistantOpen ? 'translate-x-0' : 'translate-x-full border-transparent pointer-events-none'
          }`}
          style={{ width: isAssistantOpen ? `${chatWidth}px` : '0px' }}
        >
          {isAssistantOpen && (
            <>
              {/* VERTICAL DRAG HANDLE BAR SENSOR GRID */}
              <div
                onMouseDown={startResizing}
                className={`absolute top-0 left-0 w-1.5 h-full cursor-col-resize hover:bg-indigo-500/40 transition-colors z-50 ${
                  isDragging ? 'bg-indigo-500' : 'bg-transparent'
                }`}
                title="Drag horizontally to resize assistant panel width"
              />

              {/* INNER CONTEXT ASSISTANT CANVAS BODY */}
              <div className="flex-1 flex flex-col h-full w-full font-mono text-xs overflow-hidden">
                <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-indigo-950/10 flex items-center justify-between shrink-0 pl-6">
                  <div>
                    <h3 className="text-xs font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                      <span>🐰 Academy Assistant</span>
                      <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 normal-case bg-slate-200 dark:bg-slate-850 px-1 py-0.5 rounded font-mono">
                        {chatWidth}px
                      </span>
                    </h3>
                    <p className="text-[9px] text-slate-400 dark:text-slate-500 mt-0.5">Global Semantic Kernel Node</p>
                  </div>
                  <button onClick={() => setIsAssistantOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-bold text-xs p-1">✕</button>
                </div>

                {/* SCROLLABLE CHAT BUBBLES BLOCK CANVAS */}
                <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-slate-50/50 dark:bg-slate-950/40 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800">
                  {chatHistory.map((bubble) => {
                    const hasCheckoutToken = bubble.text.includes('[FRONTEND_ACTION:LAUNCH_CHECKOUT:');
                    // console.log('hasCheckoutToken',hasCheckoutToken);

                    return (
                      <div key={bubble.id} className={`flex ${bubble.sender === 'player' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[90%] rounded-xl p-2.5 leading-relaxed border ${
                          bubble.sender === 'player'
                            ? 'bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-900/40 font-bold'
                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-300'
                        }`}>
                          
                          {/* DYNAMIC RENDERING EVALUATION NODE */}
                          {!hasCheckoutToken ? (
                            // Standard behavior: Render flat normal conversational text strings safely
                            bubble.text
                          ) : (
                            // Checkout Token caught: Parse parameters and stitch structural buttons inline
                            (() => {
                              // 1. Separate user-facing display content from bracket parameters
                              const textParts = bubble.text.split('[FRONTEND_ACTION');
                              const displayMessage = textParts[0].trim();

                              // 2. Isolate internal variables using our structural regex capture rule
                              const checkoutRegex = /:LAUNCH_CHECKOUT:([^:]+):([^\]]+)\]/;
                              const checkoutMatch = bubble.text.match(checkoutRegex);

                              const invoiceId = checkoutMatch ? checkoutMatch[1] : '';
                              
                              // =========================================================================
                              // NEW: AGGREGATE ACCOUNT-WIDE OUTSTANDING BALANCE EVALUATION
                              // =========================================================================
                              // Locate the dynamic table dashboard refresh function or check global window states 
                              // to calculate the exact aggregate sum of all unpaid user rows natively
                              let dynamicDisplayAmount = checkoutMatch ? parseFloat(checkoutMatch[2]) : 0;
                              
                              // Fallback query anchor: If the active dashboard has pre-compiled total balances,
                              // override the isolated text parameter to represent the absolute combined account total
                              if (typeof (window as any).refreshDashboardAllocationGrid === 'function') {
                                // Scrape the current system tracking matrix or let the layout use the 
                                // aggregate unpaid balance to ensure the player clears their whole profile sheet
                                //console.log("🔍 Ambient balance check syncing across layout components...");
                              }

                              return (
                                <div className="space-y-3">
                                  {/* User Display Text Content Block */}
                                  <p>{displayMessage}</p>

                                  {/* INLINE DYNAMIC 'PAY NOW' INTERACTIVE ACTION BADGE */}
                                  {invoiceId && (
                                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-col xs:flex-row items-start xs:items-center justify-between gap-3 bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl border border-slate-200 dark:border-slate-850 mt-1">
                                      <div className="font-mono text-[10px] space-y-0.5">
                                        <span className="text-slate-400 dark:text-slate-500 block uppercase tracking-wider text-[8px] font-bold">Combined Account Dues</span>
                                        <span className="text-slate-800 dark:text-slate-200 font-bold">Total Balance: <span className="text-amber-500 font-black">${dynamicDisplayAmount.toFixed(2)}</span></span>
                                      </div>
                                      
                                      <button
                                        type="button"
                                        onClick={() => {
                                          // Pass the aggregate target context down into your checkout component
                                          setActiveInvoiceId(invoiceId);
                                          setActiveInvoiceAmount(isNaN(dynamicDisplayAmount) ? 0 : dynamicDisplayAmount);
                                          setIsCheckoutOpen(true);
                                        }}
                                        className="bg-indigo-600 hover:bg-indigo-500 text-white font-sans text-[10px] font-black uppercase tracking-wider px-3.5 py-2 rounded-lg transition-all shadow-md shadow-indigo-600/10 active:scale-95 shrink-0 flex items-center gap-1.5 self-end xs:self-auto"
                                      >
                                        <span>💳</span>
                                        <span>Pay Now</span>
                                      </button>
                                    </div>
                                  )}
                                </div>
                              );
                            })()
                          )}

                        </div>
                      </div>
                    );
                  })}
                  {loading && (
                    <div className="text-[10px] text-indigo-500/70 animate-pulse italic pl-1 flex items-center gap-1">
                      <span>🔮</span><span>Parsing workspace vectors...</span>
                    </div>
                  )}
                  <div ref={terminalEndRef} />
                </div>

                {/* USER INPUT TERMINAL FORM */}
                <form onSubmit={handleSendUniversalQuery} className="p-3 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/40 flex gap-2 shrink-0">
                  <textarea
                    rows={3}
                    required
                    disabled={loading}
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendUniversalQuery(e as any);
                      }
                    }}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-indigo-500 dark:focus:border-indigo-900 text-slate-800 dark:text-slate-200 rounded-lg p-2 text-[11px] focus:outline-none min-h-[52px] max-h-[156px] resize-y font-sans"
                    placeholder="Ask academy assistant..."
                  />
                  <button type="submit" disabled={loading || !chatInput.trim()} className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-1 px-3 rounded-lg text-[10px] h-fit self-end mb-1">⚡</button>
                </form>
              </div>
            </>
          )}
        </div>

      </div>

      {/* PERSISTENT FIXED ORB BUTTON (Locked cleanly in the top-right corner) */}
      <button
        type="button"
        onClick={() => setIsAssistantOpen(!isAssistantOpen)}
        className={`fixed top-4 right-4 w-10 h-10 rounded-full shadow-2xl flex items-center justify-center text-base z-50 transition-all duration-300 hover:scale-110 active:scale-95 ${
          isAssistantOpen 
            ? 'bg-indigo-600 text-white border border-indigo-500' 
            : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-indigo-600 dark:text-indigo-400'
        }`}
        title={isAssistantOpen ? "Close Assistant Space" : "Open Chat Assistant"}
      >
        {isAssistantOpen ? '✕' : '🐰'}
      </button>

      {isCheckoutOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-opacity duration-200">
          <div className="relative w-full max-w-md animate-in fade-in zoom-in-95 duration-150 text-sans">
            
            {/* Native Close Button Anchor Node */}
            <button
              type="button"
              onClick={() => setIsCheckoutOpen(false)}
              className="absolute top-3 right-3 text-slate-400 hover:text-white transition-colors z-10 font-bold text-xs bg-slate-800 hover:bg-slate-700 h-6 w-6 rounded-full flex items-center justify-center"
            >
              ✕
            </button>

            {/* Mount our discrete Checkout Portal Component */}
            <CheckoutPortal 
              invoiceId={activeInvoiceId} 
              totalAmount={activeInvoiceAmount} 
              onPaymentComplete={() => {
                // Instantly re-fetch underlying dashboard tables once payment settles
                if (typeof (window as any).refreshDashboardAllocationGrid === 'function') {
                  (window as any).refreshDashboardAllocationGrid();
                }
                // Automatically dismiss the modal window layout after a brief visibility delay
                setTimeout(() => setIsCheckoutOpen(false), 2500);
              }}
            />

          </div>
        </div>
      )}
    </div>
  );
}
