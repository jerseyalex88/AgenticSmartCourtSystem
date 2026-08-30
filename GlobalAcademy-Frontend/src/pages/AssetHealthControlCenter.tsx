// File: GlobalAcademy-Frontend/src/pages/AssetHealthControlCenter.tsx
import React, { useState, useEffect } from 'react';
import { apiClient } from '../api/apiClient';
import CourtSpatialHeatmap from '../components/CourtSpatialHeatmap';

interface MinimalAnomaly {
  anomalyId: string;
  severity: string;
  category: string;
  description: string;
  confidenceScore: number;
  recommendedAction: string;
}

interface LatestSnapshot {
  sessionId: string;
  timestamp: string;
  surfaceFrictionIndex: number;
  bounceUniformityPercentage: number;
  netTensionNewtons: number;
  ambientTemperatureCelsius: number;
  humidityPercentage: number;
  agentVersion: string;
  anomalies: MinimalAnomaly[];
}

interface CourtHealthOverview {
  courtId: string;
  courtName: string;
  branchId: string;
  branchName: string;
  surfaceType: string;
  isIndoor: boolean;
  status: string;
  aggregateMinutesPlayed: number;
  maintenanceThresholdMinutes: number;
  latestSnapshot: LatestSnapshot | null;
}

interface BranchTopologyMeta {
  id: string;
  name: string;
  courts: { id: string; name: string; surfaceType: string; status: string }[];
}

interface BouncePoint {
  x: number;
  y: number;
  intensity: string;
}
interface SectorImpact {
  id: string;
  Id: string;
  name: string;
  
  // 🛠️ Instruct TypeScript to accept both casing properties from the wire payload
  bounceCount?: number;
  bounce_count?: number;
  
  wearIntensityIndex?: number;
  wear_intensity_index?: number;
}

interface SpatialHeatmap {
  courtId: string;
  
  // 🛠️ Add both contract signatures to the master layout schema model
  totalProcessedBounces?: number;
  total_processed_bounces?: number;
  
  lastAnalyzedClipUtc?: string;
  last_analyzed_clip_utc?: string;
  
  sectors: SectorImpact[];
  bounce_points?: BouncePoint[];
  bouncePoints?: BouncePoint[];
}

// Update your main master definition container by appending the new contract node:
interface CourtHealthOverview {
  courtId: string;
  courtName: string;
  branchId: string;
  branchName: string;
  surfaceType: string;
  isIndoor: boolean;
  status: string;
  aggregateMinutesPlayed: number;
  maintenanceThresholdMinutes: number;
  latestSnapshot: LatestSnapshot | null;
  
  // 🛠️ NEW COMPUTER VISION DATA PROPERTY INTERCEPT MATRIX
  heatmap: SpatialHeatmap | null;
}

