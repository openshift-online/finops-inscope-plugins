import { Box, Checkbox, Flex, FieldLabel } from '@backstage/ui';
import { FinOpsDateRangeFilters } from '../../shared/FinOpsDateRangeFilters';
import {
  ALL_USAGE_METRICS,
  type CostMetric,
  type ProviderType,
  type ScopeItem,
  type TeamItem,
  type UsageMetric,
  usageMetricShortLabel,
} from '../../../types';

type FinOpsCraFiltersProps = {
  fromDate: string;
  toDate: string;
  onFromDateChange: (value: string) => void;
  onToDateChange: (value: string) => void;
  selectedProviderTypes: ProviderType[];
  onToggleProviderType: (providerType: ProviderType) => void;
  onApplyLastThirtyDays: () => void;
  onApplyCurrentMonth: () => void;
  onApplyPastMonth: () => void;
  onApplyLastSevenDaysOfData: () => void | Promise<void>;
  dateRangeMessage?: string | null;
  onApplyDateRange: () => void;
  applyDateRangeDisabled?: boolean;
  teams: TeamItem[];
  selectedTeamId: string;
  onTeamChange: (teamId: string) => void;
  scopes: ScopeItem[];
  selectedScopeSlug: string;
  onScopeChange: (scopeSlug: string) => void;
  costMetric: CostMetric;
  onCostMetricChange: (metric: CostMetric) => void;
  selectedUsageMetrics: UsageMetric[];
  onToggleUsageMetric: (metric: UsageMetric) => void;
};

const providerLabels: Record<ProviderType, string> = {
  aws: 'AWS',
  gcp: 'GCP',
  dynatrace: 'Dynatrace',
  other: 'Other',
};

const providerTypes = Object.keys(providerLabels) as ProviderType[];

export function FinOpsCraFilters(props: FinOpsCraFiltersProps) {
  return (
    <Flex direction="column" gap="5">
      <FinOpsDateRangeFilters
        idPrefix="finops-cra"
        fromDate={props.fromDate}
        toDate={props.toDate}
        onFromDateChange={props.onFromDateChange}
        onToDateChange={props.onToDateChange}
        onApplyLastThirtyDays={props.onApplyLastThirtyDays}
        onApplyCurrentMonth={props.onApplyCurrentMonth}
        onApplyPastMonth={props.onApplyPastMonth}
        onApplyLastSevenDaysOfData={props.onApplyLastSevenDaysOfData}
        dateRangeMessage={props.dateRangeMessage}
        onApplyDateRange={props.onApplyDateRange}
        applyDateRangeDisabled={props.applyDateRangeDisabled}
      />

      <Box>
        <FieldLabel label="Provider type" />
        <Flex direction="column" gap="2" style={{ marginTop: 8 }}>
          {providerTypes.map(providerType => (
            <Checkbox
              key={providerType}
              isSelected={props.selectedProviderTypes.includes(providerType)}
              onChange={isSelected => {
                const selected = props.selectedProviderTypes.includes(providerType);
                if (isSelected !== selected) {
                  props.onToggleProviderType(providerType);
                }
              }}
            >
              {providerLabels[providerType]}
            </Checkbox>
          ))}
        </Flex>
      </Box>

      <Box>
        <FieldLabel
          label="Team"
          htmlFor="finops-cra-team"
          description="Narrows scopes and cost trends to scopes allocated to the team (from team allocation data)."
        />
        <select
          id="finops-cra-team"
          aria-label="Team"
          value={props.selectedTeamId}
          onChange={event => props.onTeamChange(event.target.value)}
          disabled={props.teams.length === 0}
          style={{ marginTop: 8, width: '100%', maxWidth: '100%' }}
        >
          <option value="">All teams</option>
          {props.teams.map(team => (
            <option key={team.id} value={team.id}>
              {team.name}
            </option>
          ))}
        </select>
      </Box>

      <Box>
        <FieldLabel label="Scope" htmlFor="finops-cra-scope" />
        <select
          id="finops-cra-scope"
          aria-label="Scope"
          value={props.selectedScopeSlug}
          onChange={event => props.onScopeChange(event.target.value)}
          disabled={props.scopes.length === 0}
          style={{ marginTop: 8, width: '100%', maxWidth: '100%' }}
        >
          <option value="">All scopes</option>
          {props.scopes.map(scope => (
            <option key={scope.scope_slug} value={scope.scope_slug}>
              {scope.scope_name || scope.scope_slug}
            </option>
          ))}
        </select>
      </Box>

      <Box>
        <FieldLabel
          label="Cost metric"
          htmlFor="finops-cra-cost-metric"
          description="Matches the scope-cost API metric (daily grain)."
        />
        <select
          id="finops-cra-cost-metric"
          aria-label="Cost metric"
          value={props.costMetric}
          onChange={event => props.onCostMetricChange(event.target.value as CostMetric)}
          style={{ marginTop: 8, width: '100%', maxWidth: '100%' }}
        >
          <option value="unblended_amount">Unblended cost</option>
          <option value="amortized_amount">Amortized cost</option>
        </select>
      </Box>

      <Box>
        <FieldLabel
          label="Usage metrics"
          description="Select one or more Cost Explorer usage series (hours). Uncheck all for cost-only."
        />
        <Flex direction="column" gap="2" style={{ marginTop: 8 }}>
          {ALL_USAGE_METRICS.map(metric => (
            <Checkbox
              key={metric}
              isSelected={props.selectedUsageMetrics.includes(metric)}
              onChange={isSelected => {
                const selected = props.selectedUsageMetrics.includes(metric);
                if (isSelected !== selected) {
                  props.onToggleUsageMetric(metric);
                }
              }}
            >
              {usageMetricShortLabel(metric)}
            </Checkbox>
          ))}
        </Flex>
      </Box>
    </Flex>
  );
}
