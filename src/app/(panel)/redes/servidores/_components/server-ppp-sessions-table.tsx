"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ClipboardCopy, ExternalLink, GitBranch, Loader2, RefreshCw, Stethoscope, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch, ApiRequestError } from "@/lib/api-client";
import type { MikrotikServerPppActiveSessionFromApi } from "@/lib/api-types";

type SortKey = "name" | "uptime";

type Props = {
  sessions: MikrotikServerPppActiveSessionFromApi[];
  total: number;
  truncated: boolean;
  online: boolean;
  serverId: string;
};

function parseUptimeRough(u: string): number {
  if (!u) return 0;
  const t = u.trim().toLowerCase();
  let sec = 0;
  const w = t.match(/(\d+)\s*w/);
  if (w) sec += Number(w[1]) * 604800;
  const d = t.match(/(\d+)\s*d/);
  if (d) sec += Number(d[1]) * 86400;
  const h = t.match(/(\d+)\s*h/);
  if (h) sec += Number(h[1]) * 3600;
  const m = t.match(/(\d+)\s*m/);
  if (m) sec += Number(m[1]) * 60;
  const s = t.match(/(\d+)\s*s/);
  if (s) sec += Number(s[1]);
  if (sec === 0 && /^\d+$/.test(t)) return Number(t);
  return sec;
}

