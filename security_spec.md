# Security Specification — BlockVault Stock

## 1. Data Invariants
1. **Strict Stock Space Isolation & Verified Admin Access**: Every user's profile (`/users/{userId}`) and Minecraft account inventory (`/users/{userId}/accounts/{accountId}`) contains sensitive PII and account credentials (`email`, `secondaryEmail`, `recoveryCode`, `secretKey`). Only the authenticated, email-verified owner (`request.auth.uid == userId`) or the verified bootstrapped account admin (`request.auth.token.email == 'iamspyrit@gmail.com' && request.auth.token.email_verified == true`) may read, list, create, update, or delete records in that stock space.
2. **Master Gate Integrity**: A `MinecraftAccount` document under `/users/{userId}/accounts/{accountId}` cannot be created unless the parent `/users/{userId}` workspace document already exists (`exists(...)`), and `incoming().ownerId == userId`.
3. **Immutable Ownership & Temporal Integrity**: `uid`, `ownerId`, and `createdAt` are immutable after creation. On `create`, `createdAt == request.time` and `updatedAt == request.time`. On `update`, `updatedAt == request.time`.
4. **Zero-Shadow-Field Schema**: Both `UserWorkspace` and `MinecraftAccount` validate exact key sets (`hasAll` + `hasOnly`), data types, enum values, regex patterns, and bounded string/array lengths. No user may self-assign `role` or `isAdmin` fields.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Cross-Tenant Read**: User B attempts `get` on `/users/userA/accounts/acc1` -> `PERMISSION_DENIED`.
2. **Cross-Tenant List Scraping**: User B attempts `list` on `/users/userA/accounts` -> `PERMISSION_DENIED`.
3. **Unverified Email Write**: User A with `email_verified: false` attempts to create a `MinecraftAccount` -> `PERMISSION_DENIED`.
4. **Identity Spoofing on Create**: User B attempts to create `/users/userB/accounts/acc1` with `ownerId: "userA"` -> `PERMISSION_DENIED`.
5. **Shadow / Ghost Field Injection**: User A creates a `MinecraftAccount` containing extra field `isAdmin: true` or `verified: true` -> `PERMISSION_DENIED`.
6. **ID Poisoning**: User A writes to `/users/userA/accounts/invalid$id*with*bad*chars` or >128 char ID -> `PERMISSION_DENIED`.
7. **Timestamp Forgery (Create)**: User A creates a `MinecraftAccount` with a backdated client timestamp `createdAt` instead of `request.time` -> `PERMISSION_DENIED`.
8. **Immortal Field Mutation (Update)**: User A attempts to change `ownerId` or `createdAt` during an `update` -> `PERMISSION_DENIED`.
9. **Value Poisoning on Enum**: User A updates `status` to `"hacked"` or `accountType` to `"ADMIN"` -> `PERMISSION_DENIED`.
10. **Denial-of-Wallet Oversized String**: User A injects a 10,000-char string into `secretKey` or `notes` -> `PERMISSION_DENIED`.
11. **Unbounded Array Attack**: User A updates `customRanks` with 25 items (exceeds `<= 20` cap) -> `PERMISSION_DENIED`.
12. **Blanket Users List Scraping**: User A attempts `list` on `/users` to enumerate other users' emails -> `PERMISSION_DENIED`.
