import {
  collection,
  doc,
  getDocs,
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

// Local store fallback
function getInitialLocalTickets() {
  try {
    const cached = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('Error reading cached tickets:', e);
  }
  return [];
}

// IndexedDB High-Performance Cache for 10k+ Tickets
const IDB_NAME = 'CBRE_Helpdesk_DB_v6';
const IDB_STORE = 'tickets_store';

function openTicketsIDB() {
  return new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') return resolve(null);
    try {
      // Proactively purge obsolete previous databases
      ['CBRE_Helpdesk_DB_v1', 'CBRE_Helpdesk_DB_v2', 'CBRE_Helpdesk_DB_v3', 'CBRE_Helpdesk_DB_v4', 'CBRE_Helpdesk_DB_v5'].forEach((old) => {
        try { indexedDB.deleteDatabase(old); } catch (e) {}
      });

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
        if (Array.isArray(res)) {
          resolve(res);
          return;
        }
        resolve(null);
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

  // 1. Immediately emit in-memory tickets
  onSuccess([...(localTickets || [])]);

  // 2. Check IndexedDB cache asynchronously
  getCachedTicketsIDB().then((cached) => {
    if (Array.isArray(cached) && cached.length > 0) {
      localTickets = cached;
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
          localTickets = [];
          setCachedTicketsIDB([]);
          onSuccess([]);
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

          localTickets = tickets;
          setCachedTicketsIDB(tickets);
          notifyLocalListeners();
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

  // Format incoming tickets - preserve EVERY row from Excel with stable unique doc ID
  const formattedIncoming = ticketsArray
    .filter((t) => !isInvalidPivotOrSummaryRow(t))
    .map((rawT, idx) => {
      const t = normalizeTicketFields(rawT);
      const yr = String(t.year || detectTicketYear(t));
      const sr = String(t['Sr no.'] || idx + 1);
      const site = sanitizeSiteValue(t['Site '] || t['Site'] || 'DT3');
      const stableId = t.id || `sr-${yr}-${site.replace(/[^A-Za-z0-9]/g, '')}-${sr}-${idx + 1}`;
      return {
        ...t,
        id: stableId,
        year: yr,
        createdAt: t.createdAt || now,
        updatedAt: now,
        lastUpdatedBy: userEmail,
      };
    });

  if (replaceAll) {
    // 1a. Wipe existing Supabase tickets if connected
    if (isSupabaseConfigValid && supabase) {
      try {
        await supabase.from('tickets').delete().neq('id', '___non_existent___');
      } catch (e) {
        console.warn('Supabase purge error during replaceAll:', e);
      }
    }

    // 1b. Wipe existing Firestore tickets if configured
    if (isConfigValid && db) {
      try {
        const snap = await getDocs(collection(db, COLLECTION_NAME));
        const BATCH_SIZE = 400;
        const docs = snap.docs;
        for (let i = 0; i < docs.length; i += BATCH_SIZE) {
          const chunk = docs.slice(i, i + BATCH_SIZE);
          const batch = writeBatch(db);
          chunk.forEach((d) => batch.delete(d.ref));
          await batch.commit();
        }
      } catch (e) {
        console.warn('Firestore purge error during replaceAll:', e);
      }
    }

    localTickets = formattedIncoming;
    setCachedTicketsIDB(localTickets);
    notifyLocalListeners();

    // 2a. Upload all fresh tickets to Supabase in batches of 200
    if (isSupabaseConfigValid && supabase) {
      const chunkSize = 200;
      let processed = 0;
      for (let i = 0; i < formattedIncoming.length; i += chunkSize) {
        const chunk = formattedIncoming.slice(i, i + chunkSize);
        const cleanChunk = chunk.map(sanitizeTicketForSupabase);
        try {
          const { error } = await supabase.from('tickets').upsert(cleanChunk, { onConflict: 'id' });
          if (error) {
            console.warn('Supabase batch upsert error:', error.message);
          }
        } catch (e) {
          console.warn('Supabase batch import notice:', e);
        }
        processed += chunk.length;
        if (onProgress) onProgress(processed, formattedIncoming.length);
      }
    }

    // 2b. Upload all fresh tickets to Firestore in batches of 400
    if (isConfigValid && db) {
      const chunkSize = 400;
      let processed = 0;
      for (let i = 0; i < formattedIncoming.length; i += chunkSize) {
        const chunk = formattedIncoming.slice(i, i + chunkSize);
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
        if (onProgress && (!isSupabaseConfigValid || !supabase)) {
          onProgress(processed, formattedIncoming.length);
        }
      }
    }

    if (onProgress) onProgress(formattedIncoming.length, formattedIncoming.length);
    return formattedIncoming.length;
  }

  // Merge Mode: preserve existing and add new
  const existingMap = new Map();
  localTickets.forEach((t) => {
    if (t.id) existingMap.set(t.id, t);
  });

  const toSave = [];
  formattedIncoming.forEach((t) => {
    existingMap.set(t.id, t);
    toSave.push(t);
  });

  localTickets = Array.from(existingMap.values());
  setCachedTicketsIDB(localTickets);
  notifyLocalListeners();

  // Save merged to Supabase
  if (isSupabaseConfigValid && supabase) {
    const chunkSize = 200;
    let processed = 0;
    for (let i = 0; i < toSave.length; i += chunkSize) {
      const chunk = toSave.slice(i, i + chunkSize);
      const cleanChunk = chunk.map(sanitizeTicketForSupabase);
      try {
        const { error } = await supabase.from('tickets').upsert(cleanChunk, { onConflict: 'id' });
        if (error) {
          console.warn('Supabase merge upsert error:', error.message);
        }
      } catch (e) {
        console.warn('Supabase merge notice:', e);
      }
      processed += chunk.length;
      if (onProgress) onProgress(processed, toSave.length);
    }
  }

  // Save merged to Firestore
  if (isConfigValid && db) {
    const chunkSize = 400;
    let processed = 0;
    for (let i = 0; i < toSave.length; i += chunkSize) {
      const chunk = toSave.slice(i, i + chunkSize);
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
      if (onProgress && (!isSupabaseConfigValid || !supabase)) {
        onProgress(processed, toSave.length);
      }
    }
  }

  if (onProgress) onProgress(total, total);
  return total;
}

/**
 * Completely clear all tickets from local state, IndexedDB, localStorage, and Firestore backend
 */
export async function clearAllTickets() {
  localTickets = [];
  setCachedTicketsIDB([]);
  try {
    localStorage.removeItem(LOCAL_STORAGE_KEY);
  } catch (e) {}
  notifyLocalListeners();

  if (isConfigValid && db) {
    try {
      const snap = await getDocs(collection(db, COLLECTION_NAME));
      const BATCH_SIZE = 400;
      const docs = snap.docs;
      for (let i = 0; i < docs.length; i += BATCH_SIZE) {
        const chunk = docs.slice(i, i + BATCH_SIZE);
        const batch = writeBatch(db);
        chunk.forEach((d) => batch.delete(d.ref));
        await batch.commit();
      }
    } catch (e) {
      console.warn('Firestore clear notice:', e);
    }
  }

  if (isSupabaseConfigValid && supabase) {
    try {
      await supabase.from('tickets').delete().neq('id', '___non_existent___');
    } catch (e) {
      console.warn('Supabase clear notice:', e);
    }
  }
}

/**
 * Safe deduplication / optimization - does NOT destroy valid records
 */
export function purgeAllDuplicates() {
  return 0;
}
