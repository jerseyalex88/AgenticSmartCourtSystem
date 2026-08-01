import { useState, useEffect } from 'react';
import { apiClient } from '../api/apiClient';

interface Branch {
  id: string;
  name: string;
}

interface Court {
  id: string;
  name: string;
}

interface RosterMember {
  userId: string;
  email: string;     // 👈 ADD THIS LINE
  userName: string;  // 👈 ADD THIS LINE
  branchId: string;
  assignmentRole: string;
  assignedAtUtc: string;
  courtClearances?: UserCourtClearance[];
}

interface UserCourtClearance {
  userId: string;
  branchId: string;
  courtId: string;
  accessType: string;
}

export default function RosterDashboard() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  const [courts, setCourts] = useState<Court[]>([]);
  const [roster, setRoster] = useState<RosterMember[]>([]);
  
  const [loading, setLoading] = useState<boolean>(true);
  const [actionError, setActionError] = useState<string | null>(null);

  // Modal Dialog Open/Close Triggers
  const [showAssignUserModal, setShowAssignUserModal] = useState<boolean>(false);
  const [showCourtClearanceModal, setShowCourtClearanceModal] = useState<boolean>(false);
  const [selectedUserIdForClearance, setSelectedUserIdForClearance] = useState<string>('');

  // Form Field Input States
  const [assignUserPayload, setAssignUserPayload] = useState({ userId: '', assignmentRole: 'Groundskeeper' });
  const [courtClearancePayload, setCourtClearancePayload] = useState({ courtId: '', accessType: 'Groundskeeper' });

  const fetchBranches = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get<Branch[]>('/Facility/branches');
      setBranches(res.data);
      if (res.data.length > 0 && !selectedBranchId) {
        setSelectedBranchId(res.data[0].id);
      }
    } catch (err) {
      setActionError('Failed to fetch facility branch nodes.');
    } finally {
      setLoading(false);
    }
  };

  const fetchRosterAndCourts = async (branchId: string) => {
    if (!branchId) return;
    try {
      setActionError(null);
      // Simultaneously pull active branch staff and child court lists
      const [rosterRes, courtRes] = await Promise.all([
        apiClient.get<RosterMember[]>(`/Facility/branches/${branchId}/roster`),
        apiClient.get<Court[]>(`/Facility/branches/${branchId}/courts`)
      ]);
      setRoster(rosterRes.data);
      setCourts(courtRes.data);
    } catch (err) {
      setActionError('Error synchronizing location roster metrics.');
    }
  };

  useEffect(() => {
    fetchBranches();
  }, []);

  useEffect(() => {
    if (selectedBranchId) {
      fetchRosterAndCourts(selectedBranchId);
    }
  }, [selectedBranchId]);
  // --- MUTATION CRUD ACTIONS HANDLERS ---

  const handleAssignUserToBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setActionError(null);
      const payload = {
        userId: assignUserPayload.userId,
        branchId: selectedBranchId,
        assignmentRole: assignUserPayload.assignmentRole
      };
      
      const res = await apiClient.post('/Facility/branches/assign-user', payload);
      setRoster([...roster, { ...res.data, courtClearances: [] }]);
      setShowAssignUserModal(false);
      setAssignUserPayload({ userId: '', assignmentRole: 'Groundskeeper' });
    } catch (err: any) {
      setActionError(err.response?.data || 'Failed to map user to branch roster registry.');
    }
  };

  const handleAddCourtClearance = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setActionError(null);
      const payload = {
        userId: selectedUserIdForClearance,
        branchId: selectedBranchId,
        courtId: courtClearancePayload.courtId,
        accessType: courtClearancePayload.accessType
      };

      const res = await apiClient.post('/Facility/courts/assign-user', payload);
      
      // Update local state to inject the clearance row without reloading
      setRoster(roster.map(member => {
        if (member.userId === selectedUserIdForClearance) {
          const clearances = member.courtClearances || [];
          return { ...member, courtClearances: [...clearances, res.data] };
        }
        return member;
      }));
      
      setShowCourtClearanceModal(false);
      setCourtClearancePayload({ courtId: '', accessType: 'PrimaryGroundskeeper' });
    } catch (err: any) {
      setActionError(err.response?.data || 'Failed to establish specific court task clearance.');
    }
  };

  const handleRemoveUserFromBranch = async (userId: string) => {
    if (!window.confirm('Are you sure you want to remove this user from the location roster? All specific court clearances will be permanently purged.')) return;
    try {
      setActionError(null);
      await apiClient.delete(`/Facility/branches/${selectedBranchId}/remove-user/${userId}`);
      setRoster(roster.filter(m => m.userId !== userId));
    } catch (err) {
      setActionError('Removal Failure: Unable to clear user from branch roster.');
    }
  };

  const handleOpenClearanceModal = (userId: string) => {
    setSelectedUserIdForClearance(userId);
    if (courts.length > 0) {
      setCourtClearancePayload({ courtId: courts[0].id, accessType: 'PrimaryGroundskeeper' });
    }
    setShowCourtClearanceModal(true);
  };

  return (
    <div className="space-y-6">
      
      {actionError && (
        <div className="p-4 bg-rose-100 border border-rose-300 text-rose-600 text-xs font-medium flex items-center space-x-2">
          <span>⚠️</span> <span>{actionError}</span>
        </div>
      )}

      {/* TOP REGIONAL SELECTION BAR */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white border border-slate-300 p-5 shadow-xl">
        <div className="space-y-1">
          <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-700">Select Location Context</label>
          <select 
            value={selectedBranchId} 
            onChange={(e) => setSelectedBranchId(e.target.value)}
            className="bg-white border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-purple-500 min-w-[200px]"
          >
            {branches.map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>

        <button 
          disabled={!selectedBranchId}
          onClick={() => setShowAssignUserModal(true)}
          className="bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white px-4 py-2.5 text-xs font-black transition"
        >
          ➕ Assign Staff to Branch
        </button>
      </div>
      {/* ROSTER PERSONEL DISPLAY GRID LAYOUT */}
      <div className="space-y-4">
        {roster.map((member) => (
          <div key={member.userId} className="bg-white border border-slate-300 p-5 shadow-xl space-y-4">
            <div className="flex items-start justify-between border-b border-slate-300 pb-3">
              <div className="space-y-1">
                {/* Replace <p className="text-sm font-black text-slate-100">{member.userId}</p> with: */}
                <div className="space-y-0.5">
                  <div className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                    <span>👤 {member.email || 'No Email Registered'}</span>
                    <span className="text-emerald-600 font-sans text-xs">(@{member.userName || 'NoHandle'})</span>
                  </div>
                  <p className="text-[10px] text-slate-600 font-sans">Registry ID: {member.userId}</p>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="bg-blue-100 text-blue-600 border border-blue-300 px-2 py-0.5 text-[10px] font-bold uppercase">
                    {member.assignmentRole}
                  </span>
                  <span className="text-[10px] font-sans text-slate-600">
                    Assigned: {new Date(member.assignedAtUtc).toLocaleDateString()}
                  </span>
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                <button 
                  onClick={() => handleOpenClearanceModal(member.userId)}
                  className="text-[11px] bg-slate-200 hover:bg-slate-300 border border-slate-300 text-slate-700 px-3 py-1.5 transition"
                >
                  🛡️ Clear on Court
                </button>
                <button 
                  onClick={() => handleRemoveUserFromBranch(member.userId)}
                  className="text-[11px] text-slate-600 hover:text-rose-600 border border-transparent hover:border-rose-300 hover:bg-rose-50 px-3 py-1.5 transition"
                >
                  Unlink Member
                </button>
              </div>
            </div>

            {/* NESTED COURT CLEARANCE CLEARANCES LIST SUB-GRID */}
            <div className="space-y-2">
              <span className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider font-sans">
                Granular Task Permissions Matrix:
              </span>
              <div className="flex flex-wrap gap-2">
                {member.courtClearances && member.courtClearances.length > 0 ? (
                  member.courtClearances.map((clearance, idx) => {
                    const courtName = courts.find(c => c.id === clearance.courtId)?.name || 'Unknown Court';
                    return (
                      <div key={idx} className="bg-slate-100 border border-slate-300 px-3 py-1.5 flex items-center space-x-2 text-[11px] font-sans">
                        <span className="text-slate-800 font-bold">{courtName}</span>
                        <span className="text-slate-500">//</span>
                        {/* Locate: <span className="text-emerald-400 bg-emerald-950/30 ... font-bold text-[9px] uppercase tracking-wide"> */}
                        {/* Replace the hardcoded inner tag value wrapper string {clearance.accessType} block inside to match this: */}
                        <span className="text-emerald-600 bg-emerald-100 px-1.5 py-0.5 border border-emerald-300 font-bold text-[9px] uppercase tracking-wider font-sans">
                          {clearance.accessType ? clearance.accessType.replace(/_/g, ' ') : 'General Duty'}
                        </span>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-[11px] text-slate-600 italic font-sans pl-1">No court asset clearances assigned to this personnel node yet.</p>
                )}
              </div>
            </div>

          </div>
        ))}

        {roster.length === 0 && (
          <div className="border border-dashed border-slate-300 p-12 text-center text-xs font-sans text-slate-600 italic">
            No administrative staff assigned to the active location branch roster.
          </div>
        )}
      </div>

      {/* OVERLAY DIALOGS: ADD STAFF TO LOCATION NODE */}
      {showAssignUserModal && (
        <div className="fixed inset-0 bg-slate-400/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-slate-300 max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-black text-slate-900">Assign Staff Member to Venue</h3>
            <form onSubmit={handleAssignUserToBranch} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="block font-bold text-slate-600 uppercase">Target User Registry ID (Email or Guid)</label>
                <input type="text" required value={assignUserPayload.userId} onChange={(e) => setAssignUserPayload({...assignUserPayload, userId: e.target.value})} placeholder="e.g., staff@londonvanguard.com" className="w-full bg-white border border-slate-300 p-2.5 text-slate-800 focus:outline-none focus:border-purple-500" />
              </div>
              <div className="space-y-1">
                <label className="block font-bold text-slate-600 uppercase">Operational Assignment Role</label>
                <select value={assignUserPayload.assignmentRole} onChange={(e) => setAssignUserPayload({...assignUserPayload, assignmentRole: e.target.value})} className="w-full bg-white border border-slate-300 p-2.5 text-slate-800" >
                  <option value="Groundskeeper">Groundskeeper Personnel</option>
                  <option value="Coach">Academy Pro Coach</option>
                  <option value="Supervisor">Shift Supervisor</option>
                </select>
              </div>
              <div className="flex items-center justify-end space-x-2 pt-2">
                <button type="button" onClick={() => setShowAssignUserModal(false)} className="bg-slate-200 hover:bg-slate-300 px-4 py-2 text-slate-700 transition">Cancel</button>
                <button type="submit" className="bg-purple-600 hover:bg-purple-500 text-white font-black px-4 py-2 transition">Map Staff</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* OVERLAY DIALOGS: ADD SPECIFIC COURT PERMISSION */}
      {showCourtClearanceModal && (
        <div className="fixed inset-0 bg-slate-400/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-slate-300 max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-black text-slate-900">Grant Granular Court Task Clearance</h3>
            <form onSubmit={handleAddCourtClearance} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="block font-bold text-slate-600 uppercase">Target Court Hardware Asset</label>
                <select value={courtClearancePayload.courtId} onChange={(e) => setCourtClearancePayload({...courtClearancePayload, courtId: e.target.value})} className="w-full bg-white border border-slate-300 p-2.5 text-slate-800" >
                  {courts.map(c => (<option key={c.id} value={c.id}>{c.name}</option>))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="block font-bold text-slate-600 uppercase">Clearance Security Type</label>
                <select value={courtClearancePayload.accessType} onChange={(e) => setCourtClearancePayload({...courtClearancePayload, accessType: e.target.value})} className="w-full bg-white border border-slate-300 p-2.5 text-slate-800" >
                  <option value="PrimaryGroundskeeper">Primary Groundskeeper Duty</option>
                  <option value="Lead_Crew">Lead Crew Responsibility</option>
                  <option value="Assistant">Assistant Backup Crew</option>
                  <option value="Maintenance_Only">Scheduled Maintenance Window Only</option>
                </select>
              </div>
              <div className="flex items-center justify-end space-x-2 pt-2">
                <button type="button" onClick={() => setShowCourtClearanceModal(false)} className="bg-slate-200 hover:bg-slate-300 px-4 py-2 text-slate-700 transition">Cancel</button>
                <button type="submit" className="bg-purple-600 hover:bg-purple-500 text-white font-black px-4 py-2 transition">Grant Clearance</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
