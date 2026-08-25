import { Minus, TrendingDown, TrendingUp } from "lucide-react";
import { SOIL_REFERENCES, type SoilFieldKey } from "../../domain/soilAnalysis";
import type { SoilAnalysis } from "./soilStore";

/**
 * Evolução do solo ao longo dos laudos do talhão — mostra, por indicador, a
 * série de valores (sparkline), a variação do 1º ao último e se a mudança é
 * boa ou ruim (pelo lado de risco da faixa). Responde "o manejo está
 * funcionando?" de forma simples e direta. Só aparece com 2+ laudos.
 */

const TREND_KEYS: SoilFieldKey[] = ["ph", "vPercent", "p", "k", "ca", "mg", "organicMatter", "mPercent"];

const REF_BY_KEY = new Map(SOIL_REFERENCES.map((r) => [r.key, r]));

type Ponto = { data: string; valor: number };

function pontos(analyses: SoilAnalysis[], key: SoilFieldKey): Ponto[] {
  return analyses
    .map((a) => {
      const v = a.values[key];
      const dataIso = a.analysisDate ?? a.createdAt;
      return typeof v === "number" && Number.isFinite(v) ? { data: dataIso, valor: v } : null;
    })
    .filter((p): p is Ponto => p !== null);
}

function Sparkline({ serie }: { serie: number[] }) {
  const w = 96;
  const h = 26;
  const pad = 3;
  const min = Math.min(...serie);
  const max = Math.max(...serie);
  const span = max - min || 1;
  const step = serie.length > 1 ? (w - pad * 2) / (serie.length - 1) : 0;
  const pts = serie.map((v, i) => {
    const x = pad + i * step;
    const y = h - pad - ((v - min) / span) * (h - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return (
    <svg className="soil-spark" viewBox={`0 0 ${w} ${h}`} width={w} height={h} aria-hidden="true">
      <polyline points={pts.join(" ")} fill="none" strokeWidth="1.6" />
      {serie.map((v, i) => {
        const x = pad + i * step;
        const y = h - pad - ((v - min) / span) * (h - pad * 2);
        return <circle key={i} cx={x} cy={y} r={i === serie.length - 1 ? 2.4 : 1.4} />;
      })}
    </svg>
  );
}

const nf = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 2 });

export function SoilTrend({ analyses }: { analyses: SoilAnalysis[] }) {
  // Ordena do mais antigo para o mais recente.
  const ordenadas = [...analyses].sort(
    (a, b) =>
      new Date(a.analysisDate ?? a.createdAt).getTime() - new Date(b.analysisDate ?? b.createdAt).getTime(),
  );
  if (ordenadas.length < 2) return null;

  const linhas = TREND_KEYS.map((key) => {
    const ref = REF_BY_KEY.get(key);
    const ps = pontos(ordenadas, key);
    if (!ref || ps.length < 2) return null;
    const primeiro = ps[0].valor;
    const ultimo = ps[ps.length - 1].valor;
    const delta = ultimo - primeiro;
    // Direção boa: para a maioria "subir" é bom; para m% (riskySide alto) "descer" é bom.
    const subirBom = ref.riskySide !== "alto";
    const sentido: "bom" | "ruim" | "neutro" =
      Math.abs(delta) < 1e-9 || ref.riskySide === "nenhum"
        ? "neutro"
        : (delta > 0) === subirBom
          ? "bom"
          : "ruim";
    return { key, label: ref.label, unit: ref.unit, serie: ps.map((p) => p.valor), primeiro, ultimo, delta, sentido };
  }).filter((l): l is NonNullable<typeof l> => l !== null);

  if (linhas.length === 0) return null;

  const bons = linhas.filter((l) => l.sentido === "bom").length;
  const ruins = linhas.filter((l) => l.sentido === "ruim").length;
  const veredito =
    bons > ruins ? "Solo evoluindo bem" : ruins > bons ? "Solo pedindo atenção" : "Solo estável";
  const veredType = bons > ruins ? "ok" : ruins > bons ? "atencao" : "neutro";

  const datas = ordenadas.map((a) =>
    new Date(a.analysisDate ?? a.createdAt).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }),
  );

  return (
    <div className="soil-trend">
      <div className="soil-trend-head">
        <strong>Evolução do solo</strong>
        <span className={`soil-analise-veredito ${veredType}`}>{veredito}</span>
      </div>
      <p className="soil-trend-periodo">
        {ordenadas.length} laudos · {datas[0]} → {datas[datas.length - 1]}
      </p>
      <div className="soil-trend-rows">
        {linhas.map((l) => (
          <div className="soil-trend-row" key={l.key}>
            <span className="soil-trend-nome">{l.label}</span>
            <Sparkline serie={l.serie} />
            <span className="soil-trend-vals">
              {nf(l.primeiro)} → <strong>{nf(l.ultimo)}</strong> {l.unit}
            </span>
            <span className={`soil-trend-delta soil-trend-delta-${l.sentido}`}>
              {Math.abs(l.delta) < 1e-9 ? <Minus size={14} /> : l.delta > 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
              {l.delta > 0 ? "+" : ""}
              {nf(l.delta)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
