// File: Frontend/src/pages/V3SwarmControlCenter.tsx
import React, { useState, useEffect } from 'react';
import { apiClient } from '../api/apiClient';
import { useAlert } from '../context/AlertContext';
import { useAuth } from '../context/AuthContext';

// =========================================================================
// 📋 STRONGLY-TYPED GREENFIELD DATA MODELS
// =========================================================================
interface PendingSwarmApproval {
  threadId: string;
  academyId: string;
  courtName: string;
  stagedActionType: 'PlayerRefund' | 'MaintenancePO';
  stagedMaterialOrAmount: string; 
  calculatedAuditLog: string;    
  timestamp: string;
}

interface ConciergeNotification {
  id: string;
  type: 'WeatherAlert' | 'EquipmentWarning' | 'TournamentNotice';
  title: string;
  message: string;
  actionText?: string;
  threadId?: string;
}

export default function V3SwarmControlCenter() {
  const { user: loggedInUser } = useAuth();
  const isPlayer = loggedInUser?.role.toLowerCase() === 'player';
  const isLoggedInGlobalAdmin = loggedInUser?.role.toLowerCase() === 'globaladmin';
  const isLoggedInDirector = loggedInUser?.role.toLowerCase() === 'academydirector';

  // 💬 PROMPT TERMINAL & TRACE LAB STATE
  const [promptQuery, setPromptQuery] = useState<string>('');
  const [aiResponse, setAiResponse] = useState<string>('');
  const [traceLoading, setTraceLoading] = useState<boolean>(false);
  const [activeThreadId, setActiveTraceThreadId] = useState<string | null>(null);

  // 👥 ADMIN PANELS QUEUES STATE
  const [pendingApprovals, setPendingApprovals] = useState<PendingSwarmApproval[]>([]);
  const [approvingThreadId, setApprovingThreadId] = useState<string | null>(null);
  const [adminError, setAdminError] = useState<string | null>(null);

  // 🎾 PLAYER CONCIERGE STATE MARGINS
  const [notifications, setNotifications] = useState<ConciergeNotification[]>([]);

  // =========================================================================
  // 📡 BACKEND HANDSHAKE OPERATIONS LOOP
  // =========================================================================
  const handleExecuteSwarmTrace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!promptQuery.trim()) return;

    setTraceLoading(true);
    setAiResponse('');
    setAdminError(null);

    try {
        console.log("Debug promptQuery", promptQuery);
      const payload = {
        raw_user_prompt: promptQuery,
        court_id: null
      };

      const res = await apiClient.post('/v3/swarm-orchestration/execute-swarm-thread', payload);
      console.log("aiResponse: ", res.data.final_response);
      setAiResponse(res.data.final_response);
      setActiveTraceThreadId(res.data.thread_id);

      // Instantly poll the database queues to refresh the UI states
      if (isLoggedInDirector || isLoggedInGlobalAdmin) {
        await fetchPendingAdminApprovals();
      } else {
        fetchPlayerConciergeMockNotifications();
      }
    } catch (err: any) {
      console.error('Execution pass aborted:', err);
      setAiResponse(`❌ error: Failed to establish inter-container proxy loop. ${err.message}`);
    } finally {
      setTraceLoading(false);
    }
  };

  const fetchPendingAdminApprovals = async () => {
    if (!isLoggedInDirector && !isLoggedInGlobalAdmin) return;
    try {
      setAdminError(null);
      const res = await apiClient.get<PendingSwarmApproval[]>('/v3/swarm-orchestration/pending-approvals');
      setPendingApprovals(res.data);
    } catch (err: any) {
      console.error('Failed to query checkpoint matrices:', err);
      setAdminError('Harness Error: Failed to fetch paused graph state records.');
    }
  };

  const handleResolveHumanDecision = async (threadId: string, decision: 'Approve' | 'Reject') => {
    setApprovingThreadId(threadId);
    setAdminError(null);
    try {
      await apiClient.post('/v3/swarm-orchestration/resolve-approval', {
        threadId,
        humanDecision: decision
      });
      alert(`👥 Human Choice Logged: Swarm sequence has been officially ${decision === 'Approve' ? 'Unfrozen & Committed' : 'Aborted & Cleared'}.`);
      await fetchPendingAdminApprovals();
    } catch (err: any) {
      setAdminError(err.response?.data?.message || `Failed to transmit ${decision.toLowerCase()} token.`);
    } finally {
      setApprovingThreadId(null);
    }
  };

  const fetchPlayerConciergeMockNotifications = () => {
    // Simulates custom, responsive alerts loaded natively following background swarm parsing passes
    setNotifications([
      {
        id: 'nt-01',
        type: 'WeatherAlert',
        title: '🌦️ Autonomous Match Recovery Opportunity',
        message: 'Stadium Show Court 1 is currently locked due to heavy precipitation. Your V3 AI Concierge has pre-allocated an alternate open slot on Indoor Hardcourt 2 for tomorrow at 7:00 PM based on your Premium Member tier priority.',
        actionText: '👍 Confirm Indoor Migration',
        threadId: activeThreadId || undefined
      },
      {
        id: 'nt-02',
        type: 'EquipmentWarning',
        title: '🎾 Play-Clock Racket Tension Alert',
        message: 'Your personal match history logs show you have passed 9 continuous hours of match play this week. According to factory tension decay thresholds, your co-poly strings have entered a critical 22% accuracy degradation zone.',
        actionText: '🛍️ Drop-off at Pro Shop',
        threadId: undefined
      }
    ]);
  };

  // Background polling intervals for admins
  useEffect(() => {
    if (isLoggedInDirector || isLoggedInGlobalAdmin) {
      fetchPendingAdminApprovals();
      const interval = setInterval(fetchPendingAdminApprovals, 8000);
      return () => clearInterval(interval);
    } else {
      fetchPlayerConciergeMockNotifications();
    }
  }, [isLoggedInDirector, isLoggedInGlobalAdmin, activeThreadId]);

  return (
    <div className="w-full max-w-[100vw] min-h-screen space-y-4 font-sans p-6 bg-slate-50 text-slate-800 flex flex-col">
      
      {/* 🚀 TEST BENCH HEADER ROW */}
      <div className="w-full border-b-2 border-slate-900 pb-3 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-4 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] border-2">
        <div>
          <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
            📡 Module 6/6.5 Multi-Agent Swarm Laboratory
          </h2>
          <p className="text-xs text-slate-500 font-mono mt-1 uppercase tracking-wide">
            Greenfield Isolated Environment Stack — Directed Graph Supervisor-Worker Framework
          </p>
        </div>
        
        {/* PROFILE OVERRIDE TESTING BAR BUTTONS */}
        {/* <div className="flex items-center gap-2 border border-slate-300 p-2 bg-slate-50">
          <span className="font-mono text-[9px] font-black uppercase text-slate-500">🧪 Testing Persona:</span>
          <button 
            type="button"
            onClick={() => { setUserRole('Player'); setPendingApprovals([]); }}
            className={`px-3 py-1 font-mono text-[10px] uppercase font-bold border transition ${userRole === 'Player' ? 'bg-purple-600 text-white border-purple-700' : 'bg-white text-slate-700'}`}
          >
            🎾 Player
          </button>
          <button 
            type="button"
            onClick={() => setUserRole('AcademyDirector')}
            className={`px-3 py-1 font-mono text-[10px] uppercase font-bold border transition ${userRole === 'AcademyDirector' ? 'bg-amber-600 text-white border-amber-700' : 'bg-white text-slate-700'}`}
          >
            💼 Director
          </button>
        </div> */}
      </div>

      {/* ========================================================================= */}
      {/* CENTRAL QUERY RUNTIME LAB AREA PANEL                                      */}
      {/* ========================================================================= */}
      <div className="w-full bg-white border-2 border-slate-900 p-5 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)]">
        <h3 className="text-xs font-mono font-black uppercase text-slate-500 tracking-wider mb-2">📥 Inter-Container Execution Terminal Console</h3>
        <form onSubmit={handleExecuteSwarmTrace} className="flex gap-2 items-end">
          <textarea
            rows={2}
            value={promptQuery}
            onChange={(e) => setPromptQuery(e.target.value)}
            placeholder={isPlayer ? "Type a player inquiry (e.g., 'My match was rained out today, help me find a slot' or 'Clay tournament shoe requirements')..." : "Type an administrative command (e.g., 'Generate emergency purchase order for Stadium Show Court 1 ballast repair estimated at $450.00')..."}
            className="flex-1 bg-slate-50 border border-slate-300 p-3 text-xs font-sans font-medium focus:outline-none focus:border-slate-900 min-h-[50px] resize-y"
          />
          <button
            type="submit"
            disabled={traceLoading || !promptQuery.trim()}
            className="bg-slate-900 hover:bg-slate-800 disabled:bg-slate-200 text-white font-black text-[11px] px-6 h-[50px] uppercase tracking-wider border border-slate-950 shadow shadow-slate-400/40 select-none cursor-pointer"
          >
            {traceLoading ? 'Swarms Processing...' : 'Execute V3 Swarm'}
          </button>
        </form>

        {aiResponse && (
          <div className="mt-4 p-4 border border-slate-200 bg-slate-50/50">
            <span className="font-mono text-[9px] uppercase tracking-wider text-slate-400 block mb-1.5 font-bold">💬 Conversational AI Feedback Output Stream:</span>
            <p className="text-xs font-sans font-medium text-slate-800 whitespace-pre-wrap leading-relaxed">{aiResponse}</p>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* CONDITIONAL DISPLAY CANVAS VIEW: PLAYER VIEW vs ADMINISTRATIVE VIEW       */}
      {/* ========================================================================= */}
      
      {/* 🎾 VIEW 1: PLAYER SECURE SMART CONCIERGE FEED */}
      {isPlayer && (
        <div className="w-full space-y-4 animate-fadeIn">
          <h3 className="text-xs font-mono font-black uppercase text-slate-400 tracking-wider">🤖 AI Smart Concierge Feed Cards</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {notifications.map((n) => (
              <div key={n.id} className="bg-white border-2 border-purple-900 p-5 shadow-[4px_4px_0px_0px_rgba(147,51,234,0.2)] flex flex-col justify-between">
                <div>
                  <h4 className="text-xs font-black text-purple-900 uppercase tracking-tight mb-2 font-mono">{n.title}</h4>
                  <p className="text-xs text-slate-600 font-medium leading-relaxed font-sans">{n.message}</p>
                </div>
                {n.actionText && (
                  <button 
                    type="button"
                    onClick={() => alert(`Action processed cleanly for state thread: ${n.threadId || 'Autonomous context'}`)}
                    className="mt-4 align-self-start bg-purple-600 hover:bg-purple-700 text-white border-2 border-purple-800 font-mono font-bold text-[10px] px-4 py-2 uppercase tracking-wide cursor-pointer"
                  >
                    {n.actionText}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 💼 VIEW 2: EXECUTIVE HUMAN-IN-THE-LOOP INTERCEPT PANEL */}
      {(isLoggedInDirector || isLoggedInGlobalAdmin) && (
        <div className="w-full mt-4 animate-fadeIn space-y-4">
          <h3 className="text-xs font-mono font-black uppercase text-slate-400 tracking-wider">👥 Executive Management Security Authorization Perimeter</h3>
          <div className="bg-white border-2 border-slate-900 p-5 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)]">
            <div className="border-b border-slate-200 pb-3 mb-4 flex items-center justify-between">
              <div>
                <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
                  <span className="animate-pulse h-2 w-2 rounded-full bg-amber-500" />
                  Asynchronous Human-in-the-Loop Intercept Approval Queue
                </h4>
                <p className="text-[10px] text-slate-500 font-mono mt-0.5 uppercase tracking-wide">
                  Review and unlock high-impact transactions or infrastructure modifications before DB commits
                </p>
              </div>
              <span className="text-[9px] font-mono font-black bg-slate-100 border px-2 py-1 text-slate-700">
                Active Stalls: {pendingApprovals.length}
              </span>
            </div>

            {adminError && (
              <div className="p-3 mb-3 bg-rose-50 border border-rose-300 text-rose-700 text-[10px] font-mono font-black uppercase">
                ⚠️ ERROR: {adminError}
              </div>
            )}

            {pendingApprovals.length === 0 ? (
              <div className="border border-dashed border-slate-200 p-10 text-center text-xs font-sans text-slate-400 italic bg-slate-50/50">
                No multi-agent threads are currently held inside a paused checkpoint gate. Systems running autonomous.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse border border-slate-200">
                  <thead>
                    <tr className="bg-slate-900 text-white font-mono text-[9px] uppercase tracking-wider">
                      <th className="p-2.5 border border-slate-700">Target Court Context</th>
                      <th className="p-2.5 border border-slate-700">Staged AI Action</th>
                      <th className="p-2.5 border border-slate-700">Calculated RAG Audit Breakdown Log</th>
                      <th className="p-2.5 border border-slate-700 text-right">Actions Panel</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-xs font-sans font-medium text-slate-700">
                    {pendingApprovals.map((graph) => (
                      <tr key={graph.threadId} className="hover:bg-slate-50/60 bg-white transition-colors">
                        <td className="p-2.5 border border-slate-200">
                          <p className="font-black text-slate-900 uppercase text-[11px]">{graph.courtName}</p>
                          <span className="text-[8px] font-mono text-slate-400 block tracking-tight mt-1 select-all">ID: {graph.threadId}</span>
                        </td>
                        <td className="p-2.5 border border-slate-200">
                          <span className={`inline-block text-[8px] font-mono font-black border px-1.5 py-0.5 mb-1.5 uppercase ${graph.stagedActionType === 'PlayerRefund' ? 'bg-purple-50 border-purple-300 text-purple-700' : 'bg-amber-50 border-amber-300 text-amber-700'}`}>
                            {graph.stagedActionType === 'PlayerRefund' ? '💸 Balance Reversal' : '⚙️ Purchase Order'}
                          </span>
                          <p className="font-mono font-bold text-slate-900 text-[11px]">{graph.stagedMaterialOrAmount}</p>
                        </td>
                        <td className="p-2.5 border border-slate-200 max-w-sm">
                          <div className="bg-slate-50 border p-2 font-mono text-[10px] text-slate-600 whitespace-pre-wrap max-h-[90px] overflow-y-auto leading-normal">
                            {graph.calculatedAuditLog}
                          </div>
                        </td>
                        <td className="p-2.5 border border-slate-200 text-right shrink-0 min-w-[160px]">
                          <div className="flex gap-2 justify-end items-center h-full pt-1">
                            <button
                              type="button"
                              disabled={approvingThreadId !== null}
                              onClick={() => handleResolveHumanDecision(graph.threadId, 'Reject')}
                              className="bg-white hover:bg-rose-50 text-rose-600 border-2 border-rose-600 font-black text-[10px] px-3 py-1.5 uppercase cursor-pointer transition select-none disabled:opacity-40"
                            >
                              ❌ Reject
                            </button>
                            <button
                              type="button"
                              disabled={approvingThreadId !== null}
                              onClick={() => handleResolveHumanDecision(graph.threadId, 'Approve')}
                              className="bg-emerald-600 hover:bg-emerald-500 text-white border-2 border-emerald-700 font-black text-[10px] px-3 py-1.5 uppercase cursor-pointer transition shadow-sm select-none disabled:opacity-40"
                            >
                              {approvingThreadId === graph.threadId ? 'Unlocking...' : '🟢 Authorize'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
};
