"use client";

import Link from "next/link";
import { Bell, LogOut, Menu, Search, Settings, User } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { clearSessionToken } from "@/lib/api-client";
import { cn } from "@/lib/cn";
import { useShell } from "./shell-context";

type TopbarProps = {
  title: string;
  subtitle?: string;
};

export function Topbar({ title, subtitle }: TopbarProps) {
  const router = useRouter();
  const { toggleMobileNav } = useShell();

  async function handleLogout() {
    clearSessionToken();
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <header
      className={cn(
        "sticky top-8 z-30 flex min-h-[3.5rem] shrink-0 flex-wrap items-center gap-3 border-b border-dcnet-border/70 bg-dcnet-topbar px-4 py-2.5 shadow-xp-nav backdrop-blur-sm sm:px-6 lg:px-8",
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="shrink-0 lg:hidden"
          aria-label="Abrir menu"
          onClick={toggleMobileNav}
        >
          <Menu className="h-5 w-5 text-slate-700" />
        </Button>
        <div className="min-w-0 pr-2">
          <h1 className="truncate text-lg font-semibold tracking-tight text-slate-900">{title}</h1>
          {subtitle ? <p className="mt-0.5 truncate text-xs text-slate-500">{subtitle}</p> : null}
        </div>
      </div>

      <div className="flex w-full shrink-0 flex-wrap items-center justify-end gap-2 sm:w-auto sm:gap-3">
        <label className="relative flex min-w-0 flex-1 basis-full sm:basis-auto sm:max-w-xs">
          <span className="sr-only">Buscar</span>
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-dcnet-accent"
            aria-hidden
          />
          <input
            type="search"
            readOnly
            placeholder="Buscar…"
            className="h-9 w-full rounded-lg border border-dcnet-border bg-dcnet-soft pl-8 pr-3 text-sm text-slate-700 shadow-sm placeholder:text-dcnet-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dcnet-accent"
            title="Busca em desenvolvimento"
          />
        </label>

        <Button
          type="button"
          variant="outline"
          size="icon"
          className="hidden border-dcnet-border sm:inline-flex"
          aria-label="Notificações"
          title="Notificações em breve"
          disabled
        >
          <Bell className="h-4 w-4 text-dcnet-accent" />
        </Button>

        <Button type="button" variant="outline" size="icon" className="border-slate-200" asChild>
          <Link href="/configuracoes" aria-label="Configurações">
            <Settings className="h-4 w-4 text-slate-600" />
          </Link>
        </Button>

        <Button
          type="button"
          size="sm"
          className="border-0 bg-dcnet-accent font-semibold text-white hover:bg-dcnet-accent-dark"
          asChild
        >
          <Link href="/clientes">Clientes</Link>
        </Button>

        <span className="hidden items-center gap-2 text-sm text-slate-500 lg:inline-flex">
          <User className="h-4 w-4 text-slate-400" aria-hidden />
          <span className="text-slate-600">Operador</span>
        </span>

        <Button type="button" variant="outline" size="sm" onClick={() => void handleLogout()}>
          <LogOut className="h-4 w-4" />
          Sair
        </Button>
      </div>
    </header>
  );
}
