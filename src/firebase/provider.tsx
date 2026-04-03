'use client';

import React, { DependencyList, createContext, useContext, ReactNode, useMemo, useState, useEffect } from 'react';
import { FirebaseApp } from 'firebase/app';
import { Firestore } from 'firebase/firestore';
import { Auth, User, onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import { FirebaseStorage } from 'firebase/storage';
import { FirebaseErrorListener } from '@/components/FirebaseErrorListener'

interface FirebaseProviderProps {
  children: ReactNode;
  firebaseApp: FirebaseApp;
  firestore: Firestore;
  auth: Auth;
  storage: FirebaseStorage;
}

// User identity from LocalStorage
interface UserSession {
  email: string | null;
  sessionId: string | null;
}

// Combined state for the Firebase context
export interface FirebaseContextState {
  areServicesAvailable: boolean;
  firebaseApp: FirebaseApp | null;
  firestore: Firestore | null;
  auth: Auth | null;
  storage: FirebaseStorage | null;
  // Auth state
  user: User | null; // The Firebase Auth User
  email: string | null; // The System Identity (Email)
  sessionId: string | null;
  isUserLoading: boolean;
  userError: Error | null;
}

export interface UserHookResult { 
  user: User | null;
  email: string | null;
  sessionId: string | null;
  isLoading: boolean;
  userError: Error | null;
}

export const FirebaseContext = createContext<FirebaseContextState | undefined>(undefined);

/**
 * FirebaseProvider manages Firebase services and synchronizes the local session with Firebase Auth.
 */
export const FirebaseProvider: React.FC<FirebaseProviderProps> = ({
  children,
  firebaseApp,
  firestore,
  auth,
  storage,
}) => {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [session, setSession] = useState<UserSession>({ email: null, sessionId: null });
  const [isInitialAuthCheckDone, setIsInitialAuthCheckDone] = useState(false);
  const [userError, setUserError] = useState<Error | null>(null);

  // Effect 1: Handle Firebase Auth State
  useEffect(() => {
    if (!auth) return;

    const unsubscribe = onAuthStateChanged(
      auth,
      (user) => {
        setFirebaseUser(user);
        setIsInitialAuthCheckDone(true);
      },
      (error) => {
        console.error("FirebaseProvider: Auth error:", error);
        setUserError(error);
        setIsInitialAuthCheckDone(true);
      }
    );
    return () => unsubscribe();
  }, [auth]);

  // Effect 2: Handle Local Session (V3 Namespace)
  useEffect(() => {
    const resolveSession = () => {
      const email = localStorage.getItem('sitecommand_v3_identity');
      const sessionId = localStorage.getItem('sitecommand_v3_token');
      setSession({ 
        email: email ? email.toLowerCase().trim() : null, 
        sessionId 
      });
    };

    resolveSession();
    window.addEventListener('storage', resolveSession);
    return () => window.removeEventListener('storage', resolveSession);
  }, []);

  // Effect 3: Sync Session to Firebase Auth (Anonymous Login)
  // This ensures Firestore rules (request.auth != null) pass even for custom-auth users.
  useEffect(() => {
    if (auth && session.email && !firebaseUser && isInitialAuthCheckDone) {
        signInAnonymously(auth).catch(err => console.error("Anonymous sync failed:", err));
    }
  }, [auth, session.email, firebaseUser, isInitialAuthCheckDone]);

  const contextValue = useMemo((): FirebaseContextState => {
    const servicesAvailable = !!(firebaseApp && firestore && auth && storage);
    return {
      areServicesAvailable: servicesAvailable,
      firebaseApp: servicesAvailable ? firebaseApp : null,
      firestore: servicesAvailable ? firestore : null,
      auth: servicesAvailable ? auth : null,
      storage: servicesAvailable ? storage : null,
      user: firebaseUser,
      email: session.email,
      sessionId: session.sessionId,
      isUserLoading: !isInitialAuthCheckDone,
      userError,
    };
  }, [firebaseApp, firestore, auth, storage, firebaseUser, session, isInitialAuthCheckDone, userError]);

  return (
    <FirebaseContext.Provider value={contextValue}>
      <FirebaseErrorListener />
      {children}
    </FirebaseContext.Provider>
  );
};

export const useFirebase = () => {
  const context = useContext(FirebaseContext);
  if (context === undefined) {
    throw new Error('useFirebase must be used within a FirebaseProvider.');
  }
  return context;
};

export const useFirestore = (): Firestore => {
  const { firestore } = useFirebase();
  if (!firestore) throw new Error("Firestore not initialized");
  return firestore;
};

export const useStorage = (): FirebaseStorage => {
  const { storage } = useFirebase();
  if (!storage) throw new Error("Storage not initialized");
  return storage;
};

export const useAuth = (): Auth => {
  const { auth } = useFirebase();
  if (!auth) throw new Error("Auth not initialized");
  return auth;
};

export function useMemoFirebase<T>(factory: () => T, deps: DependencyList): T {
  const memoized = useMemo(factory, deps);
  if(typeof memoized === 'object' && memoized !== null) {
    (memoized as any).__memo = true;
  }
  return memoized;
}

/**
 * useUser - Returns the current system identity and auth status.
 */
export const useUser = (): UserHookResult => { 
  const { user, email, sessionId, isUserLoading, userError } = useFirebase(); 
  return { 
    user, 
    email, 
    sessionId, 
    isLoading: isUserLoading, 
    userError 
  };
};
