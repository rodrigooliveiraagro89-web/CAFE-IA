type BarChartDatum = {
  label: string;
  value: number;
};

type BarChartProps = {
  data: BarChartDatum[];
  formatValue?: (value: number) => string;
  color?: string;
  emptyMessage?: string;
};

const ROW_HEIGHT = 28;
const CHART_WIDTH = 600;
const LABEL_WIDTH = 160;
const VALUE_WIDTH = 90;
const BAR_AREA_WIDTH = CHART_WIDTH - LABEL_WIDTH - VALUE_WIDTH;

export function BarChart({
  data,
  formatValue = (value) => value.toLocaleString("pt-BR"),
  color = "var(--agryn-emerald)",
  emptyMessage = "Sem dados suficientes para o gráfico.",
}: BarChartProps) {
  if (data.length === 0) {
    return <p className="report-chart-empty">{emptyMessage}</p>;
  }

  const maxValue = Math.max(...data.map((datum) => datum.value), 0.0001);
  const height = data.length * ROW_HEIGHT;

  return (
    <svg
      className="report-bar-chart"
      viewBox={`0 0 ${CHART_WIDTH} ${height}`}
      role="img"
      aria-label="Gráfico de barras"
      preserveAspectRatio="xMinYMin meet"
    >
      {data.map((datum, index) => {
        const y = index * ROW_HEIGHT;
        const barWidth = Math.max((datum.value / maxValue) * BAR_AREA_WIDTH, 2);
        return (
          <g key={datum.label}>
            <text
              x={LABEL_WIDTH - 8}
              y={y + ROW_HEIGHT / 2}
              textAnchor="end"
              dominantBaseline="middle"
              className="report-chart-label"
            >
              {datum.label}
            </text>
            <rect
              x={LABEL_WIDTH}
              y={y + 5}
              width={barWidth}
              height={ROW_HEIGHT - 10}
              rx={3}
              style={{ fill: color }}
            />
            <text
              x={LABEL_WIDTH + barWidth + 8}
              y={y + ROW_HEIGHT / 2}
              dominantBaseline="middle"
              className="report-chart-value"
            >
              {formatValue(datum.value)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
