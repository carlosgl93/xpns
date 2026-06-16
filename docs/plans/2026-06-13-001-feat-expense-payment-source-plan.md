---
title: "feat: Expense payment source + reimbursement split"
date: 2026-06-13
type: feat
depth: standard
status: draft
---

# feat: Expense payment source + reimbursement split

**Summary:** Add a required `paymentSource` field to the `Expense` model so each expense records how it was paid (corporate card, personal card, etc.). The admin dashboard splits the existing "to pay" KPI into two views: **reimbursable to employee** (personal + cash) and **corporate card balance used** (corporate, admin visibility only). Pre-launch, so no backfill is required.

**Stack:** unchanged — Astro 6 + Preact PWA on Firebase (Firestore + Auth + Storage + Cloud Functions).

**Origin:** user request from an export-company employee; scope confirmed 2026-06-13.

---

## Problem Frame

Today every expense is implicitly treated as "to reimburse the employee" — the pending total IS the reimbursement owed. That is wrong whenever the employee paid with a company card or with a corporate debit account: the company paid directly, so nothing is owed to the employee. Without a way to record the payment source, the admin cannot distinguish "money I owe Carlos" from "money we already paid via the corporate Visa."

The fix is a single required field on the expense (the source of payment at the point of purchase) and a corresponding split in the admin dashboard aggregation. No other surfaces need to change: the employee submitter, the receipt photo, the storage path, the mark-paid flow, and the export shape are all already source-agnostic.

---

## Requirements

| ID | Requirement |
|----|-------------|
| R1 | Employee selects a payment source on the expense form: corporate credit, corporate debit, personal credit, personal debit, or cash. |
| R2 | `paymentSource` is required at submission — client validation prevents submit, server rule rejects bad writes. |
| R3 | The admin dashboard "pending" KPI splits into two sections: **A reembolsar** (personal credit, personal debit, cash) and **Saldo tarjeta corporativa usado** (corporate credit, corporate debit). Both group by currency, both list per-employee totals. |
| R4 | The admin expense table shows the payment source as a new column. |
| R5 | The admin filter bar has a new "Origen de pago" select that filters the table by payment source. |
| R6 | The CSV export adds a `origen_pago` column between `categoria` and `descripcion`. |
| R7 | Employees submitting expenses see the same required field but do not see the admin KPI split. |
| R8 | Firestore security rules reject any create with a `paymentSource` value not in the allowed enum. |

**Out of scope:** backfill (no users exist), payment-source editing in admin UI (rules already permit admin `update`), reimbursement status changes triggered by source, multi-currency conversion of corporate balances, statement reconciliation against bank exports.

---

## Key Technical Decisions

**KTD-1: Closed enum, not free text**
`PaymentSource` is a TypeScript `enum` (mirroring `ExpenseCategory`) with five string values: `corporate_credit`, `corporate_debit`, `personal_credit`, `personal_debit`, `cash`. Closed enum because (a) the set is small and stable, (b) the value drives server-validated math, (c) the existing `ExpenseCategory` pattern is the convention. Free text would force rules to allow any string and weaken the reimbursement guarantee.

**KTD-2: Required field enforced in both client and rules**
Client-side `validateExpenseForm` rejects empty/missing values (UX fast-fail). Server-side `firestore.rules` rejects any create with a value outside the enum (defense in depth — also the first enum-membership check the project adds to rules, so it sets a precedent).

**KTD-3: Reimbursement logic derived at aggregation time, not stored**
The Expense doc carries only `paymentSource`. The "reimbursable" / "corporate" grouping happens in `dashboardUtils.ts` via a derived helper:
- `corporate_*` → "Saldo tarjeta corporativa usado" (admin visibility)
- `personal_*` and `cash` → "A reembolsar" (admin owes employee)

Storing a derived boolean would double the write surface and the rules surface; deriving is sufficient because the source set is closed and the mapping is total.

