---
title: Employee Cannot Update receiptStoragePath on Own Expense
date: 2026-06-13
category: docs/solutions/security-issues/
module: addExpense / firestore.rules
problem_type: security_issue
component: expenses
severity: medium
symptoms:
  - Employee-submitted expense with receipt photo shows "Error al guardar el gasto" in the form
  - The expense document still appears in Firestore with `receiptStoragePath: ''`
  - The receipt image still appears in Cloud Storage
  - No visible network error (the form's generic catch block swallows it)
  - Admin submitters are not affected
root_cause: rule_too_narrow
resolution_type: code_fix
tags:
  - firebase
  - firestore-rules
  - expenses
  - receipts
  - employee-role
  - pre-existing
---

## Context

Discovered 2026-06-13 while smoke-testing the new `paymentSource` feature locally. The submitter's flow in `src/hooks/useExpenses.ts:43-83` does:

1. `addDoc` (allowed: `allow create: if isMember(orgId) ...`)
2. `uploadBytesResumable` to `orgs/{orgId}/receipts/{uid}/{expenseId}/{filename}` (allowed: storage rule matches submitter's `uid`)
3. `updateDoc(docRef, { receiptStoragePath: storagePath })` — **denied for non-admins**

The third step is the failure point. The rule at `firestore.rules:66` is:

```
allow update: if isAdmin(orgId);
```

This rule has been in place since the original data-model commit (`42165d9 feat(data-model): U2`). It is a pre-existing condition, not a regression from the `paymentSource` PR. The new PR's `paymentSource` enum check is added to `allow create` only and does not touch `allow update`.

## Why It Surfaced Now

- The original unit test suite uses the admin role for the submitter, so the rule passes and the `updateDoc` succeeds — tests are green.
- The author's local smoke test of the `paymentSource` PR used the admin2@xpns.local user (also admin), so the update succeeded and the dashboard rendered correctly.
- An employee submitter trips the bug on every photo upload. The error message is generic and the form's catch block does not surface the underlying `permission-denied`, so the user sees a confusing "saved successfully" state in Firestore/Storage but a "failed" message in the UI.

## Reproduction (employee role)

1. Sign in as the registered employee (created via Invite flow).
2. Navigate to `/dashboard/expenses/new`.
3. Fill all fields, attach a receipt photo, click "Guardar gasto".
4. Form shows "Error al guardar el gasto. Intenta de nuevo."
5. Open Emulator UI at `http://localhost:4000/firestore` → expense doc exists with `receiptStoragePath: ''`.
6. Open Emulator UI → Storage → receipt file exists at the expected path.
7. Browser DevTools → Network → the `Write` request for the second Firestore call returns `403 PERMISSION_DENIED` (silently consumed by the form's catch).

## Proposed Fix (out of scope for the current `paymentSource` PR)

Narrow `allow update` to also permit the submitter to patch only `receiptStoragePath` on a doc they own. `firestore.rules`:

```
allow update: if isAdmin(orgId)
              || (isMember(orgId)
                  && resource.data.submittedBy == request.auth.uid
                  && request.resource.data.diff(resource.data).affectedKeys()
                       .hasOnly(['receiptStoragePath']));
```

`affectedKeys().hasOnly([...])` is the standard idiom for "this update may only touch these fields." It blocks the employee from editing other fields (amount, status, etc.) even on their own doc, preserving the existing admin-only mutation surface.

## Companion Tests

Add to `src/tests/rules/firestore.test.ts` in a new `describe('expenses — employee update of receiptStoragePath', ...)` block:

- `assertSucceeds` for an employee setting `receiptStoragePath` on a doc they own.
- `assertFails` for an employee attempting to change `status` on a doc they own.
- `assertFails` for an employee attempting to change `amount` on a doc they own.
- `assertFails` for an employee attempting to change `receiptStoragePath` on a doc owned by a different user.

## Why Deferred

The `paymentSource` PR's plan ("2026-06-13-001-feat-expense-payment-source-plan.md") explicitly carried this as a do-not-fix-in-branch item, in line with the "do not fix pre-existing issues, don't make them worse" rule. The fix is a 1-line rules change plus 4 tests, low risk, and should land before employee onboarding — employees are not onboardable today because every photo upload fails for them.
