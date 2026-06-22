import {
  Activity,
  DollarSign,
  FileText,
  KeyRound,
  LifeBuoy,
  Network,
  Server,
  Users,
} from "lucide-react";

export const moduleVisuals = {
  clientes: {
    label: "Clientes",
    icon: Users,
    tone: "border-blue-200 bg-blue-50 text-blue-950",
  },
  contratos: {
    label: "Contratos",
    icon: FileText,
    tone: "border-slate-200 bg-white text-slate-950",
  },
  financeiro: {
    label: "Financeiro",
    icon: DollarSign,
    tone: "border-emerald-200 bg-emerald-50 text-emerald-950",
  },
  rede: {
    label: "Rede DC NET",
    icon: Network,
    tone: "border-sky-200 bg-sky-50 text-sky-950",
  },
  monitoramento: {
    label: "Monitoramento",
    icon: Activity,
    tone: "border-indigo-200 bg-indigo-50 text-indigo-950",
  },
  chamados: {
    label: "Chamados",
    icon: LifeBuoy,
    tone: "border-amber-200 bg-amber-50 text-amber-950",
  },
  acessos: {
    label: "Acessos",
    icon: KeyRound,
    tone: "border-violet-200 bg-violet-50 text-violet-950",
  },
  concentradores: {
    label: "Concentradores",
    icon: Server,
    tone: "border-cyan-200 bg-cyan-50 text-cyan-950",
  },
} as const;
