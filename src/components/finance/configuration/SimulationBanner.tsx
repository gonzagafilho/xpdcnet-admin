import { AlertTriangle } from "lucide-react";

export function SimulationBanner() {
  return (
    <div className="sticky top-3 z-20 rounded-2xl border border-amber-200 bg-amber-50/95 px-5 py-4 shadow-sm backdrop-blur">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.12em] text-amber-900">Modo simulação ativo</p>
          <p className="mt-1 text-sm leading-relaxed text-amber-950/90">
            As configurações estão sendo preparadas, mas nenhuma suspensão, reativação, cobrança ou mensagem automática será executada.
          </p>
        </div>
      </div>
    </div>
  );
}