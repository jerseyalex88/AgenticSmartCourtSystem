import React, { useState, useEffect } from 'react';
import { apiClient } from '../api/apiClient';
import { useAlert } from '../context/AlertContext';
import { useAuth } from '../context/AuthContext';

interface Academy {
  id: string;
  name: string;
  description: string;
  createdAtUtc: string;
  branchCount: number;
}
interface AcademyFormData {
  name: string;
  description: string;
}

export default function AcademiesDashboard() {
  // --- Core State Matrix ---
  const [academies, setAcademies] = useState<Academy[]>([]);

  const [activeAcademyId, setActiveAcademyId] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionError, setActionError] = useState<string | null>(null);
  
  // Modals & Form UI Toggle States
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [editingAcademy, setEditingAcademy] = useState<Academy | null>(null);
  const [formData, setFormData] = useState<AcademyFormData>({ name: '', description: '' });
  const { showAlert } = useAlert();
  const { saveSession } = useAuth();

  // --- Network API Integrations via apiClient ---
  useEffect(() => {
    fetchAcademies();
  }, []);

  const fetchAcademies = async () => {
    try {
      setLoading(true);
      setActionError(null);
      const response = await apiClient.get<Academy[]>('/Academies');
      setAcademies(response.data);

      const profileResponse = await apiClient.get<{ academyId: string }>('/Auth/profile'); 
      if (profileResponse.data?.academyId) {
        setActiveAcademyId(profileResponse.data.academyId);
      }
    } catch (err: any) {
      setActionError(err.response?.data || 'Failed to retrieve system academies catalog matrix.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAcademy = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setActionError(null);
      await apiClient.post<Academy>('/Academies', formData);
      
      setShowCreateModal(false);
      setFormData({ name: '', description: '' });
      await fetchAcademies();

    } catch (err: any) {
      setActionError(err.response?.data || 'Insertion Denied: Missing or malformed parameters.');
    }
  };

  const handleUpdateAcademy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAcademy) return;
    try {
      setActionError(null);
      await apiClient.put(`/Academies/${editingAcademy.id}`, formData);
      
      setEditingAcademy(null);
      setFormData({ name: '', description: '' });
      await fetchAcademies();
    } catch (err: any) {
      setActionError(err.response?.data || 'Modification Denied: Server-side validation failure.');
    }
  };


  // const handleDeleteAcademy = async (id: string, name: string) => {
  //   if (!window.confirm(`⚠️ CRITICAL WARNING: Are you absolutely sure you want to permanently decommission the academy "${name}"? This action will cascade across all branch schedules.`)) return;
  //   try {
  //     setActionError(null);
  //     await apiClient.delete(`/Academies/${id}`);
      
  //     if (activeAcademyId === id) {
  //       setActiveAcademyId(null);
  //       localStorage.removeItem('smartcourt_active_tenant_override');
  //     }
  //     await fetchAcademies();
  //   } catch (err: any) {
  //     setActionError(err.response?.data || 'Purge Request Rejected: Active constraints detected.');
  //   }
  // };

  const handleSetActiveTenantOverride = async (id: string, name: string) => {
    showAlert({
      title: 'Change Default Academy?',
      message: `Are you absolutely sure you want to switch to ${name} as your default academy?`,
      type: 'warning',
      onConfirm: async () => {
        try {
          setActionError(null);

          const response = await apiClient.post(`/Academies/${id}/set-active`, {});
          const freshToken = response.data?.token;
          if (!freshToken) throw new Error('Backend authorization payload returned an empty token signature.');
          saveSession(freshToken);
          setActiveAcademyId(id);
          
          showAlert({ 
            title: 'Default Academy Reset', 
            message: "🌟 Active Academy workspace node shifted successfully.",
            type: 'success' 
          });
          window.location.reload();
        } catch (err: any) {
          setActionError(err.response?.data || 'Tenant Impersonation Routing Failure.');
        }
      }
    });
  };

  const openEditMode = (academy: Academy) => {
    setEditingAcademy(academy);
    setFormData({ name: academy.name, description: academy.description });
  };

  const closeModals = () => {
    setShowCreateModal(false);
    setEditingAcademy(null);

    setFormData({ name: '', description: '' });
  };

  // --- Render Matrix UI ---
  return (
    <div className="space-y-6">
      {/* Upper Navigation Title Block Header Row */}
      <div className="border-b border-slate-800 pb-4 mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight">🏢 Global Academy Infrastructure Matrix</h2>
          <p className="text-xs text-slate-500 mt-1 font-mono">Master administrative routing plane. Deploy tenant boundaries, alter active override nodes, and audit physical academy provisions.</p>
        </div>
        <div>
          <button onClick={() => setShowCreateModal(true)} className="bg-purple-600 hover:bg-purple-500 text-white font-black px-4 py-2.5 text-xs uppercase tracking-wider transition shadow-lg">
            ➕ Provision New Academy
          </button>
        </div>
      </div>


      {/* Dynamic Action Error Banner System */}
      {actionError && (
        <div className="p-4 bg-rose-100 border border-rose-300 text-rose-600 text-xs font-medium flex items-center space-x-2 animate-pulse">
          <span>⚠️</span> <span>{actionError}</span>
        </div>
      )}

      {/* Active Impersonation Context State Tracker Widget */}
      <div className="bg-slate-900 border border-slate-800 p-5 text-white shadow-xl space-y-2 rounded-sm">
        <label className="block text-[10px] font-bold uppercase tracking-widest text-purple-400 font-mono">Active Management Tenant Overlord Node</label>
        <div className="flex items-center space-x-3">
          <div className={`h-2.5 w-2.5 rounded-full ${activeAcademyId ? 'bg-emerald-400 animate-ping' : 'bg-amber-400'}`}></div>
          <span className="text-xs font-black font-mono tracking-tight">
            {activeAcademyId 
              ? `OVERRIDE MATCH ACTIVE: [ID: ${activeAcademyId}]` 
              : 'ISOLATED SYSTEM OVERLORD LOGGED OUT: Operating inside Global System Space (Empty Context)'}
          </span>
        </div>
      </div>


      {/* Primary Data Table Grid Layout */}
      {loading ? (
        <div className="text-center py-12 text-xs font-mono text-slate-500">Querying remote cloud infrastructure tables...</div>
      ) : academies.length === 0 ? (
        <div className="bg-white border border-slate-300 p-8 text-center text-xs text-slate-500 font-mono italic">
          No cloud academy instances deployed inside the ecosystem. Click 'Provision New Academy' to seed the cluster.
        </div>
      ) : (
        <div className="bg-white border border-slate-300 shadow-xl overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-300 text-slate-700 font-bold uppercase tracking-wider text-[10px]">
                <th className="p-4">Academy Status Designation / Details</th>
                <th className="p-4">Tenant Identity (GUID)</th>
                <th className="p-4">Deployed Branches</th>
                <th className="p-4">Anchored Timestamp</th>
                <th className="p-4 text-right">Operational Actions Matrix</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200 font-medium text-slate-800">
              {academies.map((academy) => {
                const isActive = activeAcademyId?.toLowerCase() === academy.id.toLowerCase();
                return (
                  <tr key={academy.id} className={`hover:bg-slate-50 transition-colors ${isActive ? 'bg-purple-50/60 font-semibold' : ''}`}>
                    <td className="p-4">
                      <div className="flex items-center space-x-2">
                        {isActive && <span className="text-purple-600 text-sm">🌟</span>}
                        <div>
                          <p className="font-bold text-slate-900 text-sm">{academy.name}</p>
                          <p className="text-xs text-slate-500 max-w-md mt-0.5">{academy.description || 'No descriptive baseline memo configured.'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 font-mono text-slate-500 text-[11px]">{academy.id}</td>
                    <td className="p-4">
                      <span className="bg-slate-200 text-slate-800 font-bold px-2 py-0.5 rounded-sm font-mono text-[10px]">
                        {academy.branchCount} Node{academy.branchCount > 1 ? 's':''}
                      </span>

                    </td>
                    <td className="p-4 font-mono text-slate-500 text-[11px]">
                      {new Date(academy.createdAtUtc).toLocaleDateString()}
                    </td>
                    <td className="p-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end space-x-2 flex-nowrap">
                        <button onClick={() => handleSetActiveTenantOverride(academy.id,academy.name)} disabled={isActive}
                          className={`px-3 py-1.5 text-[11px] font-black uppercase tracking-wider transition ${
                            isActive 
                              ? 'bg-emerald-100 border border-emerald-300 text-emerald-700 cursor-default' 
                              : 'bg-purple-600 border border-purple-300 hover:bg-purple-500 text-white'
                          }`}>
                          {isActive ? 'Active Node' : 'Set Active Default'}
                        </button>
                        <button onClick={() => openEditMode(academy)} className="bg-slate-200 hover:bg-slate-300 text-slate-700 border border-slate-300 px-3 py-1.5 font-bold transition">
                          📝 Edit
                        </button>
                        {/* <button onClick={() => handleDeleteAcademy(academy.id, academy.name)} className="bg-rose-100 hover:bg-rose-200 text-rose-600 border border-rose-300 px-3 py-1.5 font-bold transition">
                          🗑️ Purge

                        </button> */}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Dual Purpose Modals System Frame (Create / Update Layer) */}
      {(showCreateModal || editingAcademy) && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-400 w-full max-w-md p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight border-b pb-2 mb-4">
              {showCreateModal ? '➕ Provision New Academy Cluster' : '📝 Modify Academy Configurations'}
            </h3>
            <form onSubmit={showCreateModal ? handleCreateAcademy : handleUpdateAcademy} className="space-y-4 text-xs">

              <div className="space-y-1">
                <label className="block font-bold text-slate-700 uppercase tracking-wider text-[10px]">Academy Corporate Designation Title *</label>
                <input type="text" required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Mouratoglou Global Academy" className="w-full bg-white border border-slate-300 p-2 text-slate-800 text-xs focus:outline-none focus:border-purple-500 font-medium" />
              </div>
              <div className="space-y-1">
                <label className="block font-bold text-slate-700 uppercase tracking-wider text-[10px]">Operational Focus / Description Memos</label>
                <textarea rows={3} value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Configure physical parameters or corporate details..." className="w-full bg-white border border-slate-300 p-2 text-slate-800 text-xs focus:outline-none focus:border-purple-500 font-medium" />
              </div>
              <div className="flex justify-end space-x-2 pt-2 border-t mt-4">
                <button type="button" onClick={closeModals} className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold px-4 py-2 transition text-xs">
                  Cancel
                </button>
                <button type="submit" className="bg-purple-600 hover:bg-purple-500 text-white font-black px-4 py-2 transition text-xs uppercase tracking-wider">
                  Save Document Changes
                </button>
              </div>
            </form>

          </div>
        </div>
      )}
    </div>
  );
}
