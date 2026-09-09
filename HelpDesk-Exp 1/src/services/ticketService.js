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
  identifyDuplicateTicketIds,
  getTicketUniqueKey,
  detectTicketYear,
  normalizeTicketFields,
  autoHealTicketAction,
  getHealedActionValue,
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

        // Auto-heal: If cached localStorage data lacks Action Taken in 2025 OR 2026, purge cache & reload pristine dataset
        const sample2025 = validTickets.find((t) => t.year === '2025' || (t['Date '] && String(t['Date ']).startsWith('2025')));
        const sample2026 = validTickets.find((t) => (t.year === '2026' || !t.year) && t['Sr no.'] && parseInt(t['Sr no.'], 10) <= 50);
        const lacks2025 = sample2025 && !(sample2025['Action Taken '] || sample2025['Action taken ']);
        const lacks2026 = sample2026 && !(sample2026['Action Taken '] || sample2026['Action taken ']);
        if (lacks2025 || lacks2026) {
          try {
            localStorage.removeItem(LOCAL_STORAGE_KEY);
          } catch (e) {}
          return deduplicateTickets(sampleTickets.map(normalizeTicketFields));
        }

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
        return deduplicateTickets(mapped.map(normalizeTicketFields));
      }
    }
  } catch (e) {
    console.warn('Error reading cached tickets:', e);
  }
  return deduplicateTickets(sampleTickets.map(normalizeTicketFields));
}

// IndexedDB High-Performance Cache for 10k+ Tickets
const IDB_NAME = 'CBRE_Helpdesk_DB_v2';
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
      req.onsuccess = () => {
        const res = req.result;
        if (Array.isArray(res) && res.length > 0) {
          const sample2025 = res.find((t) => t.year === '2025' || (t['Date '] && String(t['Date ']).startsWith('2025')));
          const sample2026 = res.find((t) => (t.year === '2026' || !t.year) && t['Sr no.'] && parseInt(t['Sr no.'], 10) <= 50);
          const lacks2025 = sample2025 && !(sample2025['Action Taken '] || sample2025['Action taken ']);
          const lacks2026 = sample2026 && !(sample2026['Action Taken '] || sample2026['Action taken ']);
          const healed = deduplicateTickets(res.map(normalizeTicketFields));
          if (lacks2025 || lacks2026) {
            console.info('Auto-healing stale IndexedDB cache lacking Action Taken in 2025/2026...');
            setCachedTicketsIDB(healed);
          }
          resolve(healed);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    } catch (e) {
      resolve(null);
    }
  });
}


export async function setCachedTicketsIDB(tickets) {
  const idb = await openTicketsIDB();
  if (!idb) return;
  try {
    const tx = idb.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put(tickets, 'cached_tickets');
  } catch (e) {
    console.warn('Could not cache tickets in IDB', e);
  }
}

export function sanitizeTicketForSupabase(ticket) {
  const normalized = normalizeTicketFields(ticket);
  const yr = String(normalized.year || detectTicketYear(normalized));
  const sr = String(normalized['Sr no.'] || '');
  const id = normalized.id ? String(normalized.id) : `sr-${yr}-${sr}`;

  return {
    id,
    "Sr no.": sr,
    "Site ": String(normalized['Site '] || 'DT3'),
    "Zone": String(normalized['Zone'] || ''),
    "Location": String(normalized['Location'] || ''),
    "Month ": String(normalized['Month '] || ''),
    "Date ": String(normalized['Date '] || ''),
    "Report Time": String(normalized['Report Time'] || ''),
    "Request category": String(normalized['Request category'] || 'Housekeeping'),
    "Employee Name ": String(normalized['Employee Name '] || ''),
    "Request Via ": String(normalized['Request Via '] || 'In person'),
    "Discription ": String(normalized['Discription '] || ''),
    "Action Taken ": String(normalized['Action Taken '] || ''),
    "Date close ": String(normalized['Date close '] || ''),
    "Resolved time": String(normalized['Resolved time'] || ''),
    "Status ": String(normalized['Status '] || 'Resolved'),
    "Request from ": String(normalized['Request from '] || 'Employee'),
    "Call type": String(normalized['Call type'] || 'Reactive'),
    "Remark": String(normalized['Remark'] || ''),
    "is On TAT": String(normalized['is On TAT'] || 'Yes'),
    "Priority": String(normalized['Priority'] || 'Low'),
    "year": yr,
    "last_updated_by": String(normalized.lastUpdatedBy || normalized.last_updated_by || 'system'),
  };
}

