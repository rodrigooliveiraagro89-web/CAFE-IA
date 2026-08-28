import { describe, expect, it } from "vitest";
import { recomendarNutrientes5a, sugerirFormulacao } from "../../domain/coffeeFertility5a";
import { hashSnapshot } from "../../domain/recommendationSnapshot";
import { analysisToSolo, subFromValues } from "./soilToSolo";
import { buildSnapshot5a } from "./snapshot5a";

const values = { ph: 5.4, ca: 22, mg: 9, k: 90, p: 12, s: 8, organicMatter: 25, argila: 40 } as Record<string, number>;

function build(vAlvo = 60) {
  const rec = recomendarNutrientes5a({
    lavoura: { fase: "producao", produtividade_esperada_sc_ha: 45, PRNT_percentual: 95, Ve_percentual: vAlvo },
    solo: analysisToSolo(values),
    sub: subFromValues(values),
  });
  const formulacao = sugerirFormulacao(rec.necessidade_nutrientes, 5);
  return buildSnapshot5a({
    plotId: "t1",
    soilAnalysisId: "a1",
    rec,
    formulacao,
    vAlvo,
    sacas: 45,
    plantasPorHa: 3000,
    fase: "producao",
  });
}

describe("buildSnapshot5a", () => {
  it("congela a origem, a base 5ª e o NPK da recomendação", () => {
    const snap = build();
    expect(snap.plotId).toBe("t1");
    expect(snap.soilAnalysisId).toBe("a1");
    expect(snap.version).toBeTruthy(); // regra.versao da 5ª
    expect(snap.params.catalogo).toBeTruthy();
    expect(snap.params.fase).toBe("producao");
    expect(snap.npk.n).toBeGreaterThan(0);
    expect(snap.custoHa).toBe(0); // preço fora de propósito
  });

  it("hash é determinístico e muda quando um parâmetro muda (imutabilidade verificável)", async () => {
    const a = build(60);
    const b = build(60);
    const c = build(70); // V% alvo diferente
    const [ha, hb, hc] = await Promise.all([hashSnapshot(a), hashSnapshot(b), hashSnapshot(c)]);
    expect(ha).toBe(hb); // mesmo conteúdo → mesmo hash
    expect(ha).not.toBe(hc); // conteúdo diferente → hash diferente
    expect(ha).toHaveLength(64); // SHA-256 hex
  });
});
