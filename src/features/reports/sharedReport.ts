import { propertyLocation } from "../../domain/agriculturalContext";
import { priorityLabels, type PropertyReport } from "./buildReport";

/**
 * Renderiza o relatório como um HTML autocontido (CSS inline), para ser
 * hospedado atrás de um link protegido por token e aberto por quem não tem
 * conta. É texto puro — não embute as fotos (que usam URL assinada de validade
 * curta); o PDF completo com fotos continua sendo o entregável do app.
 *
 * Função pura e testável: recebe o relatório e devolve a string HTML.
 */

const brl = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function dataBR(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function renderSharedReportHtml(report: PropertyReport): string {
  const { property, plots, executiveSummary, conclusion, totalCost, generatedAt } = report;
  const location = propertyLocation(property);

  const linhasTalhoes = plots
    .map(
      (row) => `<tr>
        <td>${esc(row.plot.name)}</td>
        <td>${esc(row.plot.crop)}</td>
        <td>${esc(row.plot.season || "—")}</td>
        <td>${row.plot.areaHectares.toLocaleString("pt-BR")}</td>
        <td>${row.ndviMean !== null ? row.ndviMean.toFixed(2) : "—"}</td>
        <td><span class="pri pri-${row.priority}">${priorityLabels[row.priority]}</span></td>
      </tr>`,
    )
    .join("");

  const linhasCustos = plots
    .map(
      (row) => `<tr>
        <td>${esc(row.plot.name)}</td>
        <td>${brl(row.costTotal)}</td>
        <td>${brl(row.costPerHectare)}</td>
      </tr>`,
    )
    .join("");

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex, nofollow" />
<title>Relatório técnico — ${esc(property.name)}</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { margin: 0; background: #f1f5f9; color: #0f172a; font-family: "Inter", system-ui, -apple-system, sans-serif; line-height: 1.55; }
  .wrap { max-width: 860px; margin: 0 auto; padding: 2rem 1.25rem 3rem; }
  .doc { background: #fff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 2rem 2.25rem; box-shadow: 0 12px 40px -24px rgba(15,23,42,.4); }
  .brand { display: flex; align-items: center; gap: .6rem; font-weight: 800; color: #059669; letter-spacing: .02em; }
  h1 { font-size: 1.5rem; margin: .6rem 0 .2rem; }
  .sub { color: #64748b; margin: 0 0 1.4rem; }
  h2 { font-size: 1.05rem; margin: 1.8rem 0 .7rem; padding-bottom: .35rem; border-bottom: 2px solid #059669; }
  table { width: 100%; border-collapse: collapse; font-size: .86rem; margin: .4rem 0 .6rem; }
  th, td { border: 1px solid #e2e8f0; padding: .5rem .65rem; text-align: left; }
  thead th { background: #059669; color: #fff; }
  tbody tr:nth-child(even) { background: #f8fafc; }
  .callout { background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 10px; padding: .9rem 1.1rem; }
  .total td { font-weight: 700; border-top: 2px solid #059669; }
  .pri { display: inline-block; padding: .1rem .5rem; border-radius: 999px; font-size: .72rem; font-weight: 700; }
  .pri-critica { background: #fee2e2; color: #b91c1c; }
  .pri-alta { background: #fef3c7; color: #b45309; }
  .pri-moderada { background: #dbeafe; color: #1d4ed8; }
  .pri-baixa { background: #dcfce7; color: #15803d; }
  .pri-sem-dados { background: #f1f5f9; color: #64748b; }
  .sign { margin-top: 3rem; display: flex; justify-content: space-between; align-items: flex-end; gap: 2rem; }
  .sign .line { min-width: 240px; text-align: center; border-top: 1px solid #0f172a; padding-top: .4rem; }
  .sign small { color: #64748b; }
  .meta { text-align: right; color: #64748b; font-size: .8rem; }
  .disclaimer { margin-top: 1.8rem; padding: .9rem 1.1rem; border: 1px solid #e2e8f0; border-radius: 10px; background: #f8fafc; font-size: .78rem; font-style: italic; color: #64748b; }
  .foot { text-align: center; color: #94a3b8; font-size: .75rem; margin-top: 1.2rem; }
</style>
</head>
<body>
  <div class="wrap">
    <div class="doc">
      <div class="brand">🌱 AGRYN</div>
      <h1>Relatório Técnico da Propriedade</h1>
      <p class="sub">${esc(property.name)}${location ? ` — ${esc(location)}` : ""}</p>

      <table>
        <tbody>
          <tr><th style="width:210px">Produtor</th><td>${esc(property.producer || "—")}</td></tr>
          <tr><th>Responsável técnico</th><td>${esc(property.responsible || "—")}</td></tr>
          <tr><th>Talhões avaliados</th><td>${plots.length}</td></tr>
          <tr><th>Emissão</th><td>${dataBR(generatedAt)}</td></tr>
        </tbody>
      </table>

      <h2>Diagnóstico executivo</h2>
      <div class="callout">${esc(executiveSummary)}</div>

      <h2>Resultados por talhão</h2>
      <table>
        <thead><tr><th>Talhão</th><th>Cultura</th><th>Safra</th><th>Área (ha)</th><th>NDVI médio</th><th>Prioridade</th></tr></thead>
        <tbody>${linhasTalhoes}</tbody>
      </table>

      <h2>Custos</h2>
      <table>
        <thead><tr><th>Talhão</th><th>Total</th><th>Custo/ha</th></tr></thead>
        <tbody>
          ${linhasCustos}
          <tr class="total"><td>Total da propriedade</td><td>${brl(totalCost)}</td><td></td></tr>
        </tbody>
      </table>

      <h2>Conclusão</h2>
      <p>${esc(conclusion)}</p>

      <div class="sign">
        <div class="line">${esc(property.responsible || "Responsável técnico")}<br /><small>Responsável técnico</small></div>
        <div class="meta">${location ? `${esc(location)}<br />` : ""}${dataBR(generatedAt)}</div>
      </div>

      <div class="disclaimer">
        Relatório gerado pela AGRYN a partir dos dados registrados na conta. As zonas de manejo
        indicam vigor relativo e não substituem laudo técnico do engenheiro(a) agrônomo(a)
        responsável. A recomendação final deve considerar textura do solo, histórico de
        produtividade, clima e legislação aplicável.
      </div>
    </div>
    <p class="foot">Documento compartilhado via AGRYN · válido por tempo limitado</p>
  </div>
</body>
</html>`;
}
