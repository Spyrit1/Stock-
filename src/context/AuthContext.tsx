import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  User,
} from 'firebase/auth';
import { auth, googleProvider, testConnection } from '../lib/firebase';
import {
  checkUserAdminGrant,
  checkUserSuspended,
  ensureUserWorkspace,
  subscribeToUserWorkspace,
} from '../lib/stockService';
import { UserWorkspace } from '../types/stock';

export const ADMIN_EMAIL = 'iamspyrit@gmail.com';

interface AuthContextValue {
  user: User | null;
  workspace: UserWorkspace | null;
  isRootAdmin: boolean;
  isAdmin: boolean;
  isSuspended: boolean;
  authReady: boolean;
  workspaceReady: boolean;
  signingIn: boolean;
  authError: string | null;
  authNotice: string | null;
  offlineWarning: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<boolean>;
  signUpWithEmail: (email: string, password: string, displayName?: string) => Promise<boolean>;
  sendPasswordReset: (email: string) => Promise<boolean>;
  logout: () => Promise<void>;
  clearAuthError: () => void;
  clearAuthNotice: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function formatFirebaseAuthError(err: unknown): string {
  const code =
    typeof err === 'object' && err !== null && 'code' in err
      ? String((err as { code: unknown }).code)
      : '';
  const message = err instanceof Error ? err.message : String(err);

  if (code === 'auth/email-already-in-use' || message.includes('email-already-in-use')) {
    return 'An account with this email already exists. Try signing in instead.';
  }
  if (code === 'auth/invalid-email' || message.includes('invalid-email')) {
    return 'Please enter a valid email address.';
  }
  if (code === 'auth/weak-password' || message.includes('weak-password')) {
    return 'Password must be at least 6 characters long.';
  }
  if (
    code === 'auth/invalid-credential' ||
    code === 'auth/wrong-password' ||
    code === 'auth/user-not-found' ||
    message.includes('invalid-credential') ||
    message.includes('wrong-password') ||
    message.includes('user-not-found')
  ) {
    return 'Invalid email or password.';
  }
  if (code === 'auth/too-many-requests' || message.includes('too-many-requests')) {
    return 'Too many attempts. Please wait a moment and try again.';
  }
  if (code === 'auth/operation-not-allowed' || message.includes('operation-not-allowed')) {
    return 'Email/Password sign-in is not enabled yet in Firebase Console (Authentication -> Sign-in method -> Email/Password).';
  }
  if (code === 'auth/user-disabled' || message.includes('user-disabled')) {
    return 'This account has been disabled in Firebase Authentication.';
  }
  if (code === 'auth/popup-closed-by-user' || message.includes('popup-closed-by-user')) {
    return 'Sign-in popup was closed before completing authentication.';
  }
  if (code === 'auth/popup-blocked' || message.includes('popup-blocked')) {
    return 'Your browser blocked the sign-in popup. Allow popups for this site and try again.';
  }
  return message;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [workspace, setWorkspace] = useState<UserWorkspace | null>(null);
  const [hasAdminGrant, setHasAdminGrant] = useState(false);
  const [isSuspended, setIsSuspended] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [workspaceReady, setWorkspaceReady] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authNotice, setAuthNotice] = useState<string | null>(null);
  const [offlineWarning, setOfflineWarning] = useState(false);

  useEffect(() => {
    testConnection().then((res) => {
      if (res.offlineError) {
        setOfflineWarning(true);
      }
    });
  }, []);

