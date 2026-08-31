import { promises as fs } from "fs";
import path from "path";
import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase/admin";
import {
  emptyBoard,
  normalizeBoard,
  type ScheduleBeneficiary,
  type ScheduleBoard,
  type WorkshopSession,
} from "./types";

const DATA_DIR = path.join(process.cwd(), "data");
const SCHEDULE_PATH = path.join(DATA_DIR, "schedule.json");

type SessionRow = {
  id: string;
  kind?: string | null;
  event_name?: string | null;
  workshop_id: string | null;
  flower_index: number | null;
  title: string | null;
  session_date: string;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  coach: string | null;
  beneficiary_ids?: string[] | null;
  status: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

async function ensureDataDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

async function readLocal(): Promise<ScheduleBoard> {
  try {
    const raw = await fs.readFile(SCHEDULE_PATH, "utf8");
    return normalizeBoard(JSON.parse(raw) as ScheduleBoard);
  } catch {
    return emptyBoard();
  }
}

async function writeLocal(board: ScheduleBoard) {
  await ensureDataDir();
  await fs.writeFile(SCHEDULE_PATH, JSON.stringify(board, null, 2), "utf8");
}

function rowToSession(row: SessionRow): WorkshopSession {
  return {
    id: row.id,
    kind: row.kind === "event" ? "event" : "workshop",
    eventName: row.event_name || "",
    workshopId: row.workshop_id || "",
    flowerIndex:
      typeof row.flower_index === "number" ? row.flower_index : -1,
    title: row.title || "",
    date: row.session_date,
    startTime: row.start_time || "",
    endTime: row.end_time || "",
    location: row.location || "",
    coach: row.coach || "",
    beneficiaryIds: Array.isArray(row.beneficiary_ids)
      ? row.beneficiary_ids.map(String).filter(Boolean)
      : [],
    status:
      row.status === "done" ||
      row.status === "cancelled" ||
      row.status === "pending_approval" ||
      row.status === "rejected"
        ? row.status
        : "scheduled",
    notes: row.notes || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function readSupabase(): Promise<ScheduleBoard> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("workshop_sessions")
    .select("*")
    .order("session_date", { ascending: true })
    .order("start_time", { ascending: true });

  if (error) throw error;

  return normalizeBoard({
    sessions: ((data || []) as SessionRow[]).map(rowToSession),
  });
}

function missingColumnName(error: unknown): string | null {
  if (!error || typeof error !== "object") return null;
  const message = "message" in error ? String(error.message || "") : "";
  const match = message.match(/Could not find the '([^']+)' column/i);
  return match?.[1] || null;
}

async function writeSupabase(board: ScheduleBoard) {
  const supabase = getSupabaseAdmin();
  const normalized = normalizeBoard(board);

  const { error: deleteError } = await supabase
    .from("workshop_sessions")
    .delete()
    .neq("id", "__never__");
  if (deleteError) throw deleteError;

  if (!normalized.sessions.length) return;

  let rows: Array<Record<string, unknown>> = normalized.sessions.map((item) => ({
    id: item.id,
    kind: item.kind || "workshop",
    event_name: item.eventName || "",
    workshop_id: item.workshopId || "",
    flower_index: item.flowerIndex,
    title: item.title || "",
    session_date: item.date,
    start_time: item.startTime || "",
    end_time: item.endTime || "",
    location: item.location || "",
    coach: item.coach || "",
    beneficiary_ids: item.beneficiaryIds || [],
    status: item.status,
    notes: item.notes || "",
    created_at: item.createdAt || new Date().toISOString(),
    updated_at: item.updatedAt || new Date().toISOString(),
  }));

  // Quita columnas que aún no existen en Supabase e intenta de nuevo.
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const { error } = await supabase.from("workshop_sessions").insert(rows);
    if (!error) return;

    const missing = missingColumnName(error);
    if (!missing || !(missing in (rows[0] || {}))) {
      throw error;
    }
    console.warn(
      `workshop_sessions.${missing} missing; saving without it. Run the matching supabase/*.sql migration.`,
    );
    rows = rows.map((row) => {
      const next = { ...row };
      delete next[missing];
      return next;
    });
  }
}

export async function readScheduleBoard(): Promise<ScheduleBoard> {
  if (isSupabaseConfigured()) {
    try {
      return await readSupabase();
    } catch (error) {
      console.error("Supabase schedule read failed, using local fallback:", error);
      return readLocal();
    }
  }
  return readLocal();
}

/** Beneficiarios de contabilidad para asignar en el cronograma. */
export async function readScheduleBeneficiaries(): Promise<ScheduleBeneficiary[]> {
  if (isSupabaseConfigured()) {
    try {
      const supabase = getSupabaseAdmin();
      const { data, error } = await supabase
        .from("accounting_beneficiaries")
        .select("id, name, contact")
        .order("name", { ascending: true });
      if (error) throw error;
      return ((data || []) as Array<{ id: string; name: string | null; contact: string | null }>)
        .map((row) => ({
          id: String(row.id),
          name: (row.name || "Sin nombre").trim() || "Sin nombre",
          contact: row.contact || "",
        }))
        .sort((a, b) => a.name.localeCompare(b.name, "es"));
    } catch (error) {
      console.error("Supabase schedule beneficiaries failed:", error);
    }
  }

  // Fallback: board de contabilidad local / store completo.
  try {
    const { readAccountingBoard } = await import("@/lib/accounting/store");
    const accounting = await readAccountingBoard();
    return (accounting.beneficiaries || [])
      .map((item) => ({
        id: item.id,
        name: item.name || "Sin nombre",
        contact: item.contact || "",
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "es"));
  } catch (error) {
    console.error("Accounting fallback for beneficiaries failed:", error);
    return [];
  }
}

export async function writeScheduleBoard(board: ScheduleBoard) {
  const normalized = normalizeBoard(board);
  if (isSupabaseConfigured()) {
    await writeSupabase(normalized);
    return;
  }
  await writeLocal(normalized);
}
