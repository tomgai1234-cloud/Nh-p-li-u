import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, User } from 'firebase/auth';
// import { getFirestore, collection, doc, setDoc, getDoc, getDocs, query, where, orderBy, onSnapshot, Timestamp, getDocFromServer } from 'firebase/firestore';
import toast from 'react-hot-toast';

// Default / environment fallback config
const dummyConfig = {
  apiKey: "AIzaSyDummyKeyForAppletDeployment12345",
  authDomain: "dummy-app.firebaseapp.com",
  projectId: "dummy-app-project",
  storageBucket: "dummy-app.appspot.com",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:abcdef123456"
};

// Initialize Firebase
const app = initializeApp(dummyConfig);

// Initialize Services
// Use the specific database ID from the config
// export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const db = {} as any; // Firestore is temporarily disabled
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('https://www.googleapis.com/auth/spreadsheets');
googleProvider.addScope('https://www.googleapis.com/auth/drive.file');

// Auth Helpers
export const signInWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    // Store access token so it can be used for Google API calls
    if (credential?.accessToken) {
       localStorage.setItem('googleAccessToken', credential.accessToken);
    }
    return result.user;
  } catch (error: any) {
    // Graceful fallback for local mode / dummy Firebase config
    console.warn("Google sign-in unavailable or invalid API key, using local session mode.");
    return null;
  }
};

export const logout = () => {
    localStorage.removeItem('googleAccessToken');
    return signOut(auth);
};

// Firestore Error Handler
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
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null, shouldThrow: boolean = true) {
  const errString = error instanceof Error ? error.message : String(error);
  
  if (errString.includes("Quota limit exceeded") || errString.includes("quota exceeded")) {
    toast.error("Đã vượt quá giới hạn dùng thử cơ sở dữ liệu (Firestore Quota). Vui lòng thử lại vào ngày mai.", { id: 'firestore-quota' });
    if (shouldThrow) {
        throw new Error("Lỗi hạn ngạch cơ sở dữ liệu.");
    }
    return;
  }

  const errInfo: FirestoreErrorInfo = {
    error: errString,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };
  
  // Only log detailed JSON error if it's not a quota issue
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  if (shouldThrow) {
    throw new Error(errString);
  }
}

// Connection Test removed to prevent offline errors in preview environment.

