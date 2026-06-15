// Admin dashboard orchestrator.
// Replaces the busy-poll setInterval with `whenAuthReady` (signal effect under
// the hood). Renders the same logical data via CSS-only responsive switching
// (chips + KPI mobile + card list + FAB on mobile; toolbar + KPI desktop +
// table on desktop). The chip view filter is applied client-side so the chip
// UI can change without a round-trip.

import { useState, useEffect } from 'preact/hooks';
import type { Expense, OrgMember } from '../../types/models';
import { authUser, authClaims } from '../../hooks/useAuth';
import { bootstrapAuth, whenAuthReady } from '../../hooks/useAuthBootstrap';
import { fetchExpenses, markAsPaid } from '../../hooks/useExpenses';
import { fetchOrgMembers } from '../../hooks/useOrgMembers';
import ExpenseFilters, { type ViewFilter } from './ExpenseFilters';
import KpiCards from './KpiCards';
import ExpenseTable from './ExpenseTable';
import ExpenseCardList from './ExpenseCardList';
import InviteForm from './InviteForm';
import { ExportButton } from './ExportButton';
import { Header } from './Header';
import { FAB } from './FAB';

const PERSONAL_SOURCES = new Set(['personal_credit', 'personal_debit', 'cash']);
const CORPORATE_SOURCES = new Set(['corporate_credit', 'corporate_debit']);

function matchesView(expense: Expense, view: ViewFilter): boolean {
  switch (view) {
    case 'all': return true;
    case 'reimbursable': return PERSONAL_SOURCES.has(expense.paymentSource);
    case 'corporate': return CORPORATE_SOURCES.has(expense.paymentSource);
    case 'pending': return expense.status === 'pending';
  }
}

function currentMonthLabel(): string {
  const now = new Date();
  const months = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
  ];
  return `${months[now.getMonth()]} ${now.getFullYear()}`;
}

export default function AdminDashboard() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [employeeFilter, setEmployeeFilter] = useState<string>('');
  const [view, setView] = useState<ViewFilter>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  // Auth bootstrap: wait for the first emission of auth state, then snapshot.
  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | null = null;

    (async () => {
      unsubscribe = await bootstrapAuth();
      await whenAuthReady();
      if (cancelled) return;

      const claims = authClaims.value;
      if (!claims?.orgId) {
        window.location.href = '/login';
        return;
      }
      setOrgId(claims.orgId);
      setIsAdmin(claims.role === 'admin');
    })();

    return () => {
      cancelled = true;
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // Reload when org or employee filter changes.
  useEffect(() => {
    if (!orgId) return;
    loadData(employeeFilter);
    if (isAdmin) loadMembers();
    // employeeFilter is the only signal we want to retrigger on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, employeeFilter, isAdmin]);

  async function loadData(employeeUid: string) {
    setLoading(true);
    setError(null);
    try {
      const activeFilters: { submittedBy?: string } = {};
      if (employeeUid) {
        activeFilters.submittedBy = employeeUid;
      } else if (!isAdmin) {
        const u = authUser.value;
        if (u) activeFilters.submittedBy = u.uid;
      }
      const data = await fetchExpenses(orgId!, activeFilters);
      setExpenses(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar los gastos.');
    } finally {
      setLoading(false);
    }
  }

  async function loadMembers() {
    try {
      const data = await fetchOrgMembers(orgId!);
      setMembers(data);
    } catch (e) {
      // members are non-critical for the main view; log for observability
      console.error('loadMembers failed', e);
    }
  }

  async function handleMarkPaid(expenseId: string) {
    try {
      await markAsPaid(orgId!, expenseId);
      await loadData(employeeFilter);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al marcar como pagado.');
    }
  }

  const visibleExpenses = expenses.filter((e) => matchesView(e, view));
  const monthLabel = currentMonthLabel();

  return (
    <div>
      <Header currentNav="Gastos" />

      <ExpenseFilters
        members={members}
        isAdmin={isAdmin}
        view={view}
        selectedEmployee={employeeFilter}
        onViewChange={setView}
        onEmployeeChange={setEmployeeFilter}
      />

      {isAdmin && <KpiCards expenses={expenses} />}

      {isAdmin && (
        <div className="dashboard-toolbar">
          <div className="grow" />
          <ExportButton expenses={visibleExpenses} />
        </div>
      )}

      {loading && <p className="status-loading">Cargando…</p>}
      {error && <p className="status-error">{error}</p>}

      {!loading && !error && (
        <>
          <div className="card-list mobile-only">
            <ExpenseCardList expenses={visibleExpenses} />
          </div>
          <div className="dashboard-body desktop-only">
            <div className="dashboard-month">{monthLabel}</div>
            <div className="dashboard-month-meta">
              {visibleExpenses.length} {visibleExpenses.length === 1 ? 'gasto visible' : 'gastos visibles'}
            </div>
            <ExpenseTable
              expenses={visibleExpenses}
              isAdmin={isAdmin}
              onMarkPaid={handleMarkPaid}
            />
          </div>
        </>
      )}

      {isAdmin && <InviteForm />}

      <FAB />
    </div>
  );
}
