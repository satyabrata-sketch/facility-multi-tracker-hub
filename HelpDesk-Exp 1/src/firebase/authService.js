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

export function getLocalUsers() {
  try {
    const raw = localStorage.getItem(LOCAL_USERS_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return [
    {
      uid: 'user-admin-default',
      email: 'admin@cbre.com',
      displayName: 'System Admin',
      role: 'Admin',
      createdAt: '2026-01-01T00:00:00.000Z',
    },
    {
      uid: 'user-satya-default',
      email: 'satyabrata.mohanty@cbre.com',
      displayName: 'Satyabrata Mohanty',
      role: 'Facilities Lead',
      createdAt: '2026-01-01T00:00:00.000Z',
    },
    {
      uid: 'user-diksha-default',
      email: 'diksha@cbre.com',
      displayName: 'Diksha CBRE',
      role: 'Helpdesk Engineer',
      createdAt: '2026-01-15T00:00:00.000Z',
    },
    {
      uid: 'user-wajid-default',
      email: 'wajid@cbre.com',
      displayName: 'Wajid CBRE',
      role: 'Helpdesk Engineer',
      createdAt: '2026-01-15T00:00:00.000Z',
    },
    {
      uid: 'user-tech-default',
      email: 'technician@cbre.com',
      displayName: 'Technician Team',
      role: 'Technician',
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
        const isAdmin = user.email?.toLowerCase() === 'admin@cbre.com';
        const userObj = {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName || (isAdmin ? 'System Admin' : user.email.split('@')[0]),
          role: isAdmin ? 'Admin' : 'Facilities Lead',
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
    uid: 'cbre-demo-lead',
    email: 'satyabrata.mohanty@cbre.com',
    displayName: 'Satyabrata Mohanty (Facilities Lead)',
    role: 'Facilities Lead',
    isDemo: true,
  };
  localStorage.setItem(LOCAL_AUTH_USER_KEY, JSON.stringify(defaultUser));
  callback(defaultUser);

  return () => {};
}

export async function loginWithEmail(email, password) {
  let cleanEmail = (email || '').trim().toLowerCase();
  if (cleanEmail === 'admin') cleanEmail = 'admin@cbre.com';

  const isAdminEmail = cleanEmail === 'admin@cbre.com' || cleanEmail === 'admin';
  const isMasterAdminPassword = password === 'Nabindia@123';

  if (isAdminEmail && !isMasterAdminPassword) {
    throw new Error('Invalid credentials for administrator. Please enter the correct admin password.');
  }

  if (isConfigValid && auth) {
    try {
      const cred = await signInWithEmailAndPassword(auth, cleanEmail, password);
      const userRecord = {
        uid: cred.user.uid,
        email: cred.user.email,
        displayName: cred.user.displayName || (isAdminEmail ? 'System Admin' : cred.user.email.split('@')[0]),
        role: isAdminEmail ? 'Admin' : 'Facilities Lead',
        isDemo: false,
      };
      localStorage.setItem(LOCAL_AUTH_USER_KEY, JSON.stringify(userRecord));
      return userRecord;
    } catch (fbErr) {
      console.warn('Firebase auth signIn warning:', fbErr.code);
      if (isAdminEmail && isMasterAdminPassword) {
        try {
          const newCred = await createUserWithEmailAndPassword(auth, 'admin@cbre.com', 'Nabindia@123');
          await updateProfile(newCred.user, { displayName: 'System Admin' });
          const adminUser = {
            uid: newCred.user.uid,
            email: 'admin@cbre.com',
            displayName: 'System Admin',
            role: 'Admin',
            isDemo: false,
          };
          localStorage.setItem(LOCAL_AUTH_USER_KEY, JSON.stringify(adminUser));
          return adminUser;
        } catch (createErr) {
          console.warn('Firebase createUser warning:', createErr.code);
        }

        const adminUser = {
          uid: 'admin-master-cbre',
          email: 'admin@cbre.com',
          displayName: 'System Admin',
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
  if (isAdminEmail && isMasterAdminPassword) {
    const adminUser = {
      uid: 'admin-master-cbre',
      email: 'admin@cbre.com',
      displayName: 'System Admin',
      role: 'Admin',
      isDemo: true,
    };
    localStorage.setItem(LOCAL_AUTH_USER_KEY, JSON.stringify(adminUser));
    return adminUser;
  }

  const demoUser = {
    uid: 'demo-' + Date.now(),
    email: cleanEmail,
    displayName: cleanEmail.split('@')[0],
    role: isAdminEmail ? 'Admin' : 'Facilities Lead',
    isDemo: true,
  };
  localStorage.setItem(LOCAL_AUTH_USER_KEY, JSON.stringify(demoUser));
  return demoUser;
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
  role = 'Helpdesk Engineer',
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
