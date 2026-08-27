import React, { useState, useEffect } from 'react';
import { useAuth } from './context/AuthContext';
import LandingPage from './pages/LandingPage'; // 👈 IMPORT YOUR NEW LANDING PAGE
import Login from './pages/Login';
import Layout from './components/Layout';
import PlayerGateway from './pages/PlayerGateway';
import { PlayerBookingManager } from './pages/PlayerBookingManager';
import ShadowQueueManager from './components/ShadowQueueManager';
import AgentDispatchCenter from './components/AgentDispatchCenter';
import CourtsDashboard from './pages/CourtsDashboard';
import BillingDashboard from './pages/BillingDashboard';
import ChangePassword from './pages/ChangePassword';
import RosterDashboard from './pages/RosterDashboard';
import AdminTools from './pages/AdminTools'; 
import { AlertProvider } from './context/AlertContext';
import AcademiesDashboard from './pages/AcademiesDashboard';
import ResetPassword from './pages/ResetPassword';
import { CookieConsentProvider } from './context/CookieConsentContext';
import CookieBanner from './components/CookieBanner';
import ThirdPartyScriptManager from './components/ThirdPartyScriptManager';
import CourtDiagnosticsDashboard from './pages/CourtDiagnosticsDashboard';
import AssetHealthControlCenter from './pages/AssetHealthControlCenter';

