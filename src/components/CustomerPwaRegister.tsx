"use client";

import { useEffect } from "react";

export function CustomerPwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (!window.location.pathname.startsWith("/cliente")) return;

    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => undefined);
    });
  }, []);

  return null;
}
