import type {
  AwsAccountsHistoricalPoint,
  Metric,
  QueryFilters,
  TeamItem,
  TeamMemberItem,
  TeamMemberRole,
} from './types';

export type RawScopeItem = {
  scope_slug: string;
  scope_name: string | null;
  type?: string | null;
  parent_scope_slug?: string | null;
};

export type RawTrendPoint = {
  period: string;
  scope_slug: string;
  scope_name: string | null;
  metric_value: string | number;
};

type RawTeamMember = {
  person_id: string;
  role: TeamMemberRole;
  name?: string | null;
  description?: string | null;
};

type RawTeamItem = {
  id: string;
  name: string;
  description?: string | null;
  members?: RawTeamMember[];
};

type RawScopeTeamsBatchItem = {
  scope_slug: string;
  teams?: RawTeamItem[];
};

function normalizeTeam(raw: RawTeamItem): TeamItem {
  return {
    id: raw.id,
    name: raw.name,
    description: raw.description ?? null,
    members: (raw.members ?? []).map(
      (m): TeamMemberItem => ({
        person_id: m.person_id,
        role: m.role,
        name: m.name ?? null,
        description: m.description ?? null,
      }),
    ),
  };
}

const API_PROXY_BASE = '/api/proxy/finops';

function buildQuery(filters: QueryFilters): string {
  const params = new URLSearchParams();
  params.set('from', filters.fromDate);
  params.set('to', filters.toDate);
  params.set('metric', filters.metric);
  params.set('grain', 'day');
  if (filters.scopeSlug) {
    params.set('scope', filters.scopeSlug);
  }
  if (filters.teamId) {
    params.set('team', filters.teamId);
  }
  return params.toString();
}

function finopsApiUrl(apiBaseUrl: string, path: string): string {
  return `${apiBaseUrl.replace(/\/$/, '')}${API_PROXY_BASE}${path}`;
}

export async function fetchJson<T>(
  fetchFn: typeof fetch,
  apiBaseUrl: string,
  path: string,
): Promise<T> {
  const url = finopsApiUrl(apiBaseUrl, path);
  let response: Response;
  try {
    response = await fetchFn(url);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(
      `FinOps API unreachable (${reason}). ` +
        `Check that the Backstage backend is running on ${apiBaseUrl} and that the ` +
        `\`/finops\` proxy is configured in app-config.yaml.`,
    );
  }
  if (!response.ok) {
    let detail = '';
    try {
      const body = (await response.json()) as { detail?: unknown };
      if (body?.detail !== undefined) {
        detail =
          typeof body.detail === 'string'
            ? body.detail
            : JSON.stringify(body.detail);
      }
    } catch {
      // ignore non-JSON error bodies
    }
    const suffix = detail ? `: ${detail}` : '';
    throw new Error(`API request failed (${response.status})${suffix}`);
  }
  return (await response.json()) as T;
}

export function getTeams(fetchFn: typeof fetch, apiBaseUrl: string): Promise<TeamItem[]> {
  return fetchJson<RawTeamItem[]>(fetchFn, apiBaseUrl, '/api/teams').then(rows =>
    rows.map(normalizeTeam),
  );
}

export async function getScopeTeamsBatch(
  fetchFn: typeof fetch,
  apiBaseUrl: string,
  scopeSlugs: readonly string[],
): Promise<Record<string, TeamItem[]>> {
  if (scopeSlugs.length === 0) {
    return {};
  }
  const params = new URLSearchParams();
  for (const slug of scopeSlugs) {
    if (slug) {
      params.append('scope_slug', slug);
    }
  }
  const qs = params.toString();
  const rows = await fetchJson<RawScopeTeamsBatchItem[]>(
    fetchFn,
    apiBaseUrl,
    `/api/scope-teams-batch?${qs}`,
  );
  const out: Record<string, TeamItem[]> = {};
  for (const row of rows) {
    out[row.scope_slug] = (row.teams ?? []).map(normalizeTeam);
  }
  return out;
}

export function getScopes(
  fetchFn: typeof fetch,
  apiBaseUrl: string,
  teamId?: string | null,
): Promise<RawScopeItem[]> {
  const suffix =
    teamId && teamId.length > 0
      ? `?team=${encodeURIComponent(teamId)}`
      : '';
  return fetchJson<RawScopeItem[]>(fetchFn, apiBaseUrl, `/api/scopes${suffix}`);
}

export function getTrends(
  fetchFn: typeof fetch,
  apiBaseUrl: string,
  filters: QueryFilters,
): Promise<RawTrendPoint[]> {
  const query = buildQuery(filters);
  return fetchJson<RawTrendPoint[]>(fetchFn, apiBaseUrl, `/api/trends?${query}`);
}

export function getSummary(
  fetchFn: typeof fetch,
  apiBaseUrl: string,
  filters: Omit<QueryFilters, 'metric'> & { metric: Metric },
): Promise<Record<string, unknown>> {
  const params = new URLSearchParams();
  params.set('from', filters.fromDate);
  params.set('to', filters.toDate);
  params.set('metric', filters.metric);
  if (filters.scopeSlug) {
    params.set('scope', filters.scopeSlug);
  }
  if (filters.teamId) {
    params.set('team', filters.teamId);
  }
  return fetchJson<Record<string, unknown>>(
    fetchFn,
    apiBaseUrl,
    `/api/summary?${params.toString()}`,
  );
}

export function getAwsAccountsHistorical(
  fetchFn: typeof fetch,
  apiBaseUrl: string,
  filters: { fromDate: string; toDate: string },
): Promise<AwsAccountsHistoricalPoint[]> {
  const params = new URLSearchParams();
  params.set('from', filters.fromDate);
  params.set('to', filters.toDate);
  return fetchJson<AwsAccountsHistoricalPoint[]>(
    fetchFn,
    apiBaseUrl,
    `/api/aws-accounts/historical?${params.toString()}`,
  );
}

export function getAwsAccountsLatestPeriod(
  fetchFn: typeof fetch,
  apiBaseUrl: string,
): Promise<{ period: string | null }> {
  return fetchJson<{ period: string | null }>(
    fetchFn,
    apiBaseUrl,
    '/api/aws-accounts/latest-period',
  );
}
