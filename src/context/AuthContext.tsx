import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { getAuthStatus, login, logout } from '../api/auth';
import {
  getAuthToken,
  setAuthBootstrapInProgress,
  setAuthToken,
  setUnauthorizedHandler,
} from '../api/client';
import type { AuthUser, LoginRequest } from '../types';

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
}

interface AuthContextValue extends AuthState {
  signIn: (credentials: LoginRequest) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, loading: true });

  // Keep a stable ref to signOut so the axios interceptor callback doesn't
  // capture a stale closure.
  const signOutRef = useRef<() => Promise<void>>(async () => {});

  const signOut = useCallback(async () => {
    setAuthToken(null);
    setState({ user: null, loading: false });
    try {
      await logout();
    } catch {
      // The local session is already cleared; server logout is best effort.
    }
  }, []);

  // Keep ref in sync
  useEffect(() => {
    signOutRef.current = signOut;
  }, [signOut]);

  // Register 401 handler so any API call can trigger automatic logout
  useEffect(() => {
    setUnauthorizedHandler(() => signOutRef.current());
    return () => setUnauthorizedHandler(null);
  }, []);

  // Check existing session on mount
  useEffect(() => {
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const bootstrapAuth = async () => {
      setAuthBootstrapInProgress(true);
      const maxAttempts = getAuthToken() ? 3 : 1;

      for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        try {
          const res = await getAuthStatus();
          if (cancelled) return;

          setState(
            res.data.authenticated && res.data.username
              ? { user: { username: res.data.username }, loading: false }
              : { user: null, loading: false }
          );
          setAuthBootstrapInProgress(false);
          return;
        } catch {
          if (cancelled) return;
          if (attempt < maxAttempts) {
            await new Promise<void>((resolve) => {
              retryTimer = setTimeout(resolve, 350 * attempt);
            });
            continue;
          }
          setAuthToken(null);
          setState({ user: null, loading: false });
          setAuthBootstrapInProgress(false);
        }
      }
    };

    void bootstrapAuth();

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
      setAuthBootstrapInProgress(false);
    };
  }, []);

  const signIn = useCallback(async (credentials: LoginRequest) => {
    const res = await login(credentials);
    if (res.data?.authenticated && res.data?.username) {
      setAuthToken(res.data.token ?? null);
      setState({ user: { username: res.data.username }, loading: false });
    } else {
      throw new Error(res.message ?? 'Login failed');
    }
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, signIn, signOut }}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
