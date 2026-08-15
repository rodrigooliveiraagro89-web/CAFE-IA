import {
  Building2,
  Check,
  Crown,
  Eye,
  FileUp,
  LandPlot,
  MapPinned,
  Plus,
  Share2,
  Trash2,
  UserPlus,
  Wheat,
} from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import {
  cropOptions,
  isSharedProperty,
  parsePlotBoundary,
  phenologicalStages,
  propertyLocation,
  recentSeasons,
  type PlotInput,
  type PropertyInput,
} from "../../domain/agriculturalContext";
import { canAddPlot, canAddProperty, resolvePlan, TRIAL_DAYS } from "../../domain/plans";
import type { AgriculturalController } from "../../lib/useAgriculturalContext";
import {
  inviteCollaborator,
  inviteMessage,
  listCollaborators,
  revokeCollaborator,
  type Collaborator,
} from "./collaboratorsClient";

type PropertyManagerProps = {
  agriculture: AgriculturalController;
  planId?: string | null;
  trialAvailable?: boolean;
  onStartTrial?: () => void;
  onSubscribe?: () => void;
  userId?: string | null;
};

function UpgradeNotice({
  message,
  trialAvailable,
  onStartTrial,
  onSubscribe,
}: {
  message: string;
  trialAvailable?: boolean;
  onStartTrial?: () => void;
  onSubscribe?: () => void;
}) {
  return (
    <div className="upgrade-notice" role="status">
      <Crown size={20} aria-hidden="true" />
      <div>
        <strong>Limite do plano Grátis atingido</strong>
        <p>{message}</p>
      </div>
      {trialAvailable && onStartTrial && (
        <button className="primary-button" type="button" onClick={onStartTrial}>
          Testar o Pro grátis por {TRIAL_DAYS} dias
        </button>
      )}
      <button className="primary-button" type="button" onClick={onSubscribe} disabled={!onSubscribe}>
        Assinar o Pro — R$ 49,90/mês
      </button>
      <a
        className="secondary-button"
        href="./landing.html#planos"
        target="_blank"
        rel="noreferrer"
      >
        Ver planos
      </a>
    </div>
  );
}

const blankProperty: PropertyInput = {
  name: "",
  producer: "",
  responsible: "",
  city: "",
  state: "",
};

const blankPlot: PlotInput = {
  name: "",
  crop: "Café arábica",
  variety: "",
  season: "",
  plantingDate: "",
  phenologicalStage: "",
  rowSpacing: "",
  plantSpacing: "",
  population: "",
  areaHectares: 0,
  geometry: null,
};

