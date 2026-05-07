import {
  getScopeTeamsBatch,
  getScopes,
  getTeams,
  getTrends,
  type RawScopeItem,
  type RawTrendPoint,
} from '../api';
import type {
  CostMetric,
  CraTrendQueryFilters,
  ProviderType,
  ScopeItem,
  TeamItem,
  TrendPoint,
  UsageMetric,
} from '../types';
import {
  createMockFinOpsCraDataset,
  mockScopesForTeam,
  mockTeamsForScopeSlug,
} from '../mock/finopsCraMockData';

export type FinOpsDataSource = {
  getTeams: () => Promise<TeamItem[]>;
  getScopes: (teamId?: string | null) => Promise<ScopeItem[]>;
  getCostTrends: (filters: CraTrendQueryFilters) => Promise<TrendPoint[]>;
  getScopeTeamsBySlug: (scopeSlugs: readonly string[]) => Promise<Record<string, TeamItem[]>>;
};

const mockDataset = createMockFinOpsCraDataset();

function mockAdjustCost(cost: number, costMetric: CostMetric): number {
  if (costMetric === 'amortized_amount') {
    return Number((cost * 1.08 + 2.5).toFixed(2));
  }
  return cost;
}

function mockAdjustUsage(
  usage: number | null,
  usageMetric: UsageMetric,
  providerType: ProviderType,
): number | null {
  if (usage === null || usage === undefined || !Number.isFinite(usage)) {
    return null;
  }
  if (providerType !== 'aws' && providerType !== 'gcp') {
    return null;
  }
  if (usageMetric === 'ec2_usage_hours_amount') {
    return Number((usage * 0.92).toFixed(2));
  }
  return Number((usage * 0.38).toFixed(2));
}

export const mockFinOpsDataSource: FinOpsDataSource = {
  async getTeams(): Promise<TeamItem[]> {
    return Promise.resolve(mockDataset.teams);
  },
  async getScopes(teamId?: string | null): Promise<ScopeItem[]> {
    return Promise.resolve(mockScopesForTeam(teamId ?? null));
  },
  async getCostTrends(filters: CraTrendQueryFilters): Promise<TrendPoint[]> {
    const allowedSlugs = new Set(
      mockScopesForTeam(filters.teamId ?? null).map(s => s.scope_slug),
    );
    return Promise.resolve(
      mockDataset.trends
        .filter(point => {
          if (point.period < filters.fromDate || point.period > filters.toDate) {
            return false;
          }
          if (!filters.providerTypes.includes(point.provider_type)) {
            return false;
          }
          if (filters.teamId && !allowedSlugs.has(point.scope_slug)) {
            return false;
          }
          if (filters.scopeSlug) {
            return point.scope_slug === filters.scopeSlug;
          }
          return true;
        })
        .map(point => {
          const usage_by_metric: Partial<Record<UsageMetric, number | null>> = {};
          for (const m of filters.usageMetrics) {
            usage_by_metric[m] = mockAdjustUsage(
              point.usage_value,
              m,
              point.provider_type,
            );
          }
          return {
            period: point.period,
            scope_slug: point.scope_slug,
            scope_name: point.scope_name,
            provider_type: point.provider_type,
            cost_value: mockAdjustCost(point.cost_value, filters.costMetric),
            usage_by_metric,
          };
        }),
    );
  },
  async getScopeTeamsBySlug(scopeSlugs: readonly string[]): Promise<Record<string, TeamItem[]>> {
    const out: Record<string, TeamItem[]> = {};
    for (const slug of scopeSlugs) {
      out[slug] = mockTeamsForScopeSlug(slug);
    }
    return Promise.resolve(out);
  },
};

function toProviderType(rawType: string | null | undefined, scopeSlug: string): ProviderType {
  const normalizedType = rawType?.toLowerCase();
  if (normalizedType === 'aws' || normalizedType === 'gcp' || normalizedType === 'dynatrace') {
    return normalizedType;
  }
  const normalizedSlug = scopeSlug.toLowerCase();
  if (normalizedSlug.includes('aws')) {
    return 'aws';
  }
  if (normalizedSlug.includes('gcp')) {
    return 'gcp';
  }
  if (normalizedSlug.includes('dynatrace')) {
    return 'dynatrace';
  }
  return 'other';
}

