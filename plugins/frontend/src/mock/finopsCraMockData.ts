import type {
  FinOpsCraDataset,
  FinOpsCraMockTrendRow,
  ProviderType,
  ScopeItem,
  TeamItem,
} from '../types';

/** Mock team ids for the CRA fixture (live API uses `team_c_path` strings). */
export const MOCK_TEAM_FULL = 'mock-team-full';
export const MOCK_TEAM_AWS = 'mock-team-aws';

const mockTeams: TeamItem[] = [
  {
    id: MOCK_TEAM_FULL,
    name: 'Full platform (mock)',
    description: 'All example scopes in the mock dataset.',
    members: [
      { person_id: 'dev_lead', role: 'manager' },
      { person_id: 'pm_one', role: 'product_manager' },
      { person_id: 'tl_obs', role: 'team_lead' },
    ],
  },
  {
    id: MOCK_TEAM_AWS,
    name: 'RHOBS AWS subtree (mock)',
    description:
      'Mirrors a team allocated to slug `rhobs.aws`: charts include that slug and every `rhobs.aws.*` child.',
    members: [{ person_id: 'aws_owner', role: 'team_lead' }],
  },
];

/** Allocated scope slugs for MOCK_TEAM_AWS (API uses the same slug-prefix rule on live data). */
const MOCK_TEAM_AWS_ROOT_SLUGS = ['rhobs.aws'] as const;

/** Full mock team: every example scope sits under this root (matches live bridge prefix semantics). */
const MOCK_TEAM_FULL_ROOT_SLUGS = ['rhobs'] as const;

function scopeSlugUnderAllocatedRoots(slug: string, roots: readonly string[]): boolean {
  return roots.some(root => slug === root || slug.startsWith(`${root}.`));
}

/** Teams whose allocation roots cover ``scopeSlug`` (for per-scope chart attribution). */
export function mockTeamsForScopeSlug(scopeSlug: string): TeamItem[] {
  const byId = new Map<string, TeamItem>();
  if (scopeSlugUnderAllocatedRoots(scopeSlug, MOCK_TEAM_FULL_ROOT_SLUGS)) {
    byId.set(mockTeams[0]!.id, mockTeams[0]!);
  }
  if (scopeSlugUnderAllocatedRoots(scopeSlug, MOCK_TEAM_AWS_ROOT_SLUGS)) {
    byId.set(mockTeams[1]!.id, mockTeams[1]!);
  }
  return [...byId.values()];
}

function toIsoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

const scopes: ScopeItem[] = [
  { scope_slug: 'rhobs.aws.prod', scope_name: 'RHOBS AWS Prod', type: 'aws' },
  { scope_slug: 'rhobs.aws.dev', scope_name: 'RHOBS AWS Dev', type: 'aws' },
  { scope_slug: 'rhobs.gcp.analytics', scope_name: 'RHOBS GCP Analytics', type: 'gcp' },
  {
    scope_slug: 'rhobs.dynatrace.global',
    scope_name: 'RHOBS Dynatrace Global',
    type: 'dynatrace',
  },
];

export function mockScopesForTeam(teamId: string | null | undefined): ScopeItem[] {
  if (!teamId) {
    return scopes;
  }
  if (teamId === MOCK_TEAM_FULL) {
    return scopes;
  }
  if (teamId === MOCK_TEAM_AWS) {
    return scopes.filter(s => scopeSlugUnderAllocatedRoots(s.scope_slug, MOCK_TEAM_AWS_ROOT_SLUGS));
  }
  return [];
}

function baseCost(providerType: ProviderType): number {
  if (providerType === 'aws') {
    return 180;
  }
  if (providerType === 'gcp') {
    return 125;
  }
  return 95;
}

function usageHoursForScope(scopeType: ProviderType): number | null {
  if (scopeType === 'aws' || scopeType === 'gcp') {
    return scopeType === 'aws' ? 520 : 380;
  }
  return null;
}

function generateTrend(scope: ScopeItem, days: number): FinOpsCraMockTrendRow[] {
  const points: FinOpsCraMockTrendRow[] = [];
  const now = new Date();
  const usageBase = usageHoursForScope(scope.type);
  for (let idx = days - 1; idx >= 0; idx -= 1) {
    const date = new Date(now);
    date.setDate(now.getDate() - idx);
    const dayOffset = days - idx;
    const seasonality = Math.sin(dayOffset / 5) * 18;
    const trend = dayOffset * 0.45;
    const costValue = Number((baseCost(scope.type) + seasonality + trend).toFixed(2));
    const usageValue =
      usageBase === null
        ? null
        : Number((usageBase + Math.cos(dayOffset / 7) * 45 + dayOffset * 0.65).toFixed(2));
    points.push({
      period: toIsoDate(date),
      scope_slug: scope.scope_slug,
      scope_name: scope.scope_name,
      provider_type: scope.type,
      cost_value: costValue,
      usage_value: usageValue,
    });
  }
  return points;
}

export function createMockFinOpsCraDataset(): FinOpsCraDataset {
  return {
    scopes,
    teams: mockTeams,
    trends: scopes.flatMap(scope => generateTrend(scope, 90)),
  };
}
