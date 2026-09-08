import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import { db, isConfigValid } from '../firebase/firebaseConfig';
import { supabase, isSupabaseConfigValid } from '../supabase/supabaseConfig';
import { sampleTickets } from '../data/sampleTickets';
import {
  isInvalidPivotOrSummaryRow,
  sanitizeSiteValue,
  VALID_REQUEST_CATEGORIES,
  deduplicateTickets,
  getTicketUniqueKey,
  detectTicketYear,
} from '../utils/schema';

const COLLECTION_NAME = 'tickets';
const LOCAL_STORAGE_KEY = 'cbre_helpdesk_tickets_cache';

// Local store fallback for Demo Mode with auto-healing and strict pivot row purging
function getInitialLocalTickets() {
  try {
    const cached = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const validTickets = parsed.filter((t) => !isInvalidPivotOrSummaryRow(t));
        const mapped = validTickets.map((t, idx) => {
          let s = String(t['Site '] || t['Site'] || '').trim();
          let c = String(t['Request category'] || '').trim();
          if (VALID_REQUEST_CATEGORIES.includes(s)) {
            if (!c) t['Request category'] = s;
            t['Site '] = 'DT3';
          } else {
            t['Site '] = sanitizeSiteValue(s);
          }
          if (!c || c === 'Housekeeping') {
            const d = (t['Discription '] || '').toLowerCase();
            if (d.includes('food') || d.includes('catering') || d.includes('breakfast') || d.includes('lunch')) {
              t['Request category'] = 'F&B';
            }
          }
          if (!t.id) {
            t.id = t['Sr no.'] ? `sr-${t['Sr no.']}` : `t-${idx + 1}`;
          }
          return t;
        });
        return deduplicateTickets(mapped);
      }
    }
  } catch (e) {
    console.warn('Error reading cached tickets:', e);
  }
  return [...sampleTickets];
}

// IndexedDB High-Performance Cache for 10k+ Tickets
const IDB_NAME = 'CBRE_Helpdesk_DB';
const IDB_STORE = 'tickets_store';

function openTicketsIDB() {
  return new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') return resolve(null);
    try {
      const req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = () => {
        try {
          req.result.createObjectStore(IDB_STORE);
        } catch (e) {}
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch (e) {
      resolve(null);
    }
  });
}

export async function getCachedTicketsIDB() {
  const idb = await openTicketsIDB();
  if (!idb) return null;
  return new Promise((resolve) => {
    try {
      const tx = idb.transaction(IDB_STORE, 'readonly');
      const req = tx.objectStore(IDB_STORE).get('cached_tickets');
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    } catch (e) {
      resolve(null);
    }
  });
}

export async function setCachedTicketsIDB(tickets) {
  const idb = await openTicketsIDB();
  if (!db) return;
  try {
    const tx = idb.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put(tickets, 'cached_tickets');
  } catch (e) {
    console.warn('Could not cache tickets in IDB', e);
  }
}

let localTickets = getInitialLocalTickets();
let localListeners = [];

// Hydrate localTickets from IndexedDB on startup
if (typeof window !== 'undefined') {
  getCachedTicketsIDB().then((cached) => {
    if (Array.isArray(cached) && cached.length > 0) {
      localTickets = cached;
      notifyLocalListeners();
    }
  });
}

function notifyLocalListeners() {
  setCachedTicketsIDB(localTickets);
  localListeners.forEach((listener) => listener([...localTickets]));
  setTimeout(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(localTickets.slice(0, 300)));
    } catch (e) {}
  }, 50);
}

// Listen to other browser tabs in demo mode
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === LOCAL_STORAGE_KEY && e.newValue) {
      try {
        localTickets = JSON.parse(e.newValue);
        localListeners.forEach((l) => l([...localTickets]));
      } catch (err) {
        console.error(err);
      }
    }
  });
}

/**
 * Real-time subscription to tickets collection with zero-latency cache-first delivery
 */
