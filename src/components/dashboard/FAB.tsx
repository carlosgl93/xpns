// Floating action button — visible only on mobile. Opens the new-expense form.
export function FAB() {
  return (
    <a className="fab" href="/dashboard/expenses/new" aria-label="Nuevo gasto">
      +
    </a>
  );
}