**KTD-4: New KPI section, not a modified existing one**
Keep `groupByCurrency` and `groupByEmployee` semantics intact. Add a third KPI section that displays the split. Admins want both views (reimbursable owed + corporate spend) on the same dashboard; replacing the existing KPI would hide the corporate spend from any reconciliation mental model.

**KTD-5: Reimbursement status stays `pending → paid`**
No new expense state. The `paid` lifecycle still means "admin has reimbursed the employee" — for corporate-paid expenses, the admin marks paid without an actual transfer. The semantics extend cleanly: paid = "admin has settled this line item, however that settlement was made." Out of scope for this plan to model settlement-method metadata.

**KTD-6: Mirror the `category` pattern end-to-end**
Form field shape, validation, label map, filter select, table column, CSV column, composite indexes, and the existing test fixtures all have a category template. This plan reuses that template verbatim to keep cognitive load low and to make review straightforward.

---

## High-Level Technical Design

### Data flow

```
Employee submits expense (form, client:load)
  ├─ validateExpenseForm() rejects empty paymentSource   ← UX fail-fast
  └─ addExpense() → addDoc to orgs/{orgId}/expenses/     ← client write
       └─ firestore.rules: allow create                  ← server enum check
            if request.resource.data.paymentSource
               in [5 allowed values]
            else: PERMISSION_DENIED

Admin opens dashboard
  └─ KpiCards.tsx renders three sections
       ├─ "A reembolsar"  ← groupByReimbursableByEmployee(pending)
       └─ "Saldo tarjeta corporativa usado"
                         ← groupByCorporateByEmployee(pending)
       (existing "Total pendiente" / "Por empleado" sections removed;
        the split supersedes them — see open question OQ-1)

Admin filters by paymentSource
  └─ ExpenseTable updates local filters → useExpenses refires
       └─ where('paymentSource', '==', filters.paymentSource)  ← wired to Firestore

Admin exports CSV
  └─ generateCsv(visibleExpenses)
       └─ header adds 'origen_pago' between 'categoria' and 'descripcion'
```

### Enum → group helper

A small pure function in `dashboardUtils.ts` keeps the mapping in one place:

| `paymentSource` value | Group |
|-----------------------|-------|
| `corporate_credit`    | `corporate` |
| `corporate_debit`     | `corporate` |
| `personal_credit`     | `personal`  |
| `personal_debit`      | `personal`  |
| `cash`                | `personal`  |

Cash is treated as personal-reimbursable because employees paying cash for a business expense are owed a refund; this matches the "export company" use case (cash advances / petty cash) and keeps the rule total and simple.

### Composite indexes (added)

Mirror the four `category` indexes in `firestore.indexes.json`, swapping `category` for `paymentSource`:

1. `paymentSource ASC, date DESC` (single-field filter + order)
2. `status ASC, paymentSource ASC, date DESC` (status + paymentSource filter)
3. `submittedBy ASC, paymentSource ASC, date DESC` (per-employee + paymentSource filter)
4. `submittedBy ASC, status ASC, paymentSource ASC, date DESC` (full combo)

These are pre-emptive — the emulator will surface missing-index errors otherwise, and the queries the dashboard can run now (status+paymentSource, etc.) will hit them.

---

## Implementation Units

### U1. Data model + types + glossary

**Goal:** Add the `PaymentSource` enum, add `paymentSource: PaymentSource` as a required field on `Expense`, and add a `PaymentSource` concept entry to `CONCEPTS.md`.

**Requirements:** R1, R2 (definition only)

**Dependencies:** none

**Files:**
- `src/types/models.ts`
- `CONCEPTS.md`

