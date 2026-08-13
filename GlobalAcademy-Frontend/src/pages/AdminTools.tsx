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
  const isLoggedInGlobalAdmin = loggedInUser?.role.toLowerCase() === 'globaladmin';
  const isLoggedInDirector = loggedInUser?.role.toLowerCase() === 'academydirector';
  const [users, setUsers] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState<boolean>(true);
  const [actionError, setActionError] = useState<string | null>(null);
  const [uiSuccessMessage, setUiSuccessMessage] = useState<string | null>(null);

  // Active form triggers tracking creation vs editing workflows
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const { showAlert } = useAlert();

  const [adminOverridePassword, setAdminOverridePassword] = useState<string>('');
  const [isOverridingPassword, setIsOverridingPassword] = useState<boolean>(false);
  const [showOverridePassword, setShowOverridePassword] = useState<boolean>(false); // For your eye visibility toggles

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

  // =========================================================================
  // 🚀 ADMINISTRATIVE FORCE-RESET CREVENTIALS OVERRIDE
  // =========================================================================
  const handleAdminForceResetPassword = async () => {
    handleClearMessages();
    
    if (!editUserPayload.email) {
      setActionError("Infrastructure Error: Missing target user email coordinate pointer.");
      return;
    }

    if (!adminOverridePassword.trim() || adminOverridePassword.length < 6) {
      setActionError("Validation Error: Administrative override passwords must be at least 6 characters in length.");
      return;
    }

    showAlert({
      title: 'Override Password?',
      message: `⚠️ Security Warning: Are you completely sure you want to forcefully overwrite the secure password credentials for ${editUserPayload.email} instantly?`,
      type: 'warning',
      onConfirm: async () => {
        try {
          setIsOverridingPassword(true);

          // Matches your compiled C# backend Data Transfer Object contracts exactly
          await apiClient.post('/Auth/admin-override-password', {
            targetUserEmail: editUserPayload.email,
            newPassword: adminOverridePassword.trim()
          });

          setUiSuccessMessage(`🎉 Clean Ledger Update: Profile credentials row for ${editUserPayload.email} has been overwritten live inside database tables.`);
          setAdminOverridePassword(''); // Erase plaintext password memory footprints
        } catch (err: any) {
          console.error("Administrative override exception caught:", err);
          const serverErr = err.response?.data?.message || err.response?.data || 'Access Denied: Administrative credential manipulation protocol failed.';
          setActionError(serverErr);
        } finally {
          setIsOverridingPassword(false);
        }
      }
    });
  };

  const roleProtectedList = users.filter(user => {
    if (!isLoggedInGlobalAdmin && user.role?.toLowerCase() === 'globaladmin') {
      return false; // Safely hide GlobalAdmin accounts from AcademyDirectors
    }
    return true; // Keep all other standard operational users visible
  });

  // compile the filtered results based on search query values
  const baseFilteredList = roleProtectedList.filter(user => 
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
            ➕ Provision New User Account
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
                  <td className="p-4 text-left space-x-2">
                    <button onClick={() => handleBeginEditUser(user)} className="text-slate-600 hover:text-slate-800 font-bold border border-slate-300 bg-white px-2.5 py-1.5 transition">📝 Edit</button>
                    {user.role !== 'AcademyDirector' && user.role !== 'GlobalAdmin' && (
                      <button onClick={() => handleDeleteIdentityUser(user.id, user.email)} className="text-slate-600 hover:text-rose-600 px-2.5 py-1.5 transition font-bold">🗑️ Delete</button>
                    )}
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
            <h3 className="text-base font-black text-slate-900">Provision New Account Entry</h3>
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

              {/* =========================================================================
                  🚀 MASTER OVERRIDE VAULT PANEL (DIRECTORS ONLY)
                 ========================================================================= */}
              {isLoggedInDirector && 
              <div className="pt-3 border-t border-dashed border-slate-200 mt-2 space-y-2">
                <label className="block text-[11px] font-black uppercase tracking-wider text-rose-600">
                  ⚠️ Administrative Password Override
                </label>
                <p className="text-slate-500 text-[10px] leading-normal pb-0.5">
                  Type a new plain text master key string below to forcefully clear their existing encrypted row and assign new login credentials instantly on the spot.
                </p>
                
                {/* Width-aligned relative flex layout container with integrated visibility eyes */}
                <div className="flex gap-2 items-center w-full">
                  <div className="relative flex items-center w-full">
                    <input
                      type={showOverridePassword ? "text" : "password"}
                      disabled={isOverridingPassword}
                      value={adminOverridePassword}
                      onChange={(e) => setAdminOverridePassword(e.target.value)}
                      placeholder="Enter new master override..."
                      className="w-full bg-slate-50 border border-slate-300 p-2 pr-10 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-rose-500 font-medium"
                    />
                    <button
                      type="button"
                      onClick={() => setShowOverridePassword(!showOverridePassword)}
                      className="absolute right-3 text-slate-400 hover:text-rose-600 focus:outline-none"
                    >
                      {showOverridePassword ? (
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" /></svg>
                      ) : (
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                      )}
                    </button>
                  </div>
                  
                  <button
                    type="button" // Static button decouples execution tracking parameters from main form submits
                    disabled={isOverridingPassword || !adminOverridePassword.trim()}
                    onClick={handleAdminForceResetPassword}
                    className="bg-rose-600 hover:bg-rose-500 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed text-white font-bold px-3.5 py-2 uppercase tracking-wide transition whitespace-nowrap h-[38px] flex items-center justify-center"
                  >
                    {isOverridingPassword ? 'Resetting...' : 'Force Overwrite'}
                  </button>
                </div>
              </div>
              }

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
