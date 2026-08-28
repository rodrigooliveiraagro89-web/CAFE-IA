import {
  ArrowRight,
  Bug,
  CalendarDays,
  CloudRain,
  Droplets,
  FlaskConical,
  Flame,
  Leaf,
  MapPin,
  Mountain,
  RefreshCw,
  Scissors,
  Snowflake,
  SprayCan,
  Sprout,
  Sun,
  Wheat,
  Wind,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import type { AppView } from "../../app/navigation";
import type { AgriculturalController } from "../../lib/useAgriculturalContext";
import { SPRAY_RATING_LABEL, type HourItem, type SprayHour } from "../../domain/weather";
import { buildWeatherGuidance, type WeatherGuidance } from "../../domain/weatherGuidance";
import { diseaseRiskForCrop, type DiseaseRisk, type RiskLevel } from "../../domain/diseaseRisk";
import {
  activitiesForMonth,
  calendarWeatherGuidance,
  monthLabel,
} from "../../domain/coffeeCalendar";
import { useWeather, type WeatherSource } from "./weatherStore";
import type { ClimateDiaryController } from "../climate/climateDiaryStore";
import "./weather.css";

const RISK_LABEL: Record<RiskLevel, string> = { baixo: "Baixo", medio: "Médio", alto: "Alto" };

function carregarLidos(): Set<string> {
  try {
    const raw = localStorage.getItem("agryn:clima-lidos");
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

const GUIDANCE_ICON: Record<WeatherGuidance["kind"], LucideIcon> = {
  geada: Snowflake,
  chuva: CloudRain,
  seca: Sun,
  calor: Flame,
  pulverizacao: SprayCan,
  colheita: Wheat,
  doenca: Bug,
  adubacao: Leaf,
  analise: FlaskConical,
  calagem: Mountain,
  poda: Scissors,
  manejo: Sprout,
  plantio: Sprout,
  foliar: Leaf,
  desbrota: Scissors,
};

const TONE_ORDER: Record<WeatherGuidance["tone"], number> = {
  critico: 0,
  atencao: 1,
  bom: 2,
  info: 3,
};

type WeatherModuleProps = {
  agriculture: AgriculturalController;
  climateDiary: ClimateDiaryController;
  onNavigate: (view: AppView) => void;
};

const SOURCE_LABEL: Record<WeatherSource, string> = {
  talhao: "centro do talhão",
  cidade: "cidade da propriedade",
  gps: "localização do aparelho",
};

/**
 * Clima nativo do AGRYN: previsão pública (Open-Meteo, sem chave) integrada ao
 * app — mesma navegação, sessão e visual. O foco é a decisão do cafeicultor:
 * quando pulverizar. A localização vem do talhão desenhado, da cidade
 * cadastrada ou do GPS do aparelho.
 */
export function WeatherModule({ agriculture, climateDiary, onNavigate }: WeatherModuleProps) {
  const weather = useWeather(agriculture);
  const plotId = agriculture.selectedPlot?.id;

  // Memória climática (§9): quando o clima do TALHÃO carrega, registra os dias
  // observados no diário do talhão. A captura é idempotente (no-op se nada muda),
  // então rodar a cada carga é seguro. Só quando a fonte é o próprio talhão
  // (centro do polígono) — cidade/GPS não são específicos do talhão.
  useEffect(() => {
    if (weather.status !== "ready" || weather.source !== "talhao" || !plotId) return;
    if (weather.observed.length === 0) return;
    climateDiary.capture(
      plotId,
      weather.observed.map((d) => ({
        date: d.date.slice(0, 10),
        tmin: d.tempMin,
        tmax: d.tempMax,
        precip: d.precipitation,
      })),
    );
    // capture é estável; observed muda de identidade só quando há nova carga.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weather.status, weather.source, weather.observed, plotId]);

  const month = new Date().getMonth() + 1;
  const monthActivities = activitiesForMonth(month);
  const guidance = [
    ...buildWeatherGuidance(weather.forecast, weather.sprayWindows),
    ...calendarWeatherGuidance(month, weather.forecast),
  ].sort((a, b) => TONE_ORDER[a.tone] - TONE_ORDER[b.tone]);
  const riscosDoenca = diseaseRiskForCrop(agriculture.selectedPlot?.crop, weather.hourly);

  // Veredito do dia (uma frase-título simples pro produtor).
  const riscoAlto = riscosDoenca.some((r) => r.nivel === "alto");
  const climaVeredito = riscoAlto
    ? { texto: "Atenção: risco alto de doença", tom: "alerta" }
    : weather.sprayWindows.length > 0
      ? { texto: "Boa janela para pulverizar" , tom: "ok" }
      : { texto: "Sem alertas de manejo para hoje", tom: "neutro" };

  const [lidos, setLidos] = useState<Set<string>>(() => carregarLidos());
  function marcarLido(id: string) {
    setLidos((prev) => {
      const next = new Set(prev);
      next.add(id);
      try {
        localStorage.setItem("agryn:clima-lidos", JSON.stringify([...next]));
      } catch {
        // sem persistência: vale só nesta sessão
      }
      return next;
    });
  }

  return (
    <div className="page-stack platform-page">
      <header className="page-header context-page-header">
        <div>
          <span className="eyebrow">Monitoramento</span>
          <h1>Clima</h1>
          {weather.status === "ready" && (
            <span className={`weather-veredito weather-veredito--${climaVeredito.tom}`}>{climaVeredito.texto}</span>
          )}
          <p>Previsão de 7 dias e janela de pulverização para planejar aplicação e adubação.</p>
        </div>
        <button className="secondary-button" type="button" onClick={() => onNavigate("caderno")}>
          Registrar atividade <ArrowRight size={17} />
        </button>
      </header>

      <div className="weather-toolbar">
        <span className="weather-location">
          <MapPin size={15} aria-hidden="true" />
          {weather.locationLabel ? (
            <>
              {weather.locationLabel}
              {weather.source ? <em> · {SOURCE_LABEL[weather.source]}</em> : null}
            </>
          ) : (
            "Localização não definida"
          )}
        </span>
        <div className="weather-actions">
          <button
            className="ghost-button"
            type="button"
            onClick={weather.useMyLocation}
            disabled={weather.status === "loading"}
          >
            <MapPin size={15} aria-hidden="true" /> Minha localização
          </button>
          <button
            className="ghost-button"
            type="button"
            onClick={() => void weather.reload()}
            disabled={weather.status === "loading"}
          >
            <RefreshCw size={15} aria-hidden="true" /> Atualizar
          </button>
        </div>
      </div>

      <section className="weather-block calendar-block">
        <div className="calendar-head">
          <CalendarDays size={18} aria-hidden="true" />
          <div>
            <h2>Calendário do cafeicultor</h2>
            <p className="weather-block-note">
              Atividades recomendadas para <strong>{monthLabel(month)}</strong> (referência do Sul de
              Minas — as datas variam por região e cultivar).
            </p>
          </div>
        </div>
        {monthActivities.length === 0 ? (
          <p className="weather-status">Nenhuma atividade típica registrada para este mês.</p>
        ) : (
          <div className="calendar-chips">
            {monthActivities.map((activity) => {
              const Icon = GUIDANCE_ICON[activity.kind];
              return (
                <span className="calendar-chip" key={activity.id}>
                  <Icon size={14} aria-hidden="true" /> {activity.label}
                </span>
              );
            })}
          </div>
        )}
      </section>

      {weather.status === "loading" && <p className="weather-status">Buscando previsão…</p>}

      {weather.status === "error" && (
        <div className="weather-status weather-status--error">
          <p>{weather.message}</p>
          {!agriculture.selectedProperty && (
            <button className="secondary-button" type="button" onClick={() => onNavigate("propriedades")}>
              Cadastrar propriedade <ArrowRight size={16} />
            </button>
          )}
        </div>
      )}

      {weather.status === "ready" && (
        <>
          {weather.current && (
            <section className="weather-now">
              <div className="weather-now-main">
                <span className="weather-now-icon" aria-hidden="true">
                  {weather.current.icon}
                </span>
                <div>
                  <strong className="weather-now-temp">{weather.current.temp}°C</strong>
                  <span className="weather-now-desc">{weather.current.description}</span>
                </div>
              </div>
              <div className="weather-now-metrics">
                <span>
                  <Droplets size={15} aria-hidden="true" /> {weather.current.humidity}% umidade
                </span>
                <span>
                  <Wind size={15} aria-hidden="true" /> {weather.current.wind} km/h
                </span>
              </div>
            </section>
          )}

          {guidance.length > 0 && (
            <section className="weather-block">
              <h2>O que fazer nos próximos dias</h2>
              <p className="weather-block-note">
                Orientações de manejo a partir da previsão — apoio à decisão do cafeicultor, não
                substitui a observação de campo e o parecer do responsável técnico.
              </p>
              <div className="guidance-grid">
                {guidance.map((item) => (
                  <GuidanceCard key={item.id} item={item} />
                ))}
              </div>
            </section>
          )}

          {weather.balance && (
            <section className="weather-block">
              <h2>Chuva e balanço hídrico</h2>
              <p className="weather-block-note">
                Chuva observada e balanço (chuva − ET0) por período. Indicativo — para irrigação
                precisa faltam solo, cultura/fase e eficiência.
              </p>
              <div className="balance-grid">
                {weather.balance.observado.map((o) => (
                  <div className="balance-card" key={o.dias}>
                    <span className="balance-title">Últimos {o.dias} dias</span>
                    <strong className="balance-rain">
                      {o.chuva.toLocaleString("pt-BR")} mm
                    </strong>
                    {o.balanco !== null ? (
                      <span
                        className="balance-def"
                        data-neg={o.balanco < 0}
                      >
                        balanço {o.balanco > 0 ? "+" : ""}
                        {o.balanco.toLocaleString("pt-BR")} mm · ET0 {o.et0?.toLocaleString("pt-BR")} mm
                      </span>
                    ) : (
                      <span className="balance-def">ET0 indisponível</span>
                    )}
                  </div>
                ))}
              </div>
              <p className="balance-forecast">
                <CloudRain size={14} aria-hidden="true" /> Chuva prevista:{" "}
                {weather.balance.previsto
                  .map((p) => `${p.dias} dias ${p.chuva.toLocaleString("pt-BR")} mm`)
                  .join(" · ")}
              </p>
            </section>
          )}

          <section className="weather-block">
            <h2>Próximos 7 dias</h2>
            <div className="weather-days">
              {weather.forecast.map((day) => (
                <div className="weather-day" key={day.date}>
                  <span className="weather-day-name">{day.weekdayLabel}</span>
                  <span className="weather-day-icon" aria-hidden="true">
                    {day.icon}
                  </span>
                  <span className="weather-day-temp">
                    <strong>{day.tempMax}°</strong> {day.tempMin}°
                  </span>
                  <span className="weather-day-rain">
                    <Droplets size={12} aria-hidden="true" /> {day.precipitationProbability}%
                  </span>
                </div>
              ))}
            </div>
          </section>

          {weather.hourly.length > 0 && (
            <section className="weather-block">
              <h2>Previsão horária (72 h)</h2>
              <p className="weather-block-note">
                Previsão determinística — a confiança probabilística não é calculada nesta fonte.
              </p>
              <div className="hourly-strip">
                {weather.hourly.map((hour, i) => (
                  <HourCell key={hour.time} hour={hour} showDay={i === 0 || hour.hourLabel === "00h"} />
                ))}
              </div>
            </section>
          )}

          {riscosDoenca.length > 0 && (
            <section className="weather-block">
              <h2>Riscos climáticos de doença</h2>
              <p className="weather-block-note">
                Favorabilidade do TEMPO à doença nas próximas 48 h (não confirma presença). Parâmetros
                técnicos em rascunho — validar com o responsável agronômico.
              </p>
              <div className="disease-grid">
                {riscosDoenca.map((risco) => (
                  <DiseaseCard
                    key={risco.id}
                    risco={risco}
                    lido={lidos.has(risco.id)}
                    onLido={() => marcarLido(risco.id)}
                  />
                ))}
              </div>
            </section>
          )}

          <section className="weather-block">
            <h2>Janela de pulverização</h2>
            <p className="weather-block-note">
              Baseada em vento, umidade, temperatura e chance de chuva — apoio à decisão, junto da
              observação de campo.
            </p>
            {weather.sprayWindows.length === 0 ? (
              <p className="weather-status">Sem horas de campo previstas no período.</p>
            ) : (
              <div className="spray-grid">
                {weather.sprayWindows.map((hour) => (
                  <SprayCard key={hour.time} hour={hour} />
                ))}
              </div>
            )}
          </section>
        </>
      )}

      <p className="weather-note">
        <span>Dados meteorológicos de fonte pública (Open-Meteo). Atualizados a cada acesso.</span>
      </p>
    </div>
  );
}

function GuidanceCard({ item }: { item: WeatherGuidance }) {
  const Icon = GUIDANCE_ICON[item.kind];
  return (
    <div className={`guidance-card guidance-card--${item.tone}`}>
      <span className="guidance-card-icon" aria-hidden="true">
        <Icon size={20} />
      </span>
      <div>
        <strong>{item.title}</strong>
        <p>{item.detail}</p>
      </div>
    </div>
  );
}

function HourCell({ hour, showDay }: { hour: HourItem; showDay: boolean }) {
  return (
    <div className="hour-cell">
      <span className="hour-day">{showDay ? hour.dayLabel : " "}</span>
      <span className="hour-time">{hour.hourLabel}</span>
      <span className="hour-icon" aria-hidden="true">{hour.icon}</span>
      <strong className="hour-temp">{hour.temp}°</strong>
      <span className="hour-rain">
        <Droplets size={11} aria-hidden="true" /> {hour.precipitationProbability}%
      </span>
      <span className="hour-wind">
        <Wind size={11} aria-hidden="true" /> {hour.wind}
      </span>
    </div>
  );
}

function DiseaseCard({
  risco,
  lido,
  onLido,
}: {
  risco: DiseaseRisk;
  lido: boolean;
  onLido: () => void;
}) {
  return (
    <div className={`disease-card disease-card--${risco.nivel}`} data-lido={lido}>
      <div className="disease-head">
        <Bug size={16} aria-hidden="true" />
        <strong>{risco.doenca}</strong>
        <span className={`disease-badge disease-badge--${risco.nivel}`}>{RISK_LABEL[risco.nivel]}</span>
      </div>
      <p className="disease-resumo">{risco.resumo}</p>
      <ul className="disease-evidencias">
        {risco.evidencias.map((e) => (
          <li key={e}>{e}</li>
        ))}
      </ul>
      <button type="button" className="disease-lido" onClick={onLido} disabled={lido}>
        {lido ? "✓ Lido" : "Marcar como lido"}
      </button>
    </div>
  );
}

function SprayCard({ hour }: { hour: SprayHour }) {
  return (
    <div className={`spray-card spray-card--${hour.rating}`}>
      <div className="spray-card-head">
        <span className="spray-card-hour">{hour.hourLabel}</span>
        <span className={`spray-badge spray-badge--${hour.rating}`}>{SPRAY_RATING_LABEL[hour.rating]}</span>
      </div>
      <span className="spray-card-day">{hour.dayLabel}</span>
      <div className="spray-card-metrics">
        <span>
          <Wind size={12} aria-hidden="true" /> {hour.wind} km/h
        </span>
        <span>
          <Droplets size={12} aria-hidden="true" /> {hour.humidity}%
        </span>
        <span>{hour.temp}°C</span>
        <span>chuva {hour.precipitationProbability}%</span>
      </div>
      <span className="spray-card-reason">{hour.reason}</span>
    </div>
  );
}
