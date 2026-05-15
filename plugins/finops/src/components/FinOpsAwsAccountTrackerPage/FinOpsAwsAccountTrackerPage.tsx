import { Progress } from '@backstage/core-components';
import { configApiRef, fetchApiRef, useApi } from '@backstage/frontend-plugin-api';
import { Box, Card, CardBody, Container, Flex, FullPage, Header, Text } from '@backstage/ui';
import type { ReactNode } from 'react';
import { FinOpsFiltersSidebar } from '../shared/FinOpsFiltersSidebar';
import { FinOpsAwsAccountTrackerFilters } from './components/FinOpsAwsAccountTrackerFilters';
import { FinOpsAwsAccountsTrendChart } from './components/FinOpsAwsAccountsTrendChart';
import { useFinOpsAwsAccountTrackerData } from './hooks/useFinOpsAwsAccountTrackerData';

function pageChrome(children: ReactNode) {
  return (
    <>
      <Header title="FinOps AWS Account Tracker" />
      <FullPage>
        <Container py="6">{children}</Container>
      </FullPage>
    </>
  );
}

export const FinOpsAwsAccountTrackerPage = () => {
  const { fetch } = useApi(fetchApiRef);
  const configApi = useApi(configApiRef);
  const backendBaseUrl = configApi.getOptionalString('backend.baseUrl') ?? '';
  const model = useFinOpsAwsAccountTrackerData(fetch, backendBaseUrl);

  if (!backendBaseUrl) {
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
        <p>Failed to load AWS account tracker data.</p>
        <p style={{ color: '#b91c1c', fontFamily: 'monospace', fontSize: 13 }}>{message}</p>
      </>,
    );
  }

  return (
    <>
      <Header title="FinOps AWS Account Tracker" />
      <FullPage>
        <Container py="6">
          <Flex direction={{ initial: 'column', md: 'row' }} gap={{ initial: '4', md: '6' }} align="start">
            <FinOpsFiltersSidebar>
              <FinOpsAwsAccountTrackerFilters
                fromDate={model.fromDate}
                toDate={model.toDate}
                onFromDateChange={model.setFromDate}
                onToDateChange={model.setToDate}
                onApplyLastThirtyDays={() => model.applyQuickPreset('last_30_days')}
                onApplyCurrentMonth={() => model.applyQuickPreset('current_month')}
                onApplyPastMonth={() => model.applyQuickPreset('past_month')}
                onApplyLastSevenDaysOfData={model.applyLastSevenDaysOfData}
                onApplyDateRange={model.applyDateRange}
                applyDateRangeDisabled={model.applyDateRangeDisabled}
                dateRangeMessage={model.dateRangeMessage}
              />
            </FinOpsFiltersSidebar>
            <Box width={{ md: '100%' }} style={{ flex: 1, minWidth: 0 }}>
              <Flex direction="column" gap="6">
                {!model.isRangeValid ? (
                  <p>Adjust the date range to load charts.</p>
                ) : model.chartModels.length === 0 ? (
                  <p>No AWS account snapshot data for the selected date range.</p>
                ) : (
                  model.chartModels.map(chart => (
                    <Card key={chart.id}>
                      <CardBody>
                        <Box style={{ marginBottom: 12 }}>
                          <Text as="h3" variant="title-small" weight="bold">
                            {chart.title}
                          </Text>
                        </Box>
                        <FinOpsAwsAccountsTrendChart chartData={chart.chartData} />
                      </CardBody>
                    </Card>
                  ))
                )}
              </Flex>
            </Box>
          </Flex>
        </Container>
      </FullPage>
    </>
  );
};
