import { useCallback, useEffect, useMemo, useState } from 'react';
import useAsync from 'react-use/esm/useAsync';
import {
  addDays,
  DATE_QUERY_PARAM,
  previousWindow,
  replaceQueryParams,
  toIsoDate,
} from '../../shared/dateRangeUtils';
import { useFinOpsDateRange } from '../../shared/useFinOpsDateRange';
import type { FinOpsDataSource } from '../../../data/finopsDataSource';
import {
  ALL_USAGE_METRICS,
  type CostMetric,
  type ProviderType,
  type ScopeItem,
  type TeamItem,
  type TrendPoint,
  type UsageMetric,
} from '../../../types';

export type ChartPoint = {
  period: string;
  cost: number;
} & Partial<Record<UsageMetric, number | null>>;

export type UsageLineConfig = {
  dataKey: UsageMetric;
  name: string;
  stroke: string;
};

const USAGE_LINE_STROKE: Record<UsageMetric, string> = {
  ec2_usage_hours_amount: '#16a34a',
  rds_usage_hours_amount: '#ea580c',
};

export type ScopeTrendChartModel = {
  scope_slug: string;
  scope_name: string | null;
  chartData: ChartPoint[];
  usageLines: UsageLineConfig[];
  usageAvailable: boolean;
  totalCost: number;
  percentVsPrevious: number | null;
};

function usageLinesWithData(chartData: ChartPoint[], candidates: UsageLineConfig[]): UsageLineConfig[] {
  return candidates.filter(line =>
    chartData.some(pt => {
      const v = pt[line.dataKey];
      return v !== null && v !== undefined && Number.isFinite(v) && v > 0;
    }),
  );
}

const providerTypes: ProviderType[] = ['aws', 'gcp', 'dynatrace', 'other'];
const costMetrics: CostMetric[] = ['unblended_amount', 'amortized_amount'];
const QUERY_PARAM = {
  ...DATE_QUERY_PARAM,
  providerTypes: 'providers',
  teamId: 'team',
  scopeSlug: 'scope',
  costMetric: 'costMetric',
  usageMetrics: 'usageMetrics',
} as const;

/** How far back to query when discovering the latest day that has trend rows. */
const DATA_PROBE_LOOKBACK_DAYS = 500;

type QueryState = {
  providerTypes: ProviderType[] | null;
  teamId: string | null;
  scopeSlug: string | null;
  costMetric: CostMetric | null;
  usageMetrics: UsageMetric[] | null;
};

function parseCsv(value: string | null): string[] {
  if (!value) {
    return [];
  }
  return value
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
}

function parseCraQueryState(): QueryState {
  if (typeof window === 'undefined') {
    return {
      providerTypes: null,
      teamId: null,
      scopeSlug: null,
      costMetric: null,
      usageMetrics: null,
    };
  }

  const params = new URLSearchParams(window.location.search);
  const providerTypesRaw = parseCsv(params.get(QUERY_PARAM.providerTypes));
  const usageMetricsRaw = parseCsv(params.get(QUERY_PARAM.usageMetrics));
  const teamIdRaw = params.get(QUERY_PARAM.teamId);
  const scopeSlugRaw = params.get(QUERY_PARAM.scopeSlug);
  const costMetricRaw = params.get(QUERY_PARAM.costMetric);

  const parsedProviderTypes = providerTypesRaw.filter((value): value is ProviderType =>
    providerTypes.includes(value as ProviderType),
  );
  const parsedUsageMetrics = usageMetricsRaw.filter((value): value is UsageMetric =>
    ALL_USAGE_METRICS.includes(value as UsageMetric),
  );

  return {
    providerTypes: parsedProviderTypes.length > 0 ? parsedProviderTypes : null,
    teamId: teamIdRaw || null,
    scopeSlug: scopeSlugRaw || null,
    costMetric:
      costMetricRaw && costMetrics.includes(costMetricRaw as CostMetric)
        ? (costMetricRaw as CostMetric)
        : null,
    usageMetrics: usageMetricsRaw.length > 0 ? parsedUsageMetrics : null,
  };
}

type UsageAggCell = { sum: number; hasValue: boolean };

function aggregateByPeriod(points: TrendPoint[], usageMetrics: UsageMetric[]): ChartPoint[] {
  const byPeriod = new Map<
    string,
    { cost: number; usage: Partial<Record<UsageMetric, UsageAggCell>> }
  >();

  for (const point of points) {
    const current = byPeriod.get(point.period) ?? { cost: 0, usage: {} };
    current.cost += point.cost_value;
    for (const m of usageMetrics) {
      const v = point.usage_by_metric[m];
      const cell = current.usage[m] ?? { sum: 0, hasValue: false };
      if (v !== null && v !== undefined && Number.isFinite(v)) {
        cell.sum += v;
        cell.hasValue = true;
      }
      current.usage[m] = cell;
    }
    byPeriod.set(point.period, current);
  }

  return Array.from(byPeriod.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([period, row]) => {
      const out: ChartPoint = {
        period,
        cost: Number(row.cost.toFixed(2)),
      };
      for (const m of usageMetrics) {
        const cell = row.usage[m];
        out[m] =
          cell?.hasValue === true ? Number(cell.sum.toFixed(2)) : null;
      }
      return out;
    });
}

