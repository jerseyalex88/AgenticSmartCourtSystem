import { useState, useEffect } from 'react';
import { apiClient } from '../api/apiClient';

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
  status: string; // Open, Rained_Out, Maintenance_Locked
  dryCoefficient: number;
  aggregateMinutesPlayed: number;
  maintenanceThresholdMinutes: number;
}

export default function CourtsDashboard() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  const [courts, setCourts] = useState<Court[]>([]);
  
  // Loading & UX Error State Tracking
  const [loading, setLoading] = useState<boolean>(true);
  const [actionError, setActionError] = useState<string | null>(null);

  // Structural Modal Forms State Controls
  const [showBranchModal, setShowBranchModal] = useState<boolean>(false);
  const [showCourtModal, setShowCourtModal] = useState<boolean>(false);

  // Form Field Inputs State Variables
  const [newBranch, setNewBranch] = useState({ name: '', description: '', timeZoneId: 'Europe/London' });
  const [newCourt, setNewCourt] = useState({ name: '', description: '', surfaceType: 'Hard', isIndoor: false, dryCoefficient: 1.0 });

  // --- API DATA INGESTION LOOPS ---
  
  const fetchInitialData = async () => {
    try {
      setLoading(true);
      setActionError(null);
      const branchRes = await apiClient.get<Branch[]>('/Facility/branches');
      setBranches(branchRes.data);
      
      if (branchRes.data.length > 0 && !selectedBranchId) {
        setSelectedBranchId(branchRes.data[0].id);
      }
    } catch (err: any) {
      setActionError('Failed to synchronize infrastructure branches list.');
    } finally {
      setLoading(false);
    }
  };

  const fetchCourtsForSelectedBranch = async (branchId: string) => {
    if (!branchId) return;
    try {
      setActionError(null);
      const courtRes = await apiClient.get<Court[]>(`/Facility/branches/${branchId}/courts`);
      setCourts(courtRes.data);
    } catch (err: any) {
      setActionError('Failed to isolate target branch court asset metrics.');
    }
  };

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (selectedBranchId) {
      fetchCourtsForSelectedBranch(selectedBranchId);
    } else {
      setCourts([]);
    }
  }, [selectedBranchId]);

  // --- CRUD LIFECYCLE MUTATION HANDLERS ---

  const handleCreateBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setActionError(null);
      const res = await apiClient.post<Branch>('/Facility/branches', newBranch);
      setBranches([...branches, res.data]);
      setSelectedBranchId(res.data.id);
      setShowBranchModal(false);
      setNewBranch({ name: '', description: '', timeZoneId: 'Europe/London' });
    } catch (err: any) {
      setActionError(err.response?.data || 'Relational Exception: Could not persist branch node layout.');
    }
  };

  const handleCreateCourt = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setActionError(null);
      const res = await apiClient.post<Court>('/Facility/courts', {
        branchId: selectedBranchId,
        ...newCourt
      });
      setCourts([...courts, res.data]);
      setShowCourtModal(false);
      setNewCourt({ name: '', description: '', surfaceType: 'Hard', isIndoor: false, dryCoefficient: 1.0 });
    } catch (err: any) {
      setActionError(err.response?.data || 'Failed to provision target court hardware asset row.');
    }
  };

  const handleDeleteCourt = async (courtId: string) => {
    if (!window.confirm('Are you absolutely sure you want to decouple and delete this physical court asset?')) return;
    try {
      setActionError(null);
      await apiClient.delete(`/Facility/courts/${courtId}`);
      setCourts(courts.filter(c => c.id !== courtId));
    } catch (err: any) {
      setActionError('Purge Failure: Unable to remove target court array position.');
    }
  };

  if (loading) {
    return <div className="text-center py-12 text-xs font-mono text-slate-500">Querying Regional Facility Infrastructure Matrices...</div>;
  }

  return (
    <div className="space-y-6">
      
      {actionError && (
        <div className="p-4 bg-rose-950/40 border border-rose-900 text-rose-300 rounded-xl text-xs font-medium flex items-center space-x-2">
          <span>⚠️</span> <span>{actionError}</span>
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-xl">
        <div className="space-y-1">
          <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500">Active Branch Location Node</label>
          {branches.length > 0 ? (
            <select 
              value={selectedBranchId} 
              onChange={(e) => setSelectedBranchId(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-xs font-semibold text-slate-200 focus:outline-none focus:border-emerald-500 min-w-[200px]"
            >
              {branches.map(b => (
                <option key={b.id} value={b.id}>{b.name} ({b.timeZoneId})</option>
              ))}
            </select>
          ) : (
            <p className="text-xs text-rose-400 italic">No facility branch locations configured yet.</p>
          )}
        </div>

        <div className="flex items-center space-x-2">
          <button 
            onClick={() => setShowBranchModal(true)}
            className="bg-slate-950 hover:bg-slate-850 text-slate-300 border border-slate-800 px-4 py-2.5 rounded-xl text-xs font-bold transition"
          >
            ➕ Deploy New Venue Branch
          </button>
          <button 
            disabled={!selectedBranchId}
            onClick={() => setShowCourtModal(true)}
            className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 px-4 py-2.5 rounded-xl text-xs font-black transition"
          >
            ➕ Provision Court Asset
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {courts.map((court) => {
          const wearPercent = Math.min(100, Math.round((court.aggregateMinutesPlayed / court.maintenanceThresholdMinutes) * 100));
          
          return (
            <div key={court.id} className="bg-slate-900 border border-slate-800/80 rounded-2xl p-5 shadow-xl hover:border-slate-700/60 transition flex flex-col justify-between space-y-4">
              
              <div className="space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-sm font-black text-slate-100 tracking-tight">{court.name}</h3>
                    <p className="text-[11px] text-slate-400 leading-relaxed mt-0.5 line-clamp-2">{court.description}</p>
                  </div>
                  
                  <span className={`px-2 py-0.5 text-[9px] font-black uppercase tracking-wider rounded border ${
                    court.status === 'Open' ? 'bg-emerald-950/40 text-emerald-400 border-emerald-900/60' :
                    court.status === 'Rained_Out' ? 'bg-blue-950/40 text-blue-400 border-blue-900/60' :
                    'bg-amber-950/40 text-amber-400 border-amber-900/60'
                  }`}>
                    {court.status}
                  </span>
                </div>

                <div className="flex flex-wrap gap-1.5 pt-1">
                  <span className="text-[10px] bg-slate-950 px-2 py-0.5 rounded-md font-mono text-slate-400 border border-slate-850">🛠️ {court.surfaceType}</span>
                  <span className="text-[10px] bg-slate-950 px-2 py-0.5 rounded-md font-mono text-slate-400 border border-slate-850">{court.isIndoor ? '🏠 Indoor' : '☀️ Outdoor'}</span>
                  <span className="text-[10px] bg-slate-950 px-2 py-0.5 rounded-md font-mono text-slate-400 border border-slate-850">💧 Coeff: {court.dryCoefficient}</span>
                </div>
              </div>
              <div className="space-y-1.5 border-t border-slate-850 pt-3">
                <div className="flex items-center justify-between text-[10px] font-mono">
                  <span className="text-slate-500 uppercase tracking-tight">Surface Wear Threshold</span>
                  <span className={wearPercent > 80 ? "text-amber-400 font-bold" : "text-slate-400"}>
                    {court.aggregateMinutesPlayed} / {court.maintenanceThresholdMinutes} m ({wearPercent}%)
                  </span>
                </div>
                <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-850">
                  <div 
                    style={{ width: `${wearPercent}%` }}
                    className={`h-full transition-all duration-500 ${
                      wearPercent > 85 ? 'bg-amber-500' : 'bg-emerald-500'
                    }`}
                  />
                </div>
              </div>

              <div className="flex items-center justify-end border-t border-slate-850/60 pt-3">
                <button 
                  onClick={() => handleDeleteCourt(court.id)}
                  className="text-[10px] font-bold text-slate-500 hover:text-rose-400 border border-transparent hover:border-rose-900/40 hover:bg-rose-950/20 px-2.5 py-1.5 rounded-lg transition"
                >
                  🗑️ Purge Asset
                </button>
              </div>

            </div>
          );
        })}

        {courts.length === 0 && (
          <div className="col-span-full border border-dashed border-slate-800 rounded-2xl p-12 text-center text-xs font-mono text-slate-500 italic">
            No physical court assets provisioned under this specific branch configuration profile.
          </div>
        )}
      </div>

      {/* =========================================================================
          MODAL INTERFACES: NEW BRANCH PROVISIONING OVERLAY
          ========================================================================= */}
      {showBranchModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-black text-slate-100">Deploy Location Branch Venue</h3>
            <form onSubmit={handleCreateBranch} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="block font-bold text-slate-400 uppercase">Venue Location Name</label>
                <input type="text" required value={newBranch.name} onChange={(e) => setNewBranch({...newBranch, name: e.target.value})} placeholder="e.g., London Grass Core" className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-slate-200 focus:outline-none focus:border-emerald-500" />
              </div>
              <div className="space-y-1">
                <label className="block font-bold text-slate-400 uppercase">Structural Description</label>
                <textarea rows={2} required value={newBranch.description} onChange={(e) => setNewBranch({...newBranch, description: e.target.value})} placeholder="Describe operational focus boundaries..." className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-slate-200 focus:outline-none focus:border-emerald-500" />
              </div>
              <div className="space-y-1">
                <label className="block font-bold text-slate-400 uppercase">Regional IANA Time-Zone Routing Vector</label>
                <select value={newBranch.timeZoneId} onChange={(e) => setNewBranch({...newBranch, timeZoneId: e.target.value})} className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-slate-200 focus:outline-none" >
                  <option value="Europe/London">Europe/London (GMT/BST)</option>
                  <option value="Asia/Dubai">Asia/Dubai (GST)</option>
                  <option value="America/New_York">America/New_York (EST/EDT)</option>
                </select>
              </div>
              <div className="flex items-center justify-end space-x-2 pt-2">
                <button type="button" onClick={() => setShowBranchModal(false)} className="bg-slate-950 hover:bg-slate-850 px-4 py-2 rounded-xl text-slate-400 transition">Cancel</button>
                <button type="submit" className="bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-black px-4 py-2 rounded-xl transition">Deploy Node</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL INTERFACES: NEW COURT HARDWARE PROVISIONING OVERLAY
          ========================================================================= */}
      {showCourtModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-black text-slate-100">Provision Court Asset Framework</h3>
            <form onSubmit={handleCreateCourt} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="block font-bold text-slate-400 uppercase">Court Asset Reference Title</label>
                <input type="text" required value={newCourt.name} onChange={(e) => setNewCourt({...newCourt, name: e.target.value})} placeholder="e.g., Championship Grass 1" className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-slate-200 focus:outline-none focus:border-emerald-500" />
              </div>
              <div className="space-y-1">
                <label className="block font-bold text-slate-400 uppercase">Hardware Configuration Description</label>
                <textarea rows={2} required value={newCourt.description} onChange={(e) => setNewCourt({...newCourt, description: e.target.value})} placeholder="Detail materials layout..." className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-slate-200 focus:outline-none focus:border-emerald-500" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block font-bold text-slate-400 uppercase">Surface Construction Type</label>
                  <select value={newCourt.surfaceType} onChange={(e) => setNewCourt({...newCourt, surfaceType: e.target.value})} className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-slate-200" >
                    <option value="Grass">Traditional Grass</option>
                    <option value="Clay">Moisture Red Clay</option>
                    <option value="Hard">Standard Hardcourt</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="block font-bold text-slate-400 uppercase">Drying Coefficient Multiplier</label>
                  <input type="number" step="0.1" required value={newCourt.dryCoefficient} onChange={(e) => setNewCourt({...newCourt, dryCoefficient: parseFloat(e.target.value) || 1.0})} className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-slate-200" />
                </div>
              </div>
              <div className="flex items-center space-x-2 py-1">
                <input type="checkbox" id="indoorCheck" checked={newCourt.isIndoor} onChange={(e) => setNewCourt({...newCourt, isIndoor: e.target.checked})} className="rounded bg-slate-950 border-slate-800 text-emerald-500 accent-emerald-500 h-4 w-4" />
                <label htmlFor="indoorCheck" className="text-slate-300 font-semibold cursor-pointer">Asset is insulated inside structural indoor facility enclosure</label>
              </div>
              <div className="flex items-center justify-end space-x-2 pt-2">
                <button type="button" onClick={() => setShowCourtModal(false)} className="bg-slate-950 hover:bg-slate-850 px-4 py-2 rounded-xl text-slate-400 transition">Cancel</button>
                <button type="submit" className="bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-black px-4 py-2 rounded-xl transition">Commit Asset</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
