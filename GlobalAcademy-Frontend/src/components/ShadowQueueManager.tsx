import React, { useState, useEffect } from 'react';
import { apiClient } from '../api/apiClient';

interface ShadowQueueItem {
  id: string;
  playerName: string;
  preferredWindow: string;
  isResolved: boolean;
}

export default function ShadowQueueManager() {
  const [queue, setQueue] = useState<ShadowQueueItem[]>([]);
  const [report, setReport] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [seedMessage, setSeedMessage] = useState<string | null>(null);

  // FETCH: Sync with the multi-tenant backend partition entries
  const fetchShadowQueue = async () => {
    setLoading(true);
    try {
      // Endpoint mapping handled securely within active academy cookies/headers
      const response = await apiClient.get<ShadowQueueItem[]>('/aiorchestration/ai/match-saver/queue-list');
      setQueue(response.data);
    } catch (err) {
      console.error('Failed to parse standby data stream.', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchShadowQueue();
  }, []);

  // TRIGGER 1: POPULATE DISPLACED MOCK DATA MATRIX
  const executeTestDataSeeder = async () => {
    setSeeding(true);
    setSeedMessage(null);
    try {
      const response = await apiClient.post<{ message: string }>('/aiorchestration/ai/match-saver/seed-test-data');
      setSeedMessage(response.data.message);
      await fetchShadowQueue(); // Instantly refresh data matrix
    } catch (err: any) {
      setSeedMessage(`Seeding Error: ${err.response?.data || err.message}`);
    } finally {
      setSeeding(false);
    }
  };

  // TRIGGER 2: EXECUTE AUTONOMOUS SUBAGENT AGENT
  const executeAiOptimizer = async () => {
    setRunning(true);
    setReport(null);
    try {
      const response = await apiClient.post<{ report: string }>('/aiorchestration/ai/match-saver/run');
      setReport(response.data.report);
      await fetchShadowQueue(); // Sync database changes to view grid
    } catch (err: any) {
      setReport(`Execution Failure: ${err.response?.data || err.message}`);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-6 text-sans">
      <div>
        <h2 className="text-xl font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight">🔄 Displaced Player Shadow Queue Matrix</h2>
        <p className="text-xs text-slate-500 mt-1 font-mono">Live academy standby tracking pipeline optimized by autonomous gpt-5.4-mini subagents.</p>
      </div>
    <div className="p-6 bg-white border border-slate-300 shadow-xl font-sans text-xs text-slate-800">
      
      {/* HEADER CONTROLS COMPONENT */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 border-b border-slate-300 pb-4 gap-4">
        {/* <div>
          <h2 className="text-sm font-black text-slate-100 uppercase tracking-wider">🔄 Displaced Player Shadow Queue Matrix</h2>
          <p className="text-slate-400 mt-1">Live academy standby tracking pipeline optimized by autonomous gpt-5.4-mini subagents.</p>
        </div> */}
        
        <div className="flex items-center gap-2 self-end md:self-auto">
          <button
            onClick={executeTestDataSeeder}
            disabled={seeding || running}
            className={`px-3 py-2 font-bold uppercase tracking-wider transition text-[10px] ${
              seeding ? 'bg-slate-200 text-slate-600 cursor-not-allowed' : 'bg-slate-200 hover:bg-slate-300 text-slate-700 border border-slate-300'
            }`}
          >
            {seeding ? 'Injecting Mock Rows...' : '🧪 Seed Tenant Sandbox Data'}
          </button>

          <button
            onClick={executeAiOptimizer}
            disabled={running || seeding}
            className={`px-4 py-2 font-bold uppercase tracking-wider transition ${
              running ? 'bg-slate-200 text-slate-600 cursor-not-allowed' : 'bg-purple-600 hover:bg-purple-500 text-white'
            }`}
          >
            {running ? 'Running Agent Loop...' : '⚡ Launch AI Match-Saver'}
          </button>
        </div>
      </div>

      {seedMessage && (
        <div className="mb-4 p-2 bg-amber-100 border border-amber-300 text-amber-600 text-[10px]">
          ℹ️ [Data Engine Status]: {seedMessage}
        </div>
      )}

      {/* DASHBOARD WORKSPACE MAIN GRID SPLIT */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        
        {/* LIVE QUEUE STANDBY GRID (Takes 2 columns) */}
        <div className="lg:col-span-2 bg-white border border-slate-300 overflow-hidden">
          <div className="p-3 bg-slate-100 border-b border-slate-300 text-slate-600 uppercase tracking-wider font-bold text-[10px]">
            Active Displaced Standby Roster ({queue.length})
          </div>
          
          {loading ? (
            <div className="p-8 text-center text-slate-600 animate-pulse">Syncing shadow register rows...</div>
          ) : queue.length === 0 ? (
            <div className="p-8 text-center text-slate-600 italic">No displaced players sitting in standby partition buffers.</div>
          ) : (
            <div className="divide-y divide-slate-200">
              {queue.map((item) => (
                <div key={item.id} className="p-3 flex items-center justify-between hover:bg-slate-100 transition">
                  <div>
                    <div className="font-bold text-slate-800">{item.playerName}</div>
                    <div className="text-[10px] text-slate-700 mt-0.5">Preference Window: {item.preferredWindow}</div>
                  </div>
                  <div>
                    <span className={`px-2 py-0.5 text-[9px] font-black uppercase ${
                      item.isResolved 
                        ? 'bg-emerald-100 text-emerald-600 border border-emerald-300' 
                        : 'bg-amber-100 text-amber-600 border border-amber-300'
                    }`}>
                      {item.isResolved ? '✅ Reallocated' : '⏳ Pending Rescue'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* AI LOG SUMMARY DRAWER PANEL (Takes 1 column) */}
        <div className="bg-white border border-slate-300 p-4 min-h-[200px]">
          <div className="text-emerald-600 font-bold uppercase tracking-wider mb-2 border-b border-slate-300 pb-2 text-[10px]">
            🤖 Subagent Operations Report
          </div>
          {report ? (
            <div className="text-slate-700 text-[11px] whitespace-pre-wrap leading-relaxed">
              {report}
            </div>
          ) : (
            <div className="text-slate-600 italic text-[11px] mt-4 text-center">
              Awaiting optimization launch request command event...
            </div>
          )}
        </div>

      </div>
    </div></div>
  );
}