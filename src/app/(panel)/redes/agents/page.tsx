"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  KeyRound,
  Loader2,
  Power,
  RefreshCw,
  Server,
  TerminalSquare,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { apiFetch, ApiRequestError } from "@/lib/api-client";

import type {
  NetworkNodeFromApi,
  NetworkNodeRotateTokenFromApi,
} from "@/lib/api-types";

type AgentTelemetryMeta = {
  version?: string;
  hostname?: string;
  mikrotik?: {
    identity?: { name?: string }[];
    resource?: Record<string, unknown>[];
    totalRxMbps?: number | string;
    totalTxMbps?: number | string;
    interfaceCount?: number | string;
    pppOnlineCount?: number | string;
  };
};

type RemoteCommand = {
  _id?: string;
  kind?: string;
  status?: string;
  completedAt?: string;
  createdAt?: string;
  resultSuccess?: boolean;
  resultData?: unknown[];
};

const AGENT_CONECTADO_MS = 120_000;

function formatPtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
    });
  } catch {
    return "—";
  }
}

function isAgentOnline(row: NetworkNodeFromApi): boolean {
  if (!row.agentLastSeenAt) return false;
  const t = new Date(row.agentLastSeenAt).getTime();
  return Number.isFinite(t) && Date.now() - t < AGENT_CONECTADO_MS;
}

