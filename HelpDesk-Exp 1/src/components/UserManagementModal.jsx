import React, { useState, useEffect } from 'react';
import {
  Users,
  UserPlus,
  Shield,
  Trash2,
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Mail,
  Lock,
  User,
  Search,
  KeyRound,
  Eye,
  EyeOff,
} from 'lucide-react';
import {
  createUserAsAdmin,
  fetchUsersList,
  deleteUserAsAdmin,
} from '../firebase/authService';

const ROLE_CONFIGS = {
  Admin: {
    color: 'bg-rose-100 text-rose-800 border-rose-200',
    desc: 'Full administrative access: User management, data import/export, and schema controls',
  },
  'Facilities Lead': {
    color: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    desc: 'Full operational access: Tracker, analytics, dispatching, and reporting',
  },
  'Helpdesk Engineer': {
    color: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    desc: 'Daily operations: Create tickets, edit in-place, and resolve requests',
  },
  Technician: {
    color: 'bg-amber-100 text-amber-800 border-amber-200',
    desc: 'Field execution: Update status, action taken, and task remarks',
  },
  Viewer: {
    color: 'bg-slate-100 text-slate-700 border-slate-200',
    desc: 'Read-only visibility into tracker logs and visual analytics',
  },
};

export default function UserManagementModal({ isOpen, onClose, currentUser }) {
  const [activeTab, setActiveTab] = useState('directory'); // 'directory' | 'create'
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Form states
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('Helpdesk Engineer');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);
  const [formSuccess, setFormSuccess] = useState(null);

  useEffect(() => {
    if (isOpen) {
      loadUsers();
    }
  }, [isOpen]);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const list = await fetchUsersList();
      setUsers(list);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    if (password.length < 6) {
      setFormError('Password must be at least 6 characters.');
      return;
    }

    setSubmitting(true);
    try {
      const created = await createUserAsAdmin({
        email,
        password,
        displayName: name,
        role,
        adminEmail: currentUser?.email || 'admin@cbre.com',
      });

      setFormSuccess(`User account for ${created.displayName} (${created.email}) created successfully!`);
      setName('');
      setEmail('');
      setPassword('');
      setRole('Helpdesk Engineer');
      await loadUsers();
      setTimeout(() => {
        setActiveTab('directory');
        setFormSuccess(null);
      }, 1500);
    } catch (err) {
      console.error(err);
      setFormError(err.message || 'Failed to create user account');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteUser = async (userToDelete) => {
    if (userToDelete.email === currentUser?.email) {
      alert('You cannot delete your own logged-in account.');
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to remove user "${userToDelete.displayName || userToDelete.email}" from the team?`
    );
    if (!confirmed) return;

    try {
      await deleteUserAsAdmin(userToDelete.uid, userToDelete.email);
      setUsers((prev) => prev.filter((u) => u.uid !== userToDelete.uid && u.email !== userToDelete.email));
    } catch (err) {
      alert('Failed to delete user: ' + err.message);
    }
  };

  const filteredUsers = users.filter((u) => {
    const q = searchQuery.toLowerCase();
    return (
      (u.displayName || '').toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q) ||
      (u.role || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between flex-shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-lg bg-emerald-600/30 border border-emerald-500/40 text-emerald-400">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight flex items-center gap-2">
                Team & User Management
                <span className="text-[11px] font-normal px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                  {users.length} Users
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Admin controls: Provision team accounts, assign roles, and manage access
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Controls */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-6 pt-3 gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('directory')}
            className={`pb-2.5 px-3 text-xs font-semibold flex items-center gap-1.5 border-b-2 transition ${
              activeTab === 'directory'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Team Directory ({users.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('create')}
            className={`pb-2.5 px-3 text-xs font-semibold flex items-center gap-1.5 border-b-2 transition ${
              activeTab === 'create'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>+ Create New User</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1">
          {activeTab === 'create' ? (
            <form onSubmit={handleCreateUser} className="space-y-4 max-w-lg mx-auto">
              <div className="text-center pb-2">
                <h3 className="text-sm font-bold text-slate-800">
                  Provision New Facility Team Account
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  The new user will be able to sign in immediately using their email and password.
                </p>
              </div>

              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {formSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-600" />
                  <span>{formSuccess}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Full Name
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    required
                    placeholder="e.g. Wajid CBRE"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full text-xs pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 shadow-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Corporate Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="email"
                    required
                    placeholder="wajid@cbre.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full text-xs pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 shadow-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Initial Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="Minimum 6 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full text-xs pl-9 pr-10 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 shadow-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Operational Role
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white shadow-sm font-medium"
                >
                  <option value="Admin">Admin (Full administrative & user controls)</option>
                  <option value="Facilities Lead">Facilities Lead (All tracker operations & visuals)</option>
                  <option value="Helpdesk Engineer">Helpdesk Engineer (Log tickets, in-grid edits, resolution)</option>
                  <option value="Technician">Technician (Task updates & action logs)</option>
                  <option value="Viewer">Viewer (Read-only)</option>
                </select>
                <p className="text-[11px] text-slate-500 mt-1">
                  {ROLE_CONFIGS[role]?.desc}
                </p>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-sm transition disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Creating User Account...</span>
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4" />
                      <span>Create User Account</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              {/* Search Bar */}
              <div className="flex items-center justify-between gap-3">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Search by name, email, or role..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('create')}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg shadow-sm transition flex items-center gap-1 flex-shrink-0 cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Add User</span>
                </button>
              </div>

              {/* Users Table */}
              {loading ? (
                <div className="py-12 flex flex-col items-center justify-center space-y-2 text-slate-500">
                  <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
                  <span className="text-xs">Loading team directory...</span>
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className="py-12 text-center text-slate-500 space-y-2">
                  <Users className="w-8 h-8 mx-auto text-slate-300" />
                  <p className="text-xs">No users match "{searchQuery}"</p>
                </div>
              ) : (
                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                  <table className="min-w-full divide-y divide-slate-200 text-xs">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-4 py-2.5 text-left font-semibold text-slate-700">Team Member</th>
                        <th className="px-3 py-2.5 text-left font-semibold text-slate-700">Role</th>
                        <th className="px-3 py-2.5 text-left font-semibold text-slate-700 hidden sm:table-cell">Created</th>
                        <th className="px-3 py-2.5 text-right font-semibold text-slate-700">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-100">
                      {filteredUsers.map((u) => {
                        const roleStyle = ROLE_CONFIGS[u.role]?.color || 'bg-slate-100 text-slate-700 border-slate-200';
                        const initials = (u.displayName || u.email || 'U')
                          .split(' ')
                          .map((n) => n[0])
                          .join('')
                          .slice(0, 2)
                          .toUpperCase();

                        return (
                          <tr key={u.uid || u.email} className="hover:bg-slate-50 transition">
                            <td className="px-4 py-3">
                              <div className="flex items-center space-x-2.5">
                                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-slate-700 to-slate-900 text-white flex items-center justify-center font-bold text-xs flex-shrink-0">
                                  {initials}
                                </div>
                                <div className="min-w-0">
                                  <p className="font-semibold text-slate-900 truncate">
                                    {u.displayName || u.email.split('@')[0]}
                                  </p>
                                  <p className="text-[11px] text-slate-500 truncate">{u.email}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-3 py-3 whitespace-nowrap">
                              <span className={`px-2 py-0.5 text-[11px] font-medium rounded-full border ${roleStyle}`}>
                                {u.role || 'Helpdesk Engineer'}
                              </span>
                            </td>
                            <td className="px-3 py-3 text-slate-500 whitespace-nowrap hidden sm:table-cell">
                              {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : 'Active'}
                            </td>
                            <td className="px-3 py-3 text-right whitespace-nowrap">
                              <button
                                onClick={() => handleDeleteUser(u)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                                title="Remove user"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 text-xs text-slate-500 flex items-center justify-between flex-shrink-0">
          <span>
            Logged in as: <strong className="text-slate-800">{currentUser?.email || 'Admin'}</strong>
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg text-xs font-semibold text-slate-700 shadow-sm transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
