import { Plus, X } from 'lucide-react';
import { Eye, EyeOff } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { findCapeByName, MINECRAFT_CAPES } from '../lib/minecraftCapes';
import {
  BLUEPRINT_CONSTRAINTS,
  DEFAULT_RANK_PRESETS,
  validateAccountForm,
  ValidationErrors,
} from '../lib/validation';
import { AccountFormValues, AccountStatus, AccountType, MinecraftAccount } from '../types/stock';

interface AccountFormModalProps {
  open: boolean;
  mode: 'create' | 'edit';
  initialAccount: MinecraftAccount | null;
  availableRanks: string[];
  onClose: () => void;
  onSubmit: (values: AccountFormValues) => Promise<void>;
}

const EMPTY_VALUES: AccountFormValues = {
  accountName: '',
  rank: 'Unranked',
  accountType: 'MFA',
  status: 'available',
  email: '',
  secondaryEmail: '',
  recoveryCode: '',
  secretKey: '',
  password: '',
  capes: [],
  notes: '',
};

export function AccountFormModal({
  open,
  mode,
  initialAccount,
  availableRanks,
  onClose,
  onSubmit,
}: AccountFormModalProps) {
  const [values, setValues] = useState<AccountFormValues>(EMPTY_VALUES);
  const [capeInput, setCapeInput] = useState('');
  const [showAllCapeCatalog, setShowAllCapeCatalog] = useState(false);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setSubmitError(null);
    setShowSecret(false);
    setShowPassword(false);
    setCapeInput('');
    setShowAllCapeCatalog(false);
    if (mode === 'edit' && initialAccount) {
      setValues({
        accountName: initialAccount.accountName,
        rank: initialAccount.rank,
        accountType: initialAccount.accountType,
        status: initialAccount.status,
        email: initialAccount.email,
        secondaryEmail: initialAccount.secondaryEmail,
        recoveryCode: initialAccount.recoveryCode,
        secretKey: initialAccount.secretKey,
        password: initialAccount.password || '',
        capes: initialAccount.capes || [],
        notes: initialAccount.notes,
      });
    } else {
      setValues(EMPTY_VALUES);
    }
  }, [open, mode, initialAccount]);

  const matchingCapes = useMemo(() => {
    const q = capeInput.trim().toLowerCase();
    const selectedSet = new Set(values.capes.map((c) => c.toLowerCase()));
    const available = MINECRAFT_CAPES.filter((c) => !selectedSet.has(c.name.toLowerCase()));
    if (!q) {
      return showAllCapeCatalog ? available : available.slice(0, 8);
    }
    return available.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.category.toLowerCase().includes(q) ||
        c.aliases?.some((a) => a.toLowerCase().includes(q))
    );
  }, [capeInput, values.capes, showAllCapeCatalog]);

  if (!open) return null;

  const rankSuggestions = Array.from(new Set([...DEFAULT_RANK_PRESETS, ...availableRanks]));
  const c = BLUEPRINT_CONSTRAINTS.MinecraftAccount;

  const addCapeByName = (rawName: string) => {
    const trimmed = rawName.trim();
    if (!trimmed) return;
    const matched = findCapeByName(trimmed);
    const canonicalName = (matched ? matched.name : trimmed).slice(0, c.capes.itemMaxLength);
    setValues((v) => {
      if (v.capes.length >= c.capes.maxItems) return v;
      if (v.capes.some((existing) => existing.toLowerCase() === canonicalName.toLowerCase())) {
        return v;
      }
      return { ...v, capes: [...v.capes, canonicalName] };
    });
    setCapeInput('');
  };

  const removeCape = (nameToRemove: string) => {
    setValues((v) => ({
      ...v,
      capes: v.capes.filter((cName) => cName.toLowerCase() !== nameToRemove.toLowerCase()),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validation = validateAccountForm(values);
    setErrors(validation);
    if (Object.keys(validation).length > 0) return;

    setSaving(true);
    setSubmitError(null);
    try {
      await onSubmit(values);
      onClose();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to save account record.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="account-form-title"
    >
      <div className="w-full max-w-2xl max-h-[92vh] flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
          <div>
            <h2
              id="account-form-title"
              className="font-display text-lg font-semibold text-slate-900 dark:text-white"
            >
              {mode === 'create' ? 'Add Account to Stock' : `Edit ${initialAccount?.accountName}`}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              All credentials are stored in your private Firestore stock space.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-2 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {submitError && (
            <div className="p-3 rounded-lg border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 text-xs text-red-700 dark:text-red-300">
              {submitError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label
                htmlFor="accountName"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300"
              >
                Account Name (IGN) *
              </label>
              <input
                id="accountName"
                type="text"
                maxLength={c.accountName.maxLength}
                value={values.accountName}
                onChange={(e) => setValues((v) => ({ ...v, accountName: e.target.value }))}
                placeholder="e.g. EmeraldKnight_99"
                className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              {errors.accountName && (
                <p className="text-xs text-red-600 dark:text-red-400">{errors.accountName}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label
                  htmlFor="accountType"
                  className="block text-xs font-medium text-slate-700 dark:text-slate-300"
                >
                  Access Type
                </label>
                <select
                  id="accountType"
                  value={values.accountType}
                  onChange={(e) =>
                    setValues((v) => ({ ...v, accountType: e.target.value as AccountType }))
                  }
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {c.accountType.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="accountStatus"
                  className="block text-xs font-medium text-slate-700 dark:text-slate-300"
                >
                  Stock Status
                </label>
                <select
                  id="accountStatus"
                  value={values.status}
                  onChange={(e) =>
                    setValues((v) => ({ ...v, status: e.target.value as AccountStatus }))
                  }
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="available">Available</option>
                  <option value="reserved">Reserved</option>
                  <option value="sold">Sold</option>
                  <option value="locked">Locked</option>
                </select>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label
              htmlFor="accountRank"
              className="block text-xs font-medium text-slate-700 dark:text-slate-300"
            >
              Rank *
            </label>
            <input
              id="accountRank"
              type="text"
              maxLength={c.rank.maxLength}
              value={values.rank}
              onChange={(e) => setValues((v) => ({ ...v, rank: e.target.value }))}
              placeholder="Enter rank (e.g. MVP++, VIP+, Legend)"
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <div className="flex flex-wrap gap-1.5 pt-1">
              {rankSuggestions.map((preset) => {
                const active = values.rank.trim().toLowerCase() === preset.toLowerCase();
                return (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setValues((v) => ({ ...v, rank: preset }))}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                      active
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                    }`}
                  >
                    {preset}
                  </button>
                );
              })}
            </div>
            {errors.rank && <p className="text-xs text-red-600 dark:text-red-400">{errors.rank}</p>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label
                htmlFor="primaryEmail"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300"
              >
                Primary Email *
              </label>
              <input
                id="primaryEmail"
                type="text"
                maxLength={c.email.maxLength}
                value={values.email}
                onChange={(e) => setValues((v) => ({ ...v, email: e.target.value }))}
                placeholder="account@outlook.com"
                className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              {errors.email && (
                <p className="text-xs text-red-600 dark:text-red-400">{errors.email}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="secondaryEmail"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300"
              >
                Secondary / Recovery Email
              </label>
              <input
                id="secondaryEmail"
                type="text"
                maxLength={c.secondaryEmail.maxLength}
                value={values.secondaryEmail}
                onChange={(e) => setValues((v) => ({ ...v, secondaryEmail: e.target.value }))}
                placeholder="backup@domain.com"
                className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              {errors.secondaryEmail && (
                <p className="text-xs text-red-600 dark:text-red-400">{errors.secondaryEmail}</p>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="accountPassword"
              className="block text-xs font-medium text-slate-700 dark:text-slate-300"
            >
              Account Password
            </label>
            <div className="relative">
              <input
                id="accountPassword"
                type={showPassword ? 'text' : 'password'}
                maxLength={c.password.maxLength}
                value={values.password}
                onChange={(e) => setValues((v) => ({ ...v, password: e.target.value }))}
                placeholder="Account login password"
                className="w-full pl-3 pr-10 py-2 text-sm font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errors.password && (
              <p className="text-xs text-red-600 dark:text-red-400">{errors.password}</p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label
                htmlFor="recoveryCode"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300"
              >
                Recovery Code
              </label>
              <input
                id="recoveryCode"
                type="text"
                maxLength={c.recoveryCode.maxLength}
                value={values.recoveryCode}
                onChange={(e) => setValues((v) => ({ ...v, recoveryCode: e.target.value }))}
                placeholder="XXXXX-XXXXX-XXXXX-XXXXX-XXXXX"
                className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              {errors.recoveryCode && (
                <p className="text-xs text-red-600 dark:text-red-400">{errors.recoveryCode}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="secretKey"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300"
              >
                Secret Key (2FA / Security)
              </label>
              <div className="relative">
                <input
                  id="secretKey"
                  type={showSecret ? 'text' : 'password'}
                  maxLength={c.secretKey.maxLength}
                  value={values.secretKey}
                  onChange={(e) => setValues((v) => ({ ...v, secretKey: e.target.value }))}
                  placeholder="JBSWY3DPEHPK3PXP"
                  className="w-full pl-3 pr-10 py-2 text-sm font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <button
                  type="button"
                  onClick={() => setShowSecret((s) => !s)}
                  aria-label={showSecret ? 'Hide secret key' : 'Show secret key'}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                >
                  {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.secretKey && (
                <p className="text-xs text-red-600 dark:text-red-400">{errors.secretKey}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <label
                htmlFor="capeNameInput"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300"
              >
                Capes (Add by Name)
              </label>
              <button
                type="button"
                onClick={() => setShowAllCapeCatalog((s) => !s)}
                className="text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
              >
                {showAllCapeCatalog
                  ? 'Show Fewer Suggestions'
                  : `Browse All ${MINECRAFT_CAPES.length} Capes`}
              </button>
            </div>

            <div className="flex gap-2">
              <input
                id="capeNameInput"
                type="text"
                maxLength={c.capes.itemMaxLength}
                value={capeInput}
                onChange={(e) => setCapeInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addCapeByName(capeInput);
                  }
                }}
                placeholder="Type cape name (e.g. MINECON 2011, Migrator, Cherry Blossom, TikTok)"
                className="flex-1 px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <button
                type="button"
                onClick={() => addCapeByName(capeInput)}
                disabled={!capeInput.trim() || values.capes.length >= c.capes.maxItems}
                className="inline-flex items-center gap-1 px-3 py-2 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Cape
              </button>
            </div>

            {values.capes.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {values.capes.map((capeName) => (
                  <span
                    key={capeName}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800"
                  >
                    <span>{capeName}</span>
                    <button
                      type="button"
                      onClick={() => removeCape(capeName)}
                      aria-label={`Remove ${capeName}`}
                      className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-900 dark:hover:text-white cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {matchingCapes.length > 0 && (
              <div className="pt-1 space-y-1">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {capeInput.trim() ? 'Matching Minecraft capes:' : 'Official Minecraft capes (click to add):'}
                </p>
                <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto pr-1">
                  {matchingCapes.map((cape) => (
                    <button
                      key={cape.name}
                      type="button"
                      onClick={() => addCapeByName(cape.name)}
                      className="px-2 py-1 text-xs font-medium rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:border-emerald-500 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors cursor-pointer whitespace-nowrap"
                    >
                      + {cape.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {errors.capes && (
              <p className="text-xs text-red-600 dark:text-red-400">{errors.capes}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label
                htmlFor="accountNotes"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300"
              >
                Notes (Server Stats, Ban Status)
              </label>
              <span className="text-xs font-mono text-slate-400 tabular-nums">
                {values.notes.length}/{c.notes.maxLength}
              </span>
            </div>
            <textarea
              id="accountNotes"
              rows={2}
              maxLength={c.notes.maxLength}
              value={values.notes}
              onChange={(e) => setValues((v) => ({ ...v, notes: e.target.value }))}
              placeholder="Optional notes, cape details, or server level..."
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
            />
            {errors.notes && (
              <p className="text-xs text-red-600 dark:text-red-400">{errors.notes}</p>
            )}
          </div>

          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              {saving ? 'Saving...' : mode === 'create' ? 'Save Account' : 'Update Account'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
