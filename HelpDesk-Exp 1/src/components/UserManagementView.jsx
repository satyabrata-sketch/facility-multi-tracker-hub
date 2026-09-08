import React, { useState, useEffect } from 'react';
import {
  Users,
  UserPlus,
  Shield,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Mail,
  Lock,
  User,
  Search,
  Eye,
  EyeOff,
} from 'lucide-react';
import {
  createUserAsAdmin,
  fetchUsersList,
  deleteUserAsAdmin,
} from '../firebase/authService';

export const ROLE_CONFIGS = {
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

export default function UserManagementView({ currentUser, isPage = false }) {
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
    loadUsers();
  }, []);

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

      setFormSuccess(
        `User account for ${created.displayName || created.email} created successfully!`
      );
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
    if (userToDelete.email?.toLowerCase() === currentUser?.email?.toLowerCase()) {
      alert('You cannot delete your own logged-in account.');
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to remove user "${userToDelete.displayName || userToDelete.email}" from the team?`
    );
    if (!confirmed) return;

    try {
      await deleteUserAsAdmin(userToDelete.uid, userToDelete.email);
      setUsers((prev) =>
        prev.filter(
          (u) =>
            u.uid !== userToDelete.uid &&
            u.email?.toLowerCase() !== userToDelete.email?.toLowerCase()
        )
      );
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
    <div className={`space-y-6 ${isPage ? 'max-w-6xl mx-auto p-4 sm:p-6' : ''}`}>
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-xl bg-purple-600 text-white shadow-md">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              Team & User Management
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-200">
                {users.length} Active Users
              </span>
            </h2>
            <p className="text-xs text-slate-500">
              Create, manage, and delete user accounts with role-based access permissions
            </p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200 shadow-inner">
          <button
            type="button"
            onClick={() => setActiveTab('directory')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
              activeTab === 'directory'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Users className="w-3.5 h-3.5 text-purple-600" />
            <span>Team Directory ({users.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('create')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
              activeTab === 'create'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>+ Create New User</span>
          </button>
        </div>
      </div>

      {/* Main Body */}
      {activeTab === 'create' ? (
        <div className="max-w-xl mx-auto bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-5">
          <div className="text-center pb-2">
            <div className="w-12 h-12 rounded-2xl bg-purple-50 border border-purple-200 flex items-center justify-center mx-auto mb-3 text-purple-600">
              <UserPlus className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900">
              Provision New Facility Team Account
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Create a new user account with immediate access to Helpdesk Tracker
            </p>
          </div>

          {formError && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {formSuccess && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-600" />
              <span>{formSuccess}</span>
            </div>
          )}

          <form onSubmit={handleCreateUser} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Full Name / Member Name
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  required
                  placeholder="e.g. Wajid CBRE"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full text-xs pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 shadow-sm"
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
                  placeholder="e.g. user@cbre.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full text-xs pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 shadow-sm"
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
                  placeholder="Minimum 6 characters (e.g. User@123)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full text-xs pl-9 pr-10 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 shadow-sm"
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
                Operational Role & Permissions
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-white shadow-sm font-medium"
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
                className="w-full py-2.5 bg-purple-600 hover:bg-purple-500 active:bg-purple-700 text-white text-xs font-semibold rounded-lg shadow-sm transition disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Provisioning User Account...</span>
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
        </div>
      ) : (
        <div className="space-y-4">
          {/* Search & Actions Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search team members by name, email, or role..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:outline-none shadow-sm"
              />
            </div>
            <button
              type="button"
              onClick={() => setActiveTab('create')}
              className="w-full sm:w-auto px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold rounded-xl shadow-sm transition flex items-center justify-center gap-1.5 flex-shrink-0 cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>+ Add Team Member</span>
            </button>
          </div>

          {/* Directory Table */}
          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center space-y-2 text-slate-500 bg-white rounded-2xl border border-slate-200">
              <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
              <span className="text-xs">Loading team directory...</span>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="py-16 text-center text-slate-500 space-y-2 bg-white rounded-2xl border border-slate-200">
              <Users className="w-8 h-8 mx-auto text-slate-300" />
              <p className="text-xs font-medium">No users match "{searchQuery}"</p>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
              <table className="min-w-full divide-y divide-slate-200 text-xs">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-5 py-3 text-left font-semibold text-slate-700">Team Member</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">Assigned Role</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700 hidden sm:table-cell">Created Date</th>
                    <th className="px-4 py-3 text-right font-semibold text-slate-700">Actions</th>
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
                        <td className="px-5 py-3.5">
                          <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-700 to-indigo-900 text-white flex items-center justify-center font-bold text-xs flex-shrink-0 shadow-sm">
                              {initials}
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold text-slate-900 truncate">
                                {u.displayName || u.email.split('@')[0]}
                              </p>
                              <p className="text-[11px] text-slate-500 truncate">{u.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <span className={`px-2.5 py-0.5 text-[11px] font-semibold rounded-full border ${roleStyle}`}>
                            {u.role || 'Helpdesk Engineer'}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-slate-500 whitespace-nowrap hidden sm:table-cell">
                          {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : 'Active'}
                        </td>
                        <td className="px-4 py-3.5 text-right whitespace-nowrap">
                          <button
                            onClick={() => handleDeleteUser(u)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                            title="Delete user from team"
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
  );
}
