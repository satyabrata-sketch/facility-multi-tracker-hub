import React, { useState } from 'react';
import {
  Settings,
  Database,
  Key,
  X,
  Check,
  RotateCcw,
  ExternalLink,
  ShieldCheck,
  HelpCircle,
  Copy,
  Sparkles,
  Server,
  Flame,
} from 'lucide-react';
import {
  currentConfig as currentFirebaseConfig,
  saveFirebaseConfig,
  resetFirebaseConfig,
  isConfigValid as isFirebaseConfigValid,
} from '../firebase/firebaseConfig';
import {
  getSavedSupabaseConfig,
  saveSupabaseConfig,
  resetSupabaseConfig,
  isSupabaseConfigValid,
  sanitizeSupabaseUrl,
} from '../supabase/supabaseConfig';

export const SUPABASE_SQL_SETUP_SCRIPT = `-- =====================================================
-- CBRE HELPDESK TRACKER - SUPABASE SQL SCHEMA SETUP
-- Paste and run this in Supabase -> SQL Editor -> New query
-- =====================================================

-- 1. Create Tickets Table matching exact 20 Excel columns
CREATE TABLE IF NOT EXISTS public.tickets (
  id TEXT PRIMARY KEY,
  "Sr no." TEXT,
  "Site " TEXT,
  "Zone" TEXT,
  "Location" TEXT,
  "Month " TEXT,
  "Date " TEXT,
  "Report Time" TEXT,
  "Request category" TEXT,
  "Employee Name " TEXT,
  "Request Via " TEXT,
  "Discription " TEXT,
  "Action Taken " TEXT,
  "Date close " TEXT,
  "Close Time" TEXT,
  "Total Time " TEXT,
  "TAT (sla)" TEXT,
  "is On TAT" TEXT,
  "Status " TEXT,
  "Call type" TEXT,
  "Priority" TEXT,
  "year" TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_updated_by TEXT
);

-- 2. Create Users Directory Table
CREATE TABLE IF NOT EXISTS public.app_users (
  uid TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT,
  role TEXT NOT NULL DEFAULT 'Helpdesk Executive',
  department TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT
);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;

-- 4. Clean up any existing policies first to avoid "already exists" errors
DROP POLICY IF EXISTS "Public Read Tickets" ON public.tickets;
DROP POLICY IF EXISTS "Public Insert Tickets" ON public.tickets;
DROP POLICY IF EXISTS "Public Update Tickets" ON public.tickets;
DROP POLICY IF EXISTS "Public Delete Tickets" ON public.tickets;

DROP POLICY IF EXISTS "Public Read Users" ON public.app_users;
DROP POLICY IF EXISTS "Public Insert Users" ON public.app_users;
DROP POLICY IF EXISTS "Public Update Users" ON public.app_users;
DROP POLICY IF EXISTS "Public Delete Users" ON public.app_users;

-- 5. Create Permissive Access Policies
CREATE POLICY "Public Read Tickets" ON public.tickets FOR SELECT USING (true);
CREATE POLICY "Public Insert Tickets" ON public.tickets FOR INSERT WITH CHECK (true);
CREATE POLICY "Public Update Tickets" ON public.tickets FOR UPDATE USING (true);
CREATE POLICY "Public Delete Tickets" ON public.tickets FOR DELETE USING (true);

CREATE POLICY "Public Read Users" ON public.app_users FOR SELECT USING (true);
CREATE POLICY "Public Insert Users" ON public.app_users FOR INSERT WITH CHECK (true);
CREATE POLICY "Public Update Users" ON public.app_users FOR UPDATE USING (true);
CREATE POLICY "Public Delete Users" ON public.app_users FOR DELETE USING (true);

-- 6. Safely enable Real-Time Replication across all users
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.tickets;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.app_users;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
END $$;

-- 7. Insert Default Admin User
INSERT INTO public.app_users (uid, email, display_name, role)
VALUES ('admin-satya', 'satyabrata.mohanty1@cbre.com', 'Satyabrata Mohanty', 'Admin')
ON CONFLICT (uid) DO UPDATE
SET role = 'Admin', display_name = 'Satyabrata Mohanty';
`;

