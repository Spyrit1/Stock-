import { useCallback, useEffect, useState } from 'react';
import { AdminPanel } from './components/AdminPanel';
import { AuthGateView } from './components/AuthGateView';
import { ErrorBoundary } from './components/ErrorBoundary';
import { StockDashboard } from './components/StockDashboard';
import { AuthProvider, useAuth } from './context/AuthContext';

function AppShell() {
  const { user, isAdmin, isSuspended, authReady, workspaceReady, logout } = useAuth();
  const [routeMode, setRouteMode] = useState<'dashboard' | 'admin'>(() => {
    if (typeof window !== 'undefined' && window.location.pathname === '/admin') {
      return 'admin';
    }
    return 'dashboard';
  });
  const [selectedSpaceUid, setSelectedSpaceUid] = useState<string | null>(null);
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const saved = window.localStorage.getItem('blockvault-theme');
    if (saved === 'dark') return true;
    if (saved === 'light') return false;
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
      window.localStorage.setItem('blockvault-theme', 'dark');
    } else {
      root.classList.remove('dark');
      window.localStorage.setItem('blockvault-theme', 'light');
    }
  }, [darkMode]);

  useEffect(() => {
    const handlePopState = () => {
      if (window.location.pathname === '/admin' && isAdmin) {
        setRouteMode('admin');
      } else {
        setRouteMode('dashboard');
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [isAdmin]);

  // Enforce strict admin-only access on /admin route
  useEffect(() => {
    if (!authReady) return;
    if (!isAdmin && (routeMode === 'admin' || window.location.pathname === '/admin')) {
      setRouteMode('dashboard');
      setSelectedSpaceUid(null);
      if (window.location.pathname === '/admin') {
        window.history.replaceState({}, '', '/');
      }
    }
  }, [authReady, isAdmin, routeMode]);

  const navigateToAdmin = useCallback(() => {
    if (!isAdmin) return;
    setRouteMode('admin');
    if (window.location.pathname !== '/admin') {
      window.history.pushState({}, '', '/admin');
    }
  }, [isAdmin]);

  const navigateToDashboard = useCallback((spaceUid?: string | null) => {
    if (typeof spaceUid !== 'undefined') {
      setSelectedSpaceUid(spaceUid);
    }
    setRouteMode('dashboard');
    if (window.location.pathname !== '/') {
      window.history.pushState({}, '', '/');
    }
  }, []);

  if (!authReady || (user && !workspaceReady)) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex items-center justify-center p-6">
        <div className="text-center space-y-2">
          <p className="font-display text-lg font-semibold">BlockVault Stock</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Loading your private stock space...
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <AuthGateView
        darkMode={darkMode}
        onToggleDarkMode={() => setDarkMode((prev) => !prev)}
      />
    );
  }

  if (isSuspended && !isAdmin) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
          <h1 className="font-display text-lg font-semibold text-red-600 dark:text-red-400">
            Stock Space Suspended
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            Access to modify your stock space ({user.email}) has been suspended by an administrator.
          </p>
          <button
            type="button"
            onClick={logout}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-slate-900 dark:bg-slate-800 text-white hover:bg-slate-800 cursor-pointer"
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  if (isAdmin && routeMode === 'admin') {
    return (
      <AdminPanel
        darkMode={darkMode}
        onToggleDarkMode={() => setDarkMode((prev) => !prev)}
        onOpenUserSpace={(uid) => navigateToDashboard(uid)}
        onBackToDashboard={() => navigateToDashboard(user.uid)}
      />
    );
  }

  return (
    <StockDashboard
      darkMode={darkMode}
      onToggleDarkMode={() => setDarkMode((prev) => !prev)}
      selectedSpaceUid={selectedSpaceUid}
      onResetSpace={() => setSelectedSpaceUid(user.uid)}
      onOpenAdminPanel={isAdmin ? navigateToAdmin : undefined}
    />
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AppShell />
      </AuthProvider>
    </ErrorBoundary>
  );
}
