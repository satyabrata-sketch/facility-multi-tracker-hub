import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as fbSignOut,
  onAuthStateChanged,
  updateProfile,
} from 'firebase/auth';
import {
  collection,
  doc,
  setDoc,
  getDocs,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { auth, db, isConfigValid, currentConfig } from './firebaseConfig';

const LOCAL_AUTH_USER_KEY = 'cbre_helpdesk_demo_user';
const LOCAL_USERS_KEY = 'cbre_helpdesk_users_directory';

export const SYSTEM_ROLES = [
  'Admin',
  'Helpdesk Executive',
  'FOE',
  'AFM',
  'FE soft',
  'FE Tech',
  'FM',
];

export function isAdminIdentity(email) {
  const e = (email || '').trim().toLowerCase();
  return (
    e === 'satyabrata.mohanty1@cbre.com' ||
    e === 'satyabrata.mohanty@cbre.com' ||
    e === 'admin@cbre.com' ||
    e === 'admin'
  );
}

export function getLocalUsers() {
  try {
    const raw = localStorage.getItem(LOCAL_USERS_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return [
    {
      uid: 'user-satya-admin',
      email: 'satyabrata.mohanty1@cbre.com',
      displayName: 'Satyabrata Mohanty',
      role: 'Admin',
      createdAt: '2026-01-01T00:00:00.000Z',
    },
    {
      uid: 'user-admin-default',
      email: 'admin@cbre.com',
      displayName: 'System Admin',
      role: 'Admin',
      createdAt: '2026-01-01T00:00:00.000Z',
    },
    {
      uid: 'user-diksha-default',
      email: 'diksha@cbre.com',
      displayName: 'Diksha CBRE',
      role: 'Helpdesk Executive',
      createdAt: '2026-01-15T00:00:00.000Z',
    },
    {
      uid: 'user-wajid-default',
      email: 'wajid@cbre.com',
      displayName: 'Wajid CBRE',
      role: 'Helpdesk Executive',
      createdAt: '2026-01-15T00:00:00.000Z',
    },
    {
      uid: 'user-foe-default',
      email: 'foe@cbre.com',
      displayName: 'Front Office Executive',
      role: 'FOE',
      createdAt: '2026-02-01T00:00:00.000Z',
    },
    {
      uid: 'user-afm-default',
      email: 'afm@cbre.com',
      displayName: 'Assistant FM',
      role: 'AFM',
      createdAt: '2026-02-01T00:00:00.000Z',
    },
    {
      uid: 'user-fesoft-default',
      email: 'fe.soft@cbre.com',
      displayName: 'FE Soft Services',
      role: 'FE soft',
      createdAt: '2026-02-01T00:00:00.000Z',
    },
    {
      uid: 'user-fetech-default',
      email: 'fe.tech@cbre.com',
      displayName: 'FE Technical',
      role: 'FE Tech',
      createdAt: '2026-02-01T00:00:00.000Z',
    },
    {
      uid: 'user-fm-default',
      email: 'fm@cbre.com',
      displayName: 'Facilities Manager',
      role: 'FM',
      createdAt: '2026-02-01T00:00:00.000Z',
    },
  ];
}

export function saveUserToLocalDirectory(userRecord) {
  const current = getLocalUsers();
  const existingIdx = current.findIndex((u) => u.uid === userRecord.uid || u.email === userRecord.email);
  if (existingIdx >= 0) {
    current[existingIdx] = { ...current[existingIdx], ...userRecord };
  } else {
    current.unshift(userRecord);
  }
  try {
    localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(current));
  } catch (e) {}
}

export function subscribeAuth(callback) {
  if (isConfigValid && auth) {
    return onAuthStateChanged(auth, (user) => {
      if (user) {
        const isAdmin = isAdminIdentity(user.email);
        const directory = getLocalUsers();
        const dirMatch = directory.find((u) => u.email?.toLowerCase().trim() === user.email?.toLowerCase().trim());
        const userRole = isAdmin ? 'Admin' : dirMatch?.role || 'Helpdesk Executive';
        const userObj = {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName || dirMatch?.displayName || (isAdmin ? 'Satyabrata Mohanty' : user.email.split('@')[0]),
          role: userRole,
          isDemo: false,
        };
        localStorage.setItem(LOCAL_AUTH_USER_KEY, JSON.stringify(userObj));
        callback(userObj);
      } else {
        const saved = localStorage.getItem(LOCAL_AUTH_USER_KEY);
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            if (parsed && parsed.email) {
              callback(parsed);
              return;
            }
          } catch (e) {}
        }
        callback(null);
      }
    });
  }

  // Demo mode
  const saved = localStorage.getItem(LOCAL_AUTH_USER_KEY);
  if (saved) {
    try {
      callback(JSON.parse(saved));
      return () => {};
    } catch (e) {}
  }
  const defaultUser = {
    uid: 'user-satya-admin',
    email: 'satyabrata.mohanty1@cbre.com',
    displayName: 'Satyabrata Mohanty',
    role: 'Admin',
    isDemo: true,
  };
  localStorage.setItem(LOCAL_AUTH_USER_KEY, JSON.stringify(defaultUser));
  callback(defaultUser);

  return () => {};
}

