"use client";

import Link from "next/link";
import { BarChart3 } from "lucide-react";

const relatorioCards = [
  {
    id: "anual",
    title: "Anual comparativo",
    description:
      "Comparativo de receitas, inadimplência ou carteira entre anos. Depende de agregações que ainda não estão expostas como relatório único.",
    href: "/relatorios/anual-comparativo",
    hint: "Sem dados no momento",
  },
  {
    id: "export",
    title: "Exportações",
    description:
      "CSV/PDF em lote. Sem serviço de exportação dedicado, não simulamos ficheiros nem contagens.",
    href: null as string | null,
    hint: "Em breve",
  },
  {
    id: "auditoria",
    title: "Trilho de auditoria",
    description: "Histórico ainda indisponível.",
    href: null as string | null,
    hint: "Serviço indisponível",
  },
] as const;

export function RelatoriosView() {
  return (
    <div className="mx-auto w-full max-w-[90rem] space-y-5 pb-2">
      <div className="border border-neutral-200 bg-white px-4 py-4 sm:px-5">
        <div className="border-b border-neutral-100 pb-4">
          <h2 className="text-base font-bold tracking-tight text-neutral-900">Relatórios</h2>
          <p className="mt-1 max-w-3xl text-sm text-neutral-600">
            Hub de indicadores e exportações. Cada bloco descreve o que falta em termos de backend — sem gráficos nem
            números de exemplo.
          </p>
        </div>
        <p className="pt-3 text-xs text-neutral-500">
          Dados operacionais parciais já aparecem no <Link className="font-medium text-emerald-800 underline-offset-2 hover:underline" href="/dashboard">dashboard</Link> e no{" "}
          <Link className="font-medium text-emerald-800 underline-offset-2 hover:underline" href="/financeiro">financeiro</Link>.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {relatorioCards.map((card) => (
          <div
            key={card.id}
            className="flex min-h-[11rem] flex-col border border-neutral-200 bg-white p-6 shadow-sm"
          >
            <div className="flex items-start gap-3">
              <BarChart3 className="mt-0.5 h-5 w-5 shrink-0 text-neutral-400" aria-hidden />
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-bold text-neutral-900">{card.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-neutral-600">{card.description}</p>
              </div>
            </div>
            <div className="mt-auto pt-5">
              {card.href ? (
                <Link
                  href={card.href}
                  className="text-sm font-semibold text-emerald-800 underline-offset-2 hover:underline"
                >
                  Abrir área
                </Link>
              ) : (
                <span className="text-xs font-medium text-neutral-400">{card.hint}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
