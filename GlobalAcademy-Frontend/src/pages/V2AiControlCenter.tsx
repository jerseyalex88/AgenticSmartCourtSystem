import React, { useState, useEffect } from 'react';
import { apiClient } from '../api/apiClient';

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

export const V2AiControlCenter: React.FC = () => {
  // 🚀 MASTER NAVIGATION STATE: Tracks which panel section is visible
  const [activeMasterTab, setActiveMasterTab] = useState<'ingest' | 'browser' | 'trace'>('ingest');

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
      // alert('🚀 Ingestion package successfully committed across all targeted branch assets!');
      setUploadFiles(null);
      await fetchUploadedDocumentsRepository();
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

  const handleExecuteTrace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!traceQuery.trim()) return;

    setTraceLoading(true);
    try {
      // 🚀 FIXED: Capitalized key parameter strings to align perfectly with .NET DTO models!
      const res = await apiClient.post('/v2/ai-knowledge-ops/execute-pipeline-trace', {
        UserInput: traceQuery,
        BranchId: selectedBranchIds.length > 0 ? selectedBranchIds[0] : selectedBranchId, 
        CourtId: selectedCourtId !== 'ALL' ? selectedCourtId : null,
        VoiceKey: 'en-US-JennyNeural'
      });

      setAiAnswer(res.data.conversationalSpeechOutput);
      setCitations(res.data.retractedContextSources || []);
      setMetrics(res.data.pipelinePerformance);
    } catch (e: any) {
      console.error('Trace execution failed structural validation loops:', e);
      // alert('Diagnostic transaction pipeline handshake broken.');
    } finally {
      setTraceLoading(false);
    }
  };

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
                      onClick={() => handleViewDocument(doc.documentName)}
                      className={`p-3 border transition text-left flex justify-between items-center rounded-none cursor-pointer ${
                        selectedDocName === doc.documentName 
                          ? 'bg-purple-50/60 border-purple-400 text-purple-700 font-bold' 
                          : 'bg-white border-slate-200 text-slate-700 hover:border-slate-400'
                      }`}
                    >
                      <div className="truncate pr-2">
                        <div className="text-xs truncate font-mono font-bold text-slate-900">{doc.documentName}</div>
                        <div className="text-[9px] text-slate-400 uppercase tracking-tight mt-1 font-mono">Scope: {doc.courtName}</div>
                      </div>
                      <span className="text-[8px] font-mono uppercase bg-slate-50 border border-slate-200 px-1.5 py-0.5 text-slate-500 shrink-0">Select</span>
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
            
            {/* QUERY CONTROL INPUT BOX ROW */}
            <form onSubmit={handleExecuteTrace} className="flex gap-2 mb-4 shrink-0 max-w-4xl items-end">
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

          </div>
        )}

      </div>
    </div>
  );
};
