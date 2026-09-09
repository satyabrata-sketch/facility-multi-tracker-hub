import React, { useState } from 'react';
import {
  Download,
  Upload,
  Plus,
  BarChart3,
  Settings,
  User,
  Shield,
  ShieldCheck,
  Calendar,
  Menu,
  X,
  FileSpreadsheet,
  LogOut,
} from 'lucide-react';
import { isConfigValid } from '../firebase/firebaseConfig';
import { isAdminIdentity } from '../firebase/authService';

export default function Navbar({
  user,
  onOpenAuth,
  onLogout,
  onOpenNewTicket,
  onOpenImport,
  onExport,
  activeTab = 'tracker',
  onTabChange,
  onOpenConfig,
  onOpenUsers,
  ticketCount,
  selectedYear,
  onSelectYear,
  yearCounts,
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isAdmin = Boolean(
    user && (user.role === 'Admin' || isAdminIdentity(user.email))
  );

  return (
    <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-30 shadow-md">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo & Year Switcher */}
          <div className="flex items-center space-x-3">
            <div className="flex items-center flex-shrink-0">
              <span className="h-9 sm:h-10 px-3.5 rounded-xl bg-gradient-to-br from-[#003F2D] to-[#005A3E] border border-emerald-500/40 flex items-center justify-center shadow-md text-emerald-200 font-black text-sm sm:text-base tracking-wider gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                CBRE
              </span>
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="font-bold text-sm sm:text-base tracking-tight text-white flex items-center gap-1.5">
                  Helpdesk Tracker
                </h1>
                {isConfigValid ? (
                  <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-900/80 text-emerald-200 border border-emerald-600/50 gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    Live
                  </span>
                ) : (
                  <span className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-amber-900/60 text-amber-200 border border-amber-600/50">
                    Demo Mode
                  </span>
                )}
              </div>

              {/* Year Switcher Tabs */}
              <div className="flex items-center space-x-1 mt-0.5">
                <button
                  type="button"
                  onClick={() => onSelectYear('2026')}
                  className={`text-[11px] px-2 py-0.5 rounded-md font-semibold transition ${
                    selectedYear === '2026'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  }`}
                  title="Filter to FY 2025-26 tickets"
                >
                  2026 (FY 25-26){yearCounts?.y2026 ? ` (${yearCounts.y2026})` : ''}
                </button>
                <button
                  type="button"
                  onClick={() => onSelectYear('2025')}
                  className={`text-[11px] px-2 py-0.5 rounded-md font-semibold transition ${
                    selectedYear === '2025'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  }`}
                  title="Filter to FY 2024-25 tickets"
                >
                  2025 (FY 24-25){yearCounts?.y2025 ? ` (${yearCounts.y2025})` : ''}
                </button>
                <button
                  type="button"
                  onClick={() => onSelectYear('all')}
                  className={`text-[11px] px-2 py-0.5 rounded-md font-semibold transition ${
                    selectedYear === 'all'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  }`}
                  title="Show all multi-year records combined"
                >
                  All ({yearCounts?.total ?? ticketCount})
                </button>
              </div>
            </div>
          </div>

          {/* Primary View Switcher Tabs (Tracker Grid vs Analytics Dashboard) */}
          <div className="hidden lg:flex items-center p-1 bg-slate-800/90 rounded-xl border border-slate-700/80 shadow-inner">
            <button
              type="button"
              onClick={() => onTabChange && onTabChange('tracker')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                activeTab === 'tracker'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Tracker Grid</span>
            </button>
            <button
              type="button"
              onClick={() => onTabChange && onTabChange('analytics')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                activeTab === 'analytics'
                  ? 'bg-gradient-to-r from-[#003F2D] to-[#D40026] text-white shadow-md border border-emerald-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Analytics Dashboard</span>
            </button>
          </div>

          {/* Desktop Toolbar */}
          <div className="hidden md:flex items-center space-x-2.5">
            {/* If screen width is medium (below lg), show compact switcher */}
            <div className="flex lg:hidden items-center p-1 bg-slate-800 rounded-lg border border-slate-700">
              <button
                type="button"
                onClick={() => onTabChange && onTabChange('tracker')}
                className={`p-1.5 rounded text-xs font-bold ${
                  activeTab === 'tracker' ? 'bg-emerald-600 text-white' : 'text-slate-400'
                }`}
                title="Tracker Grid"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => onTabChange && onTabChange('analytics')}
                className={`p-1.5 rounded text-xs font-bold ${
                  activeTab === 'analytics' ? 'bg-gradient-to-r from-[#003F2D] to-[#D40026] text-white' : 'text-slate-400'
                }`}
                title="Analytics Dashboard"
              >
                <BarChart3 className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Import Excel */}
            <button
              onClick={onOpenImport}
              className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-800 border border-slate-700 text-slate-200 hover:bg-slate-700 transition"
            >
              <Upload className="w-3.5 h-3.5 mr-1.5 text-emerald-400" />
              Import
            </button>

            {/* Export Excel */}
            <button
              onClick={onExport}
              className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-800 border border-slate-700 text-slate-200 hover:bg-slate-700 transition"
              title="Export formatted Excel matching tracker"
            >
              <Download className="w-3.5 h-3.5 mr-1.5 text-blue-400" />
              Export Excel
            </button>

            {/* Add New Ticket -> Opens Dedicated Page */}
            <button
              onClick={onOpenNewTicket}
              className="inline-flex items-center px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition shadow-sm"
            >
              <Plus className="w-4 h-4 mr-1 stroke-[2.5]" />
              New Ticket
            </button>

            <div className="h-5 w-px bg-slate-800 mx-1"></div>

            {/* Dedicated Admin Icon Button - ONLY shown if role is Admin or satyabrata.mohanty1@cbre.com */}
            {isAdmin && (
              <button
                onClick={() => (onTabChange ? onTabChange('users') : onOpenUsers())}
                className={`p-2 rounded-lg border transition shadow-sm flex items-center justify-center ${
                  activeTab === 'users'
                    ? 'bg-purple-600 border-purple-500 text-white shadow-purple-900/30 ring-2 ring-purple-400/40'
                    : 'bg-slate-800 border-slate-700 text-purple-300 hover:text-white hover:bg-purple-950/60 hover:border-purple-600/60'
                }`}
                title="Admin Console: Create & Manage Users"
                aria-label="Admin Console"
              >
                <ShieldCheck className="w-4 h-4 text-purple-400" />
              </button>
            )}


            {/* Settings */}
            <button
              onClick={onOpenConfig}
              className="p-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700 transition"
              title="Database Settings (Supabase / Firebase)"
            >
              <Settings className="w-4 h-4" />
            </button>

            {/* User Profile & Logout */}
            {user ? (
              <div className="flex items-center space-x-2 pl-1.5 border-l border-slate-800">
                <div className="flex items-center space-x-2 px-2.5 py-1 rounded-lg bg-slate-800/80 border border-slate-700/70">
                  <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-emerald-600 to-[#D40026] text-white font-bold text-[10px] flex items-center justify-center flex-shrink-0 shadow-sm">
                    {((user.displayName || user.email || 'U')
                      .split(' ')
                      .map((n) => n[0])
                      .join('')
                      .slice(0, 2))
                      .toUpperCase()}
                  </div>
                  <div className="flex flex-col text-left">
                    <span className="text-xs font-bold text-slate-200 leading-tight max-w-[120px] truncate">
                      {user.displayName || user.email?.split('@')[0]}
                    </span>
                    <span className="text-[10px] font-semibold text-emerald-400 leading-none">
                      {user.role || (isAdmin ? 'Admin' : 'Helpdesk Executive')}
                    </span>
                  </div>
                </div>

                {/* Logout Icon Button */}
                <button
                  type="button"
                  onClick={onLogout}
                  className="p-2 rounded-lg bg-slate-800/80 border border-slate-700/70 text-slate-400 hover:text-rose-400 hover:bg-slate-700 hover:border-rose-500/40 transition flex items-center justify-center"
                  title="Log Out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={onOpenAuth}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition shadow-sm"
              >
                Sign In
              </button>
            )}
          </div>

          {/* Mobile Right Controls: New Ticket + Mobile Menu Toggle */}
          <div className="flex items-center space-x-1.5 md:hidden">
            <button
              onClick={onOpenNewTicket}
              className="inline-flex items-center px-3 py-1.5 text-xs font-bold rounded-lg bg-emerald-600 text-white shadow-sm"
            >
              <Plus className="w-3.5 h-3.5 mr-1 stroke-[3]" />
              New Ticket
            </button>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg bg-slate-800 text-slate-300 hover:text-white"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden py-3 border-t border-slate-800 space-y-2 animate-in fade-in duration-150">
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => {
                  onTabChange && onTabChange('tracker');
                  setMobileMenuOpen(false);
                }}
                className={`flex items-center justify-center p-2.5 rounded-xl text-xs font-semibold ${
                  activeTab === 'tracker' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-200'
                }`}
              >
                <FileSpreadsheet className="w-4 h-4 mr-1.5" />
                Tracker Grid
              </button>
              <button
                onClick={() => {
                  onTabChange && onTabChange('analytics');
                  setMobileMenuOpen(false);
                }}
                className={`flex items-center justify-center p-2.5 rounded-xl text-xs font-semibold ${
                  activeTab === 'analytics'
                    ? 'bg-gradient-to-r from-[#003F2D] to-[#D40026] text-white'
                    : 'bg-slate-800 text-slate-200'
                }`}
              >
                <BarChart3 className="w-4 h-4 mr-1.5" />
                Analytics
              </button>
              <button
                onClick={() => {
                  onExport();
                  setMobileMenuOpen(false);
                }}
                className="flex items-center justify-center p-2.5 rounded-xl bg-slate-800 text-xs font-semibold text-slate-200"
              >
                <Download className="w-4 h-4 mr-1.5 text-blue-400" />
                Export Excel
              </button>
              <button
                onClick={() => {
                  onOpenImport();
                  setMobileMenuOpen(false);
                }}
                className="flex items-center justify-center p-2.5 rounded-xl bg-slate-800 text-xs font-semibold text-slate-200"
              >
                <Upload className="w-4 h-4 mr-1.5 text-emerald-400" />
                Import Excel
              </button>
              {isAdmin && (
                <button
                  onClick={() => {
                    onTabChange ? onTabChange('users') : onOpenUsers();
                    setMobileMenuOpen(false);
                  }}
                  className="flex items-center justify-center p-2.5 rounded-xl bg-purple-900/50 border border-purple-700/60 text-xs font-semibold text-purple-200"
                >
                  <Shield className="w-4 h-4 mr-1.5 text-purple-400" />
                  Admin Console
                </button>
              )}
              <button
                onClick={() => {
                  onOpenConfig();
                  setMobileMenuOpen(false);
                }}
                className="flex items-center justify-center p-2.5 rounded-xl bg-slate-800 text-xs font-semibold text-slate-200"
              >
                <Settings className="w-4 h-4 mr-1.5 text-slate-400" />
                Firebase
              </button>
            </div>

            {user ? (
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-800/80 border border-slate-700/60 text-xs text-slate-300">
                <div className="flex items-center space-x-2 min-w-0">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-emerald-600 to-[#D40026] text-white font-bold text-xs flex items-center justify-center flex-shrink-0">
                    {((user.displayName || user.email || 'U')
                      .split(' ')
                      .map((n) => n[0])
                      .join('')
                      .slice(0, 2))
                      .toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-white text-xs truncate">
                      {user.displayName || user.email?.split('@')[0]}
                    </p>
                    <p className="text-[10px] text-emerald-400 font-semibold">
                      {user.role || (isAdmin ? 'Admin' : 'Helpdesk Executive')}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    onLogout();
                    setMobileMenuOpen(false);
                  }}
                  className="p-1.5 rounded-lg bg-slate-700/80 text-slate-300 hover:text-rose-400 hover:bg-slate-700 transition"
                  title="Log Out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  onOpenAuth();
                  setMobileMenuOpen(false);
                }}
                className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold text-center transition"
              >
                Sign In / Sign Up
              </button>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
