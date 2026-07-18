import type { LucideIcon } from "lucide-react";

type MetricCardProps = {
  label: string;
  value: string;
  detail: string;
  icon: LucideIcon;
  tone?: "neutral" | "success" | "warning" | "danger";
};

export function MetricCard({ label, value, detail, icon: Icon, tone = "neutral" }: MetricCardProps) {
  return (
    <article className="metric-card" data-tone={tone}>
      <span className="metric-icon"><Icon size={19} aria-hidden="true" /></span>
      <span className="metric-copy">
        <small>{label}</small>
        <strong>{value}</strong>
        <span>{detail}</span>
      </span>
    </article>
  );
}
