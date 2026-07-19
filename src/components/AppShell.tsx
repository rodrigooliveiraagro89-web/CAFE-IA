import {
  Bell,
  Bot,
  ChevronLeft,
  ChevronRight,
  CloudSun,
  FileText,
  FlaskConical,
  House,
  LayoutGrid,
  LogOut,
  Map,
  Moon,
  ScanLine,
  Sprout,
  Sun,
  UserRound,
} from "lucide-react";
import { useState, type PropsWithChildren } from "react";
import { navigationItems, type AppView } from "../app/navigation";
import { propertyLocation, type FarmPlot, type FarmProperty } from "../domain/agriculturalContext";
import type { Profile } from "../lib/useAuth";
import type { ThemePreference } from "../lib/preferences";
import { AgrynBrand } from "./brand/AgrynBrand";

type AppShellProps = PropsWithChildren<{
  activeView: AppView;
  onNavigate: (view: AppView) => void;
  theme: ThemePreference;
  onToggleTheme: () => void;
  selectedProperty: FarmProperty | null;
  selectedPlot: FarmPlot | null;
  profile: Profile | null;
  onSignOut: () => void;
}>;

const tipoLabels: Record<Profile["tipo"], string> = {
  consultor: "Consultor(a)",
  produtor: "Produtor(a)",
};

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

const operationLinks = [
  { label: "Diagnóstico", href: "./agryn.html?tab=foto", icon: ScanLine },
  { label: "Análises", href: "./agryn.html?tab=solo", icon: FlaskConical },
  { label: "Clima", href: "./clima.html", icon: CloudSun },
  { label: "Recomendações", href: "./agryn.html?tab=adubacao", icon: Sprout },
  { label: "Relatórios", href: "./agryn.html?tab=relatorio", icon: FileText },
];

