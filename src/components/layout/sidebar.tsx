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
import {
  getPanelSessionRole,
  hasPanelFinanceConfigurationPermission,
} from "@/lib/panel-auth";
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
    children: [{ label: "Acessos", href: "/autenticacoes" }],
  },
  {
    id: "redes",
    label: "Rede",
    icon: Network,
    children: [
      { label: "Painel da rede", href: "/redes/noc" },
      { label: "Equipamentos", href: "/redes/servidores" },
      { label: "Concentradores", href: "/redes/concentradores" },
      { label: "Planos", href: "/redes/planos" },
      { label: "Unidades", href: "/redes/agents" },
      { label: "Histórico", href: "/redes/logs" },
    ],
  },
  {
    id: "monitoramento",
    label: "Monitoramento",
    icon: Activity,
    children: [
      { label: "Consumo da Rede", href: "/monitoramento/trafego" },
      { label: "Clientes Conectados", href: "/monitoramento/clientes-on-off" },
      { label: "Mapa", href: "/monitoramento/mapa-clientes" },
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
      { label: "Visão geral", href: "/financeiro" },
      { label: "Política", href: "/financeiro/politica" },
      { label: "Divergências", href: "/financeiro/divergencias" },
      { label: "Configurações Financeiras", href: "/financeiro/configuracoes" },
      { label: "Notificações Inteligentes", href: "/financeiro/notificacoes" },
      { label: "Simulador Financeiro", href: "/financeiro/simulador" },
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
    label: "Importação",
    icon: DatabaseZap,
    children: [
      { label: "Importar Clientes", href: "/migracao/importar-clientes" },
      { label: "Importar Internet", href: null, hint: "Disponível em breve" },
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
       * Hub comercial: nesta fase o menu prioriza o acesso directo a Configurações.
       * A fila permanece acessível por URL (/fila-sync).
       * Quando existirem rotas reais, podem acrescentar-se aqui entradas como
       * Formas de Pagamento, Usuários, Permissões, Chatbot (hiddenFromMenu: false).
       */
      { label: "Atualizações de Rede", href: "/fila-sync", hiddenFromMenu: true },
      { label: "Configurações", href: "/configuracoes" },
      { label: "Atualizações do Sistema", href: "/configuracoes/atualizacoes" },
      { label: "Saúde do Ecossistema", href: "/configuracoes/saude-ecossistema" },
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
  const [panelRole, setPanelRole] = useState<string | null>(null);

  useEffect(() => {
    const syncRole = () => setPanelRole(getPanelSessionRole());
    syncRole();
    const intervalId = window.setInterval(syncRole, 200);
    const stopId = window.setTimeout(() => window.clearInterval(intervalId), 4000);
    return () => {
      window.clearInterval(intervalId);
      window.clearTimeout(stopId);
    };
  }, []);

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
      ? "border-l-[3px] border-dcnet-primary-soft bg-white/10"
      : "border-l-[3px] border-transparent";

    if (item.href) {
      return (
        <Link
          key={`${inGroup}-${item.label}`}
          href={item.href}
          className={cn(
            "block rounded-r-md py-2.5 pl-4 pr-3 text-[13px] font-medium leading-snug transition-colors",
            "hover:bg-white/10 hover:text-dcnet-nav-text",
            active ? "font-semibold text-dcnet-nav-text" : "text-slate-300",
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
    "fixed z-50 flex w-[17.5rem] flex-col border-r border-dcnet-nav-border/40 bg-dcnet-nav shadow-xp-nav transition-transform duration-200 ease-out",
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
                  ? "border-l-[3px] border-dcnet-primary-soft bg-white/10 text-dcnet-nav-text"
                  : "border-l-[3px] border-transparent text-dcnet-nav-text hover:bg-white/10 hover:text-dcnet-nav-text",
              )}
            >
              <LayoutDashboard className="h-4 w-4 shrink-0 text-dcnet-primary-soft" aria-hidden />
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
            const visibleChildren = group.children.filter((c) => {
              if (c.hiddenFromMenu) return false;
              if (c.href === "/financeiro/configuracoes") {
                return hasPanelFinanceConfigurationPermission("read", panelRole);
              }
              return true;
            });

            if (visibleChildren.length === 0) return null;

            return (
              <div key={group.id}>
                <button
                  type="button"
                  onClick={() => toggleGroup(group.id)}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.08em] transition-colors",
                    "text-dcnet-nav-text hover:bg-white/10 hover:text-dcnet-nav-text",
                    groupHasActive && "text-dcnet-nav-text",
                  )}
                  aria-expanded={expanded}
                >
                  <span className="flex min-w-0 items-center gap-2.5">
                    <Icon className="h-4 w-4 shrink-0 text-dcnet-primary-soft" aria-hidden />
                    <span className="truncate">{group.label}</span>
                  </span>
                  <ChevronDown
                    className={cn("h-4 w-4 shrink-0 text-dcnet-primary-soft transition-transform", expanded && "rotate-180")}
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
