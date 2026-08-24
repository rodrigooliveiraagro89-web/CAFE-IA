import { FlaskConical } from "lucide-react";
import { useMemo, useState } from "react";
import {
  recomendarNutrientes5a,
  type ExtratorB,
  type ExtratorMetalico,
  type Fase,
} from "../../domain/coffeeFertility5a";
import { parseNumberBR } from "../../domain/parseNumber";
import type { SoilAnalysis } from "../soil/soilStore";

/**
 * Painel que liga o laudo do talhão ao motor da 5ª Aproximação de MG. Puxa a
 * análise mais recente (Ca/Mg em mmolc → cmolc; K, P, S, micros) e deriva H+Al e
 * Al a partir de CTC/V/m% quando possível. O usuário completa os campos que o
 * laudo não traz (P-rem/argila, extratores) e os parâmetros da lavoura.
 */

type Props = { analysis: SoilAnalysis | null; plotName?: string };

const FASES: { id: Fase; label: string }[] = [
  { id: "producao", label: "Lavoura em produção" },
  { id: "formacao_1_ano", label: "Formação — 1º ano" },
  { id: "formacao_2_ano", label: "Formação — 2º ano" },
  { id: "recepado_1_ano", label: "Recepa — 1º ano" },
  { id: "esqueletado_1_ano", label: "Esqueletamento — 1º ano" },
  { id: "implantacao", label: "Implantação" },
  { id: "pos_plantio", label: "Pós-plantio" },
];

const CLASSE_LABEL: Record<string, string> = {
  muito_baixo: "Muito baixo",
  baixo: "Baixo",
  medio: "Médio",
  bom: "Bom",
  muito_bom: "Muito bom",
  adequado: "Adequado",
  alto: "Alto",
};

function fmt(value: number | null, digits = 1): string {
  if (value === null) return "—";
  return value.toLocaleString("pt-BR", { maximumFractionDigits: digits });
}

function str(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "";
  return (Math.round(value * 10 ** digits) / 10 ** digits).toString();
}