export async function fetchAllSupabaseTickets() {
  if (!supabase) return [];
  const PAGE_SIZE = 1000;
  let allTickets = [];
  let from = 0;
  let hasMore = true;

  while (hasMore) {
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from('tickets')
      .select('*')
      .range(from, to);

    if (error) {
      console.error('Supabase fetch range error:', error);
      break;
    }

    if (data && data.length > 0) {
      allTickets = allTickets.concat(data);
      if (data.length < PAGE_SIZE) {
        hasMore = false;
      } else {
        from += PAGE_SIZE;
      }
    } else {
      hasMore = false;
    }
  }

  return allTickets;
}

let localTickets = getInitialLocalTickets();
let localListeners = [];

// Hydrate localTickets from IndexedDB on startup with automatic deduplication
if (typeof window !== 'undefined') {
  getCachedTicketsIDB().then((cached) => {
    if (Array.isArray(cached) && cached.length > 0) {
      localTickets = deduplicateTickets(cached);
      setCachedTicketsIDB(localTickets);
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
  // Always register in localListeners so local updates and batch imports trigger instant React UI update!
  localListeners.push(onSuccess);

  // 1. Immediately emit in-memory or sample tickets so UI NEVER displays 0 while loading!
  if (localTickets && localTickets.length > 0) {
    onSuccess([...localTickets]);
  } else {
    onSuccess([...sampleTickets]);
  }

  // 2. Check IndexedDB cache asynchronously
  getCachedTicketsIDB().then((cached) => {
    if (Array.isArray(cached) && cached.length > 0) {
      localTickets = deduplicateTickets(cached);
      onSuccess([...localTickets]);
    }
  });

  let channel = null;
  if (isSupabaseConfigValid && supabase) {
    (async () => {
      try {
        const data = await fetchAllSupabaseTickets();
        if (data && data.length > 0) {
          // Identify duplicate rows in Supabase and purge them in the background
          const dupIds = identifyDuplicateTicketIds(data);
          if (dupIds.length > 0 && isSupabaseConfigValid && supabase) {
            (async () => {
              for (let i = 0; i < dupIds.length; i += 200) {
                const chunk = dupIds.slice(i, i + 200);
                await supabase.from('tickets').delete().in('id', chunk);
              }
              console.info(`Successfully purged ${dupIds.length} duplicate rows from Supabase.`);
            })().catch(console.warn);
          }

          // Auto-heal: If any ticket in Supabase lacks Action Taken, backfill from sampleTickets
          const sampleMap = new Map();
          sampleTickets.forEach((st) => {
            const k = getTicketUniqueKey(st);
            if (k) sampleMap.set(k, st);
          });

          const healedTickets = [];
          const sanitized = data
            .filter((t) => !isInvalidPivotOrSummaryRow(t))
            .map((t) => {
              const norm = normalizeTicketFields(t);
              if (!norm['Action Taken '] || !norm['Action taken ']) {
                const k = getTicketUniqueKey(norm);
                const matched = sampleMap.get(k);
                if (matched && (matched['Action Taken '] || matched['Action taken '])) {
                  norm['Action Taken '] = matched['Action Taken '] || matched['Action taken '];
                  norm['Action taken '] = norm['Action Taken '];
                  healedTickets.push(norm);
                }
              }
              return norm;
            });

          // Background heal Supabase rows with missing Action Taken
          if (healedTickets.length > 0 && isSupabaseConfigValid && supabase) {
            (async () => {
              const cleanChunk = healedTickets.slice(0, 500).map(sanitizeTicketForSupabase);
              await supabase.from('tickets').upsert(cleanChunk, { onConflict: 'id' });
              console.info(`Auto-healed ${cleanChunk.length} tickets in Supabase with Action Taken.`);
            })().catch(console.warn);
          }

          localTickets = deduplicateTickets(sanitized);
          setCachedTicketsIDB(localTickets);
          notifyLocalListeners();
        } else {
          // If Supabase table is empty, seed with full dataset
          onSuccess([...sampleTickets]);
          batchImportTickets(sampleTickets, 'system-seed').catch(console.warn);
        }
      } catch (err) {
        console.error('Supabase fetch failed:', err);
      }
    })();

    channel = supabase
      .channel('tickets-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tickets' },
        async () => {
          const data = await fetchAllSupabaseTickets();
          if (data && data.length > 0) {
            localTickets = deduplicateTickets(data.map(normalizeTicketFields));
            setCachedTicketsIDB(localTickets);
            notifyLocalListeners();
          }
        }
      )
      .subscribe();
  }

  let firestoreUnsubscribe = null;
  if (isConfigValid && db) {
    try {
      const q = collection(db, COLLECTION_NAME);
      firestoreUnsubscribe = onSnapshot(
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
              notifyLocalListeners();
            }
          }
        },
        (error) => {
          console.error('Firestore subscription error:', error);
          if (onError) onError(error);
          notifyLocalListeners();
        }
      );
    } catch (err) {
      console.error('Failed to create Firestore query:', err);
    }
  }

  return () => {
    localListeners = localListeners.filter((l) => l !== onSuccess);
    if (channel && supabase) {
      supabase.removeChannel(channel);
    }
    if (firestoreUnsubscribe) {
      firestoreUnsubscribe();
    }
  };
}

