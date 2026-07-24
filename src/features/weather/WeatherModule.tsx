import { ArrowRight, ExternalLink } from "lucide-react";
import type { AppView } from "../../app/navigation";
import "./weather.css";

type WeatherModuleProps = {
  onNavigate: (view: AppView) => void;
};

/**
 * O módulo de clima avançado (mapa, previsão, janela de pulverização) vive em
 * `clima.html`. Em vez de reescrevê-lo agora, ele é embutido aqui para que o
 * produtor não saia do app — mantendo menu, sessão e navegação.
 */
export function WeatherModule({ onNavigate }: WeatherModuleProps) {
  return (
    <div className="page-stack platform-page">
      <header className="page-header context-page-header">
        <div>
          <span className="eyebrow">Monitoramento</span>
          <h1>Clima</h1>
          <p>
            Previsão, mapa e janela operacional para planejar pulverização e adubação.
          </p>
        </div>
        <button className="secondary-button" type="button" onClick={() => onNavigate("caderno")}>
          Registrar atividade <ArrowRight size={17} />
        </button>
      </header>

      <section className="weather-frame-card">
        <iframe
          src="./clima.html"
          title="Clima avançado — AGRYN"
          allow="geolocation"
          className="weather-frame"
        />
      </section>

      <p className="weather-note">
        <span>
          Dados meteorológicos de fonte pública. Use como apoio à decisão, junto da
          observação de campo.
        </span>
        <a href="./clima.html" target="_blank" rel="noopener noreferrer">
          Abrir em tela cheia <ExternalLink size={14} aria-hidden="true" />
        </a>
      </p>
    </div>
  );
}
