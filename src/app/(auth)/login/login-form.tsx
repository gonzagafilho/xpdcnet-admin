"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { setSessionToken } from "@/lib/api-client";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get("from") || "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = (await res.json()) as {
        message?: string;
        code?: string;
        token?: string;
        ok?: boolean;
        admin?: unknown;
      };
      if (!res.ok) {
        if (data.code === "DATABASE_UNAVAILABLE") {
          setError("Sistema temporariamente indisponível (banco de dados).");
        } else if (data.code === "NETWORK_ERROR") {
          setError(data.message || "Não foi possível entrar agora.");
        } else {
          setError(data.message || "Falha no login.");
        }
        return;
      }
      if (!data.token) {
        setError("Resposta do servidor sem token.");
        return;
      }
      setSessionToken(data.token);
      router.push(from.startsWith("/") ? from : "/dashboard");
      router.refresh();
    } catch {
      setError("Não foi possível contactar o servidor. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="w-full max-w-md border-dcnet-border bg-white shadow-lg">
      <CardHeader>
        <CardTitle>Entrar</CardTitle>
        <CardDescription>Use suas credenciais corporativas.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Senha</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {error ? (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          ) : null}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Entrando…" : "Entrar"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
