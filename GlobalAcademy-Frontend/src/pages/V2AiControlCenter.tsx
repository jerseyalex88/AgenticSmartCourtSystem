import React, { useState, useEffect } from 'react';
import { apiClient } from '../api/apiClient'; // Adjust to point to your standard axios/api client file

interface DocumentItem {
  documentName: string; // 🚀 SYNCHRONIZED WITH C# PROPERTY: camelCase
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
  reRankScore: number;
}

interface PipelineMetrics {
  faithfulnessScore: number;
  answerRelevanceScore: number;
  contextPrecisionScore: number;
}

interface Branch {
  id: string;
  name: string;
  description: string;
  timeZoneId: string;
}

interface Court {
  id: string;
  branchId: string;
  name: string;
  description: string;
  surfaceType: string;
  isIndoor: boolean;
  status: string;
  dryCoefficient: number;
  aggregateMinutesPlayed: number;
  maintenanceThresholdMinutes: number;
}

interface CourtDropdownItem { id: string; name: string; }
interface BranchDropdownItem { id: string; name: string; }

export const V2AiControlCenter: React.FC = () => {
  // Master structural dropdown lookups mapped precisely to your models
  const [branches, setBranches] = useState<Branch[]>([]);
  const [courts, setCourts] = useState<Court[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [selectedCourtId, setSelectedCourtId] = useState('ALL');

  // Panel 1: Ingestion state
  const [uploadFiles, setUploadFiles] = useState<FileList | null>(null);
  const [ingestionLoading, setIngestionLoading] = useState(false);

  // Panel 2: Knowledge base list & viewer states
  const [documentList, setDocumentList] = useState<DocumentItem[]>([]);
  const [selectedDocName, setSelectedDocName] = useState<string | null>(null);
  const [documentContents, setDocumentContents] = useState<TextChunk[]>([]);
  const [viewerLoading, setViewerLoading] = useState(false);
  const [loading, setLoading] = useState<boolean>(true);

  // Panel 3: Trace testing states
  const [traceQuery, setTraceQuery] = useState('');
  const [traceLoading, setTraceLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'answer' | 'citations' | 'metrics'>('answer');
  const [aiAnswer, setAiAnswer] = useState('');
  const [citations, setCitations] = useState<RetrievedCitation[]>([]);
  const [metrics, setMetrics] = useState<PipelineMetrics | null>(null);

  // Trigger base branches pull upon dashboard mount
  useEffect(() => {
    fetchInitialData();
  }, []);

  // Cascading rule handler: Auto-fetch matching courts whenever the Branch ID state transitions
  useEffect(() => {
    if (selectedBranchId) {
      fetchCourtsForSelectedBranch(selectedBranchId);
      setSelectedCourtId('ALL'); // Reset selection ceiling back to broad facility scope safely
    } else {
      setCourts([]);
    }
  }, [selectedBranchId]);

  // Hydrate branches and existing files list upon mounting
  useEffect(() => {
    fetchUploadedDocuments();
  }, []);

    const fetchInitialData = async () => {
    try {
      setLoading(true);
      const branchRes = await apiClient.get<Branch[]>('/Facility/branches');
      setBranches(branchRes.data || []);
      
      if (branchRes.data.length > 0 && !selectedBranchId) {
        setSelectedBranchId(branchRes.data[0].id);
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

  const fetchUploadedDocuments = async () => {
    try {
      const res = await apiClient.get('/v2/ai-knowledge-ops/list-uploaded-documents');
      setDocumentList(res.data || []);
    } catch (e) { console.error("Failed to query knowledge list.", e); }
  };

  const handleBatchIngestionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFiles || uploadFiles.length === 0 || !selectedBranchId) return;

    setIngestionLoading(true);
    const formData = new FormData();
    formData.append('branchId', selectedBranchId);
    if (selectedCourtId !== 'ALL') formData.append('courtId', selectedCourtId);
    
    for (let i = 0; i < uploadFiles.length; i++) {
      formData.append('documentFiles', uploadFiles[i]);
    }

    try {
      await apiClient.post('/v2/ai-knowledge-ops/ingest-manuals', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      alert('🚀 Ingestion request accepted into the background processing queue!');
      setUploadFiles(null);
      // Refresh documents repository summary view
      setTimeout(fetchUploadedDocuments, 3000);
    } catch (err: any) {
      alert(`Ingestion Failure: ${err.response?.data || err.message}`);
    } finally { setIngestionLoading(false); }
  };

  const handleViewDocument = async (docName: string) => {
    setSelectedDocName(docName);
    setViewerLoading(true);
    try {
      const res = await apiClient.get(`/v2/ai-knowledge-ops/view-document-contents?documentName=${encodeURIComponent(docName)}`);
      setDocumentContents(res.data || []);
    } catch (e) { alert('Failed to reconstruct text contents.'); }
    finally { setViewerLoading(false); }
  };

  const handleExecuteTrace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!traceQuery.trim()) return;

    setTraceLoading(true);
    try {
      const res = await apiClient.post('/v2/ai-knowledge-ops/execute-pipeline-trace', {
        userInput: traceQuery,
        voiceKey: 'en-US-GuyNeural'
      });

      setAiAnswer(res.data.conversationalSpeechOutput);
      setCitations(res.data.retractedContextSources || []);
      setMetrics(res.data.pipelinePerformance);
    } catch (e: any) { alert('Trace transaction broken.'); }
    finally { setTraceLoading(false); }
  };

  return (
    // 🚀 FIXED: Swapped out narrow auto-margins for full viewport fluid width distribution
    <div className="w-full max-w-[100vw] space-y-3 font-sans p-4 bg-slate-50 min-h-screen text-slate-800">
    
    {/* GLOBAL BANNER VIEW ROW */}
    <div className="w-full">
      <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
        📡 AI Operational Knowledge & Diagnostics Lab
      </h2>
      <p className="text-xs text-slate-500 mt-1 font-mono">
        Multi-tenant PDF extraction pipelines and FlashRank cross-encoder trace evaluation matrices.
      </p>
    </div>

    {/* TOPOLOGY COLLAPSIBLE DRAWER WORKSPACE (Your Existing Component Renders Directly Here) */}
    <div className="w-full border border-slate-300 bg-white shadow-md">
       {/* ... Your exact topology collapsible drawer elements render here untouched ... */}
    </div>

    {/* 🚀 THREE-COLUMN AI ADMINISTRATIVE MASTER GRID TRACKS */}
    <div className="w-full grid grid-cols-1 xl:grid-cols-3 gap-4 items-start mt-4">
      
      {/* PANEL 1: KNOWLEDGE INGESTION SUB-SYSTEM */}
      <div className="w-full border border-slate-300 bg-white shadow-md p-4 rounded-none min-h-[460px]">
        <div className="border-b border-slate-200 pb-2 mb-4 flex justify-between items-center">
          <h3 className="text-[10px] font-black uppercase tracking-wider text-slate-700">
            📥 Ingestion Matrix Terminal
          </h3>
          <span className="font-mono text-[8px] text-slate-400">PDF STREAM PARSER</span>
        </div>

        <form onSubmit={handleBatchIngestionSubmit} className="space-y-4 text-[11px]">
          <div>
            <label className="block text-slate-500 font-bold mb-1.5 uppercase tracking-wide text-[9px] font-mono">Active Target Branch Reference:</label>
            <select
              value={selectedBranchId}
              onChange={(e) => setSelectedBranchId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-none px-2.5 py-1.5 focus:border-purple-600 focus:outline-none text-slate-800 font-medium"
            >
              {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-slate-500 font-bold mb-1.5 uppercase tracking-wide text-[9px] font-mono">Asset Isolation Filtering Scope:</label>
            <select
              value={selectedCourtId}
              onChange={(e) => setSelectedCourtId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-none px-2.5 py-1.5 focus:border-purple-600 focus:outline-none text-slate-800 font-medium"
            >
              <option value="ALL">🏢 General Branch Scope (Entire Facility Handbook)</option>
              {courts.map(c => (
                <option key={c.id} value={c.id}>🎾 Target Specific Asset Row — {c.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-slate-500 font-bold mb-1.5 uppercase tracking-wide text-[9px] font-mono">Select Manuals Vector Package:</label>
            <div className="border border-dashed border-slate-300 hover:border-purple-500 rounded-none p-6 text-center cursor-pointer transition bg-slate-50/50">
              <input
                type="file"
                multiple
                accept=".pdf"
                onChange={(e) => setUploadFiles(e.target.files)}
                className="w-full text-center text-[10px] font-mono file:bg-slate-200 file:border-slate-300 file:text-slate-700 file:rounded-none file:px-2 file:py-1 file:mr-2 text-slate-500 cursor-pointer"
              />
            </div>
            {uploadFiles && (
              <div className="mt-2 bg-slate-50 p-2 border border-slate-200 font-mono text-[9px] text-purple-700 space-y-1">
                {Array.from(uploadFiles).map((f, idx) => <div key={idx}>• {f.name} ({(f.size / 1024).toFixed(1)} KB)</div>)}
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={ingestionLoading || !uploadFiles}
            className="w-full bg-slate-900 hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400 text-white font-black py-2 text-[10px] tracking-wider transition uppercase rounded-none mt-4 border border-slate-950"
          >
            {ingestionLoading ? '🧬 Committing Document Chunks...' : '🚀 Process Data Package'}
          </button>
        </form>
      </div>

      {/* PANEL 2: KNOWLEDGE BASE EXPLANDED LIVE BROWSER */}
      <div className="w-full border border-slate-300 bg-white shadow-md p-4 rounded-none min-h-[460px] flex flex-col">
        <div className="border-b border-slate-200 pb-2 mb-3 flex justify-between items-center shrink-0">
          <h3 className="text-[10px] font-black uppercase tracking-wider text-slate-700">
            📚 Active Repository Browser
          </h3>
          <span className="font-mono text-[8px] text-slate-400">DISTINCT POSTGRES ROWS</span>
        </div>
        
        {/* DOCUMENT CHIPS COLLECTION BOX */}
        <div className="grid grid-cols-1 gap-1.5 overflow-y-auto max-h-[140px] border-b border-slate-200 pb-3 mb-3 shrink-0">
          {documentList.length > 0 ? (
            documentList.map((doc, idx) => (
              <div
                key={idx}
                onClick={() => handleViewDocument(doc.documentName)}
                className={`p-2 border transition text-left flex justify-between items-center rounded-none ${
                  selectedDocName === doc.documentName 
                    ? 'bg-purple-50/60 border-purple-400 text-purple-700 font-bold' 
                    : 'bg-white border-slate-200 text-slate-700 hover:border-slate-400'
                }`}
              >
                <div className="truncate max-w-[200px]">
                  <div className="text-[11px] truncate font-mono font-bold">{doc.documentName}</div>
                  <div className="text-[9px] text-slate-400 uppercase tracking-tight mt-0.5">Scope Anchor: {doc.courtName}</div>
                </div>
                <span className="text-[8px] font-mono uppercase bg-slate-100 border border-slate-200 px-1 py-0.5 text-slate-500">View</span>
              </div>
            ))
          ) : (
            <div className="text-center py-6 text-[10px] text-slate-400 italic">No manual data matrices mapped under this tenant filter.</div>
          )}
        </div>

        {/* CHUNK CONTENT VIEWING LAYOUT SCREEN */}
        <div className="flex-1 bg-slate-50 border border-slate-200 p-3 overflow-y-auto max-h-[220px] text-[11px] leading-relaxed">
          {selectedDocName ? (
            <div>
              <div className="text-[9px] text-purple-700 font-mono font-black uppercase tracking-wider mb-2 border-b border-slate-200 pb-1 flex justify-between items-center">
                <span>📖 REGISTRY ID: {selectedDocName}</span>
                {viewerLoading && <span className="animate-pulse text-slate-400">Reading Stream...</span>}
              </div>
              {documentContents.map((chunk, index) => (
                <div key={index} className="mb-3 border-b border-slate-200 pb-2 text-slate-700">
                  <span className="font-mono text-[8px] text-slate-400 block mb-0.5">[PAGE INDEX {chunk.pageNumber}]</span>
                  <p className="italic">"{chunk.textContent}"</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-slate-400 italic text-[10px] font-mono">Select a file segment header asset above to reconstruct text chunks.</div>
          )}
        </div>
      </div>

      {/* PANEL 3: END-TO-END PIPELINE DIAGNOSTIC TRACE WINDOW */}
      <div className="w-full border border-slate-300 bg-white shadow-md p-4 rounded-none min-h-[460px] flex flex-col">
        <div className="border-b border-slate-200 pb-2 mb-3 flex justify-between items-center shrink-0">
          <h3 className="text-[10px] font-black uppercase tracking-wider text-slate-700">
            🔬 Live Pipeline Trace Diagnostics
          </h3>
          <span className="font-mono text-[8px] text-slate-400">LANGSMITH METRICS TELEMETRY</span>
        </div>
        
        <form onSubmit={handleExecuteTrace} className="flex gap-2 mb-3 shrink-0">
          <input
            type="text"
            value={traceQuery}
            disabled={traceLoading}
            onChange={(e) => setTraceQuery(e.target.value)}
            placeholder="Ask a technical or maintenance parameter rule..."
            className="flex-1 bg-slate-50 border border-slate-300 rounded-none px-2.5 py-1.5 text-[11px] focus:outline-none focus:border-purple-600 text-slate-800"
          />
          <button
            type="submit"
            disabled={traceLoading || !traceQuery.trim()}
            className="bg-slate-900 hover:bg-slate-800 disabled:bg-slate-200 text-white font-black text-[10px] px-3 py-1.5 uppercase rounded-none border border-slate-950 transition"
          >
            {traceLoading ? 'Tracing...' : 'Run'}
          </button>
        </form>

        {/* TAB SYSTEM CONTROLS HEADER */}
        <div className="flex border-b border-slate-200 text-[9px] font-black uppercase tracking-wider gap-0.5 shrink-0 mb-3 font-mono">
          <button
            type="button"
            onClick={() => setActiveTab('answer')}
            className={`px-3 py-1.5 border-b-2 transition ${activeTab === 'answer' ? 'border-purple-600 text-purple-700 bg-slate-50' : 'border-transparent text-slate-400'}`}
          >
            💬 Core Response
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('citations')}
            className={`px-3 py-1.5 border-b-2 transition ${activeTab === 'citations' ? 'border-purple-600 text-purple-700 bg-slate-50' : 'border-transparent text-slate-400'}`}
          >
            📄 Sources ({citations.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('metrics')}
            className={`px-3 py-1.5 border-b-2 transition ${activeTab === 'metrics' ? 'border-purple-600 text-purple-700 bg-slate-50' : 'border-transparent text-slate-400'}`}
          >
            📊 RAGAS Validation
          </button>
        </div>

        {/* TRACE DISPLAY SCREEN */}
        <div className="flex-1 bg-slate-50 border border-slate-200 p-3 overflow-y-auto max-h-[240px] text-[11px] leading-relaxed">
          {activeTab === 'answer' && (
            <div>
              {aiAnswer ? (
                <p className="text-slate-800 font-medium whitespace-pre-wrap">{aiAnswer}</p>
              ) : (
                <p className="text-slate-400 italic text-center py-12 text-[10px] font-mono">Execute an active trace verification script query.</p>
              )}
            </div>
          )}

          {activeTab === 'citations' && (
            <div className="space-y-3">
              {citations.length > 0 ? (
                citations.map((c) => (
                  <div key={c.id} className="p-2.5 bg-white border border-slate-200 shadow-sm rounded-none">
                    <div className="flex justify-between items-center text-[8px] text-purple-700 font-mono font-bold mb-1.5 border-b border-slate-100 pb-1">
                      <span>📄 FILE REF: {c.documentName} (Pg {c.pageNumber})</span>
                      <span className="bg-emerald-50 text-emerald-700 px-1 rounded-none border border-emerald-200 uppercase font-black text-[7px]">
                        Cross-Score: {(c.reRankScore * 100).toFixed(0)}%
                      </span>
                    </div>
                    <p className="text-slate-600 italic">"{c.textContent}"</p>
                  </div>
                ))
              ) : (
                <p className="text-slate-400 italic text-center py-12 text-[10px] font-mono">No reference citations currently pulled by the database.</p>
              )}
            </div>
          )}

          {activeTab === 'metrics' && (
            <div>
              {metrics ? (
                <div className="space-y-2 py-1 font-mono text-[10px]">
                  <div className="p-2 bg-white border border-slate-200 shadow-sm rounded-none flex justify-between items-center">
                    <div>
                      <span className="font-black text-slate-700 block uppercase">Faithfulness Ratio</span>
                      <span className="text-[8px] text-slate-400">Hallucination Mitigation SLA Guard</span>
                    </div>
                    <span className={`text-xs font-black ${(metrics.faithfulnessScore >= 0.85) ? 'text-emerald-600' : 'text-amber-600'}`}>
                      {(metrics.faithfulnessScore * 100).toFixed(0)}%
                    </span>
                  </div>

                  <div className="p-2 bg-white border border-slate-200 shadow-sm rounded-none flex justify-between items-center">
                    <div>
                      <span className="font-black text-slate-700 block uppercase">Answer Relevance</span>
                      <span className="text-[8px] text-slate-400">User Prompt Intent Synchronization</span>
                    </div>
                    <span className="text-xs font-black text-emerald-600">
                      {(metrics.answerRelevanceScore * 100).toFixed(0)}%
                    </span>
                  </div>

                  <div className="p-2 bg-white border border-slate-200 shadow-sm rounded-none flex justify-between items-center">
                    <div>
                      <span className="font-black text-slate-700 block uppercase">Retrieval Precision</span>
                      <span className="text-[8px] text-slate-400">Sentence-Transformers Reranker Sorting</span>
                    </div>
                    <span className="text-xs font-black text-purple-600">
                      {(metrics.contextPrecisionScore * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-slate-400 italic text-center py-12 text-[10px] font-mono">Metrics idle. Fire a transaction query to boot the scoring loops.</p>
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  </div>
);
};
