import { promises as fs } from "fs";
import path from "path";
import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase/admin";
import {
  createEmptyEvaluation,
  emptyBoard,
  normalizeBoard,
  normalizeEvaluation,
  type FollowUpBoard,
  type WorkshopEvaluation,
} from "./types";

const DATA_DIR = path.join(process.cwd(), "data");
const FOLLOWUP_PATH = path.join(DATA_DIR, "workshop-evaluations.json");

type EvaluationRow = {
  id: string;
  session_id: string;
  content?: unknown;
  content_score?: number | null;
  facilitator_score?: number | null;
  materials_score?: number | null;
  organization_score?: number | null;
  impact_score?: number | null;
  recommend_score?: number | null;
  highlights?: string | null;
  improvements?: string | null;
  notes?: string | null;
  evaluated_by?: string | null;
  completed_at?: string | null;
  created_at: string;
  updated_at: string;
};

async function ensureDataDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

async function readLocal(): Promise<FollowUpBoard> {
  try {
    const raw = await fs.readFile(FOLLOWUP_PATH, "utf8");
    return normalizeBoard(JSON.parse(raw) as FollowUpBoard);
  } catch {
    return emptyBoard();
  }
}

async function writeLocal(board: FollowUpBoard) {
  await ensureDataDir();
  await fs.writeFile(FOLLOWUP_PATH, JSON.stringify(board, null, 2), "utf8");
}

function rowToEvaluation(row: EvaluationRow): WorkshopEvaluation {
  if (row.content && typeof row.content === "object") {
    return normalizeEvaluation({
      ...(row.content as Partial<WorkshopEvaluation>),
      id: row.id,
      sessionId: row.session_id,
      evaluatedBy:
        (row.content as { evaluatedBy?: string }).evaluatedBy ||
        row.evaluated_by ||
        "",
      notes: (row.content as { notes?: string }).notes || row.notes || "",
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      content: row.content,
    });
  }

  return normalizeEvaluation({
    id: row.id,
    sessionId: row.session_id,
    highlights: row.highlights || "",
    improvements: row.improvements || "",
    notes: row.notes || "",
    evaluatedBy: row.evaluated_by || "",
    completedAt: row.completed_at || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    scores: {
      content: Number(row.content_score) || 0,
      facilitator: Number(row.facilitator_score) || 0,
      materials: Number(row.materials_score) || 0,
      organization: Number(row.organization_score) || 0,
      impact: Number(row.impact_score) || 0,
      recommend: Number(row.recommend_score) || 0,
    },
  });
}

function evaluationToContent(item: WorkshopEvaluation) {
  return {
    id: item.id,
    sessionId: item.sessionId,
    fields: item.fields,
    phaseStatus: item.phaseStatus,
    evaluatedBy: item.evaluatedBy,
    notes: item.notes,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

async function readSupabase(): Promise<FollowUpBoard> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("workshop_evaluations")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return normalizeBoard({
    evaluations: ((data || []) as EvaluationRow[]).map(rowToEvaluation),
  });
}

async function writeSupabase(board: FollowUpBoard) {
  const supabase = getSupabaseAdmin();
  const normalized = normalizeBoard(board);

  const { error: deleteError } = await supabase
    .from("workshop_evaluations")
    .delete()
    .neq("id", "__never__");
  if (deleteError) throw deleteError;

  if (!normalized.evaluations.length) return;

  const rows = normalized.evaluations.map((item) => ({
    id: item.id,
    session_id: item.sessionId,
    content: evaluationToContent(item),
    // Columnas legacy en 0 / vacío para no romper constraints.
    content_score: 0,
    facilitator_score: 0,
    materials_score: 0,
    organization_score: 0,
    impact_score: 0,
    recommend_score: 0,
    highlights: "",
    improvements: "",
    notes: item.notes || "",
    evaluated_by: item.evaluatedBy || "",
    completed_at:
      item.phaseStatus.after === "done" ? item.updatedAt : null,
    created_at: item.createdAt || new Date().toISOString(),
    updated_at: item.updatedAt || new Date().toISOString(),
  }));

  let { error } = await supabase.from("workshop_evaluations").insert(rows);
  if (
    error &&
    (error.code === "PGRST204" ||
      String(error.message || "").includes("content"))
  ) {
    // Sin columna content: guarda un stub mínimo en columnas legacy.
    ({ error } = await supabase.from("workshop_evaluations").insert(
      rows.map(({ content: _c, ...rest }) => ({
        ...rest,
        highlights: JSON.stringify(_c),
      })),
    ));
  }
  if (error) throw error;
}

export async function readFollowUpBoard(): Promise<FollowUpBoard> {
  if (isSupabaseConfigured()) {
    try {
      return await readSupabase();
    } catch (error) {
      console.error("Supabase follow-up read failed, using local fallback:", error);
      return readLocal();
    }
  }
  return readLocal();
}

export async function writeFollowUpBoard(board: FollowUpBoard) {
  const normalized = normalizeBoard(board);
  if (isSupabaseConfigured()) {
    await writeSupabase(normalized);
    return;
  }
  await writeLocal(normalized);
}

/** Crea evaluación vacía si no existe para la sesión. */
export async function ensureEvaluationForSession(sessionId: string) {
  if (!sessionId) return;
  const board = await readFollowUpBoard();
  if (board.evaluations.some((item) => item.sessionId === sessionId)) return;
  await writeFollowUpBoard({
    evaluations: [...board.evaluations, createEmptyEvaluation(sessionId)],
  });
}

/** Crea evaluaciones faltantes para las sesiones del cronograma. */
export async function syncEvaluationsForSessions(sessionIds: string[]) {
  const unique = [...new Set(sessionIds.filter(Boolean))];
  if (!unique.length) return;
  const board = await readFollowUpBoard();
  const existing = new Set(board.evaluations.map((item) => item.sessionId));
  const missing = unique.filter((id) => !existing.has(id));
  if (!missing.length) return;
  await writeFollowUpBoard({
    evaluations: [
      ...board.evaluations,
      ...missing.map((id) => createEmptyEvaluation(id)),
    ],
  });
}
