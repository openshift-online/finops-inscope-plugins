import { useCallback, useMemo } from 'react';
import useAsync from 'react-use/esm/useAsync';
import {
  getAwsAccountsHistorical,
  getAwsAccountsLatestPeriod,
} from '../../../api';
import { useFinOpsDateRange } from '../../shared/useFinOpsDateRange';
import { buildAwsAccountsChartModels } from './buildAwsAccountsChartModels';

export function useFinOpsAwsAccountTrackerData(
  fetchFn: typeof fetch,
  apiBaseUrl: string,
) {
  const probeLatestPeriod = useCallback(async (): Promise<string | null> => {
    const result = await getAwsAccountsLatestPeriod(fetchFn, apiBaseUrl);
    return result.period;
  }, [apiBaseUrl, fetchFn]);

  const dateRange = useFinOpsDateRange({
    syncToUrl: true,
    probeLatestPeriod,
  });

  const queryRangeKey = dateRange.appliedValidation.valid
    ? `${dateRange.appliedValidation.range.fromDate}|${dateRange.appliedValidation.range.toDate}`
    : null;

  const historicalQuery = useAsync(async () => {
    if (!dateRange.appliedValidation.valid) {
      return [];
    }
    return getAwsAccountsHistorical(fetchFn, apiBaseUrl, dateRange.appliedValidation.range);
  }, [apiBaseUrl, fetchFn, queryRangeKey]);

  const chartModels = useMemo(
    () => buildAwsAccountsChartModels(historicalQuery.value ?? []),
    [historicalQuery.value],
  );

  return {
    loading:
      (dateRange.appliedValidation.valid && historicalQuery.loading) ||
      dateRange.lastSevenDaysOfDataLoading,
    error: dateRange.appliedValidation.valid ? historicalQuery.error : undefined,
    dateRangeMessage: dateRange.dateRangeMessage,
    isRangeValid: dateRange.isRangeValid,
    fromDate: dateRange.fromDate,
    toDate: dateRange.toDate,
    setFromDate: dateRange.setFromDate,
    setToDate: dateRange.setToDate,
    applyDateRange: dateRange.applyDateRange,
    applyDateRangeDisabled: !dateRange.draftValidation.valid,
    applyQuickPreset: dateRange.applyQuickPreset,
    applyLastSevenDaysOfData: dateRange.applyLastSevenDaysOfData,
    chartModels,
  };
}