export default function RedesAgentsPage() {
  const [rows, setRows] = useState<NetworkNodeFromApi[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [newToken, setNewToken] = useState<string | null>(null);
  const [tokenModalOpen, setTokenModalOpen] = useState(false);
  const [commandHistory, setCommandHistory] = useState<Record<string, RemoteCommand[]>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await apiFetch<NetworkNodeFromApi[]>("/network-nodes", {
        auth: true,
        timeoutMs: 60_000,
      });

      const agents = (Array.isArray(data) ? data : []).filter((n) => n.type === "REMOTE_AGENT");
      setRows(agents);
    } catch (e) {
      const msg = e instanceof ApiRequestError ? e.message : e instanceof Error ? e.message : "Falha ao carregar.";
      setError(msg);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const refreshCommands = async (row: NetworkNodeFromApi) => {
    try {
      const commands = await apiFetch<RemoteCommand[]>(
        `/network-nodes/${encodeURIComponent(row._id)}/commands`,
        { auth: true },
      );

      setCommandHistory((prev) => ({
        ...prev,
        [row._id]: Array.isArray(commands) ? commands.slice(0, 5) : [],
      }));
    } catch (e) {
      const msg = e instanceof ApiRequestError ? e.message : "Falha ao atualizar histórico.";
      window.alert(msg);
    }
  };

  const executeReadResource = async (row: NetworkNodeFromApi) => {
    setBusyId(row._id);

    try {
      await apiFetch(`/network-nodes/${encodeURIComponent(row._id)}/commands`, {
        method: "POST",
        auth: true,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "READ_RESOURCE",
          payload: { kind: "READ_RESOURCE" },
        }),
      });

      await new Promise((r) => setTimeout(r, 6000));
      await refreshCommands(row);
    } catch (e) {
      const msg = e instanceof ApiRequestError ? e.message : "Falha ao executar comando.";
      window.alert(msg);
    } finally {
      setBusyId(null);
    }
  };

  const toggleActive = async (row: NetworkNodeFromApi) => {
    const next = !row.isActive;
    const ok = window.confirm(
      next ? `Activar agente «${row.name}»?` : `Desactivar agente «${row.name}»? Comunicação remota deixa de ser aceite.`,
    );

    if (!ok) return;

    setBusyId(row._id);

    try {
      await apiFetch(`/network-nodes/${encodeURIComponent(row._id)}`, {
        method: "PUT",
        auth: true,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: next }),
      });

      await load();
    } catch (e) {
      const msg = e instanceof ApiRequestError ? e.message : "Falha ao actualizar.";
      window.alert(msg);
    } finally {
      setBusyId(null);
    }
  };

  const rotateToken = async (row: NetworkNodeFromApi) => {
    const ok = window.confirm(`Gerar uma nova chave de acesso para «${row.name}»? A unidade precisará receber a nova chave para voltar a comunicar.`);
    if (!ok) return;

    setBusyId(row._id);

    try {
      const out = await apiFetch<NetworkNodeRotateTokenFromApi>(
        `/network-nodes/${encodeURIComponent(row._id)}/agent-token/rotate`,
        { method: "POST", auth: true },
      );

      setNewToken(out.agentTokenPlain || "");
      setTokenModalOpen(true);
      await load();
    } catch (e) {
      const msg = e instanceof ApiRequestError ? e.message : "Falha ao gerar a nova chave de acesso.";
      window.alert(msg);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="mx-auto w-full max-w-[90rem] space-y-6 pb-10">
      <div className="flex flex-col gap-4 border-b border-slate-200/90 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Redes</p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">Unidades remotas</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">
            Unidades conectadas à matriz para acompanhar e executar rotinas de rede a partir das filiais, com comunicação segura e acompanhamento centralizado.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm" className="border-slate-200">
            <Link href="/redes/servidores">Equipamentos</Link>
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2 border-slate-200"
            onClick={() => void load()}
            disabled={loading}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <RefreshCw className="h-4 w-4" aria-hidden />}
            Actualizar
          </Button>
        </div>
      </div>

      <Card className="border-slate-200/95 shadow-sm ring-1 ring-slate-900/[0.035]">
        <CardHeader>
          <CardTitle className="text-base">Comunicação com as unidades</CardTitle>
          <CardDescription className="text-sm">
            A comunicação segura mantém a presença de cada unidade atualizada e permite acompanhar as solicitações enviadas pela matriz.
          </CardDescription>
        </CardHeader>
      </Card>

      {error ? (
        <div className="rounded-lg border border-rose-200/90 bg-rose-50/90 px-4 py-3 text-sm text-rose-900" role="alert">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          A carregar…
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-6 py-12 text-center text-slate-600">
          <Server className="mx-auto h-10 w-10 text-slate-300" aria-hidden />
          <p className="mt-3 text-sm font-semibold text-slate-800">Nenhuma unidade remota cadastrada</p>
          <p className="mt-1 text-sm">Cadastre uma unidade remota para começar o acompanhamento.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200/90 bg-white shadow-sm">
          <table className="w-full min-w-[900px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/95 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                <th className="px-4 py-3">Nome / código</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">Último contato</th>
                <th className="px-4 py-3">Operação</th>
                <th className="px-4 py-3 text-right">Acções</th>
              </tr>
            </thead>

            <tbody className="text-slate-800">
              {rows.map((row) => {
                const online = isAgentOnline(row);
                const meta =
                  row.agentMeta && typeof row.agentMeta === "object" && row.agentMeta !== null
                    ? (row.agentMeta as AgentTelemetryMeta)
                    : null;

                const version = meta?.version != null ? String(meta.version) : "—";
                const hostname = meta?.hostname != null ? String(meta.hostname) : "—";
                const mikrotik = meta?.mikrotik?.identity?.[0]?.name != null ? String(meta.mikrotik.identity[0].name) : "—";
                const cpu = meta?.mikrotik?.resource?.[0]?.["cpu-load"] != null ? String(meta.mikrotik.resource[0]["cpu-load"]) : "0";
                const rxMbps = meta?.mikrotik?.totalRxMbps != null ? String(meta.mikrotik.totalRxMbps) : "0";
                const txMbps = meta?.mikrotik?.totalTxMbps != null ? String(meta.mikrotik.totalTxMbps) : "0";
                const interfaceCount = meta?.mikrotik?.interfaceCount != null ? String(meta.mikrotik.interfaceCount) : "0";
                const pppOnline = meta?.mikrotik?.pppOnlineCount != null ? String(meta.mikrotik.pppOnlineCount) : "0";
                const history = commandHistory[row._id] || [];

                return (
                  <tr key={row._id} className="border-b border-slate-100">
                    <td className="px-4 py-3">
                      <p className="font-semibold">{row.name}</p>
                      <p className="font-mono text-xs text-slate-500">{row.code}</p>

                      <div className="mt-2 space-y-1 text-[11px] text-slate-500">
                        <p>Versão: {version}</p>
                        <p>Hostname: {hostname}</p>
                        <p>MikroTik: {mikrotik}</p>

                        <div className="mt-2 grid grid-cols-2 gap-1 rounded-md border border-slate-200 bg-slate-50 p-2">
                          <div>
                            <span className="font-semibold text-slate-700">CPU:</span> {cpu}%
                          </div>
                          <div>
                            <span className="font-semibold text-slate-700">PPP:</span> {pppOnline}
                          </div>
                          <div>
                            <span className="font-semibold text-slate-700">RX:</span> {rxMbps} Mbps
                          </div>
                          <div>
                            <span className="font-semibold text-slate-700">TX:</span> {txMbps} Mbps
                          </div>
                          <div className="col-span-2">
                            <span className="font-semibold text-slate-700">Interfaces:</span> {interfaceCount}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        {row.isActive ? (
                          <Badge variant="success" className="font-semibold">Activo</Badge>
                        ) : (
                          <Badge variant="warning" className="font-semibold">Inactivo</Badge>
                        )}

                        {online ? (
                          <Badge variant="success" className="gap-1 font-semibold">
                            <Activity className="h-3 w-3" aria-hidden />
                            Conectados
                          </Badge>
                        ) : (
                          <Badge variant="error" className="font-semibold">Sem heartbeat</Badge>
                        )}
                      </div>
                    </td>

                    <td className="px-4 py-3 text-xs tabular-nums text-slate-600">
                      {formatPtDate(row.agentLastSeenAt)}
                    </td>

                    <td className="px-4 py-3 text-xs text-slate-500">Resolvido pelo painel (tenant actual)</td>

                    <td className="px-4 py-3 text-right">
                      <div className="flex flex-wrap justify-end gap-2">
                        <Button type="button" size="sm" variant="outline" className="h-8 gap-1 text-xs" disabled={busyId === row._id} onClick={() => void rotateToken(row)}>
                          <KeyRound className="h-3.5 w-3.5" aria-hidden />
                          Nova chave de acesso
                        </Button>

                        <Button type="button" size="sm" variant="outline" className="h-8 gap-1 border-emerald-200 text-emerald-700 text-xs hover:bg-emerald-50" disabled={busyId === row._id} onClick={() => void executeReadResource(row)}>
                          {busyId === row._id ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <TerminalSquare className="h-3.5 w-3.5" aria-hidden />}
                          Executar leitura
                        </Button>

                        <Button type="button" size="sm" variant="outline" className="h-8 gap-1 border-sky-200 text-sky-700 text-xs hover:bg-sky-50" onClick={() => void refreshCommands(row)}>
                          <RefreshCw className="h-3.5 w-3.5" aria-hidden />
                          Atualizar status
                        </Button>

                        <Button type="button" size="sm" variant="outline" className="h-8 gap-1 text-xs" disabled={busyId === row._id} onClick={() => void toggleActive(row)}>
                          <Power className="h-3.5 w-3.5" aria-hidden />
                          {row.isActive ? "Desactivar" : "Activar"}
                        </Button>

                        {history.length > 0 ? (
                          <div className="w-full space-y-2 rounded-md border border-slate-200 bg-slate-50 p-2 text-left">
                            <p className="text-[11px] font-semibold text-slate-700">Histórico comercial</p>

                            {history.map((cmd, idx) => {
                              const data = Array.isArray(cmd.resultData) ? cmd.resultData[0] : null;
                              const info = data && typeof data === "object" ? (data as Record<string, unknown>) : null;

                              return (
                                <div key={`${cmd._id || idx}`} className="rounded border border-slate-200 bg-white p-2 text-[10px]">
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="font-semibold text-slate-800">{cmd.kind || "COMMAND"}</span>
                                    <Badge variant={cmd.status === "done" ? "success" : cmd.status === "failed" ? "error" : "warning"}>
                                      {cmd.status || "pending"}
                                    </Badge>
                                  </div>

                                  <div className="mt-1 text-slate-600">
                                    {cmd.completedAt ? formatPtDate(cmd.completedAt) : "Em execução"}
                                  </div>

                                  {info ? (
                                    <div className="mt-2 grid grid-cols-2 gap-2 text-slate-700">
                                      <div>CPU: {String(info["cpu-load"] || "—")}%</div>
                                      <div>RAM livre: {String(info["free-memory"] || "—")}</div>
                                      <div className="col-span-2">Versão: {String(info.version || "—")}</div>
                                      <div className="col-span-2">Uptime: {String(info.uptime || "—")}</div>
                                    </div>
                                  ) : null}
                                </div>
                              );
                            })}
                          </div>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={tokenModalOpen} onOpenChange={setTokenModalOpen} title="Nova chave de acesso da unidade" description="Copie agora. O valor não reaparece." className="max-w-lg">
        <div className="space-y-3">
          <pre className="break-all rounded-lg border border-slate-200 bg-slate-950 p-3 text-left text-xs text-emerald-100">
            {newToken || "—"}
          </pre>

          <Button
            type="button"
            size="sm"
            onClick={async () => {
              if (!newToken) return;
              try {
                await navigator.clipboard.writeText(newToken);
              } catch {
                //
              }
            }}
          >
            Copiar
          </Button>
        </div>
      </Modal>
    </div>
  );
}
