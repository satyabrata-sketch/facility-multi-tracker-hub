import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

// -------------------------------------------------------------
// FIREBASE CONFIGURATION
// Replace the placeholder values below with your Firebase Project config
// from the Firebase Console -> Project Settings -> General -> Your apps
// Or you can configure them directly through the in-app Settings modal!
// -------------------------------------------------------------
const DEFAULT_FIREBASE_CONFIG = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyBn3POpUiu-E8qmQmRnsClrtej30DPQsLc",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "cbre-helpdesk-tracker.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "cbre-helpdesk-tracker",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "cbre-helpdesk-tracker.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "104551508802",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:104551508802:web:5ce717a5cba67c0839b6db",
};

// Check if valid user config exists in localStorage or environment
export function getSavedFirebaseConfig() {
  try {
    const saved = localStorage.getItem('cbre_firebase_config');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.projectId && parsed.projectId !== 'your-project-id') {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('Could not read saved firebase config', e);
  }
  return DEFAULT_FIREBASE_CONFIG;
}

export function saveFirebaseConfig(config) {
  localStorage.setItem('cbre_firebase_config', JSON.stringify(config));
  window.location.reload();
}

export function resetFirebaseConfig() {
  localStorage.removeItem('cbre_firebase_config');
  window.location.reload();
}

const currentConfig = getSavedFirebaseConfig();

// Verify if config is customized with real credentials
export const isConfigValid =
  currentConfig.projectId &&
  currentConfig.projectId !== 'your-project-id' &&
  currentConfig.apiKey &&
  currentConfig.apiKey !== 'YOUR_API_KEY_HERE';

let app = null;
let db = null;
let auth = null;

if (isConfigValid) {
  try {
    app = !getApps().length ? initializeApp(currentConfig) : getApp();
    if (typeof window !== 'undefined' && typeof indexedDB !== 'undefined') {
      try {
        db = initializeFirestore(app, {
          localCache: persistentLocalCache({
            tabManager: persistentMultipleTabManager(),
          }),
        });
      } catch (cacheErr) {
        db = getFirestore(app);
      }
    } else {
      db = getFirestore(app);
    }
    auth = getAuth(app);
    console.log('Firebase initialized successfully with project:', currentConfig.projectId);
  } catch (err) {
    console.error('Failed to initialize Firebase:', err);
  }
} else {
  console.info('Firebase running in DEMO / LOCAL mode. Real-time changes persist locally. Connect Firebase anytime via top-bar settings.');
}

export { app, db, auth, currentConfig };
