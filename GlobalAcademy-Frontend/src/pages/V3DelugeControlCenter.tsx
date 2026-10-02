// =========================================================================
// FILE 5: INDOOR Flood CRISIS CONTROL DASHBOARD PANEL
// PATH: Frontend/src/pages/V3DelugeControlCenter.tsx
// DESCRIPTION: Displays real-time multi-agent footprints and approval gates
// =========================================================================

import React, { useState } from 'react';
import { apiClient } from '../api/apiClient';

export default function V3DelugeControlCenter() {
  // Target sandbox state monitoring configurations
  const [targetCourtId, setTargetCourtId] = useState<string>("3628a5d6-e221-4014-8ae1-b83bd2dd78fe");
  const [inputHumidity, setInputHumidity] = useState<number>(72.0);
  
  // Graph engine feedback parameters tracking state strings
  const [conversationalResponse, setConversationalResponse] = useState<string>("");
  const [graphStatus, setGraphStatus] = useState<string>("Idle");
  const [activeThreadId, setActiveThreadId] = useState<string>("");
  const [activeCheckpointId, setActiveCheckpointId] = useState<string>("");
  
  // Footprints array matrices tracking variables
  const [footprints, setFootprints] = useState<any[]>([]);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>("");

  // =========================================================================
  // 📡 ACTION A: DISPATCH INITIAL SENSOR TELEMETRY CEILING ALARM
  // =========================================================================
  const handleTriggerSensorBreach = async () => {
    setIsProcessing(true);
    setErrorMessage("");
    setConversationalResponse("");
    setFootprints([]);
    
    try {
      const payload = { court_id: targetCourtId, humidity_value: inputHumidity };
      console.log("📡 [FRONTEND DISPATCH]: Launching telemetry breach trigger payload to C# Gateway...");
      
      const res = await apiClient.post('/v3/deluge-orchestration/universal-deluge-alert', payload);
      
      setConversationalResponse(res.data.final_response);
      setGraphStatus(res.data.execution_status);
      
      if (res.data.thread_id) setActiveThreadId(res.data.thread_id);
      if (res.data.checkpoint_id) setActiveCheckpointId(res.data.checkpoint_id);

      // Instantly run a background lookup to draw the compiled database footprints on page panel
      if (res.data.thread_id) {
        await refreshSwarmFootprints(res.data.thread_id);
      }
    } catch (err: any) {
      setErrorMessage(err?.message || "Failed to establish a clear inter-container API handshake connection.");
    } finally {
      setIsProcessing(false);
    }
  };

  // =========================================================================
  // 📡 ACTION B: DISPATCH HARNESS MANUAL APPROVAL UNFREEZE OVERRIDE
  // =========================================================================
  const handleExecuteHarnessRelease = async () => {
    setIsProcessing(true);
    setErrorMessage("");
    
    try {
      const payload = { thread_id: activeThreadId, checkpoint_id: activeCheckpointId };
      console.log(`🔐 [HARNESS RELEASE UNFREEZE]: Unlocking Thread ${activeThreadId} from Checkpoint ${activeCheckpointId}`);
      
      const res = await apiClient.post('/v3/deluge-orchestration/execute-harness-override', payload);
      
      setConversationalResponse(res.data.final_response);
      setGraphStatus(res.data.execution_status);

      // Re-trigger an audit lookup to display all final worker paths (D, E, F) that ran after unfreezing
      await refreshSwarmFootprints(activeThreadId);
    } catch (err: any) {
      setErrorMessage(err?.message || "Harness execution override handshake rejected on gateway server.");
    } finally {
      setIsProcessing(false);
    }
  };

  // =========================================================================
  // 🔍 DATA EXTRACTION: READ TIMELINE FOOTPRINTS FROM POSTGRES TABLE
  // =========================================================================
  const refreshSwarmFootprints = async (threadId: string) => {
    try {
      const res = await apiClient.get(`/v3/swarm-orchestration/threads/${threadId}/footprints`);
      setFootprints(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.warn("⚠️ Snapshot logs trail empty or database thread row not synced yet:", err);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 font-sans antialiased">
      <div className="max-w-5xl mx-auto space-y-6">
        
        {/* HEADER BRAND BLOCK SECTION */}
        <div className="border-b border-slate-800 pb-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              🎾 Smart Court OS <span className="text-emerald-400 font-mono text-sm px-2 py-0.5 bg-emerald-950/50 rounded border border-emerald-800/30">V3 Swarm Engine</span>
            </h1>
            <p className="text-xs text-slate-400 mt-1">Scenario Center: Continuous Indoor Flood Operational Weather Framework Grid</p>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-400 font-mono">Pipeline Status:</span>
            <span className={`px-2 py-0.5 rounded font-bold font-mono text-[11px] border ${
              graphStatus === 'Processing' ? 'bg-amber-950 text-amber-400 border-amber-800' :
              graphStatus === 'Paused_Pending_Approval' ? 'bg-rose-950 text-rose-400 border-rose-800 animate-pulse' :
              graphStatus === 'Complete' ? 'bg-emerald-950 text-emerald-400 border-emerald-800' : 'bg-slate-900 text-slate-400 border-slate-700'
            }`}>{graphStatus.toUpperCase()}</span>
          </div>
        </div>

        {/* ERROR DISPATCH CAPTURE FRAME */}
        {errorMessage && (
          <div className="p-3 bg-rose-950/40 border border-rose-800/40 rounded text-rose-400 text-xs font-mono">
            ⚠️ <strong>System Exception Fault:</strong> {errorMessage}
          </div>
        )}

        {/* TWO-COLUMN GRID CONTROLS LAYOUT */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* COLUMN 1: TELEMETRY ALARM INGESTION SIMULATOR CARD */}
          <div className="md:col-span-1 p-4 bg-slate-900 rounded-lg border border-slate-800 space-y-4 shadow-xl">
            <h2 className="text-sm font-bold text-slate-200 border-b border-slate-800 pb-2 flex items-center gap-2">
              🚨 Live Telemetry Simulator Panel
            </h2>
            
            <div className="space-y-1">
              <label className="text-[11px] font-mono text-slate-400 block">Target Court GUID Identifier</label>
              <input type="text" value={targetCourtId} onChange={(e) => setTargetCourtId(e.target.value)} 
                     className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs font-mono focus:border-emerald-500 focus:outline-none text-slate-300" />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <label className="text-[11px] font-mono text-slate-400 block">Sustained Indoor Humidity Level</label>
                <span className={`text-xs font-bold font-mono ${inputHumidity >= 65 ? 'text-rose-400' : 'text-emerald-400'}`}>{inputHumidity}%</span>
              </div>
              <input type="range" min="40" max="90" step="0.5" value={inputHumidity} onChange={(e) => setInputHumidity(parseFloat(e.target.value))}
                     className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500" />
              <span className="text-[10px] text-slate-500 block leading-tight">Breach guardrails trigger automatically at or above 65.0% ceiling thresholds.</span>
            </div>

            <button onClick={handleTriggerSensorBreach} disabled={isProcessing}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-semibold text-xs py-2 px-4 rounded shadow transition-all duration-150">
              {isProcessing ? "Processing Graph Tracks..." : "Simulate 72% Humidity Surge"}
            </button>
          </div>

          {/* COLUMN 2: CONVERSATIONAL DISPLAY TERMINAL MONITOR AREA */}
          <div className="md:col-span-2 flex flex-col p-4 bg-slate-900 rounded-lg border border-slate-800 shadow-xl min-h-[250px]">
            <h2 className="text-sm font-bold text-slate-200 border-b border-slate-800 pb-2 flex items-center gap-2 mb-3">
              💬 Conversational OS Terminal Output
            </h2>
            <div className="flex-1 bg-slate-950 border border-slate-800 rounded p-3 font-sans text-xs text-slate-300 leading-relaxed overflow-y-auto max-h-64 whitespace-pre-wrap">
              {conversationalResponse || <span className="text-slate-600 italic">Awaiting critical telemetry surge data vectors to initialize multi-agent evaluation tracks...</span>}
            </div>

            {/* ⏳ HARNESS ENGINEERING LAYER HUMAN APPROVAL GATED BANNER CARD */}
            {graphStatus === 'Paused_Pending_Approval' && (
              <div className="mt-4 p-3 bg-rose-950/40 border border-rose-900/50 rounded-lg flex flex-col sm:flex-start sm:flex-row sm:items-center justify-between gap-3 shadow-inner animate-pulse">
                <div className="space-y-0.5">
                  <h4 className="text-xs font-bold text-rose-400 flex items-center gap-1.5">
                    🛡️ Harness Circuit Breaker Intercept Locked
                  </h4>
                  <p className="text-[11px] text-slate-300 font-sans">Pending Action: Authorize \$180.00 Player Refund due to Environmental Humidity Lockout.</p>
                </div>
                <button onClick={handleExecuteHarnessRelease} disabled={isProcessing}
                        className="bg-rose-600 hover:bg-rose-500 text-white font-bold font-mono text-[11px] py-1.5 px-3 rounded shadow-md border border-rose-500 transition-all duration-150">
                  {isProcessing ? "Releasing Locks..." : "Authorize \$180.00 Refund"}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* DB SNAPSHOT AUDIT TIMELINE TRACKER FOOTPRINTS PANEL */}
        {footprints.length > 0 && (
          <div className="p-4 bg-slate-900 border border-slate-800 rounded-lg shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h3 className="text-sm font-bold text-emerald-400 flex items-center gap-2">
                🧬 Live Swarm Multi-Agent Footprints Audit Trail (PostgreSQL Sync)
              </h3>
              <span className="text-xs text-slate-500 font-mono">Incident Steps Saved: {footprints.length}</span>
            </div>
            
            <div className="space-y-3 max-h-72 overflow-y-auto pr-2 font-mono text-xs">
              {footprints.map((step: any, idx: number) => {
                const nodeName = step.activeNode || step.ActiveNode || "v3_deluge_supervisor_coordinator_node";
                const checkpointGuid = step.checkpointId || step.CheckpointId || "";
                const loopCount = step.loopIterationCount ?? step.LoopIterationCount ?? 0;
                const timestamp = step.createdAtUtc || step.CreatedAtUtc;
                const rawJsonString = step.serializedState || step.SerializedState;
                
                let cleanStepExcerpt = "Evaluating multi-agent framework microservice state parameters.";

                if (rawJsonString) {
                  try {
                    const parsedState = typeof rawJsonString === 'string' ? JSON.parse(rawJsonString) : rawJsonString;
                    const messagesArray = parsedState?.checkpoint?.channel_values?.messages;
                    
                    if (Array.isArray(messagesArray) && messagesArray.length > 0) {
                      const lastMessage = messagesArray[messagesArray.length - 1];
                      const contentText = lastMessage?.kwargs?.content || lastMessage?.content;
                      if (contentText && typeof contentText === 'string') {
                        cleanStepExcerpt = contentText.length > 125 ? `${contentText.substring(0, 125)}...` : contentText;
                      }
                    }
                  } catch (parseError) {
                    if (typeof rawJsonString === 'string' && rawJsonString.toLowerCase().includes("policy")) {
                      cleanStepExcerpt = "Evaluating policy rules and facilities limits.";
                    }
                  }
                }
                return (
                  <div key={checkpointGuid || idx} className="flex items-start gap-4 p-2.5 bg-slate-950 rounded border border-slate-800 hover:border-slate-700 transition-all">
                    <div className="bg-slate-900 px-2 py-1 rounded text-slate-500 text-center font-bold text-[10px] min-w-[28px] border border-slate-800">
                      #{idx}
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className={`font-bold text-xs ${nodeName.toLowerCase().includes('supervisor') ? 'text-amber-400' : 'text-cyan-400'}`}>
                          {nodeName}
                        </span>
                        <span className="text-[10px] text-slate-500 font-sans">
                          {timestamp ? new Date(timestamp).toLocaleTimeString() : "00:00:00 AM"}
                        </span>
                      </div>
                      
                      <div className="text-[10px] text-slate-500 flex gap-4">
                        <span>🔄 Step Token: <strong className="text-slate-400">{loopCount}</strong></span>
                        <span>🔑 Checkpoint ID: <strong className="text-slate-400">{checkpointGuid ? checkpointGuid.substring(0, 8) : "--------"}...</strong></span>
                      </div>

                      <div className="text-[11px] text-slate-300 mt-2 bg-slate-900/60 p-2 rounded font-sans border border-slate-800/60 leading-relaxed max-w-full break-words">
                        💬 <strong className="text-emerald-500">Step Data Shard:</strong> {cleanStepExcerpt}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
