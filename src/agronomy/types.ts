/**
 * Tipos da camada agronômica (5ª Aproximação). Só declarações — sem lógica —
 * para servir de base a todos os engines sem risco de import circular.
 */

export type Fase =
  | "implantacao"
  | "pos_plantio"
  | "formacao_1_ano"
  | "formacao_2_ano"
  | "esqueletado_1_ano"
  | "recepado_1_ano"
  | "producao";

export type ClasseGeral = "muito_baixo" | "baixo" | "medio" | "bom" | "muito_bom";
export type ClasseMicro = "baixo" | "medio" | "adequado" | "alto";

export type ExtratorB = "mehlich1" | "hcl" | "agua_quente";
export type ExtratorMetalico = "mehlich1" | "dtpa";

export type Sistema = "sequeiro" | "irrigado";

export type Solo0a20 = {
  pH_agua?: number | null;
  materia_organica_dag_kg?: number | null;
  P_mg_dm3?: number | null;
  P_rem_mg_L?: number | null;
  argila_percentual?: number | null;
  K_mg_dm3?: number | null;
  Ca_cmolc_dm3?: number | null;
  Mg_cmolc_dm3?: number | null;
  Al_cmolc_dm3?: number | null;
  H_Al_cmolc_dm3?: number | null;
  S_mg_dm3?: number | null;
  B_mg_dm3?: number | null;
  extrator_B?: ExtratorB | null;
  Cu_mg_dm3?: number | null;
  extrator_Cu?: ExtratorMetalico | null;
  Mn_mg_dm3?: number | null;
  extrator_Mn?: ExtratorMetalico | null;
  Zn_mg_dm3?: number | null;
  extrator_Zn?: ExtratorMetalico | null;
};

export type Solo20a40 = {
  Ca_cmolc_dm3?: number | null;
  Al_cmolc_dm3?: number | null;
  m_percentual?: number | null;
};

export type Foliar = {
  N_dag_kg?: number | null;
};

export type Lavoura = {
  fase: Fase;
  produtividade_esperada_sc_ha?: number | null;
  produtividade_safra_anterior_sc_ha?: number | null;
  plantas_ha?: number | null; // população efetiva — converte g/planta em kg/ha
  numero_parcelamentos?: number | null; // parcelas de N por ciclo
  sistema?: Sistema | null;
  Ve_percentual?: number | null; // alvo de saturação; padrão 60
  PRNT_percentual?: number | null;
  superficie_coberta_percentual?: number | null; // padrão 100
  profundidade_correcao_cm?: number | null; // padrão 20
};

export type MicroSaida = { classe: ClasseMicro | null; dose_kg_ha: number | null };

export type MicroFonte = {
  nutriente: string;
  produto: string;
  teor_pct: number;
  dose_produto_kg_ha: number;
  via: string;
  obs?: string;
};

export type DosesPorPlanta = {
  N_g_planta_aplicacao: number | null;
  N_aplicacoes: number | null;
  K2O_g_planta_ano: number | null;
  P2O5_g_cova: number | null;
  P2O5_g_m_sulco: number | null;
  S_g_planta: number | null;
  B_g_planta: number | null;
  Zn_g_planta: number | null;
  plantas_ha: number | null;
};

export type Recomendacao5a = {
  fase: Fase;
  fase_label: string;
  produtividade_calculo_sc_ha: number | null;
  indices: {
    K_cmolc_dm3: number | null;
    SB: number | null;
    T: number | null;
    t: number | null;
    V_percentual: number | null;
    m_percentual: number | null;
    Ca_Mg_ratio: number | null;
  };
  classificacoes: {
    materia_organica: ClasseGeral | null;
    Ca: ClasseGeral | null;
    Mg: ClasseGeral | null;
    T: ClasseGeral | null;
    V: ClasseGeral | null;
    P: ClasseGeral | null;
    S: ClasseGeral | null;
    B: ClasseMicro | null;
    Cu: ClasseMicro | null;
    Mn: ClasseMicro | null;
    Zn: ClasseMicro | null;
  };
  necessidade_nutrientes: {
    N_kg_ha_ano: number | null;
    P2O5_kg_ha_ano: number | null;
    K2O_kg_ha_ano: number | null;
    S_kg_ha_ano: number | null;
    B_kg_ha: number | null;
    Cu_kg_ha: number | null;
    Mn_kg_ha: number | null;
    Zn_kg_ha: number | null;
  };
  doses_por_planta: DosesPorPlanta | null;
  correcao_solo: {
    calagem_t_ha_prnt100: number | null;
    calagem_t_ha_produto: number | null;
    corretivo_sugerido: string | null; // tipo de calcário conforme Ca:Mg/Mg
    corretivo_motivo: string | null;
    gessagem_indicada: boolean;
    gesso_t_ha: number | null; // dose de gesso (NG = 0,25 × NC)
    gesso_ca_kg_ha: number | null; // Ca fornecido pelo gesso
    gesso_s_kg_ha: number | null; // S fornecido pelo gesso
  };
  fontes_micros: MicroFonte[];
  alertas: string[];
  // Carimbo de versão da regra e da fonte técnica — torna a recomendação
  // auditável e reancorável (o payload salvo carrega a versão que o gerou).
  regra: { versao: string; fonte: string; catalogo: string };
};

export type FertilizanteItem = { produto: string; formula: string; kg_ha: number; obs?: string };

export type FormulacaoItem = {
  produto: string;
  formula: string;
  codigo?: string; // código do produto no catálogo comercial
  kg_ha: number;
  kg_total: number | null; // dimensionado para a área do talhão
  sacas_50: number | null; // sacas de 50 kg
  obs?: string;
};

export type FormulacaoPlano = {
  area_ha: number | null;
  principal: FormulacaoItem | null;
  complementos: FormulacaoItem[];
  observacoes: string[];
};

export type ParcelaAdubacao = {
  ordem: number;
  epoca: string;
  N_kg_ha: number;
  P2O5_kg_ha: number;
  K2O_kg_ha: number;
  S_kg_ha: number;
};
