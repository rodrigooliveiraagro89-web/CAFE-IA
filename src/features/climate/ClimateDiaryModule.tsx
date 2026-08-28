import {
  CalendarRange,
  CloudRain,
  Droplets,
  Flame,
  Snowflake,
  Sprout,
  Sun,
} from "lucide-react";
import type { AppView } from "../../app/navigation";
import { rainByMonth, summarizeClimate } from "../../domain/climateDiary";
import type { AgriculturalController } from "../../lib/useAgriculturalContext";
import type { ClimateDiaryController } from "./climateDiaryStore";
import "./climate.css";

type ClimateDiaryModuleProps = {
  agriculture: AgriculturalController;
  climateDiary: ClimateDiaryController;
  onNavigate: (view: AppView) => void;
};

const MESES_ABREV = ["", "jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function mesLabel(ym: string): string {
  const m = Number(ym.slice(5, 7));
  return `${MESES_ABREV[m] ?? ""}/${ym.slice(2, 4)}`;
}

function dataBR(iso: string | null): string {
  return iso ? new Date(`${iso}T12:00:00`).toLocaleDateString("pt-BR") : "—";
}

export function ClimateDiaryModule({ agriculture, climateDiary, onNavigate }: ClimateDiaryModuleProps) {
  const plot = agriculture.selectedPlot;
  const property = agriculture.selectedProperty;

  if (!plot || !property) {
    return (
      <div className="page-stack platform-page">
        <header className="page-header"><span className="eyebrow">Memória do talhão</span><h1>Diário climático</h1></header>
        <section className="empty-state context-empty">
          <CloudRain size={31} />
          <h2>Selecione um talhão</h2>
          <p>O diário guarda o clima que cada talhão de fato viveu, acumulando um histórico permanente.</p>
          <button type="button" onClick={() => onNavigate("propriedades")}>Abrir propriedades e talhões</button>
        </section>
      </div>
    );
  }

  const diary = climateDiary.diaryFor(plot.id);
  const days = diary?.days ?? [];
  // Janelas ancoradas no ÚLTIMO dia registrado (não no "hoje" real): entre visitas
  // o histórico pode estar defasado — 0 mm por falta de dado não é seca.
  const anchor =
    days.reduce((max, d) => (d.date.slice(0, 10) > max ? d.date.slice(0, 10) : max), "") ||
    new Date().toISOString().slice(0, 10);
  const s = summarizeClimate(days, anchor);
  const meses = rainByMonth(days);
  const maxMes = meses.reduce((m, x) => Math.max(m, x.mm), 0);
  const chartLabel = `Chuva por mês: ${meses.map((m) => `${mesLabel(m.ym)} ${Math.round(m.mm)} mm`).join(", ")}`;

  if (!diary || s.days === 0) {
    // O diário só enche quando o clima é centrado no POLÍGONO do talhão (fonte
    // "talhão"). Sem contorno desenhado, a previsão cai para cidade/GPS e nunca
    // alimenta a memória — então mandamos desenhar o contorno, não abrir o clima.
    const semPoligono = !plot.geometry;
    return (
      <div className="page-stack platform-page">
        <header className="page-header context-page-header">
          <div><span className="eyebrow">{property.name} · {plot.name}</span><h1>Diário climático</h1></div>
          <button className="secondary-button" type="button" onClick={() => onNavigate(semPoligono ? "propriedades" : "clima")}>
            {semPoligono ? "Talhões" : "Abrir clima"} <CloudRain size={17} />
          </button>
        </header>
        <section className="empty-state context-empty">
          <CloudRain size={31} />
          <h2>O diário ainda está vazio</h2>
          {semPoligono ? (
            <>
              <p>Este talhão ainda não tem contorno desenhado. O diário só acumula o clima quando a previsão é centrada no polígono do talhão — clima por cidade ou GPS não alimenta a memória.</p>
              <button type="button" onClick={() => onNavigate("propriedades")}>Desenhar o contorno do talhão</button>
            </>
          ) : (
            <>
              <p>Abra a tela de Clima com este talhão selecionado — os dias observados são registrados automaticamente e o histórico começa a se acumular aqui.</p>
              <button type="button" onClick={() => onNavigate("clima")}>Carregar o clima do talhão</button>
            </>
          )}
        </section>
      </div>
    );
  }

  return (
    <div className="page-stack platform-page climate-page">
      <header className="page-header context-page-header">
        <div>
          <span className="eyebrow">{property.name} · {plot.name}</span>
          <h1>Diário climático</h1>
          <p>A memória do talhão: {s.days} dias registrados, de {dataBR(s.from)} a {dataBR(s.to)}.</p>
        </div>
        <button className="secondary-button" type="button" onClick={() => onNavigate("clima")}>Abrir clima <CloudRain size={17} /></button>
      </header>

      <section className="climate-stats" aria-label="Resumo climático">
        <article><span><CloudRain size={18} /> Chuva (7 dias)</span><strong>{s.rain7} mm</strong></article>
        <article><span><CloudRain size={18} /> Chuva (30 dias)</span><strong>{s.rain30} mm</strong></article>
        <article><span><Droplets size={18} /> Chuva (90 dias)</span><strong>{s.rain90} mm</strong></article>
        <article><span><Droplets size={18} /> Chuva no histórico</span><strong>{s.rainTotal} mm</strong></article>
        <article data-flag={s.dryStreak >= 10 ? "warn" : undefined}><span><Sun size={18} /> Dias sem chuva</span><strong>{s.dryStreak}</strong><small>sequência atual (veranico)</small></article>
        <article data-flag={s.frostCount > 0 ? "cold" : undefined}><span><Snowflake size={18} /> Geadas registradas</span><strong>{s.frostCount}</strong><small>mínima ≤ 3 °C</small></article>
        <article data-flag={s.heatCount > 0 ? "warn" : undefined}><span><Flame size={18} /> Calor extremo</span><strong>{s.heatCount}</strong><small>máxima ≥ 34 °C</small></article>
        <article><span><Sprout size={18} /> Graus-dia (café)</span><strong>{s.gddTotal.toLocaleString("pt-BR")}</strong><small>acúmulo, base 10 °C</small></article>
      </section>

      {meses.length > 0 && (
        <section className="panel-card">
          <div className="panel-title"><CalendarRange size={21} /><div><span className="eyebrow">Chuva mensal</span><h2>Distribuição por mês</h2></div></div>
          <div className="climate-rain-chart" role="img" aria-label={chartLabel}>
            {meses.map((m) => (
              <div className="climate-rain-col" key={m.ym} title={`${mesLabel(m.ym)}: ${m.mm} mm`}>
                <div className="climate-rain-bar-wrap">
                  <i style={{ height: `${maxMes > 0 ? Math.max(2, (m.mm / maxMes) * 100) : 0}%` }} />
                </div>
                <small className="climate-rain-mm">{Math.round(m.mm)}</small>
                <small className="climate-rain-ym">{mesLabel(m.ym)}</small>
              </div>
            ))}
          </div>
        </section>
      )}

      <p className="climate-note">
        Os dados vêm da previsão pública (Open-Meteo) para o centro do talhão e se acumulam a cada visita à tela de Clima. É orientação climática, não medição de estação no local.
      </p>
    </div>
  );
}
