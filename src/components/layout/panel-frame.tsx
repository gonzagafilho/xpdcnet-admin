"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect } from "react";
import { getSessionToken, setSessionToken } from "@/lib/api-client";
import { AppShell } from "./app-shell";

const titles: Record<string, { title: string; subtitle?: string }> = {
  "/dashboard": {
    title: "Painel",
    subtitle: "Resumo geral",
  },
  "/clientes": { title: "Clientes", subtitle: "" },
  "/chamados": { title: "Chamados", subtitle: "Atendimento rápido" },
  "/planos": { title: "Planos", subtitle: "Ofertas" },
  "/financeiro": { title: "Financeiro", subtitle: "Recebimentos" },
  "/contratos": { title: "Contratos", subtitle: "Documentos" },
  "/contratos/layouts": { title: "Modelos", subtitle: "Padrões" },
  "/autenticacoes": { title: "Acessos", subtitle: "Entradas" },
  "/redes/servidores": { title: "Equipamentos", subtitle: "Disponibilidade" },
  "/redes/concentradores": { title: "Concentradores", subtitle: "Qualidade" },
  "/redes/planos": { title: "Planos de Internet", subtitle: "Velocidade" },
  "/redes/agents": { title: "Unidades", subtitle: "Cobertura" },
  "/monitoramento/trafego": { title: "Tráfego", subtitle: "Uso atual" },
  "/monitoramento/clientes-on-off": {
    title: "Clientes conectados",
    subtitle: "Conexão atual",
  },
  "/monitoramento/mapa-clientes": {
    title: "Mapa de clientes",
    subtitle: "Localização",
  },
  "/relatorios": { title: "Relatórios", subtitle: "Indicadores" },
  "/migracao/importar-clientes": { title: "Importação", subtitle: "Clientes" },
  "/relatorios/anual-comparativo": {
    title: "Relatório anual",
    subtitle: "Comparativo",
  },
  "/configuracoes": { title: "Configurações", subtitle: "Preferências" },
  "/configuracoes/atualizacoes": { title: "Atualizações do Sistema", subtitle: "Planejamento seguro" },
  "/configuracoes/saude-ecossistema": { title: "Saúde do Ecossistema", subtitle: "Status dos serviços" },
  "/fila-sync": { title: "Atualizações", subtitle: "Fila" },
};

function resolvePanelMeta(pathname: string): { title: string; subtitle?: string } {
  const exact = titles[pathname];
  if (exact) return exact;
  if (pathname.startsWith("/contratos/layouts")) return titles["/contratos/layouts"]!;
  if (pathname.startsWith("/contratos")) return titles["/contratos"]!;
  if (pathname.startsWith("/autenticacoes")) return titles["/autenticacoes"]!;
  if (/^\/redes\/servidores\/.+/.test(pathname)) {
    return { title: "Equipamento", subtitle: "Disponibilidade" };
  }
  if (/^\/monitoramento\/clientes-on-off\/.+/.test(pathname)) {
    return { title: "Cliente", subtitle: "Resumo" };
  }
  if (pathname.startsWith("/redes/concentradores")) return titles["/redes/concentradores"]!;
  if (pathname.startsWith("/redes/planos")) return titles["/redes/planos"]!;
  if (pathname.startsWith("/redes/agents")) return titles["/redes/agents"]!;
  if (pathname.startsWith("/redes/servidores")) return titles["/redes/servidores"]!;
  if (pathname.startsWith("/monitoramento/mapa-clientes")) return titles["/monitoramento/mapa-clientes"]!;
  if (pathname.startsWith("/monitoramento/clientes-on-off")) return titles["/monitoramento/clientes-on-off"]!;
  if (pathname.startsWith("/monitoramento/trafego")) return titles["/monitoramento/trafego"]!;
  if (pathname.startsWith("/configuracoes/atualizacoes")) return titles["/configuracoes/atualizacoes"]!;
  if (pathname.startsWith("/configuracoes/saude-ecossistema")) return titles["/configuracoes/saude-ecossistema"]!;
  if (pathname.startsWith("/migracao/importar-clientes")) return titles["/migracao/importar-clientes"]!;
  if (pathname.startsWith("/relatorios/anual-comparativo")) return titles["/relatorios/anual-comparativo"]!;
  if (pathname.startsWith("/relatorios")) return titles["/relatorios"]!;
  if (pathname.startsWith("/financeiro/politica")) {
    return { title: "Política financeira", subtitle: "Regras" };
  }
  if (pathname.startsWith("/dashboard/executivo")) {
    return { title: "Painel executivo", subtitle: "Resumo" };
  }
  if (pathname.startsWith("/dashboard/comercial")) {
    return { title: "Comercial executivo", subtitle: "Resumo" };
  }
  if (pathname.startsWith("/clientes/360")) {
    return { title: "Cliente 360", subtitle: "Resumo" };
  }
  if (pathname.startsWith("/clientes/timeline")) {
    return { title: "Histórico", subtitle: "Cliente" };
  }
  if (pathname.startsWith("/fila-sync")) return titles["/fila-sync"]!;
  return { title: "XPDCNET" };
}

export function PanelFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  useEffect(() => {
    if (getSessionToken()) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/auth/session", { credentials: "same-origin" });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { token?: string };
        if (data.token) setSessionToken(data.token);
      } catch {
        /* silencioso: falhas de sessão seguem para redirecionamento */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const meta = resolvePanelMeta(pathname);
  return (
    <AppShell title={meta.title} subtitle={meta.subtitle}>
      {children}
    </AppShell>
  );
}
