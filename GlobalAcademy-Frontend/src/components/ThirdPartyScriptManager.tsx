import { useEffect } from 'react';
import { useCookieConsent } from '../context/CookieConsentContext';

export default function ThirdPartyScriptManager() {
  const { preferences } = useCookieConsent();

  useEffect(() => {
    // Replace this string with your real Google Analytics measurement ID from your GA4 console
    const GA_MEASUREMENT_ID = (import.meta.env.VITE_GOOGLE_ANALYTICS_ID as string) || '';

    // Safety check: Exit quietly if the environment variable fails to load or is unassigned
    if (!GA_MEASUREMENT_ID) {
      console.warn("⚠️ [COOKIE ENGINE]: Google Analytics target ID is missing from environment configurations (.env).");
      return;
    }

    if (preferences.analytics) {
    //   console.log("📊 [COOKIE ENGINE]: Analytics consent GRANTED. Initializing GA4 tags.");

      // 1. FIXED: Initialize the dataLayer globally BEFORE anything else to prevent race conditions
      const windowObj = window as any;
      windowObj.dataLayer = windowObj.dataLayer || [];
      
      // 2. FIXED: Map arguments correctly matching Google's standard library schema
      windowObj.gtag = function() {
        windowObj.dataLayer.push(arguments);
      };

      // 3. FIXED: Enable debug_mode to force Google Analytics to display localhost data stream traffic
      windowObj.gtag('js', new Date());
      windowObj.gtag('config', GA_MEASUREMENT_ID, {
        anonymize_ip: true,
        send_page_view: true,
        debug_mode: true 
      });

      // 4. FIXED: Added the mandatory www. prefix to guarantee stable connection handshakes
      const script = document.createElement('script');
      script.src = "https://www.googletagmanager.com/gtag/js?id=" + GA_MEASUREMENT_ID;
      script.async = true;
      script.id = 'google-analytics-core-tag';
      document.head.appendChild(script);

    } else {
    //   console.log("🚫 [COOKIE ENGINE]: Analytics consent DENIED or REVOKED. Purging window tags.");

      // 4. SELF-HEALING ACTION: If the player changes their choice via the footer later, wipe it from memory!
      const scriptElement = document.getElementById('google-analytics-core-tag');
      if (scriptElement) {
        scriptElement.remove();
      }

      // Evict active global telemetry instances entirely
      const windowObj = window as any;
      delete windowObj.gtag;
      delete windowObj.dataLayer;
    }
  }, [preferences.analytics]); // Dynamic dependency array fires immediately if preferences toggle changes live!

  return null; // This component strictly handles background network script logic; renders no HTML elements
}
