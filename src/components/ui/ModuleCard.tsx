import { ArrowUpRight } from "lucide-react";
import type { AgrynModule } from "../../features/dashboard/moduleCatalog";

type ModuleCardProps = {
  module: AgrynModule;
  compact?: boolean;
};

export function ModuleCard({ module, compact = false }: ModuleCardProps) {
  const Icon = module.icon;

  return (
    <a
      className="module-card"
      data-accent={module.accent}
      data-compact={compact}
      href={module.href}
      aria-label={`${module.label}: ${module.description}`}
    >
      <span className="module-icon">
        <Icon size={compact ? 21 : 23} strokeWidth={1.8} aria-hidden="true" />
      </span>
      <span className="module-copy">
        <span className="module-title-line">
          <strong>{module.label}</strong>
          {module.badge && <small className="module-badge">{module.badge}</small>}
        </span>
        <small>{module.description}</small>
      </span>
      <ArrowUpRight className="module-arrow" size={17} aria-hidden="true" />
    </a>
  );
}
