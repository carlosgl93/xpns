// Sticky filter chips (mobile) + admin employee select (desktop).
// Parent owns the filter state via `onViewChange` and `onEmployeeChange`.

import type { OrgMember } from '../../types/models';

export type ViewFilter = 'all' | 'reimbursable' | 'corporate' | 'pending';

interface Props {
  members: OrgMember[];
  /** Admin-only. When true, the employee select is rendered. */
  isAdmin: boolean;
  /** Currently selected view filter (chip). */
  view: ViewFilter;
  /** Currently selected employee uid (admin only). Empty string = all. */
  selectedEmployee: string;
  onViewChange: (view: ViewFilter) => void;
  onEmployeeChange: (uid: string) => void;
}

const CHIPS: Array<{ value: ViewFilter; label: string }> = [
  { value: 'all', label: 'Todos' },
  { value: 'reimbursable', label: 'A reembolsar' },
  { value: 'corporate', label: 'Tarjeta corporativa' },
  { value: 'pending', label: 'Pendiente' },
];

export default function ExpenseFilters({
  members,
  isAdmin,
  view,
  selectedEmployee,
  onViewChange,
  onEmployeeChange,
}: Props) {
  function handleEmployeeChange(e: Event) {
    const value = (e.target as HTMLSelectElement).value;
    onEmployeeChange(value);
  }

  return (
    <>
      <div className="filter-chips mobile-only" role="tablist" aria-label="Filtro de gastos">
        {CHIPS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={view === value}
            className={`chip ${view === value ? 'active' : ''}`}
            onClick={() => onViewChange(value)}
          >
            {label}
          </button>
        ))}
      </div>

      {isAdmin && (
        <div className="dashboard-toolbar desktop-only">
          <div className="filter-employee-wrap">
            <label className="label" htmlFor="filter-employee">Empleado</label>
            <select
              id="filter-employee"
              className="form-select"
              value={selectedEmployee}
              onChange={handleEmployeeChange}
            >
              <option value="">Todos los empleados</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>{m.displayName}</option>
              ))}
            </select>
          </div>
          <div className="grow" />
          <div className="filter-chips-row">
            {CHIPS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                aria-pressed={view === value}
                className={`chip ${view === value ? 'active' : ''}`}
                onClick={() => onViewChange(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