function sumCostByScopeSlug(points: TrendPoint[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const point of points) {
    map.set(point.scope_slug, (map.get(point.scope_slug) ?? 0) + point.cost_value);
  }
  return map;
}

function percentChangeVsPrevious(currentTotal: number, previousTotal: number): number | null {
  if (!Number.isFinite(previousTotal) || previousTotal === 0) {
    return null;
  }
  return ((currentTotal - previousTotal) / previousTotal) * 100;
}

function costMetricLabel(metric: CostMetric): string {
  return metric === 'amortized_amount' ? 'Amortized' : 'Unblended';
}

function usageMetricLabel(metric: UsageMetric): string {
  if (metric === 'rds_usage_hours_amount') {
    return 'RDS usage (hrs)';
  }
  return 'EC2 usage (hrs)';
}

export function useFinOpsCraData(dataSource: FinOpsDataSource) {
  const initialQueryState = useMemo(() => parseCraQueryState(), []);
  const teamsQuery = useAsync(() => dataSource.getTeams(), [dataSource]);
  const [selectedTeamId, setSelectedTeamId] = useState<string>(initialQueryState.teamId ?? '');
  const metadataQuery = useAsync(
    () => dataSource.getScopes(selectedTeamId || null),
    [dataSource, selectedTeamId],
  );
  const [selectedProviderTypes, setSelectedProviderTypes] = useState<ProviderType[]>(
    initialQueryState.providerTypes ?? providerTypes,
  );
  const [selectedScopeSlug, setSelectedScopeSlug] = useState<string>(initialQueryState.scopeSlug ?? '');
  const [costMetric, setCostMetric] = useState<CostMetric>(
    initialQueryState.costMetric ?? 'amortized_amount',
  );
  const [selectedUsageMetrics, setSelectedUsageMetrics] = useState<UsageMetric[]>(
    initialQueryState.usageMetrics ?? [...ALL_USAGE_METRICS],
  );

  const costMetricDisplay = useMemo(() => costMetricLabel(costMetric), [costMetric]);
  const usageSeriesConfig = useMemo(
    (): UsageLineConfig[] =>
      selectedUsageMetrics.map(m => ({
        dataKey: m,
        name: usageMetricLabel(m),
        stroke: USAGE_LINE_STROKE[m],
      })),
    [selectedUsageMetrics],
  );

  const teams: TeamItem[] = useMemo(() => teamsQuery.value ?? [], [teamsQuery.value]);

  useEffect(() => {
    if (!selectedTeamId) {
      return;
    }
    if (teams.length > 0 && !teams.some(team => team.id === selectedTeamId)) {
      setSelectedTeamId('');
    }
  }, [teams, selectedTeamId]);

  const selectedTeamMembers = useMemo(
    () => teams.find(t => t.id === selectedTeamId)?.members ?? [],
    [teams, selectedTeamId],
  );

  const scopes: ScopeItem[] = useMemo(
    () => metadataQuery.value ?? [],
    [metadataQuery.value],
  );

  const providerFilteredScopes = useMemo(
    () => scopes.filter(scope => selectedProviderTypes.includes(scope.type)),
    [scopes, selectedProviderTypes],
  );

  const scopeSlugForQuery = useMemo((): string | null => {
    if (providerFilteredScopes.length === 0) {
      return null;
    }
    if (selectedScopeSlug === '') {
      return null;
    }
    if (providerFilteredScopes.some(scope => scope.scope_slug === selectedScopeSlug)) {
      return selectedScopeSlug;
    }
    return null;
  }, [providerFilteredScopes, selectedScopeSlug]);

  useEffect(() => {
    if (
      selectedScopeSlug &&
      providerFilteredScopes.length > 0 &&
      !providerFilteredScopes.some(s => s.scope_slug === selectedScopeSlug)
    ) {
      setSelectedScopeSlug('');
    }
  }, [providerFilteredScopes, selectedScopeSlug]);

  const activeScopeSlugs = useMemo(() => {
    if (providerFilteredScopes.length === 0) {
      return new Set<string>();
    }
    if (scopeSlugForQuery === null) {
      return new Set(providerFilteredScopes.map(s => s.scope_slug));
    }
    return new Set([scopeSlugForQuery]);
  }, [providerFilteredScopes, scopeSlugForQuery]);

  const probeLatestPeriod = useCallback(async (): Promise<string | null> => {
    if (providerFilteredScopes.length === 0) {
      return null;
    }
    const toProbe = toIsoDate(new Date());
    const fromProbe = toIsoDate(addDays(new Date(), -DATA_PROBE_LOOKBACK_DAYS));
    const probe = await dataSource.getCostTrends({
      fromDate: fromProbe,
      toDate: toProbe,
      providerTypes: selectedProviderTypes,
      scopeSlug: scopeSlugForQuery,
      teamId: selectedTeamId || null,
      costMetric,
      usageMetrics: selectedUsageMetrics,
    });
    const periods = [...new Set(probe.map(p => p.period))].filter(Boolean).sort();
    return periods.length > 0 ? periods[periods.length - 1]! : null;
  }, [
    dataSource,
    scopeSlugForQuery,
    providerFilteredScopes.length,
    selectedProviderTypes,
    selectedTeamId,
    costMetric,
    selectedUsageMetrics,
  ]);

  const dateRange = useFinOpsDateRange({ probeLatestPeriod });

  const queryRangeKey = dateRange.appliedValidation.valid
    ? `${dateRange.appliedValidation.range.fromDate}|${dateRange.appliedValidation.range.toDate}`
    : null;

  const previousRange = useMemo(() => {
    if (!dateRange.appliedValidation.valid) {
      return null;
    }
    return previousWindow(dateRange.appliedValidation.range);
  }, [dateRange.appliedValidation]);

  const trendsQuery = useAsync(async () => {
    if (providerFilteredScopes.length === 0 || !dateRange.appliedValidation.valid) {
      return [];
    }
    return dataSource.getCostTrends({
      fromDate: dateRange.appliedValidation.range.fromDate,
      toDate: dateRange.appliedValidation.range.toDate,
      providerTypes: selectedProviderTypes,
      scopeSlug: scopeSlugForQuery,
      teamId: selectedTeamId || null,
      costMetric,
      usageMetrics: selectedUsageMetrics,
    });
  }, [
    dataSource,
    queryRangeKey,
    scopeSlugForQuery,
    selectedProviderTypes,
    providerFilteredScopes.length,
    selectedTeamId,
    costMetric,
    selectedUsageMetrics,
  ]);

  const previousWindowQuery = useAsync(async () => {
    if (providerFilteredScopes.length === 0 || !previousRange) {
      return [];
    }
    return dataSource.getCostTrends({
      fromDate: previousRange.fromDate,
      toDate: previousRange.toDate,
      providerTypes: selectedProviderTypes,
      scopeSlug: scopeSlugForQuery,
      teamId: selectedTeamId || null,
      costMetric,
      usageMetrics: selectedUsageMetrics,
    });
  }, [
    dataSource,
    previousRange?.fromDate,
    previousRange?.toDate,
    scopeSlugForQuery,
    selectedProviderTypes,
    providerFilteredScopes.length,
    selectedTeamId,
    costMetric,
    selectedUsageMetrics,
  ]);

  const filteredTrends = useMemo(
    () =>
      (trendsQuery.value ?? []).filter(
        point =>
          activeScopeSlugs.has(point.scope_slug) &&
          selectedProviderTypes.includes(point.provider_type),
      ),
    [activeScopeSlugs, selectedProviderTypes, trendsQuery.value],
  );
  const previousWindowTrends = useMemo(
    () =>
      (previousWindowQuery.value ?? []).filter(
        point =>
          activeScopeSlugs.has(point.scope_slug) &&
          selectedProviderTypes.includes(point.provider_type),
      ),
    [activeScopeSlugs, previousWindowQuery.value, selectedProviderTypes],
  );

  const scopesToPlot = useMemo(() => {
    if (scopeSlugForQuery === null) {
      return providerFilteredScopes;
    }
    return providerFilteredScopes.filter(s => s.scope_slug === scopeSlugForQuery);
  }, [providerFilteredScopes, scopeSlugForQuery]);

  const scopeTrendCharts = useMemo((): ScopeTrendChartModel[] => {
    const bySlug = new Map<string, TrendPoint[]>();
    for (const point of filteredTrends) {
      const list = bySlug.get(point.scope_slug) ?? [];
      list.push(point);
      bySlug.set(point.scope_slug, list);
    }
    const currentCostBySlug = sumCostByScopeSlug(filteredTrends);
    const previousCostBySlug = sumCostByScopeSlug(previousWindowTrends);

    return scopesToPlot.map(scope => {
      const points = bySlug.get(scope.scope_slug) ?? [];
      const chartData = aggregateByPeriod(points, selectedUsageMetrics);
      const usageLines = usageLinesWithData(chartData, usageSeriesConfig);
      const usageAvailable = usageLines.length > 0;
      const rawTotal = currentCostBySlug.get(scope.scope_slug) ?? 0;
      const totalCost = Number(rawTotal.toFixed(2));
      const previousTotal = previousCostBySlug.get(scope.scope_slug) ?? 0;
      const percentVsPrevious = percentChangeVsPrevious(totalCost, previousTotal);
      return {
        scope_slug: scope.scope_slug,
        scope_name: scope.scope_name,
        chartData,
        usageLines,
        usageAvailable,
        totalCost,
        percentVsPrevious,
      };
    });
  }, [
    filteredTrends,
    previousWindowTrends,
    scopesToPlot,
    selectedUsageMetrics,
    usageSeriesConfig,
  ]);

  const scopeSlugsForTeamQuery = useMemo(
    () => [...new Set(scopesToPlot.map(s => s.scope_slug))].sort(),
    [scopesToPlot],
  );
  const scopeSlugsKey = scopeSlugsForTeamQuery.join('\0');

  const scopeTeamsQuery = useAsync(async () => {
    if (scopeSlugsForTeamQuery.length === 0) {
      return {};
    }
    return dataSource.getScopeTeamsBySlug(scopeSlugsForTeamQuery);
  }, [dataSource, scopeSlugsKey]);

  const applyLastSevenDaysOfData = useCallback(async () => {
    if (providerFilteredScopes.length === 0) {
      return;
    }
    await dateRange.applyLastSevenDaysOfData();
  }, [dateRange, providerFilteredScopes.length]);

  function toggleProviderType(providerType: ProviderType): void {
    setSelectedProviderTypes(current => {
      const exists = current.includes(providerType);
      if (exists) {
        if (current.length === 1) {
          return current;
        }
        return current.filter(value => value !== providerType);
      }
      return [...current, providerType];
    });
  }

  function toggleUsageMetric(metric: UsageMetric): void {
    setSelectedUsageMetrics(current => {
      const exists = current.includes(metric);
      if (exists) {
        return current.filter(m => m !== metric);
      }
      return [...current, metric];
    });
  }

  useEffect(() => {
    const params = new URLSearchParams();
    if (dateRange.appliedValidation.valid) {
      params.set(QUERY_PARAM.fromDate, dateRange.appliedValidation.range.fromDate);
      params.set(QUERY_PARAM.toDate, dateRange.appliedValidation.range.toDate);
    }
    params.set(QUERY_PARAM.providerTypes, selectedProviderTypes.join(','));
    if (selectedTeamId) {
      params.set(QUERY_PARAM.teamId, selectedTeamId);
    }
    if (selectedScopeSlug) {
      params.set(QUERY_PARAM.scopeSlug, selectedScopeSlug);
    }
    params.set(QUERY_PARAM.costMetric, costMetric);
    params.set(QUERY_PARAM.usageMetrics, selectedUsageMetrics.join(','));
    replaceQueryParams(params);
  }, [
    dateRange.appliedRange.fromDate,
    dateRange.appliedRange.toDate,
    selectedProviderTypes,
    selectedTeamId,
    selectedScopeSlug,
    costMetric,
    selectedUsageMetrics,
  ]);

  return {
    loading:
      teamsQuery.loading ||
      metadataQuery.loading ||
      (dateRange.appliedValidation.valid && trendsQuery.loading) ||
      (dateRange.appliedValidation.valid && previousWindowQuery.loading) ||
      scopeTeamsQuery.loading ||
      dateRange.lastSevenDaysOfDataLoading,
    error:
      teamsQuery.error ||
      metadataQuery.error ||
      (dateRange.appliedValidation.valid ? trendsQuery.error : undefined) ||
      (dateRange.appliedValidation.valid ? previousWindowQuery.error : undefined),
    dateRangeMessage: dateRange.dateRangeMessage,
    isRangeValid: dateRange.isRangeValid,
    applyDateRange: dateRange.applyDateRange,
    applyDateRangeDisabled: !dateRange.draftValidation.valid,
    scopeTeamsBySlug: scopeTeamsQuery.value ?? {},
    scopeTeamsAttributionError: scopeTeamsQuery.error,
    fromDate: dateRange.fromDate,
    toDate: dateRange.toDate,
    setFromDate: dateRange.setFromDate,
    setToDate: dateRange.setToDate,
    selectedProviderTypes,
    toggleProviderType,
    applyQuickPreset: dateRange.applyQuickPreset,
    applyLastSevenDaysOfData,
    selectedScopeSlug,
    setSelectedScopeSlug,
    scopes: providerFilteredScopes,
    teams,
    selectedTeamId,
    setSelectedTeamId,
    selectedTeamMembers,
    scopeTrendCharts,
    costMetric,
    setCostMetric,
    selectedUsageMetrics,
    toggleUsageMetric,
    costMetricDisplay,
  };
}
