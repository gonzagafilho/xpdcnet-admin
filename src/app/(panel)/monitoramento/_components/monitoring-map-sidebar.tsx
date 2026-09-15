"use client";

import Link from "next/link";
import { MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { MonitoringSessionBoardServerBlockFromApi, MonitoringMapMarker } from "@/lib/api-types";
import { MonitoringClientStatusBadge } from "./monitoring-client-status-badge";
import { MonitoringServerChips } from "./monitoring-server-chips";

type Chip = { id: string; name: string; online?: boolean };

type Props = {
  chips: Chip[];
  serverId: string | null;
  onServerChange: (id: string | null) => void;
  visibleBlocks: MonitoringSessionBoardServerBlockFromApi[];
  markers: MonitoringMapMarker[];
  search: string;
  onSearchChange: (v: string) => void;
};

export function MonitoringMapSidebar({
  chips,
  serverId,
  onServerChange,
  visibleBlocks,
  markers,
  search,
  onSearchChange,
}: Props) {
  return (
    <div className="flex flex-col gap-4">
      {chips.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Servidor</p>
          <MonitoringServerChips servers={chips} value={serverId} onChange={onServerChange} />
        </div>
      ) : null}

      <Card className="border-slate-200/95 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Legenda</CardTitle>
          <CardDescription className="text-xs">Estado da conexão na última leitura.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4 text-xs">
          <div className="flex items-center gap-2">
            <span className="inline-block h-3 w-3 rounded-full border-2 border-white bg-emerald-600 shadow ring-1 ring-slate-200" />
            <span className="text-slate-700">Conexões ativas</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block h-3 w-3 rounded-full border-2 border-white bg-rose-600 shadow ring-1 ring-slate-200" />
            <span className="text-slate-700">Sem conexão no momento</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Busca</CardTitle>
          <CardDescription className="text-xs">Filtra lista e pins por nome ou login.</CardDescription>
        </CardHeader>
        <CardContent>
          <input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Cliente ou login…"
            className="flex h-9 w-full max-w-md rounded-lg border border-slate-200 bg-white px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
          />
        </CardContent>
      </Card>

      <div className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Resumo por servidor</h2>
        {visibleBlocks.length === 0 ? (
          <p className="text-sm text-slate-500">Sem dados.</p>
        ) : (
          visibleBlocks.map((b) => {
            const highlight = serverId != null && serverId === b.server.id;
            return (
              <Card
                key={b.server.id}
                className={
                  highlight
                    ? "border-sky-300/90 bg-gradient-to-br from-sky-50/90 to-white shadow-md ring-2 ring-sky-200/80"
                    : "border-slate-200/95 shadow-sm"
                }
              >
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold text-slate-900">{b.server.name}</CardTitle>
                  <CardDescription className="text-xs">
                    {b.server.online ? (
                      <span className="text-emerald-700">Equipamento conectado</span>
                    ) : (
                      <span className="text-rose-700">Equipamento sem conexão</span>
                    )}
                    {b.server.uptime ? <span className="ml-2 text-slate-500">· tempo conectado {b.server.uptime}</span> : null}
                  </CardDescription>
                  {b.server.board || b.server.version ? (
                    <p className="mt-1 text-[11px] leading-snug text-slate-600">
                      {b.server.board ? <span>{b.server.board}</span> : null}
                      {b.server.board && b.server.version ? <span className="text-slate-400"> · </span> : null}
                      {b.server.version ? <span className="font-mono text-slate-600">ROS {b.server.version}</span> : null}
                    </p>
                  ) : null}
                </CardHeader>
                <CardContent className="space-y-1.5 text-xs text-slate-700">
                  <div className="flex justify-between border-b border-slate-100 py-1">
                    <span>Clientes cadastrados</span>
                    <span className="font-semibold tabular-nums">{b.summary.totalClients}</span>
                  </div>
                  <div className="flex justify-between py-0.5">
                    <span className="text-emerald-800">Activos (cadastro)</span>
                    <span className="font-semibold tabular-nums text-emerald-800">{b.summary.cadastroActive}</span>
                  </div>
                  <div className="flex justify-between py-0.5">
                    <span>Pendentes</span>
                    <span className="font-semibold tabular-nums">{b.summary.cadastroPending}</span>
                  </div>
                  <div className="flex justify-between py-0.5">
                    <span className="text-rose-800">Bloqueados / suspensos</span>
                    <span className="font-semibold tabular-nums text-rose-800">{b.summary.cadastroBloqueadosOuSimilares}</span>
                  </div>
                  <div className="flex justify-between border-t border-slate-100 py-1">
                    <span className="text-emerald-800">Conexões ativas</span>
                    <span className="font-semibold tabular-nums text-emerald-800">{b.summary.pppOnline}</span>
                  </div>
                  <div className="flex justify-between py-0.5">
                    <span className="text-rose-800">Sem conexão (vista)</span>
                    <span className="font-semibold tabular-nums text-rose-800">{b.summary.pppSemSessao}</span>
                  </div>
                  <div className="flex justify-between py-0.5">
                    <span>Conexões no equipamento</span>
                    <span className="font-semibold tabular-nums">{b.summary.pppActiveTotalRouter}</span>
                  </div>
                  <div className="flex justify-between py-0.5">
                    <span>Uso do servidor</span>
                    <span className="font-semibold tabular-nums">
                      {b.server.cpuPercent != null ? `${Math.round(b.server.cpuPercent)}%` : "—"}
                    </span>
                  </div>
                  <div className="flex justify-between py-0.5">
                    <span>Memória</span>
                    <span className="font-semibold tabular-nums">
                      {b.server.memoryTotalBytes != null && b.server.memoryFreeBytes != null
                        ? `${Math.round(((b.server.memoryTotalBytes - b.server.memoryFreeBytes) / b.server.memoryTotalBytes) * 100)}% uso`
                        : "—"}
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      <Card className="border-slate-200/95 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Marcadores ({markers.length})</CardTitle>
          <CardDescription className="text-xs">Lista sincronizada com o mapa.</CardDescription>
        </CardHeader>
        <CardContent className="max-h-56 space-y-2 overflow-y-auto text-xs">
          {markers.length === 0 ? (
            <p className="flex items-center gap-2 text-slate-500">
              <MapPin className="h-4 w-4 shrink-0 opacity-60" aria-hidden />
              Nenhum cliente com geo na selecção.
            </p>
          ) : (
            markers.map((m) => (
              <div
                key={`${m.row.clientId}-${m.serverName}`}
                className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-50 py-2 last:border-0"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-slate-900">{m.row.fullName}</p>
                  <p className="font-mono text-[10px] text-slate-500">
                    {m.lat.toFixed(5)}, {m.lng.toFixed(5)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <MonitoringClientStatusBadge pppStatus={m.row.pppStatus} />
                  <Button asChild variant="outline" size="sm" className="h-7 text-[10px]">
                    <Link href={`/monitoramento/clientes-on-off/${encodeURIComponent(m.row.clientId)}?from=map`}>Ficha</Link>
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
