const usdAmount = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const groupedInteger = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 0,
});

const hoursAmount = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** e.g. `2,800,722.37 USD` */
export function formatUsdAmount(value: number): string {
  return `${usdAmount.format(value)} USD`;
}

/** Usage hours with grouping, e.g. `1,234.50 h` */
export function formatUsageHours(value: number): string {
  return `${hoursAmount.format(value)} h`;
}

/** Whole hours with grouping for compact axes, e.g. `1,234 h` */
export function formatUsageHoursAxis(value: number): string {
  return `${groupedInteger.format(Math.round(value))} h`;
}

/** Short cost ticks for chart axes, e.g. `$2.8M`, `$184` */
const usdCompact = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  notation: 'compact',
  compactDisplay: 'short',
  maximumFractionDigits: 2,
});

export function formatUsdAxisTick(value: number): string {
  return usdCompact.format(value);
}

/** Short usage ticks when values are large, e.g. `1.2M h` */
const hoursCompact = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  compactDisplay: 'short',
  maximumFractionDigits: 1,
});

export function formatUsageHoursAxisTick(value: number): string {
  const n = Math.round(value);
  if (Math.abs(n) < 10_000) {
    return formatUsageHoursAxis(n);
  }
  return `${hoursCompact.format(n)} h`;
}
