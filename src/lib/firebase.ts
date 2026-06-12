import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import type { Auth } from 'firebase/auth';
import type { Firestore } from 'firebase/firestore';
import type { FirebaseStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: import.meta.env.PUBLIC_FIREBASE_API_KEY,
  authDomain: import.meta.env.PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.PUBLIC_FIREBASE_APP_ID,
};

function getApp(): FirebaseApp {
  return getApps().length ? getApps()[0]! : initializeApp(firebaseConfig);
}

let _auth: Auth | null = null;
export async function getAuth(): Promise<Auth> {
  if (!_auth) {
    const { getAuth: _getAuth, connectAuthEmulator } = await import('firebase/auth');
    _auth = _getAuth(getApp());
    if (import.meta.env.PUBLIC_USE_EMULATORS === 'true') {
      connectAuthEmulator(_auth, 'http://localhost:9099', { disableWarnings: true });
    }
  }
  return _auth;
}

let _db: Firestore | null = null;
export async function getDb(): Promise<Firestore> {
  if (!_db) {
    const { getFirestore, connectFirestoreEmulator } = await import('firebase/firestore');
    _db = getFirestore(getApp());
    if (import.meta.env.PUBLIC_USE_EMULATORS === 'true') {
      connectFirestoreEmulator(_db, 'localhost', 8080);
    }
  }
  return _db;
}

let _storage: FirebaseStorage | null = null;
export async function getStorage(): Promise<FirebaseStorage> {
  if (!_storage) {
    const { getStorage: _getStorage, connectStorageEmulator } = await import('firebase/storage');
    _storage = _getStorage(getApp());
    if (import.meta.env.PUBLIC_USE_EMULATORS === 'true') {
      connectStorageEmulator(_storage, 'localhost', 9199);
    }
  }
  return _storage;
}