export async function loginWithEmail(email, password) {
  let cleanEmail = (email || '').trim().toLowerCase();
  if (cleanEmail === 'admin') cleanEmail = 'satyabrata.mohanty1@cbre.com';

  const isAdmin = isAdminIdentity(cleanEmail);
  const isMasterAdminPassword = password === 'Nabindia@123';

  if (isAdmin && !isMasterAdminPassword) {
    throw new Error('Invalid credentials for administrator. Please enter the correct admin password.');
  }

  // Find user in directory for role and name
  const directory = getLocalUsers();
  const dirMatch = directory.find((u) => u.email?.toLowerCase().trim() === cleanEmail);
  const assignedRole = isAdmin ? 'Admin' : dirMatch?.role || 'Helpdesk Executive';
  const assignedName =
    dirMatch?.displayName ||
    (isAdmin ? 'Satyabrata Mohanty' : cleanEmail.split('@')[0]);

  if (isConfigValid && auth) {
    try {
      const cred = await signInWithEmailAndPassword(auth, cleanEmail, password);
      const userRecord = {
        uid: cred.user.uid,
        email: cred.user.email,
        displayName: cred.user.displayName || assignedName,
        role: assignedRole,
        isDemo: false,
      };
      localStorage.setItem(LOCAL_AUTH_USER_KEY, JSON.stringify(userRecord));
      return userRecord;
    } catch (fbErr) {
      console.warn('Firebase auth signIn warning:', fbErr.code);
      if (isAdmin && isMasterAdminPassword) {
        try {
          const newCred = await createUserWithEmailAndPassword(auth, cleanEmail, 'Nabindia@123');
          await updateProfile(newCred.user, { displayName: assignedName });
          const adminUser = {
            uid: newCred.user.uid,
            email: cleanEmail,
            displayName: assignedName,
            role: 'Admin',
            isDemo: false,
          };
          localStorage.setItem(LOCAL_AUTH_USER_KEY, JSON.stringify(adminUser));
          return adminUser;
        } catch (createErr) {
          console.warn('Firebase createUser warning:', createErr.code);
        }

        const adminUser = {
          uid: 'admin-satya-master',
          email: cleanEmail,
          displayName: assignedName,
          role: 'Admin',
          isDemo: false,
        };
        localStorage.setItem(LOCAL_AUTH_USER_KEY, JSON.stringify(adminUser));
        return adminUser;
      }
      throw fbErr;
    }
  }

  // Demo or offline mode
  const userRecord = {
    uid: isAdmin ? 'admin-satya-master' : 'demo-' + Date.now(),
    email: cleanEmail,
    displayName: assignedName,
    role: assignedRole,
    isDemo: true,
  };
  localStorage.setItem(LOCAL_AUTH_USER_KEY, JSON.stringify(userRecord));
  return userRecord;
}

export async function signupWithEmail(email, password, displayName) {
  if (isConfigValid && auth) {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    if (displayName) {
      await updateProfile(cred.user, { displayName });
    }
    return {
      uid: cred.user.uid,
      email: cred.user.email,
      displayName: displayName || cred.user.email.split('@')[0],
      isDemo: false,
    };
  }

  // Demo signup
  const demoUser = {
    uid: 'demo-' + Date.now(),
    email: email.trim(),
    displayName: displayName || email.split('@')[0],
    isDemo: true,
  };
  localStorage.setItem(LOCAL_AUTH_USER_KEY, JSON.stringify(demoUser));
  return demoUser;
}

