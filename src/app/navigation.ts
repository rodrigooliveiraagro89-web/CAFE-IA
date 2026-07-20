import type { LucideIcon } from "lucide-react";
import {
  BookOpenCheck,
  Briefcase,
  CircleDollarSign,
  FileText,
  House,
  LandPlot,
  LayoutGrid,
  Map,
  Satellite,
  ShieldCheck,
} from "lucide-react";

export type AppView =
  | "inicio"
  | "carteira"
  | "propriedades"
  | "mapeamento"
  | "modulos"
  | "ndvi"
  | "caderno"
  | "custos"
  | "relatorios"
  | "seguranca";

export type NavigationItem = {
  id: AppView;
  label: string;
  description: string;
  icon: LucideIcon;
};

export const navigationItems: NavigationItem[] = [
  { id: "inicio", label: "Início", description: "Visão geral da operação", icon: House },
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
  {
    id: "mapeamento",
    label: "Mapeamento",
    description: "Medição de talhões por satélite",
    icon: Map,
  },
  { id: "modulos", label: "Módulos", description: "Todas as ferramentas AGRYN", icon: LayoutGrid },
  { id: "ndvi", label: "Monitoramento NDVI", description: "Satélite e vigor vegetal", icon: Satellite },
  { id: "caderno", label: "Caderno de campo", description: "Atividades e histórico", icon: BookOpenCheck },
  { id: "custos", label: "Custos", description: "Gestão financeira por área", icon: CircleDollarSign },
  {
    id: "relatorios",
    label: "Relatórios",
    description: "Documento técnico por propriedade",
    icon: FileText,
  },
  {
    id: "seguranca",
    label: "Governança",
    description: "Segurança técnica e validações",
    icon: ShieldCheck,
  },
];
