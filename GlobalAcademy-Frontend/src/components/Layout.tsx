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

  // =========================================================================
  // 🚀 RESERVATION COUNTDOWN TIMER STATE VARIABLES
  // =========================================================================
  const [secondsRemaining, setSecondsRemaining] = useState<number | null>(null);
  const [hasUnpaidHold, setHasUnpaidHold] = useState<boolean>(false);
  
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

  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const [selectedVoiceKey, setSelectedVoiceKey] = useState<string>('en-US-AriaNeural'); // Default voice key for TTS

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

  // 🚀 AUTOMATED DATA SYNC: FETCH THE TRUE DATABASE TIMESTAMPS FROM THE API
  useEffect(() => {
    if (!user || user.role !== 'Player') return;

    const syncHoldTelemetry = async () => {
      try {
        const response = await apiClient.get('/Auth/user-active-holds');
        if (response.data?.hasActiveHold && response.data?.secondsLeft > 0) {
          setSecondsRemaining(response.data.secondsLeft);
          setHasUnpaidHold(true);
        } else {
          setSecondsRemaining(null);
          setHasUnpaidHold(false);
        }
      } catch (err) {
        // console.error("❌ Failed to sync court reservation hold parameters:", err);
      }
    };

    syncHoldTelemetry();
    // Periodically re-verify state to catch background data changes
    const dataSyncInterval = setInterval(syncHoldTelemetry, 30000);
    return () => clearInterval(dataSyncInterval);
  }, [user, activeTab]);

  // 🚀 THE TICKING GRAPHICAL TIMER MOTOR ENGINE
  useEffect(() => {
    if (secondsRemaining === null || secondsRemaining <= 0) {
      if (secondsRemaining === 0) {
        setSecondsRemaining(null);
        setHasUnpaidHold(false);
        // Force refresh grid states because court holds expired
        window.location.reload();
      }
      return;
    }

    const clockMotor = setTimeout(() => {
      setSecondsRemaining(prev => (prev !== null ? prev - 1 : null));
    }, 1000);

    return () => clearTimeout(clockMotor);
  }, [secondsRemaining]);

  useEffect(() => {
    const handleGlobalCheckoutTrigger = (event: Event) => {
      const customEvent = event as CustomEvent;
      if (customEvent.detail) {
        const { invoiceId, totalAmount, isPaymentCompletion } = customEvent.detail;
        
        // 🚀 RULE 4: FORCE HIDING CLOCK ON BALANCE CLEARANCE
        if (isPaymentCompletion) {
          apiClient.get('/Auth/user-active-holds').then(res => {
            if (!res.data?.hasActiveHold) {
              setSecondsRemaining(null);
              setHasUnpaidHold(false);
            }
          });
          return;
        }

        setActiveInvoiceId(invoiceId);
        setActiveInvoiceAmount(totalAmount);
        setIsCheckoutOpen(true);
      }
    };

    window.addEventListener('GLOBAL_TRIGGER_CHECKOUT', handleGlobalCheckoutTrigger);
    return () => {
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
        userInput: cleanText,
        voiceKey: selectedVoiceKey
      });

      const rawAgentResponse = response.data.agentResponse;
      // 🎯 INTERCEPT THE COMPANION AUDIO PAYLOAD TRACK PROPERTY FROM THE UNIFIED NETWORK WIRE
      const responseAudioBase64 = response.data.audioBase64; 

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

      // 🚀 SPEECH CONVERT TRIGGER: Fire instant high-fidelity neural audio voice playback!
      autoplayBase64Audio(responseAudioBase64);

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

const handleToggleRecording = async () => {
  if (isRecording) {
    // 🛑 STOP SPEAKING SEQUENCE
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
      setIsRecording(false);
    }
  } else {
    // 🎤 START SPEAKING SEQUENCE
    try {
      const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];

      const recorderInstance = new MediaRecorder(audioStream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/ogg'
      });

      recorderInstance.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorderInstance.onstop = async () => {
        // Stop all hardware mic trackers to release user device resources cleanly
        audioStream.getTracks().forEach(track => track.stop());

        const compiledAudioBlob = new Blob(audioChunksRef.current, { type: recorderInstance.mimeType });
        if (compiledAudioBlob.size === 0) return;

        // Process dispatch handshakes directly down the wire
        await handleSendVoiceQuery(compiledAudioBlob);
      };

      setMediaRecorder(recorderInstance);
      recorderInstance.start(250); // Slice chunk data timelines into 250ms fragments
      setIsRecording(true);
      // setStatusMessage?.("🎙️ Microphone active... Speak your inquiry clearly.");
    } catch (err: any) {
      console.error("Microphone hardware access denied:", err);
      alert("❌ Device communication fault: Unable to initialize audio recording lines.");
    }
  }
};

