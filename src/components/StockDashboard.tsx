import {
  AlertCircle,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Download,
  Edit3,
  Eye,
  EyeOff,
  Filter,
  Lock,
  LogOut,
  Menu,
  Moon,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  Sun,
  Trash2,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import firebaseConfig from '../../firebase-applet-config.json';
import { useAuth } from '../context/AuthContext';
import { getCapeImageUrl } from '../lib/minecraftCapes';
import {
  createAccount,
  deleteAccount,
  subscribeToAccounts,
  subscribeToUserWorkspace,
  updateAccount,
  updateAccountStatus,
  updateWorkspaceSettings,
} from '../lib/stockService';
import { BLUEPRINT_CONSTRAINTS } from '../lib/validation';
import {
  AccountFormValues,
  AccountStatus,
  AccountType,
  MinecraftAccount,
  UserWorkspace,
} from '../types/stock';
import { AccountDetailDrawer } from './AccountDetailDrawer';
import { AccountFormModal } from './AccountFormModal';
import { WorkspaceModal } from './WorkspaceModal';

interface StockDashboardProps {
  darkMode: boolean;
  onToggleDarkMode: () => void;
  selectedSpaceUid?: string | null;
  onResetSpace?: () => void;
  onOpenAdminPanel?: () => void;
}

type SortOption = 'updated' | 'name' | 'rank' | 'status';

const STATUS_META: Record<
  AccountStatus,
  { label: string; className: string; icon: typeof CheckCircle2 }
> = {
  available: {
    label: 'Available',
    className: 'text-emerald-700 dark:text-emerald-400',
    icon: CheckCircle2,
  },
  reserved: {
    label: 'Reserved',
    className: 'text-amber-700 dark:text-amber-400',
    icon: Clock,
  },
  sold: {
    label: 'Sold',
    className: 'text-slate-600 dark:text-slate-400',
    icon: Check,
  },
  locked: {
    label: 'Locked',
    className: 'text-red-700 dark:text-red-400',
    icon: Lock,
  },
};

export function StockDashboard({
  darkMode,
  onToggleDarkMode,
  selectedSpaceUid,
  onResetSpace,
  onOpenAdminPanel,
}: StockDashboardProps) {
  const { user, workspace, isAdmin, logout } = useAuth();
  const [targetWorkspace, setTargetWorkspace] = useState<UserWorkspace | null>(null);
  const [accounts, setAccounts] = useState<MinecraftAccount[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);

  const activeUid = isAdmin && selectedSpaceUid ? selectedSpaceUid : user?.uid || '';
  const activeWorkspace =
    isAdmin && selectedSpaceUid && selectedSpaceUid !== user?.uid
      ? targetWorkspace || workspace
      : workspace;

  // Filters & view state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRank, setSelectedRank] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<'ALL' | AccountStatus>('ALL');
  const [selectedType, setSelectedType] = useState<'ALL' | AccountType>('ALL');
  const [sortBy, setSortBy] = useState<SortOption>('updated');
  const [globalRevealSecrets, setGlobalRevealSecrets] = useState(false);
  const [revealedRows, setRevealedRows] = useState<Record<string, boolean>>({});
  const [copiedCell, setCopiedCell] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  // Modals & Drawers
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [editingAccount, setEditingAccount] = useState<MinecraftAccount | null>(null);
  const [inspectedAccountId, setInspectedAccountId] = useState<string | null>(null);
  const [workspaceModalOpen, setWorkspaceModalOpen] = useState(false);

  useEffect(() => {
    if (!isAdmin || !selectedSpaceUid || selectedSpaceUid === user?.uid) {
      setTargetWorkspace(null);
      return;
    }

    const unsubscribe = subscribeToUserWorkspace(
      selectedSpaceUid,
      (ws) => setTargetWorkspace(ws),
      (err) => setDataError(err.message)
    );

    return () => unsubscribe();
  }, [isAdmin, selectedSpaceUid, user?.uid]);

  useEffect(() => {
    if (!activeUid) return;
    setLoadingAccounts(true);
    setDataError(null);
    setSelectedRank('ALL');
    setSelectedStatus('ALL');
    setSelectedType('ALL');
    setSearchQuery('');
    setInspectedAccountId(null);

    const unsubscribe = subscribeToAccounts(
      activeUid,
      (items) => {
        setAccounts(items);
        setLoadingAccounts(false);
      },
      (err) => {
        setDataError(err.message);
        setLoadingAccounts(false);
      }
    );

    return () => unsubscribe();
  }, [activeUid]);

  const inspectedAccount = useMemo(
    () => accounts.find((a) => a.id === inspectedAccountId) || null,
    [accounts, inspectedAccountId]
  );

  // Compute rank counts dynamically from actual stock + user's custom rank presets
  const rankSummary = useMemo(() => {
    const counts = new Map<string, number>();
    for (const acc of accounts) {
      const rankLabel = acc.rank.trim() || 'Unranked';
      counts.set(rankLabel, (counts.get(rankLabel) || 0) + 1);
    }
    if (activeWorkspace?.customRanks) {
      for (const preset of activeWorkspace.customRanks) {
        if (!counts.has(preset)) {
          counts.set(preset, 0);
        }
      }
    }
    return Array.from(counts.entries()).sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      return a[0].localeCompare(b[0]);
    });
  }, [accounts, activeWorkspace]);

  const allRankLabels = useMemo(() => rankSummary.map(([rank]) => rank), [rankSummary]);

  const statusCounts = useMemo(() => {
    const counts: Record<AccountStatus, number> = {
      available: 0,
      reserved: 0,
      sold: 0,
      locked: 0,
    };
    for (const acc of accounts) {
      counts[acc.status] = (counts[acc.status] || 0) + 1;
    }
    return counts;
  }, [accounts]);

  const filteredAccounts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = accounts.filter((acc) => {
      if (selectedRank !== 'ALL' && acc.rank.toLowerCase() !== selectedRank.toLowerCase()) {
        return false;
      }
      if (selectedStatus !== 'ALL' && acc.status !== selectedStatus) {
        return false;
      }
      if (selectedType !== 'ALL' && acc.accountType !== selectedType) {
        return false;
      }
      if (!q) return true;
      return (
        acc.accountName.toLowerCase().includes(q) ||
        acc.rank.toLowerCase().includes(q) ||
        acc.email.toLowerCase().includes(q) ||
        acc.secondaryEmail.toLowerCase().includes(q) ||
        acc.notes.toLowerCase().includes(q) ||
        acc.capes.some((cape) => cape.toLowerCase().includes(q))
      );
    });

    const sorted = [...list];
    sorted.sort((a, b) => {
      if (sortBy === 'name') return a.accountName.localeCompare(b.accountName);
      if (sortBy === 'rank') return a.rank.localeCompare(b.rank);
      if (sortBy === 'status') return a.status.localeCompare(b.status);
      const aSec = a.updatedAt?.seconds ?? 0;
      const bSec = b.updatedAt?.seconds ?? 0;
      return bSec - aSec;
    });

    return sorted;
  }, [accounts, searchQuery, selectedRank, selectedStatus, selectedType, sortBy]);

  const activeFilterCount =
    (selectedRank !== 'ALL' ? 1 : 0) +
    (selectedStatus !== 'ALL' ? 1 : 0) +
    (selectedType !== 'ALL' ? 1 : 0) +
    (searchQuery.trim() ? 1 : 0);

  const clearFilters = () => {
    setSelectedRank('ALL');
    setSelectedStatus('ALL');
    setSelectedType('ALL');
    setSearchQuery('');
  };

  const handleCopy = async (cellId: string, text: string) => {
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setCopiedCell(cellId);
    setTimeout(() => setCopiedCell(null), 1400);
  };

  const handleOpenCreate = () => {
    setFormMode('create');
    setEditingAccount(null);
    setFormOpen(true);
  };

  const handleOpenEdit = (account: MinecraftAccount) => {
    setFormMode('edit');
    setEditingAccount(account);
    setInspectedAccountId(null);
    setFormOpen(true);
  };

  const handleFormSubmit = async (values: AccountFormValues) => {
    if (!activeUid) return;
    if (formMode === 'create') {
      await createAccount(activeUid, values);
    } else if (editingAccount) {
      await updateAccount(activeUid, editingAccount.id, values);
    }
  };

  const handleStatusChange = async (accountId: string, status: AccountStatus) => {
    if (!activeUid) return;
    try {
      await updateAccountStatus(activeUid, accountId, status);
    } catch (err) {
      setDataError(err instanceof Error ? err.message : 'Failed to update status.');
    }
  };

  const handleDeleteAccount = async (accountId: string) => {
    if (!activeUid) return;
    try {
      await deleteAccount(activeUid, accountId);
      setPendingDeleteId(null);
    } catch (err) {
      setDataError(err instanceof Error ? err.message : 'Failed to delete account.');
    }
  };

  const handleSaveWorkspace = async (
    workspaceName: string,
    displayName: string,
    customRanks: string[]
  ) => {
    if (!activeUid) return;
    await updateWorkspaceSettings(activeUid, workspaceName, displayName, customRanks);
  };

  const handleExportCsv = () => {
    const headers = [
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
    const rows = filteredAccounts.map((acc) =>
      [
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
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `blockvault-stock-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const isQuotaError =
    dataError?.includes('Quota exceeded') ||
    dataError?.includes('Free daily read units per project');

  const sidebarContent = (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800">
      <div className="h-16 px-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
        <span className="font-display text-base font-bold tracking-tight text-slate-900 dark:text-white whitespace-nowrap">
          BlockVault Stock
        </span>
        <button
          type="button"
          onClick={() => setMobileSidebarOpen(false)}
          aria-label="Close navigation"
          className="lg:hidden p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-xs font-medium text-slate-400 dark:text-slate-500">Stock Space</p>
              {isAdmin && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                  <ShieldCheck className="w-3 h-3" />
                  Admin
                </span>
              )}
            </div>
            <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
              {activeWorkspace?.workspaceName || 'Primary Stock Space'}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
              {activeWorkspace?.email || user?.email}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setWorkspaceModalOpen(true)}
            aria-label="Edit stock space settings"
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        <div className="space-y-1.5">
          <div className="px-2 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Filter by Rank
            </span>
            {selectedRank !== 'ALL' && (
              <button
                type="button"
                onClick={() => setSelectedRank('ALL')}
                className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
              >
                Reset
              </button>
            )}
          </div>

          <nav className="space-y-0.5" aria-label="Rank filters">
            <button
              type="button"
              onClick={() => {
                setSelectedRank('ALL');
                setMobileSidebarOpen(false);
              }}
              className={`w-full flex items-center justify-between px-2.5 py-2 text-sm rounded-lg transition-colors cursor-pointer ${
                selectedRank === 'ALL'
                  ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 font-semibold'
                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/70'
              }`}
            >
              <span className="truncate">All Ranks</span>
              <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
                {accounts.length}
              </span>
            </button>

            {rankSummary.map(([rank, count]) => {
              const active = selectedRank.toLowerCase() === rank.toLowerCase();
              return (
                <button
                  key={rank}
                  type="button"
                  onClick={() => {
                    setSelectedRank(rank);
                    setMobileSidebarOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 text-sm rounded-lg transition-colors cursor-pointer ${
                    active
                      ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 font-semibold'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/70'
                  }`}
                >
                  <span className="truncate">{rank}</span>
                  <span className="text-xs font-mono tabular-nums text-slate-400 dark:text-slate-500">
                    {count}
                  </span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="space-y-1.5">
          <span className="px-2 block text-xs font-semibold text-slate-500 dark:text-slate-400">
            Status
          </span>
          <div className="space-y-0.5">
            {(['ALL', 'available', 'reserved', 'sold', 'locked'] as const).map((statusKey) => {
              const active = selectedStatus === statusKey;
              const label = statusKey === 'ALL' ? 'All Statuses' : STATUS_META[statusKey].label;
              const count = statusKey === 'ALL' ? accounts.length : statusCounts[statusKey];
              return (
                <button
                  key={statusKey}
                  type="button"
                  onClick={() => {
                    setSelectedStatus(statusKey);
                    setMobileSidebarOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 text-sm rounded-lg transition-colors cursor-pointer ${
                    active
                      ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-semibold'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/70'
                  }`}
                >
                  <span>{label}</span>
                  <span className="text-xs font-mono tabular-nums text-slate-400 dark:text-slate-500">
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="p-4 border-t border-slate-200 dark:border-slate-800 space-y-2">
        {isAdmin && onOpenAdminPanel && (
          <button
            type="button"
            onClick={() => {
              setMobileSidebarOpen(false);
              onOpenAdminPanel();
            }}
            className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold rounded-lg bg-slate-900 dark:bg-slate-800 text-white hover:bg-slate-800 dark:hover:bg-slate-700 transition-colors cursor-pointer"
          >
            <span>Admin Panel</span>
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          </button>
        )}

        <button
          type="button"
          onClick={onToggleDarkMode}
          className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <span>{darkMode ? 'Light Appearance' : 'Dark Appearance'}</span>
          {darkMode ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
        </button>

        <button
          type="button"
          onClick={logout}
          className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium rounded-lg text-slate-600 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors cursor-pointer"
        >
          <span>Sign Out</span>
          <LogOut className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-64 shrink-0 sticky top-0 h-screen">
        {sidebarContent}
      </aside>

      {/* Mobile Sidebar Drawer */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-950/50"
            onClick={() => setMobileSidebarOpen(false)}
          />
          <div className="relative z-10 w-64 max-w-[85vw] h-full">{sidebarContent}</div>
        </div>
      )}

      {/* Main Content Workspace */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="h-16 px-4 sm:px-6 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between gap-4 sticky top-0 z-30">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileSidebarOpen(true)}
              aria-label="Open navigation"
              className="lg:hidden p-2 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 cursor-pointer"
            >
              <Menu className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2 text-sm min-w-0 truncate">
              <span className="text-slate-400 dark:text-slate-500 hidden sm:inline whitespace-nowrap">
                Stock Spaces
              </span>
              <span className="text-slate-300 dark:text-slate-700 hidden sm:inline">/</span>
              <span className="font-medium text-slate-700 dark:text-slate-200 truncate">
                {activeWorkspace?.workspaceName || 'Primary Stock Space'}
              </span>
              <span className="text-slate-300 dark:text-slate-700">/</span>
              <span className="font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                Accounts
              </span>
              {isAdmin && activeUid !== user?.uid && onResetSpace && (
                <button
                  type="button"
                  onClick={onResetSpace}
                  className="ml-2 text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:underline whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Back to My Space
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {isAdmin && onOpenAdminPanel && (
              <button
                type="button"
                onClick={onOpenAdminPanel}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-900 dark:bg-slate-800 text-white hover:bg-slate-800 dark:hover:bg-slate-700 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                Admin Panel
              </button>
            )}
            <button
              type="button"
              onClick={handleExportCsv}
              disabled={filteredAccounts.length === 0}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </button>
            <button
              type="button"
              onClick={handleOpenCreate}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4" />
              Add Account
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 space-y-6 max-w-[1400px] w-full mx-auto">
          {dataError && (
            <div className="p-4 rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-200 text-sm flex items-start gap-3">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <div className="flex-1 space-y-1">
                <p className="font-medium">
                  {isQuotaError
                    ? 'Firestore free-tier quota exceeded for today.'
                    : 'Unable to sync account stock'}
                </p>
                <p className="text-xs opacity-90 break-words">
                  {isQuotaError
                    ? `Daily read quota resets tomorrow. Database link: https://console.firebase.google.com/project/${firebaseConfig.projectId}/firestore/databases/${firebaseConfig.firestoreDatabaseId}/data?openUpgradeDialog=true`
                    : dataError}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDataError(null)}
                className="text-xs underline cursor-pointer shrink-0"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* 4-Column Summary Strip */}
          <section
            aria-label="Stock metrics"
            className="grid grid-cols-2 lg:grid-cols-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl divide-y sm:divide-y-0 sm:divide-x divide-slate-200 dark:divide-slate-800 overflow-hidden"
          >
            <div className="p-4 sm:p-5 space-y-1">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Total Stock
              </p>
              <p className="font-display text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
                {accounts.length}
              </p>
            </div>
            <div className="p-4 sm:p-5 space-y-1">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Available Ready
              </p>
              <p className="font-display text-2xl font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                {statusCounts.available}
              </p>
            </div>
            <div className="p-4 sm:p-5 space-y-1">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Ranks in Stock
              </p>
              <p className="font-display text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
                {rankSummary.filter(([, count]) => count > 0).length}
              </p>
            </div>
            <div className="p-4 sm:p-5 space-y-1">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Reserved / Sold
              </p>
              <p className="font-display text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
                {statusCounts.reserved + statusCounts.sold}
              </p>
            </div>
          </section>

          {/* Search, Rank Filter Bar & Controls */}
          <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex flex-col md:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search account name, rank, cape, primary email, secondary email, or notes..."
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

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <select
                  aria-label="Filter by access type"
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value as 'ALL' | AccountType)}
                  className="px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                >
                  <option value="ALL">All Types</option>
                  {BLUEPRINT_CONSTRAINTS.MinecraftAccount.accountType.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>

                <select
                  aria-label="Sort accounts"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                  className="px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                >
                  <option value="updated">Updated (Newest)</option>
                  <option value="name">Account Name (A–Z)</option>
                  <option value="rank">Rank (A–Z)</option>
                  <option value="status">Status</option>
                </select>

                <button
                  type="button"
                  onClick={() => setGlobalRevealSecrets((v) => !v)}
                  className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    globalRevealSecrets
                      ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300'
                      : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  {globalRevealSecrets ? (
                    <EyeOff className="w-3.5 h-3.5" />
                  ) : (
                    <Eye className="w-3.5 h-3.5" />
                  )}
                  <span>{globalRevealSecrets ? 'Hide Secrets' : 'Reveal Secrets'}</span>
                </button>
              </div>
            </div>

            {/* Interactive Rank Filter Strip */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2 overflow-x-auto pb-0.5">
              <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap shrink-0">
                <Filter className="w-3.5 h-3.5" />
                Rank:
              </span>
              <button
                type="button"
                onClick={() => setSelectedRank('ALL')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  selectedRank === 'ALL'
                    ? 'bg-slate-900 dark:bg-emerald-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                All ({accounts.length})
              </button>
              {rankSummary.map(([rank, count]) => {
                const active = selectedRank.toLowerCase() === rank.toLowerCase();
                return (
                  <button
                    key={rank}
                    type="button"
                    onClick={() => setSelectedRank(active ? 'ALL' : rank)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 tabular-nums ${
                      active
                        ? 'bg-slate-900 dark:bg-emerald-600 text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {rank} ({count})
                  </button>
                );
              })}

              {activeFilterCount > 0 && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="ml-auto px-2.5 py-1 text-xs font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white underline whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Clear Filters
                </button>
              )}
            </div>
          </section>

          {/* Inventory Grid / States */}
          {loadingAccounts ? (
            <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
              <div className="divide-y divide-slate-200 dark:divide-slate-800">
                {Array.from({ length: 5 }).map((_, idx) => (
                  <div key={idx} className="px-5 py-4 flex items-center justify-between gap-4">
                    <div className="h-4 w-36 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
                    <div className="h-4 w-20 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
                    <div className="h-4 w-44 bg-slate-200 dark:bg-slate-800 rounded animate-pulse hidden md:block" />
                    <div className="h-4 w-32 bg-slate-200 dark:bg-slate-800 rounded animate-pulse hidden lg:block" />
                  </div>
                ))}
              </div>
            </section>
          ) : accounts.length === 0 ? (
            <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-10 text-center space-y-4">
              <div className="max-w-md mx-auto space-y-2">
                <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-white">
                  Your stock space is empty
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Add your first Minecraft account with its rank, primary email, secondary email,
                  recovery code, and secret key to start managing inventory.
                </p>
              </div>
              <button
                type="button"
                onClick={handleOpenCreate}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Add First Account
              </button>
            </section>
          ) : filteredAccounts.length === 0 ? (
            <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-10 text-center space-y-3">
              <p className="font-display text-base font-semibold text-slate-900 dark:text-white">
                No accounts match your current filters
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Showing 0 of {accounts.length} accounts in your stock space.
              </p>
              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
              >
                Clear All Filters
              </button>
            </section>
          ) : (
            <>
              {/* Desktop High-Density Table */}
              <section className="hidden md:block bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 text-xs font-semibold text-slate-500 dark:text-slate-400">
                        <th className="py-3 px-4">Account Name</th>
                        <th className="py-3 px-4">Rank</th>
                        <th className="py-3 px-4">Capes</th>
                        <th className="py-3 px-4">Primary Email</th>
                        <th className="py-3 px-4">Password</th>
                        <th className="py-3 px-4">Secondary Email</th>
                        <th className="py-3 px-4">Recovery Code</th>
                        <th className="py-3 px-4">Secret Key</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-sm">
                      {filteredAccounts.map((acc) => {
                        const rowRevealed = globalRevealSecrets || Boolean(revealedRows[acc.id]);
                        const StatusIcon = STATUS_META[acc.status].icon;
                        return (
                          <tr
                            key={acc.id}
                            className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                          >
                            <td className="py-3 px-4">
                              <button
                                type="button"
                                onClick={() => setInspectedAccountId(acc.id)}
                                className="text-left group cursor-pointer"
                              >
                                <p className="font-mono font-semibold text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                                  {acc.accountName}
                                </p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                  {acc.accountType}
                                  {acc.notes ? ` · ${acc.notes.slice(0, 26)}${acc.notes.length > 26 ? '…' : ''}` : ''}
                                </p>
                              </button>
                            </td>

                            <td className="py-3 px-4 whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() =>
                                  setSelectedRank(
                                    selectedRank.toLowerCase() === acc.rank.toLowerCase()
                                      ? 'ALL'
                                      : acc.rank
                                  )
                                }
                                title="Click to filter by this rank"
                                className="text-xs font-semibold text-slate-800 dark:text-slate-200 hover:text-emerald-600 dark:hover:text-emerald-400 underline-offset-2 hover:underline cursor-pointer"
                              >
                                {acc.rank}
                              </button>
                            </td>

                            <td className="py-3 px-4">
                              {acc.capes && acc.capes.length > 0 ? (
                                <div className="flex flex-wrap items-center gap-1.5 min-w-[60px] max-w-[140px]">
                                  {acc.capes.map((capeName) => (
                                    <img
                                      key={capeName}
                                      src={getCapeImageUrl(capeName)}
                                      alt={`${capeName} cape`}
                                      title={capeName}
                                      referrerPolicy="no-referrer"
                                      className="w-5 h-8 rounded-[2px] border border-slate-300 dark:border-slate-700 object-cover [image-rendering:pixelated] shrink-0"
                                    />
                                  ))}
                                </div>
                              ) : (
                                <span className="text-xs text-slate-400">—</span>
                              )}
                            </td>

                            <td className="py-3 px-4">
                              <CopyValueCell
                                value={acc.email}
                                cellId={`${acc.id}-email`}
                                copiedCell={copiedCell}
                                onCopy={handleCopy}
                              />
                            </td>

                            <td className="py-3 px-4">
                              {acc.password ? (
                                <CopyValueCell
                                  value={acc.password}
                                  masked={!rowRevealed}
                                  cellId={`${acc.id}-password`}
                                  copiedCell={copiedCell}
                                  onCopy={handleCopy}
                                />
                              ) : (
                                <span className="text-xs text-slate-400">—</span>
                              )}
                            </td>

                            <td className="py-3 px-4">
                              {acc.secondaryEmail ? (
                                <CopyValueCell
                                  value={acc.secondaryEmail}
                                  cellId={`${acc.id}-sec-email`}
                                  copiedCell={copiedCell}
                                  onCopy={handleCopy}
                                />
                              ) : (
                                <span className="text-xs text-slate-400">—</span>
                              )}
                            </td>

                            <td className="py-3 px-4">
                              {acc.recoveryCode ? (
                                <CopyValueCell
                                  value={acc.recoveryCode}
                                  masked={!rowRevealed}
                                  cellId={`${acc.id}-recovery`}
                                  copiedCell={copiedCell}
                                  onCopy={handleCopy}
                                />
                              ) : (
                                <span className="text-xs text-slate-400">—</span>
                              )}
                            </td>

                            <td className="py-3 px-4">
                              {acc.secretKey ? (
                                <CopyValueCell
                                  value={acc.secretKey}
                                  masked={!rowRevealed}
                                  cellId={`${acc.id}-secret`}
                                  copiedCell={copiedCell}
                                  onCopy={handleCopy}
                                />
                              ) : (
                                <span className="text-xs text-slate-400">—</span>
                              )}
                            </td>

                            <td className="py-3 px-4 whitespace-nowrap">
                              <div className="inline-flex items-center gap-1.5">
                                <StatusIcon
                                  className={`w-3.5 h-3.5 shrink-0 ${STATUS_META[acc.status].className}`}
                                />
                                <select
                                  aria-label={`Status for ${acc.accountName}`}
                                  value={acc.status}
                                  onChange={(e) =>
                                    handleStatusChange(acc.id, e.target.value as AccountStatus)
                                  }
                                  className={`text-xs font-medium bg-transparent focus:outline-none cursor-pointer ${STATUS_META[acc.status].className}`}
                                >
                                  <option value="available">Available</option>
                                  <option value="reserved">Reserved</option>
                                  <option value="sold">Sold</option>
                                  <option value="locked">Locked</option>
                                </select>
                              </div>
                            </td>

                            <td className="py-3 px-4 text-right whitespace-nowrap">
                              <div className="inline-flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setRevealedRows((prev) => ({
                                      ...prev,
                                      [acc.id]: !prev[acc.id],
                                    }))
                                  }
                                  aria-label={
                                    rowRevealed ? 'Hide row secrets' : 'Reveal row secrets'
                                  }
                                  className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                                >
                                  {rowRevealed ? (
                                    <EyeOff className="w-3.5 h-3.5" />
                                  ) : (
                                    <Eye className="w-3.5 h-3.5" />
                                  )}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleOpenEdit(acc)}
                                  aria-label={`Edit ${acc.accountName}`}
                                  className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                {pendingDeleteId === acc.id ? (
                                  <div className="inline-flex items-center gap-1 ml-1">
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteAccount(acc.id)}
                                      className="px-2 py-1 text-xs font-semibold rounded bg-red-600 text-white hover:bg-red-700 cursor-pointer"
                                    >
                                      Confirm
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setPendingDeleteId(null)}
                                      className="px-1.5 py-1 text-xs text-slate-500 hover:underline cursor-pointer"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => setPendingDeleteId(acc.id)}
                                    aria-label={`Delete ${acc.accountName}`}
                                    className="p-1.5 rounded-md text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>

              {/* Mobile Structured List */}
              <section className="md:hidden space-y-3">
                {filteredAccounts.map((acc) => {
                  const StatusIcon = STATUS_META[acc.status].icon;
                  return (
                    <div
                      key={acc.id}
                      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <button
                          type="button"
                          onClick={() => setInspectedAccountId(acc.id)}
                          className="text-left min-w-0 cursor-pointer"
                        >
                          <p className="font-mono font-semibold text-slate-900 dark:text-white truncate">
                            {acc.accountName}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {acc.rank} <span aria-hidden="true">·</span> {acc.accountType}
                          </p>
                        </button>
                        <div className="inline-flex items-center gap-1 shrink-0">
                          <StatusIcon
                            className={`w-3.5 h-3.5 ${STATUS_META[acc.status].className}`}
                          />
                          <span className={`text-xs font-medium ${STATUS_META[acc.status].className}`}>
                            {STATUS_META[acc.status].label}
                          </span>
                        </div>
                      </div>

                      <div className="text-xs font-mono text-slate-600 dark:text-slate-300 space-y-1">
                        <p className="truncate">Email: {acc.email}</p>
                        {acc.secondaryEmail && (
                          <p className="truncate">Secondary: {acc.secondaryEmail}</p>
                        )}
                      </div>

                      {acc.capes && acc.capes.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5">
                          {acc.capes.map((capeName) => (
                            <img
                              key={capeName}
                              src={getCapeImageUrl(capeName)}
                              alt={`${capeName} cape`}
                              title={capeName}
                              referrerPolicy="no-referrer"
                              className="w-5 h-8 rounded-[2px] border border-slate-300 dark:border-slate-700 object-cover [image-rendering:pixelated] shrink-0"
                            />
                          ))}
                        </div>
                      )}

                      <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => setInspectedAccountId(acc.id)}
                          className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 cursor-pointer"
                        >
                          Inspect Credentials
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(acc)}
                          className="text-xs font-medium text-slate-600 dark:text-slate-300 cursor-pointer"
                        >
                          Edit
                        </button>
                      </div>
                    </div>
                  );
                })}
              </section>
            </>
          )}
        </main>
      </div>

      <AccountFormModal
        open={formOpen}
        mode={formMode}
        initialAccount={editingAccount}
        availableRanks={allRankLabels}
        onClose={() => setFormOpen(false)}
        onSubmit={handleFormSubmit}
      />

      <AccountDetailDrawer
        account={inspectedAccount}
        onClose={() => setInspectedAccountId(null)}
        onEdit={handleOpenEdit}
        onDelete={handleDeleteAccount}
        onStatusChange={handleStatusChange}
      />

      <WorkspaceModal
        open={workspaceModalOpen}
        workspace={activeWorkspace}
        onClose={() => setWorkspaceModalOpen(false)}
        onSave={handleSaveWorkspace}
      />
    </div>
  );
}

function CopyValueCell({
  value,
  masked = false,
  cellId,
  copiedCell,
  onCopy,
}: {
  value: string;
  masked?: boolean;
  cellId: string;
  copiedCell: string | null;
  onCopy: (id: string, val: string) => void;
}) {
  const isCopied = copiedCell === cellId;
  return (
    <div className="inline-flex items-center gap-1.5 max-w-[180px]">
      <span className="font-mono text-xs text-slate-700 dark:text-slate-300 truncate">
        {masked ? '••••••••••••' : value}
      </span>
      <button
        type="button"
        onClick={() => onCopy(cellId, value)}
        aria-label="Copy value"
        className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0 cursor-pointer"
      >
        {isCopied ? (
          <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
        ) : (
          <Copy className="w-3 h-3" />
        )}
      </button>
    </div>
  );
}
