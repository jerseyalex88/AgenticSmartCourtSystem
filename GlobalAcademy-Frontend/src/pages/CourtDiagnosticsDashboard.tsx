// File: GlobalAcademy-Frontend/src/pages/CourtDiagnosticsDashboard.tsx (Block 1 of 2)
import React, { useState, useEffect } from 'react';
import { apiClient } from '../api/apiClient';

// --- PLATFORM TOPOLOGY ENTITY TYPES ---
interface MinimalCourtMeta {
  id: string;
  name: string;
  surfaceType: string;
  isIndoor: boolean;
  status: string;
}

interface BranchTopologyMeta {
  id: string;
  name: string;
  description: string;
  isDecommissioned: boolean;
  courts: MinimalCourtMeta[];
}

// --- TELEMETRY SNAPSHOT DATA TYPES ---
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
  // Topology state
  const [topology, setTopology] = useState<BranchTopologyMeta[]>([]);
  const [panelOpen, setPanelOpen] = useState<boolean>(false);
  const [expandedBranches, setExpandedBranches] = useState<Record<string, boolean>>({});
  
  // Selection boundary tracks
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);
  const [selectedCourtId, setSelectedCourtId] = useState<string | null>(null);
  const [selectedCourtGuidString, setSelectedCourtGuidString] = useState<string>('');

  // 🛠️ SERVER-SIDE PAGINATION TRACKING CORES
  const [snapshots, setSnapshots] = useState<DiagnosticSnapshot[]>([]);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalRecords, setTotalRecords] = useState<number>(0);
  const [pageSize] = useState<number>(10); // Records per panel threshold split
  const [forecasts, setForecasts] = useState<Record<string, any>>({});
  const [forecastingModel, setForecastingModel] = useState<'OLS' | 'ADVANCED'>('OLS');

  // Operational pipeline feedback states
  const [loading, setLoading] = useState<boolean>(false);
  const [analyzing, setAnalyzing] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [seeding, setSeeding] = useState<boolean>(false);

  // --- INITIAL COMPONENT LIFECYCLE: FETCH TOPOLOGY TREE ---
  const fetchAcademyTopology = async () => {
    try {
      // Endpoint retrieves live non-decommissioned branches including nested child courts
      const response = await apiClient.get<BranchTopologyMeta[]>('/maintenance/branches/topology');
      setTopology(response.data);
      
      // Auto-expand all active branches inside our tree panels initially
      const initialExpands: Record<string, boolean> = {};
      response.data.forEach(b => { initialExpands[b.id] = true; });
      setExpandedBranches(initialExpands);
    } catch (err) {
      console.error('Failed to parse facility branch topology mapping trees.', err);
    }
  };

  const fetchCourtForecast = async (courtId: string, modelOverride?: 'OLS' | 'ADVANCED') => {
    const modelToUse = modelOverride || forecastingModel;
    
    // Unique cache key combining Court ID and selected algorithm
    const cacheKey = `${courtId}_${modelToUse}`;
    if (forecasts[cacheKey]) return;

    try {
      // Choose the exact parallel .NET endpoint route based on user selection state
      const endpoint = modelToUse === 'ADVANCED' 
        ? `/maintenance/court-diagnostics/forecast-advanced/${courtId}`
        : `/maintenance/court-diagnostics/forecast/${courtId}`;

      const response = await apiClient.get<any>(endpoint);
      
      // Store results uniquely under the combined cache key matrix
      setForecasts(prev => ({ ...prev, [cacheKey]: response.data }));
    } catch (err) {
      console.error(`Failed to execute ${modelToUse} forecasting math for asset ${courtId}:`, err);
    }
  };

  // --- FETCH: Query Paginated Data Stream with Dynamic Route Syncing ---
  const fetchDiagnosticHistory = async (page: number = 1) => {
    setLoading(true);
    setStatusMessage(null);
    try {
      // Build dynamic multi-conditional network query string keys
      let urlPath = `/maintenance/court-diagnostics-view?pageNumber=${page}&pageSize=${pageSize}`;
      if (selectedCourtId) urlPath += `&courtId=${selectedCourtId}`;
      else if (selectedBranchId) urlPath += `&branchId=${selectedBranchId}`;
      if (searchQuery.trim() !== '') urlPath += `&search=${encodeURIComponent(searchQuery)}`;

      const response = await apiClient.get<any>(urlPath);
      const envelope = response.data;

      // Extract inner array list and paging flags out of .NET DTO wrapper
      const rawItems = envelope?.items || [];
      setCurrentPage(envelope?.pageNumber || 1);
      setTotalPages(envelope?.totalPages || 1);
      setTotalRecords(envelope?.totalRecords || 0);

      if (!Array.isArray(rawItems)) {
        setSnapshots([]);
        return;
      }

      // Safe normalization array loop mapping matching backend schemas
      const normalizedSnapshots: DiagnosticSnapshot[] = rawItems.map((item: any) => {
        // 1. Isolate the target court identifier string right at the start of the loop
        const currentCourtId = item.courtId || item.court_id || '';
        
        // 2. Fire the background network fetch to calculate Python's time-series analytics
        if (currentCourtId) {
          fetchCourtForecast(currentCourtId, forecastingModel); // Evaluates active selection type
        }

        // 3. Return your object mapping structure cleanly as usual
        return {
          session_id: item.sessionId || item.session_id || '',
          court_id: currentCourtId,
          court_name: item.courtName || item.court_name || 'Unknown Court',
          branch_name: item.branchName || item.branch_name || 'Main Facility',
          academy_id: item.academyId || item.academy_id || '',
          branch_id: item.branchId || item.branch_id || '',
          timestamp: item.timestamp || new Date().toISOString(),
          agent_version: item.agentVersion || item.agent_version || 'v1.0.0',
          metrics: {
            surface_friction_index: Number(item.surfaceFrictionIndex ?? 0.80),
            bounce_uniformity_percentage: Number(item.bounceUniformityPercentage ?? 95.0),
            net_tension_newtons: Number(item.netTensionNewtons ?? 420.0),
            ambient_temperature_celsius: Number(item.ambientTemperatureCelsius ?? 22.0),
            humidity_percentage: Number(item.humidityPercentage ?? 50.0)
          },
          anomalies: Array.isArray(item.anomalies) ? item.anomalies.map((anom: any) => ({
            anomaly_id: anom.anomalyId || anom.anomaly_id || '',
            severity: anom.severity || 'Info',
            category: anom.category || 'General',
            description: anom.description || '',
            confidence_score: Number(anom.confidenceScore ?? 0),
            recommended_action: anom.recommendedAction || ''
          })) : []
        };
      });

      setSnapshots(normalizedSnapshots);
    } catch (err: any) {
      console.error('Failed to parse diagnostic data stream.', err);
      setStatusMessage(`Error fetching data logs: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // --- FETCH FACILITY LEDGER ON INITIAL LOAD ---
  useEffect(() => {
    fetchAcademyTopology(); // Loads your Collapsible Tree Panel layout structure
  }, []); // Empty array ensures this fires exactly ONCE when page mounts

  // Re-fetch data instantly when selected topology bounds or search query parameters shift
  useEffect(() => {
    fetchDiagnosticHistory(1); // Force reset view sequence directly to page 1 on filter alteration
  }, [selectedCourtId, selectedBranchId, searchQuery]);

  // Force analytical recalculations across your visible screen rows when the model flips
  useEffect(() => {
    setForecasts({}); // Flush old session caches completely to prevent data bleeding
    snapshots.forEach(s => {
      if (s.court_id) fetchCourtForecast(s.court_id, forecastingModel);
    });
  }, [forecastingModel, snapshots]);

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      fetchDiagnosticHistory(newPage);
    }
  };

  // --- ACTIONS: SELECTION TREE SECTORS ---
  const handleSelectBranch = (branchId: string) => {
    setSelectedBranchId(branchId);
    setSelectedCourtId(null);
    setSelectedCourtGuidString('');
    setStatusMessage(`📍 Target Scope changed to complete Branch Facility.`);
  };

  const handleSelectCourt = (court: MinimalCourtMeta, branchName: string) => {
    setSelectedCourtId(court.id);
    setSelectedBranchId(null);
    setSelectedCourtGuidString(court.id);
    setStatusMessage(`🎾 Selected single asset sector target: ${court.name} [${branchName}]`);
  };

  const toggleBranchAccordion = (branchId: string) => {
    setExpandedBranches(prev => ({ ...prev, [branchId]: !prev[branchId] }));
  };

  // --- ACTIONS: COMPUTE ACTIVE TELEMETRY ENGINE LOOP ---
  const handleComputeDiagnostics = async () => {
    setAnalyzing(true);
    setStatusMessage(null);
    try {
      if (selectedCourtId) {
        // Broaden single court execution mapping
        const response = await apiClient.post<{ message: string }>(
          `/maintenance/court-diagnostics/calculate/${selectedCourtId}`
        );
        setStatusMessage(`⚡ [Engine Signal]: ${response.data.message}`);
      } else if (selectedBranchId) {
        // Cascade multi-batch processing requests across every active court on this branch
        const targetBranch = topology.find(b => b.id === selectedBranchId);
        if (!targetBranch || !targetBranch.courts.length) {
          throw new Error("The selected branch contains no operational courts to analyze.");
        }
        
        setStatusMessage(`🔄 Batch pipeline active: Triggering calculations for ${targetBranch.courts.length} courts...`);
        for (const court of targetBranch.courts) {
          await apiClient.post(`/maintenance/court-diagnostics/calculate/${court.id}`);
        }
        setStatusMessage(`✅ Complete facility sweep execution successfully logged for branch: ${targetBranch.name}`);
      } else {
        throw new Error("Please expand the Topology Ledger panel and choose a Branch or Court to execute.");
      }
      await fetchDiagnosticHistory();
    } catch (err: any) {
      setStatusMessage(`Analysis Core Rejection: ${err.response?.data?.message || err.message}`);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleDeleteSnapshot = async (sessionId: string) => {
    if (!window.confirm('Permanently wipe this analytical check snapshot out of database?')) return;
    try {
      await apiClient.delete(`/maintenance/court-diagnostics/${sessionId}`);
      setStatusMessage(`🗑️ Record block purged successfully.`);
      await fetchDiagnosticHistory();
    } catch (err: any) {
      setStatusMessage(`Purge Refusal: ${err.message}`);
    }
  };

  const handleInjectHistoricalData = async () => {
    if (!selectedCourtId) {
      setStatusMessage("⚠️ Action Refused: Please click and select a single Court from the Ledger above to inject a trend matrix.");
      return;
    }
    
    if (!window.confirm("Inject 180 days of continuous backdated diagnostic logs into PostgreSQL for this court?")) return;
    
    setSeeding(true);
    setStatusMessage(null);
    try {
      const response = await apiClient.post<{ message: string }>(
        `/maintenance/court-diagnostics/seed/${selectedCourtId}`
      );
      setStatusMessage(`🧪 [Seeder Matrix Active]: ${response.data.message}`);
      await fetchDiagnosticHistory(); // Automatically trigger full UI feed update
    } catch (err: any) {
      console.error("Seeder injection loop failure:", err);
      setStatusMessage(`Seeding Failure: ${err.response?.data?.message || err.message}`);
    } finally {
      setSeeding(false);
    }
  };

  // --- CASCADING REVOLUTION MATRIX FILTER ---
  // Replace your existing filteredSnapshots declaration block with this combined matrix:
  const filteredSnapshots = snapshots.filter(s => {
    // A. First pass: Apply the hierarchical facility branch topology filters
    if (selectedCourtId && s.court_id !== selectedCourtId) return false;
    if (selectedBranchId && s.branch_id !== selectedBranchId) return false;
    
    // B. Second pass: Apply your exact string search lookups across all metadata text attributes
    const query = searchQuery.toLowerCase().trim();
    if (query === '') return true; // Show all rows if search bar is empty

    // Look for your typed text query matching inside any available text/string fields
    const matchesCourtName = s.court_name.toLowerCase().includes(query);
    const matchesBranchName = s.branch_name.toLowerCase().includes(query);
    const matchesAgentVersion = s.agent_version.toLowerCase().includes(query);
    const matchesSessionId = s.session_id.toLowerCase().includes(query);

    // Deep search lookups across nested anomalies arrays text properties
    const matchesAnomalies = s.anomalies.some(anom => 
      anom.category.toLowerCase().includes(query) ||
      anom.description.toLowerCase().includes(query) ||
      anom.severity.toLowerCase().includes(query) ||
      anom.recommended_action.toLowerCase().includes(query)
    );

    return matchesCourtName || matchesBranchName || matchesAgentVersion || matchesSessionId || matchesAnomalies;
  });

  const getSeverityStyles = (severity: string) => {
    switch (severity) {
      case 'Critical': return 'bg-red-100 border-red-400 text-red-700 animate-pulse font-black';
      case 'High': return 'bg-orange-100 border-orange-400 text-orange-700 font-bold';
      case 'Medium': return 'bg-amber-100 border-amber-400 text-amber-700';
      default: return 'bg-slate-100 border-slate-300 text-slate-600';
    }
  };

  return (
    <div className="space-y-3 text-sans p-4 bg-slate-50 min-h-screen">
      
      {/* GLOBAL BANNER VIEW ROW */}
      <div>
        <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
          📡 Structural Court Diagnostics Command Matrix
        </h2>
        <p className="text-xs text-slate-500 mt-1 font-mono">
          Real-time physical asset integrity tracking pipelines flowing across multi-tenant boundaries.
        </p>
      </div>

      {/* TOPOLOGY COLLAPSIBLE DRAWER WORKSPACE */}
      <div className="border border-slate-300 bg-white shadow-md">
        <button 
          onClick={() => setPanelOpen(!panelOpen)}
          className="w-full bg-slate-100 border-b border-slate-300 px-4 py-2.5 flex justify-between items-center text-[10px] font-black uppercase tracking-wider text-slate-700 text-left"
        >
          <span>📁 Academy Branch & Court Topology Ledger ({topology.length} Facilities Active)</span>
          <span>{panelOpen ? '▲ Collapse Ledger Matrix' : '▼ Expand Ledger Matrix'}</span>
        </button>
        
        {panelOpen && (
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-64 overflow-y-auto bg-slate-50/50">
            {topology.map((branch) => (
              <div key={branch.id} className="border border-slate-200 bg-white p-3 shadow-sm rounded-none">
                <div className="flex items-center justify-between border-b border-slate-200 pb-1.5 mb-2">
                  <div className="flex items-center gap-1.5">
                    <button 
                      onClick={() => toggleBranchAccordion(branch.id)}
                      className="font-mono text-slate-400 hover:text-slate-600 font-bold text-[11px]"
                    >
                      {expandedBranches[branch.id] ? '[-]' : '[+]'}
                    </button>
                    <button
                      onClick={() => handleSelectBranch(branch.id)}
                      className={`font-black uppercase tracking-tight text-[11px] text-left transition ${
                        selectedBranchId === branch.id ? 'text-purple-700 underline font-black' : 'text-slate-800 hover:text-purple-600'
                      }`}
                    >
                      📍 {branch.name}
                    </button>
                  </div>
                  <span className="font-mono text-[8px] text-slate-400">FACILITY TREE</span>
                </div>

                {expandedBranches[branch.id] && (
                  <div className="space-y-1 pl-4 border-l border-dashed border-slate-300">
                    {branch.courts.map((court) => (
                      <div key={court.id} className="flex items-center justify-between text-[11px] py-0.5">
                        <button
                          onClick={() => handleSelectCourt(court, branch.name)}
                          className={`text-left font-medium transition ${
                            selectedCourtId === court.id ? 'text-purple-600 font-black' : 'text-slate-600 hover:text-purple-500'
                          }`}
                        >
                          🎾 {court.name} <span className="text-[9px] font-mono text-slate-400">({court.surfaceType})</span>
                        </button>
                        <span className={`text-[8px] px-1 font-mono uppercase font-bold ${
                          court.status === 'Open' ? 'text-emerald-600 bg-emerald-50 border border-emerald-200' : 'text-amber-600 bg-amber-50 border border-amber-200'
                        }`}>
                          {court.status}
                        </span>
                      </div>
                    ))}
                    {branch.courts.length === 0 && (
                      <div className="text-[10px] text-slate-400 italic">No courts cataloged on this facility location.</div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      {/* HORIZONTAL CONTROLS COMMAND CONTROL DECK */}
      <div className="p-6 bg-white border border-slate-300 shadow-xl font-sans text-xs text-slate-800">
        {/* Locate your input row container inside the control block and update like this: */}
        <div className="flex flex-col gap-4 border-b border-slate-300 pb-4 mb-4">
          
          {/* ROW 1: TARGET PARAMETER LINK & ACTIONS */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="font-bold uppercase tracking-wider text-slate-600 text-[10px]">Target Parameter Link:</span>
              <input
                type="text"
                readOnly
                value={selectedCourtGuidString || (selectedBranchId ? `[BATCH-MODE]: BRANCH SNAPSHOT ALLOCATION` : 'ALL COURTS ACTIVE VIEW')}
                placeholder="Select from Ledger above..."
                className="px-2 py-1 font-mono text-[10px] border border-slate-300 w-80 bg-slate-100 text-slate-600 focus:outline-none"
              />
            </div>
            
            <div className="flex items-center gap-2 self-end md:self-auto">
              <button
                onClick={handleInjectHistoricalData}
                disabled={seeding || analyzing || loading}
                className={`px-3 py-2 font-bold uppercase tracking-wider transition text-[10px] border ${
                  seeding 
                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed border-slate-300' 
                    : 'bg-amber-100 hover:bg-amber-200 text-amber-800 border-amber-300'
                }`}
              >
                {seeding ? '🧪 Injecting 180 Rows...' : '🧪 Seed Sandbox Trend Data'}
              </button>
              
              <button
                // FIX: Wrapped inside an anonymous callback to stop the MouseEvent from bleeding into the page parameter slot
                onClick={() => fetchDiagnosticHistory(currentPage)}
                disabled={loading || analyzing || seeding}
                className="px-3 py-2 font-bold uppercase tracking-wider transition text-[10px] bg-slate-200 hover:bg-slate-300 text-slate-700 border border-slate-300"
              >
                🔄 Pull Live Metrics
              </button>

              <button
                onClick={handleComputeDiagnostics}
                disabled={analyzing || loading}
                className={`px-4 py-2 font-bold uppercase tracking-wider transition text-[10px] ${
                  analyzing ? 'bg-slate-200 text-slate-600 cursor-not-allowed' : 'bg-purple-600 hover:bg-purple-500 text-white'
                }`}
              >
                {analyzing ? 'Computing Diagnostics Math...' : selectedBranchId ? '⚡ Run Batch Branch Analysis' : '⚡ Compute Active Diagnostics'}
              </button>
            </div>
          </div>

          {/* ROW 2: REAL-TIME GLOBAL SEARCH BAR WITH INLINE ABBREVIATED PAGINATION */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-1">
            <div className="flex items-center gap-2 flex-grow">
              <span className="font-bold uppercase tracking-wider text-slate-600 text-[10px] whitespace-nowrap">Filter Diagnostics:</span>
              <input 
                type="text" 
                placeholder="🔍 Search snapshots by court, facility, version, or keyword..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full sm:max-w-xl bg-white border border-slate-300 px-2 py-1.5 text-xs font-mono text-slate-800 bg-slate-50/50 focus:outline-none focus:bg-white focus:border-purple-500"
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery('')}
                  className="font-mono text-[9px] uppercase tracking-tighter text-slate-400 hover:text-slate-600 whitespace-nowrap"
                >
                  [Clear Query]
                </button>
              )}
            </div>
            
            {/* NEW: DYNAMIC MACHINE LEARNING FORECASTING ALGORITHM SWITCHER */}
            <div className="flex items-center gap-2">
              <span className="font-bold uppercase tracking-wider text-slate-600 text-[10px] whitespace-nowrap">🧠 Forecast Brain:</span>
              <select
                value={forecastingModel}
                onChange={(e) => setForecastingModel(e.target.value as 'OLS' | 'ADVANCED')}
                className="bg-white border border-slate-300 px-2 py-1 text-xs font-mono font-bold text-purple-700 bg-slate-50/50 focus:outline-none focus:border-purple-500 rounded-none cursor-pointer"
              >
                <option value="OLS">📊 Linear OLS Baseline Model</option>
                <option value="ADVANCED">⚡ Meta Prophet + SciPy Advanced</option>
              </select>
            </div>

            {/* QUICK INLINE PAGE CHUNKER NAVIGATION CONTROL */}
            <div className="flex items-center gap-1 self-end sm:self-auto font-mono text-[10px] border border-slate-300 bg-slate-100/50 p-1">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1 || loading}
                className={`px-2 py-0.5 font-black border transition ${
                  currentPage === 1 
                    ? 'bg-slate-50 text-slate-300 border-slate-200 cursor-not-allowed' 
                    : 'bg-white hover:bg-slate-200 text-slate-800 border-slate-300'
                }`}
              >
                ◀
              </button>
              <span className="px-2 py-0.5 text-slate-700 font-bold uppercase tracking-tighter">
                PG {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages || loading}
                className={`px-2 py-0.5 font-black border transition ${
                  currentPage === totalPages 
                    ? 'bg-slate-50 text-slate-300 border-slate-200 cursor-not-allowed' 
                    : 'bg-white hover:bg-slate-200 text-slate-800 border-slate-300'
                }`}
              >
                ▶
              </button>
            </div>
          </div>

        </div>


        {/* FEEDBACK STATUS BAR ALERT COMPONENT */}
        {statusMessage && (
          <div className="mb-4 p-2 bg-purple-50 border border-purple-200 text-purple-700 text-[10px] font-mono">
            ℹ️ [System Telemetry Signal]: {statusMessage}
          </div>
        )}

        {/* SYSTEM RECT DATA FEED GRIDS MATRIX */}
        {loading ? (
          <div className="py-12 text-center text-slate-400 font-mono tracking-widest uppercase">Loading ledger logs...</div>
        ) : snapshots.length === 0 ? (
          <div className="py-12 text-center text-slate-400 font-mono border border-dashed border-slate-200">
            No active telemetry signatures logged matching this ledger boundary filter.
          </div>
        ) : (
          <div className="space-y-6">
            {snapshots.map((snapshot) => (
              <div key={snapshot.session_id} className="border border-slate-300 bg-slate-50 p-4 shadow-sm">
                
                <div className="flex justify-between items-center border-b border-slate-200 pb-2 mb-2">
                  <div>
                    <span className="font-mono bg-purple-100 border border-purple-300 text-purple-700 px-1.5 py-0.5 text-[9px] mr-2 uppercase font-bold">
                      📍 {snapshot.branch_name}
                    </span>
                    <span className="font-black text-slate-800 uppercase tracking-tight text-xs mr-2">
                      🎾 {snapshot.court_name}
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

                {/* ========================================================================= */}
                {/* NEW: DYNAMIC TIME-SERIES LINEAR FORECAST LIFESPAN PROGRESS INDICATOR      */}
                {/* ========================================================================= */}
                {(() => {
                  const cacheKey = `${snapshot.court_id}_${forecastingModel}`;
                  const forecast = forecasts[cacheKey];

                  if (!forecast) return null; // Fallback gracefully if calculation is still computing over network

                  const days = forecast.estimated_days_until_breach ?? forecast.estimatedDaysUntilBreach ?? 0;
                  const isCritical = forecast.is_resurface_recommended ?? forecast.isResurfaceRecommended ?? false;
                  const breachDate = forecast.predicted_breach_date ?? forecast.predictedBreachDate ?? 'Stable';
                  const confidence = forecast.confidence_score ?? forecast.confidenceScore ?? 0;
                                    
                  // Dynamically calculate brutalist color tokens based on time-series safety margins
                  const progressPercent = Math.max(5, Math.min(100, (days / 120) * 100));
                  const barColor = days < 15 ? 'bg-red-600' : days < 45 ? 'bg-orange-500' : 'bg-emerald-600';
                  const panelBg = days < 15 ? 'bg-red-50 border-red-300' : 'bg-slate-100 border-slate-300';

                  return (
                    <div className={`p-3 border font-mono text-[10px] mb-3 flex flex-col md:flex-row md:items-center justify-between gap-3 ${panelBg}`}>
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5">
                          <span className="font-black text-slate-800 uppercase tracking-tight text-[11px]">
                            🔮 Predictive Surface Wear Lifespan Analysis
                          </span>
                          <span className="text-[8px] px-1 bg-slate-200 border border-slate-400 font-bold uppercase">
                            Confidence: {((forecast.confidenceScore ?? forecast.confidence_score ?? 0) * 100).toFixed(0)}%
                          </span>
                        </div>
                        <p className="text-slate-500 text-[9px] max-w-xl">
                          OLS linear regression engine tracks active friction decay velocity at{' '}
                          <span className="text-slate-800 font-bold">{(forecast.velocity_friction_loss_per_day ?? forecast.velocityFrictionLossPerDay ?? 0).toFixed(5)} index/day</span>.
                        </p>
                      </div>

                      {/* DAYS PLAYING REMAINING COUNTER AND PROGRESS METER TRACK */}
                      <div className="flex-grow max-w-md space-y-1.5 self-center">
                        <div className="w-full bg-slate-200 border border-slate-400 h-2.5 rounded-none overflow-hidden relative">
                          <div 
                            className={`h-full border-r border-slate-800 transition-all duration-500 ${barColor}`} 
                            style={{ width: `${progressPercent}%` }} 
                          />
                        </div>
                        <div className="flex justify-between text-[9px] uppercase tracking-wider text-slate-400 font-bold">
                          <span>🚨 Boundary (0.75 Friction)</span>
                          <span>Target Lifespan: 120+ Days</span>
                        </div>
                      </div>

                      {/* METRIC CALLOUT METERS */}
                      <div className="text-right whitespace-nowrap min-w-[140px]">
                        <div className={`text-sm font-black font-mono tracking-tighter ${isCritical ? 'text-red-600 animate-pulse' : 'text-slate-800'}`}>
                          {days === 365 ? '365+ DAYS' : `${days} DAYS REMAINING`}
                        </div>
                        <div className="text-[9px] text-slate-400 font-bold uppercase tracking-tight mt-0.5">
                          Est. Breach: <span className="text-slate-700 font-black">{forecast.predictedBreachDate || 'Stable'}</span>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4 text-center mt-3">
                  <div className="bg-white p-2 border border-slate-200">
                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">Friction Index</div>
                    <div className={`text-sm font-black font-mono tracking-tight mt-0.5 ${snapshot.metrics.surface_friction_index < 0.75 ? 'text-red-600 animate-pulse' : 'text-slate-800'}`}>
                      {snapshot.metrics.surface_friction_index.toFixed(2)}
                    </div>
                  </div>

                  <div className="bg-white p-2 border border-slate-200">
                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">Bounce Uniformity</div>
                    <div className="text-sm font-black font-mono text-slate-800 tracking-tight mt-0.5">
                      {snapshot.metrics.bounce_uniformity_percentage.toFixed(1)}%
                    </div>
                  </div>

                  <div className="bg-white p-2 border border-slate-200">
                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">Net Tension</div>
                    <div className={`text-sm font-black font-mono tracking-tight mt-0.5 ${snapshot.metrics.net_tension_newtons < 400.0 ? 'text-orange-600 font-bold' : 'text-slate-800'}`}>
                      {snapshot.metrics.net_tension_newtons.toFixed(1)} N
                    </div>
                  </div>

                  <div className="bg-white p-2 border border-slate-200">
                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">Ambient Temp</div>
                    <div className="text-sm font-black font-mono text-slate-800 tracking-tight mt-0.5">
                      {snapshot.metrics.ambient_temperature_celsius.toFixed(1)}°C
                    </div>
                  </div>

                  <div className="bg-white p-2 border border-slate-200">
                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">Humidity</div>
                    <div className="text-sm font-black font-mono text-slate-800 tracking-tight mt-0.5">
                      {snapshot.metrics.humidity_percentage.toFixed(1)}%
                    </div>
                  </div>
                </div>

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
                            <th className="px-3 py-1.5">Recommended Action</th>
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
                    ✅ Structural Check Complete: No logical hardware or degradation boundary failures detected on this surface sector.
                  </div>
                )}
              </div>
            ))}

            {/* ========================================================================= */}
            {/* BRUTALIST FOOTER PAGINATION NAVIGATION PANEL                             */}
            {/* ========================================================================= */}
            <div className="mt-6 border-t border-slate-300 pt-4 flex flex-col sm:flex-row items-center justify-between gap-4 font-mono text-[11px] text-slate-600">
              <div>
                Showing page <span className="font-bold text-slate-800">{currentPage}</span> of <span className="font-bold text-slate-800">{totalPages}</span> ({totalRecords} matching snapshots across ledger)
              </div>
              
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handlePageChange(1)}
                  disabled={currentPage === 1 || loading}
                  className={`px-2 py-1.5 border font-bold uppercase transition ${
                    currentPage === 1 ? 'bg-slate-100 text-slate-300 border-slate-200 cursor-not-allowed' : 'bg-white hover:bg-slate-100 text-slate-800 border-slate-300'
                  }`}
                >
                  ┃◀ First
                </button>
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1 || loading}
                  className={`px-3 py-1.5 border font-bold uppercase transition ${
                    currentPage === 1 ? 'bg-slate-100 text-slate-300 border-slate-200 cursor-not-allowed' : 'bg-white hover:bg-slate-100 text-slate-800 border-slate-300'
                  }`}
                >
                  ◀ Prev
                </button>
                
                <span className="px-3 py-1.5 bg-purple-50 border border-purple-200 text-purple-700 font-bold">
                  {currentPage}
                </span>

                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages || loading}
                  className={`px-3 py-1.5 border font-bold uppercase transition ${
                    currentPage === totalPages ? 'bg-slate-100 text-slate-300 border-slate-200 cursor-not-allowed' : 'bg-white hover:bg-slate-100 text-slate-800 border-slate-300'
                  }`}
                >
                  Next ▶
                </button>
                <button
                  onClick={() => handlePageChange(totalPages)}
                  disabled={currentPage === totalPages || loading}
                  className={`px-2 py-1.5 border font-bold uppercase transition ${
                    currentPage === totalPages ? 'bg-slate-100 text-slate-300 border-slate-200 cursor-not-allowed' : 'bg-white hover:bg-slate-100 text-slate-800 border-slate-300'
                  }`}
                >
                  Last ▶┃
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
