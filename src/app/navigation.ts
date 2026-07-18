import type { LucideIcon } from "lucide-react";
import { House, LayoutGrid, Satellite, ShieldCheck } from "lucide-react";

export type AppView = "inicio" | "modulos" | "ndvi" | "seguranca";

export type NavigationItem = {
  id: AppView;
  label: string;
  description: string;
  icon: LucideIcon;
};

export const navigationItems: NavigationItem[] = [
  { id: "inicio", label: "Início", description: "Visão geral da operação", icon: House },
  { id: "modulos", label: "Módulos", description: "Todas as ferramentas AGRYN", icon: LayoutGrid },
  { id: "ndvi", label: "NDVI", description: "Monitoramento por satélite", icon: Satellite },
  {
    id: "seguranca",
    label: "Governança",
    description: "Segurança técnica e validações",
    icon: ShieldCheck,
  },
];
