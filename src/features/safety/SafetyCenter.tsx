import { CheckCircle2, ExternalLink, KeyRound, LockKeyhole, ShieldCheck, XCircle } from "lucide-react";
import type { SafetyCheck } from "../../domain/safety";

type SafetyCenterProps = {
  safety: SafetyCheck;
};

const protections = [
  {
    title: "Recomendação condicionada",
    detail: "Nenhum cálculo técnico é liberado sem análise, propriedade e talhão identificados.",
    icon: ShieldCheck,
  },
  {
    title: "Segredos fora do navegador",
    detail: "A nova aplicação não solicita nem persiste chaves privadas de provedores de IA.",
    icon: KeyRound,
  },
  {
    title: "Legado isolado",
    detail: "Os módulos atuais seguem disponíveis enquanto cada domínio é migrado e validado.",
    icon: LockKeyhole,
  },
];

export function SafetyCenter({ safety }: SafetyCenterProps) {
  return (
    <div className="page-stack safety-page">
      <header className="page-header">
        <span className="eyebrow">Governança AGRYN</span>
        <h1>Confiança técnica em cada decisão</h1>
        <p>
          A AGRYN impede que valores presumidos sejam apresentados como recomendação de campo e
          separa claramente apoio inteligente, evidências utilizadas e responsabilidade técnica.
        </p>
      </header>

      <section className="protection-grid" aria-label="Proteções implementadas">
        {protections.map((item) => {
          const Icon = item.icon;
          return (
            <article key={item.title}>
              <span><Icon size={21} aria-hidden="true" /></span>
              <h2>{item.title}</h2>
              <p>{item.detail}</p>
            </article>
          );
        })}
      </section>

      <section className="readiness-panel" aria-labelledby="readiness-title">
        <div className="readiness-header">
          <div>
            <span className="eyebrow">Critérios mínimos</span>
            <h2 id="readiness-title">Liberação de recomendação e relatório</h2>
          </div>
          <span className="readiness-state" data-ready={safety.eligible}>
            {safety.eligible ? <CheckCircle2 size={17} /> : <XCircle size={17} />}
            {safety.eligible ? "Liberado para revisão" : "Bloqueado com segurança"}
          </span>
        </div>

        <p className="readiness-message">{safety.message}</p>

        <div className="criteria-columns">
          <div>
            <h3>Identificação obrigatória</h3>
            <ul>
              <li>Propriedade e talhão</li>
              <li>Laboratório responsável</li>
              <li>Data da coleta</li>
            </ul>
          </div>
          <div>
            <h3>Parâmetros obrigatórios</h3>
            <ul>
              <li>pH, matéria orgânica, P e K</li>
              <li>Ca, Mg, CTC e saturação por bases</li>
              <li>Valores dentro de faixas plausíveis</li>
            </ul>
          </div>
          <div>
            <h3>Validação profissional</h3>
            <ul>
              <li>Fórmulas e premissas visíveis</li>
              <li>Registro das alterações</li>
              <li>Aprovação do responsável técnico</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="legacy-notice">
        <div>
          <span className="eyebrow">Continuidade operacional</span>
          <h2>Funcionalidades preservadas durante a evolução</h2>
          <p>Os cálculos, históricos e integrações atuais continuam disponíveis.</p>
        </div>
        <a href="./agryn.html">
          Abrir central técnica <ExternalLink size={15} aria-hidden="true" />
        </a>
      </section>
    </div>
  );
}
