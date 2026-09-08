import React, { useState } from 'react';
import { Lock, Mail, User, X, AlertCircle, Sparkles } from 'lucide-react';
import { loginWithEmail, signupWithEmail } from '../firebase/authService';

export default function AuthModal({ isOpen, onClose, onAuthSuccess }) {
  const [isSignup, setIsSignup] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      let user;
      if (isSignup) {
        user = await signupWithEmail(email, password, displayName);
      } else {
        user = await loginWithEmail(email, password);
      }
      onAuthSuccess(user);
      onClose();
    } catch (err) {
      console.error(err);
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async (roleEmail, roleName) => {
    setError(null);
    setLoading(true);
    try {
      const user = await loginWithEmail(roleEmail, 'demo1234');
      user.displayName = roleName;
      onAuthSuccess(user);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="p-2 rounded-lg bg-indigo-600/40 text-indigo-300">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold">
                {isSignup ? 'Create Account' : 'Sign In to Helpdesk'}
              </h2>
              <p className="text-xs text-slate-400">Collaborative facility tracking</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {isSignup && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Full Name
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  required
                  placeholder="e.g. Satyabrata Mohanty"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full text-xs pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="email"
                required
                placeholder="you@cbre.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full text-xs pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full text-xs pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg shadow-sm transition disabled:opacity-50"
          >
            {loading ? 'Processing...' : isSignup ? 'Sign Up' : 'Sign In'}
          </button>

          <div className="flex items-center justify-center text-xs text-slate-500 pt-1">
            <button
              type="button"
              onClick={() => setIsSignup(!isSignup)}
              className="text-indigo-600 hover:underline font-medium"
            >
              {isSignup
                ? 'Already have an account? Sign In'
                : "Don't have an account? Sign Up"}
            </button>
          </div>

          {/* One-click demo roles */}
          <div className="pt-4 border-t border-slate-200">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-amber-500" />
              Quick Demo Login:
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() =>
                  handleDemoLogin('facilities.lead@cbre.com', 'Facilities Lead (CBRE)')
                }
                className="p-2 border border-slate-200 rounded-lg text-left hover:bg-slate-50 transition"
              >
                <div className="text-xs font-semibold text-slate-800">Facilities Lead</div>
                <div className="text-[10px] text-slate-500 truncate">facilities.lead@cbre.com</div>
              </button>
              <button
                type="button"
                onClick={() =>
                  handleDemoLogin('technician@cbre.com', 'Tech Engineer (CBRE)')
                }
                className="p-2 border border-slate-200 rounded-lg text-left hover:bg-slate-50 transition"
              >
                <div className="text-xs font-semibold text-slate-800">Helpdesk Engineer</div>
                <div className="text-[10px] text-slate-500 truncate">technician@cbre.com</div>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