export default function FirebaseConfigModal({ isOpen, onClose }) {
  const [activeTab, setActiveTab] = useState(isSupabaseConfigValid ? 'supabase' : 'supabase');

  // Supabase State
  const initialSupabase = getSavedSupabaseConfig();
  const [supabaseUrl, setSupabaseUrl] = useState(initialSupabase.supabaseUrl || '');
  const [supabaseAnonKey, setSupabaseAnonKey] = useState(initialSupabase.supabaseAnonKey || '');
  const [copiedSql, setCopiedSql] = useState(false);

  // Firebase State
  const [firebaseText, setFirebaseText] = useState(
    JSON.stringify(currentFirebaseConfig, null, 2)
  );
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  const handleSaveSupabase = () => {
    setError(null);
    const cleanUrl = sanitizeSupabaseUrl(supabaseUrl);
    const cleanKey = supabaseAnonKey.trim();

    if (!cleanUrl || !cleanUrl.startsWith('https://') || !cleanUrl.includes('.supabase.co')) {
      setError('Please provide a valid Supabase Project URL (e.g. https://xyz.supabase.co)');
      return;
    }
    if (!cleanKey || cleanKey.length < 20) {
      setError('Please provide a valid Supabase anon public API key');
      return;
    }

    saveSupabaseConfig({
      supabaseUrl: cleanUrl,
      supabaseAnonKey: cleanKey,
    });
  };

  const handleResetSupabase = () => {
    if (confirm('Disconnect Supabase and revert to local storage demo mode?')) {
      resetSupabaseConfig();
    }
  };

  const handleSaveFirebase = () => {
    try {
      const parsed = JSON.parse(firebaseText);
      if (!parsed.projectId || !parsed.apiKey) {
        throw new Error('Config must contain at least projectId and apiKey');
      }
      saveFirebaseConfig(parsed);
    } catch (err) {
      setError('Invalid JSON format: ' + err.message);
    }
  };

  const handleResetFirebase = () => {
    if (confirm('Reset Firebase configuration to default values?')) {
      resetFirebaseConfig();
    }
  };

  const copySqlToClipboard = () => {
    navigator.clipboard.writeText(SUPABASE_SQL_SETUP_SCRIPT);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-lg bg-emerald-600/30 text-emerald-400">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold">Backend Database Settings</h2>
              <p className="text-xs text-slate-400">
                Connect Supabase (Unlimited Free Reads) or Google Firebase
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Backend Switcher Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-6 pt-3 gap-2">
          <button
            type="button"
            onClick={() => {
              setActiveTab('supabase');
              setError(null);
            }}
            className={`px-4 py-2 text-xs font-bold rounded-t-xl transition flex items-center gap-1.5 border-t border-x ${
              activeTab === 'supabase'
                ? 'bg-white text-emerald-700 border-slate-200 shadow-sm'
                : 'text-slate-500 hover:text-slate-800 border-transparent'
            }`}
          >
            <Server className="w-3.5 h-3.5 text-emerald-600" />
            Supabase (PostgreSQL - Recommended)
            {isSupabaseConfigValid && (
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('firebase');
              setError(null);
            }}
            className={`px-4 py-2 text-xs font-bold rounded-t-xl transition flex items-center gap-1.5 border-t border-x ${
              activeTab === 'firebase'
                ? 'bg-white text-amber-700 border-slate-200 shadow-sm'
                : 'text-slate-500 hover:text-slate-800 border-transparent'
            }`}
          >
            <Flame className="w-3.5 h-3.5 text-amber-500" />
            Firebase (Firestore)
            {isFirebaseConfigValid && (
              <span className="w-2 h-2 rounded-full bg-amber-500"></span>
            )}
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* ============================================================ */}
          {/* TAB 1: SUPABASE */}
          {/* ============================================================ */}
          {activeTab === 'supabase' && (
            <div className="space-y-4">
              {/* Status Banner */}
              <div
                className={`p-3.5 rounded-xl border flex items-center space-x-3 text-xs ${
                  isSupabaseConfigValid
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-amber-50 border-amber-200 text-amber-800'
                }`}
              >
                {isSupabaseConfigValid ? (
                  <>
                    <ShieldCheck className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                    <div>
                      <p className="font-semibold">Connected to Supabase PostgreSQL</p>
                      <p className="text-emerald-700">
                        Unlimited reads/writes enabled. Live real-time syncing active for table{' '}
                        <code className="bg-emerald-100 px-1 py-0.5 rounded font-mono">tickets</code>.
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <HelpCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
                    <div>
                      <p className="font-semibold">Supabase Not Connected (Local Demo Mode)</p>
                      <p className="text-amber-700">
                        Paste your Supabase URL & Anon Key below to unlock free unlimited cloud storage and multi-user live sync.
                      </p>
                    </div>
                  </>
                )}
              </div>

              {/* Supabase URL */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  1. Supabase Project URL
                </label>
                <input
                  type="text"
                  placeholder="https://your-project-id.supabase.co"
                  value={supabaseUrl}
                  onChange={(e) => setSupabaseUrl(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 font-mono text-slate-800"
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  Found in: Supabase Dashboard $\rightarrow$ Project Settings $\rightarrow$ API $\rightarrow$ Project URL
                </span>
              </div>

              {/* Supabase Anon Key */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  2. Supabase Anon Public API Key
                </label>
                <input
                  type="password"
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                  value={supabaseAnonKey}
                  onChange={(e) => setSupabaseAnonKey(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 font-mono text-slate-800"
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  Found in: Supabase Dashboard $\rightarrow$ Project Settings $\rightarrow$ API $\rightarrow$ Project API keys (anon public)
                </span>
              </div>

              {/* SQL Setup Helper Button */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                    SQL Database Tables Setup
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Creates the 20-column tickets table, user roles, and enables real-time replication.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={copySqlToClipboard}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition shadow-sm"
                >
                  {copiedSql ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-white" />
                      Copied SQL!
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      Copy SQL Script
                    </>
                  )}
                </button>
              </div>

              {error && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs">
                  {error}
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleResetSupabase}
                  className="text-xs text-rose-600 hover:text-rose-700 font-medium flex items-center gap-1"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Disconnect Supabase
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveSupabase}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition shadow-sm"
                  >
                    <Check className="w-4 h-4" />
                    Save & Connect Supabase
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* TAB 2: FIREBASE */}
          {/* ============================================================ */}
          {activeTab === 'firebase' && (
            <div className="space-y-4">
              <div
                className={`p-3.5 rounded-xl border flex items-center space-x-3 text-xs ${
                  isFirebaseConfigValid
                    ? 'bg-amber-50 border-amber-200 text-amber-800'
                    : 'bg-slate-50 border-slate-200 text-slate-600'
                }`}
              >
                <Flame className="w-5 h-5 text-amber-500 flex-shrink-0" />
                <div>
                  <p className="font-semibold">
                    {isFirebaseConfigValid ? 'Firebase Configured' : 'Firebase Inactive'}
                  </p>
                  <p className="text-amber-700 text-[11px]">
                    Note: Firebase Spark Free Tier has a strict 50,000 document reads/day limit.
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Firebase Web App Configuration (JSON)
                </label>
                <textarea
                  rows={8}
                  value={firebaseText}
                  onChange={(e) => setFirebaseText(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 font-mono text-slate-800 bg-slate-50"
                  placeholder="Paste Firebase JSON config here..."
                />
              </div>

              {error && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs">
                  {error}
                </div>
              )}

              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleResetFirebase}
                  className="text-xs text-rose-600 hover:text-rose-700 font-medium flex items-center gap-1"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Reset Firebase
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveFirebase}
                    className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition shadow-sm"
                  >
                    <Check className="w-4 h-4" />
                    Save Firebase Config
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
