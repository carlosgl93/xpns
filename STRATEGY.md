---
name: xpns
last_updated: 2026-06-12
---

# xpns Strategy

## Target problem

Small LATAM companies with no finance team manage employee expense reimbursements over WhatsApp and spreadsheets. Cash gets lost and there's no receipt trail, so admins have no way to validate what was actually spent.

## Our approach

Capture the receipt trail at the moment of expense, on the device employees already carry. Submitting is as fast as snapping a photo — so documentation can't be skipped and admins never have to chase receipts after the fact.

## Who it's for

**Primary:** Company admin (employer) at a small LATAM firm with no finance team — hiring xpns to track employee expenses, validate receipt proof, and pay reimbursements without losing money or audit trail. Employees are invited users; they submit and get paid but don't decide.

## Key metrics

- **Org retention** — % of paying orgs still active at 30 / 90 / 365 days; measured in DB
- **Submission rate** — expenses submitted per employee per month; drops if employees abandon the app
- **Approval rate** — % of expenses approved on first review without back-and-forth; drops if receipt quality or UX degrades

## Tracks

### Submission experience
Make snapping and submitting a receipt fast and frictionless on mobile.

_Why it serves the approach:_ The trail only works if employees actually use it — speed and ease at submission is the adoption mechanism.

### Admin visibility
Dashboard, KPIs, filters, mark-paid, export — everything an admin needs to stay in control.

_Why it serves the approach:_ Admins with no finance background need a clear view to trust the system and keep paying for it.

### Reimbursement flow
How admins actually pay employees back — payroll rollup, bank transfer, or otherwise.

_Why it serves the approach:_ Closing the loop on payment is what gives employees the financial incentive to keep submitting; without it the trail is useful but the product isn't sticky.

### Org growth
Invite flow, billing, plan tiers — the mechanics of acquiring and retaining paying orgs.

_Why it serves the approach:_ Retention at 90/365 days requires more than a good product; it requires a working commercial layer.

## Milestones

- **2026-06-21** — Demo
- **2026-06-30** — Launch
- **2026-10-01** — 3 paying customers

## Not working on

- OCR / AI receipt validation (deferred to next phase — core capture and admin flows come first)
- Per-employee analytics in admin dashboard (avg spend per category, comparison vs team — deferred until core admin visibility ships)
