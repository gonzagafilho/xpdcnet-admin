"use client";

import { useEffect, useState } from "react";
import { isCurrentPanelUserAdmin } from "@/lib/panel-auth";

/**
 * Após hidratar o token via `/api/auth/session`, o role pode ficar disponível com atraso.
 * Reavalia durante alguns segundos para não esconder UI de admin de forma incorrecta.
 */
export function usePanelIsAdmin(): boolean {
  const [v, setV] = useState(false);

  useEffect(() => {
    const tick = () => setV(isCurrentPanelUserAdmin());
    tick();
    const id = window.setInterval(tick, 200);
    const stop = window.setTimeout(() => window.clearInterval(id), 4000);
    return () => {
      window.clearInterval(id);
      window.clearTimeout(stop);
    };
  }, []);

  return v;
}
