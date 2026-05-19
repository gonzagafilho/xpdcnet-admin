"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { userFacingApiError } from "@/lib/user-facing-api-error";
import type { ClientTimelineFromApi } from "@/lib/api-types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function ClienteTimelinePage() {
  const params = useParams<{ id: string }>();
  const clientId = String(params?.id || "");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ClientTimelineFromApi | null>(null);

  const load = useCallback(async () => {
    if (!clientId) return;
    setError(null);
    const payload = await apiFetch<ClientTimelineFromApi>(`/operations/client/${clientId}/timeline`);
    setData(payload);
  }, [clientId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await load();
      } catch (e) {
        if (!cancelled) setError(userFacingApiError(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-neutral-900">Timeline operacional do cliente</h1>
          <p className="text-sm text-neutral-600">Sequência de eventos financeiros, fila, worker e estado de execução.</p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={() => void load()} disabled={loading}>Atualizar</Button>
          <Button type="button" asChild>
            <Link href="/clientes">Voltar clientes</Link>
          </Button>
        </div>
      </div>

      {error ? <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p> : null}

      {data ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{data.client.fullName} ({data.client.status})</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
              <p>Diagnóstico: <span className="font-semibold">{data.snapshot.financeDiagnosis}</span></p>
              <p>Elegível bloqueio: <span className="font-semibold">{data.snapshot.eligibleForDelinquent ? "Sim" : "Não"}</span></p>
              <p>Elegível reativação: <span className="font-semibold">{data.snapshot.wouldReactivateWhenClear ? "Sim" : "Não"}</span></p>
              <p>Sync state: <span className="font-semibold">{data.snapshot.syncState}</span></p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Eventos ({data.totals.events})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.events.map((e, idx) => (
                <div key={`${e.type}-${e.at}-${idx}`} className="rounded border border-neutral-200 px-3 py-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-neutral-900">{e.title}</p>
                    <p className="text-xs text-neutral-500">{new Date(e.at).toLocaleString("pt-BR")}</p>
                  </div>
                  <p className="text-xs text-neutral-600">{e.type}</p>
                  <p className="text-sm text-neutral-700">{e.detail}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      ) : null}

      {!data && loading ? <p className="text-sm text-neutral-500">A carregar timeline...</p> : null}
    </div>
  );
}
