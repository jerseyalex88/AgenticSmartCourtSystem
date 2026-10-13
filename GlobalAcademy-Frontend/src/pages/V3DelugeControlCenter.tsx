// =========================================================================
// FILE 5: INDOOR Flood CRISIS CONTROL DASHBOARD PANEL
// PATH: Frontend/src/pages/V3DelugeControlCenter.tsx
// DESCRIPTION: Displays real-time multi-agent footprints and approval gates
// =========================================================================

import React, { useState } from 'react';
import { apiClient } from '../api/apiClient';

export default function V3DelugeControlCenter() {
  // Target sandbox state monitoring configurations
  const [targetCourtId, setTargetCourtId] = useState<string>("51a6e84f-1678-4f70-bb5d-b03345c3dd47");
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
    <div className="w-full max-w-[100vw] h-screen space-y-3 font-sans p-4 bg-slate-50 text-slate-800 flex flex-col overflow-hidden">
      
      {/* GLOBAL BANNER VIEW ROW */}
      <div className="w-full shrink-0">
        <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
          📡Core AI Enterprise Operations & Diagnostic Lab
        </h2>
        <p className="text-xs text-slate-500 mt-1 font-mono">
          Multi-tenant vector infrastructure command matrix. Environmental anomaly monitoring, multi-agent pipeline logs, and lock-out auditing.
        </p>
      </div>

      {/* MASTER STATUS METRIC CORRIDOR ROW */}
      <div className="flex border border-slate-300 bg-white p-2 rounded-none shadow-sm items-center justify-between gap-1 text-[10px] font-black uppercase tracking-wider font-mono shrink-0 mt-2">
        <div className="flex items-center gap-2">
          <span className="text-slate-500">Pipeline Monitoring Status:</span>
          <span className={`px-2.5 py-1 text-[10px] font-black tracking-wider uppercase border rounded-none ${
            graphStatus === 'Processing' ? 'bg-amber-50 border-amber-300 text-amber-700' :
            graphStatus === 'Paused_Pending_Approval' ? 'bg-purple-50 border-purple-400 text-purple-700 animate-pulse' :
            graphStatus === 'Complete' ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'bg-slate-100 border-slate-300 text-slate-600'
          }`}>
            {graphStatus === 'Paused_Pending_Approval' ? '⚠️ PAUSED_PENDING_APPROVAL' : graphStatus.toUpperCase()}
          </span>
        </div>
        <div className="text-slate-400 text-[9px]">ENGINE GENERATION RUNTIME CHANNEL</div>
      </div>

      {/* THREE-COLUMN SCENARIO BODY EXECUTION SPACE GRID */}
      <div className="w-full flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-3 gap-4 items-stretch mt-2 overflow-hidden">
        {/* SUB PANEL A: INPUT AND TELEMETRY CONTROL CONTROLLER (1/3 Width) */}
        <div className="border border-slate-300 bg-white shadow-md p-4 rounded-none flex flex-col min-h-0 space-y-4">
          <div className="border-b border-slate-200 pb-2 flex justify-between items-center shrink-0">
            <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-700">
              📥Telemetry Simulation Console
            </h4>
            <span className="font-mono text-[8px] text-slate-400">SENSOR BINARY STREAM</span>
          </div>

          <div className="space-y-4 text-xs flex-1 overflow-y-auto pr-1">
            <div>
              <label className="block text-slate-500 font-bold mb-1.5 uppercase tracking-wide text-[9px] font-mono">
                Active Target Facility Asset Isolation Link:
              </label>
              <input 
                type="text" 
                value={targetCourtId} 
                onChange={(e) => setTargetCourtId(e.target.value)} 
                className="w-full bg-slate-50 border border-slate-300 rounded-none px-3 py-2 focus:border-purple-600 focus:outline-none text-slate-800 font-mono font-medium text-xs" 
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-slate-500 font-bold uppercase tracking-wide text-[9px] font-mono">
                  Sustained Indoor Humidity Level:
                </label>
                <span className={`font-mono font-black text-xs ${inputHumidity >= 65 ? 'text-amber-600' : 'text-emerald-600'}`}>
                  {inputHumidity.toFixed(1)}%
                </span>
              </div>
              <input 
                type="range" 
                min="40" 
                max="90" 
                step="0.5" 
                value={inputHumidity} 
                onChange={(e) => setInputHumidity(parseFloat(e.target.value))}
                className="w-full h-1 bg-slate-200 rounded-none cursor-pointer accent-purple-600" 
              />
              <p className="text-[9px] text-slate-400 mt-1 font-sans italic">
                Critical environmental lockout procedures auto-initialize at or above a 65.0% reading index.
              </p>
            </div>
          </div>

          <button
            onClick={handleTriggerSensorBreach}
            disabled={isProcessing}
            className="w-full bg-slate-900 hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400 text-white font-black px-6 py-3 text-[10px] tracking-wider transition uppercase rounded-none border border-slate-950 shadow shadow-slate-400/40 shrink-0"
          >
            {isProcessing ? '🧬Sharding and Vectorizing State blocks...' : '🚀Process Sensor Package'}
          </button>
        </div>
        {/* SUB PANEL B: CONVERSATIONAL CORE TERMINAL & APPROVAL INTERCEPT (2/3 Width) */}
        <div className="lg:col-span-2 border border-slate-300 bg-white shadow-md p-4 rounded-none flex flex-col min-h-0">
          <div className="border-b border-slate-200 pb-2 mb-3 flex justify-between items-center shrink-0">
            <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-700">
              Extracted Swarm Text Outputs Reconstitution Terminal
            </h4>
            <span className="font-mono text-[8px] text-slate-400">OUTPUT SHARDS</span>
          </div>

          {/* TERMINAL CONTENT SCREEN CONTAINER */}
          <div className="flex-1 bg-slate-50 border border-slate-200 p-4 overflow-y-auto text-xs leading-relaxed mb-4">
            {conversationalResponse ? (
              <div className="bg-white border border-slate-200 p-4 shadow-sm rounded-none text-slate-800 font-medium whitespace-pre-wrap">
                {conversationalResponse}
              </div>
            ) : (
              <div className="text-center py-24 text-slate-400 italic text-[11px] font-mono flex flex-col items-center justify-center gap-1">
                <span>Awaiting critical real-time sensory data inputs to initiate trace pipelines...</span>
                <span className="text-[9px] text-slate-300">SYSTEM RUNNING AUTONOMOUS ORC PRE-FLIGHTS</span>
              </div>
            )}
          </div>

          {/* 🛡️ ASYNCHRONOUS HUMAN-IN-THE-LOOP INTERCEPT PANEL */}
          {graphStatus === 'Paused_Pending_Approval' && (
            <div className="w-full mt-2 shrink-0 border border-slate-300 bg-white shadow-sm p-4 rounded-none animate-fadeIn">
              <div className="border-b border-slate-200 pb-2.5 mb-3 flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-tight flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                    👥Asynchronous Human-in-the-Loop Intercept Panel
                  </h3>
                  <p className="text-[10px] text-slate-500 font-mono mt-0.5 uppercase tracking-wide">
                    Review and authorize high-impact multi-agent financial ledger movements or asset locks
                  </p>
                </div>
                <span className="text-[9px] font-mono font-bold bg-purple-50 border border-purple-300 px-2 py-0.5 uppercase text-purple-700">
                  Queue Count: 1
                </span>
              </div>

              <div className="overflow-x-auto bg-slate-50 border border-slate-200 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1 font-mono text-[11px]">
                  <div>📌 <span className="font-bold text-slate-700">Staged AI Operation:</span> <span className="text-purple-700 font-black uppercase text-[9px] bg-purple-50 border border-purple-200 px-1 py-0.25">💸Payment Reversal</span></div>
                  <div className="text-slate-600">🛡️ <span className="font-bold">Harness Circuit:</span> Pending Action: Authorize $180.00 Player Refund due to Humidity Lockout.</div>
                </div>
                <div className="flex gap-2 justify-end items-center shrink-0">
                  <button
                    type="button"
                    disabled={isProcessing}
                    onClick={() => setGraphStatus("Idle")}
                    className="bg-white hover:bg-rose-50 text-rose-600 border-2 border-rose-600 font-black text-[10px] px-3 py-1.5 uppercase rounded-none transition cursor-pointer select-none"
                  >
                    ❌Reject
                  </button>
                  <button
                    type="button"
                    disabled={isProcessing}
                    onClick={handleExecuteHarnessRelease}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white border-2 border-emerald-700 font-black text-[10px] px-4 py-1.5 uppercase rounded-none transition cursor-pointer select-none"
                  >
                    {isProcessing ? 'Releasing...' : '🟢Approve & Release'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div> {/* Closes the layout grid */}
      {/* DYNAMIC RETRACTED TIMELINE SHARDS LEDGER FOOTPRINTS */}
      {footprints && footprints.length > 0 && (
        <div className="w-full border border-slate-300 bg-white shadow-md p-4 rounded-none min-h-0 flex flex-col mt-3 animate-fadeIn">
          <div className="border-b border-slate-200 pb-2 mb-3 flex justify-between items-center shrink-0">
            <h3 className="text-[10px] font-black uppercase tracking-wider text-slate-700">
              🔬Advanced Telemetry Verification & Operational Footprints Audit Trail
            </h3>
            <span className="font-mono text-[8px] text-slate-400">REALTIME POSTGRESQL SYNC LOGS</span>
          </div>

          <div className="space-y-2 max-h-48 overflow-y-auto pr-1 text-xs font-mono">
            {footprints.map((step: any, idx: number) => {
              const nodeName = step.activeNode || step.ActiveNode || "v3_deluge_supervisor_coordinator_node";
              const checkpointGuid = step.checkpointId || step.CheckpointId || "";
              const loopCount = step.loopIterationCount ?? step.LoopIterationCount ?? 0;
              const timestamp = step.createdAtUtc || step.CreatedAtUtc;
              const rawJsonString = step.serializedState || step.SerializedState;
              
              let cleanStepExcerpt = "Evaluating multi-agent framework runtime vector state parameters.";

              if (rawJsonString) {
                try {
                  const parsedState = typeof rawJsonString === 'string' ? JSON.parse(rawJsonString) : rawJsonString;
                  const messagesArray = parsedState?.checkpoint?.channel_values?.messages;
                  if (Array.isArray(messagesArray) && messagesArray.length > 0) {
                    const lastMessage = messagesArray[messagesArray.length - 1];
                    const contentText = lastMessage?.kwargs?.content || lastMessage?.content;
                    if (contentText && typeof contentText === 'string') {
                      cleanStepExcerpt = contentText;
                    }
                  }
                } catch (e) {}
              }

              return (
                <div key={checkpointGuid || idx} className="p-3 bg-white border border-slate-200 shadow-sm rounded-none text-slate-700 hover:border-slate-400 transition-all">
                  <div className="flex justify-between items-center text-[9px] text-purple-700 font-mono font-black mb-1.5 border-b border-slate-100 pb-1">
                    <span>📄STEP INDEX #{idx} —— LOCATION HOOK: {nodeName}</span>
                    <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-none border border-slate-200 uppercase font-black text-[8px]">
                      Loop iteration: {loopCount} | Snap: {checkpointGuid.substring(0,8)}
                    </span>
                  </div>
                  <p className="text-slate-600 italic font-medium leading-relaxed font-sans">
                    "{cleanStepExcerpt}"
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div> // Final closing layout division
  );

}
