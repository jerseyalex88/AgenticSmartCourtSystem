import React, { useState, useEffect } from 'react';
import { apiClient } from '../api/apiClient';

// --- TYPE-SAFE TYPES & INTERFACES MATCHING .NET DTOS ---
interface DiagnosticsMetrics {
  surface_friction_index: number;
  bounce_uniformity_percentage: number;
  net_tension_newtons: number;
  ambient_temperature_celsius: number;
  humidity_percentage: number;
}

interface DiagnosticsAnomaly {
  anomaly_id: string;
  severity: 'Info' | 'Low' | 'Medium' | 'High' | 'Critical';
  category: string;
  description: string;
  confidence_score: number;
  recommended_action: string;
}

interface DiagnosticSnapshot {
  session_id: string;
  court_id: string;
  court_name: string;
  branch_name: string; 
  academy_id: string;
  branch_id: string;
  timestamp: string;
  metrics: DiagnosticsMetrics;
  anomalies: DiagnosticsAnomaly[];
  agent_version: string;
}

export default function CourtDiagnosticsDashboard() {
  const [snapshots, setSnapshots] = useState<DiagnosticSnapshot[]>([]);
  const [selectedCourtId, setSelectedCourtId] = useState<string>('01b9ed79-3597-4bbd-9a1b-f880d04ca6ac'); // Target Mock Guid
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const fetchDiagnosticHistory = async () => {
    setLoading(true);
    setStatusMessage(null);
    try {
      const response = await apiClient.get<any>('/maintenance/court-diagnostics-view');
      
      const rawData = response.data;
      // Guard check: Validate we received an iterable list format
      if (!rawData || !Array.isArray(rawData)) {
        console.warn("Expected an array payload but received alternative signature structure:", rawData);
        setSnapshots([]);
        return;
      }

      // Safe normalization array loop mapping
      const normalizedSnapshots: DiagnosticSnapshot[] = rawData.map((item: any) => {
        const directFriction = item.surfaceFrictionIndex ?? item.surface_friction_index;
        const directBounce = item.bounceUniformityPercentage ?? item.bounce_uniformity_percentage;
        const directTension = item.netTensionNewtons ?? item.net_tension_newtons;
        const directTemp = item.ambientTemperatureCelsius ?? item.ambient_temperature_celsius;
        const directHumidity = item.humidityPercentage ?? item.humidity_percentage;

        return {
          session_id: item.sessionId || item.session_id || '',
          court_id: item.courtId || item.court_id || '',
          court_name: item.courtName || item.court_name || 'Unknown Court',
          branch_name: item.branchName || item.branch_name || 'Unknown Branch',
          academy_id: item.academyId || item.academy_id || '',
          branch_id: item.branchId || item.branch_id || '',
          timestamp: item.timestamp || new Date().toISOString(),
          agent_version: item.agentVersion || item.agent_version || 'v1.0.0',
          
          metrics: {
            surface_friction_index: Number(directFriction ?? 0.80),
            bounce_uniformity_percentage: Number(directBounce ?? 95.0),
            net_tension_newtons: Number(directTension ?? 420.0),
            ambient_temperature_celsius: Number(directTemp ?? 22.0),
            humidity_percentage: Number(directHumidity ?? 50.0)
          },
          
          anomalies: Array.isArray(item.anomalies) ? item.anomalies.map((anom: any) => ({
            anomaly_id: anom.anomalyId || anom.anomaly_id || '',
            severity: anom.severity || 'Info',
            category: anom.category || 'General',
            description: anom.description || '',
            confidence_score: Number(anom.confidenceScore || anom.confidence_score || 0),
            recommended_action: anom.recommendedAction || anom.recommended_action || ''
          })) : []
        };
      });

      setSnapshots(normalizedSnapshots);
      
    } catch (err: any) {
      console.error('--- 🚨 BULK ARRAY DEBUG BLOCK 🚨 ---');
      console.error('Status:', err.response?.status);
      console.error('Full Error Object:', err);
      
      const localizedError = err.response?.data?.message || err.response?.data || err.message;
      setStatusMessage(`Error parsing logs: ${typeof localizedError === 'object' ? 'Collection Mapping Failure' : localizedError}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDiagnosticHistory();
  }, []);

  // --- TRIGGER 1: RUN EXPLICIT TELEMETRY CALCULATION ENGINE ---
  const handleAnalyzeCourt = async () => {
    setAnalyzing(true);
    setStatusMessage(null);
    try {
      // Calls the new .NET calculation orchestration gateway for a specific court
      const response = await apiClient.post<{ message: string }>(
        `/maintenance/court-diagnostics/calculate/${selectedCourtId}`
      );
      setStatusMessage(`⚡ [Engine Signal]: ${response.data.message || 'Analysis complete.'}`);
      await fetchDiagnosticHistory(); // Reload table grid matrix instantly
    } catch (err: any) {
      setStatusMessage(`Analysis Failure: ${err.response?.data || err.message}`);
    } finally {
      setAnalyzing(false);
    }
  };

  // --- TRIGGER 2: PURGE EXPIRED SNAPSHOT LOGS ---
  const handleDeleteSnapshot = async (sessionId: string) => {
    if (!window.confirm('Are you sure you want to permanently purge this court diagnostic snapshot?')) return;
    
    setLoading(true);
    setStatusMessage(null);
    try {
      await apiClient.delete(`/maintenance/court-diagnostics/${sessionId}`);
      setStatusMessage(`🗑️ Snapshot ${sessionId.substring(0, 8)} swept successfully.`);
      await fetchDiagnosticHistory(); // Automatically synchronize layouts
    } catch (err: any) {
      console.error('Purge error encountered:', err);
      setStatusMessage(`Purge Error: ${err.response?.data?.message || err.message}`);
      setLoading(false);
    }
  };

  // Helper token color engine for brutalist status frames
  const getSeverityStyles = (severity: string) => {
    switch (severity) {
      case 'Critical': return 'bg-red-100 border-red-400 text-red-700 animate-pulse font-black';
      case 'High': return 'bg-orange-100 border-orange-400 text-orange-700 font-bold';
      case 'Medium': return 'bg-amber-100 border-amber-400 text-amber-700';
      default: return 'bg-slate-100 border-slate-300 text-slate-600';
    }
  };

  return (
    <div className="space-y-6 text-sans p-4">
      {/* HEADER SECTION */}
      <div>
        <h2 className="text-xl font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight">
          📡 Structural Court Diagnostics Command Matrix
        </h2>
        <p className="text-xs text-slate-500 mt-1 font-mono">
          Real-time physical asset integrity tracking pipelines flowing across multi-tenant boundaries.
        </p>
      </div>

      {/* DASHBOARD BOX INTERFACE */}
      <div className="p-6 bg-white border border-slate-300 shadow-xl font-sans text-xs text-slate-800">
        
        {/* HEADER CONTROLS COMPONENT */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 border-b border-slate-300 pb-4 gap-4">
          <div className="flex items-center gap-2">
            <span className="font-bold uppercase tracking-wider text-slate-600 text-[10px]">Target Court:</span>
            <input
              type="text"
              value={selectedCourtId}
              onChange={(e) => setSelectedCourtId(e.target.value)}
              placeholder="Enter Court Guid..."
              className="px-2 py-1 font-mono text-[11px] border border-slate-300 w-64 bg-slate-50 focus:outline-none focus:border-purple-500"
            />
          </div>
          
          <div className="flex items-center gap-2 self-end md:self-auto">
            <button
              onClick={fetchDiagnosticHistory}
              disabled={loading || analyzing}
              className="px-3 py-2 font-bold uppercase tracking-wider transition text-[10px] bg-slate-200 hover:bg-slate-300 text-slate-700 border border-slate-300"
            >
              {loading ? 'Refreshing Grid...' : '🔄 Pull Live Metrics'}
            </button>

            <button
              onClick={handleAnalyzeCourt}
              disabled={analyzing || loading}
              className={`px-4 py-2 font-bold uppercase tracking-wider transition text-[10px] ${
                analyzing ? 'bg-slate-200 text-slate-600 cursor-not-allowed' : 'bg-purple-600 hover:bg-purple-500 text-white'
              }`}
            >
              {analyzing ? 'Processing Agent Edge Math...' : '⚡ Compute Active Diagnostics'}
            </button>
          </div>
        </div>

        {/* FEEDBACK STATUS CONTEXT STATUS BAR */}
        {statusMessage && (
          <div className="mb-4 p-2 bg-amber-100 border border-amber-300 text-amber-700 text-[10px] font-mono">
            ℹ️ [System Telemetry Output]: {statusMessage}
          </div>
        )}

        {/* LOADING PLACEHOLDER */}
        {loading && snapshots.length === 0 ? (
          <div className="py-12 text-center text-slate-400 font-mono tracking-widest uppercase">
            Loading active multi-tenant ledger profiles...
          </div>
        ) : snapshots.length === 0 ? (
          <div className="py-12 text-center text-slate-400 font-mono border border-dashed border-slate-200">
            No telemetry diagnostic signatures detected for this academy branch.
          </div>
        ) : (
          /* SNAPSHOT FEED GRID */
          <div className="space-y-6">
            {snapshots.map((snapshot) => (
              <div key={snapshot.session_id} className="border border-slate-300 bg-slate-50 p-4 shadow-sm">
                
                {/* SNAPSHOT TITLE SUB-BAR */}
                <div className="flex justify-between items-center border-b border-slate-200 pb-2 mb-3">
                <div>
                    <span className="font-black text-slate-800 uppercase tracking-tight text-sm mr-2">
                    🎾 {snapshot.court_name}
                    </span>
                    <span className="font-mono bg-purple-100 border border-purple-300 text-purple-700 px-1.5 py-0.5 text-[9px] mr-2 uppercase font-bold">
                    📍 {snapshot.branch_name}
                    </span>                    
                    <span className="font-mono text-slate-400 text-[9px]">
                    (ID: {snapshot.court_id.substring(0, 8)}... / Session: {snapshot.session_id.substring(0, 5)})
                    </span>
                </div>
                <div className="flex items-center gap-3 font-mono text-[10px] text-slate-500">
                    <span>🕒 {new Date(snapshot.timestamp).toLocaleString()}</span>
                    <span>🤖 Engine: {snapshot.agent_version}</span>
                    <button 
                    onClick={() => handleDeleteSnapshot(snapshot.session_id)}
                    className="text-red-600 hover:text-red-800 font-bold uppercase tracking-tighter"
                    >
                    [Purge]
                    </button>
                </div>
                </div>
                <div className="flex gap-2 mb-3 mt-1 text-[9px] uppercase font-mono tracking-tight text-slate-500">
                    <span className="bg-slate-200 px-1.5 py-0.5 border border-slate-300 font-bold">
                        🧱 Surface: {snapshot.anomalies[0]?.description.includes("Clay") ? "Clay" : snapshot.anomalies[0]?.description.includes("Grass") ? "Grass" : "Hard Court"}
                    </span>
                    <span className="bg-slate-200 px-1.5 py-0.5 border border-slate-300">
                        🏢 Structural Environment: Outdoor Sector
                    </span>
                </div>

                {/* METRICS STATS METERS PANEL */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4 text-center">
                  <div className="bg-white p-2 border border-slate-200">
                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">Friction Index</div>
                    <div className={`text-base font-black font-mono tracking-tight mt-0.5 ${snapshot.metrics.surface_friction_index < 0.75 ? 'text-red-600 animate-pulse' : 'text-slate-800'}`}>
                      {snapshot.metrics.surface_friction_index.toFixed(2)}
                    </div>
                  </div>

                  <div className="bg-white p-2 border border-slate-200">
                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">Bounce Uniformity</div>
                    <div className="text-base font-black font-mono text-slate-800 tracking-tight mt-0.5">
                      {snapshot.metrics.bounce_uniformity_percentage.toFixed(1)}%
                    </div>
                  </div>

                  <div className="bg-white p-2 border border-slate-200">
                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">Net Tension</div>
                    <div className={`text-base font-black font-mono tracking-tight mt-0.5 ${snapshot.metrics.net_tension_newtons < 400.0 ? 'text-orange-600 font-bold' : 'text-slate-800'}`}>
                      {snapshot.metrics.net_tension_newtons.toFixed(1)} N
                    </div>
                  </div>

                  <div className="bg-white p-2 border border-slate-200">
                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">Ambient Temp</div>
                    <div className="text-base font-black font-mono text-slate-800 tracking-tight mt-0.5">
                      {snapshot.metrics.ambient_temperature_celsius.toFixed(1)}°C
                    </div>
                  </div>

                  <div className="bg-white p-2 border border-slate-200">
                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">Humidity</div>
                    <div className="text-base font-black font-mono text-slate-800 tracking-tight mt-0.5">
                      {snapshot.metrics.humidity_percentage.toFixed(1)}%
                    </div>
                  </div>
                </div>

                {/* COMPACT NESTED ANOMALIES DATA TABLE */}
                {snapshot.anomalies && snapshot.anomalies.length > 0 ? (
                  <div className="mt-3">
                    <div className="font-bold text-[10px] text-red-700 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                      ⚠️ Detected Structural Operational Anomalies ({snapshot.anomalies.length})
                    </div>
                    <div className="overflow-x-auto border border-slate-200">
                      <table className="min-w-full divide-y divide-slate-200 text-left text-[11px]">
                        <thead className="bg-slate-100 font-bold uppercase text-slate-600 text-[9px] tracking-wider">
                          <tr>
                            <th className="px-3 py-1.5">Severity</th>
                            <th className="px-3 py-1.5">Category</th>
                            <th className="px-3 py-1.5">Description Summary</th>
                            <th className="px-3 py-1.5">Confidence</th>
                            <th className="px-3 py-1.5">Recommended Grounds Action</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-100 font-sans text-slate-700">
                          {snapshot.anomalies.map((anomaly) => (
                            <tr key={anomaly.anomaly_id}>
                              <td className="px-3 py-1.5 whitespace-nowrap">
                                <span className={`px-1.5 py-0.5 border text-[9px] uppercase tracking-tighter ${getSeverityStyles(anomaly.severity)}`}>
                                  {anomaly.severity}
                                </span>
                              </td>
                              <td className="px-3 py-1.5 whitespace-nowrap font-mono font-bold text-slate-600">{anomaly.category}</td>
                              <td className="px-3 py-1.5 font-medium">{anomaly.description}</td>
                              <td className="px-3 py-1.5 font-mono text-slate-500">{(anomaly.confidence_score * 100).toFixed(0)}%</td>
                              <td className="px-3 py-1.5 text-purple-700 bg-purple-50/30 font-medium italic">{anomaly.recommended_action}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="p-2 bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] tracking-wide font-medium">
                    ✅ Structural Check Complete: No logical hardware or degradation failures detected on this surface sector.
                  </div>
                )}
                
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
