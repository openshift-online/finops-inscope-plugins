import { useCallback, useEffect, useMemo, useState } from 'react';
import useAsync from 'react-use/esm/useAsync';
import type { FinOpsDataSource } from '../../../data/finopsDataSource';
import {
  ALL_USAGE_METRICS,
  type CostMetric,
  type ProviderType,
  type QuickDatePreset,
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
  /** Usage series that have at least one day with a positive value for this scope. */
  usageLines: UsageLineConfig[];
  usageAvailable: boolean;
  /** Sum of `cost_value` for this scope over the selected date range. */
  totalCost: number;
  /**
   * Percent change of total cost vs the same-length window immediately before the selected range.
   * `null` when the previous total is zero (not meaningful).
   */
  percentVsPrevious: number | null;
};

/** Keep legend / lines only for metrics that actually have data in this chart. */
function usageLinesWithData(chartData: ChartPoint[], candidates: UsageLineConfig[]): UsageLineConfig[] {
  return candidates.filter(line =>
    chartData.some(pt => {
      const v = pt[line.dataKey];
      return v !== null && v !== undefined && Number.isFinite(v) && v > 0;
    }),
  );
}

type DateRange = {
  fromDate: string;
  toDate: string;
};

const providerTypes: ProviderType[] = ['aws', 'gcp', 'dynatrace', 'other'];
const costMetrics: CostMetric[] = ['unblended_amount', 'amortized_amount'];
const QUERY_PARAM = {
  fromDate: 'from',
  toDate: 'to',
  providerTypes: 'providers',
  teamId: 'team',
  scopeSlug: 'scope',
  costMetric: 'costMetric',
  usageMetrics: 'usageMetrics',
} as const;

type QueryState = {
  fromDate: string | null;
  toDate: string | null;
  providerTypes: ProviderType[] | null;
  teamId: string | null;
  scopeSlug: string | null;
  costMetric: CostMetric | null;
  usageMetrics: UsageMetric[] | null;
};

function toIsoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function startOfMonth(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), 1));
}

function endOfMonth(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + 1, 0));
}

function addDays(value: Date, amount: number): Date {
  const copy = new Date(value);
  copy.setUTCDate(copy.getUTCDate() + amount);
  return copy;
}

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function parseCsv(value: string | null): string[] {
  if (!value) {
    return [];
  }
  return value
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
}

function parseQueryState(): QueryState {
  if (typeof window === 'undefined') {
    return {
      fromDate: null,
      toDate: null,
      providerTypes: null,
      teamId: null,
      scopeSlug: null,
      costMetric: null,
      usageMetrics: null,
    };
  }

  const params = new URLSearchParams(window.location.search);
  const fromDateRaw = params.get(QUERY_PARAM.fromDate);
  const toDateRaw = params.get(QUERY_PARAM.toDate);
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
    fromDate: fromDateRaw && isIsoDate(fromDateRaw) ? fromDateRaw : null,
    toDate: toDateRaw && isIsoDate(toDateRaw) ? toDateRaw : null,
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

function replaceQueryParams(params: URLSearchParams): void {
  if (typeof window === 'undefined') {
    return;
  }
  const nextSearch = params.toString();
  const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}${
    window.location.hash
  }`;
  window.history.replaceState({}, '', nextUrl);
}

function resolvePresetRange(preset: QuickDatePreset): DateRange {
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

/** How far back to query when discovering the latest day that has trend rows. */
const DATA_PROBE_LOOKBACK_DAYS = 500;

function calendarLastSevenDays(): DateRange {
  const now = new Date();
  return {
    fromDate: toIsoDate(addDays(now, -6)),
    toDate: toIsoDate(now),
  };
}

function toUtcDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function previousWindow(range: DateRange): DateRange {
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
  const initialQueryState = useMemo(() => parseQueryState(), []);
  const teamsQuery = useAsync(() => dataSource.getTeams(), [dataSource]);
  const [selectedTeamId, setSelectedTeamId] = useState<string>(initialQueryState.teamId ?? '');
  const metadataQuery = useAsync(
    () => dataSource.getScopes(selectedTeamId || null),
    [dataSource, selectedTeamId],
  );
  const defaultRange = useMemo(() => resolvePresetRange('last_30_days'), []);
  const [fromDate, setFromDate] = useState(initialQueryState.fromDate ?? defaultRange.fromDate);
  const [toDate, setToDate] = useState(initialQueryState.toDate ?? defaultRange.toDate);
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
  const [lastSevenDaysOfDataLoading, setLastSevenDaysOfDataLoading] = useState(false);

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

  /** `null` = all scopes (API omits `scope`); otherwise a single slug. */
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

  const range = useMemo(() => ({ fromDate, toDate }), [fromDate, toDate]);
  const previousRange = useMemo(() => previousWindow(range), [range]);

  const trendsQuery = useAsync(async () => {
    if (providerFilteredScopes.length === 0) {
      return [];
    }
    return dataSource.getCostTrends({
      fromDate,
      toDate,
      providerTypes: selectedProviderTypes,
      scopeSlug: scopeSlugForQuery,
      teamId: selectedTeamId || null,
      costMetric,
      usageMetrics: selectedUsageMetrics,
    });
  }, [
    dataSource,
    fromDate,
    toDate,
    scopeSlugForQuery,
    selectedProviderTypes,
    providerFilteredScopes.length,
    selectedTeamId,
    costMetric,
    selectedUsageMetrics,
  ]);

  const previousWindowQuery = useAsync(async () => {
    if (providerFilteredScopes.length === 0) {
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
    previousRange.fromDate,
    previousRange.toDate,
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

  function applyQuickPreset(preset: QuickDatePreset): void {
    const nextRange = resolvePresetRange(preset);
    setFromDate(nextRange.fromDate);
    setToDate(nextRange.toDate);
  }

  const applyLastSevenDaysOfData = useCallback(async () => {
    if (providerFilteredScopes.length === 0) {
      return;
    }
    setLastSevenDaysOfDataLoading(true);
    try {
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
      if (periods.length === 0) {
        const fallback = calendarLastSevenDays();
        setFromDate(fallback.fromDate);
        setToDate(fallback.toDate);
        return;
      }
      const latest = periods[periods.length - 1]!;
      const latestUtc = toUtcDate(latest);
      setFromDate(toIsoDate(addDays(latestUtc, -6)));
      setToDate(latest);
    } finally {
      setLastSevenDaysOfDataLoading(false);
    }
  }, [
    dataSource,
    scopeSlugForQuery,
    providerFilteredScopes.length,
    selectedProviderTypes,
    selectedTeamId,
    costMetric,
    selectedUsageMetrics,
  ]);

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
    params.set(QUERY_PARAM.fromDate, fromDate);
    params.set(QUERY_PARAM.toDate, toDate);
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
    fromDate,
    toDate,
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
      trendsQuery.loading ||
      previousWindowQuery.loading ||
      scopeTeamsQuery.loading ||
      lastSevenDaysOfDataLoading,
    error: teamsQuery.error || metadataQuery.error || trendsQuery.error || previousWindowQuery.error,
    scopeTeamsBySlug: scopeTeamsQuery.value ?? {},
    scopeTeamsAttributionError: scopeTeamsQuery.error,
    fromDate,
    toDate,
    setFromDate,
    setToDate,
    selectedProviderTypes,
    toggleProviderType,
    applyQuickPreset,
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
