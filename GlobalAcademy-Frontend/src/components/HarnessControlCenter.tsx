import React, { useState, useEffect } from 'react';
import { apiClient } from '../api/apiClient';
import { useAlert } from '../context/AlertContext';
import { useAuth } from '../context/AuthContext';
import { HubConnectionBuilder } from '@microsoft/signalr';

// Strongly typed interfaces matching your .NET and Python contracts perfectly
interface PendingApprovalCard {
  threadId: string;
  academyId: string;
  courtName: string;
  stagedActionType: 'PlayerRefund' | 'MaintenancePO';
  stagedMaterialOrAmount: string;
  calculatedAuditLog: string;
  timestamp: string;
}

interface HarnessStateSnapshot {
  threadId: string;
  executionStatus: 'Active' | 'Paused_Pending_Approval' | 'Completed' | 'Aborted_Circuit_Breaker';
  currentLoopCount: number;
  totalTokensConsumed: number;
  rawInputPrompt: string;
  activeAgentResponse: string;
  contextChunks: string[];
}

export default function HarnessControlCenter() {
  const { user: loggedInUser } = useAuth();
  const { showAlert } = useAlert();
  const isDirector = loggedInUser?.role === 'AcademyDirector' || loggedInUser?.role === 'GlobalAdmin';

  // Core Orchestration & Terminal State Management Rails
  const [activeThreadId, setActiveTraceThreadId] = useState<string>(crypto.randomUUID());
  const [promptInput, setPromptInput] = useState<string>('');
  const [isTracing, setIsTracing] = useState<boolean>(false);
  const [terminalLogs, setTerminalLogs] = useState<string>('📟 [SYSTEM STANDBY]: Awaiting execution sequence initialization parameters...');
  const [retrievedContext, setRetrievedContext] = useState<string[]>([]);
  
  // Governance Metrics States
  const [loopCount, setLoopCount] = useState<number>(0);
  const [tokenCounter, setTokenCounter] = useState<number>(0);
  const [executionState, setExecutionStatus] = useState<string>('Active');

  // Human-In-The-Loop Interactive Queue States
  const [pendingApprovals, setPendingApprovals] = useState<PendingApprovalCard[]>([]);
  const [approvingThreadId, setApprovingThreadId] = useState<string | null>(null);
  const [approvalError, setApprovalError] = useState<string | null>(null);

  // Quick-Simulate Telemetry Template Macros
  const handleLoadSimulationPrompt = (type: 'humidity' | 'crack') => {
    if (type === 'humidity') {
      setPromptInput(
        "CRITICAL TELEMETRY ALERT: Indoor humidity sensor registers a sustained 72% spike at Branch Facility Court 1. " +
        "Cross-reference structural insurance safety manuals and dispatch immediate mechanical fan lockout protocols."
      );
    } else {
      setPromptInput(
        "FORENSIC OPTICAL REPORT: Camera frame registers a deep 3.2mm structural surface friction warp crack on Court 4. " +
        "Execute 90-day Prophet analytics, pull dynamic parts procurement warranty terms, and stage material work order."
      );
    }
  };
  // =========================================================================
  // 🧬 CORE ASYNCHRONOUS ORCHESTRATION HANDLERS
  // =========================================================================
  const handleExecuteAgentIntent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!promptInput.trim()) return;
    
    setIsTracing(true);
    setTerminalLogs(prev => prev + `\n\n📡 [GATEWAY TRANSMIT]: Forwarding intent array for Thread Context: ${activeThreadId}...`);
    
    try {
      // POST the user or sensor query down to your aligned proxy route
      const res = await apiClient.post('/AiOrchestration/execute-agent-intent', {
        ThreadId: activeThreadId,
        RawInputPrompt: promptInput
      });

      // Dynamically extract tracking variables from your unified contract shape
      const returnedStatus = res.data.execution_status || 'Active';
      const returnedResponse = res.data.active_agent_response || '';
      const returnedChunks = res.data.context_retrieved_chunks || [];
      const metricsData = res.data.harness_metrics || {};

      // Sync state variables to the screen layout
      setExecutionStatus(returnedStatus);
      setLoopCount(metricsData.current_loop_count || 0);
      setTokenCounter(metricsData.total_tokens_consumed || 0);
      setRetrievedContext(returnedChunks);
      setTerminalLogs(returnedResponse);

    } catch (err: any) {
      console.error(err);
      setTerminalLogs(prev => prev + `\n\n❌ [HANDSHAKE ERROR]: Connection loop execution failed: ${err.response?.data?.Error || err.message}`);
    } finally {
      setIsTracing(false);
    }
  };

  const handleResolveGraphApproval = async (threadId: string, action: 'Approve' | 'Reject') => {
    setApprovingThreadId(threadId);
    setApprovalError(null);
    try {
      // Dispatches the human override instruction back through the matching coordinator gateway
      await apiClient.post('/AiOrchestration/resolve-approval', {
        threadId: threadId,
        approved: action === 'Approve',
        rejectionNotes: action === 'Reject' ? 'Declined via administrative operation panel dashboard override.' : null
      });

      showAlert({
        title: 'Action Processed',
        message: `👥 Multi-agent graph thread has been successfully ${action === 'Approve' ? 'unfrozen and committed natively' : 'aborted and cleared'}.`,
        type: 'success'
      });

      // Clear the targeted item out of the pending approvals view state right away
      setPendingApprovals(prev => prev.filter(x => x.threadId !== threadId));

    } catch (err: any) {
      const serverErrMsg = err.response?.data?.Error || `Failed to transmit ${action.toLowerCase()} decision token parameter.`;
      setApprovalError(serverErrMsg);
    } finally {
      setApprovingThreadId(null);
    }
  };

  // =========================================================================
  // ⚡ SIGNALR SOCKET SUBSCRIPTION LIFECYCLE HOOK
  // =========================================================================
  useEffect(() => {
    const baseUriToken = import.meta.env.VITE_API_BASE_URL || 'https://localhost:7290/api';
    const hubRootUri = baseUriToken.endsWith('/api') 
      ? baseUriToken.slice(0, -4) 
      : baseUriToken.endsWith('/api/') 
        ? baseUriToken.slice(0, -5) 
        : baseUriToken; 
    const targetHubAddress = `${hubRootUri}/hubs/v3/harness-approval-gate`;

    // console.log(`[DEBUG] hubRootUri: ${hubRootUri}`);
    // console.log(`[DEBUG] targetHubAddress: ${targetHubAddress}`);

    // 🚀 RESOLVE AUTH TOKEN: Fetch your active authorization token directly from storage
    const activeJwtToken = localStorage.getItem('global_academy_jwt_token') || ''; 
    // Instantiate an active real-time socket map tracking your custom push endpoint route
    const signalrConnection = new HubConnectionBuilder()
      .withUrl(targetHubAddress, {
        withCredentials: true,
        accessTokenFactory: () => {
          return activeJwtToken.replace(/"/g, '').trim();
        }
      })
      .withAutomaticReconnect()
      .build();

    const startHubConnection = async () => {
      try {
        await signalrConnection.start();
        console.log('Hub mounted.');

        signalrConnection.on('ReceiveHarnessApprovalGate', (gateAlert: any) => {
          console.log('Received payload:', gateAlert);
          
          const nestedPayload = typeof gateAlert.payload === 'string' ? JSON.parse(gateAlert.payload) : gateAlert.payload;
          
          const newApprovalCard: PendingApprovalCard = {
            threadId: gateAlert.threadId,
            academyId: loggedInUser?.academyId || '',
            courtName: 'Multi-Zone System Lockout',
            stagedActionType: 'PlayerRefund',
            stagedMaterialOrAmount: `\$${nestedPayload.total_credit_reversal_amount?.toFixed(2) || '0.00'} Refund`,
            calculatedAuditLog: gateAlert.rationale,
            timestamp: gateAlert.timestampUtc
          };

          setPendingApprovals(prev => {
            if (prev.some(p => p.threadId === newApprovalCard.threadId)) return prev;
            return [newApprovalCard, ...prev];
          });

          showAlert({
            title: '⚠️ Human Gate Intercept',
            message: 'A multi-agent state transaction requires physical review and administrative clearance.',
            type: 'warning'
          });
        });
      } catch (err) {
        console.error('Handshake failed:', err);
      }
    };

    if (isDirector) {
      startHubConnection();
    }

    return () => {
      signalrConnection.stop();
    };
  }, [loggedInUser, isDirector]);
  return (
    <div className="w-full max-w-[100vw] h-screen space-y-3 font-sans p-4 bg-slate-50 text-slate-800 flex flex-col overflow-hidden">
      {/* MODULE HEADER PANEL */}
      <div className="w-full shrink-0">
        <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
          📡 Agentic AI Governance & Harness Control Lab
        </h2>
        <p className="text-xs text-slate-500 mt-1 font-mono">
          Advanced Module 6.5 Operational Layer. Persistent state snapshots checkpointing and multi-agent circuit breaking.
        </p>
      </div>

      {/* QUICK SELECT METRICS AND TELEMETRY ALERTS ROW */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 shrink-0 mt-2">
        <div className="border border-slate-300 bg-white p-3 shadow-sm flex flex-col justify-between">
          <div className="text-[10px] font-mono font-black text-slate-400 uppercase tracking-wider">Simulate System Scenarios</div>
          <div className="flex gap-2 mt-2">
            <button
              type="button"
              onClick={() => handleLoadSimulationPrompt('humidity')}
              className="flex-1 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 font-black text-[9px] py-2 uppercase font-mono tracking-tight"
            >
              🌦️ Humidity Lock
            </button>
            <button
              type="button"
              onClick={() => handleLoadSimulationPrompt('crack')}
              className="flex-1 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 font-black text-[9px] py-2 uppercase font-mono tracking-tight"
            >
              🧱 Surface Crack
            </button>
          </div>
        </div>

        {/* HARNESS GOVERNANCE MONITORING SCOREBOARDS */}
        <div className="border border-slate-300 bg-white p-3 shadow-sm flex justify-between items-center font-mono">
          <div>
            <span className="font-black text-slate-400 block text-[9px] uppercase">Execution Status</span>
            <span className="text-[10px] text-slate-500 mt-0.5 block font-sans font-medium">Harness Thread Gateway State</span>
          </div>
          <span className={`text-sm font-black uppercase tracking-tighter ${
            executionState === 'Paused_Pending_Approval' ? 'text-amber-500 animate-pulse' :
            executionState === 'Aborted_Circuit_Breaker' ? 'text-rose-600' : 'text-emerald-600'
          }`}>
            {executionState.replace('_', ' ')}
          </span>
        </div>

        <div className="border border-slate-300 bg-white p-3 shadow-sm flex justify-between items-center font-mono">
          <div>
            <span className="font-black text-slate-400 block text-[9px] uppercase">Iteration Loop Count</span>
            <span className="text-[10px] text-slate-500 mt-0.5 block font-sans font-medium">Circuit Breaker Ceiling: 6 Max</span>
          </div>
          <span className={`text-base font-black ${loopCount >= 5 ? 'text-rose-600' : 'text-slate-800'}`}>
            {loopCount} / 6
          </span>
        </div>

        <div className="border border-slate-300 bg-white p-3 shadow-sm flex justify-between items-center font-mono">
          <div>
            <span className="font-black text-slate-400 block text-[9px] uppercase">Total Tokens Consumed</span>
            <span className="text-[10px] text-slate-500 mt-0.5 block font-sans font-medium">Context Window Budget Allocation</span>
          </div>
          <span className="text-base font-black text-purple-700">
            {tokenCounter.toLocaleString()}
          </span>
        </div>
      </div>

      {/* CORE OPERATIONAL COMMAND QUERY INTERFACE CONSOLE */}
      <form onSubmit={handleExecuteAgentIntent} className="flex w-full gap-2 shrink-0 items-end mt-2">
        <textarea
          rows={2}
          value={promptInput}
          disabled={isTracing}
          onChange={(e) => setPromptInput(e.target.value)}
          placeholder="Input simulated sensor parameters or type director instructions to fire multi-agent execution thread loops..."
          className="flex-1 bg-white border border-slate-300 rounded-none px-3 py-2 text-xs focus:outline-none focus:border-purple-600 text-slate-800 font-medium font-sans resize-none min-h-[52px]"
        />
        <button
          type="submit"
          disabled={isTracing || !promptInput.trim()}
          className="bg-slate-900 hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400 text-white font-black text-[11px] px-6 py-3 uppercase rounded-none border border-slate-950 transition tracking-wider shrink-0 shadow shadow-slate-400/40 h-[52px]"
        >
          {isTracing ? 'Processing Thread...' : 'Execute Intent Layer'}
        </button>
      </form>
      {/* TWO-COLUMN LOWER DIAGNOSTIC WORKSPACE SPLIT CANVAS */}
      <div className="w-full flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-3 gap-4 items-stretch mt-2">
        
        {/* SUB PANEL A: AGENT REAL-TIME LOG OUTPUT TERMINAL (2/3 Width) */}
        <div className="lg:col-span-2 border border-slate-300 bg-white shadow-md p-4 rounded-none flex flex-col min-h-0">
          <div className="border-b border-slate-200 pb-2 mb-3 flex justify-between items-center shrink-0">
            <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-700">🕹️ Real-Time Node Traversal Audit Terminal</h4>
            <span className="font-mono text-[8px] text-slate-400">LANGGRAPH LOG CHANNEL</span>
          </div>
          <div className="flex-1 bg-slate-900 border border-slate-950 p-4 overflow-y-auto text-xs font-mono text-emerald-400 leading-relaxed rounded-none shadow-inner whitespace-pre-wrap select-text">
            {terminalLogs}
          </div>
        </div>

        {/* SUB PANEL B: RETRIEVED TEXT KNOWLEDGE FRAGMENTS (1/3 Width) */}
        <div className="border border-slate-300 bg-white shadow-md p-4 rounded-none flex flex-col min-h-0">
          <div className="border-b border-slate-200 pb-2 mb-3 flex justify-between items-center shrink-0">
            <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-700">📖 Active Grounding Reference Sources</h4>
            <span className="font-mono text-[8px] text-slate-400">PGVECTOR FRAGMENTS</span>
          </div>
          <div className="flex-1 overflow-y-auto space-y-3 pr-1">
            {retrievedContext.length > 0 ? (
              retrievedContext.map((chunk, idx) => (
                <div key={idx} className="p-3 bg-slate-50 border border-slate-200 shadow-sm rounded-none text-slate-700 text-xs leading-normal">
                  <span className="font-mono text-[8px] text-purple-600 block mb-1 font-bold">
                    [EVALUATED SOURCE CHUNK #{idx + 1}]
                  </span>
                  <p className="italic font-medium text-slate-800">"{chunk}"</p>
                </div>
              ))
            ) : (
              <div className="text-center py-20 text-xs text-slate-400 italic font-mono">
                No active background context shards currently extracted. Execute a scenario trace to run RAG.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 🛡️ EXECUTIVE GATEWAY OVERLAY: Human-In-The-Loop Verification Queue Panel */}
      {isDirector && (
        <div className="space-y-4 w-full mt-4 shrink-0">
          <div className="p-4 bg-white border border-slate-200 shadow-md rounded-none">
            <div className="border-b border-slate-200 pb-3 mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
                  <span className="animate-pulse h-2 w-2 rounded-full bg-amber-500" />
                  👥 Asynchronous Human-in-the-Loop Intercept Panel
                </h3>
                <p className="text-[10px] text-slate-500 font-mono mt-0.5 uppercase tracking-wide">
                  Review and authorize high-impact multi-agent financial ledger movements or asset decommissioning
                </p>
              </div>
              <span className="text-[9px] font-mono font-bold bg-slate-100 border border-slate-300 px-2 py-1 uppercase text-slate-700">
                Queue Count: {pendingApprovals.length}
              </span>
            </div>

            {approvalError && (
              <div className="p-3 mb-3 bg-rose-50 border border-rose-300 text-rose-700 text-[11px] font-mono uppercase font-bold flex items-center gap-2 rounded-none">
                ⚠️ ERROR: {approvalError}
              </div>
            )}

            {pendingApprovals.length === 0 ? (
              <div className="border border-dashed border-slate-200 p-6 text-center text-xs font-sans text-slate-400 italic bg-slate-50/50">
                No active agent graphs are currently sitting in a paused checkpoint gate. System running fully autonomous.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[190px] overflow-y-auto pr-1">
                {pendingApprovals.map((graph) => (
                  <div key={graph.threadId} className="bg-white border border-slate-300 hover:border-slate-400 p-3.5 rounded-none flex flex-col justify-between shadow-sm transition-all">
                    <div>
                      <div className="flex justify-between items-start text-[9px] font-mono border-b border-slate-100 pb-2 mb-2">
                        <div className="truncate max-w-[120px]">
                          <span className="font-bold text-slate-400 uppercase font-mono block">Context Scope:</span>
                          <span className="font-black text-slate-800 uppercase">{graph.courtName}</span>
                        </div>
                        <div className="text-right">
                          <span className="font-bold text-slate-400 uppercase font-mono block">Thread ID:</span>
                          <span className="font-mono text-slate-500 select-all">{graph.threadId.substring(0, 8)}...</span>
                        </div>
                      </div>

                      <div className="flex justify-between items-center mb-1.5">
                        <span className="text-[9px] font-mono font-black uppercase text-slate-400 tracking-tight">Staged Task:</span>
                        <span className={`inline-block text-[8px] font-mono font-black uppercase tracking-tight border px-1.5 py-0.5 ${
                          graph.stagedActionType === 'PlayerRefund' ? 'bg-purple-50 border-purple-300 text-purple-700' : 'bg-amber-50 border-amber-300 text-amber-700'
                        }`}>
                          {graph.stagedActionType === 'PlayerRefund' ? '💸 Payment Reversal' : '🛠️ Purchase Order'}
                        </span>
                      </div>

                      <div className="font-mono font-bold text-slate-900 text-xs tracking-tight mb-2">
                        Staged Value: {graph.stagedMaterialOrAmount}
                      </div>

                      <div className="bg-slate-50 border border-slate-200 p-2 font-mono text-[10px] text-slate-600 whitespace-pre-wrap leading-normal shadow-inner max-h-[75px] overflow-y-auto">
                        {graph.calculatedAuditLog}
                      </div>
                    </div>

                    <div className="flex gap-2 justify-end items-center pt-3 border-t border-slate-100 mt-3 shrink-0">
                      <button
                        type="button"
                        disabled={approvingThreadId !== null}
                        onClick={() => handleResolveGraphApproval(graph.threadId, 'Reject')}
                        className="flex-1 bg-white hover:bg-rose-50 text-rose-600 border border-rose-300 font-black text-[10px] py-1.5 uppercase rounded-none transition cursor-pointer select-none"
                      >
                        ❌ Reject
                      </button>
                      <button
                        type="button"
                        disabled={approvingThreadId !== null}
                        onClick={() => handleResolveGraphApproval(graph.threadId, 'Approve')}
                        className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[10px] py-1.5 uppercase rounded-none transition cursor-pointer select-none"
                      >
                        🟢 Approve
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
