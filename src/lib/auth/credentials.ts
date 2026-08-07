import { promises as fs } from "fs";
import path from "path";

export type AuthCredentials = {
  adminPassword: string;
  memberPassword: string;
  updatedAt: string;
};

const DATA_DIR = path.join(process.cwd(), "data");
const AUTH_PATH = path.join(DATA_DIR, "auth.json");

export const DEFAULT_CREDENTIALS: AuthCredentials = {
  adminPassword: "inspiralab.administracion",
  memberPassword: "inspiralab.actividades",
  updatedAt: "",
};

function normalize(data: Partial<AuthCredentials> | null): AuthCredentials {
  const adminPassword =
    (typeof data?.adminPassword === "string" && data.adminPassword.trim()) ||
    process.env.ADMIN_PASSWORD ||
    DEFAULT_CREDENTIALS.adminPassword;
  const memberPassword =
    (typeof data?.memberPassword === "string" && data.memberPassword.trim()) ||
    process.env.MEMBER_PASSWORD ||
    DEFAULT_CREDENTIALS.memberPassword;

  return {
    adminPassword,
    memberPassword,
    updatedAt: data?.updatedAt || "",
  };
}

export async function readCredentials(): Promise<AuthCredentials> {
  try {
    const raw = await fs.readFile(AUTH_PATH, "utf8");
    return normalize(JSON.parse(raw) as Partial<AuthCredentials>);
  } catch {
    return normalize(null);
  }
}

export async function writeCredentials(input: {
  adminPassword?: string;
  memberPassword?: string;
}): Promise<AuthCredentials> {
  const current = await readCredentials();
  const next = normalize({
    adminPassword:
      typeof input.adminPassword === "string" && input.adminPassword.trim()
        ? input.adminPassword.trim()
        : current.adminPassword,
    memberPassword:
      typeof input.memberPassword === "string" && input.memberPassword.trim()
        ? input.memberPassword.trim()
        : current.memberPassword,
    updatedAt: new Date().toISOString(),
  });

  if (next.adminPassword === next.memberPassword) {
    throw new Error("Las contraseñas de administrador y equipo deben ser distintas");
  }

  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(AUTH_PATH, JSON.stringify(next, null, 2), "utf8");
  return next;
}

export async function resolveRoleByPassword(password: string) {
  const value = password.trim();
  if (!value) return null;
  const credentials = await readCredentials();
  if (value === credentials.adminPassword) return "admin" as const;
  if (value === credentials.memberPassword) return "member" as const;
  return null;
}