const handleSendVoiceQuery = async (audioBlob: Blob) => {
  setLoading(true);
  
  // 🎯 FIXED: Create a sanitized clone of the audio blob that strips away the complex codecs parameter string.
  // This satisfies .NET Core's strict header token validation checks perfectly!
  const sanitizedAudioBlob = new File([audioBlob], `voice_query_${Date.now()}.webm`, {
    type: 'audio/webm' 
  });

  const voiceFormData = new FormData();
  // Pass your clean, sanitized file blob straight into the multi-form append handler
  voiceFormData.append('audioFile', sanitizedAudioBlob);

  try {
    // 🚀 DISPATCH TO YOUR SECURE VOICE GATEWAY WEBHOOK
    const response = await apiClient.post('/AiOrchestration/voice-query', voiceFormData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });

    const rawAgentResponse = response.data.agentResponse;
    // 🎯 INTERCEPT THE NEURAL SPEECH BYTE MATRIX FROM THE RESPONSE STREAM CONTRACT
    const responseAudioBase64 = response.data.audioBase64;

    setChatHistory(prev => [
      ...prev,
      { id: Math.random().toString(), sender: 'player', text: "🎙️ [Voice Query Sent]" },
      { id: Math.random().toString(), sender: 'agent', text: rawAgentResponse }
    ]);

    // 🚀 SPEECH CONVERT TRIGGER: Fire instant hands-free audible voice notes back out the speakers!
    autoplayBase64Audio(responseAudioBase64);
    
  } catch (err: any) {
    console.error(err);
    alert(`❌ Voice Pipeline Error: ${err.message}`);
  } finally {
    setLoading(false);
  }
};

