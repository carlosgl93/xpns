# First prod deploy — 2026-06-15

Target: `xpns-7e2a3` (web.app live, us-east1 functions)
Trigger: end-to-end smoke test after deploying hosting + rules + indexes + storage + functions.

Captured with `agent-browser` from a fresh registration. The test user
(`e2e-test@xpns-test.com`) is real in the prod project — feel free to delete it
from Firebase Auth when you're done reviewing.

| File | Step |
|---|---|
| `xpns-1-register-filled.png` | `/register` form with org name, currency, email, password |
| `xpns-2-dashboard.png` | first dashboard render post-registration, empty expense list |
| `xpns-3-form-filled.png` | `/dashboard/expenses/new` with amount, comercio, category, paymentSource, receipt attached |
| `xpns-4-expense-saved.png` | success state ("Agregar otro" / "Volver al dashboard") |
| `xpns-5-dashboard-with-expense.png` | dashboard showing the $15.000 Comida row |

All 5 came back with zero console errors. Cloud functions exercised: `setOrgClaims` (registration), `addExpense` client path (doc-first Firestore write → Storage upload → updateDoc with receiptStoragePath).
