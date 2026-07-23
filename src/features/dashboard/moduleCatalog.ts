import {
  Bot,
  BrainCircuit,
  Bug,
  Calculator,
  ChartNoAxesCombined,
  CircleDollarSign,
  CloudSun,
  Droplets,
  FileText,
  FlaskConical,
  Gauge,
  Leaf,
  MapPinned,
  Mountain,
  NotebookPen,
  PackageSearch,
  ScanLine,
  Satellite,
  Sprout,
  Tractor,
  TrendingUp,
  Wheat,
  type LucideIcon,
} from "lucide-react";

export type ModuleAccent = "emerald" | "lime" | "amber" | "cyan" | "violet" | "rose";
export type ModuleGroup =
  | "Monitoramento"
  | "Análises"
  | "Manejo"
  | "Gestão"
  | "Inteligência Artificial"
  | "Relatórios";

export type AgrynModule = {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
  accent: ModuleAccent;
  group: ModuleGroup;
  href: string;
  badge?: string;
};

export const moduleCatalog: AgrynModule[] = [
  { id: "clima", label: "Clima", description: "Previsão e janela operacional", icon: CloudSun, accent: "cyan", group: "Monitoramento", href: "./clima.html", badge: "Ao vivo" },
  { id: "solo", label: "Solo", description: "Laudos, nutrientes e interpretação", icon: FlaskConical, accent: "emerald", group: "Análises", href: "./?view=analise-solo", badge: "IA" },
  { id: "foliar", label: "Análise foliar", description: "Estado nutricional da cultura", icon: Leaf, accent: "lime", group: "Análises", href: "./agryn.html?tab=foliar" },
  { id: "ndvi", label: "NDVI por satélite", description: "Vigor espectral, cenas e evolução", icon: Satellite, accent: "lime", group: "Monitoramento", href: "./?view=ndvi", badge: "Fonte pública" },
  { id: "defensivos", label: "Pragas e doenças", description: "Identificação e manejo integrado", icon: Bug, accent: "rose", group: "Manejo", href: "./agryn.html?tab=defensivos" },
  { id: "visao", label: "Visão computacional", description: "Diagnóstico de sintomas por imagem", icon: ScanLine, accent: "violet", group: "Inteligência Artificial", href: "./agryn.html?tab=foto", badge: "IA" },
  { id: "mapa", label: "Mapas e talhões", description: "Medição por satélite e limites", icon: MapPinned, accent: "emerald", group: "Gestão", href: "./?view=mapeamento", badge: "Novo" },
  { id: "irrigacao", label: "Irrigação", description: "Atividades e consumo por talhão", icon: Droplets, accent: "cyan", group: "Manejo", href: "./?view=caderno" },
  { id: "caderno", label: "Caderno de campo", description: "Histórico operacional rastreável", icon: NotebookPen, accent: "emerald", group: "Gestão", href: "./?view=caderno", badge: "Novo" },
  { id: "custos", label: "Custos", description: "Consolidação financeira por área", icon: CircleDollarSign, accent: "amber", group: "Gestão", href: "./?view=custos", badge: "Novo" },
  { id: "colheita", label: "Colheita", description: "Registros de operação e produção", icon: Wheat, accent: "lime", group: "Gestão", href: "./?view=caderno" },
  { id: "produtividade", label: "Produtividade", description: "Indicadores baseados nos registros", icon: Gauge, accent: "cyan", group: "Gestão", href: "./?view=caderno" },
  { id: "recomendacoes", label: "Recomendações", description: "Correção e planejamento nutricional", icon: Sprout, accent: "emerald", group: "Manejo", href: "./agryn.html?tab=adubacao" },
  { id: "relatorios", label: "Relatórios", description: "Documentos técnicos e exportação", icon: FileText, accent: "violet", group: "Relatórios", href: "./?view=relatorios", badge: "Novo" },
  { id: "ia", label: "AGRYN IA", description: "Assistente agronômico contextual", icon: Bot, accent: "emerald", group: "Inteligência Artificial", href: "./agryn.html?tab=ia", badge: "IA" },
  { id: "calc", label: "Calculadoras", description: "Área, aplicação e conversões", icon: Calculator, accent: "amber", group: "Manejo", href: "./agryn.html?tab=calc" },
  { id: "produtos", label: "Produtos agrícolas", description: "Catálogo técnico da operação", icon: PackageSearch, accent: "lime", group: "Manejo", href: "./agryn.html?tab=defensivos" },
  { id: "diagnostico", label: "Diagnóstico", description: "Análise guiada de sintomas", icon: BrainCircuit, accent: "violet", group: "Inteligência Artificial", href: "./agryn.html?tab=foto", badge: "IA" },
  { id: "mercado", label: "Mercado agrícola", description: "Cotações e leitura de cenário", icon: TrendingUp, accent: "amber", group: "Monitoramento", href: "./agryn.html?tab=mercado" },
  { id: "adubacao", label: "Calagem e adubação", description: "Plano nutricional e correção", icon: Mountain, accent: "amber", group: "Manejo", href: "./agryn.html?tab=adubacao" },
  { id: "operacoes", label: "Operações mecanizadas", description: "Registro de intervenções no campo", icon: Tractor, accent: "cyan", group: "Gestão", href: "./?view=caderno" },
  { id: "indicadores", label: "Indicadores", description: "Leitura consolidada da operação", icon: ChartNoAxesCombined, accent: "emerald", group: "Relatórios", href: "./?view=inicio" },
];
