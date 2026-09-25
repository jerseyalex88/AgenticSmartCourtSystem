import React, { useState, useEffect } from 'react';
import { apiClient } from '../api/apiClient';
import { useAlert } from '../context/AlertContext';
import { useAuth } from '../context/AuthContext';

// Domain Type Contracts matching your strongly-typed C# backend models exactly
interface Branch {
  id: string;
  name: string;
  description?: string;
  timeZoneId?: string;
}

interface Court {
  id: string;
  name: string;
  branchId: string;
  surfaceType?: string;
  status?: string;
}

interface DocumentItem {
  documentName: string;
  courtId: string | null;
  courtName: string;
  createdAtUtc: string;
}

interface TextChunk {
  pageNumber: number;
  textContent: string;
}

interface RetrievedCitation {
  id: string;
  documentName: string;
  textContent: string;
  pageNumber: number;
  rerankScore: number;
}

interface PipelineMetrics {
  faithfulnessScore: number;
  answerRelevanceScore: number;
  contextPrecisionScore: number;
}

interface SavedMacro {
  id: string;
  title: string;
  queryText: string;
}

interface PendingApprovalGraph {
  threadId: string;
  academyId: string;
  courtName: string;
  stagedActionType: 'PlayerRefund' | 'MaintenancePO';
  stagedMaterialOrAmount: string; // e.g., "$180.00 Refund" or "Lux Ballast Part B"
  calculatedAuditLog: string;    // Explanatory breakdown text from the agent
  timestamp: string;
}

