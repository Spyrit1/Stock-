import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Layers,
  Mail,
  Moon,
  ShieldCheck,
  Sun,
} from 'lucide-react';
import React, { useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';

interface AuthGateViewProps {
  darkMode: boolean;
  onToggleDarkMode: () => void;
}

type AuthMode = 'signin' | 'signup';

export function AuthGateView({ darkMode, onToggleDarkMode }: AuthGateViewProps) {
  const {
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    sendPasswordReset,
    signingIn,
    authError,
    authNotice,
    offlineWarning,
    clearAuthError,
    clearAuthNotice,
  } = useAuth();

  const [mode, setMode] = useState<AuthMode>('signin');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [imageError, setImageError] = useState(false);
  const emailInputRef = useRef<HTMLInputElement>(null);

  const switchMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    clearAuthError();
    clearAuthNotice();
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'signin') {
      await signInWithEmail(email, password);
    } else {
      await signUpWithEmail(email, password, displayName);
    }
  };

  const focusAuthCard = () => {
    emailInputRef.current?.focus();
    emailInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col">
      <header className="w-full border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-8">
          <span className="font-display text-lg font-bold tracking-tight whitespace-nowrap shrink-0">
            BlockVault Stock
          </span>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={onToggleDarkMode}
              aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
              className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={focusAuthCard}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Sign In / Sign Up
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-10 lg:py-16 grid grid-cols-1 lg:grid-cols-12 gap-10 items-stretch">
        <section className="lg:col-span-6 flex flex-col justify-center space-y-6">
          <div className="space-y-4">
            <p className="text-xs font-medium tracking-wide text-emerald-700 dark:text-emerald-400">
              Private Inventory &amp; Credential Vault
            </p>
            <h1 className="font-display text-4xl sm:text-5xl font-bold tracking-tight text-slate-900 dark:text-white leading-tight [text-wrap:balance]">
              Minecraft account stock, organized and isolated by user.
            </h1>
            <p className="text-base text-slate-600 dark:text-slate-300 leading-relaxed max-w-xl">
              Store account usernames, ranks, capes, emails, recovery codes, passwords, and 2FA
              secret keys inside your own authenticated Firestore stock space.
            </p>
          </div>

          {(authError || offlineWarning) && (
            <div className="p-4 rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-200 text-sm flex items-start gap-3 max-w-lg">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <div className="flex-1 space-y-1">
                <p className="font-medium">
                  {offlineWarning
                    ? 'Firestore appears offline. Check your network connection or Firebase setup.'
                    : 'Authentication Notice'}
                </p>
                {authError && <p className="text-xs opacity-90">{authError}</p>}
              </div>
              {authError && (
                <button
                  type="button"
                  onClick={clearAuthError}
                  className="text-xs underline underline-offset-2 shrink-0 cursor-pointer"
                >
                  Dismiss
                </button>
              )}
            </div>
          )}

          {authNotice && (
            <div className="p-4 rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 text-sm flex items-start gap-3 max-w-lg">
              <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
              <p className="flex-1 text-xs leading-relaxed">{authNotice}</p>
              <button
                type="button"
                onClick={clearAuthNotice}
                className="text-xs underline underline-offset-2 shrink-0 cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          )}

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-5 max-w-lg">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-white">
                  {mode === 'signin' ? 'Sign In to Your Vault' : 'Create Your Stock Space'}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {mode === 'signin'
                    ? 'Access your isolated Minecraft accounts inventory.'
                    : 'Register with email & password or continue with Google.'}
                </p>
              </div>
            </div>

            {/* Sign In / Sign Up Mode Switcher */}
            <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => switchMode('signin')}
                className={`py-2 px-3 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                  mode === 'signin'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => switchMode('signup')}
                className={`py-2 px-3 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                  mode === 'signup'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Sign Up
              </button>
            </div>

            <form onSubmit={handleEmailSubmit} className="space-y-3.5">
              {mode === 'signup' && (
                <div className="space-y-1.5">
                  <label
                    htmlFor="auth-display-name"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300"
                  >
                    Display Name (Optional)
                  </label>
                  <input
                    id="auth-display-name"
                    type="text"
                    maxLength={80}
                    autoComplete="name"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="e.g. Spyrit Store"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <label
                  htmlFor="auth-email-input"
                  className="block text-xs font-medium text-slate-700 dark:text-slate-300"
                >
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    ref={emailInputRef}
                    id="auth-email-input"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <label
                    htmlFor="auth-password-input"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300"
                  >
                    Password
                  </label>
                  {mode === 'signin' && (
                    <button
                      type="button"
                      disabled={signingIn}
                      onClick={() => sendPasswordReset(email)}
                      className="text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer disabled:opacity-50"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <input
                    id="auth-password-input"
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={mode === 'signup' ? 'At least 6 characters' : 'Enter your password'}
                    className="w-full pl-3 pr-10 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
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
              </div>

              <button
                type="submit"
                disabled={signingIn}
                className="w-full flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-slate-900 dark:bg-emerald-600 hover:bg-slate-800 dark:hover:bg-emerald-500 disabled:opacity-60 text-white text-sm font-semibold transition-colors cursor-pointer"
              >
                <span>
                  {signingIn
                    ? mode === 'signin'
                      ? 'Signing In...'
                      : 'Creating Account...'
                    : mode === 'signin'
                    ? 'Sign In with Email'
                    : 'Create Account with Email'}
                </span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>

            <div className="relative flex items-center py-1">
              <div className="flex-grow border-t border-slate-200 dark:border-slate-800" />
              <span className="shrink mx-3 text-xs text-slate-400 dark:text-slate-500">or</span>
              <div className="flex-grow border-t border-slate-200 dark:border-slate-800" />
            </div>

            <button
              type="button"
              onClick={signInWithGoogle}
              disabled={signingIn}
              className="w-full flex items-center justify-center gap-3 px-5 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-60 text-slate-800 dark:text-slate-100 text-sm font-semibold transition-colors cursor-pointer"
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="M21.35 11.1h-9.17v2.98h5.27c-.23 1.24-.94 2.3-2.01 3.01v2.5h3.25c1.9-1.75 2.99-4.33 2.99-7.39 0-.37-.03-.74-.1-1.1z"
                />
                <path
                  fill="currentColor"
                  d="M12.18 21.5c2.71 0 4.99-.9 6.65-2.43l-3.25-2.5c-.9.6-2.05.96-3.4.96-2.61 0-4.82-1.76-5.61-4.13H3.22v2.58C4.87 19.26 8.27 21.5 12.18 21.5z"
                />
                <path
                  fill="currentColor"
                  d="M6.57 13.4a5.7 5.7 0 0 1 0-3.66V7.16H3.22a9.5 9.5 0 0 0 0 8.82l3.35-2.58z"
                />
                <path
                  fill="currentColor"
                  d="M12.18 5.61c1.47 0 2.79.51 3.83 1.5l2.87-2.87C17.16 2.63 14.89 1.65 12.18 1.65c-3.91 0-7.31 2.24-8.96 5.51l3.35 2.58c.79-2.37 3-4.13 5.61-4.13z"
                />
              </svg>
              <span>Continue with Google</span>
            </button>

            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs text-slate-600 dark:text-slate-400">
              <div className="flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <span>Per-user Firestore isolation</span>
              </div>
              <div className="flex items-start gap-2">
                <Layers className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <span>1-click rank filtering</span>
              </div>
              <div className="flex items-start gap-2">
                <KeyRound className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <span>Masked codes &amp; secret keys</span>
              </div>
            </div>
          </div>
        </section>

        <section className="lg:col-span-6 flex">
          <div className="relative w-full min-h-[340px] lg:min-h-[520px] rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-900">
            {!imageError ? (
              <img
                src="/src/assets/images/minecraft_vault_emblem_1795001926628.jpg"
                alt="Isometric obsidian and emerald vault architecture"
                referrerPolicy="no-referrer"
                onError={() => setImageError(true)}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950 flex flex-col items-center justify-center p-8 text-center">
                <ShieldCheck className="w-12 h-12 text-emerald-400 mb-3" />
                <p className="font-display text-lg font-semibold text-white">
                  Isolated Account Vault
                </p>
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/20 to-transparent flex items-end p-6 sm:p-8">
              <div className="space-y-1 text-white max-w-md">
                <p className="text-xs font-medium text-emerald-300">
                  Private Vault Architecture
                </p>
                <p className="text-sm text-slate-200 leading-relaxed">
                  Every authenticated account receives an independent stock space secured by
                  user-scoped Firestore access rules.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
