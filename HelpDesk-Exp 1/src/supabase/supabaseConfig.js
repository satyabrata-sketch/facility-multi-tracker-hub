import { createClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------
// SUPABASE CONFIGURATION
// Provides unlimited reads, writes, and full PostgreSQL relational support
// Configure via .env (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)
// or via the in-app Database Settings Modal!
// ---------------------------------------------------------------------

export function sanitizeSupabaseUrl(url) {
  if (!url) return '';
  let clean = url.trim();
  clean = clean.replace(/\/rest\/v1\/?$/, '');
  clean = clean.replace(/\/+$/, '');
  return clean;
}

const LOCAL_STORAGE_KEY = 'cbre_supabase_config';

export function getSavedSupabaseConfig() {
  try {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.supabaseUrl && parsed.supabaseAnonKey) {
        return {
          supabaseUrl: sanitizeSupabaseUrl(parsed.supabaseUrl),
          supabaseAnonKey: parsed.supabaseAnonKey.trim(),
        };
      }
    }
  } catch (e) {
    console.warn('Could not read saved Supabase config:', e);
  }

  return {
    supabaseUrl: sanitizeSupabaseUrl(import.meta.env.VITE_SUPABASE_URL || ''),
    supabaseAnonKey: (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim(),
  };
}

export function saveSupabaseConfig(config) {
  const sanitized = {
    supabaseUrl: sanitizeSupabaseUrl(config.supabaseUrl),
    supabaseAnonKey: (config.supabaseAnonKey || '').trim(),
  };
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(sanitized));
  window.location.reload();
}

export function resetSupabaseConfig() {
  localStorage.removeItem(LOCAL_STORAGE_KEY);
  window.location.reload();
}

const currentConfig = getSavedSupabaseConfig();

export const isSupabaseConfigValid =
  Boolean(currentConfig.supabaseUrl) &&
  currentConfig.supabaseUrl.startsWith('https://') &&
  currentConfig.supabaseUrl.includes('.supabase.co') &&
  Boolean(currentConfig.supabaseAnonKey) &&
  currentConfig.supabaseAnonKey.length > 20;

export const supabase = isSupabaseConfigValid
  ? createClient(currentConfig.supabaseUrl, currentConfig.supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    })
  : null;

if (isSupabaseConfigValid) {
  console.log('✅ Supabase PostgreSQL initialized successfully:', currentConfig.supabaseUrl);
} else {
  console.info('ℹ️ Supabase not yet configured. Running in Local / Demo mode.');
}
