import {
  AwsAccountsHistoricalPoint,
  AwsAccountsHistoricalQuery,
  AwsAccountsLatestPeriodResponse,
  Grain,
  Metric,
  ScopeItem,
  ScopeTeamsBatchItem,
  SummaryQuery,
  SummaryResponse,
  TeamItem,
  TeamMemberItem,
  TeamMemberRole,
  TrendPoint,
  TrendQuery,
} from './types';
import { SnowflakeConnectionPool } from './snowflakeClient';
import * as snowflake from 'snowflake-sdk';

type SnowflakeRow = Record<string, unknown>;

const VALID_METRICS: Metric[] = [
  'unblended_amount',
  'amortized_amount',
  'ec2_usage_hours_amount',
  'rds_usage_hours_amount',
];

function rowValue<T>(row: SnowflakeRow, key: string): T | undefined {
  return (row[key] ?? row[key.toUpperCase()] ?? row[key.toLowerCase()]) as T | undefined;
}

function toDateString(value: unknown): string {
  if (value instanceof Date) {
    const year = value.getUTCFullYear();
    const month = String(value.getUTCMonth() + 1).padStart(2, '0');
    const day = String(value.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  const text = String(value ?? '').trim();
  const isoPrefix = text.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(isoPrefix)) {
    return isoPrefix;
  }
  const parsed = Date.parse(text);
  if (Number.isFinite(parsed)) {
    const dt = new Date(parsed);
    const year = dt.getUTCFullYear();
    const month = String(dt.getUTCMonth() + 1).padStart(2, '0');
    const day = String(dt.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  return isoPrefix;
}

function toNumber(value: unknown): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function optionalTrimmedString(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

function parsePeopleVariant(value: unknown): Array<{ id: string; name?: string | null; description?: string | null }> {
  if (value === null || value === undefined) {
    return [];
  }

  const parsed = (() => {
    if (Array.isArray(value)) {
      return value;
    }
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) {
        return [];
      }
      if (trimmed.startsWith('[')) {
        try {
          const decoded = JSON.parse(trimmed);
          return Array.isArray(decoded) ? decoded : [];
        } catch {
          return [trimmed];
        }
      }
      return [trimmed];
    }
    return [value];
  })();

  const output: Array<{ id: string; name?: string | null; description?: string | null }> = [];
  for (const item of parsed) {
    if (item === null || item === undefined) {
      continue;
    }
    if (typeof item === 'object' && !Array.isArray(item)) {
      const record = item as Record<string, unknown>;
      const rawId = record.id ?? record.person_id;
      if (!rawId) {
        continue;
      }
      output.push({
        id: String(rawId).trim(),
        name: optionalTrimmedString(record.name),
        description: optionalTrimmedString(record.description),
      });
      continue;
    }
    const id = String(item).trim();
    if (id) {
      output.push({ id, name: null, description: null });
    }
  }
  return output;
}

function parseMembers(
  managers: unknown,
  productManagers: unknown,
  teamLeads: unknown,
): TeamMemberItem[] {
  const toMembers = (
    refs: Array<{ id: string; name?: string | null; description?: string | null }>,
    role: TeamMemberRole,
  ): TeamMemberItem[] =>
    refs.map(ref => ({
      person_id: ref.id,
      role,
      name: ref.name ?? null,
      description: ref.description ?? null,
    }));

  return [
    ...toMembers(parsePeopleVariant(managers), 'manager'),
    ...toMembers(parsePeopleVariant(productManagers), 'product_manager'),
    ...toMembers(parsePeopleVariant(teamLeads), 'team_lead'),
  ];
}

export function mapMetricToSnowflakeFilters(metric: Metric): {
  metricGroup: string;
  metricName: string;
} {
  switch (metric) {
    case 'unblended_amount':
      return { metricGroup: 'costs', metricName: 'unblended' };
    case 'amortized_amount':
      return { metricGroup: 'costs', metricName: 'amortized' };
    case 'ec2_usage_hours_amount':
      return { metricGroup: 'usage', metricName: 'ec2_usage_hours' };
    case 'rds_usage_hours_amount':
      return { metricGroup: 'usage', metricName: 'rds_usage_hours' };
    default:
      throw new Error(`Invalid metric: ${metric}`);
  }
}

export function validateMetric(metricRaw: string | undefined): Metric {
  if (!metricRaw || !VALID_METRICS.includes(metricRaw as Metric)) {
    throw new Error(`Invalid metric: ${metricRaw ?? '<missing>'}`);
  }
  return metricRaw as Metric;
}

function previousWindow(range: { fromDate: string; toDate: string }): { fromDate: string; toDate: string } {
  const from = new Date(`${range.fromDate}T00:00:00.000Z`);
  const to = new Date(`${range.toDate}T00:00:00.000Z`);
  const windowDays = Math.max(1, Math.floor((to.getTime() - from.getTime()) / 86_400_000) + 1);
  const previousTo = new Date(from);
  previousTo.setUTCDate(previousTo.getUTCDate() - 1);
  const previousFrom = new Date(previousTo);
  previousFrom.setUTCDate(previousFrom.getUTCDate() - windowDays + 1);
  return {
    fromDate: previousFrom.toISOString().slice(0, 10),
    toDate: previousTo.toISOString().slice(0, 10),
  };
}

export function calculateSummary(currentTotal: number, previousTotal: number): {
  delta: number;
  deltaPercent: number | null;
} {
  const delta = Number((currentTotal - previousTotal).toFixed(2));
  if (!Number.isFinite(previousTotal) || previousTotal === 0) {
    return { delta, deltaPercent: null };
  }
  return {
    delta,
    deltaPercent: Number(((delta / previousTotal) * 100).toFixed(2)),
  };
}

export function teamScopeFilterSql(scopeSlugExpression = 'scope_slug'): string {
  return `exists (
    select 1
    from bridge_table b
    where b.team_c_path = ?
      and b.scope_slug is not null
      and (
        ${scopeSlugExpression} = b.scope_slug
        or ${scopeSlugExpression} like b.scope_slug || '.%'
      )
  )`;
}

function parentScopeSlug(scopeSlug: string): string | null {
  const idx = scopeSlug.lastIndexOf('.');
  return idx === -1 ? null : scopeSlug.slice(0, idx);
}

export class FinopsRepository {
  private readonly pool: SnowflakeConnectionPool;
  private readonly tableFqn: string;
  private readonly dimTeamFqn: string;
  private readonly bridgeTeamScopeFqn: string;
  private readonly awsAccountsHistoricalFqn: string;

  constructor(options: {
    pool: SnowflakeConnectionPool;
    tableFqn: string;
    dimTeamFqn: string;
    bridgeTeamScopeFqn: string;
    awsAccountsHistoricalFqn: string;
  }) {
    this.pool = options.pool;
    this.tableFqn = options.tableFqn;
    this.dimTeamFqn = options.dimTeamFqn;
    this.bridgeTeamScopeFqn = options.bridgeTeamScopeFqn;
    this.awsAccountsHistoricalFqn = options.awsAccountsHistoricalFqn;
  }

  async listTeams(): Promise<TeamItem[]> {
    const sql = `
      select
        team_c_path as team_c_path,
        team_name as team_name,
        nullif(trim(team_description), '') as team_description,
        managers as managers,
        product_managers as product_managers,
        team_leads as team_leads
      from ${this.dimTeamFqn}
      order by team_name nulls last, team_c_path
    `;
    const rows = await this.pool.execute<SnowflakeRow>(sql);
    return rows.map(row => ({
      id: String(rowValue(row, 'team_c_path') ?? ''),
      name: String(rowValue(row, 'team_name') ?? rowValue(row, 'team_c_path') ?? ''),
      description: optionalTrimmedString(rowValue(row, 'team_description')),
      members: parseMembers(
        rowValue(row, 'managers'),
        rowValue(row, 'product_managers'),
        rowValue(row, 'team_leads'),
      ),
    }));
  }

  async listTeamsForScopes(scopeSlugs: string[]): Promise<ScopeTeamsBatchItem[]> {
    if (scopeSlugs.length === 0) {
      return [];
    }
    const orderedUnique = [...new Set(scopeSlugs)];
    const payload = JSON.stringify(orderedUnique);
    const sql = `
      with requested(for_scope) as (
        select f.value::string as for_scope
        from table(flatten(input => parse_json(?))) f
      )
      select
        r.for_scope as for_scope,
        d.team_c_path as team_c_path,
        d.team_name as team_name,
        nullif(trim(d.team_description), '') as team_description,
        d.managers as managers,
        d.product_managers as product_managers,
        d.team_leads as team_leads
      from requested r
      inner join ${this.bridgeTeamScopeFqn} b
        on r.for_scope = b.scope_slug
        or r.for_scope like b.scope_slug || '.%'
      inner join ${this.dimTeamFqn} d
        on d.team_c_path = b.team_c_path
      order by r.for_scope, d.team_name nulls last, d.team_c_path
    `;
    const rows = await this.pool.execute<SnowflakeRow>(sql, [payload]);
    const byScope = new Map<string, Map<string, TeamItem>>();
    for (const row of rows) {
      const scopeSlug = String(rowValue(row, 'for_scope') ?? '');
      const teamId = String(rowValue(row, 'team_c_path') ?? '');
      if (!scopeSlug || !teamId) {
        continue;
      }
      const teams = byScope.get(scopeSlug) ?? new Map<string, TeamItem>();
      if (!teams.has(teamId)) {
        teams.set(teamId, {
          id: teamId,
          name: String(rowValue(row, 'team_name') ?? teamId),
          description: optionalTrimmedString(rowValue(row, 'team_description')),
          members: parseMembers(
            rowValue(row, 'managers'),
            rowValue(row, 'product_managers'),
            rowValue(row, 'team_leads'),
          ),
        });
      }
      byScope.set(scopeSlug, teams);
    }

    return orderedUnique.map(scopeSlug => ({
      scope_slug: scopeSlug,
      teams: [...(byScope.get(scopeSlug)?.values() ?? [])],
    }));
  }

  async listScopes(team?: string | null): Promise<ScopeItem[]> {
    const params: snowflake.Bind[] = [];
    let teamClause = '';
    if (team) {
      teamClause = `and ${teamScopeFilterSql('f.scope_slug').replaceAll(
        'bridge_table',
        this.bridgeTeamScopeFqn,
      )}`;
      params.push(team);
    }

    const sql = `
      select
        f.scope_slug as scope_slug,
        max(nullif(f.scope_name, '')) as scope_name,
        max(f.scope_type) as scope_type
      from ${this.tableFqn} f
      where f.scope_slug is not null
      ${teamClause}
      group by f.scope_slug
      order by f.scope_slug
    `;
    const rows = await this.pool.execute<SnowflakeRow>(sql, params);
    return rows.map(row => {
      const scopeSlug = String(rowValue(row, 'scope_slug') ?? '');
      return {
        scope_slug: scopeSlug,
        scope_name: optionalTrimmedString(rowValue(row, 'scope_name')),
        type: optionalTrimmedString(rowValue(row, 'scope_type')),
        parent_scope_slug: parentScopeSlug(scopeSlug),
      };
    });
  }

  async getTrends(query: TrendQuery): Promise<TrendPoint[]> {
    const { metricGroup, metricName } = mapMetricToSnowflakeFilters(query.metric);
    const params: snowflake.Bind[] = [query.fromDate, query.toDate, metricGroup, metricName];
    let scopeClause = '';
    if (query.scope) {
      scopeClause = 'and f.scope_slug = ?';
      params.push(query.scope);
    }
    let teamClause = '';
    if (query.team) {
      teamClause = `and ${teamScopeFilterSql('f.scope_slug').replaceAll(
        'bridge_table',
        this.bridgeTeamScopeFqn,
      )}`;
      params.push(query.team);
    }

    const sql = `
      select
        date_trunc('${query.grain}', f.usage_date)::date as period,
        f.scope_slug as scope_slug,
        nullif(f.scope_name, '') as scope_name,
        coalesce(sum(f.metric_amount), 0) as metric_value
      from ${this.tableFqn} f
      where f.usage_date between ? and ?
        and f.metric_group = ?
        and f.metric_name = ?
        ${scopeClause}
        ${teamClause}
      group by 1, 2, 3
      order by 1, 2
    `;
    const rows = await this.pool.execute<SnowflakeRow>(sql, params);
    return rows.map(row => ({
      period: toDateString(rowValue(row, 'period')),
      scope_slug: String(rowValue(row, 'scope_slug') ?? ''),
      scope_name: optionalTrimmedString(rowValue(row, 'scope_name')),
      metric_value: Number(toNumber(rowValue(row, 'metric_value')).toFixed(2)),
    }));
  }

  async getSummary(query: SummaryQuery): Promise<SummaryResponse> {
    const previousRange = previousWindow({ fromDate: query.fromDate, toDate: query.toDate });
    const { metricGroup, metricName } = mapMetricToSnowflakeFilters(query.metric);

    const teamClause = query.team
      ? `and ${teamScopeFilterSql('f.scope_slug').replaceAll('bridge_table', this.bridgeTeamScopeFqn)}`
      : '';
    const scopeClause = query.scope ? 'and f.scope_slug = ?' : '';

    const params: snowflake.Bind[] = [query.fromDate, query.toDate, metricGroup, metricName];
    if (query.scope) {
      params.push(query.scope);
    }
    if (query.team) {
      params.push(query.team);
    }
    params.push(previousRange.fromDate, previousRange.toDate, metricGroup, metricName);
    if (query.scope) {
      params.push(query.scope);
    }
    if (query.team) {
      params.push(query.team);
    }

    const sql = `
      with current_window as (
        select coalesce(sum(f.metric_amount), 0) as total
        from ${this.tableFqn} f
        where f.usage_date between ? and ?
          and f.metric_group = ?
          and f.metric_name = ?
          ${scopeClause}
          ${teamClause}
      ),
      previous_window as (
        select coalesce(sum(f.metric_amount), 0) as total
        from ${this.tableFqn} f
        where f.usage_date between ? and ?
          and f.metric_group = ?
          and f.metric_name = ?
          ${scopeClause}
          ${teamClause}
      )
      select
        current_window.total as current_total,
        previous_window.total as previous_total
      from current_window
      cross join previous_window
    `;
    const rows = await this.pool.execute<SnowflakeRow>(sql, params);
    const first = rows[0] ?? {};
    const currentTotal = Number(toNumber(rowValue(first, 'current_total')).toFixed(2));
    const previousTotal = Number(toNumber(rowValue(first, 'previous_total')).toFixed(2));
    const { delta, deltaPercent } = calculateSummary(currentTotal, previousTotal);

    return {
      metric: query.metric,
      scope: query.scope ?? null,
      start_date: query.fromDate,
      end_date: query.toDate,
      total: currentTotal,
      previous_total: previousTotal,
      delta,
      delta_percent: deltaPercent,
    };
  }

  async getAwsAccountsHistorical(
    query: AwsAccountsHistoricalQuery,
  ): Promise<AwsAccountsHistoricalPoint[]> {
    const sql = `
      with filtered as (
        select *
        from ${this.awsAccountsHistoricalFqn}
        where timestamp::date between ? and ?
      ),
      deduped as (
        select *
        from filtered
        qualify row_number() over (
          partition by payer_account_id, timestamp::date
          order by run_id desc
        ) = 1
      )
      select
        timestamp::date as period,
        payer_account_id,
        nb_active_accounts as active_count,
        nb_closed_accounts as closed_count,
        nb_deleted_accounts as deleted_count
      from deduped
      order by period, payer_account_id
    `;
    const rows = await this.pool.execute<SnowflakeRow>(sql, [
      query.fromDate,
      query.toDate,
    ]);
    return rows.map(row => ({
      period: toDateString(rowValue(row, 'period')),
      payer_account_id: String(rowValue(row, 'payer_account_id') ?? ''),
      active_count: toNumber(rowValue(row, 'active_count')),
      closed_count: toNumber(rowValue(row, 'closed_count')),
      deleted_count: toNumber(rowValue(row, 'deleted_count')),
    }));
  }

  async getAwsAccountsLatestPeriod(): Promise<AwsAccountsLatestPeriodResponse> {
    const sql = `
      select max(timestamp)::date as period
      from ${this.awsAccountsHistoricalFqn}
    `;
    const rows = await this.pool.execute<SnowflakeRow>(sql);
    const periodRaw = rowValue(rows[0], 'period');
    if (periodRaw === null || periodRaw === undefined) {
      return { period: null };
    }
    return { period: toDateString(periodRaw) };
  }
}

export function normalizeGrain(grainRaw: string | undefined): Grain {
  if (!grainRaw || grainRaw === 'day' || grainRaw === 'week' || grainRaw === 'month') {
    return (grainRaw ?? 'day') as Grain;
  }
  throw new Error(`Invalid grain: ${grainRaw}`);
}
