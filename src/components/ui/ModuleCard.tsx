import { ArrowUpRight, ExternalLink } from "lucide-react";
import type { AgrynModule } from "../../features/dashboard/moduleCatalog";

type ModuleCardProps = {
  module: AgrynModule;
  compact?: boolean;
};

// Cards que ainda apontam para o app clássico (agryn.html / cafe-real-ia.html):
// abrem em nova aba para não derrubar a sessão do app React e recebem o selo
// "Clássico" para o usuário saber que está saindo para a ferramenta antiga.
const LEGACY_HREF = /(?:agryn|cafe-real-ia)\.html/;

export function ModuleCard({ module, compact = false }: ModuleCardProps) {
  const Icon = module.icon;
  const isLegacy = LEGACY_HREF.test(module.href);
  const Arrow = isLegacy ? ExternalLink : ArrowUpRight;

  return (
    <a
      className="module-card"
      data-accent={module.accent}
      data-compact={compact}
      data-legacy={isLegacy || undefined}
      href={module.href}
      target={isLegacy ? "_blank" : undefined}
      rel={isLegacy ? "noopener noreferrer" : undefined}
      aria-label={
        isLegacy
          ? `${module.label}: ${module.description} (ferramenta clássica, abre em nova aba)`
          : `${module.label}: ${module.description}`
      }
    >
      <span className="module-icon">
        <Icon size={compact ? 21 : 23} strokeWidth={1.8} aria-hidden="true" />
      </span>
      <span className="module-copy">
        <span className="module-title-line">
          <strong>{module.label}</strong>
          {module.badge && <small className="module-badge">{module.badge}</small>}
          {isLegacy && <small className="module-badge module-badge-legacy">Clássico</small>}
        </span>
        <small>{module.description}</small>
      </span>
      <Arrow className="module-arrow" size={17} aria-hidden="true" />
    </a>
  );
}
