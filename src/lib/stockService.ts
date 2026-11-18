import { User } from 'firebase/auth';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Unsubscribe,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db, handleFirestoreError } from './firebase';
import {
  BLUEPRINT_CONSTRAINTS,
  sanitizeAccountPayload,
  sanitizeWorkspaceSettings,
} from './validation';
import {
  AccountFormValues,
  AccountStatus,
  AdminGrant,
  MinecraftAccount,
  OperationType,
  SuspendedUser,
  UserWorkspace,
} from '../types/stock';

export async function ensureUserWorkspace(user: User): Promise<UserWorkspace> {
  const path = `users/${user.uid}`;
  const ref = doc(db, 'users', user.uid);

  let snap;
  try {
    snap = await getDoc(ref);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }

  if (snap.exists()) {
    return snap.data() as UserWorkspace;
  }

  const c = BLUEPRINT_CONSTRAINTS.UserWorkspace;
  const email = (user.email || 'user@vault.local').slice(0, c.email.maxLength);
  const displayName = (user.displayName || email.split('@')[0] || 'Vault Owner').slice(
    0,
    c.displayName.maxLength
  );

  const initialWorkspace = {
    uid: user.uid,
    email,
    displayName,
    workspaceName: 'Primary Stock Space',
    customRanks: [] as string[],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    await setDoc(ref, initialWorkspace);
    const createdSnap = await getDoc(ref);
    if (createdSnap.exists()) {
      return createdSnap.data() as UserWorkspace;
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }

  return {
    uid: user.uid,
    email,
    displayName,
    workspaceName: 'Primary Stock Space',
    customRanks: [],
    createdAt: null,
    updatedAt: null,
  };
}

export function subscribeToUserWorkspace(
  uid: string,
  onData: (workspace: UserWorkspace | null) => void,
  onError: (err: Error) => void
): Unsubscribe {
  const path = `users/${uid}`;
  const ref = doc(db, 'users', uid);

  return onSnapshot(
    ref,
    (snapshot) => {
      if (snapshot.exists()) {
        onData(snapshot.data() as UserWorkspace);
      } else {
        onData(null);
      }
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.GET, path);
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );
}

export function subscribeToAllWorkspaces(
  onData: (workspaces: UserWorkspace[]) => void,
  onError: (err: Error) => void
): Unsubscribe {
  const path = 'users';
  return onSnapshot(
    collection(db, 'users'),
    (snapshot) => {
      const list: UserWorkspace[] = snapshot.docs.map((d) => d.data() as UserWorkspace);
      list.sort((a, b) => a.email.localeCompare(b.email));
      onData(list);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );
}

export async function updateWorkspaceSettings(
  uid: string,
  workspaceName: string,
  displayName: string,
  customRanks: string[]
): Promise<void> {
  const path = `users/${uid}`;
  const sanitized = sanitizeWorkspaceSettings(workspaceName, displayName, customRanks);

  try {
    await updateDoc(doc(db, 'users', uid), {
      workspaceName: sanitized.workspaceName,
      displayName: sanitized.displayName,
      customRanks: sanitized.customRanks,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export function subscribeToAccounts(
  uid: string,
  onData: (accounts: MinecraftAccount[]) => void,
  onError: (err: Error) => void
): Unsubscribe {
  const path = `users/${uid}/accounts`;
  const accountsQuery = query(collection(db, 'users', uid, 'accounts'), where('ownerId', '==', uid));

  return onSnapshot(
    accountsQuery,
    (snapshot) => {
      const items: MinecraftAccount[] = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          ownerId: String(data.ownerId ?? uid),
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
        };
      });

      items.sort((a, b) => {
        const aSec = a.updatedAt?.seconds ?? 0;
        const bSec = b.updatedAt?.seconds ?? 0;
        return bSec - aSec;
      });

      onData(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );
}

export async function createAccount(uid: string, values: AccountFormValues): Promise<string> {
  const path = `users/${uid}/accounts`;
  const payload = sanitizeAccountPayload(values, uid);

  try {
    const docRef = await addDoc(collection(db, 'users', uid, 'accounts'), {
      ...payload,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateAccount(
  uid: string,
  accountId: string,
  values: AccountFormValues
): Promise<void> {
  const path = `users/${uid}/accounts/${accountId}`;
  const payload = sanitizeAccountPayload(values, uid);

  try {
    await updateDoc(doc(db, 'users', uid, 'accounts', accountId), {
      accountName: payload.accountName,
      rank: payload.rank,
      accountType: payload.accountType,
      status: payload.status,
      email: payload.email,
      secondaryEmail: payload.secondaryEmail,
      recoveryCode: payload.recoveryCode,
      secretKey: payload.secretKey,
      password: payload.password,
      capes: payload.capes,
      notes: payload.notes,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateAccountStatus(
  uid: string,
  accountId: string,
  status: AccountStatus
): Promise<void> {
  const path = `users/${uid}/accounts/${accountId}`;
  const validStatus = BLUEPRINT_CONSTRAINTS.MinecraftAccount.status.includes(status)
    ? status
    : 'available';

  try {
    await updateDoc(doc(db, 'users', uid, 'accounts', accountId), {
      status: validStatus,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteAccount(uid: string, accountId: string): Promise<void> {
  const path = `users/${uid}/accounts/${accountId}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'accounts', accountId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function checkUserAdminGrant(uid: string): Promise<boolean> {
  const path = `admins/${uid}`;
  try {
    const snap = await getDoc(doc(db, 'admins', uid));
    return snap.exists();
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function checkUserSuspended(uid: string): Promise<boolean> {
  const path = `suspended_users/${uid}`;
  try {
    const snap = await getDoc(doc(db, 'suspended_users', uid));
    return snap.exists();
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export function subscribeToAdminGrants(
  onData: (grants: Record<string, AdminGrant>) => void,
  onError: (err: Error) => void
): Unsubscribe {
  const path = 'admins';
  return onSnapshot(
    collection(db, 'admins'),
    (snapshot) => {
      const map: Record<string, AdminGrant> = {};
      snapshot.docs.forEach((d) => {
        map[d.id] = d.data() as AdminGrant;
      });
      onData(map);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );
}

export function subscribeToSuspendedUsers(
  onData: (suspended: Record<string, SuspendedUser>) => void,
  onError: (err: Error) => void
): Unsubscribe {
  const path = 'suspended_users';
  return onSnapshot(
    collection(db, 'suspended_users'),
    (snapshot) => {
      const map: Record<string, SuspendedUser> = {};
      snapshot.docs.forEach((d) => {
        map[d.id] = d.data() as SuspendedUser;
      });
      onData(map);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );
}

export async function grantAdminPermission(
  targetUid: string,
  targetEmail: string,
  grantedByUid: string
): Promise<void> {
  const path = `admins/${targetUid}`;
  try {
    await setDoc(doc(db, 'admins', targetUid), {
      uid: targetUid,
      email: targetEmail.slice(0, BLUEPRINT_CONSTRAINTS.UserWorkspace.email.maxLength),
      grantedBy: grantedByUid,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function revokeAdminPermission(targetUid: string): Promise<void> {
  const path = `admins/${targetUid}`;
  try {
    await deleteDoc(doc(db, 'admins', targetUid));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function suspendUserSpace(
  targetUid: string,
  targetEmail: string,
  suspendedByUid: string
): Promise<void> {
  const path = `suspended_users/${targetUid}`;
  try {
    await setDoc(doc(db, 'suspended_users', targetUid), {
      uid: targetUid,
      email: targetEmail.slice(0, BLUEPRINT_CONSTRAINTS.UserWorkspace.email.maxLength),
      suspendedBy: suspendedByUid,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function restoreUserSpace(targetUid: string): Promise<void> {
  const path = `suspended_users/${targetUid}`;
  try {
    await deleteDoc(doc(db, 'suspended_users', targetUid));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function deleteUserSpaceAndAccounts(targetUid: string): Promise<void> {
  const accountsPath = `users/${targetUid}/accounts`;
  let snap;
  try {
    snap = await getDocs(collection(db, 'users', targetUid, 'accounts'));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, accountsPath);
  }

  try {
    const docs = snap.docs;
    for (let i = 0; i < docs.length; i += 400) {
      const batch = writeBatch(db);
      docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
    await deleteDoc(doc(db, 'users', targetUid));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `users/${targetUid}`);
  }
}

