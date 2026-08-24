import type { HourItem } from "./weather";

/**
 * Risco CLIMÁTICO de doenças — favorabilidade do tempo ao desenvolvimento de
 * doenças de café e batata. NUNCA afirma que a doença está presente: diz apenas
 * "condições favoráveis". Heurísticas de molhamento foliar (umidade alta) e
 * temperatura, com limiares nomeados. São parâmetros TÉCNICOS EM RASCUNHO
 * (draft) — validar com o responsável agronômico antes de uso comercial.
 */

export type RiskLevel = "baixo" | "medio" | "alto";

export type DiseaseRisk = {
  id: string;
  cultura: "cafe" | "batata";
  doenca: string;
  nivel: RiskLevel;
  resumo: string;
  evidencias: string[];
};

// Molhamento foliar aproximado por umidade relativa alta (proxy de folha molhada).
const RH_MOLHAMENTO = 90; // %
const RH_ALTA = 85;

function contarHoras(
  horas: HourItem[],
  cond: (h: HourItem) => boolean,
  janela = 48,
): number {
  return horas.slice(0, janela).filter(cond).length;
}

function nivelPorHoras(horas: number, alto: number, medio: number): RiskLevel {
  if (horas >= alto) return "alto";
  if (horas >= medio) return "medio";
  return "baixo";
}

// ------------------------------------------------------------------- café ----

export function diseaseRiskCafe(horas: HourItem[]): DiseaseRisk[] {
  if (horas.length === 0) return [];
  const riscos: DiseaseRisk[] = [];

  // Ferrugem (Hemileia vastatrix): molhamento foliar com temperatura amena
  // (~21–25 °C). Muitas horas úmidas nessa faixa favorecem a infecção.
  const ferrugemH = contarHoras(horas, (h) => h.humidity >= RH_MOLHAMENTO && h.temp >= 21 && h.temp <= 25);
  riscos.push({
    id: "cafe-ferrugem",
    cultura: "cafe",
    doenca: "Ferrugem",
    nivel: nivelPorHoras(ferrugemH, 8, 4),
    resumo:
      ferrugemH >= 4
        ? "Umidade alta com temperatura amena favorecem a infecção por ferrugem."
        : "Tempo pouco favorável à ferrugem no período.",
    evidencias: [`${ferrugemH} h com UR ≥ ${RH_MOLHAMENTO}% e 21–25 °C nas próximas 48 h`],
  });

  // Cercosporiose (Cercospora coffeicola): calor com umidade alta.
  const cercoH = contarHoras(horas, (h) => h.humidity >= RH_ALTA && h.temp >= 22 && h.temp <= 28);
  riscos.push({
    id: "cafe-cercospora",
    cultura: "cafe",
    doenca: "Cercosporiose",
    nivel: nivelPorHoras(cercoH, 10, 5),
    resumo:
      cercoH >= 5
        ? "Calor e umidade elevados favorecem a cercosporiose."
        : "Tempo pouco favorável à cercosporiose no período.",
    evidencias: [`${cercoH} h com UR ≥ ${RH_ALTA}% e 22–28 °C nas próximas 48 h`],
  });

  // Phoma/mancha-de-phoma: frio, umidade alta e vento.
  const phomaH = contarHoras(horas, (h) => h.humidity >= RH_MOLHAMENTO && h.temp < 18);
  const ventoso = contarHoras(horas, (h) => h.wind >= 15) >= 6;
  riscos.push({
    id: "cafe-phoma",
    cultura: "cafe",
    doenca: "Phoma",
    nivel: phomaH >= 6 && ventoso ? "alto" : phomaH >= 3 ? "medio" : "baixo",
    resumo:
      phomaH >= 3
        ? "Frio, umidade alta e vento favorecem a phoma, sobretudo em lavouras novas."
        : "Tempo pouco favorável à phoma no período.",
    evidencias: [
      `${phomaH} h com UR ≥ ${RH_MOLHAMENTO}% e < 18 °C`,
      ventoso ? "vento ≥ 15 km/h em várias horas" : "vento fraco",
    ],
  });

  return riscos;
}

// ----------------------------------------------------------------- batata ----

export function diseaseRiskBatata(horas: HourItem[]): DiseaseRisk[] {
  if (horas.length === 0) return [];
  const riscos: DiseaseRisk[] = [];

  // Requeima (Phytophthora infestans): temperatura amena com molhamento
  // prolongado (proxy do critério de Hutton: UR ≥ 90% por várias horas com
  // temperatura ≥ 10 °C).
  const requeimaH = contarHoras(horas, (h) => h.humidity >= RH_MOLHAMENTO && h.temp >= 10 && h.temp <= 24);
  riscos.push({
    id: "batata-requeima",
    cultura: "batata",
    doenca: "Requeima",
    nivel: nivelPorHoras(requeimaH, 12, 6),
    resumo:
      requeimaH >= 6
        ? "Umidade alta prolongada com temperatura amena favorecem a requeima — doença explosiva."
        : "Tempo pouco favorável à requeima no período.",
    evidencias: [`${requeimaH} h com UR ≥ ${RH_MOLHAMENTO}% e 10–24 °C nas próximas 48 h`],
  });

  // Pinta-preta (Alternaria solani): calor com molhamento intermitente.
  const pintaH = contarHoras(horas, (h) => h.humidity >= RH_ALTA && h.temp >= 24 && h.temp <= 30);
  riscos.push({
    id: "batata-pinta-preta",
    cultura: "batata",
    doenca: "Pinta-preta",
    nivel: nivelPorHoras(pintaH, 10, 5),
    resumo:
      pintaH >= 5
        ? "Calor com umidade elevada favorecem a pinta-preta."
        : "Tempo pouco favorável à pinta-preta no período.",
    evidencias: [`${pintaH} h com UR ≥ ${RH_ALTA}% e 24–30 °C nas próximas 48 h`],
  });

  return riscos;
}

/** Seleciona os riscos pela cultura do talhão (café por padrão). */
export function diseaseRiskForCrop(crop: string | undefined, horas: HourItem[]): DiseaseRisk[] {
  const c = (crop ?? "").toLowerCase();
  if (c.includes("batata")) return diseaseRiskBatata(horas);
  if (c.includes("café") || c.includes("cafe") || c === "") return diseaseRiskCafe(horas);
  return diseaseRiskCafe(horas);
}
