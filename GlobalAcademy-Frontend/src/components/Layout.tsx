import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext'; // ◄--- ADD THIS IMPORT

interface LayoutProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  children: React.ReactNode;
}

export default function Layout({ activeTab, setActiveTab, children }: LayoutProps) {
  const { user, clearSession } = useAuth();
  const { theme, toggleTheme } = useTheme(); // ◄--- AWAKEN THE LIGHT/DARK MECHANICS HERE
  const isDirector = user?.role === 'AcademyDirector' || user?.role === 'GlobalAdmin';

  const navItems = [
    { id: 'dashboard', label: '🏟️ Core Asset Matrix', roles: ['AcademyDirector', 'Groundskeeper', 'Player'] },
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
    <div className="min-h-screen flex bg-transparent antialiased font-sans">
      
      {/* SIDEBAR WRAPPER CONSTRAINTS */}
      <aside className="w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col justify-between shrink-0">
        <div className="p-5 space-y-6">
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
        <div className="p-4 border-t border-slate-200 dark:border-slate-800/60 bg-slate-50 dark:bg-slate-950/40 space-y-3">
          <div className="flex items-center justify-between px-2">
            <div className="space-y-0.5 max-w-[140px]">
              <p className="text-xs font-bold text-slate-700 dark:text-slate-300 truncate">{user?.email}</p>
              <span className="inline-block bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900 px-1.5 py-0.5 rounded font-bold Alexander-text text-[9px] uppercase tracking-wider">{user?.role}</span>
            </div>
            
            {/* THE VISUAL THEME ACTUATOR SWITCH */}
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

      {/* RIGHT DISPLAY VIEWPORT CANVAS PANEL */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white/60 dark:bg-slate-900/50 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-8 z-10">
          <div className="flex items-center space-x-2">
            <span className="text-[10px] font-mono bg-slate-100 dark:bg-slate-950 px-2 py-1 rounded text-slate-500 uppercase">Tenant Sandbox Key</span>
            <span className="text-xs font-mono text-blue-600 dark:text-blue-400 font-bold max-w-xs truncate">{user?.academyId}</span>
          </div>
          <div className="flex items-center space-x-1.5 bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 px-3 py-1.5 rounded-xl">
            <span className="h-2 w-2 bg-emerald-500 dark:bg-emerald-400 rounded-full animate-pulse" />
            <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">Multi-Tenant Firewall Active</span>
          </div>
        </header>

        <main className="flex-1 p-8 overflow-y-auto">
          <div className="max-w-6xl mx-auto">
            {children}
          </div>
        </main>
      </div>

    </div>
  );
}
