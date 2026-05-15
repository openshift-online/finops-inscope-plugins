import type {
  AwsAccountsChartModel,
  AwsAccountsChartPoint,
  AwsAccountsHistoricalPoint,
} from '../../../types';
import { formatPayerChartTitle } from '../payerAccountLabels';
import { normalizePeriod, periodToUtcMs } from '../periodUtils';

function toChartPoint(
  period: string,
  counts: Pick<AwsAccountsChartPoint, 'active_count' | 'closed_count' | 'deleted_count'>,
): AwsAccountsChartPoint {
  const normalized = normalizePeriod(period);
  return {
    period: normalized,
    periodTime: periodToUtcMs(normalized),
    ...counts,
  };
}

function sortByTime(points: AwsAccountsChartPoint[]): AwsAccountsChartPoint[] {
  return [...points].sort((a, b) => a.periodTime - b.periodTime);
}

function aggregateAllPayers(points: AwsAccountsHistoricalPoint[]): AwsAccountsChartPoint[] {
  const byPeriod = new Map<string, AwsAccountsChartPoint>();

  for (const point of points) {
    const normalized = normalizePeriod(point.period);
    const current =
      byPeriod.get(normalized) ??
      toChartPoint(normalized, { active_count: 0, closed_count: 0, deleted_count: 0 });
    current.active_count += point.active_count;
    current.closed_count += point.closed_count;
    current.deleted_count += point.deleted_count;
    byPeriod.set(normalized, current);
  }

  return sortByTime(Array.from(byPeriod.values()));
}

export function buildAwsAccountsChartModels(
  points: AwsAccountsHistoricalPoint[],
): AwsAccountsChartModel[] {
  if (points.length === 0) {
    return [];
  }

  const byPayer = new Map<string, AwsAccountsChartPoint[]>();
  for (const point of points) {
    const list = byPayer.get(point.payer_account_id) ?? [];
    list.push(
      toChartPoint(point.period, {
        active_count: point.active_count,
        closed_count: point.closed_count,
        deleted_count: point.deleted_count,
      }),
    );
    byPayer.set(point.payer_account_id, list);
  }

  const payerCharts: AwsAccountsChartModel[] = [...byPayer.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([payerId, chartData]) => ({
      id: payerId,
      title: formatPayerChartTitle(payerId),
      chartData: sortByTime(chartData),
    }));

  return [
    {
      id: 'all',
      title: 'All payers',
      chartData: aggregateAllPayers(points),
    },
    ...payerCharts,
  ];
}
