"use client";

import Link from "next/link";
import { usePathname, useSearchParams, type ReadonlyURLSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { BrandLogo } from "@/components/BrandLogo";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  BarChart3,
  ChevronDown,
  DatabaseZap,
  FileText,
  Filter,
  Headphones,
  KeyRound,
  LayoutDashboard,
  ListOrdered,
  Network,
  Users,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { useShell } from "./shell-context";

/** Itens com hiddenFromMenu permanecem no código e nas rotas; só deixam de aparecer na sidebar. */
type SubItem = { label: string; href: string | null; hint?: string; hiddenFromMenu?: boolean };

type NavGroup = {
  id: string;
  label: string;
  icon: LucideIcon;
  children: SubItem[];
};

const navGroups: NavGroup[] = [
  {
    id: "clientes",
    label: "Clientes",
    icon: Users,
    children: [
      { label: "Todos", href: "/clientes" },
      { label: "Pré-cadastros", href: null, hint: "Disponível em breve" },
    ],
  },
  {
    id: "contratos",
    label: "Contratos",
    icon: FileText,
    children: [
      { label: "Contratos", href: "/contratos" },
      { label: "Modelos de Contratos", href: "/contratos/layouts" },
    ],
  },
  {
    id: "autenticacoes",
    label: "Acessos",
    icon: KeyRound,
    children: [{ label: "Gestão de acessos", href: "/autenticacoes" }],
  },
  {
    id: "redes",
    label: "Rede DC NET",
    icon: Network,
    children: [
      { label: "Central NOC", href: "/redes/noc" },
      { label: "Equipamentos", href: "/redes/servidores" },
      { label: "Unidades Remotas", href: "/redes/agents" },
      { label: "Histórico da Rede", href: "/redes/logs" },
    ],
  },
  {
    id: "monitoramento",
    label: "Monitoramento",
    icon: Activity,
    children: [
      { label: "Consumo da Rede", href: "/monitoramento/trafego" },
      { label: "Clientes Online", href: "/monitoramento/clientes-on-off" },
      { label: "Mapa de Atendimento", href: "/monitoramento/mapa-clientes" },
    ],
  },
  {
    id: "chamados",
    label: "Atendimento",
    icon: Headphones,
    children: [{ label: "Todos", href: "/chamados" }],
  },
  {
    id: "filtro",
    label: "Minha Área",
    icon: Filter,
    children: [{ label: "Meus Chamados", href: "/chamados?visao=minha" }],
  },
  {
    id: "financeiro",
    label: "Financeiro",
    icon: Wallet,
    children: [
      { label: "Cobranças", href: "/financeiro" },
      { label: "Carnês", href: null, hint: "Disponível em breve" },
      { label: "Contratos sem Cobrança", href: null, hint: "Disponível em breve" },
    ],
  },
  {
    id: "relatorios",
    label: "Relatórios",
    icon: BarChart3,
    children: [
      { label: "Visão geral", href: "/relatorios" },
      { label: "Anual comparativo", href: "/relatorios/anual-comparativo" },
    ],
  },
  {
    id: "migracao",
    label: "Migração de Dados",
    icon: DatabaseZap,
    children: [
      { label: "Importar Clientes", href: "/migracao/importar-clientes" },
      { label: "Importar PPPoE", href: null, hint: "Disponível em breve" },
      { label: "Exportar Modelo", href: "/migracao/importar-clientes?tab=modelo" },
      { label: "Histórico de Importações", href: "/migracao/importar-clientes?tab=historico" },
    ],
  },
  {
    id: "sistema",
    label: "Sistema",
    icon: ListOrdered,
    children: [
      /**
       * Hub operacional: nesta fase o menu prioriza o acesso directo a Configurações.
       * Planos e Fila permanecem acessíveis por URL (/planos, /fila-sync).
       * Quando existirem rotas reais, podem acrescentar-se aqui entradas como
       * Formas de Pagamento, Usuários, Permissões, Chatbot (hiddenFromMenu: false).
       */
      { label: "Planos (catálogo)", href: "/planos", hiddenFromMenu: true },
      { label: "Atualizações de Rede", href: "/fila-sync", hiddenFromMenu: true },
      { label: "Configurações", href: "/configuracoes" },
      { label: "BolePix", href: "/configuracoes/bolepix" },
    ],
  },
];

function linkActive(pathname: string, sp: ReadonlyURLSearchParams, href: string): boolean {
  let u: URL;
  try {
    u = new URL(href, "http://localhost");
  } catch {
    return false;
  }
  if (u.pathname === "/contratos") {
    return pathname === "/contratos";
  }
  if (u.pathname.startsWith("/contratos/")) {
    return pathname === u.pathname;
  }

  if (u.pathname.startsWith("/redes/")) {
    return pathname === u.pathname || pathname.startsWith(`${u.pathname}/`);
  }

  if (u.pathname.startsWith("/monitoramento/")) {
    return pathname === u.pathname || pathname.startsWith(`${u.pathname}/`);
  }

  if (u.pathname === "/relatorios") {
    return pathname === "/relatorios";
  }
  if (u.pathname.startsWith("/relatorios/")) {
    return pathname === u.pathname;
  }

  if (pathname !== u.pathname && !pathname.startsWith(`${u.pathname}/`)) return false;

  if (u.pathname === "/chamados") {
    const want = u.searchParams.get("visao");
    if (want === null) {
      return !sp.get("visao");
    }
    return sp.get("visao") === want;
  }

  if (u.searchParams.toString() !== "") {
    for (const [k, v] of u.searchParams.entries()) {
      if (sp.get(k) !== v) return false;
    }
  }
  return true;
}

function SidebarFallback() {
  return (
    <aside
      className={cn(
        "fixed z-50 flex w-[17.5rem] flex-col border-r border-dcnet-border bg-dcnet-nav shadow-xp-nav",
        "top-8 h-[calc(100vh-2rem)] -translate-x-full lg:translate-x-0",
      )}
      aria-hidden
    />
  );
}

function SidebarInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { mobileNavOpen, setMobileNavOpen } = useShell();

  const dashboardActive = pathname === "/dashboard" || pathname.startsWith("/dashboard/");

  const activeGroupIds = useMemo(() => {
    const ids = new Set<string>();
    for (const g of navGroups) {
      if (g.children.some((c) => c.href && linkActive(pathname, searchParams, c.href))) ids.add(g.id);
    }
    return ids;
  }, [pathname, searchParams]);

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setOpenGroups((prev) => {
      const next = { ...prev };
      for (const id of activeGroupIds) next[id] = true;
      return next;
    });
  }, [activeGroupIds]);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname, setMobileNavOpen]);

  const toggleGroup = (id: string) => {
    setOpenGroups((p) => ({ ...p, [id]: !p[id] }));
  };

  const renderSubLink = (item: SubItem, inGroup: string) => {
    const active = item.href ? linkActive(pathname, searchParams, item.href) : false;
    const bar = active
      ? "border-l-[3px] border-[#CFE4FF] bg-[rgba(234,243,255,0.12)]"
      : "border-l-[3px] border-transparent";

    if (item.href) {
      return (
        <Link
          key={`${inGroup}-${item.label}`}
          href={item.href}
          className={cn(
            "block rounded-r-md py-2.5 pl-4 pr-3 text-[13px] font-medium leading-snug transition-colors",
            "hover:bg-[rgba(234,243,255,0.08)] hover:text-[#EAF3FF]",
            active ? "font-semibold text-[#EAF3FF]" : "text-slate-300",
            bar,
          )}
        >
          {item.label}
        </Link>
      );
    }

    return (
      <div
        key={`${inGroup}-${item.label}`}
        title={item.hint}
        className={cn(
          "cursor-not-allowed rounded-r-md py-2.5 pl-4 pr-3 text-[13px] text-slate-400",
          bar,
        )}
        aria-disabled="true"
      >
        {item.label}
        <span className="mt-0.5 block text-[0.65rem] font-normal text-slate-400">Em breve</span>
      </div>
    );
  };

  const asideClass = cn(
    "fixed z-50 flex w-[17.5rem] flex-col border-r border-[rgba(207,228,255,0.28)] bg-dcnet-nav shadow-xp-nav transition-transform duration-200 ease-out",
    "top-8 h-[calc(100vh-2rem)]",
    "lg:translate-x-0",
    mobileNavOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
  );

  return (
    <>
      <aside className={asideClass} aria-label="Navegação principal">
        <div className="flex h-[78px] shrink-0 items-center justify-center bg-dcnet-nav px-2">
          <BrandLogo
            width={380}
            height={120}
            className="h-[150px] w-[300px] object-contain"
          />
        </div>

        <nav className="flex flex-1 flex-col overflow-y-auto px-2.5 py-3" aria-label="Módulos">
          <div className="pb-2">
            <Link
              href="/dashboard"
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold tracking-tight transition-colors",
                dashboardActive
                  ? "border-l-[3px] border-[#CFE4FF] bg-[rgba(234,243,255,0.12)] text-[#EAF3FF]"
                  : "border-l-[3px] border-transparent text-[#EAF3FF] hover:bg-[rgba(234,243,255,0.08)] hover:text-[#EAF3FF]",
              )}
            >
              <LayoutDashboard className="h-4 w-4 shrink-0 text-[#CFE4FF]" aria-hidden />
              Painel Principal
            </Link>
          </div>

          <div className="mt-3 flex flex-col gap-3">
          {navGroups.map((group) => {
            const expanded = openGroups[group.id] ?? false;
            const Icon = group.icon;
            const groupHasActive = group.children.some(
              (c) => c.href && linkActive(pathname, searchParams, c.href),
            );
            const visibleChildren = group.children.filter((c) => !c.hiddenFromMenu);

            return (
              <div key={group.id}>
                <button
                  type="button"
                  onClick={() => toggleGroup(group.id)}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.08em] transition-colors",
                    "text-[#EAF3FF] hover:bg-[rgba(234,243,255,0.08)] hover:text-[#EAF3FF]",
                    groupHasActive && "text-[#EAF3FF]",
                  )}
                  aria-expanded={expanded}
                >
                  <span className="flex min-w-0 items-center gap-2.5">
                    <Icon className="h-4 w-4 shrink-0 text-[#CFE4FF]" aria-hidden />
                    <span className="truncate">{group.label}</span>
                  </span>
                  <ChevronDown
                    className={cn("h-4 w-4 shrink-0 text-[#CFE4FF] transition-transform", expanded && "rotate-180")}
                    aria-hidden
                  />
                </button>
                {expanded ? (
                  <div className="ml-2 mt-1 space-y-0.5 pl-2">
                    {visibleChildren.map((c) => renderSubLink(c, group.id))}
                  </div>
                ) : null}
              </div>
            );
          })}
          </div>
        </nav>
      </aside>
    </>
  );
}

export function Sidebar() {
  return (
    <Suspense fallback={<SidebarFallback />}>
      <SidebarInner />
    </Suspense>
  );
}
