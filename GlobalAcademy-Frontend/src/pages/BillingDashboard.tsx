import React, { useState, useEffect } from 'react';
import { apiClient } from '../api/apiClient';
import { useAuth } from '../context/AuthContext';
import { useAlert } from '../context/AlertContext';

interface InvoiceLineItem {
  itemDescription: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

interface TransactionReceipt {
  processedByGateway: number; // 0 = Braintree, 1 = Square
  gatewayReferenceId: string;
  amount: number;
  timestampUtc: string;
  isSuccess: boolean;
}

interface BillingStatement {
  customerName: string;
  invoiceId: string;
  createdAtUtc: string;
  status: 'Unpaid' | 'Paid' | 'Voided' | 'Refunded' | string;
  totalAmount: number;
  lineItems: InvoiceLineItem[];
  receipts: TransactionReceipt[];
  bookingStartTimeUtc: string;
  isExpired: boolean;
}

export default function BillingDashboard(){
  const [statements, setStatements] = useState<BillingStatement[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [expandedInvoiceId, setExpandedInvoiceId] = useState<string | null>(null);

  const squareCardInstance = React.useRef<any>(null);
  const [squareLoading, setSquareLoading] = useState(false);
  const [squareStatusMsg, setSquareStatusMsg] = useState('');

  const { user: loggedInUser } = useAuth(); 
  const isDirector = loggedInUser?.role === 'AcademyDirector' || loggedInUser?.role === 'GlobalAdmin';
  const [refundLoadingId, setRefundLoadingId] = useState<string | null>(null);
  const { showAlert } = useAlert();

  // States to track loading actions and house the active document JSON manifest data
  const [statementData, setStatementData] = useState<any | null>(null);
  const [loadingStatementId, setLoadingStatementId] = useState<string | null>(null);
  const [showPrintModal, setShowPrintModal] = useState<boolean>(false);

  // Dynamically compute the total sum of all outstanding unpaid invoice values
  const unpaidInvoicesList = statements.filter(inv => inv.status === 'Unpaid');
  const totalUnpaidBalance = unpaidInvoicesList.reduce((sum, inv) => sum + inv.totalAmount, 0);

  const fetchStatements = async () => {
    try {
      setLoading(true);
      setErrorMsg('');
      const response = await apiClient.get('/Checkout/my-statements');
      const sortedData = [...response.data].sort((a, b) => {
        // Condition 1: If 'a' is Unpaid and 'b' is settled, float 'a' upward (-1)
        if (a.status === 'Unpaid' && b.status !== 'Unpaid') return -1;
        
        // Condition 2: If 'b' is Unpaid and 'a' is settled, push 'b' upward (1)
        if (a.status !== 'Unpaid' && b.status === 'Unpaid') return 1;
        
        // Condition 3: If statuses are identical, maintain our secondary sorting rule:
        // Keep the newest invoices at the top by falling back onto CreatedAtUtc
        return new Date(b.createdAtUtc).getTime() - new Date(a.createdAtUtc).getTime();
      });
      setStatements(sortedData);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Failed to sync with financial ledger tables.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatements();
    // Mount global refresh anchor so that payment completions force grid re-fetches
    (window as any).refreshDashboardAllocationGrid = () => fetchStatements();
    return () => {
      delete (window as any).refreshDashboardAllocationGrid;
    };
  }, []);

  const toggleInvoiceExpand = (id: string) => {
    setExpandedInvoiceId(expandedInvoiceId === id ? null : id);
  };

  const getStatusBadgeStyle = (status: string) => {
    switch (status) {
      case 'Paid': return 'bg-purple-100 text-purple-600 border-purple-300';
      case 'Unpaid': return 'bg-amber-100 text-amber-600 border-amber-300 animate-pulse';
      case 'Refunded': return 'bg-blue-100 text-blue-600 border-blue-300';
      default: return 'bg-slate-100 text-slate-600 border-slate-300';
    }
  };

  const dispatchCheckoutEvent = (invoiceId: string, totalAmount: number) => {
    const checkoutEvent = new CustomEvent('GLOBAL_TRIGGER_CHECKOUT', {
      detail: { invoiceId, totalAmount }
    });
    window.dispatchEvent(checkoutEvent);
  };

  //Isolated lifecycle loop to initialize Square securely onto the static page
  useEffect(() => {
    // Only mount if there are actual outstanding balances left to settle
    if (totalUnpaidBalance <= 0 || loading) return;

    let isCurrentRenderActive = true;
    let cardInstance: any = null;

    const initializeInlineSquare = async () => {
      // Small pause to guarantee that the static HTML container is fully painted
      await new Promise((resolve) => setTimeout(resolve, 150));
      if (!isCurrentRenderActive) return;

      const containerNode = document.getElementById('inline-square-card-container');
      if (!containerNode) return;

      const extendedWindow = window as any;
      if (!extendedWindow.Square) {
        setSquareStatusMsg('❌ Credit card subsystem offline: Script asset missing.');
        return;
      }

      try {
        containerNode.innerHTML = '';

        // Initialize using your verified App ID and universal bypass location keyword
        const payments = extendedWindow.Square.payments(
          'sandbox-sq0idb-iGj_ndMvcAhvTud9B_XYrw', 
          'main-location'
        );
        
        const card = await payments.card();
        
        if (!isCurrentRenderActive) {
          await card.destroy();
          return;
        }

        await card.attach('#inline-square-card-container');
        squareCardInstance.current = card;
        cardInstance = card;
        setSquareStatusMsg('');
      } catch (err) {
        console.error('Square initialization failure:', err);
      }
    };

    initializeInlineSquare();

    return () => {
      isCurrentRenderActive = false;
      if (cardInstance) {
        cardInstance.destroy().then(() => {
          if (squareCardInstance.current === cardInstance) {
            squareCardInstance.current = null;
          }
        }).catch((e: any) => console.log("Clean unmount skipped:", e));
      }
    };
  }, [totalUnpaidBalance, loading]);

  const handleSquarePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!squareCardInstance.current || unpaidInvoicesList.length === 0) return;

    setSquareLoading(true);
    setSquareStatusMsg('');

    try {
      // 1. Force the secure single-use token generation exactly ONCE
      const result = await squareCardInstance.current.tokenize();
      if (result.status !== 'OK') {
        throw new Error(result.errors?.message || 'Card validation fields failed.');
      }

      // 2. Map all outstanding invoice id GUID strings into an array payload structure
      const targetInvoiceIds = unpaidInvoicesList.map(inv => inv.invoiceId);

      // 3. Dispatch a SINGLE network call representing the consolidated aggregate total sum
      const response = await apiClient.post('/Checkout/process-consolidated', {
        invoiceIds: targetInvoiceIds,
        provider: 1, // PreferredGateway.Square numerical mapping index
        method: 0,   // PaymentMethod.CreditCard numerical mapping index
        paymentToken: result.token,
        currencyCode: 'CAD'
      });

      if (response.data.success) {
        setSquareStatusMsg(`🎉 Payment Approved! A single consolidated charge of $${totalUnpaidBalance.toFixed(2)} was processed successfully, clearing all ${unpaidInvoicesList.length} unpaid items.`);
        await fetchStatements(); // Instant background grid data refresh
      } else {
        setSquareStatusMsg(`❌ Error: ${response.data.message}`);
      }
    } catch (err: any) {
      setSquareStatusMsg(`❌ Error: ${err.response?.data?.message || err.message || 'Transaction aborted.'}`);
    } finally {
      setSquareLoading(false);
    }
  };

