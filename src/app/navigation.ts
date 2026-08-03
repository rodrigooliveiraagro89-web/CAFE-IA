import type { LucideIcon } from "lucide-react";
import {
  BookOpenCheck,
  Bot,
  Briefcase,
  Calculator,
  Cherry,
  CircleDollarSign,
  CloudSun,
  ScanLine,
  FileText,
  FlaskConical,
  House,
  LandPlot,
  LayoutGrid,
  Map,
  Mountain,
  Satellite,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";

export type AppView =
  | "inicio"
  | "carteira"
  | "propriedades"
  | "mapeamento"
  | "modulos"
  | "ndvi"
  | "analise-solo"
  | "adubacao"
  | "assistente"
  | "diagnostico"
  | "morango"
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
    id: "assistente",
    label: "AGRYN IA",
    description: "Assistente agronômico por IA",
    icon: Bot,
  },
  {
    id: "diagnostico",
    label: "Diagnóstico por foto",
    description: "Triagem de sintomas por IA",
    icon: ScanLine,
  },
  {
    id: "morango",
    label: "Morango",
    description: "Painel da cultura do morango",
    icon: Cherry,
  },
  { id: "clima", label: "Clima", description: "Previsão e janela operacional", icon: CloudSun },
  {
    id: "mercado",
    label: "Mercado",
    description: "Cotações, médias e projeção",
    icon: TrendingUp,
  },
  {
    id: "calculadoras",
    label: "Calculadoras",
    description: "Estande, pulverização e conversões",
    icon: Calculator,
  },
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
