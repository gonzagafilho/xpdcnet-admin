import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AUTH_COOKIE } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const jar = await cookies();
  const token = jar.get(AUTH_COOKIE)?.value;
  redirect(token ? "/dashboard" : "/login");
}
