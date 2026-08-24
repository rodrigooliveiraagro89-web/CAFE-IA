/**
 * Régua de interpretação de classe (Muito baixo→Muito bom / Baixo→Alto nos
 * micros), com a classe atual destacada e colorida por nível. Usada no painel
 * de Calagem e adubação e no Relatório PDF.
 */

const ESCALA_GERAL = ["muito_baixo", "baixo", "medio", "bom", "muito_bom"];
const ESCALA_GERAL_LABEL = ["M. baixo", "Baixo", "Médio", "Bom", "M. bom"];
const ESCALA_MICRO = ["baixo", "medio", "adequado", "alto"];
const ESCALA_MICRO_LABEL = ["Baixo", "Médio", "Adeq.", "Alto"];

function corClasse(classe: string): "danger" | "warning" | "success" {
  if (classe === "muito_baixo" || classe === "baixo") return "danger";
  if (classe === "medio") return "warning";
  return "success";
}

export function ClassStrip({ escala, classe }: { escala: "geral" | "micro"; classe: string }) {
  const order = escala === "geral" ? ESCALA_GERAL : ESCALA_MICRO;
  const labels = escala === "geral" ? ESCALA_GERAL_LABEL : ESCALA_MICRO_LABEL;
  const idx = order.indexOf(classe);
  return (
    <div className="class-strip" data-cor={corClasse(classe)}>
      {order.map((o, i) => (
        <span key={o} className="class-cell" data-active={i === idx}>
          {labels[i]}
        </span>
      ))}
    </div>
  );
}
