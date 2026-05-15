/** UTC midnight for an ISO calendar day (YYYY-MM-DD). */
export function periodToUtcMs(period: string): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(period.trim());
  if (!match) {
    const parsed = Date.parse(period);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  return Date.UTC(year, month - 1, day);
}

export function normalizePeriod(period: string): string {
  const ms = periodToUtcMs(period);
  if (!Number.isFinite(ms) || ms === 0) {
    return period.trim().slice(0, 10);
  }
  return new Date(ms).toISOString().slice(0, 10);
}

export function formatPeriodTick(periodTime: number): string {
  if (!Number.isFinite(periodTime)) {
    return '';
  }
  return new Date(periodTime).toISOString().slice(0, 10);
}