export async function logoutUser() {
  if (isConfigValid && auth) {
    await fbSignOut(auth);
  }
  localStorage.removeItem(LOCAL_AUTH_USER_KEY);
}

/**
 * Admin: Create a new user without logging out the current admin
 */
export async function createUserAsAdmin({
  email,
  password,
  displayName,
  role = 'Helpdesk Executive',
  adminEmail = 'admin@cbre.com',
}) {
  const cleanEmail = email.trim().toLowerCase();
  const cleanName = displayName ? displayName.trim() : cleanEmail.split('@')[0];
  const now = new Date().toISOString();

  let uid = 'user-' + Date.now();

  if (isConfigValid && currentConfig) {
    try {
      const secondaryAppName = 'SecondaryAdminAuthApp';
      const existingApp = getApps().find((a) => a.name === secondaryAppName);
      const secondaryApp = existingApp || initializeApp(currentConfig, secondaryAppName);
      const secondaryAuth = getAuth(secondaryApp);

      const cred = await createUserWithEmailAndPassword(secondaryAuth, cleanEmail, password);
      uid = cred.user.uid;
      if (cleanName) {
        await updateProfile(cred.user, { displayName: cleanName });
      }
      await fbSignOut(secondaryAuth);
    } catch (authErr) {
      console.warn('Firebase Auth user creation notice (continuing to directory & firestore):', authErr.code);
      if (authErr.code === 'auth/email-already-in-use') {
        uid = 'uid-' + cleanEmail.replace(/[^a-zA-Z0-9]/g, '_');
      }
    }
  }

  const userRecord = {
    uid,
    email: cleanEmail,
    displayName: cleanName,
    role,
    createdAt: now,
    createdBy: adminEmail,
  };

  // Save to Firestore 'users' collection
  if (isConfigValid && db) {
    try {
      await setDoc(doc(db, 'users', uid), {
        ...userRecord,
        serverCreatedAt: serverTimestamp(),
      });
    } catch (dbErr) {
      console.warn('Could not save user to Firestore users collection:', dbErr);
    }
  }

  // Also save to local user cache
  saveUserToLocalDirectory(userRecord);
  return userRecord;
}

/**
 * Admin: Fetch all users in organization
 */
export async function fetchUsersList() {
  const localList = getLocalUsers();
  if (isConfigValid && db) {
    try {
      const snap = await getDocs(collection(db, 'users'));
      if (!snap.empty) {
        const firestoreUsers = snap.docs.map((d) => ({
          uid: d.id,
          ...d.data(),
        }));
        const mergedMap = new Map();
        localList.forEach((u) => mergedMap.set(u.email?.toLowerCase().trim(), u));
        firestoreUsers.forEach((u) => mergedMap.set(u.email?.toLowerCase().trim(), u));
        return Array.from(mergedMap.values());
      }
    } catch (e) {
      console.warn('Could not fetch users from Firestore:', e);
    }
  }
  return localList;
}

/**
 * Admin: Delete user from organization
 */
export async function deleteUserAsAdmin(uid, email) {
  const cleanEmail = email ? email.toLowerCase().trim() : '';
  if (isConfigValid && db) {
    try {
      if (uid) {
        await deleteDoc(doc(db, 'users', uid));
      }
      if (cleanEmail) {
        const snap = await getDocs(collection(db, 'users'));
        for (const d of snap.docs) {
          const udata = d.data();
          if (d.id === uid || (udata.email && udata.email.toLowerCase().trim() === cleanEmail)) {
            await deleteDoc(d.ref);
          }
        }
      }
    } catch (e) {
      console.warn('Could not delete user from Firestore:', e);
    }
  }
  const current = getLocalUsers().filter(
    (u) => u.uid !== uid && (!cleanEmail || u.email?.toLowerCase().trim() !== cleanEmail)
  );
  try {
    localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(current));
  } catch (e) {}
  return true;
}
