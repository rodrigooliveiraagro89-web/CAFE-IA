import { ArrowRight, FlaskConical, PlayCircle, Satellite, Sprout } from "lucide-react";

type WelcomeScreenProps = {
  name?: string;
  onLoadDemo: () => void;
  onCreate: () => void;
};

/**
 * Primeiro acesso: em vez de uma tela vazia, o novo usuário vê o que o AGRYN faz
 * e pode explorar com DADOS DE EXEMPLO (fictícios, nunca salvos) em um clique —
 * valor na hora, antes de cadastrar qualquer coisa.
 */
export function WelcomeScreen({ name, onLoadDemo, onCreate }: WelcomeScreenProps) {
  const passos = [
    { icon: Sprout, titulo: "Cadastre a propriedade e os talhões", texto: "Suas áreas de café, com cultura e safra." },
    { icon: FlaskConical, titulo: "Envie o laudo de solo", texto: "A IA lê o PDF/foto e interpreta os nutrientes." },
    { icon: Satellite, titulo: "Receba a recomendação", texto: "Calagem, adubação pelo Boletim 100 e NDVI por satélite." },
  ];
  return (
    <div className="welcome">
      <div className="welcome-hero">
        <span className="eyebrow">🌱 Bem-vindo{name ? `, ${name}` : ""} ao AGRYN</span>
        <h1>Do laudo à recomendação de adubação, sem planilha</h1>
        <p>
          Inteligência agronômica para o cafeicultor: análise de solo por IA, calagem e adubação
          pelo Boletim 100, monitoramento por satélite e relatório técnico — tudo por talhão.
        </p>
        <div className="welcome-cta">
          <button type="button" className="primary-button" onClick={onLoadDemo}>
            <PlayCircle size={18} /> Explorar com dados de exemplo
          </button>
          <button type="button" className="secondary-button" onClick={onCreate}>
            Cadastrar minha propriedade <ArrowRight size={17} />
          </button>
        </div>
        <small className="welcome-note">
          Os dados de exemplo são fictícios e não são salvos — é só para você ver o app funcionando.
        </small>
      </div>

      <ol className="welcome-steps">
        {passos.map((passo, index) => (
          <li key={passo.titulo}>
            <span className="welcome-step-num">{index + 1}</span>
            <span className="welcome-step-icon"><passo.icon size={20} aria-hidden="true" /></span>
            <div>
              <strong>{passo.titulo}</strong>
              <p>{passo.texto}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
