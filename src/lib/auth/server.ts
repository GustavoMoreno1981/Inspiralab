import { cookies } from "next/headers";
import {
  AUTH_COOKIE,
  canAccessModule,
  readSessionToken,
  type AdminModule,
  type SessionPayload,
} from "./session";

export async function getSession(): Promise<SessionPayload | null> {
  const jar = await cookies();
  const token = jar.get(AUTH_COOKIE)?.value;
  if (!token) return null;
  return readSessionToken(token);
}

export async function isAuthenticated() {
  return Boolean(await getSession());
}

export async function requireSession() {
  const session = await getSession();
  if (!session) return null;
  return session;
}

export async function requireModule(module: AdminModule) {
  const session = await getSession();
  if (!session) return null;
  if (!canAccessModule(session.role, module)) return null;
  return session;
}

export async function requireAdmin() {
  const session = await getSession();
  if (!session || session.role !== "admin") return null;
  return session;
}
