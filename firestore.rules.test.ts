/**
 * Security Rule Verification Matrix (Dirty Dozen Payload Suite)
 * Validates that every adversarial payload violates at least one enforced rule invariant.
 */

export interface DirtyDozenCase {
  id: number;
  name: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  path: string;
  actorUid: string;
  emailVerified: boolean;
  payload?: Record<string, unknown>;
  expectedResult: 'PERMISSION_DENIED';
  enforcedBy: string;
}

export const DIRTY_DOZEN_CASES: DirtyDozenCase[] = [
  {
    id: 1,
    name: 'Cross-Tenant Account Read',
    operation: 'get',
    path: '/users/userA/accounts/acc1',
    actorUid: 'userB',
    emailVerified: true,
    expectedResult: 'PERMISSION_DENIED',
    enforcedBy: 'userId == request.auth.uid && existing().ownerId == request.auth.uid',
  },
  {
    id: 2,
    name: 'Cross-Tenant Account List',
    operation: 'list',
    path: '/users/userA/accounts',
    actorUid: 'userB',
    emailVerified: true,
    expectedResult: 'PERMISSION_DENIED',
    enforcedBy: 'userId == request.auth.uid && resource.data.ownerId == request.auth.uid',
  },
  {
    id: 3,
    name: 'Unverified Email Write',
    operation: 'create',
    path: '/users/userA/accounts/acc1',
    actorUid: 'userA',
    emailVerified: false,
    payload: { ownerId: 'userA', accountName: 'Steve', rank: 'MVP+' },
    expectedResult: 'PERMISSION_DENIED',
    enforcedBy: 'isVerified() checks request.auth.token.email_verified == true',
  },
  {
    id: 4,
    name: 'Identity Spoofing on Create',
    operation: 'create',
    path: '/users/userB/accounts/acc1',
    actorUid: 'userB',
    emailVerified: true,
    payload: { ownerId: 'userA', accountName: 'Steve', rank: 'MVP+' },
    expectedResult: 'PERMISSION_DENIED',
    enforcedBy: 'incoming().ownerId == request.auth.uid',
  },
  {
    id: 5,
    name: 'Shadow Field Injection',
    operation: 'create',
    path: '/users/userA/accounts/acc1',
    actorUid: 'userA',
    emailVerified: true,
    payload: { ownerId: 'userA', accountName: 'Steve', isAdmin: true },
    expectedResult: 'PERMISSION_DENIED',
    enforcedBy: 'data.keys().hasOnly([...]) inside isValidMinecraftAccount()',
  },
  {
    id: 6,
    name: 'ID Poisoning',
    operation: 'create',
    path: '/users/userA/accounts/bad$id*!',
    actorUid: 'userA',
    emailVerified: true,
    payload: { ownerId: 'userA', accountName: 'Steve' },
    expectedResult: 'PERMISSION_DENIED',
    enforcedBy: 'isValidId(accountId)',
  },
  {
    id: 7,
    name: 'Timestamp Forgery on Create',
    operation: 'create',
    path: '/users/userA/accounts/acc1',
    actorUid: 'userA',
    emailVerified: true,
    payload: { ownerId: 'userA', createdAt: '2020-01-01T00:00:00Z' },
    expectedResult: 'PERMISSION_DENIED',
    enforcedBy: 'incoming().createdAt == request.time && incoming().updatedAt == request.time',
  },
  {
    id: 8,
    name: 'Immortal Field Mutation on Update',
    operation: 'update',
    path: '/users/userA/accounts/acc1',
    actorUid: 'userA',
    emailVerified: true,
    payload: { ownerId: 'userB', createdAt: '2020-01-01T00:00:00Z' },
    expectedResult: 'PERMISSION_DENIED',
    enforcedBy: 'incoming().ownerId == existing().ownerId && incoming().createdAt == existing().createdAt && affectedKeys().hasOnly(...)',
  },
  {
    id: 9,
    name: 'Value Poisoning on Status Enum',
    operation: 'update',
    path: '/users/userA/accounts/acc1',
    actorUid: 'userA',
    emailVerified: true,
    payload: { status: 'bypassed' },
    expectedResult: 'PERMISSION_DENIED',
    enforcedBy: "data.status in ['available', 'reserved', 'sold', 'locked']",
  },
  {
    id: 10,
    name: 'Denial-of-Wallet Oversized String',
    operation: 'update',
    path: '/users/userA/accounts/acc1',
    actorUid: 'userA',
    emailVerified: true,
    payload: { notes: 'x'.repeat(2000) },
    expectedResult: 'PERMISSION_DENIED',
    enforcedBy: 'data.notes is string && data.notes.size() <= 500',
  },
  {
    id: 11,
    name: 'Unbounded Array Attack on customRanks',
    operation: 'update',
    path: '/users/userA',
    actorUid: 'userA',
    emailVerified: true,
    payload: { customRanks: Array.from({ length: 25 }, (_, i) => `Rank${i}`) },
    expectedResult: 'PERMISSION_DENIED',
    enforcedBy: 'data.customRanks is list && data.customRanks.size() <= 20',
  },
  {
    id: 12,
    name: 'Non-Admin Blanket Users Collection List',
    operation: 'list',
    path: '/users',
    actorUid: 'userA',
    emailVerified: true,
    expectedResult: 'PERMISSION_DENIED',
    enforcedBy: 'allow list: if isAdmin() (strictly requires email_verified == true && email == iamspyrit@gmail.com)',
  },
];
