import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as fbSignOut,
  onAuthStateChanged,
  updateProfile,
} from 'firebase/auth';
import { auth, isConfigValid } from './firebaseConfig';

const LOCAL_AUTH_USER_KEY = 'cbre_helpdesk_demo_user';

export function subscribeAuth(callback) {
  if (isConfigValid && auth) {
    return onAuthStateChanged(auth, (user) => {
      if (user) {
        callback({
          uid: user.uid,
          email: user.email,
          displayName: user.displayName || user.email.split('@')[0],
          isDemo: false,
        });
      } else {
        callback(null);
      }
    });
  }

  // Demo mode
  const saved = localStorage.getItem(LOCAL_AUTH_USER_KEY);
  if (saved) {
    try {
      callback(JSON.parse(saved));
    } catch (e) {
      callback(null);
    }
  } else {
    // Default demo user so user can test immediately without extra clicks!
    const defaultUser = {
      uid: 'cbre-demo-lead',
      email: 'satyabrata.mohanty@cbre.com',
      displayName: 'Satyabrata Mohanty (Facilities Lead)',
      isDemo: true,
    };
    localStorage.setItem(LOCAL_AUTH_USER_KEY, JSON.stringify(defaultUser));
    callback(defaultUser);
  }

  return () => {};
}

export async function loginWithEmail(email, password) {
  if (isConfigValid && auth) {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    return {
      uid: cred.user.uid,
      email: cred.user.email,
      displayName: cred.user.displayName || cred.user.email.split('@')[0],
      isDemo: false,
    };
  }

  // Demo login
  const demoUser = {
    uid: 'demo-' + Date.now(),
    email: email.trim(),
    displayName: email.split('@')[0],
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
