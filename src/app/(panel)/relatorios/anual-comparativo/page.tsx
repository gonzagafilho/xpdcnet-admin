import Link from "next/link";
import { BarChart3 } from "lucide-react";

export default function RelatorioAnualComparativoPage() {
  return (
    <div className="mx-auto w-full max-w-[90rem] space-y-5 pb-2">
      <div className="border border-neutral-200 bg-white px-4 py-4 sm:px-5">
        <div className="flex flex-col gap-3 border-b border-neutral-100 pb-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <h2 className="text-base font-bold tracking-tight text-neutral-900">Relatório anual comparativo</h2>
            <p className="mt-1 max-w-3xl text-sm text-neutral-600">
              Área reservada para tabelas ou gráficos ano a ano quando o backend fornecer série histórica consolidada.
              Não utilizamos valores fictícios: até lá, apenas esta mensagem e a estrutura de página.
            </p>
          </div>
          <Link
            href="/relatorios"
            className="shrink-0 text-sm font-semibold text-emerald-800 underline-offset-2 hover:underline"
          >
            Voltar aos relatórios
          </Link>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="min-h-[14rem] border border-neutral-200 bg-white p-6">
          <h3 className="text-sm font-bold uppercase tracking-wide text-neutral-500">Receita por ano</h3>
          <div className="mt-8 flex flex-col items-center justify-center gap-2 text-center">
            <BarChart3 className="h-10 w-10 text-neutral-200" aria-hidden />
            <p className="text-sm text-neutral-500">Sem endpoint de agregação anual · nada a desenhar.</p>
          </div>
        </section>
        <section className="min-h-[14rem] border border-neutral-200 bg-white p-6">
          <h3 className="text-sm font-bold uppercase tracking-wide text-neutral-500">Carteira / churn</h3>
          <div className="mt-8 flex flex-col items-center justify-center gap-2 text-center">
            <BarChart3 className="h-10 w-10 text-neutral-200" aria-hidden />
            <p className="text-sm text-neutral-500">
              Histórico de ativações/cancelamentos por ano não está disponível no contrato atual de{" "}
              <span className="font-mono text-xs">/clients</span>.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
