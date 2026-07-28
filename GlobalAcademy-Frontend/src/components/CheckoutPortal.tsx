import React, { useState, useEffect, useRef } from 'react';
import dropIn from 'braintree-web-drop-in';
import { apiClient } from '../api/apiClient';

interface CheckoutProps {
  invoiceId: string;
  totalAmount: number;
  onPaymentComplete: () => void; // Intersects refreshTrigger state to update parent grids
}

// Map choices discretely to the preferred backend gateway enums
type ClientPaymentChoice = 'CreditCard' | 'PayPal';

export const CheckoutPortal: React.FC<CheckoutProps> = ({ invoiceId, totalAmount, onPaymentComplete }) => {
  const [paymentChoice, setPaymentChoice] = useState<ClientPaymentChoice>('PayPal');
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  
  // SDK Component References
  const braintreeInstance = useRef<any>(null);
  const squareCardInstance = useRef<any>(null);
  const braintreeContainerRef = useRef<HTMLDivElement>(null);
  const squareContainerRef = useRef<HTMLDivElement>(null);

    // ==========================================
  // PIPELINE A: SQUARE (DISCRETE CREDIT CARD)
  // ==========================================
  useEffect(() => {
    if (paymentChoice !== 'CreditCard') return;

    // 1. Establish strict component rendering lifecycle cancellation flags
    let isCurrentRenderActive = true;
    let cardInstance: any = null;

    const initializeSquare = async () => {
      // Small pause to guarantee that the HTML DOM element is fully painted on the screen
      await new Promise((resolve) => setTimeout(resolve, 100));
      if (!isCurrentRenderActive) return;

      // const containerNode = document.getElementById('square-card-container');
      // if (!containerNode) {
      //   console.error("❌ Target container element '#square-card-container' is missing from layout canvas.");
      //   return;
      // }

      const extendedWindow = window as any;
      if (!extendedWindow.Square) {
        setStatusMsg('❌ Secure payment infrastructure script failed to load. Check your network.');
        return;
      }

      try {
        // Clear previous instances out of memory cleanly
        if (squareContainerRef.current) {
          squareContainerRef.current.innerHTML = '';
        }

        // Ensure the box container element is completely empty before attaching an iframe
        //containerNode.innerHTML = '';
        console.log("🚀 [Debug] Handshaking with Square App ID: sandbox-sq0idb-iGj_ndMvcAhvTud9B_XYrw...");

        // 2. Initialize payments using stable, verified credentials
        const payments = extendedWindow.Square.payments(
          'sandbox-sq0idb-iGj_ndMvcAhvTud9B_XYrw', 
          'LC4RJHB6B4BHZ'
        );
        
        console.log("🚀 [Debug] Handshake successful! Initializing card model engine...");
        const card = await payments.card();
        
        // 3. Prevent mounting if the user already clicked away to the PayPal tab while this was running
        if (!isCurrentRenderActive) {
          await card.destroy();
          return;
        }

        console.log("🚀 [Debug] Card object created successfully! Attaching iframe to DOM element...");
        await card.attach(squareContainerRef.current!);
        
        // 4. Safely store the active instance references globally
        squareCardInstance.current = card;
        cardInstance = card;
        
        // Clear any previous error messages on successful mounting
        setStatusMsg('');
        console.log("🎉 [Debug] Square completely loaded with zero structural errors!");
      } catch (err: any) {
        console.error('Square SDK attachment fault:', err);
        // Only modify status labels if the component is actively mounted on the screen
        if (isCurrentRenderActive) {
          setStatusMsg('❌ Failed to mount secure credit card inputs. Try refreshing your browser.');
        }
      }
    };

    initializeSquare();

    // =========================================================================
    // LIFECYCLE DESTRUCTOR GUARD: CLEARS DUPLICATE CONNECTIONS INSTANTLY
    // =========================================================================
    return () => {
      isCurrentRenderActive = false; // Cancels any network actions currently in mid-flight
      
      if (cardInstance) {
        // Absolute unmount rule: Completely purges the iframe from the webpage
        cardInstance.destroy().then(() => {
          if (squareCardInstance.current === cardInstance) {
            squareCardInstance.current = null;
          }
          console.log("🧼 Square secure credit card iframe cleaned up successfully.");
        }).catch((e: any) => console.log("Clean unmount skipped:", e));
      }
    };
  }, [paymentChoice]);

  // ==========================================
  // PIPELINE B: BRAINTREE (DISCRETE PAYPAL)
  // ==========================================
  useEffect(() => {
    if (paymentChoice !== 'PayPal') return;

    const initializeBraintree = async () => {
      try {
        // Fetch safe verification token from your backend endpoint
  
        // TEMPORARY FOR TESTING: Skip the backend API fetch completely
        const response = await apiClient.get('/Checkout/braintree-token');
        const { clientToken } = response.data;
        //console.log('clientToken', clientToken);

        // Use this official, static Braintree Sandbox tokenization key
        //const staticSandboxTestingKey = 'sandbox_tmw9t4pt_vpy68mmvgrttft67';

        // dropIn.create({
        //   authorization: staticSandboxTestingKey, // Pass the static test key here
        //   container: braintreeContainerRef.current!,
        //   paypal: { flow: 'vault' },
        //   card: false // Keep cards routed purely through Square
        dropIn.create({
          authorization: clientToken,
          container: braintreeContainerRef.current!,
          paypal: { flow: 'vault' },
          card: false // Disable Braintree cards to route card volume purely through Square
        }, (err, instance) => {
          if (err) {
            console.error('Braintree error:', err);
            return;
          }
          braintreeInstance.current = instance;
        });
      } catch (err) {
        setStatusMsg('❌ Failed to establish secure connection to checkout server.');
      }
    };

    initializeBraintree();

    return () => {
      if (braintreeInstance.current) {
        braintreeInstance.current.teardown(() => {
          braintreeInstance.current = null;
        });
      }
    };
  }, [paymentChoice]);

  // ==========================================
  // UNIFIED DISPATCH MANAGER
  // ==========================================
  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setStatusMsg('');

    let generatedToken = '';
    let targetProvider = 0; // 0 = Braintree, 1 = Square (matching PreferredGateway enum indexes)
    let methodEnum = 0;     // 0 = CreditCard, 2 = Crypto_USDC etc.

    try {
      if (paymentChoice === 'CreditCard') {
        if (!squareCardInstance.current) throw new Error('Payment input fields uninitialized.');
        const result = await squareCardInstance.current.tokenize();
        if (result.status !== 'OK') throw new Error(result.errors[0].message);
        
        generatedToken = result.token;
        targetProvider = 1; // Routes directly to Square backend handler
        methodEnum = 0;     // CreditCard
      } else {
        if (!braintreeInstance.current) throw new Error('PayPal service uninitialized.');
        const payload = await new Promise<any>((resolve, reject) => {
          braintreeInstance.current.requestPaymentMethod((err: any, p: any) => err ? reject(err) : resolve(p));
        });
        
        generatedToken = payload.nonce;
        targetProvider = 0; // Routes directly to Braintree backend handler
        methodEnum = 1;     // Cash or custom mapped digital wallet balance type
      }

      // Submit the unified payload context directly to the backend .NET controller
      const apiResponse = await apiClient.post('/Checkout/process', {
        invoiceId,
        provider: targetProvider, // 0 = Braintree, 1 = Square
        method: methodEnum,
        paymentToken: generatedToken,
        currencyCode: 'CAD'
      });

      const finalResult = apiResponse.data;

      if (finalResult && finalResult.success) {
        setStatusMsg('🎉 Payment Approved! Your court booking is fully secured.');
        
        // Execute real-time grid refresh states
        if (typeof (window as any).refreshDashboardAllocationGrid === 'function') {
          (window as any).refreshDashboardAllocationGrid();
        }
        
        // Invoke parent numeric refresh synchronization callbacks
        onPaymentComplete(); 
        
      } else {
        setStatusMsg(`❌ Processing Error: ${finalResult?.message || 'Transaction rejected.'}`);
      }
    } catch (err: any) {
      setStatusMsg(`❌ Error: ${err.message || 'Transaction aborted.'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 bg-slate-900 text-white rounded-xl border border-slate-700 shadow-xl max-w-md mx-auto">
      <h3 className="text-xl font-bold tracking-tight mb-2">Secure Academy Checkout</h3>
      
      {/* Invoice Details Card Context Panel */}
      <div className="bg-slate-800 p-3 rounded-lg mb-4 border border-slate-600 text-xs">
        <span className="text-slate-400 block uppercase tracking-wider mb-1">Invoice Target</span>
        <span className="font-mono text-emerald-400 font-bold break-all block mb-2">{invoiceId}</span>
        <div className="flex justify-between items-center pt-2 border-t border-slate-700">
          <span className="text-sm font-semibold">Total Balance Due:</span>
          <span className="text-lg font-black text-white">${totalAmount.toFixed(2)}</span>
        </div>
      </div>

      {/* Discrete Payment Category Selector Tabs */}
      <div className="grid grid-cols-2 gap-2 mb-4 bg-slate-950 p-1 rounded border border-slate-800">
        <button
          type="button"
          onClick={() => { 
            setPaymentChoice('CreditCard'); 
            setStatusMsg(''); // FIX: Wipe previous error/status strings on tab swap
          }}
          className={`py-2 text-xs font-bold uppercase tracking-wider rounded transition-all ${
            paymentChoice === 'CreditCard' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
          }`}
        >
          💳 Credit Card
        </button>
        <button
          type="button"
          onClick={() => { 
            setPaymentChoice('PayPal'); 
            setStatusMsg(''); // FIX: Wipe previous error/status strings on tab swap
          }}
          className={`py-2 text-xs font-bold uppercase tracking-wider rounded transition-all ${
            paymentChoice === 'PayPal' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
          }`}
        >
          🌐 PayPal Balance
        </button>
      </div>

      {/* Target Forms Area */}
      <form onSubmit={handlePaymentSubmit} className="space-y-4">
        {paymentChoice === 'CreditCard' ? (
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 min-h-[100px] block opacity-100 transform-none">
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
              Secure Credit Card Details
            </label>
            
            {/* FIXED DISPLAY HOOK: Bind the ref handle and remove string lookup dependencies */}
            <div 
              ref={squareContainerRef}
              className="py-2 px-1 bg-slate-900 border border-slate-700/50 rounded-lg min-h-[44px]"
              style={{ minHeight: '44px', width: '100%', display: 'block' }}
            >
              <span className="text-[10px] font-mono text-slate-500 animate-pulse pl-1 block">
                🔐 Instantiating secure encryption fields...
              </span>
            </div>
          </div>
        ) : (
          <div className="bg-slate-950 p-2 rounded border border-slate-800">
            {/* Braintree mounts its secure Smart PayPal buttons container here */}
            <div ref={braintreeContainerRef}></div>
          </div>
        )}

        <button 
          type="submit" 
          disabled={loading}
          className="w-full font-bold uppercase text-xs tracking-widest bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 text-white p-3 rounded transition-colors duration-200"
        >
          {loading ? 'Authorizing Funds...' : 'Settle Invoice Balancing'}
        </button>
      </form>

      {statusMsg && (
        <div className="mt-4 p-3 rounded bg-slate-950 border border-slate-800 text-xs font-medium text-center text-slate-300">
          {statusMsg}
        </div>
      )}
    </div>
  );
};