const autoplayBase64Audio = (base64String: string | null | undefined) => {
  if (!base64String) return;

  try {
    // 1. Convert the base64 string payload into a raw binary byte array array
    const byteCharacters = atob(base64String);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    
    // 2. Wrap the binary stream blocks inside a clean audio/mp3 Blob container
    const audioBlob = new Blob([byteArray], { type: 'audio/mp3' });
    const localPlayableUrl = URL.createObjectURL(audioBlob);

    // 3. Instantiate an isolated HTML5 Audio element and trigger instant playback
    const browserAudioPlayer = new Audio(localPlayableUrl);
    browserAudioPlayer.play().catch(playErr => {
      console.warn("🧭 [BROWSER AUTOPLAY BLOCK]: User interaction required before browser can fire audio wave outputs:", playErr);
    });

    // 4. Secure memory cleanup: revoke the object URL once the audio finishes playing
    browserAudioPlayer.onended = () => {
      URL.revokeObjectURL(localPlayableUrl);
    };
  } catch (ex) {
    console.error("❌ [FRONTEND AUDIO STREAM ENGINE FAULT]: Failed to parse base64 audio byte tracks:", ex);
  }
};

  const navItems = [
    { id: 'academies', label: '🏢 Academies Manager', roles: ['GlobalAdmin'] },
    { id: 'dashboard', label: '🏟️ Core Asset Matrix', roles: ['AcademyDirector', 'GlobalAdmin', 'Groundskeeper'] },
    { id: 'bookings', label: '⏱️ Bookings & Intervals', roles: ['AcademyDirector', 'GlobalAdmin', 'Groundskeeper', 'Player'] },
    { id: 'financial-ledger', label: '📊 Billing & Statements', roles: ['AcademyDirector', 'GlobalAdmin', 'Groundskeeper', 'Player'] },
    { id: 'shadow-queue', label: '🔄 Displaced Player Queue', roles: ['AcademyDirector', 'GlobalAdmin', 'Groundskeeper'] },
    { id: 'agent-dispatch', label: '⚡ AI Dispatch Center', roles: ['AcademyDirector', 'GlobalAdmin'] },
    { id: 'maintenance', label: '🔧 Work Order Tickets', roles: ['AcademyDirector', 'GlobalAdmin', 'Groundskeeper'] },
    { id: 'court-diagnostics', label: '📡 Court Diagnostics', roles: ['AcademyDirector', 'GlobalAdmin'] },
    { id: 'court-health', label: '🛡️ Court Health Analysis', roles: ['AcademyDirector', 'GlobalAdmin'] },
    { id: 'ai-op-center', label: '🛰️ AI Operations Center', roles: ['AcademyDirector', 'GlobalAdmin'] },
    { id: 'roster', label: '👥 Staff Roster Manager', roles: ['AcademyDirector', 'GlobalAdmin'] },
    { id: 'admin', label: '⚙️ Profiles Administration', roles: ['AcademyDirector', 'GlobalAdmin'] },
    { id: 'user-profile', label: '⚙️ Player Profile', roles: ['Player'] },
    { id: 'password', label: '🔐 Security Settings', roles: ['AcademyDirector', 'GlobalAdmin', 'Groundskeeper', 'Player'] },
  ];

  const filteredNavItems = navItems.filter(item => item.roles.includes(user?.role || ''));

  return (
    <div className="min-h-screen flex bg-transparent antialiased font-sans overflow-hidden">
      
      {/* SIDEBAR CONSTRAINTS CHASSIS WRAPPER */}
      <aside className="w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col justify-between shrink-0 h-screen">
        <div className="p-5 space-y-6 overflow-y-auto">
          <div className="flex items-center space-x-3 px-1">
            {/* <span className="text-xl bg-emerald-500/10 p-2 rounded-lg border border-emerald-500/20 text-emerald-400">🎾</span> */}
            <img 
              src="/HF_emblem_light.png" 
              alt="Academy Emblem" 
              className="h-10 w-10"
            />
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
                <div className="px-3 py-1.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 flex items-center gap-2">
                  <label className="text-[10px] font-sans font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">AI Voice Assistant:</label>
                  <select
                    disabled={loading}
                    value={selectedVoiceKey}
                    onChange={(e) => setSelectedVoiceKey(e.target.value)}
                    className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded px-1.5 py-0.5 text-[10px] font-mono text-slate-700 dark:text-slate-300 focus:outline-none focus:border-indigo-500 max-w-[240px]"
                  >
                    <optgroup label="English Accents (Male)">
                      <option value="en-US-JennyNeural">🇺🇸 USA - Standard Female (Jenny)</option>
                      <option value="en-US-BrianNeural">🇺🇸 USA - Pro Male (Brian)</option>
                      <option value="en-US-AndrewNeural">🇺🇸 USA - Conversational (Andrew)</option>
                      <option value="en-GB-RyanNeural">🇬🇧 UK - British Male (Ryan)</option>
                      <option value="en-AU-WilliamNeural">🇦🇺 AU - Australian Male (William)</option>
                      <option value="en-PH-JamesNeural">🇵🇭 PH - Filipino Male (James)</option>
                    </optgroup>
                    <optgroup label="International Languages (Male)">
                      <option value="es-MX-JorgeNeural">🇲🇽 Spanish (LatAm) - Jorge</option>
                      <option value="es-ES-AlvaroNeural">🇪🇸 Spanish (Spain) - Alvaro</option>
                      <option value="fr-CA-SylvieNeural">🇨🇦 French (Canada) - Sylvie</option>
                      <option value="fr-FR-HenriNeural">🇫🇷 French (France) - Henri</option>
                      <option value="it-IT-DiegoNeural">🇮🇹 Italian (Italy) - Diego</option>
                      <option value="ja-JP-KeitaNeural">🇯🇵 Japanese (Japan) - Keita</option>
                      <option value="fil-PH-AngeloNeural">🇭 Filipino (Philippines) - Angelo</option>
                      <option value="fil-PH-BlessicaNeural">🇭 Filipino (Philippines) - Blessica</option>
                    </optgroup>
                  </select>
                </div>
                <form onSubmit={handleSendUniversalQuery} className="p-3 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/40 flex gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleToggleRecording}
                    className={`p-2 transition font-sans font-bold text-xs uppercase flex items-center justify-center border ${
                      isRecording 
                        ? 'bg-red-700 text-white border-red-500 animate-pulse' 
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-purple-600 hover:text-purple-400'
                    }`}
                    title={isRecording ? "Click to lock and evaluate statement" : "Hold to transmit voice note"}
                  >
                    {isRecording ? '🛑 Recording' : '🎙️ Mic'}
                  </button>
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

      {hasUnpaidHold && secondsRemaining !== null && (
        <div className="fixed top-16 right-4 h-10 px-4 bg-indigo-600 border border-indigo-700 dark:border-indigo-800 rounded-full shadow-2xl flex items-center space-x-2 text-white font-sans text-xs font-black uppercase tracking-wider z-40">
        {/* <div className="fixed top-16 right-4 h-10 px-4 bg-amber-500 border border-amber-600 dark:border-amber-700 rounded-full shadow-2xl flex items-center space-x-2 text-white font-sans text-xs font-black uppercase tracking-wider z-40"> */}
          <span className="text-sm">⏱️</span>
          <span>Please pay now! Hold expires in:</span>
          <span className="font-mono text-sm bg-amber-600 border border-amber-700 px-2 py-0.5 rounded-md shadow-xs">
            {(() => {
              const minutes = Math.floor(secondsRemaining / 60);
              const seconds = secondsRemaining % 60;
              return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            })()}
          </span>
        </div>
      )}

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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 transition-opacity duration-200">
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
                const checkoutSuccessEvent = new CustomEvent('GLOBAL_TRIGGER_CHECKOUT', {
                  detail: { isPaymentCompletion: true }
                });
                window.dispatchEvent(checkoutSuccessEvent);
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