**Approach:**
- Add `PaymentSource` enum after `ExpenseCategory`, mirroring its shape (lowercase string values, no logic).
- Add `paymentSource: PaymentSource` to the `Expense` interface as a required field (no `?`).
- `ExpenseWrite` automatically inherits the new required field (it's `Omit<Expense, 'id' | 'createdAt'>`).
- Under `CONCEPTS.md` → `## Core Business`, add a new `### PaymentSource` entry. Brief — one paragraph capturing the five values, the required-on-submit rule, and the reimbursement split.

**Patterns to follow:**
- `src/types/models.ts:34-40` — exact shape of `ExpenseCategory`.
- `CONCEPTS.md:26-28` — `### Expense` entry shape.

**Test scenarios:**
- `Test expectation: none` — type-only change with no runtime branch.

**Verification:** `pnpm tsc --noEmit` clean; reading `models.ts` shows the enum and the new field on `Expense`; `CONCEPTS.md` shows the new glossary entry.

---

### U2. Form + validation + submission

**Goal:** Employee sees a required "Origen de pago" select on the expense form; submitting without selecting fails client validation; submitting with a valid value sends it in the `addExpense` payload.

**Requirements:** R1, R2, R7

**Dependencies:** U1

**Files:**
- `src/components/expenses/ExpenseForm.tsx`
- `src/tests/components/ExpenseForm.test.ts`

**Approach:**
- Add `paymentSource: ''` to `ExpenseFormFields` (string at the form boundary, like `category`).
- Add `paymentSource` to the `INITIAL` constant.
- In `validateExpenseForm`, after the existing `category` check, add a `paymentSource` check: empty string → `errors.paymentSource = 'Selecciona el origen del pago'`. Reject empty value (mirrors the category check).
- In `handleSubmit`, add `paymentSource: form.paymentSource as PaymentSource` to the `addExpense` payload object. Update the import of `PaymentSource` from `../../types/models`.
- Add a `<div>` block in the form JSX for the new `<select id="paymentSource">` with an empty default option and one `<option>` per `PaymentSource` value. Place it directly after the category block to keep related fields adjacent.
- `PAYMENT_SOURCE_LABELS` map for display is defined inside the dashboard (U4) — the form select uses the enum value directly with a friendly label, or imports a shared labels map. Recommend defining a labels map colocated with the enum in `models.ts` (or in a small new `src/lib/paymentSources.ts`) so the form, table, and CSV all read from one source.

**Patterns to follow:**
- `ExpenseForm.tsx:160-174` — exact shape of the category `<select>` block (label, select, required, error span).
- `ExpenseForm.tsx:26-28` — exact shape of the category validation.
- `ExpenseForm.tsx:86` — exact shape of the category cast on submit.

**Test scenarios:**
- `makeValid()` fixture in `ExpenseForm.test.ts` includes `paymentSource: 'corporate_credit'` → `validateExpenseForm` returns `{}`.
- Empty `paymentSource: ''` → `validateExpenseForm` returns an error keyed `'paymentSource'`.
- `paymentSource: 'banana'` (not in enum) → still passes current validation (mirrors category — client only checks non-empty, server enforces enum membership). Test mirrors existing category behavior so a future "strict enum" change is a separate unit.

**Verification:** running the form test suite shows the new scenarios pass; running the dev server, opening `/dashboard/expenses/new`, and submitting without selecting → error appears; submitting with `corporate_credit` selected → no error and the value appears in the submitted payload (verify in emulator Firestore console).

---

### U3. Server-side validation + composite indexes + rules tests

**Goal:** `firestore.rules` rejects any create where `paymentSource` is missing or not in the allowed enum. Composite indexes are pre-emptively added for filter+order combinations that include `paymentSource`. Rules emulator tests cover the new behavior.

**Requirements:** R2, R8

**Dependencies:** U1

**Files:**
- `firestore.rules`
- `firestore.indexes.json`
- `src/tests/rules/firestore.test.ts`

**Approach:**
- In `firestore.rules`, extend the `allow create` clause on `orgs/{orgId}/expenses/{expenseId}` (currently lines 60-63). Add a final condition:
  `&& request.resource.data.paymentSource in ['corporate_credit', 'corporate_debit', 'personal_credit', 'personal_debit', 'cash']`.
- Keep the value list synced with the TS enum. The duplication is the cost of having the type and the rule in two languages; a code comment noting the source of truth is sufficient.
- In `firestore.indexes.json`, add four composite indexes that mirror the four `category` indexes, replacing `category` with `paymentSource`. Exact entries:
  - `paymentSource ASC, date DESC`
  - `status ASC, paymentSource ASC, date DESC`
  - `submittedBy ASC, paymentSource ASC, date DESC`
  - `submittedBy ASC, status ASC, paymentSource ASC, date DESC`
- In `src/tests/rules/firestore.test.ts`, update `seedExpense()` (line 42) to include `paymentSource: 'corporate_credit'`. Every existing test that creates a doc with `seedExpense` will continue to pass.
- Add a new `describe('expenses — paymentSource validation', ...)` block with:
  - `assertSucceeds` for create with each of the five valid values.
  - `assertFails` for create with `paymentSource: 'banana'`.
  - `assertFails` for create with no `paymentSource` field at all.
  - `assertFails` for create with `paymentSource: ''`.

**Patterns to follow:**
- `firestore.rules:60-63` — current `allow create` shape with `&&` clauses; append the new condition in the same style.
- `firestore.indexes.json:19-26, 36-44, 49-62` — current `category` composite indexes; clone-and-replace.
- `src/tests/rules/firestore.test.ts:42-57` — `seedExpense()` factory; add the new field, every existing test continues to use it.

**Test scenarios:**
- Already covered in the `describe` block above. Every value in the enum and at least two negative cases.

**Verification:** `pnpm test:rules` passes; the new test block fails before the rules change and passes after.

---

### U4. Dashboard filter + table column + filter wiring

**Goal:** Admin sees a new "Origen de pago" filter select, a new "Origen de pago" table column, and the filter is actually wired to a Firestore `where()` clause (not just declared).

**Requirements:** R4, R5

**Dependencies:** U1, U3

**Files:**
- `src/hooks/useExpenses.ts`
- `src/components/dashboard/ExpenseTable.tsx`
- `src/tests/hooks/useExpenses.test.ts`

**Approach:**
- In `useExpenses.ts`, add `paymentSource?: PaymentSource` to `ExpenseFilters`. In the constraints builder (line 19-26), after the existing `where('category', '==', filters.category)` line, add `if (filters.paymentSource) constraints.push(where('paymentSource', '==', filters.paymentSource))`. **Do not follow the pre-2026-06-12 P1-A pattern of declaring the filter without wiring it.**
- In `ExpenseTable.tsx`:
  - Add a `PAYMENT_SOURCE_LABELS: Record<PaymentSource, string>` map colocated with the existing `CATEGORY_LABELS` (line 15-21). Spanish labels: "Tarjeta de crédito corporativa", "Tarjeta de débito corporativa", "Tarjeta de crédito personal", "Tarjeta de débito personal", "Efectivo".
  - Add a new filter `<select>` after the status filter, mirroring the status/category selects (line 48-82).
  - Add a new `<th>Origen de pago</th>` header cell and a new `<td>{PAYMENT_SOURCE_LABELS[e.paymentSource] ?? e.paymentSource}</td>` body cell. Place the new column after `Categoría`.
  - Update the empty-state `colSpan` (currently `{isAdmin ? 7 : 5}`) to `{isAdmin ? 8 : 6}`.
- In `useExpenses.test.ts`, add `paymentSource: 'corporate_credit'` to the `makeExpenseWrite()` factory. Add a test asserting that when `filters.paymentSource = 'personal_debit'`, the hook constructs a query with `where('paymentSource', '==', 'personal_debit')`. Mirror the existing `category` filter test (around line 300).

**Patterns to follow:**
- `useExpenses.ts:4-10` — `ExpenseFilters` shape; append the new field.
- `useExpenses.ts:19-26` — `constraints.push` style; insert the new clause in order.
- `ExpenseTable.tsx:15-21` — `CATEGORY_LABELS` shape; add a sibling map.
- `ExpenseTable.tsx:48-82` — filter `<select>` markup shape; clone-and-modify.
- `ExpenseTable.tsx:86-94` — `<thead>` structure; add a new column.
- `ExpenseTable.tsx:99` — `colSpan` literal; bump.

**Test scenarios:**
- `useExpenses.test.ts`: query construction includes `where('paymentSource', '==', filters.paymentSource)` when the filter is set; omits the clause when the filter is undefined.
- (Optional, manual) `ExpenseTable.tsx`: visual smoke that the column renders, label is in Spanish, empty state row uses the new `colSpan`.

**Verification:** `pnpm test` shows the new hook test passes; dev server admin dashboard renders the new filter and column; applying a filter actually narrows the Firestore query (verify in emulator logs that a `where` is sent).

---

### U5. KPI split + CSV column + dashboard utils tests

**Goal:** The admin dashboard replaces the existing "Total pendiente" / "Por empleado" sections with two new ones: **A reembolsar** (personal + cash) and **Saldo tarjeta corporativa usado** (corporate). The CSV export gains a new `origen_pago` column. All aggregation helpers are pure, unit-tested, and follow the existing `groupByCurrency` / `groupByEmployee` shape.

**Requirements:** R3, R6

**Dependencies:** U1

**Files:**
- `src/lib/dashboardUtils.ts`
- `src/components/dashboard/KpiCards.tsx`
- `src/tests/lib/dashboardUtils.test.ts`

**Approach:**
- In `dashboardUtils.ts`:
  - Add a `PAYMENT_SOURCE_GROUP: Record<PaymentSource, 'corporate' | 'personal'>` map (cash → `'personal'`, per KTD-3).
  - Add `groupByReimbursableByEmployee(expenses: Expense[]): EmployeeTotal[]` and `groupByCorporateByEmployee(expenses: Expense[]): EmployeeTotal[]`. Both filter `status === 'pending'`, then filter by group, then group by `submittedBy` → `currency` (mirroring `groupByEmployee` at line 23-38).
  - Add `paymentSource` to the `generateCsv` header (insert between `categoria` and `descripcion`) and add a `csvCell(PAYMENT_SOURCE_LABELS[e.paymentSource] ?? e.paymentSource)` value column at the same position.
  - Decide where `PAYMENT_SOURCE_LABELS` lives. U4 puts it in `ExpenseTable.tsx`; U5 also needs it (for the CSV row). Recommendation: move the labels map into `src/lib/paymentSources.ts` (a new tiny module exporting `PaymentSource`, `PAYMENT_SOURCE_LABELS`, and `PAYMENT_SOURCE_GROUP`) and have U4 import from there. This is a small refactor — capture as a clearly labeled sub-step in U5.
- In `KpiCards.tsx`:
  - Replace the two existing sections ("Total pendiente" and "Por empleado") with two new sections: "A reembolsar" and "Saldo tarjeta corporativa usado". Each section uses the existing `<section><h2>...</h2><ul>...</ul></section>` skeleton.
  - "A reembolsar" uses `groupByReimbursableByEmployee`. Render each employee with their per-currency totals.
  - "Saldo tarjeta corporativa usado" uses `groupByCorporateByEmployee`. Same shape, different label, different "no aplica reembolso" hint copy.
  - If both lists are empty, show a "Sin gastos pendientes" line (reuses existing pattern from the original "Total pendiente" section).
- In `dashboardUtils.test.ts`:
  - Add `paymentSource: 'corporate_credit'` to the `makeExpense()` factory.
  - Add a `describe('groupByReimbursableByEmployee', ...)` block: mixes corporate and personal pending expenses, asserts the corporate ones are excluded.
  - Add a `describe('groupByCorporateByEmployee', ...)` block: same shape, asserts personal ones are excluded.
  - Add `cash` to one fixture to confirm it is grouped as personal-reimbursable.
  - Add a test for `generateCsv`: header includes `origen_pago`; the row's `origen_pago` cell uses the labels map (Spanish) and survives the formula-injection guard.

**Patterns to follow:**
- `dashboardUtils.ts:14-38` — existing aggregator shape; clone twice and adjust the inner filter.
- `dashboardUtils.ts:48` — header array literal; insert at the right position.
- `dashboardUtils.ts:50-52` — `csvCell` date format pattern; the payment source cell uses `csvCell(PAYMENT_SOURCE_LABELS[e.paymentSource] ?? e.paymentSource)`.
- `KpiCards.tsx:8-47` — section markup shape; clone and adjust headings + aggregation source.

**Test scenarios:**
- Reimbursable: 1 corporate + 1 personal + 1 cash expense for the same employee + currency → result has 1 employee entry with currency total = personal + cash amounts (corporate excluded).
- Reimbursable: status = `paid` expense is excluded.
- Corporate: 1 corporate + 1 personal expense for the same employee → result has 1 employee entry with the corporate total.
- CSV header order: `['fecha', 'empleado', 'categoria', 'origen_pago', 'descripcion', 'monto', 'moneda', 'estado']`.
- CSV row cell for `corporate_credit` renders the Spanish label "Tarjeta de crédito corporativa" (or whatever the canonical label is).

**Verification:** `pnpm test` shows the new test cases pass; dev server admin dashboard shows both new sections side by side, both react to date/member/status filters, and the CSV download contains the new column.

---

## Scope Boundaries

### In scope (v1.0 of this feature)
- New required `paymentSource` enum on `Expense` (5 values, closed set)
- Client + server validation of the enum
- Admin dashboard KPI split (reimbursable vs corporate spend)
- Admin table column + filter
- CSV export column
- All existing tests still green; new tests cover the new behavior

### Deferred to follow-up work
- **Backfill of legacy data** — explicitly out: no users exist at this commit (see strategy: demo 2026-06-21, launch 2026-06-30; no production data).
- **Editing `paymentSource` in admin UI** — rules already permit admin `update`, so it is technically possible from the console; a dedicated edit affordance is a separate feature.
- **Settlement-method metadata** on the `paid` transition (e.g., "paid via payroll", "paid via bank transfer") — separate schema/UI work; strategy track "Reimbursement flow" points at this for a future plan.
- **Multi-currency conversion of corporate balances** — out of scope; each expense stays in its original currency and the admin sees a per-currency breakdown.
- **Statement reconciliation against bank/card exports** — out of scope; deferred per strategy "Not working on" list (OCR / AI receipt validation deferred to next phase).
- **Reimbursement status state machine** — the `pending → paid` lifecycle is unchanged; any new state (e.g., "reimbursed via payroll") is a separate schema change.
- **Employee update of `receiptStoragePath` on their own draft expense** — discovered 2026-06-13 while smoke-testing the new paymentSource flow as an employee role. The `addExpense` flow does `addDoc` (allowed for `isMember`) → `uploadBytesResumable` (allowed for the submitter's uid) → `updateDoc` to set `receiptStoragePath` (currently allowed only for `isAdmin`). For an employee submitter, the third step is denied. The doc and the receipt exist in Firestore/Storage, but the expense has `receiptStoragePath: ''`. The form's catch block swallows the error and shows the generic "Error al guardar el gasto" message. Admin submitters are unaffected (which is why this didn't surface in unit tests or in the author's local smoke test as admin2). The pre-existing rule at `firestore.rules:66` (`allow update: if isAdmin(orgId);`) is the cause. Follow-up: narrow the `allow update` clause to also allow the submitter to patch only `receiptStoragePath` on a doc they own. Proposed rule addition (illustrative — review before merging):
  ```
  allow update: if isAdmin(orgId)
                || (isMember(orgId)
                    && resource.data.submittedBy == request.auth.uid
                    && request.resource.data.diff(resource.data).affectedKeys()
                         .hasOnly(['receiptStoragePath']));
  ```
  Companion test: `assertSucceeds` for employee setting `receiptStoragePath` on own doc; `assertFails` for employee attempting any other field. Out of scope for the current PR per "do not fix pre-existing issues, don't make them worse."

### Outside this product's identity
- Payment processing — the app records how an expense was paid, it does not move money.
- Card BIN detection / network tokens — the employee picks the source manually; no automatic detection.
- Integration with corporate card issuer APIs (e.g., Brex, Ramp, Stripe Issuing) — separate product surface.

---

## Open Questions

| # | Question | Owner | Status |
|---|----------|-------|--------|
| OQ-1 | Should the existing "Total pendiente" and "Por empleado" KPI sections stay alongside the new split (giving the admin three sections), or be replaced by the split? | Carlos | Decide before U5 closeout. Default: **replace** — the split's totals ARE the totals; keeping the old sections duplicates them. |
| OQ-2 | Cash advances policy: should the admin see "Saldo efectivo pendiente por liquidar" as a third corporate-equivalent group, distinct from the personal-reimbursable bucket? | Carlos | Decide before U5 closeout. Default: **keep cash in personal** for v1; revisit when settlement flow lands. |
| OQ-3 | Should the CSV column be `origen_pago` or `pago_origen` (Spanish noun order)? | Carlos | Trivial. Default: `origen_pago` matches the UI label. |

---

## Risks & Dependencies

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Pre-existing expenses (none in production) lack `paymentSource`; an old `seedExpense` test fixture is updated, but a real production doc would fail the new rules check | None in production (pre-launch) | None | No backfill code; if a doc somehow exists, the new `allow create` rule rejects new writes but does not block reads of legacy data |
| Adding a new `where()` filter dimension could trigger emulator warnings about missing composite indexes | Low | Low | Pre-emptively add four composite indexes in U3, mirroring the `category` indexes |
| `paymentSource` enum drift between TS enum and the `in [...]` literal in `firestore.rules` | Medium | High | Comment in `firestore.rules` pointing at `src/types/models.ts` as the source of truth; add a vitest rule test (already in U3) that exercises one out-of-enum value to fail loudly if drift occurs |
| CSV column shift breaks downstream spreadsheets that hard-code column letters | Low | Low | The column is added in the middle; downstream tools that read by index will misalign. This is acceptable for v1.0 since there are no downstream tools yet |
| The KPI replacement (OQ-1) changes what admins see on first load | Medium | Medium | If OQ-1 resolves to "keep both," plan is unchanged structurally. If "replace," it is a UI-only change in U5 |
| Two new KPI sections grow the dashboard vertically and may not fit on a small mobile screen | Low | Low | Each section is a list; mobile shows the same vertical stack as today, just longer. Acceptable |
| The orphan-storage risk from `to-fix.md` P1-C recurs: if `addExpense` calls `uploadBytesResumable` and then `addDoc` fails the new `paymentSource` rule, the receipt is uploaded for nothing | Low | Medium | The fix is the same as the open P1-C (delete-on-failure in `addExpense` or a GCS lifecycle rule) and is out of scope for this feature. Note in the plan for follow-up |

---

## Sources & Research

- Repo research agent summary (2026-06-13) — pattern for adding an enum field end-to-end, including the `category` template for form/table/filter/CSV.
- Learnings research agent summary (2026-06-13) — open P1/P2 findings in `to-fix.md` that touch the same files (`useExpenses.ts`, `AdminDashboard.tsx`, `ExpenseTable.tsx`, `ExpenseForm.tsx`); carry forward the "wire filters to `where()`" lesson from P1-A.
- `docs/solutions/security-issues/firestore-storage-rules-p1-fixes-2026-06-12.md` — the rule-surgery precedent for adding a `delete`-rule constraint tied to a doc field, in case the orphan-storage mitigation (out of scope) lands later.
- `STRATEGY.md` — strategy explicitly lists the "Reimbursement flow" and "Admin visibility" tracks this feature serves.
- `CONCEPTS.md` — the glossary's "Expense" entry (line 26-28) enumerates fields; the new "PaymentSource" entry follows that pattern.
- `firestore.rules:60-63` — the current `allow create` shape; the new enum check is appended in the same style.
- `src/lib/dashboardUtils.ts:14-38` — the aggregator shape; the two new aggregators are clones of `groupByEmployee`.
- `src/tests/rules/firestore.test.ts:42-57` — `seedExpense` factory; the new field is added there so every existing test continues to use it.
- `firestore.indexes.json:19-62` — current `category` composite indexes; cloned for `paymentSource`.