function sessionMatchesFilter(row: MikrotikServerPppActiveSessionFromApi, q: string): boolean {
  if (!q.trim()) return true;
  const n = q.trim().toLowerCase();
  const hay = [
    row.name,
    row.address,
    row.callerId,
    row.remoteAddress,
    row.localAddress,
    row.service,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return hay.includes(n);
}

export function ServerPppSessionsTable({ sessions, total, truncated, online, serverId }: Props) {
  const [filter, setFilter] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const filteredSorted = useMemo(() => {
    const f = sessions.filter((r) => sessionMatchesFilter(r, filter));
    const copy = [...f];
    if (sortKey === "name") {
      copy.sort((a, b) => (a.name || "").localeCompare(b.name || "", "pt", { sensitivity: "base" }));
    } else {
      copy.sort((a, b) => parseUptimeRough(b.uptime) - parseUptimeRough(a.uptime));
    }
    return copy;
  }, [sessions, filter, sortKey]);

  const copySession = async (row: MikrotikServerPppActiveSessionFromApi) => {
    const text = JSON.stringify(row, null, 2);
    try {
      await navigator.clipboard.writeText(text);
      setFeedback("Dados da sessão copiados.");
      setTimeout(() => setFeedback(null), 2000);
    } catch {
      setFeedback("Não foi possível copiar.");
      setTimeout(() => setFeedback(null), 2500);
    }
  };

  const scrollDiagnostics = () => {
    const el = document.getElementById("servidor-diagnostico-conexao");
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const runEnqueue = async (row: MikrotikServerPppActiveSessionFromApi) => {
    const lc = row.linkedClient;
    if (!lc?.clientId || !lc.matchesThisServer) return;
    const ok = window.confirm(
      `Enfileirar sincronização MikroTik para o cliente «${lc.fullName || lc.clientId}»?\n\nOperação auditada; pode ficar pendente se já existir job aberto.`,
    );
    if (!ok) return;
    const k = `enq-${row.sessionId || row.name}`;
    setBusyKey(k);
    setFeedback(null);
    try {
      const res = await apiFetch<{ ok?: boolean; duplicate?: boolean; skipped?: boolean; message?: string }>(
        "/mikrotik-sync/enqueue",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clientId: lc.clientId,
            expectedServerId: serverId,
            triggerReason: "manual_ppp_session_panel",
            triggerContext: { source: "redes_servidores_ppp", pppUser: row.name },
          }),
        },
      );
      if (res.skipped) {
        setFeedback(res.message || "Sync não enfileirado.");
      } else if (res.duplicate) {
        setFeedback("Já existe job pendente ou em processamento para este cliente.");
      } else {
        setFeedback("Job de sync enfileirado.");
      }
      setTimeout(() => setFeedback(null), 4000);
    } catch (e) {
      const msg = e instanceof ApiRequestError ? e.message : "Falha ao enfileirar.";
      setFeedback(msg);
      setTimeout(() => setFeedback(null), 5000);
    } finally {
      setBusyKey(null);
    }
  };

  const runReconcile = async (row: MikrotikServerPppActiveSessionFromApi) => {
    const lc = row.linkedClient;
    if (!lc?.clientId || !lc.matchesThisServer) return;
    const ok = window.confirm(
      `Pedir reconciliação de divergência para «${lc.fullName || lc.clientId}»?\n\nIsto pode enfileirar correção conforme política do sistema.`,
    );
    if (!ok) return;
    const k = `rec-${row.sessionId || row.name}`;
    setBusyKey(k);
    setFeedback(null);
    try {
      await apiFetch(`/mikrotik-monitoring/client/${encodeURIComponent(lc.clientId)}/reconcile?timeoutMs=45000`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "manual_ppp_session_panel" }),
      });
      setFeedback("Reconciliação solicitada — verifique a fila de sync.");
      setTimeout(() => setFeedback(null), 4000);
    } catch (e) {
      const msg = e instanceof ApiRequestError ? e.message : "Falha na reconciliação.";
      setFeedback(msg);
      setTimeout(() => setFeedback(null), 5000);
    } finally {
      setBusyKey(null);
    }
  };

  if (!online) {
    return (
      <p className="text-sm text-slate-500">Equipamento offline — não é possível listar sessões PPP activas.</p>
    );
  }

  if (!sessions.length) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-6 py-10 text-center">
        <Users className="mx-auto h-9 w-9 text-slate-300" aria-hidden />
        <p className="mt-3 text-sm font-semibold text-slate-800">Nenhum cliente online neste momento</p>
        <p className="mt-1 text-xs text-slate-600">Não há entradas em /ppp/active nesta consulta.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div>
          <p className="text-xs text-slate-600">
            <span className="font-semibold text-slate-800">{total.toLocaleString("pt-BR")}</span> sessão(ões) no
            equipamento
            {truncated ? (
              <span className="ml-1 text-amber-700">· lista truncada (a mostrar {sessions.length})</span>
            ) : null}
          </p>
          {filteredSorted.length !== sessions.length ? (
            <p className="text-[11px] text-slate-500">
              Filtro local: {filteredSorted.length} de {sessions.length} linhas visíveis
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            placeholder="Filtrar por nome, IP, caller-id…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="h-9 w-full min-w-[200px] sm:w-64"
          />
          <div className="flex gap-1 rounded-lg border border-slate-200 bg-slate-50 p-0.5">
            <Button
              type="button"
              size="sm"
              variant={sortKey === "name" ? "default" : "ghost"}
              className="h-8 px-2 text-xs"
              onClick={() => setSortKey("name")}
            >
              Nome
            </Button>
            <Button
              type="button"
              size="sm"
              variant={sortKey === "uptime" ? "default" : "ghost"}
              className="h-8 px-2 text-xs"
              onClick={() => setSortKey("uptime")}
            >
              Uptime
            </Button>
          </div>
        </div>
      </div>

      {feedback ? <p className="text-xs text-slate-700">{feedback}</p> : null}

      <div className="overflow-x-auto rounded-lg border border-slate-200/90 bg-white">
        <table className="w-full min-w-[980px] border-collapse text-left text-[13px]">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/95 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">
              <th className="px-3 py-2.5">Utilizador</th>
              <th className="px-3 py-2.5">Serviço / perfil</th>
              <th className="px-3 py-2.5">IP / endereços</th>
              <th className="px-3 py-2.5">Uptime</th>
              <th className="px-3 py-2.5">Caller ID</th>
              <th className="px-3 py-2.5 font-mono">Encoding</th>
              <th className="px-3 py-2.5">Cliente local</th>
              <th className="px-3 py-2.5 text-right">Acções</th>
            </tr>
          </thead>
          <tbody className="text-slate-800">
            {filteredSorted.map((row, idx) => {
              const lc = row.linkedClient;
              const rowBusy =
                busyKey === `enq-${row.sessionId || row.name}` || busyKey === `rec-${row.sessionId || row.name}`;
              return (
                <tr key={row.sessionId || `${row.name}-${idx}`} className="border-b border-slate-100 hover:bg-slate-50/80">
                  <td className="px-3 py-2 font-semibold">{row.name || "—"}</td>
                  <td className="px-3 py-2 text-xs">
                    <div>{row.service || "—"}</div>
                    {row.profile ? <div className="font-mono text-[11px] text-slate-500">{row.profile}</div> : null}
                    {row.server ? <div className="text-[11px] text-slate-500">srv {row.server}</div> : null}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">
                    <div>{row.address || "—"}</div>
                    {row.localAddress ? <div className="text-[11px] text-slate-500">L {row.localAddress}</div> : null}
                    {row.remoteAddress ? <div className="text-[11px] text-slate-500">R {row.remoteAddress}</div> : null}
                  </td>
                  <td className="px-3 py-2 tabular-nums">{row.uptime || "—"}</td>
                  <td className="max-w-[140px] truncate px-3 py-2 font-mono text-xs" title={row.callerId}>
                    {row.callerId || "—"}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{row.encoding || "—"}</td>
                  <td className="px-3 py-2 text-xs">
                    {lc ? (
                      <div className="space-y-0.5">
                        <span className="font-medium text-slate-800">{lc.fullName || lc.clientId}</span>
                        {!lc.matchesThisServer ? (
                          <p className="text-amber-800">Cadastro noutro servidor</p>
                        ) : null}
                      </div>
                    ) : (
                      <span className="text-slate-500">Sem vínculo local</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex flex-wrap justify-end gap-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8 px-2 text-[11px]"
                        onClick={() => void copySession(row)}
                        title="Copiar JSON da sessão"
                      >
                        <ClipboardCopy className="h-3.5 w-3.5" aria-hidden />
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8 px-2 text-[11px]"
                        onClick={scrollDiagnostics}
                        title="Ir ao bloco de diagnóstico"
                      >
                        <Stethoscope className="h-3.5 w-3.5" aria-hidden />
                      </Button>
                      {lc ? (
                        <>
                          <Button type="button" size="sm" variant="outline" className="h-8 px-2 text-[11px]" asChild>
                            <Link href="/clientes" title="Módulo clientes">
                              <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                            </Link>
                          </Button>
                          <Button type="button" size="sm" variant="outline" className="h-8 px-2 text-[11px]" asChild>
                            <Link href={`/clientes/timeline/${lc.clientId}`} title="Linha do tempo">
                              <GitBranch className="h-3.5 w-3.5" aria-hidden />
                            </Link>
                          </Button>
                        </>
                      ) : null}
                      {lc?.matchesThisServer ? (
                        <>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-8 px-2 text-[11px]"
                            disabled={rowBusy}
                            onClick={() => void runEnqueue(row)}
                            title="Reenfileirar sync"
                          >
                            {busyKey === `enq-${row.sessionId || row.name}` ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                            ) : (
                              <RefreshCw className="h-3.5 w-3.5" aria-hidden />
                            )}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-8 px-2 text-[11px]"
                            disabled={rowBusy}
                            onClick={() => void runReconcile(row)}
                            title="Reconciliar divergência"
                          >
                            {busyKey === `rec-${row.sessionId || row.name}` ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                            ) : (
                              <span className="text-[10px] font-semibold">Rec</span>
                            )}
                          </Button>
                        </>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
