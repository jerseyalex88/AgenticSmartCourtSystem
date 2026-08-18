import React, { createContext, useContext, useState, useEffect } from 'react';

// =========================================================================
// 🍪 SCENARIO 8: CONSENT SYSTEM ARCHITECTURAL VERSION CONFIGURATION
// =========================================================================
const CURRENT_COOKIE_VERSION = '1.0';
const STORAGE_KEY = 'smartcourt_cookie_consent';

export interface CookiePreferences {
  necessary: boolean;   // Scenario 4: Always active, cannot be toggled
  functional: boolean;  // Remember UI options
  analytics: boolean;   // e.g., Google Analytics block/allow trigger
  marketing: boolean;   // Targeted tracking pixels
}

interface CookieConsentContextType {
  preferences: CookiePreferences;
  showBanner: boolean;
  showPreferenceCenter: boolean;
  setShowBanner: (show: boolean) => void;
  setShowPreferenceCenter: (show: boolean) => void;
  acceptAll: () => void;
  rejectAll: () => void;
  saveCustomPreferences: (prefs: Omit<CookiePreferences, 'necessary'>) => void;
}

const defaultPreferences: CookiePreferences = {
  necessary: true,
  functional: false,
  analytics: false,
  marketing: false,
};

const CookieConsentContext = createContext<CookieConsentContextType | undefined>(undefined);

export function CookieConsentProvider({ children }: { children: React.ReactNode }) {
  // =========================================================================
  // 🚀 FIXED: SYNCHRONOUS LIFECYCLE INITIALIZER PASS TO PREVENT LAYOUT FLICKER
  // =========================================================================
  const [preferences, setPreferences] = useState<CookiePreferences>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed.version === CURRENT_COOKIE_VERSION) return parsed.preferences;
      } catch { return defaultPreferences; }
    }
    return defaultPreferences;
  });

  const [showBanner, setShowBanner] = useState<boolean>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return true; // 🍪 SCENARIO 1: First-time visitor -> Mount showing instantly
    try {
      const parsed = JSON.parse(stored);
      return parsed.version !== CURRENT_COOKIE_VERSION; // 🍪 SCENARIO 8: Version outdated -> Show!
    } catch {
      return true;
    }
  });

  const [showPreferenceCenter, setShowPreferenceCenter] = useState<boolean>(false);

  // =========================================================================
  // ⚙️ SCENARIO 1 & 6 & 8: HYDRATION & VERSION VALIDATION LIFECYCLE HOOK
  // =========================================================================
  useEffect(() => {
    const storedConsent = localStorage.getItem(STORAGE_KEY);
    
    if (!storedConsent) {
      // Scenario 1: First-time visitor -> Trigger Banner immediately
      setShowBanner(true);
      return;
    }

    try {
      const parsedData = JSON.parse(storedConsent);
      
      // Scenario 8: Outdated version validation layer check
      if (parsedData.version !== CURRENT_COOKIE_VERSION) {
        console.warn(`[COOKIE ENGINE]: Outdated Version ${parsedData.version} detected. Evicting and resetting.`);
        localStorage.removeItem(STORAGE_KEY);
        setShowBanner(true);
        return;
      }

      // Scenario 6: Valid saved preferences match -> Load silently
      setPreferences(parsedData.preferences);
      applyTrackingPermissions(parsedData.preferences);
    } catch (e) {
      console.error("[COOKIE ENGINE]: Error parsing stored preference schema:", e);
      setShowBanner(true);
    }
  }, []);

  // =========================================================================
  // 🛠️ ANALYTICS ENABLER / INHIBITOR DISPATCH LAYER
  // =========================================================================
    // =========================================================================
  // 🚀 ACTIVATED LIVE GOOGLE ADVANCED CONSENT SIGNAL TRANSMISSIONS
  // =========================================================================
  const applyTrackingPermissions = (prefs: CookiePreferences) => {
    const windowObj = window as any;

    if (prefs.analytics) {
      console.log("📊 [COOKIE ENGINE]: Analytics permitted. Activating Google Analytics scripts.");
      
      // Fire live permission update status signal out to the data layer array
      if (typeof windowObj.gtag === 'function') {
        windowObj.gtag('consent', 'update', { 'analytics_storage': 'granted' });
      }
    } else {
      console.log("🚫 [COOKIE ENGINE]: Analytics BLOCKED. Starving analytics script memory contexts.");
      
      // Fire denial status layout signal out to restrict background processing
      if (typeof windowObj.gtag === 'function') {
        windowObj.gtag('consent', 'update', { 'analytics_storage': 'denied' });
      }
    }

    if (prefs.marketing) {
      console.log("🎯 [COOKIE ENGINE]: Marketing permitted. Initializing tracking pixels.");
    } else {
      console.log("🛑 [COOKIE ENGINE]: Marketing BLOCKED. Shutting down tracking pixels.");
    }
  };


  const persistConsent = (finalPrefs: CookiePreferences) => {
    const payload = {
      version: CURRENT_COOKIE_VERSION,
      timestamp: new Date().toISOString(),
      preferences: finalPrefs
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    setPreferences(finalPrefs);
    applyTrackingPermissions(finalPrefs);
    setShowBanner(false);
    setShowPreferenceCenter(false);
  };

  // =========================================================================
  // 📥 SCENARIO 2: USER CLICKS "ACCEPT ALL"
  // =========================================================================
  const acceptAll = () => {
    const allTrue: CookiePreferences = {
      necessary: true,
      functional: true,
      analytics: true,
      marketing: true
    };
    persistConsent(allTrue);
  };

  // =========================================================================
  // 📤 SCENARIO 3: USER CLICKS "REJECT ALL"
  // =========================================================================
  const rejectAll = () => {
    const allFalse: CookiePreferences = {
      necessary: true,
      functional: false,
      analytics: false,
      marketing: false
    };
    persistConsent(allFalse);
  };

  // =========================================================================
  // 🛠️ SCENARIO 5: USER SAVES FROM PREFERENCE CENTER
  // =========================================================================
  const saveCustomPreferences = (customPrefs: Omit<CookiePreferences, 'necessary'>) => {
    const finalPrefs: CookiePreferences = {
      necessary: true,
      ...customPrefs
    };
    persistConsent(finalPrefs);
  };

  return (
    <CookieConsentContext.Provider value={{
      preferences,
      showBanner,
      showPreferenceCenter,
      setShowBanner,
      setShowPreferenceCenter,
      acceptAll,
      rejectAll,
      saveCustomPreferences
    }}>
      {children}
    </CookieConsentContext.Provider>
  );
}

export function useCookieConsent() {
  const context = useContext(CookieConsentContext);
  if (context === undefined) {
    throw new Error('useCookieConsent must be utilized within a CookieConsentProvider infrastructure wrapper.');
  }
  return context;
}
