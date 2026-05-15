import { useCallback, useEffect, useMemo, useState } from 'react';
import type { QuickDatePreset } from '../../types';
import {
  calendarLastSevenDays,
  dateRangeEndingOn,
  mergeDateQueryParams,
  parseDateRangeFromUrl,
  resolvePresetRange,
  validateDateRange,
  type DateRange,
} from './dateRangeUtils';

export type UseFinOpsDateRangeOptions = {
  defaultPreset?: QuickDatePreset;
  /** When true, writes applied `from` and `to` query params (merging with existing search). */
  syncToUrl?: boolean;
  /** Returns latest data period (ISO date) for “Last 7 days of data”, or null to use calendar fallback. */
  probeLatestPeriod?: () => Promise<string | null>;
};

function commitRange(
  range: DateRange,
  setDraftFrom: (v: string) => void,
  setDraftTo: (v: string) => void,
  setApplied: (v: DateRange) => void,
): void {
  setDraftFrom(range.fromDate);
  setDraftTo(range.toDate);
  setApplied(range);
}

export function useFinOpsDateRange(options: UseFinOpsDateRangeOptions = {}) {
  const { defaultPreset = 'last_30_days', syncToUrl = false, probeLatestPeriod } = options;
  const urlDates = useMemo(() => parseDateRangeFromUrl(), []);
  const defaultRange = useMemo(() => resolvePresetRange(defaultPreset), [defaultPreset]);
  const initialFrom = urlDates.fromDate ?? defaultRange.fromDate;
  const initialTo = urlDates.toDate ?? defaultRange.toDate;

  const [draftFromDate, setDraftFromDate] = useState(initialFrom);
  const [draftToDate, setDraftToDate] = useState(initialTo);
  const [appliedRange, setAppliedRange] = useState<DateRange>({
    fromDate: initialFrom,
    toDate: initialTo,
  });
  const [lastSevenDaysOfDataLoading, setLastSevenDaysOfDataLoading] = useState(false);

  const draftValidation = useMemo(
    () => validateDateRange(draftFromDate, draftToDate),
    [draftFromDate, draftToDate],
  );
  const appliedValidation = useMemo(
    () => validateDateRange(appliedRange.fromDate, appliedRange.toDate),
    [appliedRange.fromDate, appliedRange.toDate],
  );

  const hasPendingChanges =
    draftFromDate !== appliedRange.fromDate || draftToDate !== appliedRange.toDate;

  const dateRangeMessage = useMemo(() => {
    if (!draftValidation.valid) {
      return draftValidation.message;
    }
    if (hasPendingChanges) {
      return 'Press Apply to update charts for this date range.';
    }
    return null;
  }, [draftValidation, hasPendingChanges]);

  function applyDateRange(): void {
    if (!draftValidation.valid) {
      return;
    }
    setAppliedRange(draftValidation.range);
  }

  function applyQuickPreset(preset: QuickDatePreset): void {
    commitRange(
      resolvePresetRange(preset),
      setDraftFromDate,
      setDraftToDate,
      setAppliedRange,
    );
  }

  const applyLastSevenDaysOfData = useCallback(async () => {
    setLastSevenDaysOfDataLoading(true);
    try {
      let range: DateRange | null = null;
      if (probeLatestPeriod) {
        const latest = await probeLatestPeriod();
        if (latest) {
          range = dateRangeEndingOn(latest);
        }
      }
      if (!range) {
        range = calendarLastSevenDays();
      }
      commitRange(range, setDraftFromDate, setDraftToDate, setAppliedRange);
    } finally {
      setLastSevenDaysOfDataLoading(false);
    }
  }, [probeLatestPeriod]);

  useEffect(() => {
    if (!syncToUrl || !appliedValidation.valid) {
      return;
    }
    mergeDateQueryParams(appliedValidation.range.fromDate, appliedValidation.range.toDate);
  }, [appliedRange.fromDate, appliedRange.toDate, syncToUrl, appliedValidation]);

  return {
    fromDate: draftFromDate,
    toDate: draftToDate,
    setFromDate: setDraftFromDate,
    setToDate: setDraftToDate,
    appliedRange,
    appliedValidation,
    draftValidation,
    isRangeValid: appliedValidation.valid,
    hasPendingChanges,
    dateRangeMessage,
    applyDateRange,
    applyQuickPreset,
    applyLastSevenDaysOfData,
    lastSevenDaysOfDataLoading,
  };
}
