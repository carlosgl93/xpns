# Open findings — xpns code review (2026-06-11)

Branch reviewed: `feat/data-model-security-rules`  
Applied: 3 P0 + 4 P1/P2 fixes. Remaining items below.

---

## P1 — Must fix before prod deploy

### P1-A `src/hooks/useExpenses.ts:8`
`dateFrom` / `dateTo` declared in `ExpenseFilters` but never converted to `where()` clauses.
Date range filter in the admin dashboard is a complete no-op. Needs matching Firestore composite indexes.

### P1-B `storage.rules:14`
No uid-scoped path segment on the receipt write rule.
Any org member can write to `orgs/{orgId}/receipts/{anyUUID}/{anyFilename}` — potentially overwriting another member's receipt. Add `request.auth.uid` to the path or as a write-rule constraint.

### P1-C `src/hooks/useExpenses.ts:58`
Storage orphan on `addDoc` failure.
`uploadBytesResumable` succeeds → `addDoc` throws → receipt file is stored permanently with no expense doc pointing to it. Needs delete-on-failure in `addExpense` or a GCS lifecycle cleanup rule.

### P1-D `AdminDashboard.tsx` + `src/pages/dashboard/expenses/new.astro`
`setInterval` busy-polling on `authLoading` instead of using `@preact/signals` `effect()`.
The current approach leaks on hot-reload and SPA navigation (interval never cleared). Migrate to reactive `effect()` from `@preact/signals`.

### P1-E `functions/src/processInvite.ts`
`input.orgId` from the client payload is used directly in custom claims.
Firestore path validation implicitly rejects wrong orgIds (not-found), but reading `orgId` from the invite doc itself is more defensive and eliminates the parameter-tampering surface.

### P1-F `src/components/auth/JoinForm.tsx`
Firebase Auth account created before invite validation succeeds.
A user with a bad/expired token gets a Firebase Auth UID but no org claims → orphaned auth account. Move Auth account creation to after the Cloud Function confirms the invite.

---

## P1 — Advisory / testing

- **Functions error codes**: tests assert `rejects.toThrow()` but not the `HttpsError` code. A generic exception (e.g., a network crash) would make these pass. Assert `.code === 'already-exists'` etc.
- **Unauthenticated guard untested**: neither `setOrgClaims` nor `processInvite` has a test for the `!request.auth` path in the `onCall` wrapper.
- **Upload failure path untested**: no test covers the case where `uploadBytesResumable` fires the error callback (orphan scenario from P1-C).
- **Stale-claims redirect loop**: user registers → claims not yet propagated → dashboard redirects back to login. Add polling with backoff before redirect.
- **Revoked admin token TTL**: admin revocation takes up to 1 hour to take effect (JWT TTL). `revokeRefreshTokens` must be called to force early invalidation — document in ops runbook.

---

## P2 — Fix if straightforward

| File | Issue |
|---|---|
| `src/lib/firebase.ts` | Verify `getFunctionsClient` passes `region` to `getFunctions(app, region)`. If wrong, all `onCall` invocations fail against `us-central1`. |
| `src/components/dashboard/ExpenseTable.tsx` | Timestamp accessed as `(ts: any).seconds` — use `(ts as Timestamp).toDate()` |
| `src/components/expenses/ExpenseForm.tsx:123` | `max` attr uses UTC string (`toISOString().split('T')[0]`), validation uses local date. Inconsistent in UTC-N timezones after midnight UTC. |
| `src/components/dashboard/AdminDashboard.tsx` | `loadMembers` has empty `catch` — add `console.error` at minimum |
| `src/hooks/useOrgMembers.ts` | `getDocs` on members collection has no `limit()` — large orgs fetch every member at startup |
| `src/components/dashboard/ExpenseTable.tsx` | `isAdmin: boolean` prop — type as `MemberRole` to preserve type safety downstream |
| `src/components/dashboard/AdminDashboard.tsx` | `loadData` can be called concurrently on rapid filter changes — add debounce or in-flight abort |
| `src/components/expenses/ExpenseForm.tsx` | No mounted guard in async `handleSubmit` — `setState` called on unmounted component if user navigates away mid-upload |

---

## P3

- `src/tests/components/ExpenseForm.test.ts`: `validateExpenseForm` with `date: ''` (empty string) is not covered.
