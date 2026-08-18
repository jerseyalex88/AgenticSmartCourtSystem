import React, { useState, useEffect } from 'react';
import { useCookieConsent } from '../context/CookieConsentContext';

export default function CookieBanner() {
  const {
    preferences,
    showBanner,
    showPreferenceCenter,
    setShowPreferenceCenter,
    acceptAll,
    rejectAll,
    saveCustomPreferences
  } = useCookieConsent();

  // Local state initialized to match current preferences when Preference Center opens (Scenario 7)
  const [localFunctional, setLocalFunctional] = useState(preferences.functional);
  const [localAnalytics, setLocalAnalytics] = useState(preferences.analytics);
  const [localMarketing, setLocalMarketing] = useState(preferences.marketing);

  // Synchronize internal form toggles whenever preferences change or modal is recalled
  useEffect(() => {
    if (showPreferenceCenter) {
      setLocalFunctional(preferences.functional);
      setLocalAnalytics(preferences.analytics);
      setLocalMarketing(preferences.marketing);
    }
  }, [showPreferenceCenter, preferences]);

  const handleSavePreferences = (e: React.FormEvent) => {
    e.preventDefault();
    saveCustomPreferences({
      functional: localFunctional,
      analytics: localAnalytics,
      marketing: localMarketing
    });
  };

  // Safe Guard: Render absolutely nothing if both panels are configured to stay hidden
  if (!showBanner && !showPreferenceCenter) return null;

  return (
    <>
      {/* =========================================================================
          🍪 INTERFACE A: SCENARIO 1 - THE BOTTOM COOKIE BANNER DISCRETE FOOTER
         ========================================================================= */}
      {showBanner && !showPreferenceCenter && (
        <div className="fixed bottom-4 left-4 right-4 md:left-auto md:max-w-md bg-white border border-slate-200 dark:border-slate-800 p-5 shadow-2xl z-[100] font-sans text-xs text-slate-600 rounded-none animate-fade-in animate-slide-up">
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <span className="text-lg">🍪</span>
              <h4 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                We Use Cookies
              </h4>
            </div>
            
            <p className="text-slate-500 leading-relaxed font-medium">
              We use cookies to improve your digital court booking experience, analyze platform performance telemetry, and personalize tailored content. 
            </p>

            <div className="flex flex-col sm:flex-row gap-2 pt-1 font-bold text-center">
              <button
                type="button"
                onClick={acceptAll}
                className="flex-1 bg-purple-600 hover:bg-purple-500 text-white py-2 px-3 transition uppercase tracking-wide cursor-pointer"
              >
                Accept All
              </button>
              
              <button
                type="button"
                onClick={rejectAll}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2 px-3 transition uppercase tracking-wide cursor-pointer"
              >
                Reject All
              </button>

              <button
                type="button"
                onClick={() => setShowPreferenceCenter(true)}
                className="flex-1 bg-white border border-slate-300 hover:border-purple-500 text-slate-700 py-2 px-3 transition uppercase tracking-wide cursor-pointer"
              >
                Customize
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          🍪 INTERFACE B: SCENARIO 4 - THE DETAIL PREFERENCE CENTER MODAL FRAME
         ========================================================================= */}
      {showPreferenceCenter && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-[110] font-sans text-xs text-slate-600 select-none animate-fade-in">
          <div className="bg-white border border-slate-300 w-full max-w-md p-6 space-y-5 shadow-2xl rounded-none animate-scale-up">
            
            <div className="border-b border-slate-200 pb-3 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                  Cookie Preferences
                </h3>
                <p className="text-slate-400 mt-0.5 text-[10px]">Manage compliance configurations data gates</p>
              </div>
              <button
                type="button"
                onClick={() => setShowPreferenceCenter(false)}
                className="text-slate-400 hover:text-slate-600 text-base font-bold focus:outline-none px-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSavePreferences} className="space-y-4">
              
              {/* Category 1: Necessary (Scenario 4 Always Active - No Toggle) */}
              <div className="p-3 bg-slate-50 border border-slate-200 flex items-start justify-between gap-4">
                <div className="space-y-0.5">
                  <div className="flex items-center space-x-1.5">
                    <span className="font-black text-slate-900 uppercase tracking-wide">Necessary Cookies</span>
                    <span className="bg-emerald-100 text-emerald-800 text-[9px] font-extrabold px-1.5 py-0.2 rounded-xs">ALWAYS ACTIVE</span>
                  </div>
                  <p className="text-slate-400 text-[10px] leading-relaxed">
                    Essential for secure multi-tenant identity handshaking, court scheduling allocation grids, and basic website stability operation. Cannot be disabled.
                  </p>
                </div>
              </div>

              {/* Category 2: Functional */}
              <div className="p-3 border border-slate-200 flex items-start justify-between gap-4 transition hover:bg-slate-50/50">
                <div className="space-y-0.5">
                  <span className="font-black text-slate-900 uppercase tracking-wide">Functional Cookies</span>
                  <p className="text-slate-400 text-[10px] leading-relaxed">
                    Remember your visual dashboard customization selections, view style modes, and system panel state layouts.
                  </p>
                </div>
                <div className="relative inline-flex items-center cursor-pointer pt-0.5">
                  <input
                    type="checkbox"
                    id="cookie_functional_chk"
                    checked={localFunctional}
                    onChange={(e) => setLocalFunctional(e.target.checked)}
                    className="accent-purple-600 h-4 w-4 rounded-sm cursor-pointer"
                  />
                </div>
              </div>

              {/* Category 3: Analytics */}
              <div className="p-3 border border-slate-200 flex items-start justify-between gap-4 transition hover:bg-slate-50/50">
                <div className="space-y-0.5">
                  <span className="font-black text-slate-900 uppercase tracking-wide">Analytics Cookies</span>
                  <p className="text-slate-400 text-[10px] leading-relaxed">
                    Help us track visitor metrics, traffic patterns, and reservation processing velocities so we can optimize application speeds.
                  </p>
                </div>
                <div className="relative inline-flex items-center cursor-pointer pt-0.5">
                  <input
                    type="checkbox"
                    id="cookie_analytics_chk"
                    checked={localAnalytics}
                    onChange={(e) => setLocalAnalytics(e.target.checked)}
                    className="accent-purple-600 h-4 w-4 rounded-sm cursor-pointer"
                  />
                </div>
              </div>

              {/* Category 4: Marketing */}
              <div className="p-3 border border-slate-200 flex items-start justify-between gap-4 transition hover:bg-slate-50/50">
                <div className="space-y-0.5">
                  <span className="font-black text-slate-900 uppercase tracking-wide">Marketing Cookies</span>
                  <p className="text-slate-400 text-[10px] leading-relaxed">
                    Track cross-site traffic maps to deliver personalized academy promotional advertising coordinates and pixel targets.
                  </p>
                </div>
                <div className="relative inline-flex items-center cursor-pointer pt-0.5">
                  <input
                    type="checkbox"
                    id="cookie_marketing_chk"
                    checked={localMarketing}
                    onChange={(e) => setLocalMarketing(e.target.checked)}
                    className="accent-purple-600 h-4 w-4 rounded-sm cursor-pointer"
                  />
                </div>
              </div>

              {/* Actions Footer Container */}
              <div className="pt-2 border-t border-slate-100 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowPreferenceCenter(false)}
                  className="bg-slate-100 hover:bg-slate-200 font-bold px-4 py-2 text-slate-700 transition uppercase tracking-wide"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-purple-600 hover:bg-purple-500 font-black text-white px-4 py-2 transition uppercase tracking-wide shadow-xs"
                >
                  Save Preferences
                </button>
              </div>

            </form>
          </div>
        </div>
      )}
    </>
  );
}
