import React from 'react';

interface PublicHeaderProps {
  onNavigate: (route: string) => void;
  activeAuthMode?: 'login' | 'register';
  onSetAuthMode?: (mode: 'login' | 'register') => void;
}

export default function PublicHeader({ onNavigate, activeAuthMode, onSetAuthMode }: PublicHeaderProps) {
  return (
    <header className="sticky top-0 bg-slate-950 text-slate-200 z-40 border-b border-slate-900 shadow-xl px-6 md:px-12 py-4 flex items-center justify-between shrink-0">
      
      {/* BRANDING NODE LOGO */}
      <div className="flex items-center space-x-3 cursor-pointer" onClick={() => onNavigate('landing')}>
        <img 
          src="/HF_emblem_light.png" 
          alt="Academy Emblem" 
          className="h-10 w-10"
        />
        <div>
          <h1 className="text-xs font-black tracking-widest uppercase bg-gradient-to-r from-slate-100 to-slate-300 bg-clip-text text-transparent">High Frequency</h1>
          <p className="text-[10px] font-mono tracking-wider text-emerald-400">TENNIS ACADEMY</p>
        </div>
      </div>

      {/* ANCHOR NAVIGATION LINKS */}
      <nav className="hidden lg:flex items-center space-x-6 text-[11px] font-bold tracking-wider uppercase text-slate-400">
        <a href="#camps" onClick={() => onNavigate('landing')} className="hover:text-slate-100 transition">Adult Camps</a>
        <a href="#junior" onClick={() => onNavigate('landing')} className="hover:text-slate-100 transition">Junior Camps</a>
        <a href="#annual" onClick={() => onNavigate('landing')} className="hover:text-slate-100 transition">Annual Program</a>
        <a href="#tournaments" onClick={() => onNavigate('landing')} className="hover:text-slate-100 transition">Tournaments</a>
        <a href="#contact" onClick={() => onNavigate('landing')} className="hover:text-slate-100 transition">Contact us</a>
      </nav>

      {/* SESSION AUTHORIZATION CONTROLS */}
      {!activeAuthMode && (
        <div className="flex items-center space-x-2">
            <button 
            onClick={() => {
                if (onSetAuthMode) onSetAuthMode('login');
                onNavigate('login');
            }}
            className={`text-[11px] font-black uppercase tracking-wider px-3 py-2 rounded-lg transition ${
                activeAuthMode === 'login' ? 'text-emerald-400 font-black' : 'text-slate-300 hover:text-white'
            }`}
            >
            Sign In
            </button>
            <button 
            onClick={() => {
                if (onSetAuthMode) onSetAuthMode('register');
                onNavigate('register');
            }}
            className={`text-[11px] font-black uppercase tracking-wider px-3 py-2 rounded-xl transition ${
                activeAuthMode === 'register' ? 'bg-emerald-600 text-slate-950 font-black' : 'bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-100'
            }`}
            >
            Sign Up
            </button>
            <button 
            onClick={() => onNavigate('login')}
            className="text-[11px] font-black uppercase tracking-wider bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 px-4 py-2 rounded-xl transition hover:opacity-90 shadow-md shadow-emerald-500/10"
            >
            Book Space ➡️
            </button>
        </div>
      )}
    </header>
  );
}
