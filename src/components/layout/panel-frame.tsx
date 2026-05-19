"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect } from "react";
import { getSessionToken, setSessionToken } from "@/lib/api-client";
import { AppShell } from "./app-shell";

const titles: Record<string, { title: string; subtitle?: string }> = {
  "/dashboard": {
    title: "Bem-vindo ao painel operacional",
    subtitle: "Resumo comercial e operacional",
  },
  "/clientes": { title: "Clientes", subtitle: "Assinantes e acesso" },
  "/chamados": { title: "Chamados", subtitle: "Atendimento e ocorrências" },
  "/planos": { title: "Planos", subtitle: "Ofertas e parâmetros técnicos" },
  "/financeiro": { title: "Financeiro", subtitle: "Cobranças e faturação" },
  "/contratos": { title: "Contratos", subtitle: "Vínculos e documentação com clientes" },
  "/contratos/layouts": { title: "Layouts de contratos", subtitle: "Modelos para documentos" },
  "/autenticacoes": { title: "Autenticações", subtitle: "Credenciais e acessos de rede" },
  "/redes/servidores": { title: "Servidores de Rede", subtitle: "Concentradores e integração MikroTik" },
  "/redes/agents": { title: "Agentes remotos", subtitle: "Execução distribuída e presença nas filiais" },
  "/monitoramento/trafego": { title: "Monitoramento · Tráfego", subtitle: "Interfaces e snapshot operacional por equipamento" },
  "/monitoramento/clientes-on-off": {
    title: "Monitoramento · Clientes On/Off",
    subtitle: "Sessões PPP activas vs cadastro por servidor",
  },
  "/monitoramento/mapa-clientes": {
    title: "Monitoramento · Mapa de clientes",
    subtitle: "Georeferência cadastral e estado PPP",
  },
  "/relatorios": { title: "Relatórios", subtitle: "Indicadores e exportações" },
  "/relatorios/anual-comparativo": {
    title: "Relatório anual comparativo",
    subtitle: "Indicadores ano a ano",
  },
  "/configuracoes": { title: "Configurações", subtitle: "Preferências do painel" },
  "/fila-sync": { title: "Fila de Sincronização", subtitle: "Jobs MikroTik Sync" },
};

function resolvePanelMeta(pathname: string): { title: string; subtitle?: string } {
  const exact = titles[pathname];
  if (exact) return exact;
  if (pathname.startsWith("/contratos/layouts")) return titles["/contratos/layouts"]!;
  if (pathname.startsWith("/contratos")) return titles["/contratos"]!;
  if (pathname.startsWith("/autenticacoes")) return titles["/autenticacoes"]!;
  if (/^\/redes\/servidores\/.+/.test(pathname)) {
    return { title: "Servidor — visão NOC", subtitle: "Monitoramento e diagnóstico operacional" };
  }
  if (/^\/monitoramento\/clientes-on-off\/.+/.test(pathname)) {
    return { title: "Monitoramento · Cliente", subtitle: "Ficha operacional e diagnóstico" };
  }
  if (pathname.startsWith("/redes/agents")) return titles["/redes/agents"]!;
  if (pathname.startsWith("/redes/servidores")) return titles["/redes/servidores"]!;
  if (pathname.startsWith("/monitoramento/mapa-clientes")) return titles["/monitoramento/mapa-clientes"]!;
  if (pathname.startsWith("/monitoramento/clientes-on-off")) return titles["/monitoramento/clientes-on-off"]!;
  if (pathname.startsWith("/monitoramento/trafego")) return titles["/monitoramento/trafego"]!;
  if (pathname.startsWith("/relatorios/anual-comparativo")) return titles["/relatorios/anual-comparativo"]!;
  if (pathname.startsWith("/relatorios")) return titles["/relatorios"]!;
  if (pathname.startsWith("/financeiro/politica")) {
    return { title: "Política financeira", subtitle: "Diagnóstico operacional da automação" };
  }
  if (pathname.startsWith("/dashboard/executivo")) {
    return { title: "Dashboard executivo", subtitle: "Visão operacional avançada" };
  }
  if (pathname.startsWith("/clientes/timeline")) {
    return { title: "Timeline do cliente", subtitle: "Auditoria de eventos e execução" };
  }
  if (pathname.startsWith("/fila-sync")) return titles["/fila-sync"]!;
  return { title: "DCNET Operacional" };
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
        /* silencioso: chamadas API falharão e 401 redireciona se necessário */
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
