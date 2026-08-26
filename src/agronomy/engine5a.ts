/**
 * Motor de recomendação de nutrientes para café arábica — 5ª Aproximação de
 * Minas Gerais + Manual do Café (Emater-MG). Transcreve as tabelas e regras da
 * base técnica AGRYN/YaCafé. Lógica PURA e auditável: as saídas são em NUTRIENTE
 * (N, P2O5, K2O, Ca, Mg, S, micros) antes da conversão para fertilizantes.
 *
 * Cobre TODAS as fases da lavoura (implantação, pós-plantio, formação 1º/2º ano,
 * recepa e esqueletamento 1º ano, produção). As fases de campo trabalham em
 * g/planta e g/cova; o motor converte para kg/ha quando a população é informada.
 *
 * Não substitui o parecer do responsável técnico. Toda faixa e dose vem de
 * constante nomeada, com as travas de segurança da seção 14 do documento.
 */

import { calcularIndices, num, round } from "./core";
import {
  calcularCalagem,
  doseGessagem,
  escolherCorretivo,
  gessagemIndicada,
} from "./correctionEngine";
import { fontesMicros } from "./fertilizerEngine";
import {
  boroPlantioGPlanta,
  CLASSE_P_INDEX,
  colunaK,
  colunaNfoliar,
  doseEnxofre,
  faixaProdutividade,
  gPlantaParaKgHa,
  K2O_G_PLANTA_ANO,
  K2O_PRODUCAO,
  N_G_PLANTA_APLIC,
  N_PRODUCAO,
  P2O5_COVA_G,
  P2O5_PRODUCAO,
  PARCELAS_PADRAO,
  produtividadeCalculo,
  SULCO_FATOR,
  zincoPlantioGPlanta,
} from "./nutrientEngine";
import { alertasFaixaPlausivel, CATALOGO_VERSAO, REGRA_5A_FONTE, REGRA_5A_VERSAO } from "./rules";
import {
  avaliarMicro,
  classeGeral,
  classificarP,
  classificarPImplantacao,
  classificarS,
  LIM_CA,
  LIM_MG,
  LIM_MO,
  LIM_T,
  LIM_V,
  MICRO_B,
  MICRO_CU,
  MICRO_MN,
  MICRO_ZN,
} from "./soilEngine";
import type {
  DosesPorPlanta,
  Fase,
  Foliar,
  Lavoura,
  Recomendacao5a,
  Solo0a20,
  Solo20a40,
} from "./types";

export const FASE_LABEL: Record<Fase, string> = {
  implantacao: "Implantação (cova/sulco)",
  pos_plantio: "Pós-plantio (pegamento)",
  formacao_1_ano: "Formação — 1º ano",
  formacao_2_ano: "Formação — 2º ano",
  recepado_1_ano: "Recepa — 1º ano",
  esqueletado_1_ano: "Esqueletamento — 1º ano",
  producao: "Lavoura em produção",
};
// --------------------------------------------------------------- motor -------