export default function AssetHealthControlCenter() {
  // Topology Ledger & Filter States
  const [topology, setTopology] = useState<BranchTopologyMeta[]>([]);
  const [panelOpen, setPanelOpen] = useState<boolean>(true);
  const [expandedBranches, setExpandedBranches] = useState<Record<string, boolean>>({});
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);
  const [selectedCourtId, setSelectedCourtId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [forecastingModel, setForecastingModel] = useState<'OLS' | 'ADVANCED'>('OLS');

  // Core Data & Cache Analytics State Management
  const [courtHealths, setCourtHealths] = useState<CourtHealthOverview[]>([]);
  const [forecasts, setForecasts] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const [uploadingCourts, setUploadingCourts] = useState<Record<string, boolean>>({});
  const [dragActiveCourts, setDragActiveCourts] = useState<Record<string, boolean>>({});

  // --- FETCH 1: Initial load for Collapsible Facility Ledger ---
  const fetchAcademyTopology = async () => {
    try {
      const response = await apiClient.get<BranchTopologyMeta[]>('/maintenance/branches/topology');
      setTopology(response.data || []);
    } catch (err) {
      console.error('Failed to parse branch ledger geometry.', err);
    }
  };

  // --- FETCH 2: Pull Latest Master Health Snapshot Per Court ---
  const fetchAssetHealthSummary = async () => {
    setLoading(true);
    setStatusMessage(null);
    try {
      let urlPath = `/maintenance/court-health-summary?`;
      if (selectedCourtId) urlPath += `courtId=${selectedCourtId}`;
      else if (selectedBranchId) urlPath += `branchId=${selectedBranchId}`;

      const response = await apiClient.get<CourtHealthOverview[]>(urlPath);
      setCourtHealths(response.data || []);
    } catch (err: any) {
      console.error('Failed to query master infrastructure health metrics.', err);
      setStatusMessage(`Error fetching structural summaries: {err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // --- FETCH 3: Background Python On-The-Fly Forecasting Handshake ---
  const fetchCourtForecast = async (courtId: string, modelType: 'OLS' | 'ADVANCED', forceRefresh = false) => {
    const cacheKey = `${courtId}_${modelType}`;
    if (forecasts[cacheKey] && !forceRefresh) return;

    try {
      const endpoint = modelType === 'ADVANCED'
        ? `/maintenance/court-diagnostics/forecast-advanced/${courtId}`
        : `/maintenance/court-diagnostics/forecast/${courtId}`;
      const response = await apiClient.get<any>(endpoint);
      setForecasts(prev => ({ ...prev, [cacheKey]: response.data }));
    } catch (err) {
      console.error(`Failed to process computational forecast loop for court ${courtId}:`, err);
    }
  };

  // --- FETCH 4: MULTIPART BINARY STREAM UPLOADER (DIAGNOSTIC VERSION) ---
  const handleUploadVideoClip = async (courtId: string, fileInputSource: any) => {
    console.log("====================================================");
    console.log("🔍 [UPLOAD DEBUGGER ACTIVATED] Inbound Source Data Info:");
    console.log("====================================================");
    console.log("📦 Inbound Data Raw Type:", typeof fileInputSource);
    console.log("📦 Is Data an Instance of FileList?", fileInputSource instanceof FileList);
    console.log("📦 Is Data an Instance of File?", fileInputSource instanceof File);
    console.log("📋 Full Raw Object Inspector:", fileInputSource);

    let extractedFile: File | null = null;

    // A. If coming from Drag-and-Drop file stream drops list
    if (fileInputSource instanceof FileList) {
      if (fileInputSource.length > 0) {
        extractedFile = fileInputSource[0];
        console.log("🎯 Extracted from FileList index 0:", extractedFile.name, `(${extractedFile.size} bytes)`);
      } else {
        console.warn("⚠️ FileList is empty!");
      }
    } 
    // B. If coming from an HTML File Input select element directly
    else if (fileInputSource instanceof File) {
      extractedFile = fileInputSource;
      console.log("🎯 Input provided direct File reference:", extractedFile.name, `(${extractedFile.size} bytes)`);
    } 
    // C. Fallback for manual event objects or index variations
    else if (fileInputSource && fileInputSource[0] instanceof File) {
      extractedFile = fileInputSource[0];
      console.log("🎯 Extracted from loose array index 0:", extractedFile.name);
    }

    if (!extractedFile) {
      console.error("❌ [CRITICAL]: Could not resolve a single raw File binary out of the provided source input data container.");
      setStatusMessage("❌ [UPLOAD FAULT]: No valid binary file could be extracted from input source.");
      return;
    }

    // Lock the court card cell row processing state indicators on
    setUploadingCourts(prev => ({ ...prev, [courtId]: true }));
    setStatusMessage(`📤 [UPLOADING MEDIA]: Streaming multipart binary video blocks to backend servers...`);

    const uploadFormPayload = new FormData();
    // Ensure naming matches what C# expects
    uploadFormPayload.append('courtId', courtId);
    uploadFormPayload.append('videoFile', extractedFile);

    console.log("📡 [MULTIPART FORMDATA CONTENTS INSPECTOR]:");
    console.log("   👉 Form field 'courtId' contents:", uploadFormPayload.get('courtId'));
    console.log("   👉 Form field 'videoFile' binary filename:", (uploadFormPayload.get('videoFile') as File)?.name);

    try {
      const response = await apiClient.post('/maintenance/court-video/upload', uploadFormPayload, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      console.log("🚀 [NETWORK CALLBACK ENGINE SUCCESS] .NET Accepted Response:", response.data);
      setStatusMessage(`🚀 [JOB RECONCILED]: Video analytical pass scheduled successfully! Job ID: ${response.data.job_id || 'Queued'}`);
    } catch (err: any) {
      console.error("❌ [NETWORK HANDSHAKE REJECTION LOG]:", err);
      if (err.response) {
        console.error("💥 Server Error Response Body Context:", err.response.data);
      }
      setStatusMessage(`❌ [UPLOAD FAULT]: Media pipeline rejected file package: ${err.message}`);
    } finally {
      setUploadingCourts(prev => ({ ...prev, [courtId]: false }));
      console.log("====================================================\n");
    }
  };

  // Lifecycle Hooks coordination boundaries
  useEffect(() => {
    fetchAcademyTopology();
  }, []);

  useEffect(() => {
    fetchAssetHealthSummary();
  }, [selectedBranchId, selectedCourtId]);

  // Recalculate and trigger forecast updates whenever health rows populate or model selector flips
  useEffect(() => {
    if (!forceRefreshActive) setForecasts({}); // Clear screen trace arrays on algorithm swap
    courtHealths.forEach(c => {
      if (c.courtId && c.latestSnapshot) {
        fetchCourtForecast(c.courtId, forecastingModel, forceRefreshActive);
      }
    });
    setForceRefreshActive(false);
  }, [courtHealths, forecastingModel]);

  const [forceRefreshActive, setForceRefreshActive] = useState<boolean>(false);
  
  const handleRecalculateForecasts = async () => {
    setForceRefreshActive(true);
    await fetchAssetHealthSummary();
    setStatusMessage(`⚡ [Recalculation Complete]: Advanced ${forecastingModel} forecasting formulas re-evaluated successfully across visible metrics.`);
  };

  // Filtering filter utility matching admin pattern rules
  const filteredCourts = courtHealths.filter(c => {
    const query = searchQuery.toLowerCase().trim();
    if (query === '') return true;
    return c.courtName.toLowerCase().includes(query) || 
           c.branchName.toLowerCase().includes(query) ||
           c.surfaceType.toLowerCase().includes(query);
  });

  const getSeverityStyles = (sev: string) => {
    const s = sev.toUpperCase();
    if (s.includes('CRIT') || s.includes('HIGH')) return 'bg-red-100 text-red-700 border-red-300 font-bold';
    if (s.includes('MED') || s.includes('WARN')) return 'bg-orange-100 text-orange-700 border-orange-300 font-bold';
    return 'bg-blue-100 text-blue-700 border-blue-300';
  };

  return (
    <div className="space-y-3 text-sans p-4 bg-slate-50 min-h-screen">
      <div>
        <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
          🛡️ Academy Asset Health Control Center
        </h2>
        <p className="text-xs text-slate-500 mt-1 font-mono">
          Executive structural command deck displaying exactly one master predictive status envelope per physical asset.
        </p>
      </div>

      {/* TOPOLOGY COLLAPSIBLE DRAWER PANEL */}
      <div className="border border-slate-300 bg-white shadow-md mb-1">
        <button 
          onClick={() => setPanelOpen(!panelOpen)}
          className="w-full bg-slate-100 border-b border-slate-300 px-4 py-2.5 flex justify-between items-center text-[10px] font-black uppercase tracking-wider text-slate-700"
        >
          <span>📁 Facility Asset Topology Architecture</span>
          <span>{panelOpen ? '▲ Collapse Ledger Matrix' : '▼ Expand Ledger Matrix'}</span>
        </button>
        {panelOpen && (
          <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4 max-h-48 overflow-y-auto bg-slate-50/50">
            {topology.map(b => (
              <div key={b.id} className="border border-slate-200 bg-white p-2.5 shadow-sm">
                <button
                  onClick={() => { setSelectedBranchId(b.id); setSelectedCourtId(null); }}
                  className={`font-black uppercase tracking-tight text-[11px] block ${selectedBranchId === b.id ? 'text-purple-700 underline' : 'text-slate-800'}`}
                >
                  📍 {b.name}
                </button>
                <div className="mt-1 space-y-0.5 pl-3 border-l border-dashed border-slate-300">
                  {b.courts.map(c => (
                    <button
                      key={c.id}
                      onClick={() => { setSelectedCourtId(c.id); setSelectedBranchId(null); }}
                      className={`text-[11px] block transition text-left ${selectedCourtId === c.id ? 'text-purple-600 font-bold' : 'text-slate-500'}`}
                    >
                      🎾 {c.name}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* CONTROL DECK COMMAND ROW */}
      <div className="p-4 bg-white border border-slate-300 shadow-xl font-sans text-xs text-slate-800">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-slate-300 pb-4 mb-4">
          <div className="flex items-center gap-2 flex-grow">
            <span className="font-bold uppercase tracking-wider text-slate-600 text-[10px]">Search Master:</span>
            <input 
              type="text" 
              placeholder="🔍 Filter courts by surface classification, facility locale, or designation tags..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full sm:max-w-md bg-white border border-slate-300 px-2 py-1.5 text-xs font-mono text-slate-800"
            />
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="font-bold uppercase tracking-wider text-slate-600 text-[10px]">🧠 Model Brain:</span>
              <select
                value={forecastingModel}
                onChange={(e) => setForecastingModel(e.target.value as 'OLS' | 'ADVANCED')}
                className="bg-white border border-slate-300 px-2 py-1 text-xs font-mono font-bold text-purple-700 focus:outline-none"
              >
                <option value="OLS">📊 Linear OLS Baseline Model</option>
                <option value="ADVANCED">⚡ Meta Prophet + SciPy Advanced</option>
              </select>
            </div>

            <button
              onClick={handleRecalculateForecasts}
              disabled={loading}
              className="px-4 py-2 font-bold uppercase tracking-wider transition text-[10px] bg-purple-600 hover:bg-purple-500 text-white border border-purple-700 shadow-sm"
            >
              🔄 Pull Live Metrics & Forecast
            </button>
          </div>
        </div>

        {statusMessage && (
          <div className="mb-4 p-2 bg-purple-50 border border-purple-200 text-purple-700 text-[10px] font-mono">
            ℹ️ {statusMessage}
          </div>
        )}
        {/* ONE MASTER CARD PER UNIQUE COURT LOOP CONTAINER */}
        {loading ? (
          <div className="py-12 text-center text-slate-400 font-mono tracking-widest uppercase">Syncing Infrastructure Matrix...</div>
        ) : filteredCourts.length === 0 ? (
          <div className="py-12 text-center text-slate-400 font-mono border border-dashed border-slate-200">
            No active academy assets match the specified filtering parameters.
          </div>
        ) : (
          <div className="space-y-6">
            {filteredCourts.map(court => {
              const cacheKey = `${court.courtId}_${forecastingModel}`;
              const forecast = forecasts[cacheKey];
              const snapshot = court.latestSnapshot;

              const isOverPlayed = court.aggregateMinutesPlayed > court.maintenanceThresholdMinutes;

              const days = forecast ? (forecast.estimated_days_until_breach ?? forecast.estimatedDaysUntilBreach ?? 0) : 0;
              const isCritical = forecast ? (forecast.is_resurface_recommended ?? forecast.isResurfaceRecommended ?? false) : false;
              const breachDate = forecast ? (forecast.predicted_breach_date ?? forecast.predictedBreachDate ?? 'Stable') : 'Stable';
              const confidence = forecast ? (forecast.confidence_score ?? forecast.confidenceScore ?? 0) : 0;

              const progressPercent = Math.max(5, Math.min(100, (days / 120) * 100));
              const barColor = days < 15 ? 'bg-red-600' : days < 45 ? 'bg-orange-500' : 'bg-emerald-600';
              const panelBg = days < 15 ? 'bg-red-50 border-red-300' : 'bg-slate-100 border-slate-300';

              return (
                <div key={court.courtId} className="border border-slate-300 bg-white p-4 shadow-md rounded-none">
                  
                  {/* MASTER COURT NAME HEADER PANEL BAR */}
                  <div className="flex justify-between items-center border-b border-slate-200 pb-2 mb-3">
                    <div>
                      <span className="font-mono bg-purple-100 border border-purple-300 text-purple-700 px-1.5 py-0.5 text-[9px] mr-2 uppercase font-bold">
                        📍 {court.branchName}
                      </span>
                      <span className="font-black text-slate-900 uppercase tracking-tight text-sm mr-2">
                        🎾 {court.courtName}
                      </span>
                      <span className="font-mono text-slate-400 text-[9px]">
                        (Asset GUID: {court.courtId})
                      </span>
                    </div>
                    <div className="flex items-center gap-2 font-mono text-[9px] uppercase font-bold">
                      <span className={`px-1.5 py-0.5 border ${court.status === 'Open' ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-amber-700 bg-amber-50 border-amber-200'}`}>
                        Status: {court.status}
                      </span>
                      <span className="text-slate-500 bg-slate-100 px-1 py-0.5 border border-slate-200">
                        Type: {court.surfaceType}
                      </span>
                    </div>
                  </div>

                  {/* 📊 LIFESPAN PREDICTIVE INDICATOR BOX CELL */}
                  {forecast ? (
                    <div className={`p-3 border font-mono text-[10px] mb-3 flex flex-col md:flex-row md:items-center justify-between gap-3 ${panelBg}`}>
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5">
                          <span className="font-black text-slate-800 uppercase tracking-tight text-[11px]">
                            🔮 Predictive Surface Wear Lifespan Analysis ({forecastingModel} Engine)
                          </span>
                          <span className="text-[8px] px-1 bg-slate-200 border border-slate-400 font-bold uppercase">
                            Confidence: {(confidence * 100).toFixed(0)}%
                          </span>
                        </div>
                        <p className="text-slate-500 text-[9px] max-w-xl">
                          Tracking surface friction decay velocity at{' '}
                          <span className="text-slate-800 font-bold">
                            {(forecast.velocity_friction_loss_per_day ?? forecast.velocityFrictionLossPerDay ?? 0).toFixed(5)} index/day
                          </span>.
                        </p>
                      </div>

                      <div className="flex-grow max-w-md space-y-1.5 self-center">
                        <div className="w-full bg-slate-200 border border-slate-400 h-2.5 rounded-none overflow-hidden relative">
                          <div className={`h-full border-r border-slate-800 transition-all duration-500 ${barColor}`} style={{ width: `${progressPercent}%` }} />
                        </div>
                        <div className="flex justify-between text-[9px] uppercase tracking-wider text-slate-400 font-bold">
                          <span>🚨 Boundary (0.75 Friction)</span>
                          <span>Target Lifespan: 120+ Days</span>
                        </div>
                      </div>

                      <div className="text-right whitespace-nowrap min-w-[130px] self-center">
                        <div className={`text-sm font-black font-mono tracking-tighter uppercase ${isCritical ? 'text-red-600 animate-pulse' : 'text-slate-800'}`}>
                          {days === 365 ? '365+ DAYS' : `${days} DAYS REMAINING`}
                        </div>
                        <div className="text-[9px] text-slate-400 font-bold uppercase tracking-tight mt-0.5">
                          Est. Breach: <span className="text-slate-700 font-black">{breachDate}</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="py-4 text-center text-[10px] font-mono text-slate-400 border border-dashed border-slate-200 mb-3 bg-slate-50/50 animate-pulse">
                      ⏳ Computational Python AI models calculating time-series curves over network interfaces...
                    </div>
                  )}

                  {/* ========================================================================= */}
                  {/* 🛰️ ADVANCED COMPUTER VISION SPATIAL STRIKE HEATMAP RENDERING BLOCK        */}
                  {/* ========================================================================= */}
                  {court.heatmap && court.heatmap.sectors && court.heatmap.sectors.length > 0 && (
                    <div className="mb-4 border border-slate-300 bg-white p-3 shadow-inner font-mono text-[10px]">
                      
                      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 border-b border-slate-200 pb-2 mb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-purple-700 text-xs font-black">🛰️ COMPUTER VISION STRIKE INTENSITY MATRIX</span>
                          <span className="text-[8px] bg-purple-100 text-purple-700 px-1 border border-purple-300 font-bold uppercase tracking-tight">
                            YOLOv11 Active
                          </span>
                        </div>
                        <div className="text-slate-400 text-[9px] text-right font-semibold">
                          📊 TOTAL PROCESSED IMPACT STRIKES: <span className="text-slate-800 font-black">
                            {/* 🛠️ FIXED: Fallback to catch snake_case network properties safely */}
                            {court.heatmap.total_processed_bounces ?? court.heatmap.totalProcessedBounces ?? 0}
                          </span>
                          <span className="mx-2">|</span> 
                          🕒 LAST ANALYSIS RUN: <span className="text-slate-700 font-bold">
                            {/* 🛠️ FIXED: Handshake both casing properties cleanly to avoid the Invalid Date crash */}
                            {new Date(court.heatmap.last_analyzed_clip_utc ?? court.heatmap.lastAnalyzedClipUtc ?? new Date()).toLocaleTimeString()}
                          </span>
                        </div>
                      </div>

                      {/* 🛠️ BRUTALIST TOP-DOWN TENNIS COURT OVERLAY GRID CONTAINER */}
                      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 items-center">
                        
                        {/* THE GEOMETRIC TENNIS COURT GRID MAP LAYER */}
                        <div className="lg:col-span-3 border border-slate-800 bg-slate-900 p-2 relative select-none">
                          <div className="text-[8px] font-bold text-slate-100 uppercase tracking-widest absolute top-1 left-2 z-10">Top-Down Surface Sector View</div>
                          
                          {/* Outer Doubles Boundary Box Line */}
                          <div className="border-2 border-slate-200 w-full p-1.5 grid grid-cols-3 gap-1 bg-emerald-950/20">
                            
                            {court.heatmap.sectors.slice(0, 12).map((sector) => {
                              // Dynamic heatmap calculation engine mapping indices down to brutalist color shifts
                              const count = sector.bounce_count ?? sector.bounceCount ?? 0;
                              const idx = sector.wear_intensity_index ?? sector.wearIntensityIndex ?? 0;
                              const name = sector.name ?? sector.Id;
                              
                              const heatColor = 
                                idx >= 0.80 ? 'bg-red-600/90 text-white border-red-400 hover:bg-red-500' :
                                idx >= 0.40 ? 'bg-amber-500/80 text-slate-900 border-amber-300 hover:bg-amber-400' :
                                count > 0  ? 'bg-emerald-600/50 text-emerald-100 border-emerald-500 hover:bg-emerald-600/70' :
                                             'bg-slate-800/40 text-slate-500 border-slate-700/60 opacity-40';

                              return (
                                <div 
                                  key={sector.id} 
                                  className={`border p-2.5 transition duration-150 flex flex-col justify-between items-center text-center min-h-[56px] relative shadow-md font-bold uppercase tracking-tight ${heatColor}`}
                                >
                                  <div className="text-[9px] font-black tracking-tight leading-none text-center truncate max-w-full">
                                    {sector.name}
                                  </div>
                                  <div className="text-[11px] font-black font-mono tracking-tighter mt-1">
                                    {count > 0 ? `💥 ${count} hits` : '0 hits'}
                                  </div>
                                  {idx > 0 && (
                                    <div className="absolute bottom-0.5 right-1 text-[7px] font-mono tracking-tighter font-semibold opacity-80">
                                      WEAR: {(idx * 100).toFixed(0)}%
                                    </div>
                                  )}
                                </div>
                              );
                            })}

                          </div>
                        </div>

                        {/* EXECUTED RECONVERSION DATA INDEX METRIC DECK */}
                        <div className="space-y-2 border border-slate-200 p-2.5 bg-slate-50 h-full flex flex-col justify-center">
                          <div className="text-[9px] font-black uppercase text-slate-500 tracking-wider mb-1">🔥 Wear Intensity Legend:</div>
                          <div className="space-y-1.5 font-semibold text-[9px]">
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 bg-red-600 border border-red-400 shadow-sm" />
                              <span className="text-red-700 font-bold uppercase">[CRITICAL WEAR ZONE] : &gt;= 80% Abrasion</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 bg-amber-500 border border-amber-300 shadow-sm" />
                              <span className="text-amber-700 font-bold uppercase">[MODERATE TRAFFIC] : 40% - 79% Friction Loss</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 bg-emerald-600/60 border border-emerald-500 shadow-sm" />
                              <span className="text-emerald-700 font-bold uppercase">[PRISTINE RUNWAY] : Stable Impact Surface</span>
                            </div>
                          </div>
                          <p className="text-[8px] text-slate-400 leading-normal border-t border-slate-200 pt-1.5 mt-1.5">
                            YOLOv11 tracking camera vectors isolate ball deflection vectors to calculate local load distribution coefficients dynamically.
                          </p>
                        </div>

                      </div>
                    </div>
                  )}

                  {/* ========================================================================= */}
                  {/* 🛠️ NEW: MOUNT THE ULTRA-PREMIUM REUSABLE SPATIAL MOISTURE HEATMAP ENGINE  */}
                  {/* ========================================================================= */}
                  {court.heatmap && (court.heatmap.bounce_points || court.heatmap.bouncePoints) && (
                    <CourtSpatialHeatmap 
                      bouncePoints={court.heatmap.bounce_points ?? court.heatmap.bouncePoints ?? []}
                      totalProcessedBounces={court.heatmap.total_processed_bounces ?? court.heatmap.totalProcessedBounces ?? 0}
                    />
                  )}

                  {/* ========================================================================= */}
                  {/* 📤 MULTIPART OPTICAL CAMERA CLIP DRAG-AND-DROP INGESTION INTERFACE        */}
                  {/* ========================================================================= */}
                  <div className="mb-4 font-mono text-[10px]">
                    <div 
                      className={`border border-dashed p-4 text-center transition transition-all relative ${
                        dragActiveCourts[court.courtId] 
                          ? 'border-purple-600 bg-purple-50/40 text-purple-700' 
                          : 'border-slate-400 bg-slate-50/30 text-slate-500 hover:border-slate-600 hover:bg-slate-50/70'
                      }`}
                      onDragOver={(e) => { e.preventDefault(); setDragActiveCourts(prev => ({ ...prev, [court.courtId]: true })); }}
                      onDragLeave={(e) => { e.preventDefault(); setDragActiveCourts(prev => ({ ...prev, [court.courtId]: false })); }}
                      onDrop={(e) => {
                        e.preventDefault();
                        setDragActiveCourts(prev => ({ ...prev, [court.courtId]: false }));
                        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                          handleUploadVideoClip(court.courtId, e.dataTransfer.files[0]);
                        }
                      }}
                    >
                      {uploadingCourts[court.courtId] ? (
                        <div className="space-y-2 py-2 animate-pulse">
                          <div className="text-purple-700 font-black uppercase text-[11px] tracking-wide">
                            ⚙️ PIPING BINARY DATA CHUNKS OVER CONTAINER INTERFACES...
                          </div>
                          <p className="text-[9px] text-slate-400 font-semibold leading-none">
                            Do not close or navigate away from this management tab shell window boundary loops.
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-1.5 cursor-pointer relative">
                          {/* Hidden raw input trigger interface bridge for manual click interactions */}
                          <input 
                            type="file" 
                            accept=".mp4,.mov,.avi,.mkv" 
                            onChange={(e) => { 
                              if (e.target.files && e.target.files.length > 0) { 
                                // 🛠️ FIX: Handshake index 0 out of the target files collection array explicitly
                                handleUploadVideoClip(court.courtId, e.target.files[0]); 
                              } 
                            }}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
                          />
                          <div className="text-slate-800 font-black uppercase text-[10px] tracking-tight">
                            📥 DRAG & DROP OPTICAL RECORDING CLIP HERE
                          </div>
                          <p className="text-slate-400 text-[9px] leading-tight font-medium max-w-md mx-auto">
                            Supports compressed <span className="text-slate-600 font-bold">.MP4, .MOV, or .AVI</span> match gameplay or drone analytics footage files. Click to select a file manually.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* LATEST METRICS STATISTICS BLOCKS ROW */}
                  {snapshot ? (
                    <>
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-center mb-3">
                        <div className="bg-slate-50 p-2 border border-slate-200">
                          <div className="text-[9px] text-slate-400 font-bold uppercase tracking-tight">Friction Index</div>
                          <div className={`text-xs font-black font-mono mt-0.5 ${snapshot.surfaceFrictionIndex < 0.75 ? 'text-red-600 animate-pulse' : 'text-slate-800'}`}>
                            {snapshot.surfaceFrictionIndex.toFixed(2)}
                          </div>
                        </div>
                        <div className="bg-slate-50 p-2 border border-slate-200">
                          <div className="text-[9px] text-slate-400 font-bold uppercase tracking-tight">Bounce Uniformity</div>
                          <div className="text-xs font-black font-mono text-slate-800 mt-0.5">{snapshot.bounceUniformityPercentage.toFixed(1)}%</div>
                        </div>
                        <div className="bg-slate-50 p-2 border border-slate-200">
                          <div className="text-[9px] text-slate-400 font-bold uppercase tracking-tight">Net Tension</div>
                          <div className={`text-xs font-black font-mono mt-0.5 ${snapshot.netTensionNewtons < 400.0 ? 'text-orange-600' : 'text-slate-800'}`}>{snapshot.netTensionNewtons.toFixed(1)} N</div>
                        </div>
                        <div className="bg-slate-50 p-2 border border-slate-200">
                          <div className="text-[9px] text-slate-400 font-bold uppercase tracking-tight">Ambient Temp</div>
                          <div className="text-xs font-black font-mono text-slate-800 mt-0.5">{snapshot.ambientTemperatureCelsius.toFixed(1)}°C</div>
                        </div>
                        <div className="bg-slate-50 p-2 border border-slate-200">
                          <div className="text-[9px] text-slate-400 font-bold uppercase tracking-tight">Humidity</div>
                          <div className="text-xs font-black font-mono text-slate-800 mt-0.5">{snapshot.humidityPercentage.toFixed(1)}%</div>
                        </div>
                      </div>

                      {/* CONDITIONAL OPERATIONAL SYSTEM ANOMALIES LOG LIST */}
                      {(snapshot.anomalies.length > 0 || isOverPlayed) ? (
                        <div className="mt-2 border border-slate-200 p-2 bg-slate-50/50 rounded-none">
                          <div className="font-bold text-[9px] text-red-700 uppercase tracking-wider mb-1 flex items-center gap-1">
                            ⚠️ Active Asset Structural Alerts Log ({snapshot.anomalies.length + (isOverPlayed ? 1 : 0)})
                          </div>
                          <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-slate-200 text-left text-[11px]">
                              <thead className="bg-slate-100 font-bold uppercase text-slate-600 text-[8px] tracking-wider">
                                <tr>
                                  <th className="px-2 py-1">Severity</th>
                                  <th className="px-2 py-1">Category</th>
                                  <th className="px-2 py-1">Description Summary</th>
                                  <th className="px-2 py-1">Confidence</th>
                                  <th className="px-2 py-1">Action Recommendation</th>
                                </tr>
                              </thead>
                              <tbody className="bg-white divide-y divide-slate-100 text-slate-700 font-sans">
                                {isOverPlayed && (
                                  <tr className="bg-red-50/30">
                                    <td className="px-2 py-1 whitespace-nowrap"><span className="px-1.5 py-0.5 border text-[8px] uppercase tracking-tighter bg-red-100 text-red-700 border-red-300 font-bold">HIGH</span></td>
                                    <td className="px-2 py-1 font-mono font-bold text-slate-600 text-[10px]">Maintenance Limits</td>
                                    <td className="px-2 py-1 font-medium">Court has actively exceeded safe utilization thresholds ({court.aggregateMinutesPlayed}/{court.maintenanceThresholdMinutes} mins).</td>
                                    <td className="px-2 py-1 font-mono text-slate-500">99%</td>
                                    <td className="px-2 py-1 text-purple-700 font-medium italic">Schedule manual {court.surfaceType} surface structural sweep and reset maintenance counters.</td>
                                  </tr>
                                )}
                                {snapshot.anomalies.map(a => (
                                  <tr key={a.anomalyId}>
                                    <td className="px-2 py-1 whitespace-nowrap"><span className={`px-1.5 py-0.5 border text-[8px] uppercase tracking-tighter ${getSeverityStyles(a.severity)}`}>{a.severity}</span></td>
                                    <td className="px-2 py-1 font-mono font-bold text-slate-600 text-[10px]">{a.category}</td>
                                    <td className="px-2 py-1 font-medium">{a.description}</td>
                                    <td className="px-2 py-1 font-mono text-slate-500">{(a.confidenceScore * 100).toFixed(0)}%</td>
                                    <td className="px-2 py-1 text-purple-700 font-medium italic">{a.recommendedAction}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ) : (
                        <div className="p-2 bg-emerald-50 border border-emerald-200 text-emerald-700 text-[9px] tracking-wide font-medium font-mono">
                          ✅ SYSTEM STATUS PRISTINE: No logical sensor threshold breaches or utilization capacity boundary alarms active.
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="py-6 text-center text-[10px] font-mono text-slate-400 border border-dashed border-slate-200 bg-slate-50/50">
                      ℹ️ Asset Connected: No telemetry snapshot entries have been recorded yet for this court location inside PostgreSQL database logs.
                    </div>
                  )}

                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
