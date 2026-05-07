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
import {
  formatUsdAmount,
  formatUsdAxisTick,
  formatUsageHours,
  formatUsageHoursAxisTick,
} from '../../../format/formatMoney';
import type { ChartPoint, UsageLineConfig } from '../hooks/useFinOpsCraData';

type FinOpsCraTrendChartProps = {
  chartData: ChartPoint[];
  usageAvailable: boolean;
  /** Legend / tooltip name for the cost line (for example "Unblended cost"). */
  costSeriesName: string;
  /** Selected usage series (same keys as `chartData`). */
  usageLines: UsageLineConfig[];
};

const axisTickStyle = {
  fill: 'var(--bui-fg-primary, var(--bui-fg-solid, currentColor))',
  fontSize: 11,
};

function formatCostTick(value: number | string): string {
  return formatUsdAxisTick(Number(value));
}

function usageLineNames(lines: UsageLineConfig[]): Set<string> {
  return new Set(lines.map(l => l.name));
}

export function FinOpsCraTrendChart({
  chartData,
  usageAvailable,
  costSeriesName,
  usageLines,
}: FinOpsCraTrendChartProps) {
  if (chartData.length === 0) {
    return <p>No trend data found for the current filters.</p>;
  }

  const namesForUsage = usageLineNames(usageLines);
  const chartMargin = usageAvailable
    ? { top: 12, right: 12, left: 4, bottom: 8 }
    : { top: 12, right: 12, left: 4, bottom: 8 };

  const usageSummary =
    usageLines.length > 0 ? usageLines.map(l => l.name).join(', ') : '';

  return (
    <section
      style={{
        width: '100%',
        minHeight: 380,
        color: 'var(--bui-fg-primary, var(--bui-fg-solid, currentColor))',
      }}
    >
      {usageAvailable ? (
        <p
          role="status"
          style={{
            fontSize: 13,
            marginBottom: 8,
            color: 'var(--bui-fg-secondary, var(--bui-fg-primary, currentColor))',
          }}
        >
          Usage: {usageSummary} (right axis).
        </p>
      ) : null}
      <ResponsiveContainer width="100%" height={380}>
        <LineChart data={chartData} margin={chartMargin}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="period" tick={axisTickStyle} />
          <YAxis
            yAxisId="cost"
            width={88}
            tickFormatter={formatCostTick}
            tick={axisTickStyle}
            axisLine={{ stroke: 'var(--bui-border-base, #e5e7eb)' }}
          />
          {usageAvailable ? (
            <YAxis
              yAxisId="usage"
              orientation="right"
              width={72}
              tickFormatter={v => formatUsageHoursAxisTick(Number(v))}
              tick={axisTickStyle}
              axisLine={{ stroke: 'var(--bui-border-base, #e5e7eb)' }}
            />
          ) : null}
          <Tooltip
            formatter={(value, name) => {
              if (typeof name === 'string' && namesForUsage.has(name)) {
                return formatUsageHours(Number(value));
              }
              return formatUsdAmount(Number(value));
            }}
          />
          <Legend />
          <Line
            yAxisId="cost"
            type="monotone"
            dataKey="cost"
            name={costSeriesName}
            stroke="#2563eb"
            strokeWidth={2}
            dot={false}
          />
          {usageAvailable
            ? usageLines.map(line => (
                <Line
                  key={line.dataKey}
                  yAxisId="usage"
                  type="monotone"
                  dataKey={line.dataKey}
                  name={line.name}
                  stroke={line.stroke}
                  strokeWidth={2}
                  dot={false}
                  connectNulls={false}
                />
              ))
            : null}
        </LineChart>
      </ResponsiveContainer>
    </section>
  );
}
