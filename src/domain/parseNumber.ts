/**
 * Conversão numérica segura para um app que gera PRESCRIÇÃO (dose de calagem,
 * adubação, calda). O risco real: `Number("")` é 0 e `Number("3,5")` é NaN.
 * Num `<input type="number">` em pt-BR, digitar "3,5" deixa o campo inválido e
 * `value` volta "" → viraria 0 SILENCIOSO, e a dose sairia errada sem aviso.
 *
 * `parseNumberBR` aceita vírgula ou ponto, ignora separador de milhar e espaços,
 * e devolve `null` para vazio/inválido — NUNCA 0 por acidente. Quem consome
 * decide o que fazer com o null (bloquear o cálculo, destacar o campo).
 */
export function parseNumberBR(raw: string | number | null | undefined): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;

  let texto = raw.trim();
  if (texto === "") return null;

  // Remove espaços internos (ex.: "1 234,5").
  texto = texto.replace(/\s+/g, "");

  const temVirgula = texto.includes(",");
  const temPonto = texto.includes(".");
  if (temVirgula && temPonto) {
    // Formato BR "1.234,56": ponto é milhar, vírgula é decimal.
    texto = texto.replace(/\./g, "").replace(",", ".");
  } else if (temVirgula) {
    // Só vírgula: decimal brasileiro.
    texto = texto.replace(",", ".");
  }
  // Só ponto (ou nenhum): já está no formato que o Number entende.

  const valor = Number(texto);
  return Number.isFinite(valor) ? valor : null;
}

/** Igual a parseNumberBR, mas exige valor estritamente positivo (dose, área). */
export function parsePositiveBR(raw: string | number | null | undefined): number | null {
  const valor = parseNumberBR(raw);
  return valor !== null && valor > 0 ? valor : null;
}

/** Formata um número no padrão brasileiro (vírgula decimal). */
export function formatNumberBR(valor: number, casas = 2): string {
  return valor.toLocaleString("pt-BR", {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  });
}
