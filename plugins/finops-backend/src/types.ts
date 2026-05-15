export type TeamMemberRole = 'team_lead' | 'manager' | 'product_manager';

export type TeamMemberItem = {
  person_id: string;
  role: TeamMemberRole;
  name?: string | null;
  description?: string | null;
};

export type TeamItem = {
  id: string;
  name: string;
  description?: string | null;
  members: TeamMemberItem[];
};

export type ScopeItem = {
  scope_slug: string;
  scope_name: string | null;
  type?: string | null;
  parent_scope_slug?: string | null;
};

export type ScopeTeamsBatchItem = {
  scope_slug: string;
  teams: TeamItem[];
};

export type TrendPoint = {
  period: string;
  scope_slug: string;
  scope_name: string | null;
  metric_value: number;
};

export type Metric =
  | 'unblended_amount'
  | 'amortized_amount'
  | 'ec2_usage_hours_amount'
  | 'rds_usage_hours_amount';

export type Grain = 'day' | 'week' | 'month';

export type SummaryResponse = {
  metric: Metric;
  scope: string | null;
  start_date: string;
  end_date: string;
  total: number;
  previous_total: number;
  delta: number;
  delta_percent: number | null;
};

export type TrendQuery = {
  fromDate: string;
  toDate: string;
  metric: Metric;
  grain: Grain;
  scope?: string | null;
  team?: string | null;
};

export type SummaryQuery = {
  fromDate: string;
  toDate: string;
  metric: Metric;
  scope?: string | null;
  team?: string | null;
};

export type AwsAccountsHistoricalPoint = {
  period: string;
  payer_account_id: string;
  active_count: number;
  closed_count: number;
  deleted_count: number;
};

export type AwsAccountsLatestPeriodResponse = {
  period: string | null;
};

export type AwsAccountsHistoricalQuery = {
  fromDate: string;
  toDate: string;
};
