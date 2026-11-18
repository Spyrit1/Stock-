import { Timestamp } from 'firebase/firestore';

export type AccountType = 'MFA' | 'SFA' | 'NFA' | 'Cape' | 'OG';
export type AccountStatus = 'available' | 'reserved' | 'sold' | 'locked';

export interface UserWorkspace {
  uid: string;
  email: string;
  displayName: string;
  workspaceName: string;
  customRanks: string[];
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface AdminGrant {
  uid: string;
  email: string;
  grantedBy: string;
  createdAt: Timestamp | null;
}

export interface SuspendedUser {
  uid: string;
  email: string;
  suspendedBy: string;
  createdAt: Timestamp | null;
}

export interface MinecraftAccount {
  id: string;
  ownerId: string;
  accountName: string;
  rank: string;
  accountType: AccountType;
  status: AccountStatus;
  email: string;
  secondaryEmail: string;
  recoveryCode: string;
  secretKey: string;
  password: string;
  capes: string[];
  notes: string;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface AccountFormValues {
  accountName: string;
  rank: string;
  accountType: AccountType;
  status: AccountStatus;
  email: string;
  secondaryEmail: string;
  recoveryCode: string;
  secretKey: string;
  password: string;
  capes: string[];
  notes: string;
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}
