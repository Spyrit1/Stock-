import {
  ArrowLeft,
  ArrowUpRight,
  Ban,
  CheckCircle2,
  Download,
  FolderOpen,
  Moon,
  RefreshCw,
  Search,
  ShieldCheck,
  ShieldOff,
  Sun,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { isRootAdminEmail, useAuth } from '../context/AuthContext';
import { db, handleFirestoreError } from '../lib/firebase';
import {
  deleteUserSpaceAndAccounts,
  grantAdminPermission,
  restoreUserSpace,
  revokeAdminPermission,
  subscribeToAdminGrants,
  subscribeToAllWorkspaces,
  subscribeToSuspendedUsers,
  suspendUserSpace,
} from '../lib/stockService';
import {
  AdminGrant,
  MinecraftAccount,
  OperationType,
  SuspendedUser,
  UserWorkspace,
} from '../types/stock';

interface AdminPanelProps {
  darkMode: boolean;
  onToggleDarkMode: () => void;
  onOpenUserSpace: (uid: string) => void;
  onBackToDashboard: () => void;
}

interface WorkspaceMetrics {
  total: number;
  available: number;
  reserved: number;
  sold: number;
  locked: number;
  ranks: string[];
  accounts: MinecraftAccount[];
}

export function AdminPanel({
  darkMode,
  onToggleDarkMode,
  onOpenUserSpace,
  onBackToDashboard,
}: AdminPanelProps) {
  const { user, isRootAdmin, isAdmin, logout } = useAuth();
  const [workspaces, setWorkspaces] = useState<UserWorkspace[]>([]);
  const [adminGrants, setAdminGrants] = useState<Record<string, AdminGrant>>({});
  const [suspendedUsers, setSuspendedUsers] = useState<Record<string, SuspendedUser>>({});
  const [metricsByUid, setMetricsByUid] = useState<Record<string, WorkspaceMetrics>>({});
  const [loadingSpaces, setLoadingSpaces] = useState(true);
  const [loadingMetrics, setLoadingMetrics] = useState(false);
  const [busyUid, setBusyUid] = useState<string | null>(null);
  const [confirmDeleteUid, setConfirmDeleteUid] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin) {
      setWorkspaces([]);
      setAdminGrants({});
      setSuspendedUsers({});
      setLoadingSpaces(false);
      return;
    }

    setLoadingSpaces(true);
    const unsubWorkspaces = subscribeToAllWorkspaces(
      (list) => {
        setWorkspaces(list);
        setLoadingSpaces(false);
      },
      (err) => {
        setError(err.message);
        setLoadingSpaces(false);
      }
    );

    const unsubAdmins = isRootAdmin
      ? subscribeToAdminGrants(
          (map) => setAdminGrants(map),
          (err) => setError(err.message)
        )
      : () => {};

    const unsubSuspended = isRootAdmin
      ? subscribeToSuspendedUsers(
          (map) => setSuspendedUsers(map),
          (err) => setError(err.message)
        )
      : () => {};

    return () => {
      unsubWorkspaces();
      unsubAdmins();
      unsubSuspended();
    };
  }, [isAdmin, isRootAdmin]);

  const loadAllSpaceMetrics = useCallback(
    async (list: UserWorkspace[]) => {
      if (!isAdmin || list.length === 0) {
        setMetricsByUid({});
        return;
      }
      setLoadingMetrics(true);
      setError(null);
      try {
        const entries = await Promise.all(
          list.map(async (ws) => {
            const path = `users/${ws.uid}/accounts`;
            try {
              const snap = await getDocs(collection(db, 'users', ws.uid, 'accounts'));
              let available = 0;
              let reserved = 0;
              let sold = 0;
              let locked = 0;
              const rankSet = new Set<string>();
              const accounts: MinecraftAccount[] = [];

              snap.docs.forEach((docSnap) => {
                const data = docSnap.data() as Partial<MinecraftAccount>;
                if (data.status === 'available') available += 1;
                else if (data.status === 'reserved') reserved += 1;
                else if (data.status === 'sold') sold += 1;
                else if (data.status === 'locked') locked += 1;
                if (data.rank) rankSet.add(data.rank);
                accounts.push({
                  id: docSnap.id,
                  ownerId: String(data.ownerId ?? ws.uid),
                  accountName: String(data.accountName ?? ''),
                  rank: String(data.rank ?? 'Unranked'),
                  accountType: (data.accountType ?? 'MFA') as MinecraftAccount['accountType'],
                  status: (data.status ?? 'available') as MinecraftAccount['status'],
                  email: String(data.email ?? ''),
                  secondaryEmail: String(data.secondaryEmail ?? ''),
                  recoveryCode: String(data.recoveryCode ?? ''),
                  secretKey: String(data.secretKey ?? ''),
                  password: String(data.password ?? ''),
                  capes: Array.isArray(data.capes) ? data.capes.map(String) : [],
                  notes: String(data.notes ?? ''),
                  createdAt: data.createdAt ?? null,
                  updatedAt: data.updatedAt ?? null,
                });
              });

              return [
                ws.uid,
                {
                  total: snap.size,
                  available,
                  reserved,
                  sold,
                  locked,
                  ranks: Array.from(rankSet).sort((a, b) => a.localeCompare(b)),
                  accounts,
                },
              ] as const;
            } catch (err) {
              handleFirestoreError(err, OperationType.LIST, path);
            }
          })
        );

        setMetricsByUid(Object.fromEntries(entries));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load workspace metrics.');
      } finally {
        setLoadingMetrics(false);
      }
    },
    [isAdmin]
  );

  useEffect(() => {
    if (isAdmin && workspaces.length > 0) {
      loadAllSpaceMetrics(workspaces);
    }
  }, [isAdmin, workspaces, loadAllSpaceMetrics]);

  const totals = useMemo(() => {
    let totalAccounts = 0;
    let totalAvailable = 0;
    const allRanks = new Set<string>();

    Object.values(metricsByUid).forEach((m) => {
      totalAccounts += m.total;
      totalAvailable += m.available;
      m.ranks.forEach((r) => allRanks.add(r));
    });

    return {
      users: workspaces.length,
      totalAccounts,
      totalAvailable,
      uniqueRanks: allRanks.size,
    };
  }, [workspaces.length, metricsByUid]);

  const filteredWorkspaces = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return workspaces;
    return workspaces.filter(
      (ws) =>
        ws.email.toLowerCase().includes(q) ||
        ws.displayName.toLowerCase().includes(q) ||
        ws.workspaceName.toLowerCase().includes(q) ||
        ws.uid.toLowerCase().includes(q)
    );
  }, [workspaces, searchQuery]);

  // Hard guard: never render admin view for non-admin sessions
  if (!isAdmin) {
    return null;
  }

  const handleToggleAdmin = async (ws: UserWorkspace) => {
    if (!user || !isRootAdmin || isRootAdminEmail(ws.email)) return;
    setBusyUid(ws.uid);
    setError(null);
    try {
      if (adminGrants[ws.uid]) {
        await revokeAdminPermission(ws.uid);
      } else {
        await grantAdminPermission(ws.uid, ws.email, user.uid);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update admin permission.');
    } finally {
      setBusyUid(null);
    }
  };

  const handleToggleSuspend = async (ws: UserWorkspace) => {
    if (!user || ws.uid === user.uid || isRootAdminEmail(ws.email)) return;
    setBusyUid(ws.uid);
    setError(null);
    try {
      if (suspendedUsers[ws.uid]) {
        await restoreUserSpace(ws.uid);
      } else {
        await suspendUserSpace(ws.uid, ws.email, user.uid);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update user suspension.');
    } finally {
      setBusyUid(null);
    }
  };

  const handleDeleteSpace = async (ws: UserWorkspace) => {
    if (!user || ws.uid === user.uid || isRootAdminEmail(ws.email)) return;
    setBusyUid(ws.uid);
    setError(null);
    try {
      await deleteUserSpaceAndAccounts(ws.uid);
      setConfirmDeleteUid(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete user stock space.');
    } finally {
      setBusyUid(null);
    }
  };

  const handleExportAllStock = () => {
    const headers = [
      'User Email',
      'Stock Space',
      'Account Name',
      'Rank',
      'Capes',
      'Type',
      'Status',
      'Primary Email',
      'Password',
      'Secondary Email',
      'Recovery Code',
      'Secret Key',
      'Notes',
    ];
    const escapeCsv = (val: string) => `"${String(val).replace(/"/g, '""')}"`;
    const rows: string[] = [];

    workspaces.forEach((ws) => {
      const m = metricsByUid[ws.uid];
      if (!m) return;
      m.accounts.forEach((acc) => {
        rows.push(
          [
            ws.email,
            ws.workspaceName,
            acc.accountName,
            acc.rank,
            acc.capes.join('; '),
            acc.accountType,
            acc.status,
            acc.email,
            acc.password,
            acc.secondaryEmail,
            acc.recoveryCode,
            acc.secretKey,
            acc.notes,
          ]
            .map(escapeCsv)
            .join(',')
        );
      });
    });

    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `blockvault-all-stock-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col">
      <header className="h-16 px-4 sm:px-6 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto h-full flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <span className="font-display text-lg font-bold tracking-tight whitespace-nowrap shrink-0">
              BlockVault Stock
            </span>
            <span className="text-slate-300 dark:text-slate-700 hidden sm:inline">/</span>
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
              <ShieldCheck className="w-4 h-4 shrink-0" />
              Admin Panel
            </span>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={onToggleDarkMode}
              aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
              className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={onBackToDashboard}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-slate-900 dark:bg-emerald-600 hover:bg-slate-800 dark:hover:bg-emerald-500 text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              My Stock Space
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Admin Permissions &amp; Stock Spaces
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Signed in as <span className="font-mono">{user?.email}</span>{' '}
              <span aria-hidden="true">·</span>{' '}
              {isRootAdmin ? 'Root Administrator' : 'Delegated Administrator'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={handleExportAllStock}
              disabled={totals.totalAccounts === 0}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              Export All CSV
            </button>
            <button
              type="button"
              onClick={() => loadAllSpaceMetrics(workspaces)}
              disabled={loadingMetrics}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 transition-colors cursor-pointer whitespace-nowrap"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingMetrics ? 'animate-spin' : ''}`} />
              Refresh Counts
            </button>
            <button
              type="button"
              onClick={logout}
              className="px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors cursor-pointer whitespace-nowrap"
            >
              Sign Out
            </button>
          </div>
        </div>

        {/* Active Admin Permissions Summary */}
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 sm:p-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                Active Firestore Admin Permissions
              </p>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Inspect and manage any user&apos;s stock space, add/edit/delete accounts, suspend or
                restore user access, delete spaces, and manage administrator roles.
              </p>
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap shrink-0">
              Rules Enforced <span aria-hidden="true">·</span> Verified Email Auth
            </div>
          </div>
        </section>

        {error && (
          <div className="p-4 rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 text-xs text-red-700 dark:text-red-300 flex items-center justify-between gap-3">
            <span>{error}</span>
            <button
              type="button"
              onClick={() => setError(null)}
              className="underline cursor-pointer shrink-0"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* 4-Column Admin KPI Strip */}
        <section className="grid grid-cols-2 lg:grid-cols-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl divide-y sm:divide-y-0 sm:divide-x divide-slate-200 dark:divide-slate-800 overflow-hidden">
          <div className="p-4 sm:p-5 space-y-1">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              User Stock Spaces
            </p>
            <p className="font-display text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
              {totals.users}
            </p>
          </div>
          <div className="p-4 sm:p-5 space-y-1">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Total Accounts Stored
            </p>
            <p className="font-display text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
              {totals.totalAccounts}
            </p>
          </div>
          <div className="p-4 sm:p-5 space-y-1">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Total Available
            </p>
            <p className="font-display text-2xl font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
              {totals.totalAvailable}
            </p>
          </div>
          <div className="p-4 sm:p-5 space-y-1">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Distinct Ranks
            </p>
            <p className="font-display text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
              {totals.uniqueRanks}
            </p>
          </div>
        </section>

        {/* Search Users Bar */}
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter user stock spaces by email, display name, workspace name, or UID..."
              className="w-full pl-9 pr-9 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </section>

        {/* User Spaces & Permissions Table */}
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          {loadingSpaces ? (
            <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
              Loading user stock spaces...
            </div>
          ) : filteredWorkspaces.length === 0 ? (
            <div className="p-10 text-center space-y-2">
              <Users className="w-6 h-6 text-slate-400 mx-auto" />
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                No matching user stock spaces found.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 text-xs font-semibold text-slate-500 dark:text-slate-400">
                    <th className="py-3 px-4">Stock Space</th>
                    <th className="py-3 px-4">User Email</th>
                    <th className="py-3 px-4">Role &amp; Access</th>
                    <th className="py-3 px-4 text-right">Stock</th>
                    <th className="py-3 px-4">Ranks</th>
                    <th className="py-3 px-4 text-right">Admin Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-sm">
                  {filteredWorkspaces.map((ws) => {
                    const metrics = metricsByUid[ws.uid];
                    const isSelf = ws.uid === user?.uid;
                    const isTargetRoot = isRootAdminEmail(ws.email);
                    const isTargetAdmin = isTargetRoot || Boolean(adminGrants[ws.uid]);
                    const isTargetSuspended = Boolean(suspendedUsers[ws.uid]);
                    const isBusy = busyUid === ws.uid;

                    return (
                      <tr
                        key={ws.uid}
                        className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        <td className="py-3.5 px-4">
                          <div className="space-y-0.5">
                            <p className="font-semibold text-slate-900 dark:text-white">
                              {ws.workspaceName}
                              {isSelf && (
                                <span className="ml-2 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                                  (You)
                                </span>
                              )}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              {ws.displayName}
                            </p>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 font-mono text-xs text-slate-700 dark:text-slate-300">
                          {ws.email}
                        </td>
                        <td className="py-3.5 px-4 text-xs whitespace-nowrap">
                          <span
                            className={`font-semibold ${
                              isTargetAdmin
                                ? 'text-emerald-700 dark:text-emerald-400'
                                : 'text-slate-600 dark:text-slate-300'
                            }`}
                          >
                            {isTargetRoot
                              ? 'Root Admin'
                              : isTargetAdmin
                              ? 'Admin'
                              : 'Standard User'}
                          </span>
                          <span aria-hidden="true" className="mx-1.5 text-slate-300 dark:text-slate-700">
                            ·
                          </span>
                          <span
                            className={
                              isTargetSuspended
                                ? 'text-red-600 dark:text-red-400 font-medium'
                                : 'text-slate-500 dark:text-slate-400'
                            }
                          >
                            {isTargetSuspended ? 'Suspended' : 'Active'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono tabular-nums text-xs text-slate-700 dark:text-slate-300 whitespace-nowrap">
                          {metrics ? `${metrics.available}/${metrics.total} avail` : '—'}
                        </td>
                        <td className="py-3.5 px-4 text-xs text-slate-600 dark:text-slate-400 max-w-[200px] truncate">
                          {metrics && metrics.ranks.length > 0 ? metrics.ranks.join(' · ') : 'None'}
                        </td>
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <div className="inline-flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => onOpenUserSpace(ws.uid)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-100 transition-colors cursor-pointer"
                            >
                              <FolderOpen className="w-3.5 h-3.5" />
                              Open
                              <ArrowUpRight className="w-3 h-3" />
                            </button>

                            {!isTargetRoot && !isSelf && (
                              <>
                                {isRootAdmin && (
                                  <button
                                    type="button"
                                    disabled={isBusy}
                                    onClick={() => handleToggleAdmin(ws)}
                                    title={
                                      isTargetAdmin ? 'Revoke Admin Role' : 'Grant Admin Role'
                                    }
                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 disabled:opacity-50 transition-colors cursor-pointer"
                                  >
                                    {isTargetAdmin ? (
                                      <>
                                        <ShieldOff className="w-3.5 h-3.5 text-amber-600" />
                                        Revoke Admin
                                      </>
                                    ) : (
                                      <>
                                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                                        Make Admin
                                      </>
                                    )}
                                  </button>
                                )}

                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() => handleToggleSuspend(ws)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 disabled:opacity-50 transition-colors cursor-pointer"
                                >
                                  {isTargetSuspended ? (
                                    <>
                                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                      Restore
                                    </>
                                  ) : (
                                    <>
                                      <Ban className="w-3.5 h-3.5 text-amber-600" />
                                      Suspend
                                    </>
                                  )}
                                </button>

                                {confirmDeleteUid === ws.uid ? (
                                  <div className="inline-flex items-center gap-1 ml-1">
                                    <button
                                      type="button"
                                      disabled={isBusy}
                                      onClick={() => handleDeleteSpace(ws)}
                                      className="px-2 py-1 text-xs font-semibold rounded bg-red-600 text-white hover:bg-red-700 cursor-pointer"
                                    >
                                      Confirm
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setConfirmDeleteUid(null)}
                                      className="px-1.5 py-1 text-xs text-slate-500 hover:underline cursor-pointer"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    disabled={isBusy}
                                    onClick={() => setConfirmDeleteUid(ws.uid)}
                                    aria-label={`Delete ${ws.email} stock space`}
                                    className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
