"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { ShellProvider, useShell } from "./shell-context";

type AppShellProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
};

const systemMode = process.env.NEXT_PUBLIC_SYSTEM_MODE?.trim().toLowerCase();

function AppShellInner({ title, subtitle, children }: AppShellProps) {
  const maintenance = systemMode === "maintenance";
  const { mobileNavOpen, setMobileNavOpen } = useShell();

  return (
    <div className="min-h-screen bg-dcnet-background">
      <div
        className="fixed inset-x-0 top-0 z-[60] h-8 bg-[#020617] shadow-sm"
        aria-hidden
      />

      {mobileNavOpen ? (
        <button
          type="button"
          aria-label="Fechar menu"
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={() => setMobileNavOpen(false)}
        />
      ) : null}

      <Sidebar />

      <div className={cn("min-h-screen pt-8 lg:pl-[17.5rem]")}>
        {maintenance ? (
          <div
            className="border-b border-amber-200 bg-amber-50 px-6 py-2 text-center text-sm text-amber-950"
            role="status"
          >
            Modo manutenção: algumas funções podem estar limitadas até conclusão dos trabalhos.
          </div>
        ) : null}

        <Topbar title={title} subtitle={subtitle} />
        <main className="px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-7">
          <div className="mx-auto w-full max-w-[min(100%,80rem)]">{children}</div>
        </main>
      </div>
    </div>
  );
}

export function AppShell(props: AppShellProps) {
  return (
    <ShellProvider>
      <AppShellInner {...props} />
    </ShellProvider>
  );
}
