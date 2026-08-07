import { SignJWT, jwtVerify } from "jose";

export const AUTH_COOKIE = "inspiralab_session";

export type SessionRole = "admin" | "member";

export type AdminModule = "sitio" | "tareas" | "contabilidad";

export type SessionPayload = {
  role: SessionRole;
  memberId?: string;
  name?: string;
  email?: string;
};

function getSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET is not configured");
  }
  return new TextEncoder().encode(secret);
}

export function getAdminPassword() {
  return process.env.ADMIN_PASSWORD || "inspiralab.administracion";
}

export function getMemberPassword() {
  return process.env.MEMBER_PASSWORD || "inspiralab.actividades";
}

export function modulesForRole(role: SessionRole): AdminModule[] {
  if (role === "admin") return ["sitio", "tareas", "contabilidad"];
  return ["sitio", "tareas"];
}

export function canAccessModule(role: SessionRole, module: AdminModule) {
  return modulesForRole(role).includes(module);
}

export function canAccessAdminPath(role: SessionRole, pathname: string) {
  if (pathname.startsWith("/admin/contabilidad")) {
    return canAccessModule(role, "contabilidad");
  }
  return true;
}

export async function createSessionToken(payload: SessionPayload) {
  return new SignJWT({
    role: payload.role,
    memberId: payload.memberId || "",
    name: payload.name || "",
    email: payload.email || "",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getSecret());
}

export async function readSessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    const role = payload.role;
    if (role !== "admin" && role !== "member") return null;
    return {
      role,
      memberId: typeof payload.memberId === "string" && payload.memberId ? payload.memberId : undefined,
      name: typeof payload.name === "string" && payload.name ? payload.name : undefined,
      email: typeof payload.email === "string" && payload.email ? payload.email : undefined,
    };
  } catch {
    return null;
  }
}

/** @deprecated Prefer readSessionToken; kept for simple boolean checks. */
export async function verifySessionToken(token: string) {
  return Boolean(await readSessionToken(token));
}
