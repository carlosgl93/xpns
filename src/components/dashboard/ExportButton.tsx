import type { Expense } from '../../types/models';
import { generateCsv } from '../../lib/dashboardUtils';

interface Props {
  expenses: Expense[];
}

export default function ExportButton({ expenses }: Props) {
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
    <button type="button" onClick={handleExport}>
      Exportar CSV
    </button>
  );
}
