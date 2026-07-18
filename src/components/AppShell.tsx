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
  Moon,
  ScanLine,
  Sprout,
  Sun,
  UserRound,
} from "lucide-react";
import { useState, type PropsWithChildren } from "react";
import { navigationItems, type AppView } from "../app/navigation";
import type { ThemePreference } from "../lib/preferences";
import { AgrynBrand } from "./brand/AgrynBrand";

type AppShellProps = PropsWithChildren<{
  activeView: AppView;
  onNavigate: (view: AppView) => void;
  theme: ThemePreference;
  onToggleTheme: () => void;
}>;

const operationLinks = [
  { label: "Diagnóstico", href: "./agryn.html?tab=foto", icon: ScanLine },
  { label: "Clima", href: "./clima.html", icon: CloudSun },
  { label: "Relatórios", href: "./agryn.html?tab=relatorio", icon: FileText },
];

export function AppShell({
  activeView,
  onNavigate,
  theme,
  onToggleTheme,
  children,
}: AppShellProps) {
  const [collapsed, setCollapsed] = useState(false);
  const today = new Intl.DateTimeFormat("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  }).format(new Date());

  return (
    <div className="app-frame" data-sidebar-collapsed={collapsed}>
      <a className="skip-link" href="#conteudo-principal">
        Ir para o conteúdo
      </a>

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
                {!collapsed && (
                  <span>
                    <strong>{item.label}</strong>
                    <small>{item.description}</small>
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <nav className="side-nav operation-nav" aria-label="Atalhos operacionais">
          {!collapsed && <span className="nav-section-label">Operação</span>}
          {operationLinks.map((item) => {
            const Icon = item.icon;
            return (
              <a
                className="side-nav-item"
                href={item.href}
                key={item.label}
                title={collapsed ? item.label : undefined}
              >
                <Icon size={20} aria-hidden="true" />
                {!collapsed && <strong>{item.label}</strong>}
              </a>
            );
          })}
        </nav>

        {!collapsed && (
          <div className="sidebar-insight">
            <span className="insight-orb">
              <Bot size={20} aria-hidden="true" />
            </span>
            <div>
              <span className="eyebrow">AGRYN IA</span>
              <strong>Transforme dados em decisões.</strong>
              <a href="./agryn.html?tab=ia">Perguntar agora</a>
            </div>
          </div>
        )}

        <div className="sidebar-footer" data-collapsed={collapsed}>
          <span className="avatar" aria-hidden="true">RO</span>
          {!collapsed && (
            <span>
              <strong>Rodrigo Oliveira</strong>
              <small>Administrador</small>
            </span>
          )}
        </div>
      </aside>

      <div className="app-column">
        <header className="topbar">
          <div className="mobile-brand">
            <AgrynBrand compact />
          </div>

          <div className="property-context" aria-label="Contexto da propriedade">
            <span className="context-icon"><Sprout size={19} aria-hidden="true" /></span>
            <span>
              <small>Propriedade ativa</small>
              <strong>Selecione uma propriedade</strong>
            </span>
            <button type="button" onClick={() => onNavigate("modulos")}>
              Alterar
            </button>
          </div>

          <div className="topbar-actions">
            <span className="today-label">{today}</span>
            <a className="weather-pill" href="./clima.html" aria-label="Abrir previsão do tempo">
              <CloudSun size={18} aria-hidden="true" />
              <span><small>Clima</small><strong>Sincronizar</strong></span>
            </a>
            <button className="icon-button" type="button" aria-label="Notificações">
              <Bell size={19} />
            </button>
            <button
              className="icon-button"
              onClick={onToggleTheme}
              type="button"
              aria-label={theme === "dark" ? "Ativar tema claro" : "Ativar tema escuro"}
            >
              {theme === "dark" ? <Sun size={19} /> : <Moon size={19} />}
            </button>
            <a className="profile-button" href="./agryn.html?open=account" aria-label="Abrir perfil de Rodrigo Oliveira">
              <span className="avatar">RO</span>
              <span><strong>Rodrigo</strong><small>Administrador</small></span>
              <UserRound size={17} aria-hidden="true" />
            </a>
          </div>
        </header>

        <main id="conteudo-principal" tabIndex={-1}>
          {children}
        </main>

        <a className="ai-floating-button" href="./agryn.html?tab=ia" aria-label="Perguntar à AGRYN IA">
          <Bot size={22} aria-hidden="true" />
          <span>AGRYN IA</span>
        </a>

        <nav className="mobile-nav" aria-label="Navegação móvel">
          <button
            type="button"
            onClick={() => onNavigate("inicio")}
            aria-current={activeView === "inicio" ? "page" : undefined}
            data-active={activeView === "inicio"}
          >
            <House size={21} aria-hidden="true" />
            <span>Início</span>
          </button>
          <a href="./agryn.html?tab=foto">
            <ScanLine size={21} aria-hidden="true" />
            <span>Diagnóstico</span>
          </a>
          <a href="./agryn.html?tab=solo">
            <FlaskConical size={21} aria-hidden="true" />
            <span>Análises</span>
          </a>
          <a href="./agryn.html?tab=ia">
            <Bot size={21} aria-hidden="true" />
            <span>AGRYN IA</span>
          </a>
          <button
            type="button"
            onClick={() => onNavigate("modulos")}
            aria-current={activeView === "modulos" ? "page" : undefined}
            data-active={activeView === "modulos"}
          >
            <LayoutGrid size={21} aria-hidden="true" />
            <span>Mais</span>
          </button>
        </nav>
      </div>
    </div>
  );
}
