export type Metric =
  | 'unblended_amount'
  | 'amortized_amount'
  | 'ec2_usage_hours_amount'
  | 'rds_usage_hours_amount';

/** Cost series shown on the CRA trend chart (maps to API `metric`). */
export type CostMetric = 'unblended_amount' | 'amortized_amount';

/** Usage series on the chart (maps to API `metric`). */
export type UsageMetric = 'ec2_usage_hours_amount' | 'rds_usage_hours_amount';

/** All usage metrics the CRA UI can request (order is stable for labels). */
export const ALL_USAGE_METRICS: readonly UsageMetric[] = [
  'ec2_usage_hours_amount',
  'rds_usage_hours_amount',
];

export function usageMetricShortLabel(metric: UsageMetric): string {
  if (metric === 'rds_usage_hours_amount') {
    return 'RDS usage hours';
  }
  return 'EC2 usage hours';
}

/** Filters passed to `FinOpsDataSource.getCostTrends` (includes metric choices). */
export type CraTrendQueryFilters = {
  fromDate: string;
  toDate: string;
  providerTypes: ProviderType[];
  /** When `null`, trends are loaded for every scope (API omits `scope`); never pass `''`. */
  scopeSlug: string | null;
  teamId?: string | null;
  costMetric: CostMetric;
  /** Empty = cost-only (no usage API calls). */
  usageMetrics: UsageMetric[];
};

export type ProviderType = 'aws' | 'gcp' | 'dynatrace' | 'other';
export type QuickDatePreset = 'current_month' | 'past_month' | 'last_30_days';

export type ScopeItem = {
  scope_slug: string;
  scope_name: string | null;
  type: ProviderType;
  parent_scope_slug?: string | null;
};

export type TeamMemberRole = 'manager' | 'product_manager' | 'team_lead';

export type TeamMemberItem = {
  person_id: string;
  role: TeamMemberRole;
  name?: string | null;
  description?: string | null;
};

/** Team from Scope Cost API (`id` is `team_c_path` in Snowflake). */
export type TeamItem = {
  id: string;
  name: string;
  description?: string | null;
  members?: TeamMemberItem[];
};

export type TrendPoint = {
  period: string;
  scope_slug: string;
  scope_name: string | null;
  provider_type: ProviderType;
  cost_value: number;
  /** Usage hours per requested metric; missing key = not requested. */
  usage_by_metric: Partial<Record<UsageMetric, number | null>>;
};

export type SummaryResponse = {
  total_cost: number;
  previous_total_cost: number;
  delta_cost: number;
};

export type QueryFilters = {
  fromDate: string;
  toDate: string;
  metric: Metric;
  providerTypes: ProviderType[];
  scopeSlug: string | null;
  /** When set, passed as `team` to the CRA API once supported. */
  teamId?: string | null;
};
