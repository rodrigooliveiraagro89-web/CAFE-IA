import { describe, expect, it } from "vitest";
import {
  calcularCalagem,
  classificarP,
  classificarS,
  converterFertilizantes,
  doseEnxofre,
  gessagemIndicada,
  produtividadeCalculo,
  recomendarNutrientes5a,
} from "./coffeeFertility5a";

describe("classificarP (P-rem)", () => {
  it("P-rem 10–19: P=8 é médio", () => {
    expect(classificarP(8, 15, null)).toBe("medio");
  });
  it("fallback por argila quando não há P-rem", () => {
    expect(classificarP(5, null, 50)).toBe("baixo"); // argila 35–60, [3,6,9,13.5]
  });
  it("sem P-rem nem argila não classifica (trava 14.1)", () => {
    expect(classificarP(8, null, null)).toBeNull();
  });
});

describe("classificarS / doseEnxofre", () => {
  it("P-rem 10–19: S=4 é baixo", () => {
    expect(classificarS(4, 15)).toBe("baixo");
  });
  it("S baixo → N/8", () => {
    expect(doseEnxofre(300, "baixo")).toBe(37.5);
  });
  it("S médio → N/16; S bom → 0", () => {
    expect(doseEnxofre(320, "medio")).toBe(20);
    expect(doseEnxofre(300, "bom")).toBe(0);
  });
});

describe("calagem por saturação", () => {
  it("T=8,5 V=42 Ve=60 PRNT=95 → ~1,53 (PRNT100) e ~1,61 (produto)", () => {
    const r = calcularCalagem({ T: 8.5, V: 42, Ve: 60, PRNT: 95 });
    expect(r.nc_prnt100).toBeCloseTo(1.53, 2);
    expect(r.qc_produto).toBeCloseTo(1.61, 2);
  });
  it("V já no alvo → zero", () => {
    expect(calcularCalagem({ T: 8, V: 65, Ve: 60 }).nc_prnt100).toBe(0);
  });
});

describe("gessagem", () => {
  it("indica com Al 20-40 > 0,5", () => {
    expect(gessagemIndicada({ Al_cmolc_dm3: 0.7 })).toBe(true);
  });
  it("não indica sem gatilho", () => {
    expect(gessagemIndicada({ Ca_cmolc_dm3: 1.5, Al_cmolc_dm3: 0.2, m_percentual: 10 })).toBe(false);
  });
});

describe("bienalidade", () => {
  it("ano de baixa < 50% do alto → média", () => {
    expect(produtividadeCalculo(20, 60)).toBe(40);
  });
  it("normal mantém a esperada", () => {
    expect(produtividadeCalculo(45, 50)).toBe(45);
  });
});

describe("recomendarNutrientes5a — exemplo seção 13 (produção, 40 sc/ha)", () => {
  const rec = recomendarNutrientes5a({
    lavoura: { fase: "producao", produtividade_esperada_sc_ha: 40 },
    solo: {
      Ca_cmolc_dm3: 2,
      Mg_cmolc_dm3: 0.8,
      Al_cmolc_dm3: 0.2,
      H_Al_cmolc_dm3: 4,
      K_mg_dm3: 100, // médio
      P_mg_dm3: 8,
      P_rem_mg_L: 15, // P médio
      S_mg_dm3: 4, // S baixo
      B_mg_dm3: 0.25,
      extrator_B: "mehlich1", // baixo → 3
      Cu_mg_dm3: 0.8,
      extrator_Cu: "dtpa", // adequado → 1
      Mn_mg_dm3: 8,
      extrator_Mn: "mehlich1", // médio → 10
      Zn_mg_dm3: 1.5,
      extrator_Zn: "mehlich1", // baixo → 6
    },
  });

  it("classifica P médio, S baixo e micros esperados", () => {
    expect(rec.classificacoes.P).toBe("medio");
    expect(rec.classificacoes.S).toBe("baixo");
    expect(rec.classificacoes.B).toBe("baixo");
    expect(rec.classificacoes.Cu).toBe("adequado");
    expect(rec.classificacoes.Mn).toBe("medio");
    expect(rec.classificacoes.Zn).toBe("baixo");
  });

  it("doses de nutrientes batem com a base", () => {
    const n = rec.necessidade_nutrientes;
    expect(n.N_kg_ha_ano).toBe(300); // sem foliar
    expect(n.K2O_kg_ha_ano).toBe(150);
    expect(n.P2O5_kg_ha_ano).toBe(25);
    expect(n.S_kg_ha_ano).toBe(37.5);
    expect(n.B_kg_ha).toBe(3);
    expect(n.Cu_kg_ha).toBe(1);
    expect(n.Mn_kg_ha).toBe(10);
    expect(n.Zn_kg_ha).toBe(6);
  });

  it("converte em fertilizantes (MAP, ureia, KCl, gesso)", () => {
    const itens = converterFertilizantes(rec.necessidade_nutrientes);
    const map = itens.find((i) => i.produto === "MAP");
    const ureia = itens.find((i) => i.produto === "Ureia");
    const kcl = itens.find((i) => i.produto.includes("KCl"));
    const gesso = itens.find((i) => i.produto === "Gesso agrícola");
    expect(map?.kg_ha).toBe(48); // 25 / 0,52
    expect(kcl?.kg_ha).toBe(250); // 150 / 0,60
    expect(gesso?.kg_ha).toBe(250); // 37,5 / 0,15
    expect(ureia && ureia.kg_ha).toBeGreaterThan(600); // N restante / 0,45
  });

  it("N cai com análise foliar alta (3,3 → coluna 3,1–3,5)", () => {
    const comFoliar = recomendarNutrientes5a({
      lavoura: { fase: "producao", produtividade_esperada_sc_ha: 40 },
      solo: { K_mg_dm3: 100, P_mg_dm3: 8, P_rem_mg_L: 15 },
      foliar: { N_dag_kg: 3.3 },
    });
    expect(comFoliar.necessidade_nutrientes.N_kg_ha_ano).toBe(140);
  });
});
