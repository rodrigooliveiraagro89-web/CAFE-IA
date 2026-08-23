import type { LucideIcon } from "lucide-react";
import {
  Bot,
  FileText,
  FlaskConical,
  House,
  LayoutGrid,
  Mountain,
  Satellite,
} from "lucide-react";

export type AppView =
  | "inicio"
  | "linha-do-tempo"
  | "carteira"
  | "propriedades"
  | "mapeamento"
  | "modulos"
  | "ndvi"
  | "analise-solo"
  | "adubacao"
  | "assistente"
  | "diagnostico"
  | "clima"
  | "calculadoras"
  | "caderno"
  | "custos"
  | "relatorios"
  | "privacidade"
  | "seguranca";

export type NavigationItem = {
  id: AppView;
  label: string;
  description: string;
  icon: LucideIcon;
};

// Sidebar enxuta e café-first: só o que o cafeicultor toca no dia a dia. Todo
// o resto (mapeamento, diagnóstico, clima, calculadoras, caderno, custos,
// linha do tempo, propriedades, carteira, governança) fica a um toque em
// "Mais ferramentas" (view "modulos"), sem poluir a navegação principal.
export const navigationItems: NavigationItem[] = [
  { id: "inicio", label: "Início", description: "Visão geral e alertas", icon: House },
  {
    id: "analise-solo",
    label: "Análise de solo",
    description: "Laudo por IA e interpretação",
    icon: FlaskConical,
  },
  {
    id: "adubacao",
    label: "Calagem e adubação",
    description: "Doses pelo Boletim 100",
    icon: Mountain,
  },
  { id: "ndvi", label: "Monitoramento NDVI", description: "Satélite e vigor vegetal", icon: Satellite },
  {
    id: "assistente",
    label: "AGRYN IA",
    description: "Assistente agronômico por IA",
    icon: Bot,
  },
  {
    id: "relatorios",
    label: "Relatórios",
    description: "Documento técnico por propriedade",
    icon: FileText,
  },
  { id: "modulos", label: "Mais ferramentas", description: "Todas as ferramentas AGRYN", icon: LayoutGrid },
];
