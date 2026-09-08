import React, { useState } from 'react';
import {
  Building2,
  ShieldCheck,
  Lock,
  Mail,
  Eye,
  EyeOff,
  Check,
  Laptop,
  Settings,
  AlertCircle,
  ArrowRight,
  Sparkles,
  Users,
  ShieldAlert,
} from 'lucide-react';
import { loginWithEmail, SYSTEM_ROLES } from '../firebase/authService';

export default function LoginPage({ onLoginSuccess, onOpenConfig }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberDevice, setRememberDevice] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const loggedInUser = await loginWithEmail(email, password, rememberDevice);
      if (onLoginSuccess) {
        onLoginSuccess(loggedInUser);
      }
    } catch (err) {
      console.error('Login error:', err);
      setError(err.message || 'Login failed. Please verify your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 text-slate-100 flex flex-col justify-between relative overflow-hidden font-sans select-none">
      {/* Background Glow Decorations */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-emerald-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-emerald-500/5 rounded-full blur-[120px] pointer-events-none" />

      {/* Top Header Bar */}
      <header className="relative z-10 w-full px-6 py-4 flex items-center justify-between border-b border-slate-800/80 bg-slate-950/40 backdrop-blur-md">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-900/40 border border-emerald-400/30">
            <Building2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-black tracking-wider uppercase text-white flex items-center gap-1.5">
              CBRE <span className="text-emerald-400 font-bold">HelpDesk Tracker</span>
            </h1>
            <p className="text-[11px] text-slate-400">Enterprise Facilities Management</p>
          </div>
        </div>

        {/* Database Config Settings Icon */}
        {onOpenConfig && (
          <button
            type="button"
            onClick={onOpenConfig}
            className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-slate-300 hover:text-white transition flex items-center gap-1.5 text-xs font-semibold shadow-sm"
            title="Configure Supabase / Database Connection"
          >
            <Settings className="w-4 h-4 text-emerald-400" />
            <span className="hidden sm:inline">Database Config</span>
          </button>
        )}
      </header>

      {/* Main Center Card */}
      <main className="relative z-10 flex-1 flex items-center justify-center p-4 sm:p-6 my-auto">
        <div className="w-full max-w-md bg-slate-900/90 border border-slate-800 backdrop-blur-xl rounded-2xl shadow-2xl shadow-black/60 overflow-hidden animate-in fade-in zoom-in duration-200">
          {/* Card Accent Top Line */}
          <div className="h-1.5 w-full bg-gradient-to-r from-emerald-500 via-teal-400 to-indigo-500" />

          <div className="p-6 sm:p-8">
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 mb-3 shadow-inner">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-bold text-white tracking-tight">Sign In to HelpDesk</h2>
              <p className="text-xs text-slate-400 mt-1">
                Enter your credentials to access tickets, analytics & facility controls
              </p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="mb-5 p-3 rounded-xl bg-rose-950/50 border border-rose-800/60 text-rose-300 text-xs flex items-start space-x-2 animate-shake">
                <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
                <span className="leading-relaxed">{error}</span>
              </div>
            )}

            {/* Login Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Email Field */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  CBRE Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                  <input
                    type="email"
                    required
                    placeholder="name@cbre.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full text-xs pl-10 pr-3 py-2.5 bg-slate-950/70 border border-slate-700/80 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition"
                  />
                </div>
              </div>

              {/* Password Field */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full text-xs pl-10 pr-10 py-2.5 bg-slate-950/70 border border-slate-700/80 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-200 transition cursor-pointer"
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Remember this device toggle */}
              <div className="pt-1">
                <label className="flex items-center space-x-2.5 cursor-pointer select-none group">
                  <input
                    type="checkbox"
                    checked={rememberDevice}
                    onChange={(e) => setRememberDevice(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-emerald-600 focus:ring-emerald-500 focus:ring-offset-0 focus:ring-1 cursor-pointer"
                  />
                  <div className="flex items-center space-x-1.5 text-xs text-slate-300 group-hover:text-white transition">
                    <Laptop className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="font-medium">Remember this device</span>
                  </div>
                </label>
                <p className="text-[10px] text-slate-500 pl-6 mt-0.5">
                  Keep me signed in on this computer until I explicitly log out
                </p>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full mt-3 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-emerald-950/50 hover:shadow-emerald-900/60 transition flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Signing In...</span>
                  </>
                ) : (
                  <>
                    <span>Sign In to Dashboard</span>
                    <ArrowRight className="w-4 h-4 stroke-[2.5]" />
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 w-full py-3 text-center text-[11px] text-slate-500 border-t border-slate-800/60 bg-slate-950/40 backdrop-blur-sm">
        <p>CBRE Global Workplace Solutions &bull; Facility Multi-Tracker Hub &bull; Protected & Encrypted</p>
      </footer>
    </div>
  );
}
