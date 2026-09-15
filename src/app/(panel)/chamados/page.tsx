import { Suspense } from "react";
import { ChamadosView } from "./chamados-view";

export default function ChamadosPage() {
  return (
    <Suspense
      fallback={
        <div className="border border-neutral-200 bg-white px-4 py-16 text-center text-sm text-neutral-500">
          A carregar…
        </div>
      }
    >
      <ChamadosView />
    </Suspense>
  );
}
