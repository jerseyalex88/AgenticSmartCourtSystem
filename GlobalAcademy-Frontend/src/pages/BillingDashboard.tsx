import React, { useState, useEffect } from 'react';
import { apiClient } from '../api/apiClient';

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
}

interface BillingDashboardProps {
  onTriggerCheckoutPortal: (invoiceId: string, amount: number) => void;
}

export default function BillingDashboard(){ //({ onTriggerCheckoutPortal }: BillingDashboardProps) {
  const [statements, setStatements] = useState<BillingStatement[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [expandedInvoiceId, setExpandedInvoiceId] = useState<string | null>(null);

  // Dynamically compute the total sum of all outstanding unpaid invoice values
  const unpaidInvoicesList = statements.filter(inv => inv.status === 'Unpaid');
  const totalUnpaidBalance = unpaidInvoicesList.reduce((sum, inv) => sum + inv.totalAmount, 0);

  const fetchStatements = async () => {
    try {
      setLoading(true);
      setErrorMsg('');
      const response = await apiClient.get('/Checkout/my-statements');
      setStatements(response.data);
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
      case 'Paid': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'Unpaid': return 'bg-amber-500/10 text-amber-400 border-amber-500/20 animate-pulse';
      case 'Refunded': return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      default: return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
    }
  };

  const dispatchCheckoutEvent = (invoiceId: string, totalAmount: number) => {
    const checkoutEvent = new CustomEvent('GLOBAL_TRIGGER_CHECKOUT', {
      detail: { invoiceId, totalAmount }
    });
    window.dispatchEvent(checkoutEvent);
  };

  if (loading) {
    return (
      <div className="text-xs font-mono text-indigo-400 p-4 animate-pulse">
        🔄 Compiling active accounting data matrices...
      </div>
    );
  }
  return (
    <div className="space-y-6 text-sans">
      <div>
        <h2 className="text-xl font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight">Financial Ledger Statement</h2>
        <p className="text-xs text-slate-500 mt-1 font-mono">Continuous Multi-Tenant Real-Time Audit Summary</p>
      </div>

      {errorMsg && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-400 font-medium">
          {errorMsg}
        </div>
      )}

      {statements.length === 0 ? (
        <div className="p-8 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-xs text-slate-400 font-medium">
          📭 Clean Ledger Sheet: No historical financial entries found matching your account ID.
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-850 text-slate-400 uppercase tracking-wider font-bold text-[10px]">
                  <th className="p-4 w-12"></th>
                  <th className="p-4">Issued Timestamp</th>
                  <th className="p-4">Invoice Reference Key</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Total Amount</th>
                  <th className="p-4 text-center">Action Panel</th>
                  <th className="p-4 text-center">Customer</th>
                </tr>
              </thead>
              {totalUnpaidBalance > 0 && (
                  <tr className="bg-amber-500/5 border-b border-amber-500/20 text-amber-500 font-bold">
                    <td className="p-4 text-center">📊</td>
                    <td className="p-4 font-mono text-[10px] uppercase tracking-wider">Outstanding Balance Summary</td>
                    <td className="p-4 italic font-sans text-slate-400 dark:text-slate-500 font-normal">
                      Accumulated unresolved dues across {unpaidInvoicesList.length} billing items
                    </td>
                    <td className="p-4">
                      <span className="px-2 py-0.5 rounded border border-amber-500/30 bg-amber-500/10 text-[9px] font-black uppercase tracking-widest animate-pulse">
                        Dues Outstanding
                      </span>
                    </td>
                    <td className="p-4 text-right font-mono text-sm font-black text-amber-500">
                      ${totalUnpaidBalance.toFixed(2)}
                    </td>
                    <td className="p-4 text-center">
                      <button
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
                      </button>
                    </td>
                  </tr>
                )}
              <tbody className="divide-y divide-slate-100 dark:divide-slate-850">
                {statements.map((inv) => (
                  <React.Fragment key={inv.invoiceId}>
                    <tr className="hover:bg-slate-50/60 dark:hover:bg-slate-950/20 transition-colors font-medium">
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
                      <td className="p-4 text-slate-600 dark:text-slate-400 font-mono">
                        {new Date(inv.createdAtUtc).toLocaleString()}
                      </td>
                      <td className="p-4 font-mono font-bold tracking-tight text-slate-700 dark:text-slate-300 max-w-[180px] truncate" title={inv.invoiceId}>
                        {inv.invoiceId}
                      </td>
                      <td className="p-4">
                        <span className={`px-2 py-0.5 rounded border text-[10px] font-bold uppercase tracking-wide ${getStatusBadgeStyle(inv.status)}`}>
                          {inv.status}
                        </span>
                      </td>
                      <td className="p-4 text-right font-mono font-black text-slate-800 dark:text-white">
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
                            className="bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-black uppercase tracking-wider px-3 py-1.5 rounded-lg transition-all shadow shadow-emerald-900/10"
                          >
                            💳 Pay Dues
                          </button>
                        ) : (
                          <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono italic">Settled Ledger Row</span>
                        )}
                      </td>
                      <td className="p-4 text-slate-600 dark:text-slate-400 font-mono">
                        {inv.customerName}
                      </td>
                    </tr>

                    {/* EXPANDABLE DETAIL SHEET NEST */}
                    {expandedInvoiceId === inv.invoiceId && (
                      <tr className="bg-slate-50/50 dark:bg-slate-950/40">
                        <td colSpan={6} className="p-5 border-t border-b border-slate-100 dark:border-slate-850">
                          <div className="space-y-4 max-w-3xl font-mono text-[11px]">
                            
                            {/* Line Items List Layout Grid */}
                            <div>
                              <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Purchased Item Line Details</span>
                              <div className="space-y-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3">
                                {inv.lineItems.map((item, index) => (
                                  <div key={index} className="flex justify-between items-center text-slate-600 dark:text-slate-300 border-b border-slate-100 dark:border-slate-850 last:border-0 pb-1.5 last:pb-0 pt-1.5 first:pt-0">
                                    <span>{item.itemDescription} <span className="text-slate-400 font-normal">x{item.quantity}</span></span>
                                    <span className="font-bold text-slate-800 dark:text-slate-200">${item.lineTotal.toFixed(2)}</span>
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
                                    <div key={index} className={`p-2.5 rounded-xl border flex justify-between items-center ${rcpt.isSuccess ? 'bg-slate-100/40 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800' : 'bg-rose-500/5 border-rose-500/10 text-rose-400'}`}>
                                      <div>
                                        <p className="font-bold text-slate-700 dark:text-slate-300">
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
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
