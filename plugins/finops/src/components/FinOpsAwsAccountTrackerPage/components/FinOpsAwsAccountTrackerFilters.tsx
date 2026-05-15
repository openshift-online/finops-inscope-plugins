import { Flex } from '@backstage/ui';
import { FinOpsDateRangeFilters } from '../../shared/FinOpsDateRangeFilters';

type FinOpsAwsAccountTrackerFiltersProps = {
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
  dateRangeMessage?: string | null;
};

export function FinOpsAwsAccountTrackerFilters(props: FinOpsAwsAccountTrackerFiltersProps) {
  return (
    <Flex direction="column" gap="5">
      <FinOpsDateRangeFilters
        idPrefix="finops-aws-accounts"
        fromDate={props.fromDate}
        toDate={props.toDate}
        onFromDateChange={props.onFromDateChange}
        onToDateChange={props.onToDateChange}
        onApplyLastThirtyDays={props.onApplyLastThirtyDays}
        onApplyCurrentMonth={props.onApplyCurrentMonth}
        onApplyPastMonth={props.onApplyPastMonth}
        onApplyLastSevenDaysOfData={props.onApplyLastSevenDaysOfData}
        onApplyDateRange={props.onApplyDateRange}
        applyDateRangeDisabled={props.applyDateRangeDisabled}
        dateRangeMessage={props.dateRangeMessage}
      />
    </Flex>
  );
}
