import React from 'react';
import { useAuth } from '../context/AuthContext';

interface LayoutProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  children: React.ReactNode;
}

export default function Layout({ activeTab, setActiveTab, children }: LayoutProps) {
  const { user, clearSession } = useAuth();
  const isDirector = user?.role === 'AcademyDirector' || user?.role === 'GlobalAdmin';

  // Dynamic Navigation Dictionary Mapping out your PostgreSQL Table Views
  const navItems = [
    { id: 'dashboard', label: '🏟️ Core Asset Matrix', roles: ['AcademyDirector', 'Groundskeeper', 'Player'] },
    { id: 'bookings', label: '⏱️ Bookings & Intervals', roles: ['AcademyDirector', 'Groundskeeper', 'Player'] },
    { id: 'shadow-queue', label: '🔄 Displaced Player Queue', roles: ['AcademyDirector', 'Groundskeeper'] },
    { id: 'maintenance', label: '🔧 Work Order Tickets', roles: ['AcademyDirector', 'Groundskeeper'] },
  ];

  // Filters links in real-time based on the user's encrypted token claims
  const filteredNavItems = navItems.filter(item => item.roles.includes(user?.role || ''));

  return (
    <div className="min-h-screen flex bg-slate-950 text-slate-100 antialiased font-sans">
      
      {/* =========================================================================
          LEFT NAVIGATIONAL NAVIGATION SIDEBAR PANEL
          ========================================================================= */}
      <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col justify-between shrink-0">
        <div className="p-5 space-y-6">
          
          {/* Top Brand Identity Lockup */}
          <div className="flex items-center space-x-3 px-1">
            <span className="text-xl bg-emerald-500/10 p-2 rounded-lg border border-emerald-500/20 text-emerald-400">🎾</span>
            <div>
              <h2 className="text-sm font-black tracking-wide text-slate-200 uppercase">Smart Court OS</h2>
              <p className="text-[10px] text-slate-500 font-mono tracking-tight">v4.0.0 // Connected</p>
            </div>
          </div>

          {/* Table Links Container */}
          <nav className="space-y-1">
            <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest px-2 mb-2">
              Database Tables Lifecycle
            </span>
            {filteredNavItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center px-3 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition group ${
                  activeTab === item.id
                    ? 'bg-emerald-600 text-slate-950 shadow-lg shadow-emerald-600/10 font-bold'
                    : 'text-slate-400 hover:bg-slate-850 hover:text-slate-200'
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Lower Session Identity Panel Card Anchor */}
        <div className="p-4 border-t border-slate-800/60 bg-slate-950/40 space-y-3">
          <div className="px-2 space-y-1">
            <p className="text-xs font-bold text-slate-300 truncate">{user?.email}</p>
            <span className="inline-block bg-emerald-950 text-emerald-400 border border-emerald-900 px-2 py-0.5 rounded-md font-bold text-[9px] uppercase tracking-wider">
              {user?.role}
            </span>
          </div>
          <button
            onClick={clearSession}
            className="w-full bg-slate-900 border border-slate-800 hover:bg-rose-950/40 hover:text-rose-400 hover:border-rose-900 text-slate-400 px-3 py-2 rounded-xl text-xs transition font-medium flex items-center justify-center space-x-2"
          >
            <span>Exit Active Session Workspace</span>
          </button>
        </div>
      </aside>

      {/* =========================================================================
          RIGHT MAIN DYNAMIC CONTENT WORKSPACE VIEWPORT
          ========================================================================= */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* Universal Top Management Meta Header Bar */}
        <header className="h-16 bg-slate-900/50 backdrop-blur-md border-b border-slate-800 flex items-center justify-between px-8 z-10">
          <div className="flex items-center space-x-2">
            <span className="text-[10px] font-mono bg-slate-950 px-2 py-1 rounded text-slate-500 uppercase">
              Tenant Sandbox Access Key
            </span>
            <span className="text-xs font-mono text-blue-400 font-bold max-w-xs truncate md:max-w-none">
              {user?.academyId || "00000000-0000-0000-0000-000000000000"}
            </span>
          </div>
          <div className="flex items-center space-x-4 text-xs font-medium text-slate-400">
            <div className="flex items-center space-x-1.5 bg-slate-950 border border-slate-850 px-3 py-1.5 rounded-xl shadow-inner">
              <span className="h-2 w-2 bg-emerald-400 rounded-full animate-pulse" />
              <span className="text-[11px] font-semibold text-slate-300">Multi-Tenant Firewall Active</span>
            </div>
          </div>
        </header>

        {/* Dynamic Inner Page Content Mounting Canvas */}
        <main className="flex-1 p-8 overflow-y-auto bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900">
          <div className="max-w-6xl mx-auto animate-fade-in">
            {children}
          </div>
        </main>
      </div>

    </div>
  );
}
