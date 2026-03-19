'use client';

import React, { useMemo, useEffect, type ReactNode } from 'react';
import { FirebaseProvider } from '@/firebase/provider';
import { initializeFirebase } from '@/firebase';
import { signInAnonymously, onAuthStateChanged } from 'firebase/auth';

interface FirebaseClientProviderProps {
  children: ReactNode;
}

/**
 * FirebaseClientProvider - Initializes Firebase services and manages the 
 * background anonymous authentication required for security rules.
 */
export function FirebaseClientProvider({ children }: FirebaseClientProviderProps) {
  const firebaseServices = useMemo(() => {
    // Initialize Firebase on the client side, once per component mount.
    return initializeFirebase();
  }, []);

  useEffect(() => {
    // Perform authentication in a side effect to prevent hydration mismatches
    // and ensure side effects don't run during the render phase.
    const auth = firebaseServices.auth;
    
    // We check for an existing session before attempting an anonymous sign-in.
    // This handles cases where the session is persisted across reloads.
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        signInAnonymously(auth).catch((err) => {
          // We catch network-related failures here so they don't crash the app.
          // Firestore will automatically operate in "offline" mode as designed.
          if (process.env.NODE_ENV === 'development') {
            console.warn("Firebase Auth: Proceeding in offline/unauthenticated mode.", err.message);
          }
        });
      }
    });

    return () => unsubscribe();
  }, [firebaseServices.auth]);

  return (
    <FirebaseProvider
      firebaseApp={firebaseServices.firebaseApp}
      auth={firebaseServices.auth}
      firestore={firebaseServices.firestore}
      storage={firebaseServices.storage}
    >
      {children}
    </FirebaseProvider>
  );
}
