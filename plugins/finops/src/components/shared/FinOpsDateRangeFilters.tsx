import { Box, Button, Flex, FieldLabel, Text } from '@backstage/ui';

export type FinOpsDateRangeFiltersProps = {
  idPrefix: string;
  fromDate: string;
  toDate: string;
  onFromDateChange: (value: string) => void;
  onToDateChange: (value: string) => void;
  onApplyLastThirtyDays: () => void;
  onApplyCurrentMonth: () => void;
  onApplyPastMonth: () => void;
  onApplyLastSevenDaysOfData: () => void | Promise<void>;
  onApplyDateRange: () => void;
  applyDateRangeDisabled?: boolean;
  /** Shown when the current From/To values are incomplete or invalid. */
  dateRangeMessage?: string | null;
};

export function FinOpsDateRangeFilters(props: FinOpsDateRangeFiltersProps) {
  const fromId = `${props.idPrefix}-from-date`;
  const toId = `${props.idPrefix}-to-date`;

  return (
    <>
      <Box>
        <Box style={{ marginBottom: 8 }}>
          <Text as="div" variant="body-x-small" color="secondary">
            Date range
          </Text>
        </Box>
        <Flex direction="column" gap="3">
          <Box>
            <FieldLabel label="From" htmlFor={fromId} />
            <input
              id={fromId}
              aria-label="From date"
              type="date"
              value={props.fromDate}
              onChange={event => props.onFromDateChange(event.target.value)}
            />
          </Box>
          <Box>
            <FieldLabel label="To" htmlFor={toId} />
            <input
              id={toId}
              aria-label="To date"
              type="date"
              value={props.toDate}
              onChange={event => props.onToDateChange(event.target.value)}
            />
          </Box>
        </Flex>
        {props.dateRangeMessage ? (
          <Box style={{ marginTop: 8 }}>
            <Text as="p" variant="body-x-small" color="secondary">
              {props.dateRangeMessage}
            </Text>
          </Box>
        ) : null}
        <Box style={{ marginTop: 12 }}>
          <Button
            variant="primary"
            onPress={props.onApplyDateRange}
            isDisabled={props.applyDateRangeDisabled}
          >
            Apply date range
          </Button>
        </Box>
      </Box>

      <Flex direction="column" gap="2">
        <Button variant="secondary" onPress={props.onApplyLastThirtyDays}>
          Last 30 days
        </Button>
        <Button variant="secondary" onPress={props.onApplyCurrentMonth}>
          Current month
        </Button>
        <Button variant="secondary" onPress={props.onApplyPastMonth}>
          Past month
        </Button>
        <Button variant="secondary" onPress={() => void props.onApplyLastSevenDaysOfData()}>
          Last 7 days of data
        </Button>
      </Flex>
    </>
  );
}
