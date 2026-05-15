import { useMemo } from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { AwsAccountsChartPoint } from '../../../types';
import { formatPeriodTick } from '../periodUtils';

type FinOpsAwsAccountsTrendChartProps = {
  chartData: AwsAccountsChartPoint[];
};

const axisTickStyle = {
  fill: 'var(--bui-fg-primary, var(--bui-fg-solid, currentColor))',
  fontSize: 11,
};

const SERIES = [
  { dataKey: 'active_count' as const, name: 'Active', stroke: '#2563eb' },
  { dataKey: 'closed_count' as const, name: 'Closed', stroke: '#ea580c' },
  { dataKey: 'deleted_count' as const, name: 'Deleted', stroke: '#b91c1c' },
];

function formatCount(value: number | string): string {
  const n = Number(value);
  if (!Number.isFinite(n)) {
    return String(value);
  }
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

export function FinOpsAwsAccountsTrendChart({ chartData }: FinOpsAwsAccountsTrendChartProps) {
  const sortedData = useMemo(
    () => [...chartData].sort((a, b) => a.periodTime - b.periodTime),
    [chartData],
  );

  if (sortedData.length === 0) {
    return <p>No data for the selected date range.</p>;
  }

  return (
    <section
      style={{
        width: '100%',
        minHeight: 380,
        color: 'var(--bui-fg-primary, var(--bui-fg-solid, currentColor))',
      }}
    >
      <ResponsiveContainer width="100%" height={380}>
        <LineChart data={sortedData} margin={{ top: 12, right: 12, left: 4, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="periodTime"
            type="number"
            scale="time"
            domain={['dataMin', 'dataMax']}
            tickFormatter={formatPeriodTick}
            tick={axisTickStyle}
          />
          <YAxis
            width={72}
            tickFormatter={formatCount}
            tick={axisTickStyle}
            axisLine={{ stroke: 'var(--bui-border-base, #e5e7eb)' }}
          />
          <Tooltip
            labelFormatter={label => formatPeriodTick(Number(label))}
            formatter={(value, name) => [formatCount(Number(value)), name]}
          />
          <Legend />
          {SERIES.map(series => (
            <Line
              key={series.dataKey}
              type="linear"
              dataKey={series.dataKey}
              name={series.name}
              stroke={series.stroke}
              strokeWidth={2}
              dot={false}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </section>
  );
}
