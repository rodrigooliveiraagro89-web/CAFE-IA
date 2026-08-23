import {
  ArrowRight,
  Bug,
  CloudRain,
  Droplets,
  Flame,
  Leaf,
  MapPin,
  RefreshCw,
  Snowflake,
  SprayCan,
  Sun,
  Wheat,
  Wind,
  type LucideIcon,
} from "lucide-react";
import type { AppView } from "../../app/navigation";
import type { AgriculturalController } from "../../lib/useAgriculturalContext";
import { SPRAY_RATING_LABEL, type SprayHour } from "../../domain/weather";
import { buildWeatherGuidance, type WeatherGuidance } from "../../domain/weatherGuidance";
import { useWeather, type WeatherSource } from "./weatherStore";
import "./weather.css";

const GUIDANCE_ICON: Record<WeatherGuidance["kind"], LucideIcon> = {
  geada: Snowflake,
  chuva: CloudRain,
  seca: Sun,
  calor: Flame,
  pulverizacao: SprayCan,
  colheita: Wheat,
  doenca: Bug,
  adubacao: Leaf,
};

type WeatherModuleProps = {
  agriculture: AgriculturalController;
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
export function WeatherModule({ agriculture, onNavigate }: WeatherModuleProps) {
  const weather = useWeather(agriculture);
  const guidance = buildWeatherGuidance(weather.forecast, weather.sprayWindows);

  return (
    <div className="page-stack platform-page">
      <header className="page-header context-page-header">
        <div>
          <span className="eyebrow">Monitoramento</span>
          <h1>Clima</h1>
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
