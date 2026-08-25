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
  sugerirFormulacao,
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

describe("fases de formação e campo (g/planta → kg/ha)", () => {
  const soloBase = { K_mg_dm3: 100, P_mg_dm3: 8, P_rem_mg_L: 15 }; // K médio (60–120)

  it("formação 1º ano: N 10 g/planta × 3 parcelas e K2O 20 g/planta (K médio), com 4.000 plantas/ha", () => {
    const rec = recomendarNutrientes5a({
      lavoura: { fase: "formacao_1_ano", plantas_ha: 4000 },
      solo: soloBase,
    });
    expect(rec.doses_por_planta?.N_g_planta_aplicacao).toBe(10);
    expect(rec.doses_por_planta?.N_aplicacoes).toBe(3);
    expect(rec.doses_por_planta?.K2O_g_planta_ano).toBe(20);
    // N anual = 10 × 3 × 4000 / 1000 = 120; K2O = 20 × 4000 / 1000 = 80.
    expect(rec.necessidade_nutrientes.N_kg_ha_ano).toBe(120);
    expect(rec.necessidade_nutrientes.K2O_kg_ha_ano).toBe(80);
    expect(rec.necessidade_nutrientes.P2O5_kg_ha_ano).toBeNull();
  });

  it("formação 2º ano: N 20 g/planta e K2O 40 g/planta (K médio)", () => {
    const rec = recomendarNutrientes5a({
      lavoura: { fase: "formacao_2_ano", plantas_ha: 4000 },
      solo: soloBase,
    });
    expect(rec.doses_por_planta?.N_g_planta_aplicacao).toBe(20);
    expect(rec.doses_por_planta?.K2O_g_planta_ano).toBe(40);
    expect(rec.necessidade_nutrientes.N_kg_ha_ano).toBe(240); // 20×3×4000/1000
    expect(rec.necessidade_nutrientes.K2O_kg_ha_ano).toBe(160);
  });

  it("recepa 1º ano usa as regras do 2º ano de formação", () => {
    const rec = recomendarNutrientes5a({
      lavoura: { fase: "recepado_1_ano", plantas_ha: 4000 },
      solo: soloBase,
    });
    expect(rec.doses_por_planta?.N_g_planta_aplicacao).toBe(20);
    expect(rec.doses_por_planta?.K2O_g_planta_ano).toBe(40);
    expect(rec.alertas.some((a) => /Zn nas brotações/i.test(a))).toBe(true);
  });

  it("pós-plantio: K2O 20 g/planta (K médio) e S 12 g/planta", () => {
    const rec = recomendarNutrientes5a({
      lavoura: { fase: "pos_plantio", plantas_ha: 4000 },
      solo: soloBase,
    });
    expect(rec.doses_por_planta?.K2O_g_planta_ano).toBe(20);
    expect(rec.doses_por_planta?.S_g_planta).toBe(12);
  });

  it("sem população, N/K2O em kg/ha ficam nulos e há alerta", () => {
    const rec = recomendarNutrientes5a({
      lavoura: { fase: "formacao_1_ano" },
      solo: soloBase,
    });
    expect(rec.necessidade_nutrientes.N_kg_ha_ano).toBeNull();
    expect(rec.necessidade_nutrientes.K2O_kg_ha_ano).toBeNull();
    expect(rec.alertas.some((a) => /plantas\/ha/i.test(a))).toBe(true);
  });

  it("implantação: P2O5 na cova por classe de implantação (P-rem)", () => {
    const rec = recomendarNutrientes5a({
      lavoura: { fase: "implantacao", plantas_ha: 4000 },
      solo: { P_mg_dm3: 20, P_rem_mg_L: 15 }, // faixa 10–19: 20 → baixo → 65 g/cova
    });
    expect(rec.doses_por_planta?.P2O5_g_cova).toBe(65);
    expect(rec.doses_por_planta?.P2O5_g_m_sulco).toBe(163); // 65 × 2,5
    expect(rec.necessidade_nutrientes.N_kg_ha_ano).toBeNull();
  });
});

