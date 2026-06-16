---
title: Firestore Transaction Closes TOCTOU Race in Invite Redemption
date: 2026-06-11
category: docs/solutions/security-issues/
module: processInvite
problem_type: security_issue
component: authentication
severity: critical
symptoms:
  - concurrent invite redemptions both pass usedAt check and both receive org claims
  - single invite link redeemable multiple times under race condition
  - partial-failure plus retry grants duplicate claims without idempotency guard
root_cause: thread_violation
resolution_type: code_fix
tags:
  - firebase
  - cloud-functions
  - firestore
  - toctou
  - race-condition
  - transaction
  - idempotency
  - invite
---

# Firestore Transaction Closes TOCTOU Race in Invite Redemption

## Problem

`processInvite` checked `invite.usedAt` and then updated it in two separate Firestore operations. Concurrent requests could both pass the null check before either write committed, resulting in double-redemption of a single invite token — both callers received org custom claims.

## Symptoms

- Two simultaneous requests with the same token both return success
- Both users receive `orgId` custom claims and gain org access
- `usedAt` is written twice (last-write-wins); no error thrown
- Silent data corruption — no observable failure in logs

## What Didn't Work

Application-level guard (`if (invite.usedAt) throw`) is correct logic in isolation but not ACID. The read (`inviteRef.get()`) and write (`inviteRef.update()`) are separate Firestore RPCs with no isolation guarantee between concurrent callers. Two inflight requests interleave: both read `usedAt: null`, both proceed past the guard, both write claims.

## Solution

Wrap the read-check-mark sequence in `db.runTransaction()`. Set claims only after the transaction commits.

```typescript
// BEFORE — two separate operations, no isolation:
const inviteSnap = await inviteRef.get();
const invite = inviteSnap.data()!;
if (invite['usedAt']) throw new HttpsError('already-exists', 'Invite already used');
await inviteRef.update({ usedAt: FieldValue.serverTimestamp(), usedBy: uid });
await auth.setCustomUserClaims(uid, { orgId: input.orgId, role: 'employee' });

// AFTER — single transaction, external side-effect after commit:
await db.runTransaction(async (txn) => {
  const inviteSnap = await txn.get(inviteRef);
  const invite = inviteSnap.data()!;
  if (invite['usedAt']) throw new HttpsError('already-exists', 'Invite already used');
  txn.update(inviteRef, { usedAt: FieldValue.serverTimestamp(), usedBy: uid });
});
await auth.setCustomUserClaims(uid, { orgId: input.orgId, role: 'employee' });
```

Idempotency guard at function entry covers crash-between-commit-and-claims:

```typescript
const existingUser = await auth.getUser(uid);
if (existingUser.customClaims?.['orgId'] === input.orgId) {
  return { orgId: input.orgId }; // already processed — safe retry
}
```

The same idempotency pattern is applied to `setOrgClaims` to reject users already belonging to an org (pre-transaction check on the caller's own Auth record).

## Why This Works

Firestore transactions use optimistic concurrency. When two transactions read the same document concurrently, Firestore detects the conflict on commit and aborts one, retrying it up to 5 times. On retry, the second transaction reads `usedAt` as already set and throws `already-exists` — only one caller advances past the transaction. Failing all 5 retries propagates an error (fails closed — no double-redemption).

Because `setCustomUserClaims` runs after `runTransaction` returns, the external side-effect (Auth claim write) happens exactly once. The idempotency guard covers the failure window between a successful transaction commit and a failed claims write: the retrying caller finds its claims already match and exits early without re-running the transaction.

## Prevention

1. Any read-then-write sequence that must be atomic requires a Firestore transaction or a conditional write with a precondition. Never rely on application-level checks across two separate RPCs for security-critical state.

2. Claims writes are not transactional with Firestore — always commit state changes first, then propagate to external systems (Auth, queues). Add an idempotency guard for any step that follows a non-atomic boundary.

3. When adding a new call to a mocked dependency in production code, audit all test files that mock that module and extend the mock surface immediately. The `firebase-admin/auth` mock initially lacked `getUser`, causing 10 test failures with `auth.getUser is not a function` after the idempotency guard was added.

4. Add an integration test using two concurrent requests with the same token and assert only one succeeds — this class of race is invisible to sequential unit tests.

5. **Open gap — member doc write is outside the transaction and not covered by the idempotency guard.** After `setCustomUserClaims`, `processInvite` writes `orgs/{orgId}/members/{uid}`. If the function crashes between the claims write and the member write, a retry hits the early-return (claims already match) and skips the member write — leaving the user with valid claims but no member document. Fix: check `memberRef` existence in the idempotency guard, or use `memberRef.set(..., { merge: true })` and always run it (idempotent by nature of `set`).

## Related Issues

- **P1-E (open):** `input.orgId` from the client payload is used for both the Firestore lookup path and the claims value. Firestore's not-found error implicitly rejects mismatches, but this is not an explicit trust boundary. Reading `orgId` from the validated invite doc itself after the transaction would eliminate the client-controlled parameter.
- `to-fix.md` in repo root tracks both items above.
