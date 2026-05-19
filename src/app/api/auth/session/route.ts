import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { AUTH_COOKIE } from "@/lib/constants";

/**
 * Expõe o JWT ao cliente quando já existe cookie httpOnly (ex.: novo separador).
 * Mesmo nível de exposição que o body do POST /api/auth/login.
 */
export async function GET() {
  const jar = await cookies();
  const token = jar.get(AUTH_COOKIE)?.value;
  if (!token) {
    return NextResponse.json({ message: "Não autenticado." }, { status: 401 });
  }
  return NextResponse.json({ token });
}
