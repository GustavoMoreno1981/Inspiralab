import { promises as fs } from "fs";
import path from "path";
import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase/admin";

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
    DEFAULT_CREDENTIALS.adminPassword;
  const memberPassword =
    (typeof data?.memberPassword === "string" && data.memberPassword.trim()) ||
    DEFAULT_CREDENTIALS.memberPassword;

  return {
    adminPassword,
    memberPassword,
    updatedAt: data?.updatedAt || "",
  };
}

async function readCredentialsLocal(): Promise<AuthCredentials> {
  try {
    const raw = await fs.readFile(AUTH_PATH, "utf8");
    return normalize(JSON.parse(raw) as Partial<AuthCredentials>);
  } catch {
    return normalize(null);
  }
}

async function writeCredentialsLocal(credentials: AuthCredentials) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(AUTH_PATH, JSON.stringify(credentials, null, 2), "utf8");
}

async function readCredentialsSupabase(): Promise<AuthCredentials> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("auth_credentials")
    .select("admin_password, member_password, updated_at")
    .eq("id", "main")
    .maybeSingle();

  if (error) throw error;
  if (!data) return normalize(null);

  return normalize({
    adminPassword: data.admin_password,
    memberPassword: data.member_password,
    updatedAt: data.updated_at || "",
  });
}

async function writeCredentialsSupabase(credentials: AuthCredentials) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("auth_credentials").upsert({
    id: "main",
    admin_password: credentials.adminPassword,
    member_password: credentials.memberPassword,
    updated_at: credentials.updatedAt || new Date().toISOString(),
  });

  if (error) throw error;
}

export async function readCredentials(): Promise<AuthCredentials> {
  if (isSupabaseConfigured()) {
    try {
      return await readCredentialsSupabase();
    } catch (error) {
      console.error("Supabase auth credentials read failed, using local fallback:", error);
      return readCredentialsLocal();
    }
  }
  return readCredentialsLocal();
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

  if (isSupabaseConfigured()) {
    await writeCredentialsSupabase(next);
    return next;
  }

  await writeCredentialsLocal(next);
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
