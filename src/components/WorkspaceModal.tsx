import { Plus, Trash2, X } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { BLUEPRINT_CONSTRAINTS } from '../lib/validation';
import { UserWorkspace } from '../types/stock';

interface WorkspaceModalProps {
  open: boolean;
  workspace: UserWorkspace | null;
  onClose: () => void;
  onSave: (workspaceName: string, displayName: string, customRanks: string[]) => Promise<void>;
}

export function WorkspaceModal({ open, workspace, onClose, onSave }: WorkspaceModalProps) {
  const [workspaceName, setWorkspaceName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [customRanks, setCustomRanks] = useState<string[]>([]);
  const [newRank, setNewRank] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !workspace) return;
    setWorkspaceName(workspace.workspaceName);
    setDisplayName(workspace.displayName);
    setCustomRanks(workspace.customRanks || []);
    setNewRank('');
    setError(null);
  }, [open, workspace]);

  if (!open || !workspace) return null;

  const c = BLUEPRINT_CONSTRAINTS.UserWorkspace;

  const handleAddRank = () => {
    const trimmed = newRank.trim().slice(0, c.customRanks.itemMaxLength);
    if (!trimmed) return;
    if (customRanks.length >= c.customRanks.maxItems) {
      setError(`Maximum ${c.customRanks.maxItems} custom ranks allowed.`);
      return;
    }
    if (!customRanks.some((r) => r.toLowerCase() === trimmed.toLowerCase())) {
      setCustomRanks((prev) => [...prev, trimmed]);
    }
    setNewRank('');
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspaceName.trim()) {
      setError('Stock space name cannot be empty.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave(workspaceName, displayName, customRanks);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save workspace settings.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="workspace-modal-title"
    >
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h2
              id="workspace-modal-title"
              className="font-display text-lg font-semibold text-slate-900 dark:text-white"
            >
              Stock Space Settings
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Isolated vault for {workspace.email}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close workspace settings"
            className="p-2 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="p-3 rounded-lg border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 text-xs text-red-700 dark:text-red-300">
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <label
              htmlFor="wsName"
              className="block text-xs font-medium text-slate-700 dark:text-slate-300"
            >
              Stock Space Name
            </label>
            <input
              id="wsName"
              type="text"
              maxLength={c.workspaceName.maxLength}
              value={workspaceName}
              onChange={(e) => setWorkspaceName(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="wsOwner"
              className="block text-xs font-medium text-slate-700 dark:text-slate-300"
            >
              Manager Display Name
            </label>
            <input
              id="wsOwner"
              type="text"
              maxLength={c.displayName.maxLength}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label
                htmlFor="newCustomRank"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300"
              >
                Custom Rank Presets
              </label>
              <span className="text-xs font-mono text-slate-400 tabular-nums">
                {customRanks.length}/{c.customRanks.maxItems}
              </span>
            </div>
            <div className="flex gap-2">
              <input
                id="newCustomRank"
                type="text"
                maxLength={c.customRanks.itemMaxLength}
                value={newRank}
                onChange={(e) => setNewRank(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddRank();
                  }
                }}
                placeholder="e.g. Emerald, Celestial, Media"
                className="flex-1 px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <button
                type="button"
                onClick={handleAddRank}
                className="inline-flex items-center gap-1 px-3 py-2 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 cursor-pointer whitespace-nowrap shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Rank
              </button>
            </div>

            {customRanks.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-2">
                {customRanks.map((rank) => (
                  <div
                    key={rank}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200"
                  >
                    <span>{rank}</span>
                    <button
                      type="button"
                      onClick={() => setCustomRanks((prev) => prev.filter((r) => r !== rank))}
                      aria-label={`Remove ${rank}`}
                      className="text-slate-400 hover:text-red-600 dark:hover:text-red-400 cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white cursor-pointer"
            >
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
