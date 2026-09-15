import { Suspense } from "react";
import { LoginForm } from "./login-form";
import { BrandLogo } from "@/components/BrandLogo";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-dcnet-soft px-4">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 h-20 w-20 rounded-3xl bg-white/90 p-3 shadow-md">
          <BrandLogo width={72} height={72} className="h-full w-full object-contain" />
        </div>
        <p className="text-lg font-semibold tracking-tight text-dcnet-900">DCNET</p>
        <p className="text-sm text-dcnet-secondary">Painel operacional interno</p>
      </div>
      <Suspense
        fallback={
          <div className="h-64 w-full max-w-md animate-pulse rounded-lg border border-dcnet-border bg-white" />
        }
      >
        <LoginForm />
      </Suspense>
      <p className="mt-8 text-center text-xs text-zinc-400">Acesso restrito. Em caso de dúvida, contate a TI.</p>
    </div>
  );
}
