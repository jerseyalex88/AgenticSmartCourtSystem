// File: GlobalAcademy-Frontend/src/pages/PredictiveModelDashboard.tsx
import React, { useState, useEffect } from 'react';
import { apiClient } from '../api/apiClient';
import CourtSpatialHeatmap from '../components/CourtSpatialHeatmap';

interface SectorImpact {
  id: string;
  name: string;
  bounce_count: number;
  wear_intensity_index: number;
}

interface BouncePoint {
  x: number;
  y: number;
  intensity: string;
}

interface CompleteHeatmapData {
  court_id: string;
  total_processed_bounces: number;
  analyzed_video_filename: string;
  last_updated_utc: string;
  sectors: SectorImpact[];
  bounce_points: BouncePoint[];
}

interface CourtHealthOverview {
  courtId: string;
  courtName: string;
  branchName: string;
  surfaceType: string;
  status: string;
  heatmap: CompleteHeatmapData | null;
  predictiveHeatmap: CompleteHeatmapData | null; // 🔮 New Parallel Database Stream Node!
}

export default function PredictiveModelDashboard() {
  const [courts, setCourts] = useState<CourtHealthOverview[]>([]);
  const [selectedCourtId, setSelectedCourtId] = useState<string>('');
  const [uploading, setUploading] = useState<boolean>(false);
  const [dragActive, setDragActive] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>('📟 STANDBY // Select an active multi-tenant court asset row to inspect...');

  // 1. Core Data Fetching Loop
  const fetchAllModelSummaries = async () => {
    try {
      const response = await apiClient.get('/maintenance/academy-court-health-summary');
      setCourts(response.data);
      if (response.data.length > 0 && !selectedCourtId) {
        setSelectedCourtId(response.data[0].courtId);
      }
    } catch (err: any) {
      console.error(err);
      setStatusMessage(`❌ [DATA ACCESS FAULT]: Failed to populate network data: ${err.message}`);
    }
  };

  useEffect(() => {
    fetchAllModelSummaries();
  }, []);

  const activeCourt = courts.find(c => c.courtId === selectedCourtId);

  // 2. Parallel Predictive Multipart Media Ingestion Handler
  const handlePredictiveUpload = async (file: File) => {
    if (!file || !selectedCourtId) return;

    setUploading(true);
    setStatusMessage(`📤 [PREDICTIVE INGESTION]: Streaming blocks to Parallel Kalman AI Engine pipeline...`);

    const uploadPayload = new FormData();
    uploadPayload.append('courtId', selectedCourtId);
    uploadPayload.append('videoFile', file);

    try {
      const response = await apiClient.post('/maintenance/court-video/upload', uploadPayload, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setStatusMessage(`🚀 [PREDICTIVE ACCEPTS]: Asynchronous Kalman processing task running. Job ID: ${response.data.job_id || 'Queued'}`);
    } catch (err: any) {
      console.error(err);
      setStatusMessage(`❌ [PIPELINE ERROR]: Media processing handshake dropped: ${err.message}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="p-6 font-mono bg-slate-950 text-slate-100 min-h-screen space-y-6">
      
      {/* BRANDING HUB DECK BANNER */}
      <div className="border border-slate-800 bg-slate-900 p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-purple-500 animate-ping" />
            <h1 className="text-md font-black uppercase tracking-tight m-0 text-slate-100">
              🔮 Advanced AI Predictive Analysis Sandbox
            </h1>
          </div>
          <p className="text-[10px] text-slate-400 mt-1 max-w-2xl font-sans font-medium leading-none">
            Deep-tech telemetry visualization comparing original computer vision object track profiles straight against real-time Linear Kalman Filter state space vector estimations.
          </p>
        </div>
        <div className="flex gap-2">
          <select 
            value={selectedCourtId} 
            onChange={(e) => setSelectedCourtId(e.target.value)}
            className="bg-slate-950 border border-slate-700 text-xs px-3 py-1.5 font-bold uppercase text-slate-300"
          >
            {courts.map(c => (
              <option key={c.courtId} value={c.courtId}>{c.courtName} ({c.branchName})</option>
            ))}
          </select>
          <button 
            onClick={fetchAllModelSummaries}
            className="bg-purple-700 hover:bg-purple-600 border border-purple-500 text-white font-black text-xs px-4 py-1.5 uppercase transition"
          >
            🔄 Sync Data Matrix
          </button>
        </div>
      </div>

      {/* SPLIT PANEL VIEW WORKSPACE GRID */}
      {activeCourt ? (
        <div className="space-y-6">
          
          {/* UPLOAD CONTROLS DROPZONE AREA */}
          <div 
            className={`border border-dashed p-6 text-center transition ${
              dragActive ? 'border-purple-500 bg-purple-950/20' : 'border-slate-800 bg-slate-900/40 hover:border-slate-700'
            }`}
            onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
            onDragLeave={(e) => { e.preventDefault(); setDragActive(false); }}
            onDrop={(e) => {
              e.preventDefault();
              setDragActive(false);
              if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                handlePredictiveUpload(e.dataTransfer.files[0]);
              }
            }}
          >
            {uploading ? (
              <div className="animate-pulse space-y-2 py-2">
                <div className="text-purple-400 font-black text-xs uppercase tracking-wider">⚙️ PIPING VIDEO BYTE BLOCKS TO KALMAN WORKER RESIDUE...</div>
                <p className="text-[9px] text-slate-500">Do not navigate away from this evaluation frame buffer loops window parameters.</p>
              </div>
            ) : (
              <div className="relative max-w-md mx-auto cursor-pointer">
                <input 
                  type="file" 
                  accept="video/*" 
                  onChange={(e) => { if (e.target.files && e.target.files[0]) handlePredictiveUpload(e.target.files[0]); }}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                />
                <div className="text-slate-200 font-black text-xs uppercase tracking-tight">📥 DRAG & DROP CCTV MATCH VIDEO TO FIRE PREDICTIVE MODEL</div>
                <p className="text-slate-500 text-[10px] mt-1 font-sans font-medium leading-tight">
                  Uploaded files feed the parallel <span className="text-purple-400 font-bold">Kalman Filter</span> array pipeline, automatically reconciling tracking drops caused by extreme frame blur.
                </p>
              </div>
            )}
          </div>

          {/* THE SIDE-BY-SIDE EVALUATOR MATRIX CONTAINER */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* LEFT ENGINE BLOCK: ORIGINAL BASELINE (CONTROL MODEL) */}
            <div className="border border-slate-800 bg-slate-900/60 p-4 space-y-4">
              <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                <div>
                  <span className="text-xs font-black text-slate-300 uppercase tracking-tight block">📐 MODEL 1: ORIGINAL TRACKING (CONTROL SYSTEM)</span>
                  <span className="text-[8px] text-slate-500 font-mono mt-0.5 block truncate max-w-xs">
                    FILE: {activeCourt.heatmap?.analyzed_video_filename || '[PENDING RUN]'}
                  </span>
                </div>
                <span className="bg-slate-950 text-slate-400 border border-slate-800 font-black text-[10px] px-2 py-0.5">
                  STRIKES: {activeCourt.heatmap?.total_processed_bounces ?? 0}
                </span>
              </div>
              
              <div className="relative border border-slate-950 bg-slate-950 p-2">
                <CourtSpatialHeatmap 
                  bouncePoints={activeCourt.heatmap?.bounce_points ?? []} 
                  totalProcessedBounces={activeCourt.heatmap?.total_processed_bounces ?? 0} 
                />
              </div>
            </div>

            {/* RIGHT ENGINE BLOCK: KALMAN FILTER PREDICTIVE MATRIX (CHALLENGER MODEL) */}
            <div className="border border-slate-800 bg-slate-900/60 p-4 space-y-4 shadow-[0_0_20px_rgba(147,51,234,0.08)]">
              <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                <div>
                  <span className="text-xs font-black text-purple-400 uppercase tracking-tight block">🔮 MODEL 2: ADVANCED PREDICTIVE EST. (KALMAN RAIL)</span>
                  <span className="text-[8px] text-purple-300/60 font-mono mt-0.5 block truncate max-w-xs">
                    FILE: {activeCourt.predictiveHeatmap?.analyzed_video_filename || '[PENDING RUN]'}
                  </span>
                </div>
                <span className="bg-purple-950/40 text-purple-400 border border-purple-900/60 font-black text-[10px] px-2 py-0.5 shadow-[0_0_10px_rgba(147,51,234,0.2)]">
                  STRIKES: {activeCourt.predictiveHeatmap?.total_processed_bounces ?? 0}
                </span>
              </div>

              <div className="relative border border-slate-950 bg-slate-950 p-2">
                {/* Draws coordinates pulling straight out of the fresh parallel database jsonb column! */}
                <CourtSpatialHeatmap 
                  bouncePoints={activeCourt.predictiveHeatmap?.bounce_points ?? []} 
                  totalProcessedBounces={activeCourt.predictiveHeatmap?.total_processed_bounces ?? 0} 
                />
              </div>
            </div>

          </div>
        </div>
      ) : (
        <div className="text-center p-12 text-slate-600 text-xs">Loading active sandbox topologies...</div>
      )}

      {/* CONSOLE STATUS LOGGER FOOTER BANNER */}
      <div className="bg-slate-950 border border-slate-800 p-2 text-[10px] font-bold text-slate-400 tracking-tight">
        📟 SYSTEM STATUS LOG // {statusMessage}
      </div>

    </div>
  );
}