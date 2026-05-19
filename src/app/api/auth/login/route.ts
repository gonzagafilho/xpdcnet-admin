import { NextResponse } from "next/server";
import { AUTH_COOKIE, AUTH_MAX_AGE } from "@/lib/constants";

function apiBase(): string {
  const u = process.env.API_URL?.trim() || process.env.NEXT_PUBLIC_API_URL?.trim();
  if (!u) throw new Error("Defina API_URL ou NEXT_PUBLIC_API_URL");
  return u.replace(/\/$/, "");
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { email?: string; password?: string };
    const email = body.email?.trim();
    const password = body.password;
    if (!email || !password) {
      return NextResponse.json({ message: "E-mail e senha são obrigatórios." }, { status: 400 });
    }

    const controller = new AbortController();
    const loginTimeoutMs = 25_000;
    const t = setTimeout(() => controller.abort(), loginTimeoutMs);
    let upstream: Response;
    try {
      upstream = await fetch(`${apiBase()}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, senha: password }),
        signal: controller.signal,
      });
    } catch {
      clearTimeout(t);
      return NextResponse.json(
        {
          message: "Não foi possível contactar a API. Verifique se o backend está disponível.",
          code: "NETWORK_ERROR",
        },
        { status: 503 },
      );
    }
    clearTimeout(t);

    const data = await upstream.json().catch(() => ({}));

    if (!upstream.ok) {
      const d = data as { message?: string; code?: string };
      const body: { message: string; code?: string } = {
        message: d.message || "Falha no login.",
      };
      if (d.code) body.code = d.code;
      return NextResponse.json(body, { status: upstream.status });
    }

    const token = (data as { token?: string }).token;
    const admin = (data as { admin?: unknown }).admin;
    if (!token) {
      return NextResponse.json({ message: "Resposta inválida da API." }, { status: 502 });
    }

    const res = NextResponse.json({ ok: true, token, admin });
    res.cookies.set(AUTH_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: AUTH_MAX_AGE,
    });
    return res;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ message: msg }, { status: 500 });
  }
}
