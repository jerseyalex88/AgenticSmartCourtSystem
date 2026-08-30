import React, { useState, useRef } from 'react';
import type { MouseEvent, ChangeEvent } from 'react';
import { apiClient } from '../api/apiClient';

interface Point {
  x: number;
  y: number;
}

interface CourtGeometryCalibratorProps {
  courtId: string;
  courtName: string;
  isOpen: boolean;
  onClose: () => void;
  onSaveSuccess: () => void;
}

const CLICK_STEPS = [
  { label: 'TOP-LEFT', desc: 'Click the outermost left corner of the FAR baseline (Ad Court corner).' },
  { label: 'TOP-RIGHT', desc: 'Click the outermost right corner of the FAR baseline (Deuce Court corner).' },
  { label: 'BOTTOM-LEFT', desc: 'Click the outermost left corner of the NEAR baseline (Ad Court near corner).' },
  { label: 'BOTTOM-RIGHT', desc: 'Click the outermost right corner of the NEAR baseline (Deuce Court near corner).' }
];

export default function CourtGeometryCalibrator({
  courtId,
  courtName,
  isOpen,
  onClose,
  onSaveSuccess
}: CourtGeometryCalibratorProps) {
  const [clicks, setClicks] = useState<Point[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [logMessage, setLogMessage] = useState('');
  
  // 🛠️ NEW PHOTO UPLOAD ARCHITECTURE STATE
  const [selectedPhoto, setSelectedPhoto] = useState<File | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string>('');

  const containerRef = useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

  const currentStep = clicks.length;

  // Handles reading the local image file to draw it on the background canvas canvas
  const handlePhotoSelect = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setSelectedPhoto(file);
      setClicks([]); // Reset clicks to prevent matrix mismatch if a new photo loads
      
      // Generate a temporary local browser object URL so the manager can click on it live
      const localUrl = URL.createObjectURL(file);
      setPhotoPreviewUrl(localUrl);
      setLogMessage(`📸 Loaded image file: ${file.name}. Ready for edge coordinate calibration sequence.`);
    }
  };

  const handleImageClick = (e: MouseEvent<HTMLDivElement>) => {
    if (!selectedPhoto) {
      setLogMessage('⚠️ BLOCK: Please select and upload a valid camera snapshot frame photo first.');
      return;
    }
    if (clicks.length >= 4) return;
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.round(e.clientX - rect.left);
    const y = Math.round(e.clientY - rect.top);

    const updatedClicks = [...clicks, { x, y }];
    setClicks(updatedClicks);
    
    if (updatedClicks.length === 4) {
      setLogMessage('✨ All 4 structural corners captured! Ready to commit settings.');
    }
  };

  const handleReset = () => {
    setClicks([]);
    setLogMessage(selectedPhoto ? `Form reset. Ready to recalibrate on ${selectedPhoto.name}` : '');
  };

  const handleClearAll = () => {
    setClicks([]);
    setSelectedPhoto(null);
    if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl); // Free up local browser memory slots
    setPhotoPreviewUrl('');
    setLogMessage('');
  };

  const handleSaveCalibration = async () => {
    if (clicks.length !== 4 || !containerRef.current || !selectedPhoto) return;

    setIsSaving(true);
    setLogMessage('📡 Transmitting camera geometry parameters to .NET multi-tenant gateway...');

    // 🎯 FIXED: Extract from sequential array indexes explicitly to pass character-perfect parameters!
    const payload = {
      videoWidth: containerRef.current.clientWidth,
      videoHeight: containerRef.current.clientHeight,
      calibrationPhotoFilename: selectedPhoto.name,
      
      topLeftX: clicks[0].x,
      topLeftY: clicks[0].y,
      
      topRightX: clicks[1].x,
      topRightY: clicks[1].y,
      
      bottomLeftX: clicks[2].x,
      bottomLeftY: clicks[2].y,
      
      bottomRightX: clicks[3].x,
      bottomRightY: clicks[3].y
    };

    try {
      await apiClient.put(`/maintenance/courts/${courtId}/calibration`, payload);
      setLogMessage('✅ Calibration matrix successfully saved to PostgreSQL!');
      setTimeout(() => {
        onSaveSuccess();
        onClose();
        handleClearAll();
      }, 1500);
    } catch (err: any) {
      console.error(err);
      setLogMessage(`❌ Failed to lock coordinates: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 flex items-center justify-center z-50 p-4 font-mono select-none">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-4xl shadow-2xl p-6 relative flex flex-col gap-4 text-slate-200">
        
        {/* HEADER BLOCK */}
        <div className="flex justify-between items-center border-b border-slate-700 pb-3">
          <div>
            <span className="text-purple-400 text-xs font-black uppercase tracking-wider block">📐 OPTICAL CAMERA CALIBRATION SUITE</span>
            <h2 className="text-md font-black text-slate-100 uppercase tracking-tight mt-0.5">Configuring: {courtName}</h2>
          </div>
          <button 
            onClick={() => { onClose(); handleClearAll(); }}
            className="text-slate-500 hover:text-slate-300 font-bold text-xs p-1 border border-slate-800 hover:border-slate-700 bg-slate-950"
          >
            [CLOSE ESC]
          </button>
        </div>

        {/* TASK INSTRUCTION PANELS BANNER */}
        <div className="bg-slate-950 border border-slate-800 p-3 rounded-none">
          {!selectedPhoto ? (
            <div className="text-amber-400 text-[10px] font-bold uppercase tracking-wide flex items-center gap-2">
              <span>⚠️ PENDING CAPTURE FRAME: UPLOAD CALIBRATION PICTURE TO START</span>
            </div>
          ) : currentStep < 4 ? (
            <div className="flex items-start gap-3">
              <span className="bg-purple-900 text-purple-200 text-[10px] font-black px-1.5 py-0.5 border border-purple-600 animate-pulse uppercase">
                Step {currentStep + 1} of 4
              </span>
              <div className="text-[11px]">
                <span className="text-slate-300 font-black uppercase tracking-wide">TARGET: [{CLICK_STEPS[currentStep].label}]</span>
                <p className="text-slate-400 mt-0.5 font-sans leading-tight font-medium text-[10px]">{CLICK_STEPS[currentStep].desc}</p>
              </div>
            </div>
          ) : (
            <div className="text-emerald-400 text-[10px] font-bold uppercase tracking-wide">
              🚀 ALL CALIBRATION VERTICES SEED-LOCKED AND READY
            </div>
          )}
        </div>

        {/* MAIN VISUAL WORKSPACE DECK */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 items-start">
          
          {/* THE IMAGE CANVAS INTERACTIVE LAYER (LEFT 3 COLUMNS) */}
          <div className="lg:col-span-3 border border-slate-700 bg-slate-950 p-2 relative overflow-hidden min-h-[360px] flex items-center justify-center">
            
            <div 
              ref={containerRef}
              onClick={handleImageClick}
              className={`relative max-w-full h-auto select-none ${!selectedPhoto ? 'w-full' : currentStep < 4 ? 'cursor-crosshair' : 'cursor-default'}`}
            >
              {photoPreviewUrl ? (
                /* RENDER THE LOADED SNAPSHOT FRAME DIRECTLY INSIDE CANVAS BACKGROUND */
                <img 
                  src={photoPreviewUrl} 
                  alt="Court Calibration Stream" 
                  className="w-full h-auto object-contain block pointer-events-none"
                />
              ) : (
                /* FILE CHUNK INGESTION DROPZONE INTERFACE TRIGGER IF EMPTY */
                <div className="border border-dashed border-slate-700 bg-slate-950/40 p-12 text-center flex flex-col items-center justify-center relative min-h-[340px] w-full">
                  <span className="text-xl opacity-40 mb-2">📸</span>
                  <div className="text-slate-300 font-black text-[10px] uppercase tracking-wide mb-1">
                    Upload Camera Snapshot Preview File
                  </div>
                  <p className="text-slate-500 text-[8px] max-w-xs font-sans leading-tight mb-4">
                    Upload a high-fidelity static image file (.png, .jpg) or frame screenshot from this specific court fence camera to map vector intersections.
                  </p>
                  
                  {/* UTILITY ACTION UPLOAD BUTTON BUTTON */}
                  <label className="bg-purple-700 hover:bg-purple-600 text-white border border-purple-500 font-black text-[9px] px-3 py-1.5 cursor-pointer uppercase transition tracking-tight">
                    Select Court Image
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={handlePhotoSelect} 
                      className="hidden" 
                    />
                  </label>
                </div>
              )}

              {/* RENDER DYNAMIC ABSOLUTE INTERACTIVE CLICK DOTS */}
              {selectedPhoto && clicks.map((pt, idx) => (
                <div
                  key={idx}
                  className="absolute w-4 h-4 rounded-full border border-white transform -translate-x-1/2 -translate-y-1/2 flex items-center justify-center font-sans font-black text-[8px] shadow-lg z-30"
                  style={{ 
                    left: `${pt.x}px`, 
                    top: `${pt.y}px`,
                    backgroundColor: idx === 0 ? '#ef4444' : idx === 1 ? '#fbbf24' : idx === 2 ? '#3b82f6' : '#22c55e'
                  }}
                >
                  {idx + 1}
                </div>
              ))}

              {/* RENDER CONNECTOR BOUNDARY LINE POLYGONS SVG */}
              {selectedPhoto && clicks.length > 1 && (
                <svg className="absolute inset-0 w-full h-full pointer-events-none z-20">
                  <polyline
                    points={clicks.map(p => `${p.x},${p.y}`).join(' ')}
                    className="stroke-purple-500 stroke-[1.5] fill-none"
                  />
                  {clicks.length === 4 && (
                    <polygon
                      points={clicks.map(p => `${p.x},${p.y}`).join(' ')}
                      className="fill-purple-500/10 stroke-purple-500 stroke-[1.5]"
                    />
                  )}
                </svg>
              )}
            </div>
          </div>

          {/* DYNAMIC LOGGING CONTROL METRIC PANEL (RIGHT 1 COLUMN) */}
          <div className="border border-slate-700 p-3 bg-slate-950/40 space-y-3 h-full flex flex-col justify-between min-h-[360px]">
            <div className="space-y-4">
              <div>
                <span className="text-[9px] font-black uppercase text-slate-500 tracking-wider block border-b border-slate-800 pb-1 mb-2">
                  📝 Active File Meta
                </span>
                <div className="text-[9px] text-slate-400 font-bold uppercase truncate max-w-full leading-tight">
                  FILE: <span className="text-purple-300 font-mono">{selectedPhoto ? selectedPhoto.name : '[NO FILE UPLOADED]'}</span>
                </div>
              </div>

              <div>
                <span className="text-[9px] font-black uppercase text-slate-500 tracking-wider block border-b border-slate-800 pb-1 mb-1">
                  📍 Logged Vertices
                </span>
                <div className="space-y-1.5 font-mono text-[9px] text-slate-400">
                  {CLICK_STEPS.map((step, idx) => (
                    <div key={idx} className="flex justify-between items-center border-b border-slate-900 pb-1">
                      <span className="font-bold">{step.label}:</span>
                      <span className="font-black text-slate-200">
                        {clicks[idx] ? `X:${clicks[idx].x} Y:${clicks[idx].y}` : '[PENDING]'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ACTION FOOTER COMMAND MODULES */}
            <div className="space-y-2 pt-4 border-t border-slate-800">
              {selectedPhoto && (
                <button
                  onClick={handleClearAll}
                  disabled={isSaving}
                  className="w-full text-center p-1.5 text-[8px] font-bold border border-red-900/60 text-red-400 hover:bg-red-950/20 bg-slate-950 transition disabled:opacity-30 uppercase"
                >
                  ❌ Remove Loaded Image
                </button>
              )}
              <button
                onClick={handleReset}
                disabled={clicks.length === 0 || isSaving}
                className="w-full text-center p-2 text-[9px] font-black border border-slate-700 text-slate-400 hover:text-slate-200 bg-slate-900 disabled:opacity-30 disabled:cursor-not-allowed uppercase"
              >
                🔄 Reset Points
              </button>
              <button
                onClick={handleSaveCalibration}
                disabled={clicks.length !== 4 || isSaving || !selectedPhoto}
                className="w-full text-center p-2 text-[10px] font-black border border-purple-500 text-white bg-purple-700 hover:bg-purple-600 disabled:opacity-20 disabled:cursor-not-allowed shadow-[0_0_10px_rgba(147,51,234,0.3)] uppercase"
              >
                {isSaving ? '⏳ Saving Matrix...' : '💾 Save Calibration'}
              </button>
            </div>

          </div>
        </div>

        {/* BOTTOM NOTIFICATION CONSOLE MESSAGE SHELL */}
        {logMessage && (
          <div className="text-[9px] font-bold tracking-tight bg-slate-950 border border-slate-800 p-2 text-purple-300 animate-pulse">
            📟 CONSOLE LOG // {logMessage}
          </div>
        )}

      </div>
    </div>
  );
}
