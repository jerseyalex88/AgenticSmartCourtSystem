import React, { useState, useEffect } from 'react';
import { apiClient } from '../api/apiClient';

interface IdentityUser {
  id: string;
  email: string;
  userName: string;
  role: string;
  isActive: boolean;
  phoneNumber?: string;
}

export default function AdminTools() {
  const [users, setUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState<boolean>(true);
  const [actionError, setActionError] = useState<string | null>(null);
  const [uiSuccessMessage, setUiSuccessMessage] = useState<string | null>(null);

  // Active form triggers tracking creation vs editing workflows
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);

  // Input states matching your backend C# identity attributes
  const [createUserPayload, setCreateUserPayload] = useState({
    email: '',
    userName: '',
    password: '',
    role: 'Player',
    phoneNumber: ''
  });

  const [editUserPayload, setEditUserPayload] = useState({
    email: '',
    userName: '',
    role: 'Player',
    phoneNumber: '',
    isActive: true
  });

  const handleClearMessages = () => {
    setActionError(null);
    setUiSuccessMessage(null);
  };
  const fetchTenantUsers = async () => {
    try {
      setLoading(true);
      setActionError(null);
      // Queries your existing C# identity controller to list partitioned user rows
      const response = await apiClient.get('/Auth/tenant-users');
      setUsers(response.data);
    } catch (err: any) {
      setActionError('Failed to synchronize tenant identity user accounts pool.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTenantUsers();
  }, []);

  const handleBeginEditUser = (user: IdentityUser) => {
    setEditingUserId(user.id);
    setEditUserPayload({
      email: user.email,
      userName: user.userName,
      role: user.role,
      phoneNumber: user.phoneNumber || '',
      isActive: user.isActive
    });
  };
  const handleCreateIdentityUser = async (e: React.FormEvent) => {
    e.preventDefault();
    handleClearMessages();
    try {
      const res = await apiClient.post('/Auth/provision-user', createUserPayload);
      setUsers([...users, res.data]);
      setShowCreateModal(false);
      setUiSuccessMessage(`🎉 Account ${res.data.email} successfully provisioned to PostgreSQL system registries.`);
      setCreateUserPayload({ email: '', userName: '', password: '', role: 'Player', phoneNumber: '' });
    } catch (err: any) {
      setActionError(err.response?.data || 'Relational Exception: Could not persist new user identity row.');
    }
  };

  const handleUpdateIdentityUser = async (e: React.FormEvent) => {
    e.preventDefault();
    handleClearMessages();
    if (!editingUserId) return;
    try {
      // 1. Capture the updated data object returned by the C# controller
      const response = await apiClient.put(`/Auth/users/${editingUserId}`, editUserPayload);
      
      // 2. Map across your array utilizing the explicit payload returned by PostgreSQL registries
      setUsers(users.map(u => u.id === editingUserId ? response.data : u));
      
      setEditingUserId(null);
      setUiSuccessMessage('🎉 Identity modifications committed successfully past multi-tenant barriers.');
    } catch (err: any) {
      setActionError(err.response?.data || 'Failed to preserve user profile updates.');
    }
  };

  const handleDeleteIdentityUser = async (userId: string, email: string) => {
    if (!window.confirm(`Are you absolutely sure you want to delete account ${email}? All associated data rows in PostgreSQL will be purged.`)) return;
    handleClearMessages();
    try {
      await apiClient.delete(`/Auth/users/${userId}`);
      setUsers(users.filter(u => u.id !== userId));
      setUiSuccessMessage(`🎉 Account ${email} permanently purged from the Identity system.`);
    } catch (err: any) {
      setActionError(err.response?.data || 'Purge Failure: Unable to clear user entry.');
    }
  };
  const filteredUsers = users.filter(user => 
    user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.role.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.userName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) return <div className="text-center py-12 text-xs font-mono text-slate-500">Synchronizing Identity Rosters...</div>;

  return (
    <div className="space-y-6">
      {actionError && <div className="p-4 bg-rose-950/40 border border-rose-900 text-rose-300 rounded-xl text-xs font-medium">⚠️ {actionError}</div>}
      {uiSuccessMessage && <div className="p-4 bg-emerald-950/40 border border-emerald-900 text-emerald-400 rounded-xl text-xs font-medium">✅ {uiSuccessMessage}</div>}

      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-xl">
        <input 
          type="text" 
          placeholder="🔍 Search users by email or authorization tier..." 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full sm:max-w-md bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
        />
        <button onClick={() => setShowCreateModal(true)} className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-500 text-slate-950 px-4 py-2.5 rounded-xl text-xs font-black transition whitespace-nowrap">
          ➕ Provision Fresh User Account
        </button>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-950/60 border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider">
              <th className="p-4">Account Email / Identifier</th>
              <th className="p-4">Authorization Tier</th>
              <th className="p-4">Status Flag</th>
              <th className="p-4 text-right">Operational Actions Matrix</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-850">
            {filteredUsers.map((user) => (
              <tr key={user.id} className="hover:bg-slate-850/30 transition">
                <td className="p-4 font-semibold text-slate-200">
                  <div className="text-emerald-400 font-mono">@{user.userName}</div>
                  <div>{user.email}</div>
                  <div className="text-[10px] text-slate-500 font-mono mt-0.5">{user.id}</div>
                </td>
                <td className="p-4">
                  <span className="bg-blue-950 text-blue-400 border border-blue-900/60 px-2 py-0.5 rounded text-[10px] font-bold uppercase">
                    {user.role}
                  </span>
                </td>
                <td className="p-4">
                  <span className={`h-2 w-2 inline-block rounded-full mr-1.5 ${user.isActive ? 'bg-emerald-400 shadow-lg shadow-emerald-400/40' : 'bg-slate-600'}`} />
                  <span className="font-medium text-slate-400">{user.isActive ? 'Active' : 'Suspended'}</span>
                </td>
                <td className="p-4 text-right space-x-2">
                  <button onClick={() => handleBeginEditUser(user)} className="text-slate-400 hover:text-slate-200 font-bold border border-slate-800 bg-slate-950 px-2.5 py-1.5 rounded-lg transition">📝 Edit</button>
                  <button onClick={() => handleDeleteIdentityUser(user.id, user.email)} className="text-slate-500 hover:text-rose-400 px-2.5 py-1.5 rounded-lg transition font-bold">🗑️ Purge</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredUsers.length === 0 && <div className="p-12 text-center text-xs font-mono text-slate-500 italic">No matching identity user profiles tracked across this tenant segment.</div>}
      </div>
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <form onSubmit={handleCreateIdentityUser} className="space-y-4">
            <h3 className="text-base font-black text-slate-100">Provision Fresh Account Entry</h3>
              <div>
                  <label className="block font-bold text-slate-400 uppercase mb-1">User Handle (Username)</label>
                  <input 
                    type="text" 
                    required 
                    value={showCreateModal ? createUserPayload.userName : editUserPayload.userName} 
                    onChange={(e) => showCreateModal 
                      ? setCreateUserPayload({...createUserPayload, userName: e.target.value})
                      : setEditUserPayload({...editUserPayload, userName: e.target.value})
                    } 
                    placeholder="SamSpade" 
                    className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-slate-200 focus:outline-none focus:border-emerald-500" 
                  />
                </div>
              <div>
                <label className="block font-bold text-slate-400 uppercase mb-1">Email Coordinates</label>
                <input type="email" required value={createUserPayload.email} onChange={(e) => setCreateUserPayload({...createUserPayload, email: e.target.value})} placeholder="staff@domain.com" className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-slate-200" />
              </div>
              <div>
                <label className="block font-bold text-slate-400 uppercase mb-1">Initial Password Gate</label>
                <input type="password" required value={createUserPayload.password} onChange={(e) => setCreateUserPayload({...createUserPayload, password: e.target.value})} placeholder="••••••••" className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-slate-200" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-400 uppercase mb-1">Initial Security Role</label>
                  <select value={createUserPayload.role} onChange={(e) => setCreateUserPayload({...createUserPayload, role: e.target.value})} className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-slate-200">
                    <option value="Player">Player</option>
                    <option value="Groundskeeper">Groundskeeper</option>
                    <option value="AcademyDirector">AcademyDirector</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-400 uppercase mb-1">Contact Phone</label>
                  <input type="text" value={createUserPayload.phoneNumber} onChange={(e) => setCreateUserPayload({...createUserPayload, phoneNumber: e.target.value})} placeholder="Optional" className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-slate-200" />
                </div>
              </div>
              <div className="flex items-center justify-end space-x-2 pt-2">
                <button type="button" onClick={() => setShowCreateModal(false)} className="bg-slate-950 hover:bg-slate-850 px-4 py-2 rounded-xl text-slate-400 transition">Cancel</button>
                <button type="submit" className="bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-black px-4 py-2 rounded-xl transition">Provision Node</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editingUserId && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <form onSubmit={handleUpdateIdentityUser} className="space-y-4">
            <h3 className="text-base font-black text-slate-100">Modify Account Identity Profile</h3>
              <div>
                  <label className="block font-bold text-slate-400 uppercase mb-1">User Handle (Username)</label>
                  <input 
                    type="text" 
                    required 
                    value={showCreateModal ? createUserPayload.userName : editUserPayload.userName} 
                    onChange={(e) => showCreateModal 
                      ? setCreateUserPayload({...createUserPayload, userName: e.target.value})
                      : setEditUserPayload({...editUserPayload, userName: e.target.value})
                    } 
                    placeholder="SamSpade" 
                    className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-slate-200 focus:outline-none focus:border-emerald-500" 
                  />
                </div>
              <div>
                <label className="block font-bold text-slate-400 uppercase mb-1">User Email Reference</label>
                <input type="email" required value={editUserPayload.email} onChange={(e) => setEditUserPayload({...editUserPayload, email: e.target.value})} className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-slate-200" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-400 uppercase mb-1">Security Clearance Tier</label>
                  <select value={editUserPayload.role} onChange={(e) => setEditUserPayload({...editUserPayload, role: e.target.value})} className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-slate-200">
                    <option value="Player">Player</option>
                    <option value="Groundskeeper">Groundskeeper</option>
                    <option value="AcademyDirector">AcademyDirector</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-400 uppercase mb-1">Contact Phone</label>
                  <input type="text" value={editUserPayload.phoneNumber} onChange={(e) => setEditUserPayload({...editUserPayload, phoneNumber: e.target.value})} className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-slate-200" />
                </div>
              </div>
              <div className="flex items-center space-x-1.5 py-1">
                <input type="checkbox" id="isActiveCheck" checked={editUserPayload.isActive} onChange={(e) => setEditUserPayload({...editUserPayload, isActive: e.target.checked})} className="accent-emerald-500 rounded h-4 w-4" />
                <label htmlFor="isActiveCheck" className="text-slate-300 font-semibold cursor-pointer">Account login permissions remain functional (IsActive)</label>
              </div>
              <div className="flex items-center justify-end space-x-2 pt-2">
                <button type="button" onClick={() => setEditingUserId(null)} className="bg-slate-950 hover:bg-slate-850 px-4 py-2 rounded-xl text-slate-400 transition">Cancel</button>
                <button type="submit" className="bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-black px-4 py-2 rounded-xl transition">Commit Modifications</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
