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
} from 'lucide-react';
import {
  currentConfig,
  saveFirebaseConfig,
  resetFirebaseConfig,
  isConfigValid,
} from '../firebase/firebaseConfig';

export default function FirebaseConfigModal({ isOpen, onClose }) {
  const [configText, setConfigText] = useState(
    JSON.stringify(currentConfig, null, 2)
  );
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  const handleSave = () => {
    try {
      const parsed = JSON.parse(configText);
      if (!parsed.projectId || !parsed.apiKey) {
        throw new Error('Config must contain at least projectId and apiKey');
      }
      saveFirebaseConfig(parsed);
    } catch (err) {
      setError('Invalid JSON format: ' + err.message);
    }
  };

  const handleReset = () => {
    if (confirm('Reset Firebase configuration to default demo values?')) {
      resetFirebaseConfig();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-lg bg-indigo-600/30 text-indigo-400">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold">Firebase Connection & Settings</h2>
              <p className="text-xs text-slate-400">
                Configure Google Firebase Firestore & Authentication
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

        <div className="p-6 space-y-5">
          {/* Status banner */}
          <div
            className={`p-3.5 rounded-xl border flex items-center space-x-3 text-xs ${
              isConfigValid
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-amber-50 border-amber-200 text-amber-800'
            }`}
          >
            {isConfigValid ? (
              <>
                <ShieldCheck className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                <div>
                  <p className="font-semibold">Connected to Firebase Project</p>
                  <p className="text-emerald-700">
                    Live syncing enabled for collection{' '}
                    <code className="bg-emerald-100 px-1 py-0.5 rounded font-mono">tickets</code>
                  </p>
                </div>
              </>
            ) : (
              <>
                <HelpCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
                <div>
                  <p className="font-semibold">Running in Offline / Demo Mode</p>
                  <p className="text-amber-700">
                    All CRUD and Excel operations are fully functional using browser storage.
                    Paste your Firebase configuration below to activate live multi-user sync.
                  </p>
                </div>
              </>
            )}
          </div>

          {/* Quick instructions */}
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs text-slate-600 space-y-1.5">
            <div className="flex items-center justify-between font-semibold text-slate-800">
              <span>How to connect your Firebase Project:</span>
              <a
                href="https://console.firebase.google.com/"
                target="_blank"
                rel="noreferrer"
                className="text-indigo-600 hover:underline flex items-center gap-1 font-normal text-[11px]"
              >
                Firebase Console <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <ol className="list-decimal list-inside space-y-1 text-slate-600 pl-1">
              <li>Create a project in Firebase Console</li>
              <li>Under Project Settings &gt; General &gt; Your apps, register a Web App</li>
              <li>Enable <strong>Cloud Firestore</strong> and <strong>Authentication</strong> (Email/Password)</li>
              <li>Paste the <code className="bg-slate-200 px-1 rounded font-mono text-[11px]">firebaseConfig</code> JSON object below and click "Save & Reconnect"</li>
            </ol>
          </div>

          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700">
              {error}
            </div>
          )}

          {/* JSON Textarea */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Firebase Configuration (JSON format):
            </label>
            <textarea
              rows={8}
              value={configText}
              onChange={(e) => {
                setConfigText(e.target.value);
                setError(null);
              }}
              className="w-full text-xs font-mono p-3 bg-slate-900 text-emerald-400 rounded-xl border border-slate-700 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              placeholder={`{\n  "apiKey": "AIzaSy...",\n  "authDomain": "...",\n  "projectId": "...",\n  "storageBucket": "...",\n  "messagingSenderId": "...",\n  "appId": "..."\n}`}
            />
          </div>

          {/* Buttons */}
          <div className="pt-2 flex items-center justify-between border-t border-slate-200">
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
            >
              <RotateCcw className="w-3.5 h-3.5 mr-1" />
              Reset to Demo Defaults
            </button>
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="inline-flex items-center px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg shadow-sm transition"
              >
                <Check className="w-4 h-4 mr-1.5" />
                Save & Reconnect
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
