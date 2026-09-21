import { promises as fs } from "fs";
import path from "path";
import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase/admin";

export type AdminSettings = {
  bitacoraUrl: string;
  updatedAt: string;
};

const DATA_DIR = path.join(process.cwd(), "data");
const SETTINGS_PATH = path.join(DATA_DIR, "admin-settings.json");

export const DEFAULT_ADMIN_SETTINGS: AdminSettings = {
  bitacoraUrl: "",
  updatedAt: "",
};

function normalize(data: Partial<AdminSettings> | null): AdminSettings {
  return {
    bitacoraUrl:
      typeof data?.bitacoraUrl === "string" ? data.bitacoraUrl.trim() : "",
    updatedAt: typeof data?.updatedAt === "string" ? data.updatedAt : "",
  };
}

async function readLocal(): Promise<AdminSettings> {
  try {
    const raw = await fs.readFile(SETTINGS_PATH, "utf8");
    return normalize(JSON.parse(raw) as Partial<AdminSettings>);
  } catch {
    return normalize(null);
  }
}

async function writeLocal(settings: AdminSettings) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(SETTINGS_PATH, JSON.stringify(settings, null, 2), "utf8");
}

async function readSupabase(): Promise<AdminSettings> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("admin_settings")
    .select("bitacora_url, updated_at")
    .eq("id", "main")
    .maybeSingle();

  if (error) throw error;
  if (!data) return normalize(null);

  return normalize({
    bitacoraUrl: data.bitacora_url || "",
    updatedAt: data.updated_at || "",
  });
}

async function writeSupabase(settings: AdminSettings) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("admin_settings").upsert({
    id: "main",
    bitacora_url: settings.bitacoraUrl,
    updated_at: settings.updatedAt || new Date().toISOString(),
  });
  if (error) throw error;
}

export async function readAdminSettings(): Promise<AdminSettings> {
  if (isSupabaseConfigured()) {
    try {
      return await readSupabase();
    } catch (error) {
      console.warn(
        "admin_settings no disponible. Ejecuta supabase/add-admin-settings.sql",
        error,
      );
      return readLocal();
    }
  }
  return readLocal();
}

export async function writeAdminSettings(
  patch: Partial<Pick<AdminSettings, "bitacoraUrl">>,
): Promise<AdminSettings> {
  const current = await readAdminSettings();
  const next = normalize({
    bitacoraUrl:
      patch.bitacoraUrl !== undefined ? patch.bitacoraUrl : current.bitacoraUrl,
    updatedAt: new Date().toISOString(),
  });

  if (isSupabaseConfigured()) {
    try {
      await writeSupabase(next);
      return next;
    } catch (error) {
      console.warn(
        "No se pudo guardar admin_settings en Supabase; usando archivo local.",
        error,
      );
      await writeLocal(next);
      return next;
    }
  }

  await writeLocal(next);
  return next;
}
