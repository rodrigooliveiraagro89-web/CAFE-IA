import { Search, SlidersHorizontal } from "lucide-react";
import { useMemo, useState } from "react";
import { ModuleCard } from "../../components/ui/ModuleCard";
import { moduleCatalog, type ModuleGroup } from "../dashboard/moduleCatalog";

const groups: Array<"Todos" | ModuleGroup> = ["Todos", "Análises", "Manejo", "Inteligência", "Gestão"];

export function ModuleHub() {
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<(typeof groups)[number]>("Todos");

  const filteredModules = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("pt-BR");
    return moduleCatalog.filter((module) => {
      const matchesGroup = group === "Todos" || module.group === group;
      const matchesQuery =
        normalizedQuery.length === 0 ||
        `${module.label} ${module.description}`.toLocaleLowerCase("pt-BR").includes(normalizedQuery);
      return matchesGroup && matchesQuery;
    });
  }, [group, query]);

  return (
    <div className="page-stack module-hub">
      <header className="page-header">
        <span className="eyebrow">Central de recursos</span>
        <h1>Todos os módulos AGRYN</h1>
        <p>
          Acesse análises, manejo, inteligência e gestão em uma única central. Cada módulo abre a
          funcionalidade real já disponível na plataforma.
        </p>
      </header>

      <section className="module-toolbar" aria-label="Filtros de módulos">
        <label className="module-search">
          <Search size={18} aria-hidden="true" />
          <span className="sr-only">Buscar módulo</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar módulo..."
            type="search"
          />
        </label>
        <div className="module-filters" aria-label="Filtrar por categoria">
          <SlidersHorizontal size={17} aria-hidden="true" />
          {groups.map((item) => (
            <button
              key={item}
              type="button"
              data-active={group === item}
              aria-pressed={group === item}
              onClick={() => setGroup(item)}
            >
              {item}
            </button>
          ))}
        </div>
      </section>

      {filteredModules.length > 0 ? (
        <section className="module-grid module-grid-all" aria-label="Módulos AGRYN">
          {filteredModules.map((module) => (
            <ModuleCard key={module.id} module={module} />
          ))}
        </section>
      ) : (
        <section className="empty-state" aria-live="polite">
          <Search size={24} aria-hidden="true" />
          <h2>Nenhum módulo encontrado</h2>
          <p>Tente outro termo ou selecione uma categoria diferente.</p>
          <button type="button" onClick={() => { setQuery(""); setGroup("Todos"); }}>
            Limpar filtros
          </button>
        </section>
      )}
    </div>
  );
}
