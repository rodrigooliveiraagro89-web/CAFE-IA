import type { Solo0a20 } from "../../domain/coffeeFertility5a";
import type { SoilValues } from "../../domain/soilAnalysis";

/**
 * Converte os valores do laudo (SoilValues, unidades de laboratório) para a
 * entrada do motor da 5ª Aproximação (Solo0a20). Ca/Mg em mmolc → cmolc; H+Al e
 * Al são derivados de CTC/V/m% quando o laudo não os traz explicitamente.
 * Fonte única usada pelo Relatório e pela Lista de compras (o painel tem sua
 * própria versão que ainda mescla os complementos digitados pelo produtor).
 */
export function analysisToSolo(v: SoilValues | undefined | null): Solo0a20 {
  const caC = v?.ca != null ? v.ca / 10 : null;
  const mgC = v?.mg != null ? v.mg / 10 : null;
  const kC = v?.k != null ? v.k / 391 : null;
  const sb = caC != null && mgC != null && kC != null ? caC + mgC + kC : null;
  const hAl = v?.hAl ?? (sb != null && v?.ctc != null ? Math.max(0, v.ctc - sb) : null);
  const mPct = v?.mPercent ?? null;
  const al = v?.al ?? (sb != null && mPct != null && mPct < 100 ? (mPct * sb) / (100 - mPct) : null);
  return {
    pH_agua: v?.ph ?? null,
    materia_organica_dag_kg: v?.organicMatter ?? null,
    P_mg_dm3: v?.p ?? null,
    P_rem_mg_L: v?.pRem ?? null,
    argila_percentual: v?.argila ?? null,
    K_mg_dm3: v?.k ?? null,
    Ca_cmolc_dm3: caC,
    Mg_cmolc_dm3: mgC,
    Al_cmolc_dm3: al,
    H_Al_cmolc_dm3: hAl,
    S_mg_dm3: v?.s ?? null,
    B_mg_dm3: v?.b ?? null,
    extrator_B: v?.extratorB ?? null,
    Cu_mg_dm3: v?.cu ?? null,
    extrator_Cu: v?.extratorMicros ?? null,
    Mn_mg_dm3: v?.mn ?? null,
    extrator_Mn: v?.extratorMicros ?? null,
    Zn_mg_dm3: v?.zn ?? null,
    extrator_Zn: v?.extratorMicros ?? null,
  };
}

export function subFromValues(v: SoilValues | undefined | null) {
  const ca = v?.ca2040 ?? null;
  const al = v?.al2040 ?? null;
  const m = v?.m2040 ?? null;
  if (ca === null && al === null && m === null) return null;
  return { Ca_cmolc_dm3: ca, Al_cmolc_dm3: al, m_percentual: m };
}
