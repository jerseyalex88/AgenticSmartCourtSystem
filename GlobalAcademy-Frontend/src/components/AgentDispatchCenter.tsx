import React, { useState, useEffect } from 'react';
import { apiClient } from '../api/apiClient';

interface DispatchOffer {
  queueId: string;
  playerName: string;
  originalCourtName: string;
  proposedCourtName: string;
  proposedBranchName: string;
  proposedTime: string;
  phoneNumber: string;
  status: 'AwaitingReply' | 'Confirmed' | 'Refunded';
}

export default function AgentDispatchCenter() {
  const [offers, setOffers] = useState<DispatchOffer[]>([]);
  const [loading, setLoading] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [smsInput, setSmsInput] = useState<{ [key: string]: string }>({});

  // SYNC STREAM: Pull live active outbound dispatch contracts from the multi-tenant partition
  const fetchActiveDispatches = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get<DispatchOffer[]>('/auth/ai/match-saver/active-dispatches');
      setOffers(res.data);
    } catch (err) {
      console.error('Failed to resolve active dispatch stream.', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActiveDispatches();
  }, []);

  // SIMULATOR TRIGGER: Fake an environmental rain-out event 30 minutes before play
  const triggerRainCancellationSimulator = async () => {
    setSimulating(true);
    try {
      await apiClient.post('/auth/ai/match-saver/simulate-rain-out');
      await fetchActiveDispatches();
    } catch (err) {
      alert('Simulation event failed to broadcast.');
    } finally {
      setSimulating(false);
    }
  };

  // WEBHOOK WORKFLOW ROUTER: Emulate a natural language SMS reply from a player's phone
  const submitSmsReplyBypass = async (phoneNumber: string, textCommand: string) => {
    try {
      const res = await apiClient.post('/auth/ai/match-saver/sms-webhook', {
        fromNumber: phoneNumber,
        body: textCommand
      });
      alert(`💬 Network Operator Outbound Response:\n\n"${res.data.reply}"`);
      await fetchActiveDispatches(); // Sync mutated database fields instantly
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl font-mono text-xs text-slate-300">
      
      {/* SECTION BANNER TEMPLATE */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 border-b border-slate-800 pb-4 gap-4">
        <div>
          <h2 className="text-sm font-black text-slate-100 uppercase tracking-wider">⚡ Autonomous AI Dispatch Command Hub</h2>
          <p className="text-slate-400 mt-1">Reactive match-saving agent executing real-time spatial rerouting and SMS negotiation hooks [2].</p>
        </div>
        
        <button
          onClick={triggerRainCancellationSimulator}
          disabled={simulating}
          className={`px-4 py-2 rounded-lg font-bold uppercase tracking-wider transition ${
            simulating ? 'bg-slate-800 text-slate-600 cursor-not-allowed' : 'bg-rose-950 text-rose-400 border border-rose-800 hover:bg-rose-900/40'
          }`}
        >
          {simulating ? 'Simulating Weather Outage...' : '🌧️ Trigger 30-Min Rain-Out Event'}
        </button>
      </div>

      {/* TWO-COLUMN GRID MANAGEMENT CANVAS */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
        
        {/* VIEW 1: ACTIVE LIVE COMMITTED AI TRAFFIC FLOWS (Takes 2 Columns) */}
        <div className="xl:col-span-2 bg-slate-950 border border-slate-800 rounded-xl overflow-hidden">
          <div className="p-3 bg-slate-900 border-b border-slate-800 text-slate-400 font-bold uppercase tracking-widest text-[10px]">
            Live Dispatch Relocation Pipeline Monitor ({offers.length})
          </div>

          {loading ? (
            <div className="p-8 text-center text-slate-600 animate-pulse">Scanning infrastructure data matrices...</div>
          ) : offers.length === 0 ? (
            <div className="p-12 text-center text-slate-600 italic">
              No weather dispatch procedures are currently running. Press the rain simulator button to launch an autonomous agent cycle! [2]
            </div>
          ) : (
            <div className="divide-y divide-slate-800">
              {offers.map((offer) => (
                <div key={offer.queueId} className="p-4 hover:bg-slate-900/30 transition flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-black text-slate-200 text-sm">{offer.playerName}</span>
                      <span className="text-[10px] text-slate-500">{offer.phoneNumber}</span>
                    </div>
                    <div className="mt-1 text-slate-400 leading-relaxed">
                      ❌ Rained out on <span className="text-rose-400 font-bold">{offer.originalCourtName}</span> <br/>
                      🤖 AI Solution: <span className="text-emerald-400 font-bold">{offer.proposedCourtName}</span> at <span className="text-slate-300 font-bold">{offer.proposedBranchName}</span> ({offer.proposedTime}) [2]
                    </div>
                  </div>

                  <div className="flex items-center gap-3 self-end sm:self-auto">
                    <span className={`px-2 py-1 rounded text-[9px] font-black uppercase ${
                      offer.status === 'Confirmed' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' :
                      offer.status === 'Refunded' ? 'bg-slate-800 text-slate-400 border border-slate-700' :
                      'bg-amber-950 text-amber-400 border border-amber-800 animate-pulse'
                    }`}>
                      {offer.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* VIEW 2: INTERACTIVE PLAYER PHONE SIMULATION GRID (Takes 1 Column) */}
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
          <div className="text-amber-400 font-bold uppercase tracking-wider mb-3 border-b border-slate-800 pb-2 text-[10px]">
            📱 Player Smartphone Simulator Sandbox
          </div>

          {offers.filter(o => o.status === 'AwaitingReply').length === 0 ? (
            <div className="text-center text-slate-600 italic py-6">No players currently sitting in interactive negotiation chat stages [2].</div>
          ) : (
            <div className="space-y-4">
              {offers.filter(o => o.status === 'AwaitingReply').map(offer => (
                <div key={offer.queueId} className="bg-slate-900 border border-slate-800 p-3 rounded-lg">
                  <div className="font-bold text-slate-300 mb-1">Device Profile: {offer.playerName}</div>
                  
                  {/* AI CONVERSATION PAYLOAD SCREEN PREVIEW */}
                  <div className="bg-slate-950 p-2 rounded text-[11px] text-slate-400 border border-slate-800 mb-3 font-sans">
                    <span className="text-emerald-500 font-bold">🤖 Match-Saver:</span> "Hey {offer.playerName.split(' ')[0]}, your court is rained out. I have reserved {offer.proposedCourtName} at our {offer.proposedBranchName} for you instead. Reply <span className="text-slate-200 font-bold font-mono">YES</span> to confirm, or <span className="text-slate-200 font-bold font-mono">REFUND</span> to clear your balance [2]."
                  </div>

                  {/* NATURAL LANGUAGE SIMULATION CHAT ACTIONS */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => submitSmsReplyBypass(offer.phoneNumber, 'YES')}
                      className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-1 px-2 rounded uppercase text-[10px] tracking-widest transition"
                    >
                      👍 Send 'YES'
                    </button>
                    <button
                      onClick={() => submitSmsReplyBypass(offer.phoneNumber, 'REFUND')}
                      className="flex-1 bg-slate-800 hover:bg-slate-700 text-rose-400 font-bold py-1 px-2 rounded uppercase text-[10px] tracking-widest transition border border-slate-700"
                    >
                      💵 Send 'REFUND'
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
