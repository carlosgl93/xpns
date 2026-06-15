import type { Expense } from '../../types/models';
import { generateCsv } from '../../lib/dashboardUtils';
import { Button } from '../ui/Button';

interface Props {
  expenses: Expense[];
}

export function ExportButton({ expenses }: Props) {
  function handleExport() {
    const csv = generateCsv(expenses);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'gastos.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Button variant="secondary" onClick={handleExport}>
      Exportar CSV
    </Button>
  );
}