function SharePanel({ propertyId, propertyName }: { propertyId: string; propertyName: string }) {
  const [colabs, setColabs] = useState<Collaborator[]>([]);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [convite, setConvite] = useState<{ email: string; texto: string; whatsapp: string } | null>(null);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    let active = true;
    void listCollaborators(propertyId).then((list) => {
      if (active) setColabs(list);
    });
    return () => {
      active = false;
    };
  }, [propertyId]);

  async function convidar(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMsg(null);
    const result = await inviteCollaborator(propertyId, email);
    if (result.ok) {
      setColabs((prev) => [...prev, result.collaborator]);
      const message = inviteMessage(propertyName, result.collaborator.invitedEmail);
      setConvite({ email: result.collaborator.invitedEmail, texto: message.texto, whatsapp: message.whatsapp });
      setCopiado(false);
      setEmail("");
      setMsg(null);
    } else {
      setMsg({ ok: false, text: result.reason });
    }
    setBusy(false);
  }

  async function revogar(id: string) {
    if (await revokeCollaborator(id)) setColabs((prev) => prev.filter((item) => item.id !== id));
  }

  return (
    <section className="panel-card share-panel">
      <div className="section-heading compact-heading">
        <div>
          <span className="eyebrow"><Share2 size={13} /> Colaboração</span>
          <h2>Compartilhar {propertyName}</h2>
          <p>Convide o produtor ou o técnico por e-mail para acompanhar esta propriedade em leitura.</p>
        </div>
      </div>
      <form className="share-invite" onSubmit={(event) => void convidar(event)}>
        <input
          type="email"
          placeholder="email@exemplo.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          aria-label="E-mail do convidado"
          required
        />
        <button className="primary-button" type="submit" disabled={busy}>
          <UserPlus size={16} /> {busy ? "Convidando…" : "Convidar"}
        </button>
      </form>
      {msg && <p className={msg.ok ? "share-ok" : "share-erro"}>{msg.text}</p>}
      {convite && (
        <div className="share-invite-ready">
          <p className="share-ok">
            ✓ Acesso liberado para <strong>{convite.email}</strong>. Envie o convite para a pessoa
            entrar (com esse e-mail):
          </p>
          <textarea readOnly rows={3} value={convite.texto} aria-label="Mensagem do convite" />
          <div className="share-invite-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={() => {
                void navigator.clipboard?.writeText(convite.texto).then(() => setCopiado(true));
              }}
            >
              {copiado ? <Check size={16} /> : null} {copiado ? "Copiado" : "Copiar mensagem"}
            </button>
            <a className="secondary-button" href={convite.whatsapp} target="_blank" rel="noopener noreferrer">
              <Share2 size={16} /> Enviar por WhatsApp
            </a>
          </div>
        </div>
      )}
      {colabs.length > 0 && (
        <ul className="share-list">
          {colabs.map((item) => (
            <li key={item.id}>
              <span><Eye size={13} aria-hidden="true" /> {item.invitedEmail}</span>
              <button type="button" className="text-button" onClick={() => void revogar(item.id)}>
                Remover acesso
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="share-note">
        Quem você convidar vê talhões, laudos, NDVI e recomendações — sem poder editar. Você pode
        remover o acesso quando quiser.
      </p>
    </section>
  );
}

export function PropertyManager({
  agriculture,
  planId = null,
  trialAvailable = false,
  onStartTrial,
  onSubscribe,
  userId = null,
}: PropertyManagerProps) {
  const { state, selectedProperty, selectedPlot } = agriculture;
  const selectedShared = selectedProperty ? isSharedProperty(selectedProperty, userId) : false;
  const [propertyDraft, setPropertyDraft] = useState(blankProperty);
  const [plotDraft, setPlotDraft] = useState(blankPlot);
  const [propertyFormOpen, setPropertyFormOpen] = useState(state.properties.length === 0);
  const [plotFormOpen, setPlotFormOpen] = useState(false);
  const [boundaryMessage, setBoundaryMessage] = useState("");

  const propertyPlots = selectedProperty
    ? state.plots.filter((plot) => plot.propertyId === selectedProperty.id)
    : [];

  const plan = resolvePlan(planId);
  const propertyAllowed = canAddProperty(plan, state.properties.length);
  const plotAllowed = canAddPlot(plan, propertyPlots.length);

  function submitProperty(event: FormEvent) {
    event.preventDefault();
    if (!propertyAllowed) return;
    agriculture.addProperty(propertyDraft);
    setPropertyDraft(blankProperty);
    setPropertyFormOpen(false);
    setPlotFormOpen(true);
  }

  function submitPlot(event: FormEvent) {
    event.preventDefault();
    if (!selectedProperty || !plotAllowed) return;
    agriculture.addPlot(selectedProperty.id, plotDraft);
    setPlotDraft(blankPlot);
    setBoundaryMessage("");
    setPlotFormOpen(false);
  }

  async function importBoundary(file: File | undefined) {
    if (!file) return;
    try {
      const result = parsePlotBoundary(file.name, await file.text());
      setPlotDraft((current) => ({
        ...current,
        geometry: result.geometry,
        areaHectares: Number(result.areaHectares.toFixed(2)),
      }));
      setBoundaryMessage(
        `Limite importado: ${result.areaHectares.toLocaleString("pt-BR", {
          maximumFractionDigits: 2,
        })} ha calculados.`,
      );
    } catch (error) {
      setBoundaryMessage(error instanceof Error ? error.message : "Não foi possível ler o limite.");
    }
  }

  return (
    <div className="page-stack platform-page">
      <header className="page-header context-page-header">
        <div>
          <span className="eyebrow">Estrutura da operação</span>
          <h1>Propriedades e talhões</h1>
          <p>
            Organize a produção por propriedade, área, cultura e safra. O contexto selecionado
            acompanha análises, mapas, atividades e custos.
          </p>
        </div>
        {propertyAllowed && (
          <button className="primary-button" type="button" onClick={() => setPropertyFormOpen(true)}>
            <Plus size={18} /> Nova propriedade
          </button>
        )}
      </header>

      {!propertyAllowed && (
        <UpgradeNotice
          message={`O plano ${plan.label} permite ${plan.maxProperties} propriedade. Para gerenciar mais propriedades — ideal para consultores com carteira de clientes — assine o Pro.`}
          trialAvailable={trialAvailable}
          onStartTrial={onStartTrial}
          onSubscribe={onSubscribe}
        />
      )}

      {propertyFormOpen && propertyAllowed && (
        <form className="data-form panel-card" onSubmit={submitProperty}>
          <div className="panel-title">
            <Building2 size={21} />
            <div><span className="eyebrow">Cadastro</span><h2>Identificação da propriedade</h2></div>
          </div>
          <div className="form-grid">
            <label>
              Nome da propriedade
              <input
                required
                value={propertyDraft.name}
                onChange={(event) =>
                  setPropertyDraft((current) => ({ ...current, name: event.target.value }))
                }
                placeholder="Ex.: Fazenda Boa Esperança"
              />
            </label>
            <label>
              Produtor ou empresa
              <input
                required
                value={propertyDraft.producer}
                onChange={(event) =>
                  setPropertyDraft((current) => ({ ...current, producer: event.target.value }))
                }
              />
            </label>
            <label>
              Responsável técnico
              <input
                value={propertyDraft.responsible}
                onChange={(event) =>
                  setPropertyDraft((current) => ({ ...current, responsible: event.target.value }))
                }
              />
            </label>
            <label>
              Município
              <input
                required
                value={propertyDraft.city}
                onChange={(event) =>
                  setPropertyDraft((current) => ({ ...current, city: event.target.value }))
                }
              />
            </label>
            <label>
              UF
              <input
                required
                maxLength={2}
                value={propertyDraft.state}
                onChange={(event) =>
                  setPropertyDraft((current) => ({
                    ...current,
                    state: event.target.value.toLocaleUpperCase("pt-BR"),
                  }))
                }
                placeholder="MG"
              />
            </label>
          </div>
          <div className="form-actions">
            {state.properties.length > 0 && (
              <button className="secondary-button" type="button" onClick={() => setPropertyFormOpen(false)}>
                Cancelar
              </button>
            )}
            <button className="primary-button" type="submit">Salvar propriedade</button>
          </div>
        </form>
      )}

      {state.properties.length === 0 ? (
        <section className="empty-state context-empty">
          <MapPinned size={31} />
          <h2>Comece pela propriedade</h2>
          <p>Nenhum dado de exemplo foi inserido. Cadastre a operação real para ativar o painel.</p>
        </section>
      ) : (
        <>
          <section aria-labelledby="property-list-title">
            <div className="section-heading compact-heading">
              <div><span className="eyebrow">Contextos</span><h2 id="property-list-title">Propriedades</h2></div>
            </div>
            <div className="selection-grid">
              {state.properties.map((property) => {
                const active = property.id === selectedProperty?.id;
                const count = state.plots.filter((plot) => plot.propertyId === property.id).length;
                const shared = isSharedProperty(property, userId);
                return (
                  <article className="selection-card" data-active={active} key={property.id}>
                    <button className="selection-main" type="button" onClick={() => agriculture.selectProperty(property.id)}>
                      <span className="selection-icon"><Building2 size={21} /></span>
                      <span>
                        <strong>
                          {property.name}
                          {shared && <span className="shared-badge"><Eye size={12} /> compartilhada</span>}
                        </strong>
                        <small>{property.producer} · {propertyLocation(property)}</small>
                        <small>{count} {count === 1 ? "talhão" : "talhões"}</small>
                      </span>
                      {active && <Check size={20} aria-label="Selecionada" />}
                    </button>
                    {!shared && (
                      <button
                        className="danger-icon"
                        type="button"
                        title="Excluir propriedade"
                        onClick={() => {
                          if (window.confirm(`Excluir ${property.name} e seus talhões?`)) {
                            agriculture.removeProperty(property.id);
                          }
                        }}
                      >
                        <Trash2 size={17} />
                      </button>
                    )}
                  </article>
                );
              })}
            </div>
          </section>

          {selectedProperty && !selectedShared && (
            <SharePanel propertyId={selectedProperty.id} propertyName={selectedProperty.name} />
          )}

          {selectedProperty && (
            <section className="panel-card">
              {selectedShared && (
                <div className="shared-readonly" role="status">
                  <Eye size={17} aria-hidden="true" />
                  <span>
                    Propriedade <strong>compartilhada com você</strong> — somente leitura. As
                    alterações são feitas pelo dono.
                  </span>
                </div>
              )}
              <div className="section-heading compact-heading">
                <div>
                  <span className="eyebrow">{selectedProperty.name}</span>
                  <h2>Talhões e culturas</h2>
                  <p>Selecione a área operacional ou cadastre um novo limite.</p>
                </div>
                {plotAllowed && !selectedShared && (
                  <button className="secondary-button" type="button" onClick={() => setPlotFormOpen(true)}>
                    <Plus size={17} /> Novo talhão
                  </button>
                )}
              </div>

              {!plotAllowed && (
                <UpgradeNotice
                  message={`O plano ${plan.label} permite ${plan.maxPlotsPerProperty} talhões por propriedade. Assine o Pro para talhões ilimitados.`}
                  trialAvailable={trialAvailable}
                  onStartTrial={onStartTrial}
                  onSubscribe={onSubscribe}
                />
              )}

              {plotFormOpen && plotAllowed && (
                <form className="data-form inset-form" onSubmit={submitPlot}>
                  <div className="form-grid">
                    <label>
                      Nome do talhão
                      <input required value={plotDraft.name} onChange={(event) => setPlotDraft((current) => ({ ...current, name: event.target.value }))} />
                    </label>
                    <label>
                      Espécie de café
                      <select value={plotDraft.crop} onChange={(event) => setPlotDraft((current) => ({ ...current, crop: event.target.value }))}>
                        {cropOptions.map((crop) => <option key={crop}>{crop}</option>)}
                      </select>
                    </label>
                    <label>
                      Cultivar / variedade
                      <input value={plotDraft.variety} onChange={(event) => setPlotDraft((current) => ({ ...current, variety: event.target.value }))} />
                    </label>
                    <label>
                      Safra
                      <input required list="talhao-safras" value={plotDraft.season} onChange={(event) => setPlotDraft((current) => ({ ...current, season: event.target.value }))} placeholder="Ex.: 2026/27" />
                      <datalist id="talhao-safras">{recentSeasons(new Date().getFullYear()).map((season) => <option key={season} value={season} />)}</datalist>
                    </label>
                    <label>
                      Data de plantio
                      <input type="date" value={plotDraft.plantingDate} onChange={(event) => setPlotDraft((current) => ({ ...current, plantingDate: event.target.value }))} />
                    </label>
                    <label>
                      Estágio fenológico
                      <input list="talhao-estagios" value={plotDraft.phenologicalStage} onChange={(event) => setPlotDraft((current) => ({ ...current, phenologicalStage: event.target.value }))} />
                      <datalist id="talhao-estagios">{phenologicalStages.map((stage) => <option key={stage} value={stage} />)}</datalist>
                    </label>
                    <label>
                      Área (ha)
                      <input required min="0.01" step="0.01" type="number" inputMode="decimal" value={plotDraft.areaHectares || ""} onChange={(event) => setPlotDraft((current) => ({ ...current, areaHectares: Number(event.target.value) }))} />
                    </label>
                    <label>
                      Espaçamento entre linhas
                      <input value={plotDraft.rowSpacing} onChange={(event) => setPlotDraft((current) => ({ ...current, rowSpacing: event.target.value }))} placeholder="Ex.: 3,5 m" />
                    </label>
                    <label>
                      Espaçamento entre plantas
                      <input value={plotDraft.plantSpacing} onChange={(event) => setPlotDraft((current) => ({ ...current, plantSpacing: event.target.value }))} placeholder="Ex.: 0,7 m" />
                    </label>
                    <label>
                      População de plantas
                      <input value={plotDraft.population} onChange={(event) => setPlotDraft((current) => ({ ...current, population: event.target.value }))} placeholder="Plantas/ha" />
                    </label>
                  </div>
                  <label className="boundary-upload">
                    <FileUp size={20} />
                    <span><strong>Importar limite do talhão</strong><small>GeoJSON ou KML. A área será recalculada pelo polígono.</small></span>
                    <input
                      type="file"
                      accept=".geojson,.json,.kml,application/geo+json,application/vnd.google-earth.kml+xml"
                      onChange={(event) => void importBoundary(event.target.files?.[0])}
                    />
                  </label>
                  <p className="form-helper" aria-live="polite">
                    {boundaryMessage || "Arquivos Shapefile exigem conversão para GeoJSON nesta versão."}
                  </p>
                  <div className="form-actions">
                    <button className="secondary-button" type="button" onClick={() => setPlotFormOpen(false)}>Cancelar</button>
                    <button className="primary-button" type="submit">Salvar talhão</button>
                  </div>
                </form>
              )}

              {propertyPlots.length === 0 && !plotFormOpen ? (
                <div className="inline-empty">
                  <LandPlot size={24} />
                  <div><strong>Nenhum talhão cadastrado</strong><p>Adicione a primeira área produtiva desta propriedade.</p></div>
                </div>
              ) : (
                <div className="plot-grid">
                  {propertyPlots.map((plot) => (
                    <article className="plot-card" data-active={plot.id === selectedPlot?.id} key={plot.id}>
                      <button type="button" onClick={() => agriculture.selectPlot(plot.id)}>
                        <span className="plot-crop-icon"><Wheat size={21} /></span>
                        <span><small>{plot.crop}</small><strong>{plot.name}</strong></span>
                        <span className="plot-area">{plot.areaHectares.toLocaleString("pt-BR")} ha</span>
                        <span className="plot-meta">{plot.season}{plot.variety ? ` · ${plot.variety}` : ""}</span>
                        {plot.geometry && <span className="geometry-badge"><MapPinned size={13} /> Limite geográfico</span>}
                      </button>
                      {!selectedShared && (
                        <button
                          className="danger-icon"
                          type="button"
                          title="Excluir talhão"
                          onClick={() => {
                            if (window.confirm(`Excluir o talhão ${plot.name}?`)) agriculture.removePlot(plot.id);
                          }}
                        >
                          <Trash2 size={17} />
                        </button>
                      )}
                    </article>
                  ))}
                </div>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}