export function subscribeTickets(onSuccess, onError) {
  // 1. Immediately emit in-memory or sample tickets so UI NEVER displays 0 while loading!
  if (localTickets && localTickets.length > 0) {
    onSuccess([...localTickets]);
  } else {
    onSuccess([...sampleTickets]);
  }

  // 2. Check IndexedDB cache asynchronously
  getCachedTicketsIDB().then((cached) => {
    if (Array.isArray(cached) && cached.length > 0) {
      localTickets = cached;
      onSuccess([...localTickets]);
    }
  });

  if (isSupabaseConfigValid && supabase) {
    (async () => {
      try {
        const { data, error } = await supabase.from('tickets').select('*');
        if (error) {
          console.error('Supabase query error:', error);
          if (onError) onError(error);
        } else if (data && data.length > 0) {
          const sanitized = data
            .filter((t) => !isInvalidPivotOrSummaryRow(t))
            .map((t) => {
              let s = String(t['Site '] || t['Site'] || '').trim();
              let c = String(t['Request category'] || '').trim();
              if (VALID_REQUEST_CATEGORIES.includes(s)) {
                if (!c) t['Request category'] = s;
                t['Site '] = 'DT3';
              } else {
                t['Site '] = sanitizeSiteValue(s);
              }
              return t;
            });
          localTickets = sanitized;
          setCachedTicketsIDB(sanitized);
          onSuccess(sanitized);
        } else {
          const seedBatch = sampleTickets.slice(0, 150);
          supabase
            .from('tickets')
            .upsert(seedBatch, { onConflict: 'id' })
            .then(() => onSuccess([...sampleTickets]))
            .catch(() => onSuccess([...sampleTickets]));
        }
      } catch (err) {
        console.error('Supabase fetch failed:', err);
      }
    })();

    const channel = supabase
      .channel('tickets-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tickets' },
        async () => {
          const { data } = await supabase.from('tickets').select('*');
          if (data && data.length > 0) {
            localTickets = data;
            setCachedTicketsIDB(data);
            onSuccess(data);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }

  if (isConfigValid && db) {
    try {
      const q = collection(db, COLLECTION_NAME);
      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          if (!snapshot.empty) {
            const tickets = snapshot.docs
              .map((d) => {
                const data = d.data();
                return {
                  id: d.id,
                  ...data,
                  createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt,
                  updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : data.updatedAt,
                };
              })
              .filter((t) => !isInvalidPivotOrSummaryRow(t))
              .map((t) => {
                let s = String(t['Site '] || t['Site'] || '').trim();
                let c = String(t['Request category'] || '').trim();
                if (VALID_REQUEST_CATEGORIES.includes(s)) {
                  if (!c) t['Request category'] = s;
                  t['Site '] = 'DT3';
                } else {
                  t['Site '] = sanitizeSiteValue(s);
                }
                return t;
              });

            if (tickets.length > 0) {
              localTickets = tickets;
              setCachedTicketsIDB(tickets);
              onSuccess(tickets);
            }
          }
        },
        (error) => {
          console.error('Firestore subscription error:', error);
          if (onError) onError(error);
          onSuccess([...localTickets]);
        }
      );
      return unsubscribe;
    } catch (err) {
      console.error('Failed to create Firestore query:', err);
      onSuccess([...localTickets]);
      return () => {};
    }
  }

  // Demo mode: local listener
  localListeners.push(onSuccess);
  return () => {
    localListeners = localListeners.filter((l) => l !== onSuccess);
  };
}

/**
 * Add a new ticket
 */
