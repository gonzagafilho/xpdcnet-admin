import { Suspense } from "react";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-100 px-4">
      <div className="mb-8 text-center">
        <p className="text-lg font-semibold tracking-tight text-zinc-900">DCNET</p>
        <p className="text-sm text-zinc-500">Painel operacional interno</p>
      </div>
      <Suspense
        fallback={
          <div className="h-64 w-full max-w-md animate-pulse rounded-lg border border-zinc-200 bg-white" />
        }
      >
        <LoginForm />
      </Suspense>
      <p className="mt-8 text-center text-xs text-zinc-400">Acesso restrito. Em caso de dúvida, contate a TI.</p>
    </div>
  );
}
