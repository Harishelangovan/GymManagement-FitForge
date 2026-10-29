import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useTheme } from '@/theme/themeContext'
import { niceTicks } from './chartScale'
import { CHART_COLORS } from './chartTheme'

const CHART_HEIGHT = 240 // includes the x-axis band, so the card never gets an inner scrollbar

interface TooltipRow {
  label: string
  value: string
  color: string
}

/** Values lead (strong ink), series names follow (muted); each row keyed by a short line in the series colour. */
function TooltipCard({ title, rows }: { title: string; rows: TooltipRow[] }) {
  return (
    <div className="min-w-36 rounded-xl border border-border bg-surface px-3 py-2 text-xs shadow-card">
      <p className="mb-1.5 font-medium text-muted">{title}</p>
      {rows.map((row) => (
        <div key={row.label} className="flex items-center gap-2 py-0.5">
          <span className="h-0.5 w-3 rounded-full" style={{ backgroundColor: row.color }} aria-hidden="true" />
          <span className="text-sm font-semibold text-fg tabular-nums">{row.value}</span>
          <span className="text-muted">{row.label}</span>
        </div>
      ))}
    </div>
  )
}

const axisProps = (axis: string) => ({
  tickLine: false,
  axisLine: false,
  tick: { fill: axis, fontSize: 12 },
})

// ---------- Single series: magnitude per period, in the brand accent ----------

export interface ColumnDatum {
  key: string
  label: string
  /** Shown in the tooltip, e.g. "October 2026". */
  fullLabel: string
  value: number
}

export function ColumnChart({
  data,
  seriesName,
  formatValue,
  formatTick,
}: {
  data: ColumnDatum[]
  seriesName: string
  formatValue: (value: number) => string
  formatTick?: (value: number) => string
}) {
  const { theme } = useTheme()
  const colors = CHART_COLORS[theme]
  const ticks = niceTicks(Math.max(...data.map((d) => d.value)))

  return (
    <div style={{ height: CHART_HEIGHT }} role="img" aria-label={`${seriesName} column chart. Switch to Table for exact values.`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke={colors.grid} />
          <XAxis dataKey="label" {...axisProps(colors.axis)} interval="preserveStartEnd" minTickGap={8} />
          <YAxis {...axisProps(colors.axis)} width={52} ticks={ticks} domain={[0, ticks[ticks.length - 1]]} tickFormatter={formatTick ?? ((v: number) => String(v))} />
          <Tooltip
            cursor={{ fill: colors.cursor }}
            content={({ active, payload }) =>
              active && payload?.length ? (
                <TooltipCard
                  title={(payload[0].payload as ColumnDatum).fullLabel}
                  rows={[{ label: seriesName, value: formatValue(Number(payload[0].value)), color: colors.accent }]}
                />
              ) : null
            }
          />
          <Bar dataKey="value" name={seriesName} fill={colors.accent} radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ---------- Two series stacked: class visits + gym check-ins per day ----------

export interface StackedDatum {
  key: string
  label: string
  fullLabel: string
  first: number
  second: number
}

export function StackedColumnChart({
  data,
  firstName,
  secondName,
}: {
  data: StackedDatum[]
  firstName: string
  secondName: string
}) {
  const { theme } = useTheme()
  const colors = CHART_COLORS[theme]
  const ticks = niceTicks(Math.max(...data.map((d) => d.first + d.second)))

  return (
    <div style={{ height: CHART_HEIGHT }} role="img" aria-label={`${firstName} and ${secondName} stacked column chart. Switch to Table for exact values.`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke={colors.grid} />
          <XAxis dataKey="label" {...axisProps(colors.axis)} interval="preserveStartEnd" minTickGap={8} />
          <YAxis {...axisProps(colors.axis)} width={52} ticks={ticks} domain={[0, ticks[ticks.length - 1]]} />
          <Tooltip
            cursor={{ fill: colors.cursor }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null
              const datum = payload[0].payload as StackedDatum
              return (
                <TooltipCard
                  title={datum.fullLabel}
                  rows={[
                    { label: secondName, value: String(datum.second), color: colors.series2 },
                    { label: firstName, value: String(datum.first), color: colors.series1 },
                  ]}
                />
              )
            }}
          />
          {/* The surface-coloured stroke is the 2px gap between stacked segments, not a border. */}
          <Bar dataKey="first" name={firstName} stackId="a" fill={colors.series1} stroke={colors.surface} strokeWidth={2} maxBarSize={24} isAnimationActive={false} />
          <Bar dataKey="second" name={secondName} stackId="a" fill={colors.series2} stroke={colors.surface} strokeWidth={2} radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