export async function addTicket(ticketData, userEmail = 'anonymous@cbre.com') {
  const now = new Date().toISOString();
  const newTicket = {
    ...ticketData,
    createdAt: now,
    updatedAt: now,
    lastUpdatedBy: userEmail,
  };

  if (isSupabaseConfigValid && supabase) {
    const mockId = newTicket.id || 't-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6);
    const created = { id: mockId, ...newTicket };
    localTickets.unshift(created);
    setCachedTicketsIDB(localTickets);
    notifyLocalListeners();
    supabase.from('tickets').insert([created]).catch((e) => console.warn('Supabase insert notice:', e));
    return created;
  }

  if (isConfigValid && db) {
    const docRef = await addDoc(collection(db, COLLECTION_NAME), {
      ...newTicket,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    const created = { id: docRef.id, ...newTicket };
    localTickets.unshift(created);
    setCachedTicketsIDB(localTickets);
    notifyLocalListeners();
    return created;
  }

  // Demo mode
  const mockId = 'ticket-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);
  const created = { id: mockId, ...newTicket };
  localTickets.unshift(created);
  setCachedTicketsIDB(localTickets);
  notifyLocalListeners();
  return created;
}

/**
 * Update an existing ticket (e.g. inline cell edit or modal edit)
 */
export async function updateTicket(id, ticketData, userEmail = 'colleague@cbre.com') {
  const now = new Date().toISOString();
  const updatePayload = {
    ...ticketData,
    updatedAt: now,
    lastUpdatedBy: userEmail,
  };

  const idStr = String(id || '');
  const index = localTickets.findIndex(
    (t) => (t.id && String(t.id) === idStr) || (t['Sr no.'] && String(t['Sr no.']) === idStr)
  );
  if (index !== -1) {
    localTickets[index] = {
      ...localTickets[index],
      ...updatePayload,
    };
    setCachedTicketsIDB(localTickets);
    notifyLocalListeners();
  }

  if (isSupabaseConfigValid && supabase && id) {
    supabase
      .from('tickets')
      .update(updatePayload)
      .eq('id', String(id))
      .catch((e) => console.warn('Supabase update notice:', e));
  }

  if (isConfigValid && db && id) {
    try {
      const ticketRef = doc(db, COLLECTION_NAME, String(id));
      await setDoc(
        ticketRef,
        {
          ...updatePayload,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    } catch (e) {
      console.warn('Firestore setDoc notice:', e);
    }
  }

  return { id, ...updatePayload };
}

/**
 * Delete a ticket
 */
export async function deleteTicket(id, srNo) {
  const idStr = String(id || '');
  const srStr = String(srNo || '');
  localTickets = localTickets.filter((t) => {
    if (idStr && t.id && String(t.id) === idStr) return false;
    if (srStr && t['Sr no.'] && String(t['Sr no.']) === srStr) return false;
    if (idStr && t['Sr no.'] && String(t['Sr no.']) === idStr) return false;
    if (srStr && t.id && String(t.id) === srStr) return false;
    return true;
  });
  setCachedTicketsIDB(localTickets);
  notifyLocalListeners();

  if (isSupabaseConfigValid && supabase) {
    const targetId = id || srNo;
    if (targetId) {
      supabase
        .from('tickets')
        .delete()
        .or(`id.eq.${targetId},Sr no..eq.${targetId}`)
        .catch((e) => console.warn('Supabase delete notice:', e));
    }
  }

  if (isConfigValid && db && id) {
    try {
      const ticketRef = doc(db, COLLECTION_NAME, String(id));
      await deleteDoc(ticketRef);
    } catch (e) {
      console.warn('Firestore deleteDoc notice:', e);
    }
  }

  return true;
}

/**
 * Bulk delete multiple tickets
 */
export async function bulkDeleteTickets(ids) {
  const idSet = new Set(ids.map((i) => String(i)));
  localTickets = localTickets.filter(
    (t) => !idSet.has(String(t.id)) && !idSet.has(String(t['Sr no.']))
  );
  setCachedTicketsIDB(localTickets);
  notifyLocalListeners();

  if (isSupabaseConfigValid && supabase) {
    supabase
      .from('tickets')
      .delete()
      .in('id', ids.map(String))
      .catch((e) => console.warn('Supabase bulk delete notice:', e));
  }

  if (isConfigValid && db) {
    try {
      const batches = [];
      const chunkSize = 400; // Firestore limit is 500
      for (let i = 0; i < ids.length; i += chunkSize) {
        const chunk = ids.slice(i, i + chunkSize);
        const batch = writeBatch(db);
        chunk.forEach((id) => {
          const ticketRef = doc(db, COLLECTION_NAME, String(id));
          batch.delete(ticketRef);
        });
        batches.push(batch.commit());
      }
      await Promise.all(batches);
    } catch (e) {
      console.warn('Firestore bulk delete notice:', e);
    }
  }

  return true;
}

/**
 * Bulk update status of multiple tickets
 */
export async function bulkUpdateStatus(ids, newStatus, userEmail = 'admin@cbre.com') {
  const now = new Date().toISOString();

  if (isSupabaseConfigValid && supabase) {
    const idSet = new Set(ids);
    localTickets = localTickets.map((t) => {
      if (idSet.has(t.id)) {
        return {
          ...t,
          'Status ': newStatus,
          updatedAt: now,
          lastUpdatedBy: userEmail,
        };
      }
      return t;
    });
    setCachedTicketsIDB(localTickets);
    notifyLocalListeners();

    supabase
      .from('tickets')
      .update({ 'Status ': newStatus, updatedAt: now, lastUpdatedBy: userEmail })
      .in('id', ids.map(String))
      .catch((e) => console.warn('Supabase bulk status notice:', e));
    return true;
  }

  if (isConfigValid && db) {
    const batches = [];
    const chunkSize = 400;
    for (let i = 0; i < ids.length; i += chunkSize) {
      const chunk = ids.slice(i, i + chunkSize);
      const batch = writeBatch(db);
      chunk.forEach((id) => {
        const ticketRef = doc(db, COLLECTION_NAME, id);
        batch.update(ticketRef, {
          'Status ': newStatus,
          updatedAt: serverTimestamp(),
          lastUpdatedBy: userEmail,
        });
      });
      batches.push(batch.commit());
    }
    await Promise.all(batches);
    return true;
  }

  // Demo mode
  const idSet = new Set(ids);
  localTickets = localTickets.map((t) => {
    if (idSet.has(t.id)) {
      return {
        ...t,
        'Status ': newStatus,
        updatedAt: now,
        lastUpdatedBy: userEmail,
      };
    }
    return t;
  });
  notifyLocalListeners();
  return true;
}

/**
 * Batch import tickets (e.g. from Excel file)
 * Supports chunks of 450 to stay safely below Firestore 500 limit
 */
export async function batchImportTickets(ticketsArray, userEmail = 'importer@cbre.com', onProgress) {
  const total = ticketsArray.length;
  const now = new Date().toISOString();

  // 1. Build an index of existing tickets by their unique signature
  const existingMap = new Map();
  localTickets.forEach((t) => {
    const k = getTicketUniqueKey(t);
    if (k) existingMap.set(k, t);
  });

  // 2. Format & deduplicate incoming tickets: merge with existing if already present
  const mergedIncoming = [];
  ticketsArray.forEach((t, idx) => {
    const k = getTicketUniqueKey(t);
    const yr = detectTicketYear(t);
    const sr = t['Sr no.'] || String(idx + 1);

    if (k && existingMap.has(k)) {
      // Existing ticket updated! Retain original ID and merge latest fields
      const existing = existingMap.get(k);
      const updated = {
        ...existing,
        ...t,
        id: existing.id,
        year: yr,
        updatedAt: now,
        lastUpdatedBy: userEmail,
      };
      existingMap.set(k, updated);
      mergedIncoming.push(updated);
    } else {
      // Brand new ticket: assign stable deterministic ID
      const stableId = t.id || `sr-${yr}-${sr}`;
      const created = {
        ...t,
        id: stableId,
        year: yr,
        createdAt: t.createdAt || now,
        updatedAt: now,
        lastUpdatedBy: userEmail,
      };
      if (k) existingMap.set(k, created);
      mergedIncoming.push(created);
    }
  });

  // 3. Set local tickets as all strictly unique records
  localTickets = deduplicateTickets(Array.from(existingMap.values()));
  setCachedTicketsIDB(localTickets);
  notifyLocalListeners();

  // 4. Save to Supabase with upsert on stable ID (no duplicate rows)
  if (isSupabaseConfigValid && supabase) {
    const chunkSize = 200;
    let processed = 0;
    for (let i = 0; i < mergedIncoming.length; i += chunkSize) {
      const chunk = mergedIncoming.slice(i, i + chunkSize);
      try {
        await supabase.from('tickets').upsert(chunk, { onConflict: 'id' });
      } catch (e) {
        console.warn('Supabase batch import notice:', e);
      }
      processed += chunk.length;
      if (onProgress) onProgress(processed, total);
    }
    return processed;
  }

  // 5. Save to Firestore (upsert with stable document IDs so re-importing NEVER creates duplicates!)
  if (isConfigValid && db) {
    const chunkSize = 400;
    let processed = 0;

    for (let i = 0; i < mergedIncoming.length; i += chunkSize) {
      const chunk = mergedIncoming.slice(i, i + chunkSize);
      const batch = writeBatch(db);
      chunk.forEach((ticket) => {
        const docRef = doc(db, COLLECTION_NAME, ticket.id);
        batch.set(
          docRef,
          {
            ...ticket,
            updatedAt: serverTimestamp(),
            lastUpdatedBy: userEmail,
          },
          { merge: true }
        );
      });
      await batch.commit();
      processed += chunk.length;
      if (onProgress) {
        onProgress(processed, total);
      }
    }
    return processed;
  }

  if (onProgress) onProgress(total, total);
  return total;
}

/**
 * Clean & Purge any duplicates across tickets
 */
export function purgeAllDuplicates() {
  const originalCount = localTickets.length;
  localTickets = deduplicateTickets(localTickets);
  const removed = originalCount - localTickets.length;
  setCachedTicketsIDB(localTickets);
  notifyLocalListeners();
  return removed;
}
