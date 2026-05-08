import { Progress } from '@backstage/core-components';
import { configApiRef, fetchApiRef, useApi } from '@backstage/frontend-plugin-api';
import {
  Box,
  Card,
  CardBody,
  CardHeader,
  Container,
  Flex,
  FullPage,
  Header,
  Text,
} from '@backstage/ui';
import { useMemo, useState, type ReactNode } from 'react';
import { createLiveFinOpsDataSource, type FinOpsDataSource } from '../../data/finopsDataSource';
import { FinOpsCraFilters } from './components/FinOpsCraFilters';
import { FinOpsCraScopeCostHeader } from './components/FinOpsCraScopeCostHeader';
import { FinOpsCraScopeTeamsSection } from './components/FinOpsCraScopeTeamsSection';
import { FinOpsCraTrendChart } from './components/FinOpsCraTrendChart';
import { useFinOpsCraData } from './hooks/useFinOpsCraData';

export type FinOpsCRAPageProps = {
  /** For tests; production uses live API via Backstage proxy when unset. */
  dataSource?: FinOpsDataSource;
};

function pageChrome(children: ReactNode) {
  return (
    <>
      <Header title="FinOps Cloud Resources Attribution" />
      <FullPage>
        <Container py="6">{children}</Container>
      </FullPage>
    </>
  );
}