export function recomendarNutrientes5a(input: {
  lavoura: Lavoura;
  solo: Solo0a20;
  sub?: Solo20a40 | null;
  foliar?: Foliar | null;
}): Recomendacao5a {
  const { lavoura, solo } = input;
  const fase = lavoura.fase;
  const idx = calcularIndices(solo);
  const alertas: string[] = [];
  const plantasHa = num(lavoura.plantas_ha);

  const classificacoes = {
    materia_organica: classeGeral(num(solo.materia_organica_dag_kg), LIM_MO),
    Ca: classeGeral(num(solo.Ca_cmolc_dm3), LIM_CA),
    Mg: classeGeral(num(solo.Mg_cmolc_dm3), LIM_MG),
    T: classeGeral(idx.T, LIM_T),
    V: classeGeral(idx.V_percentual, LIM_V),
    P: classificarP(num(solo.P_mg_dm3), num(solo.P_rem_mg_L), num(solo.argila_percentual)),
    S: classificarS(num(solo.S_mg_dm3), num(solo.P_rem_mg_L)),
    B: avaliarMicro(num(solo.B_mg_dm3), solo.extrator_B, solo.extrator_B ? MICRO_B[solo.extrator_B] : undefined).classe,
    Cu: avaliarMicro(num(solo.Cu_mg_dm3), solo.extrator_Cu, solo.extrator_Cu ? MICRO_CU[solo.extrator_Cu] : undefined).classe,
    Mn: avaliarMicro(num(solo.Mn_mg_dm3), solo.extrator_Mn, solo.extrator_Mn ? MICRO_MN[solo.extrator_Mn] : undefined).classe,
    Zn: avaliarMicro(num(solo.Zn_mg_dm3), solo.extrator_Zn, solo.extrator_Zn ? MICRO_ZN[solo.extrator_Zn] : undefined).classe,
  };

  const microB = avaliarMicro(num(solo.B_mg_dm3), solo.extrator_B, solo.extrator_B ? MICRO_B[solo.extrator_B] : undefined);
  const microCu = avaliarMicro(num(solo.Cu_mg_dm3), solo.extrator_Cu, solo.extrator_Cu ? MICRO_CU[solo.extrator_Cu] : undefined);
  const microMn = avaliarMicro(num(solo.Mn_mg_dm3), solo.extrator_Mn, solo.extrator_Mn ? MICRO_MN[solo.extrator_Mn] : undefined);
  const microZn = avaliarMicro(num(solo.Zn_mg_dm3), solo.extrator_Zn, solo.extrator_Zn ? MICRO_ZN[solo.extrator_Zn] : undefined);

  // Calagem e gessagem (independem da fase; sempre calculadas quando há dados).
  const calagem = calcularCalagem({
    T: idx.T,
    V: idx.V_percentual,
    Ve: lavoura.Ve_percentual,
    PRNT: lavoura.PRNT_percentual,
    superficie_coberta_percentual: lavoura.superficie_coberta_percentual,
    profundidade_correcao_cm: lavoura.profundidade_correcao_cm,
  });
  const gessagem = gessagemIndicada(input.sub);
  const gesso = doseGessagem(calagem.nc_prnt100, gessagem);
  const corretivo =
    calagem.nc_prnt100 !== null && calagem.nc_prnt100 > 0
      ? escolherCorretivo(classificacoes.Mg, idx.Ca_Mg_ratio)
      : null;

  // Macronutrientes por fase.
  let N: number | null = null;
  let K2O: number | null = null;
  let P2O5: number | null = null;
  let prodCalc: number | null = null;
  let doses: DosesPorPlanta | null = null;

  const Kmg = num(solo.K_mg_dm3);
  const colK = colunaK(Kmg);

  if (fase === "producao") {
    prodCalc = produtividadeCalculo(
      num(lavoura.produtividade_esperada_sc_ha),
      num(lavoura.produtividade_safra_anterior_sc_ha),
    );
    if (prodCalc !== null) {
      const linha = faixaProdutividade(prodCalc);
      N = N_PRODUCAO[linha][colunaNfoliar(num(input.foliar?.N_dag_kg))];
      K2O = colK < 0 ? null : K2O_PRODUCAO[linha][colK];
      if (colK < 0) alertas.push("Informe o teor de K do laudo (mg/dm³) para calcular o K2O.");
      const classP = classificacoes.P;
      P2O5 = classP ? P2O5_PRODUCAO[linha][CLASSE_P_INDEX[classP]] : null;
      if (!classP) alertas.push("Sem P-rem nem argila: P2O5 não calculado (informe um deles).");
    } else {
      alertas.push("Informe a produtividade esperada para calcular N, K2O e P2O5.");
    }
  } else if (fase === "implantacao") {
    // Implantação: P2O5 na cova (g/cova) por classe própria (seção 5.1).
    const classPImp = classificarPImplantacao(num(solo.P_mg_dm3), num(solo.P_rem_mg_L));
    const p2o5Cova = classPImp ? P2O5_COVA_G[classPImp] : null;
    if (!classPImp && num(solo.P_mg_dm3) !== null) {
      alertas.push("Implantação exige P-rem para a dose de P2O5 na cova (seção 5.1).");
    }
    doses = {
      N_g_planta_aplicacao: null,
      N_aplicacoes: null,
      K2O_g_planta_ano: null,
      P2O5_g_cova: p2o5Cova,
      P2O5_g_m_sulco: p2o5Cova !== null ? round(p2o5Cova * SULCO_FATOR, 0) : null,
      S_g_planta: 12, // se N/P não fornecerem S (seção 5.2)
      B_g_planta: boroPlantioGPlanta(classificacoes.B),
      Zn_g_planta: zincoPlantioGPlanta(classificacoes.Zn),
      plantas_ha: plantasHa,
    };
    alertas.push("Dose de P na cova/sulco; B e Zn só se o laudo indicar necessidade e houver mistura homogênea.");
  } else {
    // Pós-plantio / formação 1º e 2º ano / recepa / esqueletamento — g/planta.
    const nAplic = num(N_G_PLANTA_APLIC[fase]);
    const nParcelas = num(lavoura.numero_parcelamentos) ?? PARCELAS_PADRAO[fase];
    const k2oTab = K2O_G_PLANTA_ANO[fase];
    const k2oGPlanta = k2oTab && colK >= 0 ? k2oTab[colK] : null;
    const nAnualGPlanta = nAplic !== null ? nAplic * nParcelas : null;

    N = gPlantaParaKgHa(nAnualGPlanta, plantasHa);
    K2O = gPlantaParaKgHa(k2oGPlanta, plantasHa);
    // P2O5 dispensado na formação/recepa quando a cova foi bem feita (seção 6).
    P2O5 = null;

    doses = {
      N_g_planta_aplicacao: nAplic,
      N_aplicacoes: nAplic !== null ? nParcelas : null,
      K2O_g_planta_ano: k2oGPlanta,
      P2O5_g_cova: null,
      P2O5_g_m_sulco: null,
      S_g_planta: fase === "pos_plantio" ? 12 : null,
      B_g_planta: fase === "pos_plantio" ? boroPlantioGPlanta(classificacoes.B) : null,
      Zn_g_planta: fase === "pos_plantio" ? zincoPlantioGPlanta(classificacoes.Zn) : null,
      plantas_ha: plantasHa,
    };

    if (plantasHa === null) {
      alertas.push("Informe a população (plantas/ha) para converter as doses por planta em kg/ha.");
    }
    alertas.push("N é por aplicação; o total anual usa o nº de parcelas (padrão da fase). Parcele N e K no período chuvoso.");
    if (fase === "recepado_1_ano" || fase === "esqueletado_1_ano") {
      alertas.push("Recepa/esqueletamento: monitorar Zn nas brotações (diagnóstico foliar) e P2O5 pode ser dispensado se houve residual.");
    }
    if (fase === "formacao_2_ano") {
      alertas.push("Se houver perspectiva de colheita no 2º ano, migrar para as regras de lavoura em produção.");
    }
  }

  // Enxofre em kg/ha a partir do N recomendado (quando N em kg/ha é conhecido).
  const S = doseEnxofre(N, classificacoes.S);

  // Alerta de relação Ca:Mg fora de 3:1–5:1 (seção 3).
  if (idx.Ca_Mg_ratio !== null && (idx.Ca_Mg_ratio < 3 || idx.Ca_Mg_ratio > 5)) {
    alertas.push(`Relação Ca:Mg ${round(idx.Ca_Mg_ratio, 1)} fora da faixa 3:1–5:1 — considerar na escolha do corretivo.`);
  }

  // Sistema irrigado: aumentar parcelamentos, não a dose (trava 14.8).
  if (lavoura.sistema === "irrigado") {
    alertas.push("Lavoura irrigada: aumentar o número de parcelamentos, não a dose total (trava 14.8).");
  }

  // Guarda-rail de faixas plausíveis (avisa, não trava) — inclui CTC derivada.
  alertas.push(...alertasFaixaPlausivel(solo));
  if (idx.T !== null && (idx.T <= 0 || idx.T > 60)) {
    alertas.push(`CTC (T) implausível: ${round(idx.T, 1)} — confira Ca/Mg/K/H+Al do laudo.`);
  }
  if (idx.V_percentual !== null && (idx.V_percentual < 0 || idx.V_percentual > 100)) {
    alertas.push(`V% implausível: ${round(idx.V_percentual, 1)} — confira as bases e o H+Al.`);
  }

  // Travas de segurança (seção 14) e observações.
  if (num(solo.P_rem_mg_L) === null && num(solo.argila_percentual) === null) {
    alertas.push("Informe P-rem ou o teor de argila para classificar o fósforo (trava 14.1).");
  }
  for (const [nome, ext] of [
    ["B", solo.extrator_B],
    ["Cu", solo.extrator_Cu],
    ["Mn", solo.extrator_Mn],
    ["Zn", solo.extrator_Zn],
  ] as const) {
    if (num((solo as Record<string, number | null | undefined>)[`${nome}_mg_dm3`]) !== null && !ext) {
      alertas.push(`Informe o extrator do ${nome} para calcular o micronutriente (trava 14.2).`);
    }
  }
  if (classificacoes.Mn === "baixo" && num(solo.pH_agua) !== null && (solo.pH_agua as number) >= 6.0) {
    alertas.push("Mn baixo com pH alto: possível supercalagem — avaliar (trava 14.7).");
  }
  if (calagem.nc_prnt100 !== null && num(lavoura.PRNT_percentual) === null) {
    alertas.push("Informe o PRNT do calcário para a quantidade comercial exata (usado PRNT 95 padrão).");
  }
  alertas.push("Descontar nutrientes fornecidos por matéria orgânica, calcário, gesso e demais fontes.");
  alertas.push("Validar micronutrientes com análise foliar antes de reaplicar.");

  return {
    fase,
    fase_label: FASE_LABEL[fase],
    produtividade_calculo_sc_ha: prodCalc,
    indices: idx,
    classificacoes,
    necessidade_nutrientes: {
      N_kg_ha_ano: N,
      P2O5_kg_ha_ano: P2O5,
      K2O_kg_ha_ano: K2O,
      S_kg_ha_ano: S,
      B_kg_ha: microB.dose_kg_ha,
      Cu_kg_ha: microCu.dose_kg_ha,
      Mn_kg_ha: microMn.dose_kg_ha,
      Zn_kg_ha: microZn.dose_kg_ha,
    },
    doses_por_planta: doses,
    correcao_solo: {
      calagem_t_ha_prnt100: calagem.nc_prnt100,
      calagem_t_ha_produto: calagem.qc_produto,
      corretivo_sugerido: corretivo?.tipo ?? null,
      corretivo_motivo: corretivo?.motivo ?? null,
      gessagem_indicada: gessagem,
      gesso_t_ha: gesso.gesso_t_ha,
      gesso_ca_kg_ha: gesso.ca_kg_ha,
      gesso_s_kg_ha: gesso.s_kg_ha,
    },
    fontes_micros: fontesMicros({
      N_kg_ha_ano: N,
      P2O5_kg_ha_ano: P2O5,
      K2O_kg_ha_ano: K2O,
      S_kg_ha_ano: S,
      B_kg_ha: microB.dose_kg_ha,
      Cu_kg_ha: microCu.dose_kg_ha,
      Mn_kg_ha: microMn.dose_kg_ha,
      Zn_kg_ha: microZn.dose_kg_ha,
    }),
    alertas,
    regra: { versao: REGRA_5A_VERSAO, fonte: REGRA_5A_FONTE, catalogo: CATALOGO_VERSAO },
  };
}