function normalizeScopes(rawScopes: RawScopeItem[]): ScopeItem[] {
  return rawScopes.map(scope => ({
    scope_slug: scope.scope_slug,
    scope_name: scope.scope_name,
    parent_scope_slug: scope.parent_scope_slug ?? null,
    type: toProviderType(scope.type, scope.scope_slug),
  }));
}

function mergeCostAndMultiUsageTrends(
  costTrends: RawTrendPoint[],
  usageTrendsByMetric: Map<UsageMetric, RawTrendPoint[]>,
  scopesBySlug: Map<string, ScopeItem>,
): TrendPoint[] {
  const usageMaps = new Map<UsageMetric, Map<string, number>>();
  for (const [metric, trends] of usageTrendsByMetric) {
    const m = new Map<string, number>();
    for (const point of trends) {
      m.set(`${String(point.period)}::${point.scope_slug}`, Number(point.metric_value));
    }
    usageMaps.set(metric, m);
  }

  return costTrends.map(point => {
    const scope = scopesBySlug.get(point.scope_slug);
    const key = `${String(point.period)}::${point.scope_slug}`;
    const usage_by_metric: Partial<Record<UsageMetric, number | null>> = {};
    for (const metric of usageTrendsByMetric.keys()) {
      const raw = usageMaps.get(metric)?.get(key);
      usage_by_metric[metric] =
        raw !== undefined && Number.isFinite(raw) ? raw : null;
    }
    return {
      period: String(point.period),
      scope_slug: point.scope_slug,
      scope_name: point.scope_name,
      provider_type: scope?.type ?? toProviderType(null, point.scope_slug),
      cost_value: Number(point.metric_value),
      usage_by_metric,
    };
  });
}

function baseTrendFilters(filters: CraTrendQueryFilters) {
  return {
    fromDate: filters.fromDate,
    toDate: filters.toDate,
    providerTypes: filters.providerTypes,
    scopeSlug: filters.scopeSlug,
    teamId: filters.teamId ?? null,
  };
}

export function createLiveFinOpsDataSource(
  fetchFn: typeof fetch,
  apiBaseUrl: string,
): FinOpsDataSource {
  return {
    async getTeams(): Promise<TeamItem[]> {
      return getTeams(fetchFn, apiBaseUrl);
    },
    async getScopes(teamId?: string | null): Promise<ScopeItem[]> {
      const rawScopes = await getScopes(fetchFn, apiBaseUrl, teamId ?? null);
      return normalizeScopes(rawScopes);
    },
    async getCostTrends(filters: CraTrendQueryFilters): Promise<TrendPoint[]> {
      const common = baseTrendFilters(filters);
      const costMetric = filters.costMetric;
      const usageMetrics = filters.usageMetrics;
      const teamId = filters.teamId ?? null;

      const usageCalls = usageMetrics.map(metric =>
        getTrends(fetchFn, apiBaseUrl, {
          ...common,
          metric,
        }).catch(() => [] as RawTrendPoint[]),
      );

      const [rawScopes, costTrends, ...usageTrendArrays] = await Promise.all([
        getScopes(fetchFn, apiBaseUrl, teamId),
        getTrends(fetchFn, apiBaseUrl, {
          ...common,
          metric: costMetric,
        }),
        ...usageCalls,
      ]);

      const scopes = normalizeScopes(rawScopes);
      const scopesBySlug = new Map(scopes.map(scope => [scope.scope_slug, scope]));

      const usageTrendsByMetric = new Map<UsageMetric, RawTrendPoint[]>();
      usageMetrics.forEach((metric, index) => {
        usageTrendsByMetric.set(metric, usageTrendArrays[index] ?? []);
      });

      return mergeCostAndMultiUsageTrends(costTrends, usageTrendsByMetric, scopesBySlug);
    },
    async getScopeTeamsBySlug(scopeSlugs: readonly string[]): Promise<Record<string, TeamItem[]>> {
      return getScopeTeamsBatch(fetchFn, apiBaseUrl, scopeSlugs);
    },
  };
}
