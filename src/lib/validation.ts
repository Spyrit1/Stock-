import { AccountFormValues, AccountStatus, AccountType } from '../types/stock';

/**
 * Synchronized verbatim with firebase-blueprint.json & firestore.rules.
 */
export const BLUEPRINT_CONSTRAINTS = {
  UserWorkspace: {
    uid: { minLength: 1, maxLength: 128, pattern: /^[a-zA-Z0-9_\-]+$/ },
    email: { minLength: 3, maxLength: 254 },
    displayName: { minLength: 1, maxLength: 80 },
    workspaceName: { minLength: 1, maxLength: 64 },
    customRanks: { maxItems: 20, itemMinLength: 1, itemMaxLength: 40 },
  },
  MinecraftAccount: {
    ownerId: { minLength: 1, maxLength: 128, pattern: /^[a-zA-Z0-9_\-]+$/ },
    accountName: { minLength: 1, maxLength: 64, pattern: /^[a-zA-Z0-9_\-. ]+$/ },
    rank: { minLength: 1, maxLength: 40 },
    accountType: ['MFA', 'SFA', 'NFA', 'Cape', 'OG'] as const satisfies readonly AccountType[],
    status: ['available', 'reserved', 'sold', 'locked'] as const satisfies readonly AccountStatus[],
    email: { minLength: 3, maxLength: 254 },
    secondaryEmail: { minLength: 0, maxLength: 254 },
    recoveryCode: { minLength: 0, maxLength: 256 },
    secretKey: { minLength: 0, maxLength: 256 },
    password: { minLength: 0, maxLength: 256 },
    capes: { maxItems: 30, itemMinLength: 1, itemMaxLength: 64 },
    notes: { minLength: 0, maxLength: 500 },
  },
} as const;

export const DEFAULT_RANK_PRESETS: string[] = [
  'Unranked',
  'VIP',
  'VIP+',
  'MVP',
  'MVP+',
  'MVP++',
  'YouTube',
  'Legend',
  'Immortal',
];

export interface ValidationErrors {
  accountName?: string;
  rank?: string;
  email?: string;
  secondaryEmail?: string;
  recoveryCode?: string;
  secretKey?: string;
  password?: string;
  capes?: string;
  notes?: string;
}

export function sanitizeAccountPayload(
  values: AccountFormValues,
  ownerId: string
): Omit<AccountFormValues, never> & { ownerId: string } {
  const c = BLUEPRINT_CONSTRAINTS.MinecraftAccount;
  const accountType = c.accountType.includes(values.accountType) ? values.accountType : 'MFA';
  const status = c.status.includes(values.status) ? values.status : 'available';
  const cleanCapes = Array.from(
    new Set(
      (values.capes || [])
        .map((cape) => cape.trim().slice(0, c.capes.itemMaxLength))
        .filter((cape) => cape.length >= c.capes.itemMinLength)
    )
  ).slice(0, c.capes.maxItems);

  return {
    ownerId: ownerId.slice(0, c.ownerId.maxLength),
    accountName: values.accountName.trim().slice(0, c.accountName.maxLength),
    rank: values.rank.trim().slice(0, c.rank.maxLength),
    accountType,
    status,
    email: values.email.trim().slice(0, c.email.maxLength),
    secondaryEmail: values.secondaryEmail.trim().slice(0, c.secondaryEmail.maxLength),
    recoveryCode: values.recoveryCode.trim().slice(0, c.recoveryCode.maxLength),
    secretKey: values.secretKey.trim().slice(0, c.secretKey.maxLength),
    password: values.password.slice(0, c.password.maxLength),
    capes: cleanCapes,
    notes: values.notes.trim().slice(0, c.notes.maxLength),
  };
}

export function validateAccountForm(values: AccountFormValues): ValidationErrors {
  const errors: ValidationErrors = {};
  const c = BLUEPRINT_CONSTRAINTS.MinecraftAccount;

  const accountName = values.accountName.trim();
  if (accountName.length < c.accountName.minLength) {
    errors.accountName = 'Account name (IGN) is required.';
  } else if (accountName.length > c.accountName.maxLength) {
    errors.accountName = `Maximum ${c.accountName.maxLength} characters allowed.`;
  } else if (!c.accountName.pattern.test(accountName)) {
    errors.accountName = 'Use only letters, numbers, underscores, hyphens, dots, or spaces.';
  }

  const rank = values.rank.trim();
  if (rank.length < c.rank.minLength) {
    errors.rank = 'Rank is required for filtering.';
  } else if (rank.length > c.rank.maxLength) {
    errors.rank = `Rank must be ${c.rank.maxLength} characters or fewer.`;
  }

  const email = values.email.trim();
  if (email.length < c.email.minLength) {
    errors.email = 'Primary email must be at least 3 characters.';
  } else if (email.length > c.email.maxLength) {
    errors.email = `Email must be ${c.email.maxLength} characters or fewer.`;
  }

  const secondaryEmail = values.secondaryEmail.trim();
  if (secondaryEmail.length > c.secondaryEmail.maxLength) {
    errors.secondaryEmail = `Secondary email must be ${c.secondaryEmail.maxLength} characters or fewer.`;
  }

  const recoveryCode = values.recoveryCode.trim();
  if (recoveryCode.length > c.recoveryCode.maxLength) {
    errors.recoveryCode = `Recovery code must be ${c.recoveryCode.maxLength} characters or fewer.`;
  }

  const secretKey = values.secretKey.trim();
  if (secretKey.length > c.secretKey.maxLength) {
    errors.secretKey = `Secret key must be ${c.secretKey.maxLength} characters or fewer.`;
  }

  if (values.password.length > c.password.maxLength) {
    errors.password = `Password must be ${c.password.maxLength} characters or fewer.`;
  }

  if ((values.capes || []).length > c.capes.maxItems) {
    errors.capes = `Maximum ${c.capes.maxItems} capes allowed per account.`;
  }

  const notes = values.notes.trim();
  if (notes.length > c.notes.maxLength) {
    errors.notes = `Notes must be ${c.notes.maxLength} characters or fewer.`;
  }

  return errors;
}

export function sanitizeWorkspaceSettings(
  workspaceName: string,
  displayName: string,
  customRanks: string[]
) {
  const c = BLUEPRINT_CONSTRAINTS.UserWorkspace;
  const cleanRanks = Array.from(
    new Set(
      customRanks
        .map((r) => r.trim().slice(0, c.customRanks.itemMaxLength))
        .filter((r) => r.length >= c.customRanks.itemMinLength)
    )
  ).slice(0, c.customRanks.maxItems);

  return {
    workspaceName: (workspaceName.trim() || 'Primary Vault').slice(0, c.workspaceName.maxLength),
    displayName: (displayName.trim() || 'Account Manager').slice(0, c.displayName.maxLength),
    customRanks: cleanRanks,
  };
}