export const FinOpsCRAPage = (props: FinOpsCRAPageProps = {}) => {
  const { fetch } = useApi(fetchApiRef);
  const configApi = useApi(configApiRef);
  const backendBaseUrl = configApi.getOptionalString('backend.baseUrl') ?? '';
  const liveDataSource = useMemo(
    () => createLiveFinOpsDataSource(fetch, backendBaseUrl),
    [backendBaseUrl, fetch],
  );
  const dataSource = props.dataSource ?? liveDataSource;
  const model = useFinOpsCraData(dataSource);
  const [teamsPopupScopeSlug, setTeamsPopupScopeSlug] = useState<string | null>(null);

  if (!props.dataSource && !backendBaseUrl) {
    return pageChrome(
      <p>
        <code>backend.baseUrl</code> is not set in app config; the FinOps page cannot reach the
        Backstage proxy.
      </p>,
    );
  }

  if (model.loading) {
    return pageChrome(<Progress />);
  }

  if (model.error) {
    const message =
      model.error instanceof Error ? model.error.message : String(model.error);
    return pageChrome(
      <>
        <p>Failed to load FinOps CRA data.</p>
        <p style={{ color: '#b91c1c', fontFamily: 'monospace', fontSize: 13 }}>{message}</p>
      </>,
    );
  }

  return (
    <>
      <Header title="FinOps Cloud Resources Attribution" />
      <FullPage>
        <Container py="6">
          <Flex direction={{ initial: 'column', md: 'row' }} gap={{ initial: '4', md: '6' }} align="start">
            <Box
              width={{ initial: '100%', md: 'auto' }}
              maxWidth={{ initial: 'min(100%, 19rem)', md: '19rem' }}
              mx={{ initial: 'auto', md: '0' }}
              style={{ flexShrink: 0 }}
            >
              <Card>
                <CardHeader>
                  <Text as="h2" variant="title-small" weight="bold">
                    Filters
                  </Text>
                </CardHeader>
                <CardBody>
                  <FinOpsCraFilters
                    fromDate={model.fromDate}
                    toDate={model.toDate}
                    onFromDateChange={model.setFromDate}
                    onToDateChange={model.setToDate}
                    selectedProviderTypes={model.selectedProviderTypes}
                    onToggleProviderType={model.toggleProviderType}
                    onApplyLastThirtyDays={() => model.applyQuickPreset('last_30_days')}
                    onApplyCurrentMonth={() => model.applyQuickPreset('current_month')}
                    onApplyPastMonth={() => model.applyQuickPreset('past_month')}
                    onApplyLastSevenDaysOfData={model.applyLastSevenDaysOfData}
                    teams={model.teams}
                    selectedTeamId={model.selectedTeamId}
                    onTeamChange={model.setSelectedTeamId}
                    scopes={model.scopes}
                    selectedScopeSlug={model.selectedScopeSlug}
                    onScopeChange={model.setSelectedScopeSlug}
                    costMetric={model.costMetric}
                    onCostMetricChange={model.setCostMetric}
                    selectedUsageMetrics={model.selectedUsageMetrics}
                    onToggleUsageMetric={model.toggleUsageMetric}
                  />
                </CardBody>
              </Card>
            </Box>
            <Box width={{ md: '100%' }} style={{ flex: 1, minWidth: 0 }}>
              <Flex direction="column" gap="6">
                {model.scopeTeamsAttributionError ? (
                  <Text as="p" variant="body-small" color="secondary">
                    Team attribution for scopes could not be loaded.
                  </Text>
                ) : null}
                {model.scopeTrendCharts.length === 0 ? (
                  <p>No scopes match the current provider filters.</p>
                ) : (
                  model.scopeTrendCharts.map(entry => {
                    const teamsForScope = model.scopeTeamsBySlug[entry.scope_slug] ?? [];
                    const hasRelatedTeams = teamsForScope.length > 0;
                    return (
                      <Box key={entry.scope_slug} mb="6">
                        <Flex align="center" gap="3" style={{ marginBottom: 8 }}>
                          <Text as="h3" variant="title-small" weight="bold">
                            {entry.scope_name || entry.scope_slug}
                          </Text>
                          {!model.scopeTeamsAttributionError && hasRelatedTeams ? (
                            <button
                              type="button"
                              onClick={() => setTeamsPopupScopeSlug(entry.scope_slug)}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: '#2563eb',
                                cursor: 'pointer',
                                fontSize: 13,
                                padding: 0,
                                textDecoration: 'underline',
                              }}
                            >
                              Teams & roles
                            </button>
                          ) : null}
                        </Flex>
                        <FinOpsCraScopeCostHeader
                          costMetricLabel={model.costMetricDisplay}
                          totalCost={entry.totalCost}
                          percentVsPrevious={entry.percentVsPrevious}
                        />
                        <FinOpsCraTrendChart
                          chartData={entry.chartData}
                          usageAvailable={entry.usageAvailable}
                          costSeriesName={`${model.costMetricDisplay} cost`}
                          usageLines={entry.usageLines}
                        />
                        {teamsPopupScopeSlug === entry.scope_slug ? (
                          <Box
                            role="dialog"
                            aria-modal="true"
                            aria-label={`Teams and roles for ${entry.scope_name || entry.scope_slug}`}
                            style={{
                              position: 'fixed',
                              inset: 0,
                              backgroundColor: 'rgba(15, 23, 42, 0.45)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              zIndex: 1200,
                              padding: 16,
                            }}
                          >
                            <Box
                              style={{
                                backgroundColor: '#0f172a',
                                color: '#e2e8f0',
                                borderRadius: 8,
                                maxWidth: 680,
                                width: '100%',
                                maxHeight: '80vh',
                                overflowY: 'auto',
                                padding: 16,
                              }}
                            >
                              <Flex justify="between" align="center" style={{ marginBottom: 10 }}>
                                <Text as="h4" variant="title-medium" weight="bold">
                                  Teams & roles
                                </Text>
                                <button
                                  type="button"
                                  onClick={() => setTeamsPopupScopeSlug(null)}
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    color: '#93c5fd',
                                    cursor: 'pointer',
                                    fontSize: 13,
                                    padding: 0,
                                    textDecoration: 'underline',
                                  }}
                                >
                                  Close
                                </button>
                              </Flex>
                              <FinOpsCraScopeTeamsSection teams={teamsForScope} showTitle={false} />
                            </Box>
                          </Box>
                        ) : null}
                      </Box>
                    );
                  })
                )}
              </Flex>
            </Box>
          </Flex>
        </Container>
      </FullPage>
    </>
  );
};
