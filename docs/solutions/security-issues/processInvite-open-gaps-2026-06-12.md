---
title: processInvite — Three Open P1 Gaps After 2026-06-12 Review
date: 2026-06-12
category: docs/solutions/security-issues/
module: processInvite
problem_type: correctness_issue
component: authentication
severity: high
symptoms:
  - user with valid JWT claims has no member doc (invisible to admin, access denied by isMember rule)
  - pre-fix invites (no orgId field) still allow client-controlled orgId in claims
  - retry after partial failure returns early without completing member doc creation
root_cause: partial_transaction_boundary, missing_idempotency_scope, missing_field_assertion
resolution_type: pending
tags:
  - firebase
  - cloud-functions
  - firestore
  - invite
  - claims
  - idempotency
  - half-state
---

# processInvite — Three Open P1 Gaps After 2026-06-12 Review

These issues were identified in the 2026-06-12 code review of `feat/data-model-security-rules`.
The P1-E fix (reading `orgId` from the invite doc) is correct for new invites. Three gaps remain.

## Gap 1 — `memberRef.set` outside the transaction (Finding #4)

**File:** `functions/src/processInvite.ts:70`

After the Firestore transaction commits and `setCustomUserClaims` succeeds, `memberRef.set` runs
with no try/catch and no retry path:

```typescript
await auth.setCustomUserClaims(uid, { orgId: authorizedOrgId, role: 'employee' });

const memberRef = db.doc(`orgs/${authorizedOrgId}/members/${uid}`);
await memberRef.set({ ... });  // no error handling
```

If the function times out or Firestore returns a transient error between these two lines:
- User has valid JWT claims and can authenticate
- `usedAt` is set — invite is burned
- Member doc is never written — `isMember()` Firestore rule returns false for their requests
- Admin employee filter never shows them

**Fix:** Use `memberRef.set({ ..., }, { merge: true })` unconditionally and add it to the
idempotency guard, OR move the member write inside the transaction (safe since `set` is
idempotent — no conditional read required).

## Gap 2 — Idempotency guard compares against `input.orgId` (Finding #2)

**File:** `functions/src/processInvite.ts:24`

```typescript
if (existingUser.customClaims?.['orgId'] === input.orgId) {
  return { orgId: input.orgId };
}
```

`input.orgId` is client-controlled. If a prior run set claims to `org-from-doc` (from the
invite doc, which may differ from `input.orgId`) and then crashed before writing the member doc,
a retry with `input.orgId = 'org-from-doc'` finds `customClaims.orgId === input.orgId` true and
returns early — without creating the missing member doc.

**Fix:** Change the early-return body to also check `memberRef` existence and create it if
absent:

```typescript
const existingUser = await auth.getUser(uid);
const existingOrgId = existingUser.customClaims?.['orgId'];
if (existingOrgId) {
  const memberSnap = await db.doc(`orgs/${existingOrgId}/members/${uid}`).get();
  if (!memberSnap.exists) {
    await db.doc(`orgs/${existingOrgId}/members/${uid}`).set({
      email, displayName: email.split('@')[0], role: 'employee',
      status: 'active', createdAt: FieldValue.serverTimestamp(),
    });
  }
  return { orgId: existingOrgId };
}
```

## Gap 3 — `authorizedOrgId` falls back to `input.orgId` for pre-fix invites (Finding #3)

**File:** `functions/src/processInvite.ts:31`

```typescript
let authorizedOrgId = input.orgId;  // client-controlled default

// ... transaction ...
if (invite['orgId']) {
  authorizedOrgId = invite['orgId'] as string;
}
```

All invites created before the P1-E fix (i.e., before `InviteForm` started writing `orgId` to
the doc) lack the field. For those invites, `authorizedOrgId` stays as `input.orgId`. The P1-E
fix is therefore bypassed for all pre-existing invite docs.

**Fix options:**
1. Hard-assert: `if (!invite['orgId']) throw new HttpsError('internal', 'Invite missing orgId field')` — forces a backfill before any old tokens can be redeemed.
2. Backfill: write a one-time migration that adds `orgId` to all existing invite docs before deploying this function version.
3. Derive from path: since `inviteRef = orgs/${input.orgId}/invites/${token}`, the orgId is
   implicitly encoded in the path. Could use `inviteRef.parent.parent.id` as the authoritative
   value instead of either `input.orgId` or `invite['orgId']`.

Option 3 is the most robust — no backfill needed, no field dependency, always reads from the
doc's actual Firestore path:

```typescript
const authorizedOrgId = inviteRef.parent.parent!.id;
```

## Related

- See `processInvite-toctou-firestore-transaction.md` — previous round identified gaps 1 and 2
  as open items. This doc formalizes the fix approaches.
- Gap 3 is new (consequence of InviteForm not writing `orgId` before this PR).
