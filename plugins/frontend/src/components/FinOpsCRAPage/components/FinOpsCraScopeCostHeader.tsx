import { Box, Text } from '@backstage/ui';
import { formatUsdAmount } from '../../../format/formatMoney';

type FinOpsCraScopeCostHeaderProps = {
  /** Short label for the cost metric, for example "Unblended" or "Amortized". */
  costMetricLabel: string;
  totalCost: number;
  /** Percent change vs the same-length window immediately before the selected range; `null` when not meaningful. */
  percentVsPrevious: number | null;
};

function formatPercentVsPrevious(pct: number | null): string {
  if (pct === null || !Number.isFinite(pct)) {
    return '—';
  }
  const sign = pct > 0 ? '+' : '';
  return `${sign}${pct.toFixed(1)}%`;
}

export function FinOpsCraScopeCostHeader({
  costMetricLabel,
  totalCost,
  percentVsPrevious,
}: FinOpsCraScopeCostHeaderProps) {
  return (
    <Box style={{ marginBottom: 12 }}>
      <Text as="div" variant="body-x-small" color="secondary">
        Total {costMetricLabel} cost
      </Text>
      <Text as="div" style={{ fontSize: 22, fontWeight: 600, marginTop: 4 }}>
        {formatUsdAmount(totalCost)}
      </Text>
      <Text as="div" variant="body-x-small" color="secondary" style={{ marginTop: 6 }}>
        vs previous window: {formatPercentVsPrevious(percentVsPrevious)}
      </Text>
    </Box>
  );
}
