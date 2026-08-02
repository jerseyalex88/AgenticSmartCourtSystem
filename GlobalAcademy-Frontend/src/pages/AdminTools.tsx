import React, { useState, useEffect } from 'react';
import { apiClient } from '../api/apiClient';
import { useAuth } from '../context/AuthContext';
import { useAlert } from '../context/AlertContext';

interface IdentityUser {
  id: string;
  email: string;
  userName: string;
  role: string;
  isActive: boolean;
  phoneNumber?: string;
}

export default function AdminTools() {
  const { user: loggedInUser } = useAuth();
  const isPlayer = loggedInUser?.role === 'Player';
  const [users, setUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState<boolean>(true);
  const [actionError, setActionError] = useState<string | null>(null);
  const [uiSuccessMessage, setUiSuccessMessage] = useState<string | null>(null);

  // Active form triggers tracking creation vs editing workflows
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const { showAlert } = useAlert();

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

      if (isPlayer) {
        if (loggedInUser) {
          // console.log(loggedInUser);
          setEditingUserId(loggedInUser.id || 'current-player');
          setEditUserPayload({
            email: loggedInUser.email || '',
            userName: loggedInUser.userName || '',
            role: 'Player',
            phoneNumber: (loggedInUser as any).phoneNumber || '',
            isActive: true
          });
        }
        setLoading(false);
        return;
      }

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
      
      if (!isPlayer) {
        setUsers(users.map(u => u.id === editingUserId ? response.data : u));
        setEditingUserId(null);
      }

      setUiSuccessMessage('🎉 Identity modifications committed successfully.');
    } catch (err: any) {
      setActionError(err.response?.data || 'Failed to preserve user profile updates.');
    }
  };

  const handleDeleteIdentityUser = (userId: string, email: string) => {
    showAlert({
      title: 'Remove User Account?',
      message: `Are you absolutely sure you want to delete account ${email}? All associated data rows in database will be permanently deleted.`,
      type: 'warning',
      onConfirm: async () => {
        try {
          await apiClient.delete(`/Auth/users/${userId}`);
          setUsers(users.filter(u => u.id !== userId));

          showAlert({ 
            title: 'User Account Deleted', 
            message: "User account has been permanently deleted.",
            type: 'success' 
          });

        } catch (err: any) {
          // 5. Extract specific business rule failures (e.g., your 24-hour player lockout rule text string)
          const serverErrorMessage = err.response?.data 
            || err.response?.data?.message 
            || 'Delete Failure: Unable to delete user from the system.';

          showAlert({ 
            title: 'Error', 
            message: serverErrorMessage, // ◄--- Renders "Cancellation Locked: Less than 24 hours..." accurately
            type: 'error' 
          });
        }
      }
    });
  };

  // compile the filtered results based on search query values
  const baseFilteredList = users.filter(user => 
    user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.role.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.userName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Groups by Roles first, then alphabetizes Usernames
  const filteredUsers = [...baseFilteredList].sort((a, b) => {
    // Condition A: Primary Sort Order - Compare Role Names
    const roleCompare = a.role.localeCompare(b.role);
    
    if (roleCompare !== 0) {
      return roleCompare; // Keeps roles cleanly grouped together alphabetically
    }

    // Condition B: Secondary Sort Order - Compare Usernames if roles match
    return a.userName.localeCompare(b.userName);
  });

  if (loading) return <div className="text-center py-12 text-xs font-mono text-slate-500">Synchronizing Identity Rosters...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight">Profiles Administration</h2>
        <p className="text-xs text-slate-500 mt-1 font-mono">Manage user profiles</p>
      </div>

      {actionError && <div className="p-4 bg-rose-100 border border-rose-300 text-rose-600 text-xs font-medium">⚠️ {actionError}</div>}
      {uiSuccessMessage && <div className="p-4 bg-emerald-100 border border-emerald-300 text-emerald-700 text-xs font-medium">✅ {uiSuccessMessage}</div>}

      {!isPlayer && (
        <>
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white border border-slate-300 p-5 shadow-xl">
          <input 
            type="text" 
            placeholder="🔍 Search users by email or authorization tier..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full sm:max-w-md bg-white border border-slate-300 p-2.5 text-xs text-slate-800 focus:outline-none focus:border-purple-500"
          />
          <button onClick={() => setShowCreateModal(true)} className="w-full sm:w-auto bg-purple-600 hover:bg-purple-500 text-white px-4 py-2.5 text-xs font-black transition whitespace-nowrap">
            ➕ Provision Fresh User Account
          </button>
        </div>

        <div className="bg-white border border-slate-300 overflow-hidden shadow-2xl">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-300 text-slate-600 uppercase tracking-wider font-bold text-[10px]">
                <th className="p-4">Account Email / Identifier</th>
                <th className="p-4">Authorization Tier</th>
                <th className="p-4">Status Flag</th>
                <th className="p-4 text-right">Operational Actions Matrix</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredUsers.map((user) => (
                <tr key={user.id} className="hover:bg-slate-100 transition">
                  <td className="p-4 font-semibold text-slate-800">
                    <div className="text-slate-900 font-sans">{user.userName}</div>
                    <div className="text-[10px] text-slate-600 font-sans mt-0.5">{user.email}</div>
                    <div className="text-[10px] text-slate-500 font-sans mt-0.5">{user.id}</div>
                  </td>
                  <td className="p-4">
                    <span className="bg-blue-100 text-blue-600 border border-blue-300 px-2 py-0.5 text-[10px] font-bold uppercase">
                      {user.role}
                    </span>
                  </td>
                  <td className="p-4">
                    <span className={`h-2 w-2 inline-block rounded-full mr-1.5 ${user.isActive ? 'bg-emerald-500 shadow-lg shadow-emerald-500/40' : 'bg-slate-400'}`} />
                    <span className="font-medium text-slate-700">{user.isActive ? 'Active' : 'Suspended'}</span>
                  </td>
                  <td className="p-4 text-right space-x-2">
                    <button onClick={() => handleBeginEditUser(user)} className="text-slate-600 hover:text-slate-800 font-bold border border-slate-300 bg-white px-2.5 py-1.5 transition">📝 Edit</button>
                    <button onClick={() => handleDeleteIdentityUser(user.id, user.email)} className="text-slate-600 hover:text-rose-600 px-2.5 py-1.5 transition font-bold">🗑️ Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredUsers.length === 0 && <div className="p-12 text-center text-xs font-sans text-slate-600 italic">No matching identity user profiles tracked across this tenant segment.</div>}
        </div>
        </>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-400/80 flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-slate-300 max-w-md w-full p-6 space-y-4 shadow-2xl">
            <form onSubmit={handleCreateIdentityUser} className="space-y-4">
            <h3 className="text-base font-black text-slate-900">Provision Fresh Account Entry</h3>
              <div>
                  <label className="block font-bold text-slate-600 uppercase mb-1">User Handle (Username)</label>
                  <input 
                    type="text" 
                    required 
                    value={createUserPayload.userName} 
                    onChange={(e) => setCreateUserPayload({...createUserPayload, userName: e.target.value})}
                    placeholder="SamSpade" 
                    className="w-full bg-white border border-slate-300 p-2.5 text-slate-800 focus:outline-none focus:border-purple-500" 
                  />
                </div>
              <div>
                <label className="block font-bold text-slate-600 uppercase mb-1">Email Coordinates</label>
                <input type="email" required value={createUserPayload.email} onChange={(e) => setCreateUserPayload({...createUserPayload, email: e.target.value})} placeholder="staff@domain.com" className="w-full bg-white border border-slate-300 p-2.5 text-slate-800" />
              </div>
              <div>
                <label className="block font-bold text-slate-600 uppercase mb-1">Initial Password Gate</label>
                <input type="password" required value={createUserPayload.password} onChange={(e) => setCreateUserPayload({...createUserPayload, password: e.target.value})} placeholder="••••••••" className="w-full bg-white border border-slate-300 p-2.5 text-slate-800" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-600 uppercase mb-1">Initial Security Role</label>
                  <select value={createUserPayload.role} onChange={(e) => setCreateUserPayload({...createUserPayload, role: e.target.value})} className="w-full bg-white border border-slate-300 p-2.5 text-slate-800">
                    <option value="Player">Player</option>
                    <option value="Groundskeeper">Groundskeeper</option>
                    <option value="AcademyDirector">AcademyDirector</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-600 uppercase mb-1">Contact Phone</label>
                  <input type="text" value={createUserPayload.phoneNumber} onChange={(e) => setCreateUserPayload({...createUserPayload, phoneNumber: e.target.value})} placeholder="Optional" className="w-full bg-white border border-slate-300 p-2.5 text-slate-800" />
                </div>
              </div>
              <div className="flex items-center justify-end space-x-2 pt-2">
                <button type="button" onClick={() => setShowCreateModal(false)} className="bg-slate-200 hover:bg-slate-300 px-4 py-2 text-slate-700 transition">Cancel</button>
                <button type="submit" className="bg-purple-600 hover:bg-purple-500 text-white font-black px-4 py-2 transition">Provision Node</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editingUserId && (
        <div className={isPlayer ? "max-w-xl mx-auto bg-white border border-slate-300 p-6 shadow-2xl" : "fixed inset-0 bg-slate-400/50 flex items-center justify-center p-4 z-50"}>
          <div className={isPlayer ? "space-y-4 w-full" : "bg-white border border-slate-300 max-w-md w-full p-6 space-y-4 shadow-2xl"}>
            <form onSubmit={handleUpdateIdentityUser} className="space-y-4">
            <h3 className="text-base font-black text-slate-900">Modify Account Identity Profile</h3>
              <div>
                  <label className="block font-bold text-slate-600 uppercase mb-1">User Handle (Username)</label>
                  <input 
                    type="text" 
                    required 
                    value={editUserPayload.userName} 
                    onChange={(e) => setEditUserPayload({...editUserPayload, userName: e.target.value})}
                    placeholder="SamSpade" 
                    className="w-full bg-white border border-slate-300 p-2.5 text-slate-800 focus:outline-none focus:border-purple-500" 
                  />
                </div>
              <div>
                <label className="block font-bold text-slate-600 uppercase mb-1">User Email Reference</label>
                <input type="email" required value={editUserPayload.email} disabled={isPlayer} onChange={(e) => setEditUserPayload({...editUserPayload, email: e.target.value})} className="w-full bg-white border border-slate-300 p-2.5 text-slate-800" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-600 uppercase mb-1">Security Clearance Tier</label>
                  <select disabled={isPlayer} value={editUserPayload.role} onChange={(e) => setEditUserPayload({...editUserPayload, role: e.target.value})} className="w-full bg-white border border-slate-300 p-2.5 text-slate-800">
                    <option value="Player">Player</option>
                    <option value="Groundskeeper">Groundskeeper</option>
                    <option value="AcademyDirector">AcademyDirector</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-600 uppercase mb-1">Contact Phone</label>
                  <input type="text" value={editUserPayload.phoneNumber} onChange={(e) => setEditUserPayload({...editUserPayload, phoneNumber: e.target.value})} className="w-full bg-white border border-slate-300 p-2.5 text-slate-800" />
                </div>
              </div>
              <div className="flex items-center space-x-1.5 py-1">
                <input type="checkbox" id="isActiveCheck" checked={editUserPayload.isActive} onChange={(e) => setEditUserPayload({...editUserPayload, isActive: e.target.checked})} className="accent-purple-500 rounded h-4 w-4" />
                <label htmlFor="isActiveCheck" className="text-slate-700 font-semibold cursor-pointer">Account login permissions remain functional (IsActive)</label>
              </div>
              <div className="flex items-center justify-end space-x-2 pt-2">
                <button type="button" onClick={() => setEditingUserId(null)} className="bg-slate-200 hover:bg-slate-300 px-4 py-2 text-slate-700 transition">Cancel</button>
                <button type="submit" className="bg-purple-600 hover:bg-purple-500 text-white font-black px-4 py-2 transition">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