  const handleDirectorRefund = async (invoiceId: string) => {
    showAlert({
      title: 'Refund Booking?',
      message: `Are you absolutely sure you want to authorize this transaction reversal? Funds will return to the player's account profile.`,
      type: 'success',
      onConfirm: async () => {
        try {
          setRefundLoadingId(invoiceId);
          await apiClient.post(`/Checkout/director-refund/${invoiceId}`);

          showAlert({
            title: 'Refund Successful',
            message: 'Refund successfully completed!',
            type: 'success'
          });
          await fetchStatements();
        } catch (err: any) {
          const errMsg = `❌ Refund Blocked: ${err.response?.data?.message || err.response?.data || 'Execution failure.'}`;
          showAlert({ title: 'Refund Intercepted', message: errMsg, type: 'error' });
        }
        finally {
          setRefundLoadingId(null);
        }
      }
    });
  };

  const handleLoadAndPrintStatement = async (invoiceId: string) => {
    setLoadingStatementId(invoiceId);
    try {
      const response = await apiClient.get(`/Checkout/statement-manifest/${invoiceId}`);
      setStatementData(response.data);
      setShowPrintModal(true);
    } catch (err) {
      alert("Failed to compile consolidated statement transaction logs.");
    } finally {
      setLoadingStatementId(null);
    }
  };

