import { useState, useEffect } from 'preact/hooks';
import type { Expense } from '../../types/models';
import type { OrgMember } from '../../types/models';
import type { ExpenseFilters } from '../../hooks/useExpenses';
import KpiCards from './KpiCards';
import ExpenseTable from './ExpenseTable';
import ExportButton from './ExportButton';

export default function AdminDashboard() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [filters, setFilters] = useState<ExpenseFilters>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    (async () => {
      const { authClaims, authLoading, initAuth } = await import('../../hooks/useAuth');
      const unsubscribe = await initAuth();

      const waitForAuth = () =>
        new Promise<void>((resolve) => {
          const check = setInterval(() => {
            if (!authLoading.value) {
              clearInterval(check);
              resolve();
            }
          }, 50);
        });

      await waitForAuth();

      const claims = authClaims.value;
      if (!claims?.orgId) {
        window.location.href = '/login';
        return;
      }

      setOrgId(claims.orgId);
      setIsAdmin(claims.role === 'admin');

      return () => unsubscribe();
    })();
  }, []);

  useEffect(() => {
    if (!orgId) return;
    loadData();
    if (isAdmin) loadMembers();
  }, [orgId, filters]);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const { fetchExpenses } = await import('../../hooks/useExpenses');
      const { authUser, authClaims } = await import('../../hooks/useAuth');
      const activeFilters: ExpenseFilters = { ...filters };
      // Employee sees only own expenses
      if (!isAdmin && authUser.value) {
        activeFilters.submittedBy = authUser.value.uid;
      }
      const data = await fetchExpenses(orgId!, activeFilters);
      setExpenses(data);
    } catch {
      setError('Error al cargar los gastos.');
    } finally {
      setLoading(false);
    }
  }

  async function loadMembers() {
    try {
      const { fetchOrgMembers } = await import('../../hooks/useOrgMembers');
      const data = await fetchOrgMembers(orgId!);
      setMembers(data);
    } catch {
      // members are non-critical; silent fail
    }
  }

  async function handleMarkPaid(expenseId: string) {
    const { markAsPaid } = await import('../../hooks/useExpenses');
    await markAsPaid(orgId!, expenseId);
    await loadData();
  }

  if (loading) return <p>Cargando...</p>;
  if (error) return <p>{error}</p>;

  return (
    <div>
      {isAdmin && <KpiCards expenses={expenses} />}
      <ExportButton expenses={expenses} />
      <ExpenseTable
        expenses={expenses}
        members={members}
        isAdmin={isAdmin}
        onMarkPaid={handleMarkPaid}
        onFiltersChange={setFilters}
      />
    </div>
  );
}