/**
 * Get current in-memory tickets array
 */
export function getLocalTickets() {
  return [...localTickets];
}

/**
 * Explicitly refresh tickets from database / cache and notify all listeners
 */
export async function refreshTickets() {
  if (isSupabaseConfigValid && supabase) {
    try {
      const data = await fetchAllSupabaseTickets();
      if (data && data.length > 0) {
        const dupIds = identifyDuplicateTicketIds(data);
        if (dupIds.length > 0) {
          (async () => {
            for (let i = 0; i < dupIds.length; i += 200) {
              const chunk = dupIds.slice(i, i + 200);
              await supabase.from('tickets').delete().in('id', chunk);
            }
            console.info(`Refreshed & purged ${dupIds.length} duplicate rows from Supabase.`);
          })().catch(console.warn);
        }
        localTickets = deduplicateTickets(data);
        setCachedTicketsIDB(localTickets);
        notifyLocalListeners();
        return localTickets;
      }
    } catch (e) {
      console.warn('Supabase refresh notice:', e);
    }
  }
  const cached = await getCachedTicketsIDB();
  if (Array.isArray(cached) && cached.length > 0) {
    localTickets = deduplicateTickets(cached);
    notifyLocalListeners();
    return localTickets;
  }
  notifyLocalListeners();
  return localTickets;
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

  if (updatePayload['Action Taken '] !== undefined) {
    updatePayload['Action taken '] = updatePayload['Action Taken '];
  } else if (updatePayload['Action taken '] !== undefined) {
    updatePayload['Action Taken '] = updatePayload['Action taken '];
  }
  if (updatePayload['Discription '] !== undefined) {
    updatePayload['Description'] = updatePayload['Discription '];
  } else if (updatePayload['Description'] !== undefined) {
    updatePayload['Discription '] = updatePayload['Description'];
  }
  if (updatePayload['Date close '] !== undefined) {
    updatePayload['Date close'] = updatePayload['Date close '];
  } else if (updatePayload['Date close'] !== undefined) {
    updatePayload['Date close '] = updatePayload['Date close'];
  }
  if (updatePayload['Resolved time'] !== undefined) {
    updatePayload['Resolved time '] = updatePayload['Resolved time'];
  } else if (updatePayload['Resolved time '] !== undefined) {
    updatePayload['Resolved time'] = updatePayload['Resolved time '];
  }

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
    const supabaseUpdate = { ...updatePayload };
    delete supabaseUpdate['Action taken '];
    delete supabaseUpdate['Description'];
    delete supabaseUpdate['Resolved time '];
    supabase
      .from('tickets')
      .update(supabaseUpdate)
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
export async function batchImportTickets(ticketsArray, userEmail = 'importer@cbre.com', onProgress, options = {}) {
  const total = ticketsArray.length;
  const now = new Date().toISOString();
  const replaceAll = options?.replaceAll === true;

  if (replaceAll) {
    // FRESH IMPORT: Wipe existing database records and replace strictly with clean deduplicated incoming tickets
    const cleanDeduped = deduplicateTickets(ticketsArray.map(normalizeTicketFields));
    localTickets = cleanDeduped;
    setCachedTicketsIDB(localTickets);
    notifyLocalListeners();

    if (isSupabaseConfigValid && supabase) {
      try {
        await supabase.from('tickets').delete().neq('id', '___non_existent___');
        const chunkSize = 200;
        let processed = 0;
        for (let i = 0; i < cleanDeduped.length; i += chunkSize) {
          const chunk = cleanDeduped.slice(i, i + chunkSize);
          const cleanChunk = chunk.map(sanitizeTicketForSupabase);
          await supabase.from('tickets').upsert(cleanChunk, { onConflict: 'id' });
          processed += chunk.length;
          if (onProgress) onProgress(processed, total);
        }
      } catch (e) {
        console.warn('Supabase fresh import warning:', e);
      }
    }

    if (onProgress) onProgress(total, total);
    return cleanDeduped.length;
  }

  // 1. Build an index of existing tickets by unique signature and year + sr
  const existingMap = new Map();
  const existingIdSet = new Set();
  const existingSrMap = new Map();

  localTickets.forEach((rawT) => {
    const t = normalizeTicketFields(rawT);
    const k = getTicketUniqueKey(t);
    if (k) existingMap.set(k, t);
    if (t.id) existingIdSet.add(String(t.id));
    const yr = detectTicketYear(t);
    const sr = parseInt(t['Sr no.'], 10);
    const site = sanitizeSiteValue(t['Site '] || t['Site']);
    if (!isNaN(sr) && sr > 0) {
      existingSrMap.set(`${yr}_${sr}`, t);
      existingSrMap.set(`${yr}_${site}_${sr}`, t);
    }
  });

  // 2. Format & deduplicate incoming tickets: merge with existing if already present
  const mergedIncoming = [];
  ticketsArray.forEach((rawT, idx) => {
    const t = normalizeTicketFields(rawT);
    const k = getTicketUniqueKey(t);
    const yr = detectTicketYear(t);
    const sr = t['Sr no.'] || String(idx + 1);
    const srNum = parseInt(sr, 10);
    const site = sanitizeSiteValue(t['Site '] || t['Site']);
    const srKey = !isNaN(srNum) && srNum > 0 ? `${yr}_${srNum}` : null;
    const srSiteKey = !isNaN(srNum) && srNum > 0 ? `${yr}_${site}_${srNum}` : null;

    const existing =
      (k && existingMap.has(k) ? existingMap.get(k) : null) ||
      (srSiteKey && existingSrMap.has(srSiteKey) ? existingSrMap.get(srSiteKey) : null) ||
      (srKey && existingSrMap.has(srKey) ? existingSrMap.get(srKey) : null);

    if (existing) {
      // Existing ticket updated! Retain original ID and merge latest fields
      const updated = normalizeTicketFields({
        ...existing,
        ...t,
        id: existing.id,
        year: yr,
        updatedAt: now,
        lastUpdatedBy: userEmail,
      });
      existingMap.set(k || existing.id, updated);
      mergedIncoming.push(updated);
    } else {
      // Brand new ticket: assign guaranteed unique ID that does NOT collide with any existing ticket
      let stableId = `sr-${yr}-${sr}`;
      if (existingIdSet.has(stableId)) {
        stableId = `sr-${yr}-${sr}-${Date.now().toString(36)}-${idx + 1}`;
      }
      existingIdSet.add(stableId);

      const created = normalizeTicketFields({
        ...t,
        id: stableId,
        year: yr,
        createdAt: t.createdAt || now,
        updatedAt: now,
        lastUpdatedBy: userEmail,
      });
      if (k) existingMap.set(k, created);
      if (srKey) existingSrMap.set(srKey, created);
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
      const cleanChunk = chunk.map(sanitizeTicketForSupabase);
      try {
        const { error } = await supabase.from('tickets').upsert(cleanChunk, { onConflict: 'id' });
        if (error) {
          console.warn('Supabase batch upsert warning:', error.message);
        }
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
 * Completely clear all tickets from local state, IndexedDB, localStorage, and backend
 */
export async function clearAllTickets() {
  localTickets = [];
  setCachedTicketsIDB([]);
  try {
    localStorage.removeItem(LOCAL_STORAGE_KEY);
  } catch (e) {}
  notifyLocalListeners();

  if (isSupabaseConfigValid && supabase) {
    try {
      await supabase.from('tickets').delete().neq('id', '___non_existent___');
    } catch (e) {
      console.warn('Supabase clear notice:', e);
    }
  }
}

/**
 * Clean & Purge any duplicates across tickets
 */
export function purgeAllDuplicates() {
  const originalCount = localTickets.length;
  const dupIds = identifyDuplicateTicketIds(localTickets);
  localTickets = deduplicateTickets(localTickets);
  const removed = originalCount - localTickets.length;
  setCachedTicketsIDB(localTickets);
  notifyLocalListeners();

  if (dupIds.length > 0 && isSupabaseConfigValid && supabase) {
    (async () => {
      for (let i = 0; i < dupIds.length; i += 200) {
        const chunk = dupIds.slice(i, i + 200);
        await supabase.from('tickets').delete().in('id', chunk);
      }
      console.info(`Purged ${dupIds.length} duplicate rows from Supabase.`);
    })().catch(console.warn);
  }

  return removed;
}
