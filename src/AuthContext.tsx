import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  signOut as firebaseSignOut
} from 'firebase/auth';
import { auth, googleProvider, isFirebaseConfigured } from './firebase';

export interface AppUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  isDemo?: boolean;
}

interface AuthContextType {
  user: AppUser | null;
  loading: boolean;
  signIn: () => Promise<void>;
  signInDemo: () => void;
  logOut: () => Promise<void>;
  getToken: () => Promise<string>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if we have a demo session in localStorage
    const demoSession = localStorage.getItem('demo_user_session');
    if (demoSession === 'true') {
      setUser({
        uid: 'demo-user-123',
        email: 'demo@example.com',
        displayName: 'Demo User',
        photoURL: null,
        isDemo: true
      });
      setLoading(false);
      return;
    }

    if (isFirebaseConfigured() && auth) {
      const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
        if (firebaseUser) {
          setUser({
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            displayName: firebaseUser.displayName,
            photoURL: firebaseUser.photoURL,
          });
        } else {
          setUser(null);
        }
        setLoading(false);
      });
      return () => unsubscribe();
    } else {
      setLoading(false);
    }
  }, []);

  const signIn = async () => {
    if (isFirebaseConfigured() && auth && googleProvider) {
      try {
        await signInWithPopup(auth, googleProvider);
      } catch (error) {
        console.error("Error signing in", error);
      }
    } else {
      console.warn("Firebase is not configured.");
    }
  };

  const signInDemo = () => {
    localStorage.setItem('demo_user_session', 'true');
    setUser({
      uid: 'demo-user-123',
      email: 'demo@example.com',
      displayName: 'Demo User',
      photoURL: null,
      isDemo: true
    });
  };

  const getToken = async () => {
    if (user?.isDemo) {
      if (import.meta.env?.VITE_DEMO_AUTH_TOKEN) {
        return import.meta.env.VITE_DEMO_AUTH_TOKEN;
      }
      try {
        const res = await fetch('/api/auth/demo-token');
        const ct = res.headers.get('content-type') || '';
        if (res.ok && ct.includes('application/json')) {
          const data = await res.json();
          if (data?.token) return data.token;
        }
      } catch (e) {
        console.warn('Failed to fetch demo token from server:', e);
      }
      return 'demo-token';
    }
    if (isFirebaseConfigured() && auth && auth.currentUser) {
      try { return await auth.currentUser.getIdToken(); } catch (e) { return ''; }
    }
    return '';
  };

  const logOut = async () => {
    if (user?.isDemo) {
      localStorage.removeItem('demo_user_session');
      setUser(null);
    } else if (isFirebaseConfigured() && auth) {
      try {
        await firebaseSignOut(auth);
      } catch (error) {
        console.error("Error signing out", error);
      }
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signInDemo, logOut, getToken }}>
      {children}
    </AuthContext.Provider>
  );
};
