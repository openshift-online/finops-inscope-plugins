import { Grain, Metric, ScopeItem, ScopeTeamsBatchItem, SummaryQuery, SummaryResponse, TeamItem, TrendPoint, TrendQuery } from './types';
import { SnowflakeConnectionPool } from './snowflakeClient';
export declare function mapMetricToSnowflakeFilters(metric: Metric): {
    metricGroup: string;
    metricName: string;
};
export declare function validateMetric(metricRaw: string | undefined): Metric;
export declare function calculateSummary(currentTotal: number, previousTotal: number): {
    delta: number;
    deltaPercent: number | null;
};
export declare function teamScopeFilterSql(scopeSlugExpression?: string): string;
export declare class FinopsRepository {
    private readonly pool;
    private readonly tableFqn;
    private readonly dimTeamFqn;
    private readonly bridgeTeamScopeFqn;
    constructor(options: {
        pool: SnowflakeConnectionPool;
        tableFqn: string;
        dimTeamFqn: string;
        bridgeTeamScopeFqn: string;
    });
    listTeams(): Promise<TeamItem[]>;
    listTeamsForScopes(scopeSlugs: string[]): Promise<ScopeTeamsBatchItem[]>;
    listScopes(team?: string | null): Promise<ScopeItem[]>;
    getTrends(query: TrendQuery): Promise<TrendPoint[]>;
    getSummary(query: SummaryQuery): Promise<SummaryResponse>;
}
export declare function normalizeGrain(grainRaw: string | undefined): Grain;
