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
import { sampleTickets } from '../data/sampleTickets';
import {
  isInvalidPivotOrSummaryRow,
  sanitizeSiteValue,
  VALID_REQUEST_CATEGORIES,
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
        // 1. Strictly purge all invalid pivot table / summary noise rows!
        const validTickets = parsed.filter((t) => !isInvalidPivotOrSummaryRow(t));

        let hasPending = false;
        const healed = validTickets.map((t) => {
          let s = String(t['Site '] || t['Site'] || '').trim();
          let c = String(t['Request category'] || '').trim();
          if (VALID_REQUEST_CATEGORIES.includes(s)) {
            if (!c) t['Request category'] = s;
            t['Site '] = 'DT3';
          } else {
            t['Site '] = sanitizeSiteValue(s);
          }
          const st = String(t['Status '] || '').trim().toLowerCase();
          if (st !== 'resolved' && st !== 'closed') hasPending = true;
          return t;
        });

        // 2. Overwrite localStorage immediately with purged & healed tickets!
        try {
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(healed));
        } catch (e) {
          console.warn('Unable to rewrite cached tickets', e);
        }

        if (!hasPending) {
          const pendingFromSamples = sampleTickets.filter((t) => {
            const st = String(t['Status '] || '').trim().toLowerCase();
            return st !== 'resolved' && st !== 'closed';
          });
          const combined = [...pendingFromSamples, ...healed];
          try {
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(combined));
          } catch (e) {}
          return combined;
        }
        return healed;
      }
    }
  } catch (e) {
    console.error('Error loading cached tickets', e);
  }
  // Default to sample tickets extracted from the real Excel file
  return [...sampleTickets];
}

let localTickets = getInitialLocalTickets();
let localListeners = [];

function notifyLocalListeners() {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(localTickets));
  } catch (e) {
    console.warn('Storage quota reached or error saving to localStorage', e);
  }
  localListeners.forEach((listener) => listener([...localTickets]));
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
 * Real-time subscription to tickets collection
 */
export function subscribeTickets(onSuccess, onError) {
  if (isConfigValid && db) {
    try {
      const q = collection(db, COLLECTION_NAME);
      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const tickets = snapshot.docs
            .map((d) => {
              const data = d.data();
              return {
                id: d.id,
                ...data,
                // Normalize timestamps if they are Firestore Timestamps
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
          onSuccess(tickets);
        },
        (error) => {
          console.error('Firestore subscription error:', error);
          if (onError) onError(error);
          // Fallback to local tickets if firestore rules fail or network error
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
  // Send current data immediately
  setTimeout(() => onSuccess([...localTickets]), 0);

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

  if (isConfigValid && db) {
    const docRef = await addDoc(collection(db, COLLECTION_NAME), {
      ...newTicket,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return { id: docRef.id, ...newTicket };
  }

  // Demo mode
  const mockId = 'ticket-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);
  const created = { id: mockId, ...newTicket };
  localTickets.unshift(created);
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

  if (isConfigValid && db) {
    const ticketRef = doc(db, COLLECTION_NAME, id);
    await updateDoc(ticketRef, {
      ...updatePayload,
      updatedAt: serverTimestamp(),
    });
    return { id, ...updatePayload };
  }

  // Demo mode
  const index = localTickets.findIndex((t) => t.id === id);
  if (index !== -1) {
    localTickets[index] = {
      ...localTickets[index],
      ...updatePayload,
    };
    notifyLocalListeners();
    return localTickets[index];
  }
  throw new Error('Ticket not found: ' + id);
}

/**
 * Delete a ticket
 */
export async function deleteTicket(id) {
  if (isConfigValid && db) {
    const ticketRef = doc(db, COLLECTION_NAME, id);
    await deleteDoc(ticketRef);
    return true;
  }

  // Demo mode
  localTickets = localTickets.filter((t) => t.id !== id);
  notifyLocalListeners();
  return true;
}

/**
 * Bulk delete multiple tickets
 */
export async function bulkDeleteTickets(ids) {
  if (isConfigValid && db) {
    const batches = [];
    const chunkSize = 400; // Firestore limit is 500
    for (let i = 0; i < ids.length; i += chunkSize) {
      const chunk = ids.slice(i, i + chunkSize);
      const batch = writeBatch(db);
      chunk.forEach((id) => {
        const ticketRef = doc(db, COLLECTION_NAME, id);
        batch.delete(ticketRef);
      });
      batches.push(batch.commit());
    }
    await Promise.all(batches);
    return true;
  }

  // Demo mode
  const idSet = new Set(ids);
  localTickets = localTickets.filter((t) => !idSet.has(t.id));
  notifyLocalListeners();
  return true;
}

/**
 * Bulk update status of multiple tickets
 */
export async function bulkUpdateStatus(ids, newStatus, userEmail = 'admin@cbre.com') {
  const now = new Date().toISOString();

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

  if (isConfigValid && db) {
    const chunkSize = 400;
    let processed = 0;

    for (let i = 0; i < total; i += chunkSize) {
      const chunk = ticketsArray.slice(i, i + chunkSize);
      const batch = writeBatch(db);
      chunk.forEach((ticket) => {
        const docRef = doc(collection(db, COLLECTION_NAME));
        batch.set(docRef, {
          ...ticket,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          lastUpdatedBy: userEmail,
        });
      });
      await batch.commit();
      processed += chunk.length;
      if (onProgress) {
        onProgress(processed, total);
      }
    }
    return processed;
  }

  // Demo mode
  const formatted = ticketsArray.map((t, idx) => ({
    ...t,
    id: t.id || `imported-${Date.now()}-${idx}`,
    createdAt: now,
    updatedAt: now,
    lastUpdatedBy: userEmail,
  }));

  localTickets = [...formatted, ...localTickets];
  notifyLocalListeners();
  if (onProgress) onProgress(total, total);
  return total;
}
