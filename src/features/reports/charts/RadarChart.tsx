import type { RadarDatum } from "../../fertilization/radar";

/**
 * Gráfico de radar (teia) no estilo do laudo Geban: teor do solo como % do
 * adequado (100% = anel/polígono de referência). Eixos = nutrientes. SVG puro,
 * tema-aware por CSS, imprime no PDF.
 */

const SIZE = 300;
const C = SIZE / 2;
const R = 95;

export function RadarChart({ data, max = 200 }: { data: RadarDatum[]; max?: number }) {
  const n = data.length;
  if (n < 3) return null;
  const ang = (i: number) => ((-90 + (i * 360) / n) * Math.PI) / 180;
  const point = (i: number, pct: number): [number, number] => {
    const r = (Math.max(0, Math.min(pct, max)) / max) * R;
    return [C + r * Math.cos(ang(i)), C + r * Math.sin(ang(i))];
  };
  const poly = (pcts: number[]) => pcts.map((p, i) => point(i, p).join(",")).join(" ");
  const rings = [50, 100, 150, 200].filter((x) => x <= max);
  const medido = data.map((d) => d.pct ?? 0);
  const adequado = data.map(() => 100);

  return (
    <svg className="radar-chart" viewBox={`0 0 ${SIZE} ${SIZE}`} width="100%" role="img" aria-label="Gráfico de radar dos teores">
      {rings.map((rp) => (
        <polygon
          key={rp}
          className={rp === 100 ? "radar-ring radar-ring--adeq" : "radar-ring"}
          points={poly(data.map(() => rp))}
        />
      ))}
      {data.map((_, i) => {
        const [x, y] = point(i, max);
        return <line key={i} className="radar-axis" x1={C} y1={C} x2={x} y2={y} />;
      })}
      <polygon className="radar-adeq" points={poly(adequado)} />
      <polygon className="radar-medido" points={poly(medido)} />
      {medido.map((p, i) => {
        const [x, y] = point(i, p);
        return <circle key={i} className="radar-dot" cx={x} cy={y} r={2.6} />;
      })}
      {data.map((d, i) => {
        const [x, y] = point(i, max * 1.16);
        const anchor = x < C - 3 ? "end" : x > C + 3 ? "start" : "middle";
        return (
          <text key={i} className="radar-label" x={x} y={y} textAnchor={anchor} dominantBaseline="middle">
            <tspan>{d.label}</tspan>
            <tspan x={x} dy="1.15em" className="radar-label-val">{d.valueLabel}</tspan>
          </text>
        );
      })}
    </svg>
  );
}
