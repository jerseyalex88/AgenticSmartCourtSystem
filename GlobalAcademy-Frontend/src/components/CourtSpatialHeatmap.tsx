// File: GlobalAcademy-Frontend/src/components/CourtSpatialHeatmap.tsx
import React, { useState } from 'react';

interface BouncePoint {
  x: number;
  y: number;
  intensity: string;
}

interface CourtSpatialHeatmapProps {
  bouncePoints: BouncePoint[];
  totalProcessedBounces: number;
}

export default function CourtSpatialHeatmap({ bouncePoints, totalProcessedBounces }: CourtSpatialHeatmapProps) {
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'ZONE_A' | 'ZONE_B'>('ALL');
  const [intensityThreshold, setIntensityThreshold] = useState<number>(30);

  // Filter coordinates dynamically based on dashboard user selections
  const filteredPoints = bouncePoints.filter(p => {
    // Threshold filter simulation
    if (intensityThreshold > 50 && p.intensity === 'Low') return false;
    
    if (activeFilter === 'ZONE_A') return p.x < 50; // Left side of court
    if (activeFilter === 'ZONE_B') return p.x >= 50; // Right side of court
    return true;
  });

  return (
    <div className="border border-slate-700 bg-[#1e232d] p-4 font-mono text-[10px] text-slate-200 select-none shadow-xl mb-4">
      
      {/* HEADER METRIC INDICATOR CONTROL SUB-BAR */}
      <div className="flex flex-wrap gap-4 items-center justify-between border-b border-slate-700/60 pb-3 mb-4">
        <div className="flex items-center gap-4 text-center">
          <div>
            <div className="text-slate-500 font-bold uppercase tracking-tight text-[8px]">Avg Intensity</div>
            <div className="text-sm font-black text-slate-100 tracking-tight mt-0.5">63%</div>
          </div>
          <div className="border-l border-slate-700 h-6" />
          <div>
            <div className="text-slate-500 font-bold uppercase tracking-tight text-[8px]">Peak Sector</div>
            <div className="text-sm font-black text-slate-100 tracking-tight mt-0.5">Left Court</div>
          </div>
          <div className="border-l border-slate-700 h-6" />
          <div>
            <div className="text-slate-500 font-bold uppercase tracking-tight text-[8px]">Density Index</div>
            <div className="text-sm font-black text-slate-100 tracking-tight mt-0.5">27.3</div>
          </div>
        </div>

        {/* GLOWING COLORED MATRIX LEGEND */}
        <div className="flex items-center gap-3 font-bold text-[8px] tracking-tight uppercase">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_#ef4444]" />
            <span className="text-red-400">High Strike</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_8px_#fbbf24]" />
            <span className="text-amber-400">Moderate Bounce</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-blue-400 shadow-[0_0_8px_#60a5fa]" />
            <span className="text-blue-400">Low Density</span>
          </div>
        </div>
      </div>

      {/* 🎾 HIGH-FIDELITY TOP-DOWN TENNIS COURT SVG CANVAS WORKSPACE */}
      <div className="w-full bg-[#1c4d32] border border-slate-700/80 p-4 relative overflow-hidden rounded-md min-h-[220px] shadow-inner">
        
        {/* INNER BOUNDARY LINES OVERLAY */}
        {/* Brightened strokes from slate to white/slate-200 with higher opacity to pop beautifully over the new green canvas */}
        <svg viewBox="0 0 100 50" className="w-full h-full stroke-slate-100/90 fill-none stroke-[0.35] relative z-0">
          {/* Main Outer Box Border */}
          <rect x="5" y="5" width="90" height="40" className="stroke-slate-50/95 stroke-[0.45]" />
          {/* Singles Sidelines */}
          <line x1="5" y1="9" x2="95" y2="9" />
          <line x1="5" y1="41" x2="95" y2="41" />
          {/* Center Net Line Divider */}
          <line x1="50" y1="5" x2="50" y2="45" className="stroke-slate-200/80 stroke-[0.6] stroke-dasharray-[0.8,0.4]" />
          {/* Service Lines boundaries */}
          <line x1="26" y1="9" x2="26" y2="41" />
          <line x1="74" y1="9" x2="74" y2="41" />
          {/* Center Service Line T */}
          <line x1="26" y1="25" x2="74" y2="25" />
        </svg>

        {/* DYNAMIC ABSOLUTE POSITION GRADIENT MOISTURE BLOCKS */}
        <div className="absolute inset-0 z-10 pointer-events-none">
          {filteredPoints.map((point, index) => {
            // Map intensities directly down to blurred glowing core structures
            const colorClass = 
              point.intensity === 'High' ? 'bg-red-500 shadow-[0_0_24px_#ef4444] opacity-80 mix-blend-screen' :
              point.intensity === 'Moderate' ? 'bg-amber-400 shadow-[0_0_16px_#fbbf24] opacity-65 mix-blend-screen' :
                                               'bg-blue-400 shadow-[0_0_12px_#60a5fa] opacity-40';

            const blurSize = point.intensity === 'High' ? 'w-6 h-6 blur-md' : point.intensity === 'Moderate' ? 'w-5 h-5 blur-sm' : 'w-4 h-4 blur-xs';

            return (
              <div
                key={index}
                className={`absolute rounded-full transform -translate-x-1/2 -translate-y-1/2 transition-all duration-300 ${colorClass} ${blurSize}`}
                style={{ left: `${point.x}%`, top: `${point.y}%` }}
              />
            );
          })}

          {/* DYNAMIC LITTLE SOLID BALL CENTER HIT DOT INDICATORS */}
          {filteredPoints.map((point, index) => (
            <div
              key={`dot-${index}`}
              className="absolute w-1 h-1 bg-white rounded-full transform -translate-x-1/2 -translate-y-1/2 opacity-90 shadow-md border-[0.2px] border-slate-900"
              style={{ left: `${point.x}%`, top: `${point.y}%` }}
            />
          ))}
        </div>

        {/* ZONE LABELS VISUAL CANVAS TAGS */}
        <div className="absolute top-1/2 left-2 -translate-y-1/2 text-[9px] font-black text-slate-500/80 z-20 font-sans tracking-tight">Zone A</div>
        <div className="absolute top-1/2 right-2 -translate-y-1/2 text-[9px] font-black text-slate-500/80 z-20 font-sans tracking-tight">Zone B</div>
      </div>

      {/* DASHBOARD FILTER COMMAND WORKSPACE LOWER TOOLBAR */}
      <div className="mt-4 pt-3 border-t border-slate-700/60 grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
        
        {/* FILTER SECTOR SEGMENT CONTROLS */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="space-y-1">
            <span className="text-[8px] font-bold text-slate-500 uppercase block tracking-wider">Court Sector Filter:</span>
            <div className="flex gap-1 border border-slate-700 p-0.5 bg-[#141920]">
              {(['ALL', 'ZONE_A', 'ZONE_B'] as const).map(mode => (
                <button
                  key={mode}
                  onClick={() => setActiveFilter(mode)}
                  className={`px-2 py-1 font-bold text-[9px] transition rounded-none uppercase ${activeFilter === mode ? 'bg-purple-600 text-white font-black' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  {mode === 'ALL' ? 'Full Court' : mode === 'ZONE_A' ? 'Zone A' : 'Zone B'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* THRESHOLD INTENSITY MODIFIER SLIDER BAR */}
        <div className="space-y-1 justify-self-stretch md:justify-self-end w-full max-w-xs">
          <div className="flex justify-between text-[8px] font-bold text-slate-500 uppercase tracking-wider">
            <span>Minimum Intensity Threshold:</span>
            <span className="text-slate-300 font-mono font-bold">{intensityThreshold}%</span>
          </div>
          <input
            type="range"
            min="10"
            max="90"
            value={intensityThreshold}
            onChange={(e) => setIntensityThreshold(Number(e.target.value))}
            className="w-full h-1 bg-slate-700 rounded-none appearance-none cursor-pointer accent-purple-500"
          />
        </div>

      </div>

    </div>
  );
}
