import {
  Bot,
  Briefcase,
  Calculator,
  CircleDollarSign,
  CloudSun,
  FileText,
  FlaskConical,
  CalendarRange,
  History,
  LandPlot,
  MapPinned,
  Mountain,
  NotebookPen,
  ScanLine,
  Satellite,
  ShieldCheck,
  Sprout,
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
  { id: "linha-do-tempo", label: "Linha do tempo", description: "Rastreabilidade completa do talhão", icon: History, accent: "emerald", group: "Gestão", href: "./?view=linha-do-tempo", badge: "Novo" },
  { id: "clima", label: "Clima", description: "Previsão e janela operacional", icon: CloudSun, accent: "cyan", group: "Monitoramento", href: "./?view=clima", badge: "Ao vivo" },
  { id: "solo", label: "Solo", description: "Laudos, nutrientes e interpretação", icon: FlaskConical, accent: "emerald", group: "Análises", href: "./?view=analise-solo", badge: "IA" },
  { id: "ndvi", label: "NDVI por satélite", description: "Vigor espectral, cenas e evolução", icon: Satellite, accent: "lime", group: "Monitoramento", href: "./?view=ndvi", badge: "Fonte pública" },
  { id: "visao", label: "Visão computacional", description: "Diagnóstico de sintomas por imagem", icon: ScanLine, accent: "violet", group: "Inteligência Artificial", href: "./?view=diagnostico", badge: "IA" },
  { id: "mapa", label: "Mapas e talhões", description: "Medição por satélite e limites", icon: MapPinned, accent: "emerald", group: "Gestão", href: "./?view=mapeamento", badge: "Novo" },
  { id: "propriedades", label: "Propriedades e talhões", description: "Culturas, safras e áreas", icon: LandPlot, accent: "emerald", group: "Gestão", href: "./?view=propriedades" },
  { id: "carteira", label: "Carteira", description: "Todas as propriedades num só lugar", icon: Briefcase, accent: "cyan", group: "Gestão", href: "./?view=carteira" },
  { id: "caderno", label: "Caderno de campo", description: "Histórico operacional rastreável", icon: NotebookPen, accent: "emerald", group: "Gestão", href: "./?view=caderno", badge: "Novo" },
  { id: "custos", label: "Custos", description: "Consolidação financeira por área", icon: CircleDollarSign, accent: "amber", group: "Gestão", href: "./?view=custos", badge: "Novo" },
  { id: "plano-safra", label: "Plano de safra", description: "Operações do ciclo, previsto × realizado", icon: CalendarRange, accent: "lime", group: "Manejo", href: "./?view=plano-safra", badge: "Novo" },
  { id: "recomendacoes", label: "Recomendações", description: "Correção e planejamento nutricional", icon: Sprout, accent: "emerald", group: "Manejo", href: "./?view=adubacao", badge: "Novo" },
  { id: "relatorios", label: "Relatórios", description: "Documentos técnicos e exportação", icon: FileText, accent: "violet", group: "Relatórios", href: "./?view=relatorios", badge: "Novo" },
  { id: "ia", label: "AGRYN IA", description: "Assistente agronômico contextual", icon: Bot, accent: "emerald", group: "Inteligência Artificial", href: "./?view=assistente", badge: "IA" },
  { id: "calc", label: "Calculadoras", description: "Área, aplicação e conversões", icon: Calculator, accent: "amber", group: "Manejo", href: "./?view=calculadoras", badge: "Novo" },
  { id: "adubacao", label: "Calagem e adubação", description: "Doses pela 5ª Aproximação (MG)", icon: Mountain, accent: "amber", group: "Manejo", href: "./?view=adubacao", badge: "Novo" },
  { id: "governanca", label: "Governança", description: "Segurança técnica e validações", icon: ShieldCheck, accent: "violet", group: "Relatórios", href: "./?view=seguranca" },
];