export default function App() {
  const { isAuthenticated, user, loading } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');

  // =========================================================================
  // 🚀 MANUAL SPA SINGLE PAGE ROUTER NAVIGATION TRACKING MONITOR
  // =========================================================================
  useEffect(() => {
    // Safety check: Exit quietly if Google Analytics tag instance isn't initialized yet
    const windowObj = window as any;
    if (typeof windowObj.gtag !== 'function') return;

    // Translate your internal activeTab state identifiers into human-readable page paths
    const resolvedPathName = '/' + activeTab;
    const resolvedTitleName = activeTab.charAt(0).toUpperCase() + activeTab.slice(1) + ' Workspace Panel';

    // console.log(`📡 [TELEMETRY DISPATCH]: Broadcasting SPA pageview state ➔ ${resolvedPathName}`);

    // Fire explicit manual page view analytics event packet to your GA4 account ledger
    windowObj.gtag('event', 'page_view', {
      page_path: resolvedPathName,
      page_title: resolvedTitleName,
      page_location: window.location.origin + resolvedPathName
    });
  }, [activeTab]); // 🔥 Re-fires instantly every single time a user switches tabs inside the app!

  // 1. ADD STATE FOR HANDLING PUBLIC LANDING VISIBILITY OVERRIDES
  const [showPublicLanding, setShowPublicLanding] = useState(true);
  const [showPlayerGateway, setShowPlayerGateway] = useState(false);

  // Check if the current browser window path matches our new player entrance routing rule
  const isPlayerEntrancePath = window.location.pathname === '/player-gateway';
  const isDirectorLoginPath = window.location.pathname === '/admin';
  // 🚀 Hook to intercept email password reset link paths
  const isResetPasswordPath = window.location.pathname === '/reset-password';
  const [targetAuthMode, setTargetAuthMode] = useState<'login' | 'register'>('login');

  // Track dynamic visibility state for the discrete checkout drawer modal
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [activeInvoiceId, setActiveInvoiceId] = useState('');
  const [activeInvoiceAmount, setActiveInvoiceAmount] = useState(0);

  // DYNAMIC INITIALIZATION HOOK: Automatically direct players to their booking hub!
  useEffect(() => {
    if (!loading && isAuthenticated && user) {
      // If the session is already authenticated, bypass the landing page entirely
      setShowPublicLanding(false);
      
      const userRole = user.role || 'Player'; 
      if (userRole === 'Player') {
        setActiveTab('bookings'); 
      }
    }
  }, [loading, isAuthenticated, user]);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      // 1. Force the layout grids back to the public root landing canvas view
      setShowPublicLanding(true);
      setShowPlayerGateway(false);
      
      // 2. Reset the administrative container tab back to the default workspace view
      setActiveTab('dashboard');
    }
  }, [loading, isAuthenticated]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center font-mono text-xs text-slate-500">
        Syncing Platform Security Identifiers...
      </div>
    );
  }
  
  // 🚀 UNAUTHENTICATED RESET PASSWORD INTERCEPT PASS-GATE
  if (!isAuthenticated && isResetPasswordPath) {
    return (
      <AlertProvider>
        <ResetPassword 
          onNavigate={(route) => {
            if (route === 'landing') {
              window.history.replaceState(null, '', '/');
              setShowPublicLanding(true);
              setShowPlayerGateway(false);
            } else {
              // Redirect back to the login gateway card upon successful complete
              const targetAcademyId = import.meta.env.VITE_DEFAULT_ACADEMY_ID;
              window.history.replaceState(null, '', `/player-gateway?academyId=${targetAcademyId}`);
              setTargetAuthMode('login');
              setShowPlayerGateway(true);
              setShowPublicLanding(false);
            }
          }} 
        />
      </AlertProvider>
    );
  }

  if (!isAuthenticated && isDirectorLoginPath) {
    return (
      <AlertProvider>
        <Login 
          onNavigate={(route) => {
            if (route === 'landing') {
              window.history.replaceState(null, '', '/');
              setShowPublicLanding(true);
              setShowPlayerGateway(false);
            } 
            else {
              setShowPublicLanding(true);
              setShowPlayerGateway(false);
            }
          }} 
        />
      </AlertProvider>
    );
  }

  // 3. PUBLIC HOMEPAGE GATEWAY: Render landing screen for unauthenticated users first
  if (!isAuthenticated && showPublicLanding && !isPlayerEntrancePath) {
    return (
      <LandingPage 
        onNavigate={(route) => {
          if (route === 'landing') {
            window.history.replaceState(null, '', '/');
            setShowPublicLanding(true);
            setShowPlayerGateway(false);
          }
          else if (route === 'login' || route === 'register') {
            const mode = route === 'register' ? 'register' : 'login';
            setTargetAuthMode(mode);
            const targetAcademyId = import.meta.env.VITE_DEFAULT_ACADEMY_ID
            window.history.replaceState(null, '', `/player-gateway?academyId=${targetAcademyId}`);
            // Dismiss landing view to uncover the core login forms panel loop
            setShowPlayerGateway(true);
            setShowPublicLanding(false);
          } else if (route === 'bookings') {
            // If they click Book Space directly without a session, route them to login first
            setShowPlayerGateway(true);
            setShowPublicLanding(false);
          }
        }} 
      />
    );
  }

  // FORCE GATEWAY: Intercept unauthenticated users attempting to bypass landing pages
  if (isPlayerEntrancePath || (!isAuthenticated && showPlayerGateway)) {
    return (
      <CookieConsentProvider>
        {/* 🚀 RUNNING BACKGROUND COMPLIANCE GATEWAY FOR GA4 */}
        <ThirdPartyScriptManager />
        <AlertProvider>
          <PlayerGateway 
            initialAuthMode={targetAuthMode}
            onNavigate={(route) => {
              if (route === 'landing') {
                window.history.replaceState(null, '', '/');
                setShowPublicLanding(true);
                setShowPlayerGateway(false);
              } else if (route === 'login' || route === 'register') {
                setShowPublicLanding(false);
                setShowPlayerGateway(true);
              }
            }} 
          />
          <CookieBanner />
        </AlertProvider>
      </CookieConsentProvider>
    );
  }

  // ADMINISTRATIVE CORE WORKSPACE PANEL MOUNT ROUTER
  const renderTabContent = () => {
    switch (activeTab) {
      case 'academies':
        return <AcademiesDashboard />;
      case 'dashboard':
        return <CourtsDashboard />;
      case 'bookings':
        return <PlayerBookingManager />;
      case 'roster':
        return <RosterDashboard />;
      case 'admin':
        return <AdminTools />; 
      case 'password':
        return <ChangePassword />;
      case 'shadow-queue':
        return <ShadowQueueManager />;
      case 'financial-ledger':
        return <BillingDashboard />;
      case 'maintenance':
        return (
          <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl">
            <h2 className="text-sm font-black text-slate-100 uppercase tracking-wider mb-2">🔧 Facility Work Order Ticket Backlog</h2>
            <p className="text-xs text-slate-400 leading-relaxed max-w-xl">
              [DEVELOPMENT WORKSPACE BLOCK]: Operational panel mapping court wear coefficients and allowing groundskeepers to run asset clearance routines.
            </p>
          </div>
        );
      case 'court-diagnostics':
        return <CourtDiagnosticsDashboard />;
      case 'court-health':
        return <AssetHealthControlCenter />;
      case 'agent-dispatch':
        return <AgentDispatchCenter />;
      case 'user-profile':
        return <AdminTools />; 
      default:
        return <div className="text-slate-500 p-4">View container out of sync.</div>;
    }
  };

  return (
    <CookieConsentProvider>
      {/* 🚀 RUNNING BACKGROUND COMPLIANCE GATEWAY FOR GA4 */}
      <ThirdPartyScriptManager />
      <AlertProvider>
        <Layout activeTab={activeTab} setActiveTab={setActiveTab}>
          {renderTabContent()}
        </Layout>
        <CookieBanner />
      </AlertProvider>
    </CookieConsentProvider>
  );
}
