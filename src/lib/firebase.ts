import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { 
  getFirestore,
  collection,
  doc,
  addDoc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  getDocs,
  query,
  where,
  writeBatch,
  serverTimestamp
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase Real Client
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

// Collection Names
export const DAILY_RECORDS_COL = 'daily_records_v2';
export const REQUIREMENTS_COL = 'requirements_v2';
export const TRANSFERS_COL = 'transfers_v2';
export const COLD_ROOM_COL = 'cold_room_records_v2';
export const GLOBAL_WASTAGE_COL = 'global_wastage_v2';

export const DAILY_RECORDS_OLD_COL = 'daily_records';
export const REQUIREMENTS_OLD_COL = 'requirements';
export const TRANSFERS_OLD_COL = 'transfers';
export const COLD_ROOM_OLD_COL = 'cold_room_records';

// Keep the standard exports compatible with src/App.tsx
export {
  collection,
  doc,
  addDoc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  getDocs,
  query,
  where,
  writeBatch,
  serverTimestamp
};

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path
  };
  console.error('Firestore Error Detailed Info:', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