    // =========================================================================
  // FIXED NATIVE PRINT HANDLER: ELIMINATES DOCUMENT.WRITE JS DELIVR WARNINGS
  // =========================================================================
  const executeNativePrint = () => {
    const printContent = document.getElementById("printable-statement-canvas");
    const windowUrl = 'HFTA-Statement-Print-Preview.html';
    const uniqueName = new Date().getTime();
    const printWindow = window.open(windowUrl, uniqueName.toString(), 'left=50,top=50,width=900,height=900');
    
    if (printWindow && printContent) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Statement Receipt</title>
            <style>
              /* Embedded Native CSS: 100% Offline Compatible & Fast Rendering */
              body { font-family: system-ui, -apple-system, sans-serif; padding: 40px; color: #1e293b; background: white; line-height: 1.5; }
              .text-right { text-align: right; }
              .text-center { text-align: center; }
              .flex { display: flex; }
              .justify-between { justify-content: space-between; }
              .items-start { align-items: flex-start; }
              .items-center { align-items: center; }
              .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
              .border-b-2 { border-bottom: 2px solid #0f172a; }
              .border-b { border-bottom: 1px solid #e2e8f0; }
              .border { border: 1px solid #e2e8f0; border-radius: 8px; }
              .pb-4 { padding-bottom: 16px; }
              .pb-1.5 { padding-bottom: 6px; }
              .p-4 { padding: 16px; }
              .p-8 { padding: 32px; }
              .mb-2.5 { margin-bottom: 10px; }
              .mt-1 { margin-top: 4px; }
              .space-y-4 > * + * { margin-top: 16px; }
              .space-y-6 > * + * { margin-top: 24px; }
              .w-full { width: 100%; }
              .max-w-xs { max-w: 240px; }
              .bg-slate-50 { background-color: #f8fafc; }
              .font-mono { font-family: monospace; font-size: 12px; }
              .font-bold { font-weight: 700; }
              .font-black { font-weight: 900; }
              .uppercase { text-transform: uppercase; }
              .tracking-tight { letter-spacing: -0.05em; }
              .text-xs { font-size: 12px; }
              .text-sm { font-size: 14px; }
              .text-xl { font-size: 20px; }
              .text-slate-500 { color: #64748b; }
              .text-slate-800 { color: #1e293b; }
              .text-emerald-600 { color: #059669; }
              .rounded { border-radius: 4px; }
              table { width: 100%; border-collapse: collapse; margin-top: 8px; }
              th { padding: 4px 0; color: #64748b; font-size: 11px; text-transform: uppercase; border-bottom: 1px solid #cbd5e1; }
              td { padding: 6px 0; font-size: 12px; }
              @media print { 
                body { padding: 0; background: white; color: black; }
                .no-print { display: none; }
              }
            </style>
          </head>
          <body>
            ${printContent.innerHTML}
            <script>
              window.onload = function() { window.print(); window.close(); };
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
    }
  };


  if (loading) {
    return (
      <div className="text-xs font-mono text-indigo-400 p-4 animate-pulse">
        🔄 Compiling active accounting data matrices...
      </div>
    );
  }
  return (
    <div className="space-y-6 font-sans">
      <div>
        <h2 className="text-xl font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight">Financial Ledger Statement</h2>
        <p className="text-xs text-slate-500 mt-1 font-sans">Continuous Multi-Tenant Real-Time Audit Summary</p>
      </div>

      {errorMsg && (
        <div className="p-3 bg-rose-100 border border-rose-300 text-xs text-rose-600 font-medium">
          {errorMsg}
        </div>
      )}

      {statements.length === 0 ? (
        <div className="p-8 text-center bg-white border border-slate-300 text-xs text-slate-600 font-medium">
          📭 Clean Ledger Sheet: No historical financial entries found matching your account ID.
        </div>
      ) : (
        <div className="bg-white border border-slate-300 overflow-hidden shadow-lg shadow-purple-900/10">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-300 text-slate-600 uppercase tracking-wider font-bold text-[10px]">
                  <th className="p-4 w-12"></th>
                  <th className="p-4">Issued Timestamp</th>
                  <th className="p-4">Invoice Reference Key</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Total Amount</th>
                  <th className="p-4 text-center">Action Panel</th>
                  <th className="p-4 text-center">Customer</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
              {totalUnpaidBalance > 0 && (
                  <tr className="bg-amber-50 border-b border-amber-300 text-amber-600 font-bold">
                    <td className="p-4 text-center">📊</td>
                    <td className="p-4 font-sans text-[10px] uppercase tracking-wider">Outstanding Balance Summary</td>
                    <td className="p-4 italic font-sans text-slate-600 font-normal">
                      Accumulated unresolved dues across {unpaidInvoicesList.length} billing items
                    </td>
                    <td className="p-4">
                      <span className="px-2 py-0.5 border border-amber-300 bg-amber-100 text-[9px] font-black uppercase tracking-widest animate-pulse">
                        Dues Outstanding
                      </span>
                    </td>
                    <td className="p-4 text-right font-sans text-sm font-black text-amber-500">
                      ${totalUnpaidBalance.toFixed(2)}
                    </td>
                    <td className="p-4 text-center">
                      {/* <button
                        type="button"
                        onClick={() => {
                          if (unpaidInvoicesList.length > 0) {
                            // DISPATCH VIA GLOBAL EVENT BUS
                            dispatchCheckoutEvent("ALL UNPAID INVOICES", totalUnpaidBalance);
                          }
                        }}
                        className="bg-amber-500 hover:bg-amber-600 text-slate-950 text-[10px] font-black uppercase tracking-widest px-4 py-1.5 rounded-lg transition-all shadow-md shadow-amber-500/10 active:scale-95"
                      >
                        ⚡ Pay Now ({unpaidInvoicesList.length})
                      </button> */}
                    </td>
                    <td className="p-4 text-right font-sans text-sm font-black text-amber-500"></td>
                  </tr>
                )}
              
                {statements.map((inv) => (
                  <React.Fragment key={inv.invoiceId}>
                    <tr className="hover:bg-slate-100 hover:bg-purple-50 transition-colors font-medium">
                      <td className="p-4 text-center">
                        <button 
                          type="button"
                          onClick={() => toggleInvoiceExpand(inv.invoiceId)}
                          className="text-slate-400 hover:text-indigo-500 font-bold transform transition-transform duration-150"
                          style={{ display: 'inline-block', transform: expandedInvoiceId === inv.invoiceId ? 'rotate(90deg)' : 'rotate(0deg)' }}
                        >
                          ▶
                        </button>
                      </td>
                      <td className="p-4 text-slate-600 font-sans">
                        {new Date(inv.createdAtUtc).toLocaleString()}
                      </td>
                      <td className="p-4 font-sans font-bold tracking-tight text-slate-800 max-w-[180px] truncate" title={inv.invoiceId}>
                        {inv.invoiceId}
                      </td>
                      <td className="p-4">
                        <div className="flex items-center justify-end pt-2 space-x-2">
                        <span className={`px-2 py-0.5 rounded border text-[10px] font-bold uppercase tracking-wide ${getStatusBadgeStyle(inv.status)}`}>
                          {inv.status}
                        </span>
                        <button
                          type="button"
                          disabled={loadingStatementId === inv.invoiceId}
                          onClick={() => handleLoadAndPrintStatement(inv.invoiceId)}
                          className="text-[11px] font-bold uppercase tracking-wider bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700 hover:text-white px-2 py-0.5 rounded transition flex items-center gap-1 active:scale-95 disabled:opacity-40"
                          title="View invoice document"
                        >
                          {loadingStatementId === inv.invoiceId ? '⏳ ...' : '📄'}
                        </button>
                        {/* INSERT THIS DIRECTLY IN THE TABLE ROW ACTIONS COLUMN CELL */}
                        {isDirector && inv.status === 'Paid' && !inv.isExpired && (
                          <button
                            type="button"
                            disabled={refundLoadingId === inv.invoiceId}
                            onClick={() => handleDirectorRefund(inv.invoiceId)}
                            className="rounded borderbg-purple-600 hover:bg-purple-500 text-black text-[10px] font-bold uppercase tracking-wide hover:bg-rose-600 hover:text-white transition disabled:opacity-50 active:scale-95"
                          >
                            {refundLoadingId === inv.invoiceId ? 'Reversing...' : '↩️ Refund'}
                          </button>
                        )}
                        </div>
                      </td>
                      <td className="p-4 text-right font-sans font-black text-slate-900">
                        ${inv.totalAmount.toFixed(2)}
                      </td>
                      <td className="p-4 text-center">
                        {inv.status === 'Unpaid' ? (
                          <button
                            type="button"
                            onClick={() => {
                              // DISPATCH VIA GLOBAL EVENT BUS
                              dispatchCheckoutEvent(inv.invoiceId, inv.totalAmount);
                            }}
                            className="bg-purple-600 hover:bg-purple-500 text-white text-[10px] font-black uppercase tracking-wider px-3 py-1.5 transition-all shadow shadow-purple-900/10 focus:ring-2 focus:ring-purple-500/50"
                          >
                            💳 Pay Dues
                          </button>
                        ) : (
                          <span className="text-[10px] text-slate-500 font-sans italic">Settled Ledger Row</span>
                        )}
                      </td>
                      <td className="p-4 text-slate-700 font-sans">
                        {inv.customerName}
                      </td>
                    </tr>

                    {/* EXPANDABLE DETAIL SHEET NEST */}
                    {expandedInvoiceId === inv.invoiceId && (
                      <tr className="bg-slate-50">
                        <td colSpan={6} className="p-5 border-t border-b border-slate-300">
                          <div className="space-y-4 max-w-3xl font-sans text-[11px]">
                            
                            {/* Line Items List Layout Grid */}
                            <div>
                              <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Purchased Item Line Details</span>
                              <div className="space-y-1 bg-white border border-slate-300 p-3">
                                {inv.lineItems.map((item, index) => (
                                  <div key={index} className="flex justify-between items-center text-slate-700 border-b border-slate-200 last:border-0 pb-1.5 last:pb-0 pt-1.5 first:pt-0">
                                    <span>{item.itemDescription} <span className="text-slate-400 font-normal">x{item.quantity}</span></span>
                                    <span className="font-bold text-slate-900">${item.lineTotal.toFixed(2)}</span>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* Gateway Transaction Trail Logs Ledger */}
                            {inv.receipts && inv.receipts.length > 0 && (
                              <div>
                                <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">External Gateway Transaction Logs</span>
                                <div className="space-y-1">
                                  {inv.receipts.map((rcpt, index) => (
                                    <div key={index} className={`p-2.5 border flex justify-between items-center ${rcpt.isSuccess ? 'bg-white border-slate-300' : 'bg-rose-50 border-rose-300 text-rose-600'}`}>
                                      <div>
                                        <p className="font-bold text-slate-800">
                                          Processor Engine: {rcpt.processedByGateway === 1 ? 'Discrete Card' : 'Discrete Wallet (PayPal)'}
                                        </p>
                                        <p className="text-[10px] text-slate-400 mt-0.5">Ref Token: {rcpt.gatewayReferenceId}</p>
                                      </div>
                                      <span className="font-black text-right">${rcpt.amount.toFixed(2)}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                          </div>
                        </td>
                        <td className="bg-slate-50"></td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {/* ========================================================================= */}
      {/* NEW: STATIC INLINE CREDIT CARD TERMINAL VIEW CONTEXT PANEL               */}
      {/* ========================================================================= */}
      {totalUnpaidBalance > 0 && (
        <div className="mt-8 bg-white border border-slate-300 p-6 text-slate-800 max-w-xl mx-auto shadow-xl shadow-purple-900/10 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="flex items-center gap-2.5 mb-4 border-b border-slate-300 pb-3">
            <span className="text-xl">💳</span>
            <div>
              <h3 className="text-sm font-black uppercase tracking-wider">Secure Credit Card Quick-Pay</h3>
              <p className="text-[10px] text-slate-600 font-sans">Direct Sandbox Processing Terminal</p>
            </div>
          </div>

          <div className="bg-slate-100 p-3 border border-slate-300 text-xs mb-4 flex justify-between items-center font-sans">
            <span className="text-slate-600">Total Consolidated Outstanding Balance:</span>
            <span className="text-base font-black text-amber-500">${totalUnpaidBalance.toFixed(2)}</span>
          </div>

          <form onSubmit={handleSquarePaymentSubmit} className="space-y-4">
            <div className="bg-white p-3.5 border border-slate-300 min-h-[92px]">
              <label className="block text-[9px] font-black uppercase tracking-widest text-slate-600 mb-2">
                Card Number / Expiration / Security Code / Zip
              </label>
              
              {/* FIXED HOOK NODE: Square mounts its fields directly onto this unmoving element */}
              <div id="inline-square-card-container" className="py-1"></div>
            </div>

            <button
              type="submit"
              disabled={squareLoading}
              className="w-full bg-purple-600 hover:bg-purple-500 disabled:bg-slate-300 font-sans text-xs font-black uppercase tracking-widest text-white py-3 transition-all shadow-md shadow-purple-900/20 active:scale-[0.98] focus:ring-2 focus:ring-purple-500/50"
            >
              {squareLoading ? 'Authorizing Card Vector...' : `Authorize & Clear Dues ($${totalUnpaidBalance.toFixed(2)})`}
            </button>
          </form>

          {squareStatusMsg && (
            <div className="mt-4 p-3 bg-slate-100 border border-slate-300 text-[11px] font-sans font-medium text-center text-slate-700">
              {squareStatusMsg}
            </div>
          )}
        </div>
      )}

      {/* TONED PRINT PREVIEW BACKDROP OVERLAY CANVA LAYER */}
      {showPrintModal && statementData && (
        <div className="fixed inset-0 bg-slate-500/50 flex items-start justify-center p-4 z-50 overflow-y-auto">
          <div 
            style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b' }} 
            className="max-w-5xl w-full p-6 space-y-6 shadow-2xl rounded-2xl block relative mt-24 mb-16"
          >
            
            {/* Modal Top Actions Navigation Bar Header */}
            <div style={{ display: 'flex', justifyContent: 'between', alignItems: 'center', paddingBottom: '16px', borderBottom: '1px solid #334155' }} className="flex justify-between items-center pb-4 border-b border-slate-800 w-full">
              <h3 className="text-sm font-black text-slate-200 uppercase tracking-wider font-mono">
                Receipt Statement Archive Preview
              </h3>
              <div style={{ display: 'flex', gap: '8px' }} className="flex gap-2">
                <button 
                  type="button"
                  onClick={executeNativePrint} 
                  style={{ backgroundColor: '#059669', color: '#020617', cursor: 'pointer' }}
                  className="bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-black text-xs px-4 py-2.5 rounded-xl transition shadow active:scale-95 whitespace-nowrap"
                >
                  🖨️ Save as PDF / Print
                </button>
                <button 
                  type="button"
                  onClick={() => setShowPrintModal(false)} 
                  style={{ backgroundColor: '#020617', color: '#94a3b8', cursor: 'pointer', border: '1px solid #334155' }}
                  className="bg-slate-950 hover:bg-slate-800 text-slate-400 text-xs px-4 py-2.5 rounded-xl transition border border-slate-800 active:scale-95"
                >
                  Close
                </button>
              </div>
            </div>

            {/* PRINT DOM TARGET CANVAS (High-contrast receipt layout styling wrapper) */}
            <div id="printable-statement-canvas" className="bg-white text-slate-900 p-8 rounded-xl space-y-6 border border-slate-200 font-sans shadow-inner">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', paddingBottom: '16px', borderBottom: '2px solid #0f172a' }}>
            
                {/* Left Cluster: Logo & Company Name Side-by-Side + Subtitle Below */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  
                  {/* Inline Flex Row grouping Logo and Title text directly together */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <img src="/logo_light.png" alt="Academy Logo" style={{ height: '36px', width: 'auto', objectFit: 'contain' }} />
                    <h1 style={{ margin: 0, fontSize: '20px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '-0.05em', color: '#0f172a' }}>
                      High Frequency Tennis Academy
                    </h1>
                  </div>
                  
                  {/* Subtitle baseline description prints cleanly underneath */}
                  <p style={{ margin: 0, paddingLeft: '48px', fontSize: '12px', color: '#64748b', fontFamily: 'monospace' }}>
                    SaaS Operating Infrastructure Hub
                  </p>
                </div>

                {/* Right Cluster: Securely balanced to match the height profile of the left side */}
                <div style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: '11px', color: '#64748b', lineHeight: '1.6', paddingTop: '4px' }}>
                  <div>Date: {new Date(statementData.dateProcessedUtc).toLocaleDateString()}</div>
                  <div>Receipt Log: {statementData.gatewayReferenceId}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 text-xs border-b border-slate-100 pb-4 gap-4">
                <div>
                  <span className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider">Statement Issued To</span>
                  <span className="font-bold text-slate-800 text-sm">👤 {statementData.customerName}</span>
                </div>
                <div className="text-right">
                  <span className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider">Payment Processing Method</span>
                  <span className="font-mono bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase">{statementData.paymentMethodDisplay}</span>
                </div>
              </div>

              {/* Core Table Looping Matrix Layer */}
              <div className="space-y-4">
                {statementData.invoices.map((inv: any, idx: number) => (
                  <div key={inv.invoiceId} className="border border-slate-100 rounded-lg p-4 bg-slate-50/50">
                    <div className="flex justify-between items-center border-b border-slate-200/60 pb-1.5 mb-2.5">
                      <span className="text-[10px] font-mono font-bold text-slate-400">Invoice #{idx + 1} ({inv.invoiceId.substring(0,8)})</span>
                      <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded ${inv.status === 'Paid' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-amber-100 text-amber-800 border border-amber-200'}`}>{inv.status}</span>
                    </div>
                    
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-200">
                          <th className="py-1">Line Description</th>
                          <th className="py-1 text-center">Qty</th>
                          <th className="py-1 text-right">Unit Price</th>
                          <th className="py-1 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-mono text-[11px] text-slate-700">
                        {inv.lineItems.map((li: any, lIdx: number) => (
                          <tr key={lIdx}>
                            <td className="py-1.5 font-sans text-slate-800">{li.itemDescription}</td>
                            <td className="py-1.5 text-center">{li.quantity}</td>
                            <td className="py-1.5 text-right">${li.unitPrice.toFixed(2)}</td>
                            <td className="py-1.5 text-right font-bold text-slate-900">${li.lineTotal.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>

              {/* Grand Aggregate Total Display Footer Box */}
              <div className="flex justify-end pt-2">
                <div className="w-full max-w-[240px] border-t-2 border-slate-900 pt-3 text-right space-y-1">
                  <div className="flex justify-between text-xs text-slate-500 font-mono">
                    <span>Aggregated Subtotal:</span>
                    <span>${statementData.grandTotalAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm font-black text-slate-900 border-t border-slate-100 pt-1">
                    <span>GRAND TOTAL PAID:</span>
                    <span className="font-mono text-emerald-600">${statementData.grandTotalAmount.toFixed(2)} CAD</span>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
