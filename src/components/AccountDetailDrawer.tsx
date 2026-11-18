import {
  Check,
  Copy,
  Edit3,
  Eye,
  EyeOff,
  Trash2,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { AccountStatus, MinecraftAccount } from '../types/stock';

interface AccountDetailDrawerProps {
  account: MinecraftAccount | null;
  onClose: () => void;
  onEdit: (account: MinecraftAccount) => void;
  onDelete: (accountId: string) => Promise<void>;
  onStatusChange: (accountId: string, status: AccountStatus) => Promise<void>;
}

const STATUS_OPTIONS: { value: AccountStatus; label: string }[] = [
  { value: 'available', label: 'Available' },
  { value: 'reserved', label: 'Reserved' },
  { value: 'sold', label: 'Sold' },
  { value: 'locked', label: 'Locked' },
];

export function AccountDetailDrawer({
  account,
  onClose,
  onEdit,
  onDelete,
  onStatusChange,
}: AccountDetailDrawerProps) {
  const [revealPassword, setRevealPassword] = useState(false);
  const [revealRecovery, setRevealRecovery] = useState(false);
  const [revealSecret, setRevealSecret] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (!account) return null;

  const copyText = async (label: string, value: string) => {
    if (!value) return;
    await navigator.clipboard.writeText(value);
    setCopiedKey(label);
    setTimeout(() => setCopiedKey(null), 1500);
  };

  const copyAllBundle = async () => {
    const bundle = [
      `Account: ${account.accountName}`,
      `Rank: ${account.rank}`,
      `Type: ${account.accountType}`,
      `Status: ${account.status}`,
      `Email: ${account.email}`,
      `Password: ${account.password || '-'}`,
      `Secondary Email: ${account.secondaryEmail || '-'}`,
      `Recovery Code: ${account.recoveryCode || '-'}`,
      `Secret Key: ${account.secretKey || '-'}`,
      `Capes: ${account.capes?.length ? account.capes.join(', ') : '-'}`,
      account.notes ? `Notes: ${account.notes}` : null,
    ]
      .filter(Boolean)
      .join('\n');
    await copyText('bundle', bundle);
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await onDelete(account.id);
      setConfirmDelete(false);
      onClose();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-slate-950/50 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="drawer-account-title"
    >
      <div className="w-full max-w-md bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 h-full flex flex-col shadow-2xl">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h2
              id="drawer-account-title"
              className="font-display text-lg font-bold text-slate-900 dark:text-white truncate font-mono"
            >
              {account.accountName}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {account.rank} <span aria-hidden="true">·</span> {account.accountType}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close inspector"
            className="p-2 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="space-y-2">
            <span className="block text-xs font-medium text-slate-500 dark:text-slate-400">
              Inventory Status
            </span>
            <div className="grid grid-cols-4 gap-1.5 p-1 bg-slate-100 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800">
              {STATUS_OPTIONS.map((opt) => {
                const active = account.status === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => onStatusChange(account.id, opt.value)}
                    className={`py-1.5 px-2 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                      active
                        ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-4 divide-y divide-slate-100 dark:divide-slate-800">
            <CredentialRow
              label="Primary Email"
              value={account.email}
              copied={copiedKey === 'email'}
              onCopy={() => copyText('email', account.email)}
            />

            <CredentialRow
              label="Password"
              value={account.password || 'Not set'}
              empty={!account.password}
              masked={Boolean(account.password) && !revealPassword}
              onToggleReveal={account.password ? () => setRevealPassword((v) => !v) : undefined}
              revealed={revealPassword}
              copied={copiedKey === 'password'}
              onCopy={() => copyText('password', account.password)}
            />

            <CredentialRow
              label="Secondary Email"
              value={account.secondaryEmail || 'Not set'}
              empty={!account.secondaryEmail}
              copied={copiedKey === 'secondaryEmail'}
              onCopy={() => copyText('secondaryEmail', account.secondaryEmail)}
            />

            <CredentialRow
              label="Recovery Code"
              value={account.recoveryCode || 'Not set'}
              empty={!account.recoveryCode}
              masked={Boolean(account.recoveryCode) && !revealRecovery}
              onToggleReveal={
                account.recoveryCode ? () => setRevealRecovery((v) => !v) : undefined
              }
              revealed={revealRecovery}
              copied={copiedKey === 'recoveryCode'}
              onCopy={() => copyText('recoveryCode', account.recoveryCode)}
            />

            <CredentialRow
              label="Secret Key"
              value={account.secretKey || 'Not set'}
              empty={!account.secretKey}
              masked={Boolean(account.secretKey) && !revealSecret}
              onToggleReveal={account.secretKey ? () => setRevealSecret((v) => !v) : undefined}
              revealed={revealSecret}
              copied={copiedKey === 'secretKey'}
              onCopy={() => copyText('secretKey', account.secretKey)}
            />
          </div>

          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-2">
            <span className="block text-xs font-medium text-slate-500 dark:text-slate-400">
              Capes
            </span>
            {account.capes && account.capes.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {account.capes.map((capeName) => (
                  <span
                    key={capeName}
                    className="px-2.5 py-1 text-xs font-medium rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200"
                  >
                    {capeName}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-400 italic">No capes added</p>
            )}
          </div>

          {account.notes && (
            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-1.5">
              <span className="block text-xs font-medium text-slate-500 dark:text-slate-400">
                Notes
              </span>
              <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                {account.notes}
              </p>
            </div>
          )}

          <div className="pt-2">
            <button
              type="button"
              onClick={copyAllBundle}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-100 transition-colors cursor-pointer"
            >
              {copiedKey === 'bundle' ? (
                <>
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span>Copied Full Account Bundle</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>Copy Full Account Details</span>
                </>
              )}
            </button>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
          {!confirmDelete ? (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-red-600 hover:bg-red-700 text-white cursor-pointer"
              >
                {deleting ? 'Deleting...' : 'Confirm Delete'}
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="px-2.5 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:underline cursor-pointer"
              >
                Cancel
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={() => onEdit(account)}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-slate-900 dark:bg-emerald-600 hover:bg-slate-800 dark:hover:bg-emerald-500 text-white transition-colors cursor-pointer"
          >
            <Edit3 className="w-4 h-4" />
            Edit Account
          </button>
        </div>
      </div>
    </div>
  );
}

function CredentialRow({
  label,
  value,
  empty = false,
  masked = false,
  revealed = false,
  copied = false,
  onToggleReveal,
  onCopy,
}: {
  label: string;
  value: string;
  empty?: boolean;
  masked?: boolean;
  revealed?: boolean;
  copied?: boolean;
  onToggleReveal?: () => void;
  onCopy: () => void;
}) {
  return (
    <div className="pt-4 first:pt-0 space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</span>
        <div className="flex items-center gap-1.5">
          {onToggleReveal && (
            <button
              type="button"
              onClick={onToggleReveal}
              className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded cursor-pointer"
              aria-label={revealed ? `Hide ${label}` : `Reveal ${label}`}
            >
              {revealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
          )}
          {!empty && (
            <button
              type="button"
              onClick={onCopy}
              className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="w-3 h-3 text-emerald-600" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  <span>Copy</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
      <div
        className={`text-sm font-mono break-all px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 ${
          empty ? 'text-slate-400 italic font-sans' : 'text-slate-900 dark:text-slate-100'
        }`}
      >
        {masked ? '••••••••••••••••••••' : value}
      </div>
    </div>
  );
}
