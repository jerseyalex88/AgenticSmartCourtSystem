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
  status: string;
  dryCoefficient: number;
  aggregateMinutesPlayed: number;
  maintenanceThresholdMinutes: number;
}

export default function CourtsDashboard() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  const [courts, setCourts] = useState<Court[]>([]);
  
  const [loading, setLoading] = useState<boolean>(true);
  const [actionError, setActionError] = useState<string | null>(null);

  const [showBranchModal, setShowBranchModal] = useState<boolean>(false);
  const [showCourtModal, setShowCourtModal] = useState<boolean>(false);
  
  const [isEditingBranch, setIsEditingBranch] = useState<boolean>(false);
  const [editingCourtId, setEditingCourtId] = useState<string | null>(null);

  const [newBranch, setNewBranch] = useState({ name: '', description: '', timeZoneId: 'Europe/London' });
  const [editBranchData, setEditBranchData] = useState({ name: '', description: '', timeZoneId: 'Europe/London' });
  
  const [newCourt, setNewCourt] = useState({ name: '', description: '', surfaceType: 'Hard', isIndoor: false, dryCoefficient: 1.0 });
  const [editCourtData, setEditCourtData] = useState({ name: '', description: '', surfaceType: 'Hard', isIndoor: false, dryCoefficient: 1.0 });

  // FIXED FEATURE EXTENSION: Tracks the active court entity targeted for deletion
  const [courtToDeleteId, setCourtToDeleteId] = useState<string | null>(null);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      setActionError(null);
      const branchRes = await apiClient.get<Branch[]>('/Facility/branches');
      setBranches(branchRes.data);
      
      if (branchRes.data.length > 0 && !selectedBranchId) {
        setSelectedBranchId(branchRes.data[0].id);
        setEditBranchData({
          name: branchRes.data[0].name,
          description: branchRes.data[0].description,
          timeZoneId: branchRes.data[0].timeZoneId
        });
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
      const activeB = branches.find(b => b.id === selectedBranchId);
      if (activeB) {
        setEditBranchData({ name: activeB.name, description: activeB.description, timeZoneId: activeB.timeZoneId });
      }
      setIsEditingBranch(false);
      setEditingCourtId(null);
    } else {
      setCourts([]);
    }
  }, [selectedBranchId]);

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
      setActionError(err.response?.data || 'Could not persist branch node layout.');
    }
  };
  const handleUpdateBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setActionError(null);
      await apiClient.put(`/Facility/branches/${selectedBranchId}`, editBranchData);
      setBranches(branches.map(b => b.id === selectedBranchId ? { ...b, ...editBranchData } : b));
      setIsEditingBranch(false);
    } catch (err: any) {
      setActionError(err.response?.data || 'Failed to update selected branch attributes.');
    }
  };

  const handleCreateCourt = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setActionError(null);
      const res = await apiClient.post<Court>('/Facility/courts', { branchId: selectedBranchId, ...newCourt });
      setCourts([...courts, res.data]);
      setShowCourtModal(false);
      setNewCourt({ name: '', description: '', surfaceType: 'Hard', isIndoor: false, dryCoefficient: 1.0 });
    } catch (err: any) {
      setActionError(err.response?.data || 'Failed to provision court asset row.');
    }
  };

  const handleBeginEditCourt = (court: Court) => {
    setEditingCourtId(court.id);
    setEditCourtData({
      name: court.name,
      description: court.description,
      surfaceType: court.surfaceType,
      isIndoor: court.isIndoor,
      dryCoefficient: court.dryCoefficient
    });
  };

  const handleUpdateCourt = async (courtId: string) => {
    try {
      setActionError(null);
      await apiClient.put(`/Facility/courts/${courtId}`, editCourtData);
      setCourts(courts.map(c => c.id === courtId ? { ...c, ...editCourtData } : c));
      setEditingCourtId(null);
    } catch (err: any) {
      setActionError(err.response?.data || 'Failed to preserve court configuration changes.');
    }
  };

    // FIX: Instead of blocking the thread with window.confirm, open the custom overlay modal
  const handleTriggerPurgeModal = (courtId: string) => {
    setCourtToDeleteId(courtId);
  };

  const handleExecutePurgeAction = async () => {
    if (!courtToDeleteId) return;
    try {
      setActionError(null);
      await apiClient.delete(`/Facility/courts/${courtToDeleteId}`);
      setCourts(courts.filter(c => c.id !== courtToDeleteId));
      setCourtToDeleteId(null); // Close modal cleanly
    } catch (err: any) {
      setActionError('Decommission Failure: Unable to remove target court array position.');
    }
  };

  if (loading) {
    return <div className="text-center py-12 text-xs font-mono text-slate-500">Querying Regional Facility Infrastructure Matrices...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-800 pb-4 mb-6">
        <h2 className="text-xl font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight">🏟️ Core Asset Matrix</h2>
        <p className="text-xs text-slate-500 mt-1 font-mono">Manage branch and court provisions, deploy venue and explore court surface status.</p>
      </div>

      {actionError && (
        <div className="p-4 bg-rose-100 border border-rose-300 text-rose-600 text-xs font-medium flex items-center space-x-2">
          <span>⚠️</span> <span>{actionError}</span>
        </div>
      )}

      <div className="bg-white border border-slate-300 p-5 shadow-xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-1">
            <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-800">Active Branch Location Node</label>
            {branches.length > 0 ? (
              <div className="flex items-center space-x-2">
                <select value={selectedBranchId} onChange={(e) => setSelectedBranchId(e.target.value)} 
                className="bg-white border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-purple-500 min-w-[200px]" >
                  {branches.map(b => (<option key={b.id} value={b.id}>{b.name}</option>))}
                </select>
                {!isEditingBranch && (
                  <button onClick={() => setIsEditingBranch(true)} 
                  className="bg-slate-200 hover:bg-slate-300 text-slate-700 border border-slate-300 px-4 py-2.5 text-xs font-bold transition">📝 Edit Info</button>
                )}
              </div>
            ) : (
              <p className="text-xs text-rose-400 italic">No facility branch locations configured yet.</p>
            )}
          </div>
          <div className="flex items-center space-x-2">
            <button onClick={() => setShowBranchModal(true)} 
              className="bg-slate-200 hover:bg-slate-300 text-slate-700 border border-slate-300 px-4 py-2.5 text-xs font-bold transition">➕ Deploy Venue</button>
            <button disabled={!selectedBranchId} onClick={() => setShowCourtModal(true)} 
              className="bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white px-4 py-2.5 text-xs font-black transition">➕ Provision Court</button>
          </div>
        </div>

        {isEditingBranch && (
          <form onSubmit={handleUpdateBranch} 
            className="p-4 bg-slate-100 border border-slate-300 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="space-y-1">
              <label className="block font-bold text-slate-600 uppercase">Modify Branch Title</label>
              <input type="text" required value={editBranchData.name} onChange={(e) => setEditBranchData({...editBranchData, name: e.target.value})} className="w-full bg-white border border-slate-300 p-2 text-slate-800" />
            </div>
            <div className="space-y-1">
              <label className="block font-bold text-slate-600 uppercase">Modify Area Focus</label>
              <input type="text" required value={editBranchData.description} onChange={(e) => setEditBranchData({...editBranchData, description: e.target.value})} className="w-full bg-white border border-slate-300 p-2 text-slate-800" />
            </div>
            <div className="space-y-1">
              <label className="block font-bold text-slate-600 uppercase">Modify Zone</label>
              <div className="flex space-x-2">
                <select value={editBranchData.timeZoneId} onChange={(e) => setEditBranchData({...editBranchData, timeZoneId: e.target.value})} className="w-full bg-white border border-slate-300 p-2 text-slate-800" >
                  <option value="Europe/London">Europe/London</option>
                  <option value="Asia/Dubai">Asia/Dubai</option>
                  <option value="America/New_York">America/New_York</option>
                  <option value="America/Vancouver">America/Vancouver (PST/PDT)</option>
                  <option value="America/Chicago">America/Chicago (CST/CDT)</option>
                  <option value="America/Los_Angeles">America/Los_Angeles (PST/PDT)</option>
                  <option value="Europe/Paris">Europe/Paris (CEST/CET)</option>
                  <option value="Asia/Singapore">Asia/Singapore (SGT)</option>
                  <option value="Australia/Sydney">Australia/Sydney (AEST/AEDT)</option>
                  <option value="UTC">UTC (Universal Coordinated Time)</option>                  
                </select>
                <button type="submit" className="bg-purple-600 font-bold px-3 py-1 text-white">Save</button>
                <button type="button" onClick={() => setIsEditingBranch(false)} className="bg-slate-200 px-3 py-1 text-slate-700">Cancel</button>
              </div>
            </div>
          </form>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {courts.map((court) => {
          const wearPercent = Math.min(100, Math.round((court.aggregateMinutesPlayed / court.maintenanceThresholdMinutes) * 100));
          const isCurrentCourtEditing = editingCourtId === court.id;
          
          return (
            <div key={court.id} 
              className="bg-white border border-slate-300 p-5 shadow-xl transition flex flex-col justify-between space-y-4">
              
              {!isCurrentCourtEditing ? (
                <div className="space-y-4 flex-1 flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-sm font-black text-slate-800 tracking-tight">{court.name}</h3>
                        <p className="text-[11px] text-slate-700 mt-0.5 line-clamp-2 leading-relaxed">{court.description}</p>
                      </div>
                      <span className="px-2 py-0.5 text-[9px] font-black uppercase tracking-wider border bg-emerald-100 text-emerald-700 border-emerald-300">{court.status}</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      <span className="text-[10px] bg-slate-100 px-2 py-0.5 font-sans text-slate-700 border border-slate-300">🛠️ {court.surfaceType}</span>
                      <span className="text-[10px] bg-slate-100 px-2 py-0.5 font-sans text-slate-700 border border-slate-300">{court.isIndoor ? '🏠 Indoor' : '☀️ Outdoor'}</span>
                      <span className="text-[10px] bg-slate-100 px-2 py-0.5 font-sans text-slate-700 border border-slate-300">💧 Coeff: {court.dryCoefficient}</span>
                    </div>
                  </div>

                  <div className="space-y-1.5 border-t border-slate-300 pt-3">
                    <div className="flex items-center justify-between text-[10px] font-sans">
                      <span className="text-slate-700 uppercase">Surface Wear</span>
                      <span className="text-slate-700">{court.aggregateMinutesPlayed} / {court.maintenanceThresholdMinutes} m</span>
                    </div>
                    <div className="w-full bg-slate-200 h-1.5 overflow-hidden border border-slate-300">
                      <div style={{ width: `${wearPercent}%` }} className="h-full bg-emerald-500 transition-all duration-500" />
                    </div>
                  </div>

                  <div className="flex items-center justify-end border-t border-slate-300 pt-2 space-x-2">
                    <button onClick={() => handleBeginEditCourt(court)} className="text-[10px] font-bold text-slate-600 hover:text-slate-800 border border-transparent hover:border-slate-400 hover:bg-slate-100 px-2.5 py-1.5 transition">📝 Configure</button>
                    <button onClick={() => handleTriggerPurgeModal(court.id)} className="text-[10px] font-bold text-slate-600 hover:text-rose-600 border border-transparent hover:border-rose-300 hover:bg-rose-50 px-2.5 py-1.5 transition">🗑️ Decommision</button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3 text-xs flex-1 flex flex-col justify-between">
                  <div className="space-y-2">
                    <h4 className="font-bold text-emerald-600 border-b border-slate-300 pb-1 text-[11px] uppercase tracking-wide">Modify Court Configuration</h4>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-600 uppercase">Reference Title</label>
                      <input type="text" value={editCourtData.name} onChange={(e) => setEditCourtData({...editCourtData, name: e.target.value})} className="w-full bg-white border border-slate-300 p-2 text-slate-800" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-600 uppercase">Materials Description</label>
                      <input type="text" value={editCourtData.description} onChange={(e) => setEditCourtData({...editCourtData, description: e.target.value})} className="w-full bg-white border border-slate-300 p-2 text-slate-800" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] font-bold text-slate-600 uppercase">Type</label>
                        <select value={editCourtData.surfaceType} onChange={(e) => setEditCourtData({...editCourtData, surfaceType: e.target.value})} className="w-full bg-white border border-slate-300 p-1.5 text-slate-800" >
                          <option value="Grass">Grass</option>
                          <option value="Clay">Clay</option>
                          <option value="Hard">Hard</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-600 uppercase">Drying Coeff</label>
                        <input type="number" step="0.1" value={editCourtData.dryCoefficient} onChange={(e) => setEditCourtData({...editCourtData, dryCoefficient: parseFloat(e.target.value) || 1.0})} className="w-full bg-white border border-slate-300 p-1.5 text-slate-800" />
                      </div>
                    </div>
                    <div className="flex items-center space-x-1.5 pt-1">
                      <input type="checkbox" id={`editIndoor-${court.id}`} checked={editCourtData.isIndoor} onChange={(e) => setEditCourtData({...editCourtData, isIndoor: e.target.checked})} className="accent-purple-500 rounded h-3.5 w-3.5" />
                      <label htmlFor={`editIndoor-${court.id}`} className="text-slate-700 font-semibold text-[11px] cursor-pointer">Insulated Indoor Enclosure</label>
                    </div>
                  </div>

                  <div className="flex items-center justify-end space-x-2 border-t border-slate-300 pt-3">
                    <button type="button" onClick={() => setEditingCourtId(null)} className="bg-slate-200 hover:bg-slate-300 px-3 py-1.5 text-slate-700 text-[10px] font-bold">Cancel</button>
                    <button type="button" onClick={() => handleUpdateCourt(court.id)} className="bg-purple-600 hover:bg-purple-500 text-white font-black px-3 py-1.5 text-[10px]">Commit Modifications</button>
                  </div>
                </div>
              )}

            </div>
          );
        })}
        {courts.length === 0 && (
          <div className="col-span-full border border-dashed border-slate-300 p-12 text-center text-xs font-sans text-slate-600 italic">
            No physical court assets provisioned under this specific branch configuration profile.
          </div>
        )}
      </div>
      {/* =========================================================================
          MODALS REGION OVERLAYS (DEPLOY NEW BRANCH OVERLAY INCLUDED FOR COMPLIANCE)
          ========================================================================= */}
      {showBranchModal && (
        <div className="fixed inset-0 bg-slate-400/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-slate-300 max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-black text-slate-900">Deploy Location Branch Venue</h3>
            <form onSubmit={handleCreateBranch} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="block font-bold text-slate-600 uppercase">Venue Location Name</label>
                <input type="text" required value={newBranch.name} onChange={(e) => setNewBranch({...newBranch, name: e.target.value})} placeholder="e.g., London Grass Core" className="w-full bg-white border border-slate-300 p-2.5 text-slate-800 focus:outline-none focus:border-purple-500" />
              </div>
              <div className="space-y-1">
                <label className="block font-bold text-slate-600 uppercase">Structural Description</label>
                <textarea rows={2} required value={newBranch.description} onChange={(e) => setNewBranch({...newBranch, description: e.target.value})} placeholder="Describe operational focus boundaries..." className="w-full bg-white border border-slate-300 p-2.5 text-slate-800 focus:outline-none focus:border-purple-500" />
              </div>
              <div className="space-y-1">
                <label className="block font-bold text-slate-600 uppercase">Regional IANA Time-Zone Routing Vector</label>
                <select value={newBranch.timeZoneId} onChange={(e) => setNewBranch({...newBranch, timeZoneId: e.target.value})} className="w-full bg-white border border-slate-300 p-2.5 text-slate-800 focus:outline-none" >
                  <option value="Europe/London">Europe/London</option>
                  <option value="Asia/Dubai">Asia/Dubai</option>
                  <option value="America/New_York">America/New_York</option>
                </select>
              </div>
              <div className="flex items-center justify-end space-x-2 pt-2">
                <button type="button" onClick={() => setShowBranchModal(false)} className="bg-slate-200 hover:bg-slate-300 px-4 py-2 text-slate-700 transition">Cancel</button>
                <button type="submit" className="bg-purple-600 hover:bg-purple-500 text-white font-black px-4 py-2 transition">Deploy Node</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showCourtModal && (
        <div className="fixed inset-0 bg-slate-400/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-slate-300 max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-black text-slate-900">Provision Court Asset Framework</h3>
            <form onSubmit={handleCreateCourt} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="block font-bold text-slate-600 uppercase">Court Asset Reference Title</label>
                <input type="text" required value={newCourt.name} onChange={(e) => setNewCourt({...newCourt, name: e.target.value})} placeholder="e.g., Championship Grass 1" className="w-full bg-white border border-slate-300 p-2.5 text-slate-800 focus:outline-none focus:border-purple-500" />
              </div>
              <div className="space-y-1">
                <label className="block font-bold text-slate-600 uppercase">Hardware Configuration Description</label>
                <textarea rows={2} required value={newCourt.description} onChange={(e) => setNewCourt({...newCourt, description: e.target.value})} placeholder="Detail materials layout..." className="w-full bg-white border border-slate-300 p-2.5 text-slate-800 focus:outline-none focus:border-purple-500" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block font-bold text-slate-600 uppercase">Surface Construction Type</label>
                  <select value={newCourt.surfaceType} onChange={(e) => setNewCourt({...newCourt, surfaceType: e.target.value})} className="w-full bg-white border border-slate-300 p-2.5 text-slate-800" >
                    <option value="Grass">Traditional Grass</option>
                    <option value="Clay">Moisture Red Clay</option>
                    <option value="Hard">Standard Hardcourt</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="block font-bold text-slate-600 uppercase">Drying Coefficient Multiplier</label>
                  <input type="number" step="0.1" required value={newCourt.dryCoefficient} onChange={(e) => setNewCourt({...newCourt, dryCoefficient: parseFloat(e.target.value) || 1.0})} className="w-full bg-white border border-slate-300 p-2.5 text-slate-800" />
                </div>
              </div>
              <div className="flex items-center space-x-2 py-1">
                <input type="checkbox" id="indoorCheck" checked={newCourt.isIndoor} onChange={(e) => setNewCourt({...newCourt, isIndoor: e.target.checked})} className="rounded bg-white border-slate-300 text-purple-500 accent-purple-500 h-4 w-4" />
                <label htmlFor="indoorCheck" className="text-slate-700 font-semibold cursor-pointer">Indoor Enclosure</label>
              </div>
              <div className="flex items-center justify-end space-x-2 pt-2">
                <button type="button" onClick={() => setShowCourtModal(false)} className="bg-slate-200 hover:bg-slate-300 px-4 py-2 text-slate-700 transition">Cancel</button>
                <button type="submit" className="bg-purple-600 hover:bg-purple-500 text-white font-black px-4 py-2 transition">Commit Asset</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL INTERFACES: CUSTOM HIGH-UTILITY CONFIRM PURGE OVERLAY
          ========================================================================= */}
      {courtToDeleteId && (
        <div className="fixed inset-0 bg-slate-400/50 flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white border border-slate-300 max-w-sm w-full p-6 space-y-4 shadow-2xl text-center">
            
            <div className="inline-flex items-center justify-center h-12 w-12 bg-rose-100 border border-rose-300 text-rose-600 text-xl shadow-inner">
              ⚠️
            </div>
            
            <div className="space-y-1">
              <h3 className="text-base font-black text-slate-900 tracking-tight">Decommission Physical Court Asset</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Are you absolutely sure you want to decouple this asset? This action will permanently remove this court and all historical scheduling logs from the PostgreSQL cluster database.
              </p>
            </div>

            <div className="flex flex-col gap-2 pt-2 text-xs font-bold">
              <button 
                type="button" 
                onClick={handleExecutePurgeAction} 
                className="w-full bg-rose-600 hover:bg-rose-500 text-white p-2.5 rounded-xl transition shadow-lg shadow-rose-950/20"
              >
                Yes, Decommission Infrastructure Asset Permanent
              </button>
              <button 
                type="button" 
                onClick={() => setCourtToDeleteId(null)} 
                className="w-full bg-slate-200 hover:bg-slate-300 text-slate-700 border border-slate-300 p-2.5 transition font-semibold"
              >
                Cancel Action
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