export function Fertility5aPanel({ analysis, plotName }: Props) {
  const v = analysis?.values;

  // Pré-preenche a partir do laudo (Ca/Mg mmolc → cmolc; deriva H+Al e Al).
  const prefill = useMemo(() => {
    const caC = v?.ca != null ? v.ca / 10 : null;
    const mgC = v?.mg != null ? v.mg / 10 : null;
    const kC = v?.k != null ? v.k / 391 : null;
    const sb = caC != null && mgC != null && kC != null ? caC + mgC + kC : null;
    const hAl = sb != null && v?.ctc != null ? Math.max(0, v.ctc - sb) : null;
    const mPct = v?.mPercent ?? null;
    const al = sb != null && mPct != null && mPct < 100 ? (mPct * sb) / (100 - mPct) : null;
    return {
      ca: str(caC),
      mg: str(mgC),
      k: str(v?.k ?? null, 0),
      p: str(v?.p ?? null),
      s: str(v?.s ?? null),
      hAl: str(hAl),
      al: str(al),
      ph: str(v?.ph ?? null),
      mo: str(v?.organicMatter ?? null),
      b: str(v?.b ?? null),
      cu: str(v?.cu ?? null),
      mn: str(v?.mn ?? null),
      zn: str(v?.zn ?? null),
    };
  }, [v]);

  const [fase, setFase] = useState<Fase>("producao");
  const [prod, setProd] = useState("");
  const [prodAnt, setProdAnt] = useState("");
  const [prnt, setPrnt] = useState("95");
  const [prem, setPrem] = useState("");
  const [argila, setArgila] = useState("");
  const [nFoliar, setNFoliar] = useState("");
  const [extB, setExtB] = useState<ExtratorB | "">("");
  const [extMetal, setExtMetal] = useState<ExtratorMetalico | "">("");
  // Campos numéricos editáveis (default = prefill).
  const [ca, setCa] = useState<string | null>(null);
  const [mg, setMg] = useState<string | null>(null);
  const [al, setAl] = useState<string | null>(null);
  const [hAl, setHAl] = useState<string | null>(null);

  const rec = useMemo(() => {
    return recomendarNutrientes5a({
      lavoura: {
        fase,
        produtividade_esperada_sc_ha: parseNumberBR(prod),
        produtividade_safra_anterior_sc_ha: parseNumberBR(prodAnt),
        PRNT_percentual: parseNumberBR(prnt),
      },
      solo: {
        pH_agua: parseNumberBR(prefill.ph),
        materia_organica_dag_kg: parseNumberBR(prefill.mo),
        P_mg_dm3: parseNumberBR(prefill.p),
        P_rem_mg_L: parseNumberBR(prem),
        argila_percentual: parseNumberBR(argila),
        K_mg_dm3: parseNumberBR(prefill.k),
        Ca_cmolc_dm3: parseNumberBR(ca ?? prefill.ca),
        Mg_cmolc_dm3: parseNumberBR(mg ?? prefill.mg),
        Al_cmolc_dm3: parseNumberBR(al ?? prefill.al),
        H_Al_cmolc_dm3: parseNumberBR(hAl ?? prefill.hAl),
        S_mg_dm3: parseNumberBR(prefill.s),
        B_mg_dm3: parseNumberBR(prefill.b),
        extrator_B: extB || null,
        Cu_mg_dm3: parseNumberBR(prefill.cu),
        extrator_Cu: extMetal || null,
        Mn_mg_dm3: parseNumberBR(prefill.mn),
        extrator_Mn: extMetal || null,
        Zn_mg_dm3: parseNumberBR(prefill.zn),
        extrator_Zn: extMetal || null,
      },
      foliar: { N_dag_kg: parseNumberBR(nFoliar) },
    });
  }, [fase, prod, prodAnt, prnt, prem, argila, nFoliar, extB, extMetal, ca, mg, al, hAl, prefill]);

  if (!analysis) {
    return (
      <section className="panel-card fert5a">
        <div className="panel-title">
          <FlaskConical size={20} />
          <div>
            <span className="eyebrow">5ª Aproximação — MG (Emater)</span>
            <h2>Recomendação de nutrientes</h2>
          </div>
        </div>
        <p className="fert5a-hint">
          Envie uma análise de solo do talhão {plotName ? `(${plotName})` : ""} para calcular pela
          5ª Aproximação. Depois é só completar P-rem/argila, os extratores dos micros e a
          produtividade.
        </p>
      </section>
    );
  }

  const c = rec.classificacoes;
  const n = rec.necessidade_nutrientes;

  return (
    <section className="panel-card fert5a">
      <div className="panel-title">
        <FlaskConical size={20} />
        <div>
          <span className="eyebrow">5ª Aproximação — MG (Emater)</span>
          <h2>Recomendação de nutrientes {plotName ? `· ${plotName}` : ""}</h2>
        </div>
      </div>

      <div className="fert5a-form">
        <label>
          Fase
          <select value={fase} onChange={(e) => setFase(e.target.value as Fase)}>
            {FASES.map((f) => (
              <option key={f.id} value={f.id}>{f.label}</option>
            ))}
          </select>
        </label>
        <label>
          Produtividade esperada (sc/ha)
          <input inputMode="decimal" value={prod} onChange={(e) => setProd(e.target.value)} placeholder="ex.: 40" />
        </label>
        <label>
          Safra anterior (sc/ha)
          <input inputMode="decimal" value={prodAnt} onChange={(e) => setProdAnt(e.target.value)} placeholder="bienalidade" />
        </label>
        <label>
          PRNT do calcário (%)
          <input inputMode="decimal" value={prnt} onChange={(e) => setPrnt(e.target.value)} />
        </label>
        <label>
          P-rem (mg/L)
          <input inputMode="decimal" value={prem} onChange={(e) => setPrem(e.target.value)} placeholder="do laudo" />
        </label>
        <label>
          Argila (%) <span className="fert5a-opt">(se não tiver P-rem)</span>
          <input inputMode="decimal" value={argila} onChange={(e) => setArgila(e.target.value)} />
        </label>
        <label>
          N foliar (dag/kg) <span className="fert5a-opt">(opcional)</span>
          <input inputMode="decimal" value={nFoliar} onChange={(e) => setNFoliar(e.target.value)} />
        </label>
        <label>
          Extrator do Boro
          <select value={extB} onChange={(e) => setExtB(e.target.value as ExtratorB | "")}>
            <option value="">—</option>
            <option value="mehlich1">Mehlich-1</option>
            <option value="hcl">HCl 0,05</option>
            <option value="agua_quente">Água quente</option>
          </select>
        </label>
        <label>
          Extrator de Cu/Mn/Zn
          <select value={extMetal} onChange={(e) => setExtMetal(e.target.value as ExtratorMetalico | "")}>
            <option value="">—</option>
            <option value="mehlich1">Mehlich-1</option>
            <option value="dtpa">DTPA</option>
          </select>
        </label>
        <label>
          Ca (cmolc/dm³)
          <input inputMode="decimal" value={ca ?? prefill.ca} onChange={(e) => setCa(e.target.value)} />
        </label>
        <label>
          Mg (cmolc/dm³)
          <input inputMode="decimal" value={mg ?? prefill.mg} onChange={(e) => setMg(e.target.value)} />
        </label>
        <label>
          Al (cmolc/dm³)
          <input inputMode="decimal" value={al ?? prefill.al} onChange={(e) => setAl(e.target.value)} />
        </label>
        <label>
          H+Al (cmolc/dm³)
          <input inputMode="decimal" value={hAl ?? prefill.hAl} onChange={(e) => setHAl(e.target.value)} />
        </label>
      </div>

      <div className="fert5a-indices">
        <span><small>V</small><strong>{fmt(rec.indices.V_percentual)}%</strong></span>
        <span><small>m</small><strong>{fmt(rec.indices.m_percentual)}%</strong></span>
        <span><small>CTC (T)</small><strong>{fmt(rec.indices.T, 2)}</strong></span>
        <span><small>SB</small><strong>{fmt(rec.indices.SB, 2)}</strong></span>
      </div>

      <div className="fert5a-results">
        <div className="fert5a-doses">
          <h3>Necessidade de nutrientes</h3>
          <table>
            <tbody>
              <tr><td>N</td><td>{fmt(n.N_kg_ha_ano)} kg/ha·ano</td></tr>
              <tr><td>P₂O₅</td><td>{fmt(n.P2O5_kg_ha_ano)} kg/ha·ano <em>({CLASSE_LABEL[c.P ?? ""] ?? "—"})</em></td></tr>
              <tr><td>K₂O</td><td>{fmt(n.K2O_kg_ha_ano)} kg/ha·ano</td></tr>
              <tr><td>S</td><td>{fmt(n.S_kg_ha_ano)} kg/ha·ano <em>({CLASSE_LABEL[c.S ?? ""] ?? "—"})</em></td></tr>
              <tr><td>B</td><td>{fmt(n.B_kg_ha)} kg/ha <em>({CLASSE_LABEL[c.B ?? ""] ?? "—"})</em></td></tr>
              <tr><td>Cu</td><td>{fmt(n.Cu_kg_ha)} kg/ha <em>({CLASSE_LABEL[c.Cu ?? ""] ?? "—"})</em></td></tr>
              <tr><td>Mn</td><td>{fmt(n.Mn_kg_ha)} kg/ha <em>({CLASSE_LABEL[c.Mn ?? ""] ?? "—"})</em></td></tr>
              <tr><td>Zn</td><td>{fmt(n.Zn_kg_ha)} kg/ha <em>({CLASSE_LABEL[c.Zn ?? ""] ?? "—"})</em></td></tr>
            </tbody>
          </table>
        </div>
        <div className="fert5a-correcao">
          <h3>Correção do solo</h3>
          <p>
            <strong>Calagem:</strong>{" "}
            {rec.correcao_solo.calagem_t_ha_produto !== null
              ? `${fmt(rec.correcao_solo.calagem_t_ha_produto, 2)} t/ha (produto) · ${fmt(rec.correcao_solo.calagem_t_ha_prnt100, 2)} t/ha PRNT 100%`
              : "informe Ca, Mg, Al e H+Al"}
          </p>
          <p>
            <strong>Gessagem:</strong>{" "}
            {rec.correcao_solo.gessagem_indicada
              ? "indicada (avaliar 20–40 cm)"
              : "não indicada pelos dados atuais"}
          </p>
        </div>
      </div>

      {rec.alertas.length > 0 && (
        <div className="fert5a-alertas">
          <strong>Observações e travas de segurança</strong>
          <ul>
            {rec.alertas.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </div>
      )}
      <p className="fert5a-fonte">
        Fonte: 5ª Aproximação de Minas Gerais + Manual do Café (Emater-MG). Saída em nutriente; a
        conversão para fertilizante e a decisão final são do responsável técnico.
      </p>
    </section>
  );
}