export default function V2AiControlCenter() {
  // 🚀 MASTER NAVIGATION STATE: Tracks which panel section is visible
  const [activeMasterTab, setActiveMasterTab] = useState<'ingest' | 'browser' | 'trace'>('ingest');
  const { user: loggedInUser } = useAuth(); 
  const isDirector = loggedInUser?.role === 'AcademyDirector' || loggedInUser?.role === 'GlobalAdmin';

  // Shared Core Operational Metadata States
  const [branches, setBranches] = useState<Branch[]>([]);
  const [courts, setCourts] = useState<Court[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState('');
    // 🚀 FIXED: Swapped single string state for a multi-select tracking array
  const [selectedBranchIds, setSelectedBranchIds] = useState<string[]>([]);

  const [selectedCourtId, setSelectedCourtId] = useState('ALL');
  const [loading, setLoading] = useState(false);

  // Tab 1: Ingestion Component Workspace States
  const [uploadFiles, setUploadFiles] = useState<FileList | null>(null);
  const [ingestionLoading, setIngestionLoading] = useState(false);

  // Tab 2: Knowledge Repository Browser States
  const [documentList, setDocumentList] = useState<DocumentItem[]>([]);
  const [selectedDocName, setSelectedDocName] = useState<string | null>(null);
  const [documentContents, setDocumentContents] = useState<TextChunk[]>([]);
  const [viewerLoading, setViewerLoading] = useState(false);

  // Tab 3: Diagnostic Pipeline Tracing States
  const [traceQuery, setTraceQuery] = useState('');
  const [traceLoading, setTraceLoading] = useState(false);
  const [activeDiagnosticTab, setActiveDiagnosticTab] = useState<'answer' | 'citations' | 'metrics'>('answer');
  const [aiAnswer, setAiAnswer] = useState('');
  const [citations, setCitations] = useState<RetrievedCitation[]>([]);
  const [metrics, setMetrics] = useState<PipelineMetrics | null>(null);

  const [macros, setMacros] = useState<SavedMacro[]>([]);
  const [selectedMacroId, setSelectedMacroId] = useState<string>('');
  const [macroDropdownOpen, setMacroDropdownOpen] = useState<boolean>(false);
  const [newMacroTitle, setNewMacroTitle] = useState<string>('');
  const [isSavingNew, setIsSavingNew] = useState<boolean>(false);
  const { showAlert } = useAlert();

  const [pendingApprovals, setPendingApprovals] = useState<PendingApprovalGraph[]>([]);
  const [approvingThreadId, setApprovingThreadId] = useState<string | null>(null);
  const [approvalError, setApprovalError] = useState<string | null>(null);
  const [activeTraceThreadId, setActiveTraceThreadId] = useState<string | null>(null);

  // Hook into initial mount to fetch saved queries data
  useEffect(() => {
    if (activeMasterTab === 'trace') {
      fetchSavedMacrosList();
    }
  }, [activeMasterTab]);

  // Synchronize infrastructure lookup trees on dashboard initialization
  useEffect(() => {
    fetchInitialBranchData();
    fetchUploadedDocumentsRepository();
  }, []);

  // Cascading Selection Handler: Auto-fetch matching courts when the branch configuration modifies
  useEffect(() => {
    if (selectedBranchId) {
      fetchCourtsForSelectedBranch(selectedBranchId);
      setSelectedCourtId('ALL'); // Reset target asset context filter to broad facility scope
    } else {
      setCourts([]);
    }
  }, [selectedBranchId]);

  const fetchInitialBranchData = async () => {
    try {
      setLoading(true);
      const branchRes = await apiClient.get<Branch[]>('/Facility/branches');
      setBranches(branchRes.data || []);
      
      if (branchRes.data.length > 0 && selectedBranchIds.length === 0) {
        setSelectedBranchIds([branchRes.data[0].id]);
      }
    } catch (err: any) {
      console.error('Failed to synchronize infrastructure branches list.', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCourtsForSelectedBranch = async (branchId: string) => {
    if (!branchId) return;
    try {
      const courtRes = await apiClient.get<Court[]>(`/Facility/branches/${branchId}/courts`);
      setCourts(courtRes.data || []);
    } catch (err: any) {
      console.error('Failed to isolate target branch court asset metrics.', err);
    }
  };

  const fetchUploadedDocumentsRepository = async () => {
    try {
      const res = await apiClient.get('/v2/ai-knowledge-ops/list-uploaded-documents');
      setDocumentList(res.data || []);
    } catch (e) {
      console.error("Failed to query multi-tenant knowledge base list.", e);
    }
  };

  const handleBatchIngestionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFiles || uploadFiles.length === 0 || selectedBranchIds.length === 0) return;

    setIngestionLoading(true);
    const formData = new FormData();
    
    // 🚀 FIXED: Append all selected branch IDs to the multi-part stream collection array
    selectedBranchIds.forEach((id) => {
      formData.append('branchIds', id);
    });

    if (selectedCourtId !== 'ALL') formData.append('courtId', selectedCourtId);
    
    for (let i = 0; i < uploadFiles.length; i++) {
      formData.append('documentFiles', uploadFiles[i]);
    }

    try {
      await apiClient.post('/v2/ai-knowledge-ops/ingest-manuals', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setUploadFiles(null);
      await fetchUploadedDocumentsRepository();
      showAlert({ 
        title: 'Ingestion Success', 
        message: "🚀 Ingestion package successfully committed across all targeted branch assets!",
        type: 'success' 
      });
    } catch (err: any) {
        console.log(`Ingestion Failure: ${err.response?.data || err.message}`);
    } finally {
      setIngestionLoading(false);
    }
  };

  const handleViewDocument = async (docName: string) => {
    setSelectedDocName(docName);
    setViewerLoading(true);
    try {
      const res = await apiClient.get(`/v2/ai-knowledge-ops/view-document-contents?documentName=${encodeURIComponent(docName)}`);
      setDocumentContents(res.data || []);
    } catch (e) {
        console.log('Failed to reconstruct structured document text chunks.');
    } finally {
      setViewerLoading(false);
    }
  };

  const handleDeleteDocument = async (docName: string) => {
    showAlert({
      title: 'Delete Document?',
      message: `Are you sure you want to delete "${docName}"? This will completely purge all vector embedding rows from the knowledge base.`,
      type: 'warning',
      onConfirm: async () => {
        try {
          // Fire DELETE to your consolidated endpoint using matching URL query parameters
          await apiClient.delete(`/v2/ai-knowledge-ops/delete-document?documentName=${encodeURIComponent(docName)}`);
          showAlert({ 
            title: 'Deletion Success', 
            message: "🗑️ Document package successfully purged from knowledge base repository!",
            type: 'success' 
          });
          
          // Refresh your active files layout list repository immediately
          await fetchUploadedDocumentsRepository();
        } catch (err: any) {
          showAlert({ 
            title: 'Error', 
            message: "❌ Failed to delete document matrix layer layout components.",
            type: 'error' 
          });
        }
      }
    });
  };

  const handleExecuteTrace = async (e: React.FormEvent) => {
    e.preventDefault();

    // Create or retrieve a conversation thread GUID session id
    const targetThreadId = crypto.randomUUID(); // Or your standard conversation thread id string
    setActiveTraceThreadId(targetThreadId); // 🚀 RECORD ACTIVE SESSION FOR THE REFRESHER
 
    if (!traceQuery.trim()) return;

    setTraceLoading(true);
    try {
      const activeLayoutVoiceKey = localStorage.getItem('global_app_voice_key') || 'en-US-AriaNeural';

      // 🚀 FIXED: Capitalized key parameter strings to align perfectly with .NET DTO models!
      const res = await apiClient.post('/v2/ai-knowledge-ops/execute-pipeline-trace', {
        UserInput: traceQuery,
        BranchId: selectedBranchIds.length > 0 ? selectedBranchIds[0] : selectedBranchId, 
        CourtId: selectedCourtId !== 'ALL' ? selectedCourtId : null,
        VoiceKey: activeLayoutVoiceKey
      });

      setAiAnswer(res.data.conversationalSpeechOutput);
      setCitations(res.data.retractedContextSources || []);
      setMetrics(res.data.pipelinePerformance);

      // 🚀 THE AUTOPLAY ENHANCEMENT MATRIX CORE:
      // Verify if a compiled Base64 binary audio stream track arrived from Python
      if (res.data.audioBase64) {
        try {
          console.log("🔊 [AUDIO ENGINE INTERCEPT]: Initializing data uri stream play sequence...");
          
          // Convert the raw base64 payload into an executable data URI string element path
          const audioUriString = `data:audio/mp3;base64,${res.data.audioBase64}`;
          
          // Instantiate a quick, thread-safe HTML5 sound container player block in browser memory
          const internalSoundNode = new Audio(audioUriString);
          
          // Trigger immediate sound vibration playback
          await internalSoundNode.play();
        } catch (audioPlaybackError) {
          console.warn("⚠️ [AUDIO BLOCK NOTICE]: Browser structural media policies restricted automated sound boot:", audioPlaybackError);
          // Note: Modern browsers sometimes block autoplay unless a user interacts/clicks first. 
          // Since the user explicitly clicks the "Run Pipeline Trace" button here, it satisfies policies perfectly!
        }
      }
    } catch (e: any) {
      console.error('Trace execution failed structural validation loops:', e);
      // alert('Diagnostic transaction pipeline handshake broken.');
    } finally {
      setTraceLoading(false);
    }
  };

  const handleTriggerPipelineTraceRefresh = async () => {
    if (!activeTraceThreadId) return;
    console.log(`📡 [TRACE ENGINE REFRESH]: Re-syncing metrics for thread: ${activeTraceThreadId}`);
    try {
      // Queries the data logs for the active thread to re-populate your citations & RAGAS scores live
      const response = await apiClient.get(`/ai/knowledge/trace-history/${activeTraceThreadId}`);
      if (response.data) {
        setAiAnswer(response.data.answer);
        setCitations(response.data.citations || []);
        setMetrics(response.data.metrics || null);
      }
    } catch (err) {
      console.error("Failed to execute an automated background trace canvas refresh pass:", err);
    }
  };

  // Fetch saved templates from your consolidated .NET controller API network route
  const fetchSavedMacrosList = async () => {
    try {
      // 🚀 FIXED: Re-aligned to target your new consolidated sub-route prefix!
      const res = await apiClient.get<SavedMacro[]>('/v2/ai-knowledge-ops/list-agentquery');
      setMacros(res.data || []);
    } catch (err) {
      console.error('Failed to synchronize macro clipboard memory matrices.', err);
    }
  };

  // UI Utility Operations Handlers
  const handleLoadSelectedMacroText = (macroId: string) => {
    const target = macros.find(m => m.id === macroId);
    if (target) {
      setTraceQuery(target.queryText); // Injects the full multi-line prompt into your textarea console!
      setSelectedMacroId(macroId);
    }
  };

  const handleSaveCurrentAsNewMacro = async () => {
    if (!traceQuery.trim()) return alert('Cannot save an empty text layout prompt vector.');
    const titleInput = prompt('Enter a short title name for this prompt blueprint macro:', 'Compliance Audit Template');
    if (!titleInput) return;

    try {
      // 🚀 FIXED: Re-aligned to target your new consolidated sub-route prefix!
      const res = await apiClient.post('/v2/ai-knowledge-ops/save-agentquery', {
        Title: titleInput,
        QueryText: traceQuery
      });
      showAlert({ 
        title: 'Save Success', 
        message: "🚀 Macro successfully registered to your shared administrative clipboard!",
        type: 'success' 
      });
      await fetchSavedMacrosList();
      setSelectedMacroId(res.data.id);
    } catch (err: any) {
      showAlert({ 
        title: 'Error', 
        message: "❌ Failed to commit blueprint template parameters.",
        type: 'error' 
      });
    }
  };

  const handleUpdateExistingSelectedMacro = async () => {
    if (!selectedMacroId) return alert('Please select an active macro template from the list first.');
    showAlert({
      title: 'Overwrite Macro Template?',
      message: `Are you sure you want to overwrite this saved template with your current textarea modifications?'`,
      type: 'warning',
      onConfirm: async () => {
        try {
          // 🚀 FIXED: Re-aligned to target your new consolidated sub-route prefix!
          await apiClient.put(`/v2/ai-knowledge-ops/update-agentquery/${selectedMacroId}`, {
            QueryText: traceQuery
          });
          showAlert({ 
            title: 'Save Success', 
            message: "🔄 Saved macro template updated successfully.",
            type: 'success' 
          });
          await fetchSavedMacrosList();
        } catch (err) {
          showAlert({ 
            title: 'Error', 
            message: "❌ Failed to re-sync template changes.",
            type: 'error' 
          });
        }
      }
    });
  };

  const handleDeleteSelectedMacro = async () => {
    if (!selectedMacroId) return alert('Please select an active template profile to purge.');

    showAlert({
      title: 'Remove Macro Template?',
      message: `Are you sure you want to permanently erase this prompt blueprint macro?'`,
      type: 'warning',
      onConfirm: async () => {
        try {
          // 🚀 FIXED: Re-aligned to target your new consolidated sub-route prefix!
          await apiClient.delete(`/v2/ai-knowledge-ops/delete-agentquery/${selectedMacroId}`);
          showAlert({ 
            title: 'Removed', 
            message: "🗑️ Macro successfully scrubbed from clipboard arrays.",
            type: 'success' 
          });
          setTraceQuery('');
          setSelectedMacroId('');
          await fetchSavedMacrosList();
        } catch (err) {
          showAlert({ 
            title: 'Error', 
            message: "❌ Failed to remove macro template.",
            type: 'error' 
          });
        }
      }
    });
  };

  const fetchPendingAgentApprovals = async () => {
    try {
      setApprovalError(null);
      // Queries the .NET endpoint monitoring the GraphStateCheckpoints table rows
      const res = await apiClient.get<PendingApprovalGraph[]>('/AiOrchestration/ai-harness/pending-approvals');
      setPendingApprovals(res.data);
    } catch (err: any) {
      console.error('Failed to query paused graph checkpoint matrix:', err);
    }
  };

  const handleResolveGraphApproval = async (threadId: string, action: 'Approve' | 'Reject') => {
    setApprovingThreadId(threadId);
    setApprovalError(null);
    try {
      // Posts the human instruction token directly back to the .NET proxy coordinator gateway
      await apiClient.post(`/AiOrchestration/ai-harness/resolve-approval`, {
        threadId,
        humanDecision: action // Sends "Approve" or "Reject"
      });
      
      alert(`👥 Action successfully recorded: Graph execution path has been ${action === 'Approve' ? 'Unfrozen and Committed' : 'Aborted and Cleared'}.`);
      
      // Refresh the queue array lists instantly on screen layout
      await fetchPendingAgentApprovals();
      
      // If the active trace tab was monitoring this thread, refresh the trace results window
      if (activeTraceThreadId === threadId) {
        await handleTriggerPipelineTraceRefresh();
      }
    } catch (err: any) {
      setApprovalError(err.response?.data || `Failed to transmit ${action.toLowerCase()} decision signal.`);
    } finally {
      setApprovingThreadId(null);
    }
  };

  // Polling interval hooks to keep the human intercept queue updated in background rails
  // useEffect(() => {
  //   fetchPendingAgentApprovals();
  //   const pollTimer = setInterval(fetchPendingAgentApprovals, 10000); // Polls every 10 seconds
  //   return () => clearInterval(pollTimer);
  // }, []);

  return (
    <div className="w-full max-w-[100vw] h-screen space-y-3 font-sans p-4 bg-slate-50 text-slate-800 flex flex-col overflow-hidden">
      
      {/* GLOBAL BANNER VIEW ROW */}
      <div className="w-full shrink-0">
        <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
          📡 Core AI Enterprise Operations & Diagnostic Lab
        </h2>
        <p className="text-xs text-slate-500 mt-1 font-mono">
          Multi-tenant vector infrastructure command matrix. Seamless parsing, chunk browser, and RAGAS monitoring.
        </p>
      </div>

      {/* ========================================================================= */}
      // 🚀 MASTER MODULE SINGLE-VIEW WORKSPACE TAB NAVIGATION NAVIGATION HEADER
      {/* ========================================================================= */}
      <div className="flex border border-slate-300 bg-white p-1 rounded-none shadow-sm gap-1 text-[10px] font-black uppercase tracking-wider font-mono shrink-0 mt-2">
        <button
          type="button"
          onClick={() => setActiveMasterTab('ingest')}
          className={`flex-1 text-center py-2.5 transition border ${
            activeMasterTab === 'ingest' 
              ? 'bg-slate-900 border-slate-950 text-white font-black' 
              : 'bg-slate-50 border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100/60'
          }`}
        >
          📥 [1] Ingestion Matrix Terminal
        </button>
        <button
          type="button"
          onClick={() => {
            setActiveMasterTab('browser');
            fetchUploadedDocumentsRepository(); // Refresh data grid variables on tab click entry
          }}
          className={`flex-1 text-center py-2.5 transition border ${
            activeMasterTab === 'browser' 
              ? 'bg-slate-900 border-slate-950 text-white font-black' 
              : 'bg-slate-50 border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100/60'
          }`}
        >
          📚 [2] Active Repository Browser ({documentList.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveMasterTab('trace')}
          className={`flex-1 text-center py-2.5 transition border ${
            activeMasterTab === 'trace' 
              ? 'bg-slate-900 border-slate-950 text-white font-black' 
              : 'bg-slate-50 border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100/60'
          }`}
        >
          🔬 [3] Live Pipeline Trace Lab
        </button>
      </div>

      {/* ========================================================================= */}
      // DYNAMIC RENDER ZONE: ONLY EXECUTES AND DISPLAYS THE ACTIVE SELECTION TAB
      {/* ========================================================================= */}
      <div className="w-full flex-1 min-h-0 flex flex-col mt-2">
        
        {/* VIEW 1: KNOWLEDGE INGESTION MATRIX SYSTEM */}
        {activeMasterTab === 'ingest' && (
          <div className="w-full flex-1 border border-slate-300 bg-white shadow-md p-6 rounded-none overflow-y-auto animate-fadeIn">
            <div className="border-b border-slate-200 pb-2.5 mb-6 flex justify-between items-center">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-700">
                📥 Document Vector Ingestion Console
              </h3>
              <span className="font-mono text-[8px] text-slate-400">PDF STREAM BINARY EXTRACTOR</span>
            </div>

            <form onSubmit={handleBatchIngestionSubmit} className="space-y-5 text-xs max-w-2xl">
                            <div>
                <label className="block text-slate-500 font-bold mb-1.5 uppercase tracking-wide text-[9px] font-mono">
                  Active Target Facility Branch Assignment (Select One or More):
                </label>
                
                <div className="w-full bg-slate-50 border border-slate-300 rounded-none p-3 max-h-36 overflow-y-auto space-y-2">
                  {branches.map((b) => {
                    const isChecked = selectedBranchIds.includes(b.id);
                    return (
                      <label key={b.id} className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer font-medium select-none hover:text-slate-900">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            if (isChecked) {
                              // If checked, filter it out unless it's the last item standing (ensure at least 1 remains active)
                              if (selectedBranchIds.length > 1) {
                                setSelectedBranchIds(selectedBranchIds.filter(id => id !== b.id));
                              }
                            } else {
                              // If unchecked, append it cleanly to the array tracking collection
                              setSelectedBranchIds([...selectedBranchIds, b.id]);
                            }
                          }}
                          className="accent-purple-600 rounded-none border-slate-300 cursor-pointer h-3.5 w-3.5"
                        />
                        <span>📍 {b.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-slate-500 font-bold mb-1.5 uppercase tracking-wide text-[9px] font-mono">
                  Asset Isolation Filtering Scope Link:
                </label>
                <select
                  value={selectedCourtId}
                  onChange={(e) => setSelectedCourtId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-none px-3 py-2 focus:border-purple-600 focus:outline-none text-slate-800 font-medium text-xs"
                >
                  <option value="ALL">🏢 General Branch Scope (Entire Facility Handbook Asset)</option>
                  {courts.map(c => (
                    <option key={c.id} value={c.id}>🎾 Target Specific Court Asset Row — {c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-500 font-bold mb-1.5 uppercase tracking-wide text-[9px] font-mono">
                  Upload Unstructured Compliance / Maintenance Manuals Package:
                </label>
                <div className="border border-dashed border-slate-300 hover:border-purple-500 rounded-none p-10 text-center cursor-pointer transition bg-slate-50/50">
                  <input
                    type="file"
                    multiple
                    accept=".pdf"
                    onChange={(e) => setUploadFiles(e.target.files)}
                    className="w-full text-center text-xs font-mono file:bg-slate-200 file:border-slate-300 file:text-slate-700 file:rounded-none file:px-3 file:py-1.5 file:mr-4 file:cursor-pointer text-slate-500 cursor-pointer"
                  />
                  <p className="text-[10px] text-slate-400 mt-2 font-mono">Supports multiple parallel upload operations. Native PDF files only.</p>
                </div>
                {uploadFiles && (
                  <div className="mt-3 bg-slate-50 p-3 border border-slate-200 font-mono text-[10px] text-purple-700 space-y-1">
                    <div className="font-black border-b border-slate-200 pb-1 uppercase tracking-tight text-[9px] text-slate-500 mb-1">Queue Payload Package List:</div>
                    {Array.from(uploadFiles).map((f, idx) => <div key={idx}>• {f.name} ({(f.size / 1024).toFixed(1)} KB)</div>)}
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={ingestionLoading || !uploadFiles}
                className="w-full md:w-auto bg-slate-900 hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400 text-white font-black px-6 py-3 text-[10px] tracking-wider transition uppercase rounded-none border border-slate-950 shadow shadow-slate-400/40"
              >
                {ingestionLoading ? '🧬 Sharding and Vectorizing Text Blocks...' : '🚀 Process Document Package'}
              </button>
            </form>
          </div>
        )}

        {/* VIEW 2: KNOWLEDGE BASE EXPANDED LIVE REPOSITORY BROWSER */}
        {activeMasterTab === 'browser' && (
          <div className="w-full flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4 items-stretch min-h-0 animate-fadeIn">
            
            {/* SUB PANEL A: FILENAMES SIDEBAR COMPONENT (1/3 Width) */}
            <div className="border border-slate-300 bg-white shadow-md p-4 rounded-none flex flex-col min-h-0">
              <div className="border-b border-slate-200 pb-2 mb-3 flex justify-between items-center shrink-0">
                <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-700">Unique Saved Documents</h4>
                <span className="font-mono text-[8px] text-slate-400">DISTINCT DB HEADERS</span>
              </div>
              
              <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
                {documentList.length > 0 ? (
                  documentList.map((doc, idx) => (
                    <div
                      key={idx}
                      className={`p-3 border transition text-left flex justify-between items-center rounded-none ${
                        selectedDocName === doc.documentName 
                          ? 'bg-purple-50/60 border-purple-400 text-purple-700 font-bold' 
                          : 'bg-white border-slate-200 text-slate-700 hover:border-slate-400'
                      }`}
                    >
                      <div className="truncate pr-2 flex-1 min-w-0">
                        <div className="text-xs truncate font-mono font-bold text-slate-900">{doc.documentName}</div>
                        <div className="text-[9px] text-slate-400 uppercase tracking-tight mt-1 font-mono">Scope: {doc.courtName}</div>
                      </div>
                      
                      <div className="flex items-center gap-1.5 shrink-0 ml-2">
                        {/* 🚀 Select Option Button Trigger Panel */}
                        <span 
                          onClick={() => handleViewDocument(doc.documentName)}
                          className="text-[8px] font-mono uppercase bg-slate-50 hover:bg-slate-100 border border-slate-200 px-1.5 py-0.5 text-slate-500 cursor-pointer select-none transition active:bg-slate-200"
                        >
                          Select
                        </span>
                        
                        {/* 🚀 THE INDEPENDENT PURGE ICON CONTROLLER */}
                        <span 
                          onClick={(e) => {
                            e.stopPropagation(); // Ironclad bubble intercept prevents row click clashes
                            handleDeleteDocument(doc.documentName);
                          }}
                          className="text-[9px] font-mono uppercase bg-red-50 hover:bg-red-100 border border-red-200 px-1.5 py-0.5 text-red-600 cursor-pointer select-none transition active:bg-red-200 font-black"
                          title="Delete Document Package"
                        >
                          🗑️
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-16 text-xs text-slate-400 italic">No manual data files discovered under this tenant partition loop scope.</div>
                )}
              </div>
            </div>

            {/* SUB PANEL B: CHUNK CONTENT VIEWING TERMINAL FULL-DISPLAY (2/3 Width) */}
            <div className="lg:col-span-2 border border-slate-300 bg-white shadow-md p-4 rounded-none flex flex-col min-h-0">
              <div className="border-b border-slate-200 pb-2 mb-3 flex justify-between items-center shrink-0">
                <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-700">Extracted Text Database Chunks Reconstitution</h4>
                <span className="font-mono text-[8px] text-slate-400">PAGE SHARDS</span>
              </div>

              <div className="flex-1 bg-slate-50 border border-slate-200 p-4 overflow-y-auto text-xs leading-relaxed">
                {selectedDocName ? (
                  <div className="space-y-4">
                    <div className="text-[10px] text-purple-700 font-mono font-black uppercase tracking-wider mb-2 border-b border-slate-200 pb-1.5 flex justify-between items-center">
                      <span>📖 RECONSTRUCTING PARSED DOCUMENT: {selectedDocName}</span>
                      {viewerLoading && <span className="animate-pulse text-slate-400 font-bold">STREAMING BLOCK STORAGE...</span>}
                    </div>
                    {documentContents.map((chunk, index) => (
                      <div key={index} className="bg-white border border-slate-200 p-3 shadow-sm rounded-none text-slate-700">
                        <span className="font-mono text-[8px] text-slate-400 block mb-1 font-bold">[PAGE CLASSIFIER INDEX {chunk.pageNumber}]</span>
                        <p className="italic font-medium text-slate-800">"{chunk.textContent}"</p>
                      </div>
                    ))}
                    {documentContents.length === 0 && !viewerLoading && (
                      <div className="text-center py-12 text-slate-400 font-mono">Empty content packet structures detected for this asset entry.</div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-32 text-slate-400 italic text-[11px] font-mono flex flex-col items-center justify-center gap-2">
                    <span>👈 Select a specific document file segment card from the repository sidebar registry panel.</span>
                    <span>The system will automatically query PostgreSQL to stack and order text shards by page logic.</span>
                  </div>
                )}
              </div>
            </div>

          </div>
        )}

        {/* VIEW 3: END-TO-END PIPELINE DIAGNOSTIC TRACE WINDOW */}
        {activeMasterTab === 'trace' && (
          <div className="w-full flex-1 border border-slate-300 bg-white shadow-md p-5 rounded-none min-h-0 flex flex-col animate-fadeIn">
            <div className="border-b border-slate-200 pb-2 mb-4 flex justify-between items-center shrink-0">
              <h3 className="text-[10px] font-black uppercase tracking-wider text-slate-700">
                🔬 Advanced Telemetry Verification & Retrieval Lab
              </h3>
              <span className="font-mono text-[8px] text-slate-400">REALTIME INTER-CONTAINER EVALUATION</span>
            </div>
            
            <div className="w-full flex items-center justify-between bg-slate-100 border border-b-0 border-slate-300 p-2 text-xs font-sans shrink-0">
              <div className="flex items-center gap-3 flex-1 max-w-xl">
                <span className="font-mono text-[9px] font-black uppercase text-slate-500 tracking-wider whitespace-nowrap">
                  📋 AI Macro Clipboard:
                </span>
                
                <select
                  value={selectedMacroId}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSelectedMacroId(val);
                    if (val) handleLoadSelectedMacroText(val);
                  }}
                  className="flex-1 bg-white border border-slate-300 rounded-none px-2 py-1 text-xs text-slate-800 focus:outline-none focus:border-purple-600 font-medium"
                >
                  <option value="">-- Choose a pre-saved prompt blueprint macro template --</option>
                  {macros.map((m) => {
                    // 🚀 SCANNABLE 50-CHARACTER STRING TRUNCATION RULE COMPLIANCE BOUND
                    const truncatedTitle = m.title.length > 50 ? `${m.title.substring(0, 50)}...` : m.title;
                    return (
                      <option key={m.id} value={m.id}>
                        {truncatedTitle}
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* 🚀 THE CONTEXTUAL ELLIPSIS CONSOLE RAIL */}
              <div className="relative z-30">
                <button
                  type="button"
                  onClick={() => setMacroDropdownOpen(!macroDropdownOpen)}
                  className="text-slate-700 hover:text-slate-900 bg-white border border-slate-300 px-3 py-1 font-black text-xs uppercase tracking-widest rounded-none shadow-sm transition active:bg-slate-50"
                >
                  {macroDropdownOpen ? '✕ Close' : '••• Actions'}
                </button>

                {/* Dynamic Slide Down Command Selection Box List Menu */}
                {macroDropdownOpen && (
                  <div className="absolute right-0 mt-1 w-52 bg-white border border-slate-300 rounded-none shadow-xl flex flex-col font-sans divide-y divide-slate-100 text-xs text-slate-800">
                    <button
                      type="button"
                      onClick={() => { setMacroDropdownOpen(false); handleSaveCurrentAsNewMacro(); }}
                      className="px-3 py-2 text-left hover:bg-purple-50 hover:text-purple-700 font-bold transition flex items-center gap-2"
                    >
                      💾 Save Current Text as New
                    </button>
                    <button
                      type="button"
                      disabled={!selectedMacroId}
                      onClick={() => { setMacroDropdownOpen(false); handleUpdateExistingSelectedMacro(); }}
                      className="px-3 py-2 text-left hover:bg-blue-50 hover:text-blue-700 font-bold disabled:text-slate-300 disabled:hover:bg-white transition flex items-center gap-2"
                    >
                      🔄 Update Existing Selected
                    </button>
                    <button
                      type="button"
                      disabled={!selectedMacroId}
                      onClick={() => { setMacroDropdownOpen(false); handleDeleteSelectedMacro(); }}
                      className="px-3 py-2 text-left hover:bg-red-50 hover:text-red-700 font-bold disabled:text-slate-300 disabled:hover:bg-white transition flex items-center gap-2"
                    >
                      🗑️ Delete Macro from Clipboard
                    </button>
                  </div>
                )}
              </div>
            </div>
            {/* QUERY CONTROL INPUT BOX ROW */}
            <form onSubmit={handleExecuteTrace} className="flex w-full gap-2 mb-4 shrink-0 items-end">
              <textarea
                rows={3}
                value={traceQuery}
                disabled={traceLoading}
                onChange={(e) => setTraceQuery(e.target.value)}
                onKeyDown={(e) => {
                  // Allows submitting the form instantly by hitting Enter, while keeping Shift+Enter open for adding new lines!
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleExecuteTrace(e);
                  }
                }}
                placeholder="Type a facility rules question to verify full pipeline execution (e.g. friction indexes, moisture sensory thresholds, sub-surface asset cracks index tracking)..."
                className="flex-1 bg-slate-50 border border-slate-300 rounded-none px-3 py-2 text-xs focus:outline-none focus:border-purple-600 text-slate-800 font-medium font-sans resize-y min-h-[60px]"
              />
              <button
                type="submit"
                disabled={traceLoading || !traceQuery.trim()}
                className="bg-slate-900 hover:bg-slate-800 disabled:bg-slate-200 text-white font-black text-[11px] px-6 py-3 uppercase rounded-none border border-slate-950 transition tracking-wider shrink-0 shadow shadow-slate-400/40 h-[60px]"
              >
                {traceLoading ? 'Tracing...' : 'Run Pipeline Trace'}
              </button>
            </form>

            {/* DIAGNOSTIC LAB INTERNAL PANELS TAB ACTIONS HEADER */}
            <div className="flex border-b border-slate-200 text-[10px] font-black uppercase tracking-wider gap-0.5 shrink-0 mb-4 font-mono">
              <button
                type="button"
                onClick={() => setActiveDiagnosticTab('answer')}
                className={`px-4 py-2 border-b-2 transition ${activeDiagnosticTab === 'answer' ? 'border-purple-600 text-purple-700 bg-slate-50 font-black' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
              >
                💬 Agent Conversational Output
              </button>
              <button
                type="button"
                onClick={() => setActiveDiagnosticTab('citations')}
                className={`px-4 py-2 border-b-2 transition ${activeDiagnosticTab === 'citations' ? 'border-purple-600 text-purple-700 bg-slate-50 font-black' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
              >
                📄 Retracted Sources & Rerank Scores ({citations.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveDiagnosticTab('metrics')}
                className={`px-4 py-2 border-b-2 transition ${activeDiagnosticTab === 'metrics' ? 'border-purple-600 text-purple-700 bg-slate-50 font-black' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
              >
                📊 RAGAS Observability Scores Scoreboard
              </button>
            </div>

            {/* MASTER DIAGNOSTIC DISPLAY CANVAS DISPLAY SCREEN */}
            <div className="flex-1 bg-slate-50 border border-slate-200 p-4 overflow-y-auto text-xs leading-relaxed">
              
              {/* SUBTAB 1: AI STREAM RESPONSE ANSWER BLOCK */}
              {activeDiagnosticTab === 'answer' && (
                <div className="bg-white border border-slate-200 p-4 shadow-sm font-medium text-slate-800 min-h-[100px]">
                  {aiAnswer ? (
                    <p className="whitespace-pre-wrap leading-relaxed">{aiAnswer}</p>
                  ) : (
                    <p className="text-slate-400 italic text-center py-8 font-mono text-[11px]">Enter a prompt rule sentence inside the query console above to initiate trace cycles.</p>
                  )}
                </div>
              )}

              {/* SUBTAB 2: PARSED DOCUMENT PHRASE CITATIONS COMPONENT MATRICES */}
              {activeDiagnosticTab === 'citations' && (
                <div className="space-y-4">
                  {citations.length > 0 ? (
                    citations.map((c) => (
                      <div key={c.id} className="p-4 bg-white border border-slate-200 shadow-sm rounded-none">
                        <div className="flex justify-between items-center text-[9px] text-purple-700 font-mono font-black mb-2 border-b border-slate-100 pb-1.5">
                          <span>📄 UNIQUE FILE ANCHOR ID: {c.documentName} (Page {c.pageNumber})</span>
                          <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-none border border-emerald-200 uppercase font-black text-[8px]">
                            Sentence-Transformers Match Weight: {(c.rerankScore * 100).toFixed(0)}%
                          </span>
                        </div>
                        <p className="text-slate-600 italic font-medium leading-relaxed">"{c.textContent}"</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-slate-400 italic text-center py-12 text-[11px] font-mono">No document phrase citations currently pulled by the database. Verify that documentation package ingestion has executed under this tenant.</p>
                  )}
                </div>
              )}

              {/* SUBTAB 3: DECOUPLED BACKGROUND RAGAS SCORING SYSTEMS EVALUATIONS PANEL */}
              {activeDiagnosticTab === 'metrics' && (
                <div>
                  {metrics ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl font-mono text-[11px] py-2">
                      
                      <div className="p-4 bg-white border border-slate-200 shadow-sm rounded-none flex justify-between items-center">
                        <div>
                          <span className="font-black text-slate-700 block uppercase tracking-wide">Faithfulness Ratio</span>
                          <span className="text-[9px] text-slate-400 font-sans mt-0.5 block">Hallucination Mitigation SLA Guard</span>
                        </div>
                        <span className={`text-base font-black ${(metrics.faithfulnessScore >= 0.85) ? 'text-emerald-600' : 'text-amber-600'}`}>
                          {(metrics.faithfulnessScore * 100).toFixed(0)}%
                        </span>
                      </div>

                      <div className="p-4 bg-white border border-slate-200 shadow-sm rounded-none flex justify-between items-center">
                        <div>
                          <span className="font-black text-slate-700 block uppercase tracking-wide">Answer Relevance</span>
                          <span className="text-[9px] text-slate-400 font-sans mt-0.5 block">User Intent Synchronization Metric</span>
                        </div>
                        <span className="text-base font-black text-emerald-600">
                          {(metrics.answerRelevanceScore * 100).toFixed(0)}%
                        </span>
                      </div>

                    </div>
                  ) : (
                    <p className="text-slate-400 italic text-center py-12 text-[11px] font-mono">RAGAS scoring arrays idle. Run an evaluation search check above to trigger async validation loops.</p>
                  )}
                </div>
              )}
            </div>

            {/* 🛡️ ROLE GATE: Only render the Approval Panel if the user is an Executive Admin */}
            {(isDirector) && (
              <div className="space-y-4 w-full mt-4 shrink-0">
                <div className="p-4 bg-white border border-slate-200 shadow-sm rounded-none">
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
                    <div className="border border-dashed border-slate-200 p-8 text-center text-xs font-sans text-slate-400 italic bg-slate-50/50">
                      No active agent graphs are currently sitting in a paused checkpoint gate. System running fully autonomous.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse border border-slate-200">
                        <thead>
                          <tr className="bg-slate-900 text-white font-mono text-[9px] uppercase tracking-wider">
                            <th className="p-2.5 border border-slate-700 font-black">Target Entity Context</th>
                            <th className="p-2.5 border border-slate-700 font-black">Staged AI Operation</th>
                            <th className="p-2.5 border border-slate-700 font-black">Agent RAG Audit Summary Breakdown</th>
                            <th className="p-2.5 border border-slate-700 font-black text-right">Actions Panel Console</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 text-xs font-sans">
                          {pendingApprovals.map((graph) => (
                            <tr key={graph.threadId} className="hover:bg-slate-50/70 bg-white transition-colors">
                              <td className="p-2.5 border border-slate-200 align-top max-w-[150px]">
                                <p className="font-black text-slate-800 text-[11px] uppercase truncate">{graph.courtName}</p>
                                <span className="text-[8px] font-mono text-slate-400 block mt-1 uppercase tracking-wider select-all">
                                  Thread ID: {graph.threadId.substring(0, 13)}...
                                </span>
                              </td>
                              <td className="p-2.5 border border-slate-200 align-top">
                                <span className={`inline-block text-[9px] font-mono font-black uppercase tracking-tight border px-1.5 py-0.5 mb-1.5 ${
                                  graph.stagedActionType === 'PlayerRefund' ? 'bg-purple-50 border-purple-300 text-purple-700' : 'bg-amber-50 border-amber-300 text-amber-700'
                                }`}>
                                  {graph.stagedActionType === 'PlayerRefund' ? '💸 Payment Reversal' : '🛠️ Purchase Order'}
                                </span>
                                <p className="font-mono font-bold text-slate-900 text-[11px]">{graph.stagedMaterialOrAmount}</p>
                              </td>
                              <td className="p-2.5 border border-slate-200 align-top max-w-sm">
                                <div className="bg-slate-50 border border-slate-200 p-2 font-mono text-[10px] text-slate-600 whitespace-pre-wrap leading-normal shadow-inner max-h-[110px] overflow-y-auto">
                                  {graph.calculatedAuditLog}
                                </div>
                              </td>
                              <td className="p-2.5 border border-slate-200 align-top text-right shrink-0 min-w-[160px]">
                                <div className="flex gap-2 justify-end items-center h-full pt-1">
                                  <button
                                    type="button"
                                    disabled={approvingThreadId !== null}
                                    onClick={() => handleResolveGraphApproval(graph.threadId, 'Reject')}
                                    className="bg-white hover:bg-rose-50 text-rose-600 border-2 border-rose-600 font-black text-[10px] px-3 py-1.5 uppercase rounded-none transition cursor-pointer select-none"
                                  >
                                    ❌ Reject
                                  </button>
                                  <button
                                    type="button"
                                    disabled={approvingThreadId !== null}
                                    onClick={() => handleResolveGraphApproval(graph.threadId, 'Approve')}
                                    className="bg-emerald-600 hover:bg-emerald-500 text-white border-2 border-emerald-700 font-black text-[10px] px-3 py-1.5 uppercase rounded-none transition cursor-pointer select-none"
                                  >
                                    🟢 Approve
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
        )}

      </div>
    </div>
  );
};
