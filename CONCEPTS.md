# Concepts

Shared domain vocabulary for this project — entities, named processes, and status concepts with project-specific meaning. Seeded with core domain vocabulary, then accretes as ce-compound and ce-compound-refresh process learnings; direct edits are fine. Glossary only, not a spec or catch-all.

## Identity & Access

### Org
The top-level isolation unit. Every Expense, Member, and Invite belongs to exactly one Org. An Org is identified by its Firestore document ID (`orgId`), which is also embedded in each Member's JWT Claims so that Firestore and Storage security rules can enforce per-Org isolation without a round-trip.

### Member
An authenticated user who belongs to an Org. Members have a Role (admin or employee). An Org always has at least one admin Member — the user who created the Org via `setOrgClaims`. Employees are added via the Invite flow.

### Role
The access level of a Member within an Org. Two values: `admin` (can view all Expenses, mark paid, invite employees) and `employee` (can submit Expenses, sees only own Expenses). Encoded in JWT Claims and enforced by Firestore security rules.

### Claims
Firebase custom JWT claims attached to a user's ID token after org registration or invite acceptance. Carry `orgId` and `role`. Used by Firestore and Storage security rules for authorization without a Firestore read. Propagate to the client on the next token refresh (up to 1 hour delay after a claims write).

## Onboarding

### Invite
A time-limited, optionally email-restricted token that allows a user to join an Org as an employee. Stored at `orgs/{orgId}/invites/{token}` with an `expiresAt` timestamp and a `usedAt` field that is set atomically via Firestore transaction on redemption to prevent double-use.

## Core Business

### Expense
A reimbursement request submitted by a Member. Includes amount, currency, category, description, date, and a receipt photo stored in Cloud Storage. Belongs to exactly one Org. Has a lifecycle: pending → paid.

### PaymentSource
How the expense was paid at the point of purchase. Closed enum with five values: `corporate_credit`, `corporate_debit`, `personal_credit`, `personal_debit`, `cash`. Required on every submitted expense (client validation rejects empty, Firestore rules reject values outside the enum). Drives the admin dashboard's reimbursement split: `corporate_*` is "Saldo tarjeta corporativa usado" (admin visibility — no money owed to the employee), while `personal_*` and `cash` are "A reembolsar" (admin owes the employee).
