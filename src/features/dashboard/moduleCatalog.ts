import {
  Bot,
  Calculator,
  CircleDollarSign,
  CloudSun,
  FileText,
  FlaskConical,
  MapPinned,
  Mountain,
  NotebookPen,
  ScanLine,
  Satellite,
  Sprout,
  TrendingUp,
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
  { id: "clima", label: "Clima", description: "Previsão e janela operacional", icon: CloudSun, accent: "cyan", group: "Monitoramento", href: "./?view=clima", badge: "Ao vivo" },
  { id: "solo", label: "Solo", description: "Laudos, nutrientes e interpretação", icon: FlaskConical, accent: "emerald", group: "Análises", href: "./?view=analise-solo", badge: "IA" },
  { id: "ndvi", label: "NDVI por satélite", description: "Vigor espectral, cenas e evolução", icon: Satellite, accent: "lime", group: "Monitoramento", href: "./?view=ndvi", badge: "Fonte pública" },
  { id: "visao", label: "Visão computacional", description: "Diagnóstico de sintomas por imagem", icon: ScanLine, accent: "violet", group: "Inteligência Artificial", href: "./?view=diagnostico", badge: "IA" },
  { id: "mapa", label: "Mapas e talhões", description: "Medição por satélite e limites", icon: MapPinned, accent: "emerald", group: "Gestão", href: "./?view=mapeamento", badge: "Novo" },
  { id: "caderno", label: "Caderno de campo", description: "Histórico operacional rastreável", icon: NotebookPen, accent: "emerald", group: "Gestão", href: "./?view=caderno", badge: "Novo" },
  { id: "custos", label: "Custos", description: "Consolidação financeira por área", icon: CircleDollarSign, accent: "amber", group: "Gestão", href: "./?view=custos", badge: "Novo" },
  { id: "recomendacoes", label: "Recomendações", description: "Correção e planejamento nutricional", icon: Sprout, accent: "emerald", group: "Manejo", href: "./?view=adubacao", badge: "Novo" },
  { id: "relatorios", label: "Relatórios", description: "Documentos técnicos e exportação", icon: FileText, accent: "violet", group: "Relatórios", href: "./?view=relatorios", badge: "Novo" },
  { id: "ia", label: "AGRYN IA", description: "Assistente agronômico contextual", icon: Bot, accent: "emerald", group: "Inteligência Artificial", href: "./?view=assistente", badge: "IA" },
  { id: "calc", label: "Calculadoras", description: "Área, aplicação e conversões", icon: Calculator, accent: "amber", group: "Manejo", href: "./?view=calculadoras", badge: "Novo" },
  { id: "mercado", label: "Mercado agrícola", description: "Cotações e leitura de cenário", icon: TrendingUp, accent: "amber", group: "Monitoramento", href: "./?view=mercado", badge: "Novo" },
  { id: "adubacao", label: "Calagem e adubação", description: "Doses pelo Boletim 100 (IAC)", icon: Mountain, accent: "amber", group: "Manejo", href: "./?view=adubacao", badge: "Novo" },
];
