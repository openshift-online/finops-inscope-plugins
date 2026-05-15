import type { QuickDatePreset } from '../../types';

export type DateRange = {
  fromDate: string;
  toDate: string;
};

export const DATE_QUERY_PARAM = {
  fromDate: 'from',
  toDate: 'to',
} as const;

export function toIsoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function startOfMonth(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), 1));
}

export function endOfMonth(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + 1, 0));
}

export function addDays(value: Date, amount: number): Date {
  const copy = new Date(value);
  copy.setUTCDate(copy.getUTCDate() + amount);
  return copy;
}

export function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export type DateRangeValidation =
  | { valid: true; range: DateRange }
  | { valid: false; message: string };

export function validateDateRange(fromDate: string, toDate: string): DateRangeValidation {
  if (!isIsoDate(fromDate) || !isIsoDate(toDate)) {
    return {
      valid: false,
      message: 'Enter valid dates (YYYY-MM-DD) for both From and To.',
    };
  }
  if (fromDate > toDate) {
    return {
      valid: false,
      message: 'From date must be on or before To date.',
    };
  }
  return {
    valid: true,
    range: { fromDate, toDate },
  };
}

export function toUtcDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

export function parseDateRangeFromUrl(): { fromDate: string | null; toDate: string | null } {
  if (typeof window === 'undefined') {
    return { fromDate: null, toDate: null };
  }
  const params = new URLSearchParams(window.location.search);
  const fromDateRaw = params.get(DATE_QUERY_PARAM.fromDate);
  const toDateRaw = params.get(DATE_QUERY_PARAM.toDate);
  return {
    fromDate: fromDateRaw && isIsoDate(fromDateRaw) ? fromDateRaw : null,
    toDate: toDateRaw && isIsoDate(toDateRaw) ? toDateRaw : null,
  };
}

export function replaceQueryParams(params: URLSearchParams): void {
  if (typeof window === 'undefined') {
    return;
  }
  const nextSearch = params.toString();
  const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}${
    window.location.hash
  }`;
  window.history.replaceState({}, '', nextUrl);
}

export function mergeDateQueryParams(fromDate: string, toDate: string): void {
  if (typeof window === 'undefined') {
    return;
  }
  const params = new URLSearchParams(window.location.search);
  params.set(DATE_QUERY_PARAM.fromDate, fromDate);
  params.set(DATE_QUERY_PARAM.toDate, toDate);
  replaceQueryParams(params);
}

export function resolvePresetRange(preset: QuickDatePreset): DateRange {
  const now = new Date();
  if (preset === 'current_month') {
    return {
      fromDate: toIsoDate(startOfMonth(now)),
      toDate: toIsoDate(now),
    };
  }
  if (preset === 'last_30_days') {
    return {
      fromDate: toIsoDate(addDays(now, -29)),
      toDate: toIsoDate(now),
    };
  }
  const previousMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  return {
    fromDate: toIsoDate(startOfMonth(previousMonth)),
    toDate: toIsoDate(endOfMonth(previousMonth)),
  };
}

export function calendarLastSevenDays(): DateRange {
  const now = new Date();
  return {
    fromDate: toIsoDate(addDays(now, -6)),
    toDate: toIsoDate(now),
  };
}

/** Seven-day window ending on the given ISO date (inclusive). */
export function dateRangeEndingOn(latestPeriod: string): DateRange {
  const latestUtc = toUtcDate(latestPeriod);
  return {
    fromDate: toIsoDate(addDays(latestUtc, -6)),
    toDate: latestPeriod,
  };
}

export function previousWindow(range: DateRange): DateRange {
  const from = toUtcDate(range.fromDate);
  const to = toUtcDate(range.toDate);
  const windowDays = Math.max(
    1,
    Math.floor((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000)) + 1,
  );
  const previousTo = addDays(from, -1);
  const previousFrom = addDays(previousTo, -windowDays + 1);
  return {
    fromDate: toIsoDate(previousFrom),
    toDate: toIsoDate(previousTo),
  };
}