export function AppShell({
  activeView,
  onNavigate,
  theme,
  onToggleTheme,
  selectedProperty,
  selectedPlot,
  profile,
  onSignOut,
  children,
}: AppShellProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const today = new Intl.DateTimeFormat("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  }).format(new Date());
  const displayName = profile?.nome || "Sua conta";
  const displayTipo = profile ? tipoLabels[profile.tipo] : "";
  const initials = initialsFromName(displayName);

  return (
    <div className="app-frame" data-sidebar-collapsed={collapsed}>
      <a className="skip-link" href="#conteudo-principal">Ir para o conteúdo</a>

      <aside className="sidebar" data-collapsed={collapsed} aria-label="Navegação principal">
        <div className="sidebar-header">
          <AgrynBrand compact={collapsed} inverted />
          <button
            className="collapse-button"
            type="button"
            onClick={() => setCollapsed((current) => !current)}
            aria-label={collapsed ? "Expandir barra lateral" : "Recolher barra lateral"}
            title={collapsed ? "Expandir barra lateral" : "Recolher barra lateral"}
          >
            {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
        </div>

        <nav className="side-nav" aria-label="Áreas da plataforma">
          {!collapsed && <span className="nav-section-label">Plataforma</span>}
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const selected = activeView === item.id;
            return (
              <button
                className="side-nav-item"
                data-active={selected}
                key={item.id}
                onClick={() => onNavigate(item.id)}
                aria-current={selected ? "page" : undefined}
                type="button"
                title={collapsed ? item.label : undefined}
              >
                <Icon size={20} aria-hidden="true" />
                {!collapsed && <span><strong>{item.label}</strong><small>{item.description}</small></span>}
              </button>
            );
          })}
        </nav>

        <nav className="side-nav operation-nav" aria-label="Atalhos operacionais">
          {!collapsed && <span className="nav-section-label">Operação</span>}
          {operationLinks.map((item) => {
            const Icon = item.icon;
            return <a className="side-nav-item" href={item.href} key={item.label} title={collapsed ? item.label : undefined}><Icon size={20} aria-hidden="true" />{!collapsed && <strong>{item.label}</strong>}</a>;
          })}
        </nav>

        {!collapsed && (
          <div className="sidebar-insight">
            <span className="insight-orb"><Bot size={20} aria-hidden="true" /></span>
            <div><span className="eyebrow">AGRYN IA</span><strong>Transforme dados em decisões.</strong><a href="./agryn.html?tab=ia">Perguntar agora</a></div>
          </div>
        )}

        <div className="sidebar-footer" data-collapsed={collapsed}>
          <span className="avatar" aria-hidden="true">{initials}</span>
          {!collapsed && <span><strong>{displayName}</strong><small>{displayTipo}</small></span>}
        </div>
      </aside>

      <div className="app-column">
        <header className="topbar">
          <div className="mobile-brand"><AgrynBrand compact /></div>
          <div className="property-context" aria-label="Contexto da propriedade">
            <span className="context-icon"><Sprout size={19} aria-hidden="true" /></span>
            <span>
              <small>{selectedPlot ? `${selectedPlot.crop} · ${selectedPlot.season}` : "Propriedade ativa"}</small>
              <strong>{selectedProperty ? `${selectedProperty.name}${selectedPlot ? ` · ${selectedPlot.name}` : ""}` : "Selecione uma propriedade"}</strong>
              {selectedProperty && !selectedPlot && <small>{propertyLocation(selectedProperty)}</small>}
            </span>
            <button type="button" onClick={() => onNavigate("propriedades")}>{selectedProperty ? "Alterar" : "Selecionar"}</button>
          </div>
          <div className="topbar-actions">
            <span className="today-label">{today}</span>
            <a className="weather-pill" href="./clima.html" aria-label="Abrir previsão do tempo"><CloudSun size={18} aria-hidden="true" /><span><small>Clima</small><strong>Sincronizar</strong></span></a>
            <button className="icon-button" type="button" aria-label="Notificações"><Bell size={19} /></button>
            <button className="icon-button" onClick={onToggleTheme} type="button" aria-label={theme === "dark" ? "Ativar tema claro" : "Ativar tema escuro"}>{theme === "dark" ? <Sun size={19} /> : <Moon size={19} />}</button>
            <div className="profile-menu">
              <button
                type="button"
                className="profile-button"
                onClick={() => setAccountMenuOpen((current) => !current)}
                aria-haspopup="true"
                aria-expanded={accountMenuOpen}
                aria-label={`Abrir menu de conta de ${displayName}`}
              >
                <span className="avatar">{initials}</span>
                <span><strong>{displayName.split(" ")[0]}</strong><small>{displayTipo}</small></span>
                <UserRound size={17} aria-hidden="true" />
              </button>
              {accountMenuOpen && (
                <div className="profile-dropdown" role="menu">
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setAccountMenuOpen(false);
                      onSignOut();
                    }}
                  >
                    <LogOut size={16} aria-hidden="true" /> Sair
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main id="conteudo-principal" tabIndex={-1}>{children}</main>
        <a className="ai-floating-button" href="./agryn.html?tab=ia" aria-label="Perguntar à AGRYN IA"><Bot size={22} aria-hidden="true" /><span>AGRYN IA</span></a>

        <nav className="mobile-nav" aria-label="Navegação móvel">
          <button type="button" onClick={() => onNavigate("inicio")} aria-current={activeView === "inicio" ? "page" : undefined} data-active={activeView === "inicio"}><House size={21} /><span>Início</span></button>
          <button type="button" onClick={() => onNavigate("propriedades")} aria-current={activeView === "propriedades" ? "page" : undefined} data-active={activeView === "propriedades"}><Sprout size={21} /><span>Áreas</span></button>
          <a href="./agryn.html?tab=solo"><FlaskConical size={21} /><span>Análises</span></a>
          <button type="button" onClick={() => onNavigate("ndvi")} aria-current={activeView === "ndvi" ? "page" : undefined} data-active={activeView === "ndvi"}><Map size={21} /><span>Mapas</span></button>
          <button type="button" onClick={() => onNavigate("modulos")} aria-current={activeView === "modulos" ? "page" : undefined} data-active={activeView === "modulos"}><LayoutGrid size={21} /><span>Mais</span></button>
        </nav>
      </div>
    </div>
  );
}
