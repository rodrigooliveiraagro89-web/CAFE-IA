/**
 * rules — versionamento das regras da 5ª Aproximação e guarda-rail de faixas
 * plausíveis do solo. Suba REGRA_5A_VERSAO sempre que uma faixa, dose ou fórmula
 * mudar — o histórico salvo carrega esta âncora.
 */
import { num } from "./core";
import type { Solo0a20 } from "./types";

export const REGRA_5A_VERSAO = "5a-mg-2026-v1";
export const REGRA_5A_FONTE = "5ª Aproximação de Minas Gerais + Manual do Café (Emater-MG)";
export const CATALOGO_VERSAO = "campanha-turbo-2026-08";

// Guarda-rail: sinaliza (NÃO trava) valores fora do plausível para solo de café,
// para o produtor conferir o laudo antes de confiar na dose. Laudos incompletos
// (campos ausentes) seguem funcionando — só valores absurdos geram aviso.
const FAIXA_PLAUSIVEL: { campo: keyof Solo0a20; nome: string; min: number; max: number }[] = [
  { campo: "pH_agua", nome: "pH", min: 3, max: 8.5 },
  { campo: "materia_organica_dag_kg", nome: "M.O. (dag/kg)", min: 0, max: 15 },
  { campo: "P_mg_dm3", nome: "P (mg/dm³)", min: 0, max: 800 },
  { campo: "P_rem_mg_L", nome: "P-rem (mg/L)", min: 0, max: 70 },
  { campo: "K_mg_dm3", nome: "K (mg/dm³)", min: 0, max: 2000 },
  { campo: "Ca_cmolc_dm3", nome: "Ca (cmolc)", min: 0, max: 30 },
  { campo: "Mg_cmolc_dm3", nome: "Mg (cmolc)", min: 0, max: 20 },
  { campo: "S_mg_dm3", nome: "S (mg/dm³)", min: 0, max: 300 },
  { campo: "argila_percentual", nome: "argila (%)", min: 0, max: 100 },
];

export function alertasFaixaPlausivel(solo: Solo0a20): string[] {
  const out: string[] = [];
  for (const f of FAIXA_PLAUSIVEL) {
    const v = num(solo[f.campo] as number | null | undefined);
    if (v !== null && (v < f.min || v > f.max)) {
      out.push(`Valor fora da faixa plausível: ${f.nome} = ${v} (esperado ${f.min}–${f.max}). Confira o laudo.`);
    }
  }
  return out;
}
