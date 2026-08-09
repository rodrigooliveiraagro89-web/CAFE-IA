import type { LucideIcon } from "lucide-react";
import {
  BookOpenCheck,
  Briefcase,
  FileText,
  FlaskConical,
  History,
  House,
  LandPlot,
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
  | "mercado"
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

// Sidebar enxuta: só o essencial do dia a dia. Todo o resto (mapeamento,
// adubação, IA, diagnóstico, clima, mercado, calculadoras, custos, governança)
// fica a um toque em "Módulos", sem poluir a navegação principal.
export const navigationItems: NavigationItem[] = [
  { id: "inicio", label: "Início", description: "Visão geral e alertas", icon: House },
  {
    id: "linha-do-tempo",
    label: "Linha do tempo",
    description: "A história do talhão num fio só",
    icon: History,
  },
  {
    id: "carteira",
    label: "Carteira",
    description: "Todas as propriedades num só lugar",
    icon: Briefcase,
  },
  {
    id: "propriedades",
    label: "Propriedades e talhões",
    description: "Culturas, safras e áreas",
    icon: LandPlot,
  },
  { id: "caderno", label: "Caderno de campo", description: "Atividades e histórico", icon: BookOpenCheck },
  { id: "ndvi", label: "Monitoramento NDVI", description: "Satélite e vigor vegetal", icon: Satellite },
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
  {
    id: "relatorios",
    label: "Relatórios",
    description: "Documento técnico por propriedade",
    icon: FileText,
  },
  { id: "modulos", label: "Módulos", description: "Todas as ferramentas AGRYN", icon: LayoutGrid },
];
