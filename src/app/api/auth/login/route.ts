import { NextResponse } from "next/server";
import {
  AUTH_COOKIE,
  createSessionToken,
  modulesForRole,
} from "@/lib/auth/session";
import { resolveRoleByPassword } from "@/lib/auth/credentials";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | { password?: string }
    | null;

  const password = body?.password?.trim() || "";
  if (!password) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const role = await resolveRoleByPassword(password);
  if (!role) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const name = role === "admin" ? "Administrador" : "Equipo";
  const token = await createSessionToken({ role, name });
  const response = NextResponse.json({
    ok: true,
    role,
    modules: modulesForRole(role),
    name,
  });
  response.cookies.set(AUTH_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return response;
}
