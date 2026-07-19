import {
  ArrowRight,
  Briefcase,
  Building2,
  CircleDollarSign,
  ClipboardCheck,
  LandPlot,
  MapPinned,
  Satellite,
} from "lucide-react";
import type { AppView } from "../../app/navigation";
import { MetricCard } from "../../components/ui/MetricCard";
import { propertyLocation } from "../../domain/agriculturalContext";
import type { FieldRecord } from "../../domain/fieldRecords";
import type { AgriculturalController } from "../../lib/useAgriculturalContext";

type PortfolioPanelProps = {
  agriculture: AgriculturalController;
  records: FieldRecord[];
  onNavigate: (view: AppView) => void;
};

export function PortfolioPanel({ agriculture, records, onNavigate }: PortfolioPanelProps) {
  const { state } = agriculture;
  const totalArea = state.plots.reduce((sum, plot) => sum + plot.areaHectares, 0);
  const openActivities = records.filter((record) => record.status === "planejada").length;
  const totalCosts = records.reduce(
    (sum, record) => (Number.isFinite(record.cost) ? sum + record.cost : sum),
    0,
  );

  function goTo(propertyId: string, view: AppView) {
    agriculture.selectProperty(propertyId);
    onNavigate(view);
  }

  return (
    <div className="page-stack platform-page">
      <header className="page-header context-page-header">
        <div>
          <span className="eyebrow">Visão do consultor</span>
          <h1>Carteira de propriedades</h1>
          <p>
            Todas as áreas que você acompanha num só lugar — selecione uma propriedade para
            trabalhar nela em qualquer módulo.
          </p>
        </div>
      </header>

      {state.properties.length === 0 ? (
        <section className="empty-state context-empty">
          <Briefcase size={31} />
          <h2>Sua carteira está vazia</h2>
          <p>Cadastre a primeira propriedade para começar o acompanhamento.</p>
          <button className="primary-button" type="button" onClick={() => onNavigate("propriedades")}>
            Cadastrar propriedade
          </button>
        </section>
      ) : (
        <>
          <div className="metrics-grid">
            <MetricCard
              label="Propriedades"
              value={String(state.properties.length)}
              detail="Na sua carteira"
              icon={Building2}
            />
            <MetricCard
              label="Talhões"
              value={String(state.plots.length)}
              detail={`${totalArea.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} ha no total`}
              icon={LandPlot}
            />
            <MetricCard
              label="Atividades abertas"
              value={String(openActivities)}
              detail="Em todas as propriedades"
              icon={ClipboardCheck}
            />
            <MetricCard
              label="Custos registrados"
              value={
                totalCosts > 0
                  ? totalCosts.toLocaleString("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                      maximumFractionDigits: 0,
                    })
                  : "—"
              }
              detail="Soma da carteira"
              icon={CircleDollarSign}
            />
          </div>

          <section aria-labelledby="portfolio-list-title">
            <div className="section-heading compact-heading">
              <div>
                <span className="eyebrow">Acompanhamento</span>
                <h2 id="portfolio-list-title">Propriedades da carteira</h2>
              </div>
            </div>
            <div className="portfolio-grid">
              {state.properties.map((property) => {
                const plots = state.plots.filter((plot) => plot.propertyId === property.id);
                const area = plots.reduce((sum, plot) => sum + plot.areaHectares, 0);
                const withBoundary = plots.filter((plot) => plot.geometry).length;
                const propertyRecords = records.filter(
                  (record) => record.propertyId === property.id,
                );
                const open = propertyRecords.filter(
                  (record) => record.status === "planejada",
                ).length;
                const active = property.id === agriculture.selectedProperty?.id;
                return (
                  <article className="portfolio-card" data-active={active} key={property.id}>
                    <div className="portfolio-card-head">
                      <span className="selection-icon"><Building2 size={20} aria-hidden="true" /></span>
                      <div>
                        <strong>{property.name}</strong>
                        <small>{property.producer} · {propertyLocation(property)}</small>
                      </div>
                    </div>
                    <dl className="portfolio-stats">
                      <div>
                        <dt>Talhões</dt>
                        <dd>{plots.length}</dd>
                      </div>
                      <div>
                        <dt>Área</dt>
                        <dd>{area.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} ha</dd>
                      </div>
                      <div>
                        <dt>Atividades abertas</dt>
                        <dd>{open}</dd>
                      </div>
                      <div>
                        <dt>Limite geográfico</dt>
                        <dd>
                          {plots.length === 0 ? "—" : `${withBoundary}/${plots.length}`}
                          {withBoundary > 0 && <MapPinned size={13} aria-hidden="true" />}
                        </dd>
                      </div>
                    </dl>
                    <div className="portfolio-actions">
                      <button type="button" onClick={() => goTo(property.id, "propriedades")}>
                        <LandPlot size={15} aria-hidden="true" /> Áreas
                      </button>
                      <button type="button" onClick={() => goTo(property.id, "ndvi")}>
                        <Satellite size={15} aria-hidden="true" /> NDVI
                      </button>
                      <button type="button" onClick={() => goTo(property.id, "caderno")}>
                        <ClipboardCheck size={15} aria-hidden="true" /> Caderno
                      </button>
                      <button
                        className="portfolio-open"
                        type="button"
                        onClick={() => goTo(property.id, "inicio")}
                        aria-label={`Abrir painel de ${property.name}`}
                      >
                        Abrir <ArrowRight size={15} aria-hidden="true" />
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
