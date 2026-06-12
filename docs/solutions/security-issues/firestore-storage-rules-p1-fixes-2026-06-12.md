---
title: Storage Delete Rule Enables Rollback; Storage Read Scoped to Owner
date: 2026-06-12
category: docs/solutions/security-issues/
module: useExpenses, storage.rules
problem_type: security_issue
component: storage_rules, expense_creation
severity: high
symptoms:
  - upload failure leaves phantom expense doc with empty receiptStoragePath
  - caller receives permission-denied from deleteDoc instead of the original upload error
  - any org member can read another member's receipt files in Storage
root_cause: missing_delete_rule, overly_permissive_read_rule
resolution_type: code_fix
tags:
  - firebase
  - storage-rules
  - firestore-rules
  - rollback
  - cleanup
  - receipt
  - security
---

# Storage Delete Rule Enables Rollback; Storage Read Scoped to Owner

## Problem 1 — P1-C rollback was a no-op

`addExpense` in `useExpenses.ts` creates the Firestore doc first (`addDoc`), then uploads to
Storage, then calls `updateDoc` with the receipt path. On upload failure the catch block calls
`deleteDoc(docRef)` to clean up the phantom doc.

`firestore.rules` had `allow delete: if false` on the expenses collection. Client-side
`deleteDoc` therefore threw `permission-denied` immediately, before `uploadErr` was re-thrown.
Result: the phantom doc survived every upload failure and the caller received the wrong error code.

## Problem 2 — Storage read exposed all org receipts to any member

`storage.rules` read rule was:

```
allow read: if request.auth != null && request.auth.token.orgId == orgId;
```

No uid ownership check. Any authenticated org member could read any other member's receipt files.
The plan specifies employees should only see their own expenses; the storage read rule violated
that boundary.

## Fix

### firestore.rules — narrow delete for draft docs only

```diff
-        allow delete: if false;
+        // Narrow delete: only for draft docs (no storage path yet) by the submitter.
+        // Enables client-side rollback when the storage upload fails after addDoc.
+        allow delete: if isMember(orgId)
+                      && resource.data.submittedBy == request.auth.uid
+                      && resource.data.receiptStoragePath == '';
```

Scoped to `receiptStoragePath == ''` so only the transient stub doc can be deleted by its
submitter. Docs with a real path are immutable from the client.

### storage.rules — add uid ownership to read

```diff
-      allow read: if request.auth != null
-                  && request.auth.token.orgId == orgId;
+      allow read: if request.auth != null
+                  && request.auth.token.orgId == orgId
+                  && (request.auth.token.role == 'admin'
+                      || request.auth.uid == uid);
```

Admins can read all org receipts; employees can only read files under their own uid path segment.

## Why These Work

The delete rule is gated on the stub state (`receiptStoragePath == ''`). Once `updateDoc` writes
the real path, the doc is no longer deletable by the client — accidental or malicious delete is
blocked. The storage path is `orgs/{orgId}/receipts/{uid}/{expenseId}/{filename}` so
`request.auth.uid == uid` correctly maps the authenticated user to their segment.

## Prevention

1. Whenever a write-then-cleanup pattern is added (doc-first, rollback-on-failure), audit the
   security rules for the document type to confirm `delete` is permitted in the cleanup scenario.
   Unit tests mock Firestore and will not catch rule mismatches — add a
   `@firebase/rules-unit-testing` integration test for the delete path.

2. Storage read rules should mirror the Firestore read-visibility contract. If Firestore scopes
   employee reads to `submittedBy == request.auth.uid`, the storage rule for the same data
   should enforce the same boundary.

## Open Gaps

- No integration test (`@firebase/rules-unit-testing`) for the expense delete path exists.
  The unit test mocks `deleteDoc` — it passes regardless of rules. Add an emulator test that
  asserts `deleteDoc` succeeds for stub docs and fails for docs with a real path.
- No storage test for the 15 MB size cap or `image/.*` content-type restriction.
- `updateDoc` failure after a successful upload is unhandled — leaves expense with empty
  `receiptStoragePath` and an unreferenced Storage file. A periodic sweep or explicit
  `status: 'failed'` update on `updateDoc` error would close this.