  useEffect(() => {
    let unsubWorkspace: (() => void) | undefined;

    const unsubAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (unsubWorkspace) {
        unsubWorkspace();
        unsubWorkspace = undefined;
      }

      setUser(firebaseUser);
      setAuthReady(true);

      if (!firebaseUser) {
        setWorkspace(null);
        setHasAdminGrant(false);
        setIsSuspended(false);
        setWorkspaceReady(true);
        return;
      }

      setWorkspaceReady(false);
      try {
        const [ws, grantedAdmin, suspended] = await Promise.all([
          ensureUserWorkspace(firebaseUser),
          firebaseUser.emailVerified
            ? checkUserAdminGrant(firebaseUser.uid).catch(() => false)
            : Promise.resolve(false),
          checkUserSuspended(firebaseUser.uid).catch(() => false),
        ]);
        setWorkspace(ws);
        setHasAdminGrant(grantedAdmin);
        setIsSuspended(suspended);
        setWorkspaceReady(true);

        unsubWorkspace = subscribeToUserWorkspace(
          firebaseUser.uid,
          (updated) => {
            if (updated) {
              setWorkspace(updated);
            }
          },
          (err) => {
            setAuthError(err.message);
          }
        );
      } catch (err) {
        setWorkspaceReady(true);
        setAuthError(err instanceof Error ? err.message : 'Unable to initialize stock space.');
      }
    });

    return () => {
      unsubAuth();
      if (unsubWorkspace) {
        unsubWorkspace();
      }
    };
  }, []);

  const signInWithGoogle = async () => {
    setSigningIn(true);
    setAuthError(null);
    setAuthNotice(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: unknown) {
      setAuthError(formatFirebaseAuthError(err));
    } finally {
      setSigningIn(false);
    }
  };

  const signInWithEmail = async (email: string, password: string): Promise<boolean> => {
    const cleanEmail = email.trim();
    if (!cleanEmail || !password) {
      setAuthError('Please enter both your email address and password.');
      return false;
    }

    setSigningIn(true);
    setAuthError(null);
    setAuthNotice(null);
    try {
      await signInWithEmailAndPassword(auth, cleanEmail, password);
      return true;
    } catch (err: unknown) {
      setAuthError(formatFirebaseAuthError(err));
      return false;
    } finally {
      setSigningIn(false);
    }
  };

  const signUpWithEmail = async (
    email: string,
    password: string,
    displayName?: string
  ): Promise<boolean> => {
    const cleanEmail = email.trim();
    if (!cleanEmail || !password) {
      setAuthError('Please enter both your email address and password.');
      return false;
    }
    if (password.length < 6) {
      setAuthError('Password must be at least 6 characters long.');
      return false;
    }

    setSigningIn(true);
    setAuthError(null);
    setAuthNotice(null);
    try {
      const cred = await createUserWithEmailAndPassword(auth, cleanEmail, password);
      const trimmedName = displayName?.trim().slice(0, 80);
      if (trimmedName) {
        await updateProfile(cred.user, { displayName: trimmedName }).catch(() => undefined);
      }
      await sendEmailVerification(cred.user).catch(() => undefined);
      return true;
    } catch (err: unknown) {
      setAuthError(formatFirebaseAuthError(err));
      return false;
    } finally {
      setSigningIn(false);
    }
  };

  const sendPasswordReset = async (email: string): Promise<boolean> => {
    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setAuthError('Enter your email address above to receive a password reset link.');
      return false;
    }

    setSigningIn(true);
    setAuthError(null);
    setAuthNotice(null);
    try {
      await sendPasswordResetEmail(auth, cleanEmail);
      setAuthNotice(`Password reset email sent to ${cleanEmail}. Check your inbox.`);
      return true;
    } catch (err: unknown) {
      setAuthError(formatFirebaseAuthError(err));
      return false;
    } finally {
      setSigningIn(false);
    }
  };

  const logout = async () => {
    setAuthError(null);
    setAuthNotice(null);
    await signOut(auth);
  };

  const isRootAdmin = Boolean(
    user && user.emailVerified && user.email?.toLowerCase() === ADMIN_EMAIL
  );
  const isAdmin = isRootAdmin || Boolean(user && user.emailVerified && hasAdminGrant);

  return (
    <AuthContext.Provider
      value={{
        user,
        workspace,
        isRootAdmin,
        isAdmin,
        isSuspended: isAdmin ? false : isSuspended,
        authReady,
        workspaceReady,
        signingIn,
        authError,
        authNotice,
        offlineWarning,
        signInWithGoogle,
        signInWithEmail,
        signUpWithEmail,
        sendPasswordReset,
        logout,
        clearAuthError: () => setAuthError(null),
        clearAuthNotice: () => setAuthNotice(null),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return ctx;
}
