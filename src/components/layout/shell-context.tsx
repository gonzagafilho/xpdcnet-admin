"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

type ShellContextValue = {
  mobileNavOpen: boolean;
  setMobileNavOpen: (open: boolean) => void;
  toggleMobileNav: () => void;
};

const ShellContext = createContext<ShellContextValue | null>(null);

export function ShellProvider({ children }: { children: ReactNode }) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const toggleMobileNav = useCallback(() => setMobileNavOpen((o) => !o), []);

  return (
    <ShellContext.Provider value={{ mobileNavOpen, setMobileNavOpen, toggleMobileNav }}>
      {children}
    </ShellContext.Provider>
  );
}

export function useShell() {
  const ctx = useContext(ShellContext);
  if (!ctx) throw new Error("useShell deve ser usado dentro de ShellProvider");
  return ctx;
}
