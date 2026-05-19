"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { ClientStatus } from "@/lib/api-types";
import { formatBRL } from "@/lib/api-types";
import {
  DELINQUENCY_NO_AUTO_BLOCK,
  DELINQUENCY_NO_AUTO_STATUS,
  DELINQUENCY_RULE_SOURCE_NOTE,
  delinquencyRecommendation,
  type ClientOverdueRollup,
} from "@/lib/client-overdue-invoices";
import { clientStatusLabelPt } from "@/lib/client-status";

export type ClientDelinquencyRulerPanelProps = {
  variant: "table" | "modal";
  rollup: ClientOverdueRollup;
  clientStatus: ClientStatus;
  onMarkDelinquent?: () => void;
  /** Só quando `clientStatus === "delinquent"` — abre confirmação no pai antes de PUT blocked. */
  onBlockClient?: () => void;
  actionDisabled?: boolean;
};

function formatDueShort(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function ClientDelinquencyRulerPanel({
  variant,
  rollup,
  clientStatus,
  onMarkDelinquent,
  onBlockClient,
  actionDisabled,
}: ClientDelinquencyRulerPanelProps) {
  const rec = delinquencyRecommendation(clientStatus, rollup);
  const isDelinquent = clientStatus === "delinquent";
  const isBlocked = clientStatus === "blocked";
  const compact = variant === "table";

  return (
    <div
      className={
        compact
          ? "mt-2 max-w-md rounded-lg border border-amber-400/90 bg-amber-50 px-2.5 py-2 shadow-sm"
          : "rounded-lg border-2 border-amber-500/35 bg-gradient-to-b from-amber-50 to-white px-3 py-3 shadow-sm"
      }
    >
      {isBlocked ? (
        <div className="mb-2 rounded-md border border-red-300/90 bg-red-50 px-2 py-1.5 text-[0.7rem] font-semibold leading-snug text-red-950">
          Cliente bloqueado — apenas cadastro; sem corte técnico nem MikroTik nesta fase.
        </div>
      ) : null}
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-[0.7rem] font-bold uppercase tracking-wide text-amber-950">Régua de inadimplência</p>
        <span className="rounded bg-white/80 px-1.5 py-0.5 text-[0.65rem] font-medium text-amber-900 ring-1 ring-amber-200">
          Estado: {clientStatusLabelPt(clientStatus)}
        </span>
      </div>

      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs tabular-nums text-amber-950">
        <span>
          <span className="font-semibold">{rollup.count}</span> fatura(s) overdue
        </span>
        <span>
          Total: <span className="font-semibold">{formatBRL(rollup.totalAmount)}</span>
        </span>
      </div>

      {rollup.lines.length > 0 ? (
        <div className={compact ? "mt-1.5" : "mt-2"}>
          <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-amber-900/80">
            Resumo (vencimento ↓)
          </p>
          <ul className="mt-1 space-y-0.5 text-[0.65rem] text-amber-950/95">
            {rollup.lines.map((line, i) => (
              <li key={`${line.competence}-${line.dueDate}-${i}`} className="flex flex-wrap justify-between gap-x-2 border-b border-amber-200/50 py-0.5 last:border-0">
                <span>
                  Competência <span className="font-mono">{line.competence}</span> · venc. {formatDueShort(line.dueDate)}
                </span>
                <span className="font-medium tabular-nums">{formatBRL(line.amount)}</span>
              </li>
            ))}
            {rollup.count > rollup.lines.length ? (
              <li className="pt-1 text-[0.6rem] italic text-amber-800/90">
                +{rollup.count - rollup.lines.length} outra(s) — ver detalhe no financeiro
              </li>
            ) : null}
          </ul>
          <Link
            href="/financeiro"
            className="mt-1.5 inline-block text-[0.65rem] font-semibold text-amber-900 underline underline-offset-2 hover:text-amber-950"
          >
            Abrir financeiro
          </Link>
        </div>
      ) : null}

      {rec.headline ? (
        <div className={compact ? "mt-2 border-t border-amber-200/80 pt-2" : "mt-3 border-t border-amber-200 pt-2"}>
          <p className="text-[0.7rem] font-semibold text-amber-950">{rec.headline}</p>
          <p className="mt-1 text-[0.65rem] leading-relaxed text-amber-900/90">{rec.detail}</p>
        </div>
      ) : null}

      {compact ? (
        <p className="mt-2 text-[0.6rem] leading-relaxed text-amber-900/85">
          {DELINQUENCY_RULE_SOURCE_NOTE} {DELINQUENCY_NO_AUTO_STATUS} Sem bloqueio automático.
        </p>
      ) : (
        <>
          <p className="mt-2 text-[0.6rem] leading-relaxed text-amber-900/80">{DELINQUENCY_RULE_SOURCE_NOTE}</p>
          <p className="mt-1 text-[0.6rem] leading-relaxed text-amber-900/80">{DELINQUENCY_NO_AUTO_STATUS}</p>
          <p className="mt-1 text-[0.6rem] leading-relaxed text-amber-900/80">{DELINQUENCY_NO_AUTO_BLOCK}</p>
        </>
      )}

      {!isDelinquent && !isBlocked && onMarkDelinquent ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="mt-2 h-8 border-amber-500 bg-white text-xs font-semibold text-amber-950 hover:bg-amber-100"
          disabled={actionDisabled}
          onClick={onMarkDelinquent}
        >
          Marcar como inadimplente
        </Button>
      ) : isDelinquent ? (
        <div className="mt-2 space-y-2">
          <p className="rounded border border-emerald-200 bg-emerald-50/90 px-2 py-1.5 text-[0.65rem] font-medium text-emerald-950">
            Estado «Inadimplente» no cadastro. Pode bloquear abaixo após decisão interna — não é automático.
          </p>
          {onBlockClient ? (
            <Button
              type="button"
              size="sm"
              variant="destructive"
              className="h-8 text-xs font-semibold"
              disabled={actionDisabled}
              onClick={onBlockClient}
            >
              Bloquear cliente
            </Button>
          ) : null}
        </div>
      ) : null}

      {compact ? (
        <p className="mt-2 border-t border-dashed border-amber-200/80 pt-2 text-[0.55rem] text-neutral-600">
          Bloqueio manual disponível quando inadimplente. Em breve: liberação e MikroTik.
        </p>
      ) : (
        <div className="mt-3 border-t border-dashed border-amber-300/70 pt-2">
          <p className="text-[0.6rem] font-semibold uppercase tracking-wide text-neutral-600">Futuro (sem ação)</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <Button type="button" variant="outline" size="sm" disabled className="h-7 cursor-not-allowed text-[0.6rem] text-neutral-500">
              Liberar cliente
            </Button>
            <Button type="button" variant="outline" size="sm" disabled className="h-7 cursor-not-allowed text-[0.6rem] text-neutral-500">
              Sincronizar com MikroTik
            </Button>
          </div>
          <p className="mt-1 text-[0.55rem] text-neutral-500">Liberação e rede: fases futuras — sem integração nesta versão.</p>
        </div>
      )}
    </div>
  );
}