describe("sugerirFormulacao — melhor formulado para a área", () => {
  const base = {
    N_kg_ha_ano: 300, P2O5_kg_ha_ano: 0, K2O_kg_ha_ano: 150, S_kg_ha_ano: 0,
    B_kg_ha: null, Cu_kg_ha: null, Mn_kg_ha: null, Zn_kg_ha: null,
  };

  it("N 300 / K2O 150 → 20-00-10 (encaixe exato de K), dimensionado para 2 ha", () => {
    const plano = sugerirFormulacao(base, 2);
    // 20-00-10 dosado ao N entrega exatamente 150 kg de K₂O (1500 × 10%).
    expect(plano.principal?.formula).toBe("20-00-10");
    expect(plano.principal?.kg_ha).toBe(1500); // 300 / 0,20
    expect(plano.principal?.kg_total).toBe(3000); // × 2 ha
    expect(plano.principal?.sacas_50).toBe(60);
    // Sem falta de K → sem KCl.
    expect(plano.complementos.find((c) => c.produto.includes("KCl"))).toBeUndefined();
  });

  it("K2O zero (solo rico) → formulado só de N do catálogo, sem KCl", () => {
    const plano = sugerirFormulacao({ ...base, K2O_kg_ha_ano: 0 }, 1);
    expect(plano.principal?.formula.endsWith("-00-00")).toBe(true); // K = 0
    expect(plano.complementos.find((c) => c.produto.includes("KCl"))).toBeUndefined();
  });

  it("usa o catálogo comercial (código FER)", () => {
    const plano = sugerirFormulacao(base, 5);
    expect(plano.principal?.codigo).toMatch(/^FER\d+/);
  });

  it("N ausente (fase de campo sem população) → sem formulação", () => {
    const plano = sugerirFormulacao({ ...base, N_kg_ha_ano: null }, 3);
    expect(plano.principal).toBeNull();
  });

  it("sem área informada → kg/ha calculado, total nulo", () => {
    const plano = sugerirFormulacao(base, null);
    expect(plano.principal?.kg_ha).toBe(1500);
    expect(plano.principal?.kg_total).toBeNull();
  });
});

describe("correção do solo: corretivo, gessagem e micros", () => {
  it("Mg baixo → calcário dolomítico; gessagem com Al 20-40 alto vira dose de gesso", () => {
    const rec = recomendarNutrientes5a({
      lavoura: { fase: "producao", produtividade_esperada_sc_ha: 40, Ve_percentual: 60 },
      solo: {
        Ca_cmolc_dm3: 2, Mg_cmolc_dm3: 0.3, // Mg baixo
        Al_cmolc_dm3: 0.2, H_Al_cmolc_dm3: 4, K_mg_dm3: 100,
        P_mg_dm3: 8, P_rem_mg_L: 15,
      },
      sub: { Al_cmolc_dm3: 0.7 }, // dispara gessagem
    });
    expect(rec.correcao_solo.corretivo_sugerido).toBe("Calcário dolomítico");
    expect(rec.correcao_solo.gessagem_indicada).toBe(true);
    // NC>0 → dose de gesso = 0,25 × NC.
    expect(rec.correcao_solo.gesso_t_ha).toBeGreaterThan(0);
    expect(rec.correcao_solo.gesso_s_kg_ha).toBeGreaterThan(0);
  });

  it("micros classificados baixos geram fontes comerciais (produto e via)", () => {
    const rec = recomendarNutrientes5a({
      lavoura: { fase: "producao", produtividade_esperada_sc_ha: 40 },
      solo: {
        K_mg_dm3: 100, P_mg_dm3: 8, P_rem_mg_L: 15,
        B_mg_dm3: 0.2, extrator_B: "mehlich1", // baixo → 3 kg B
        Zn_mg_dm3: 1.5, extrator_Zn: "mehlich1", // baixo → 6 kg Zn
      },
    });
    const b = rec.fontes_micros.find((m) => m.nutriente === "B");
    const zn = rec.fontes_micros.find((m) => m.nutriente === "Zn");
    expect(b?.produto).toMatch(/bórico/i);
    expect(b?.dose_produto_kg_ha).toBeGreaterThan(0); // 3 / 0,17 ≈ 17,6
    expect(zn?.via).toMatch(/foliar|solo/);
  });
});
