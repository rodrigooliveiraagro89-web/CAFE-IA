import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertOctagon, RefreshCw } from "lucide-react";

type ErrorBoundaryProps = {
  children: ReactNode;
  /**
   * Muda de valor quando o contexto de render muda (ex.: a view ativa). Ao
   * mudar, a fronteira se rearma sozinha — assim um erro numa tela não deixa o
   * app "preso" no fallback depois que o usuário navega para outra.
   */
  resetKey?: string;
  /** Rótulo curto do que falhou, para a mensagem ("o clima", "esta tela"). */
  label?: string;
};

type ErrorBoundaryState = {
  hasError: boolean;
  message: string;
};

/**
 * Rede de segurança de UI. Sem isto, um erro de render em qualquer módulo
 * derruba o app inteiro para uma tela branca — inaceitável para quem está no
 * meio do talhão. Aqui o erro fica contido: mostramos um aviso claro em
 * português e um caminho de recuperação, sem perder o resto do app.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, message: "" };

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : "Erro inesperado.",
    };
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps) {
    // Rearma quando o contexto muda (nova view) para não travar no fallback.
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false, message: "" });
    }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Ponto único para plugar telemetria (Sentry) no futuro.
    console.error("[AGRYN] Falha de render capturada:", error, info.componentStack);
  }

  private handleReset = () => {
    this.setState({ hasError: false, message: "" });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    const alvo = this.props.label ?? "esta parte do app";
    return (
      <section className="error-boundary" role="alert">
        <span className="error-boundary-icon" aria-hidden="true">
          <AlertOctagon size={28} />
        </span>
        <div className="error-boundary-body">
          <h2>Algo deu errado em {alvo}</h2>
          <p>
            Seus dados estão salvos. Você pode tentar de novo ou recarregar o app — se
            continuar, mude de tela e volte.
          </p>
          {this.state.message && <code className="error-boundary-detail">{this.state.message}</code>}
          <div className="error-boundary-actions">
            <button type="button" className="primary-button" onClick={this.handleReset}>
              <RefreshCw size={16} aria-hidden="true" /> Tentar de novo
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={() => window.location.reload()}
            >
              Recarregar o app
            </button>
          </div>
        </div>
      </section>
    );
  }
}
