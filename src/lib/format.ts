// CLP / LATAM currency formatters for the UI.
//
// Two flavours:
// - formatCLP:        full `Intl` output, e.g. "$1.247.500". For KPIs, hero
//                     amounts, mobile card list, and input fields.
// - formatCLPDense:   "$ 45.000" with a non-breaking space between the symbol
//                     and the number. For the dense desktop table where column
//                     alignment matters and we want the symbol present.
//
// All formatters use the es-CL locale and round to integer (CLP has no cents).

const baseOptions: Intl.NumberFormatOptions = {
  maximumFractionDigits: 0,
};

function narrowSymbol(currency: string): string {
  const parts = new Intl.NumberFormat('es-CL', {
    ...baseOptions,
    style: 'currency',
    currency,
    currencyDisplay: 'narrowSymbol',
  }).formatToParts(0);
  return parts.find((p) => p.type === 'currency')?.value ?? currency;
}

function numberOnly(value: number): string {
  return new Intl.NumberFormat('es-CL', baseOptions).format(value);
}

/** Full CLP/locale currency format, e.g. "$1.247.500". */
export function formatCLP(value: number, currency: string): string {
  return new Intl.NumberFormat('es-CL', {
    ...baseOptions,
    style: 'currency',
    currency,
  }).format(value);
}

/** Dense table format: narrow symbol + NBSP + integer, e.g. "$ 45.000". */
export function formatCLPDense(value: number, currency: string): string {
  return `${narrowSymbol(currency)} ${numberOnly(value)}`;
}
