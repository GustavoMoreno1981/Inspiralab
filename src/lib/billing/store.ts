import { promises as fs } from "fs";
import path from "path";
import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase/admin";
import {
  createBillingId,
  emptyBillingBoard,
  normalizeBillingBoard,
  normalizeSubmission,
  type BillingBoard,
  type BillingSubmission,
  type CreateBillingSubmissionInput,
} from "./types";

const DATA_DIR = path.join(process.cwd(), "data");
const BILLING_PATH = path.join(DATA_DIR, "billing.json");

type SubmissionRow = {
  id: string;
  member_id: string;
  period_start: string;
  period_end: string;
  file_url: string;
  file_name: string;
  activities: string[] | null;
  notes: string | null;
  status: string | null;
  archived_at: string | null;
  submitted_at: string;
  created_at: string;
  updated_at: string;
};

async function ensureDataDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

async function readLocal(): Promise<BillingBoard> {
  try {
    const raw = await fs.readFile(BILLING_PATH, "utf8");
    return normalizeBillingBoard(JSON.parse(raw) as BillingBoard);
  } catch {
    return emptyBillingBoard();
  }
}

async function writeLocal(board: BillingBoard) {
  await ensureDataDir();
  await fs.writeFile(BILLING_PATH, JSON.stringify(board, null, 2), "utf8");
}

function rowToSubmission(row: SubmissionRow): BillingSubmission {
  return normalizeSubmission({
    id: row.id,
    memberId: row.member_id,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    fileUrl: row.file_url,
    fileName: row.file_name,
    activities: Array.isArray(row.activities) ? row.activities : [],
    notes: row.notes || "",
    status:
      row.status === "reviewed" || row.status === "paid" ? row.status : "submitted",
    archivedAt: row.archived_at || null,
    submittedAt: row.submitted_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

function submissionToRow(item: BillingSubmission): SubmissionRow {
  return {
    id: item.id,
    member_id: item.memberId,
    period_start: item.periodStart,
    period_end: item.periodEnd,
    file_url: item.fileUrl,
    file_name: item.fileName,
    activities: item.activities,
    notes: item.notes,
    status: item.status,
    archived_at: item.archivedAt,
    submitted_at: item.submittedAt,
    created_at: item.createdAt,
    updated_at: item.updatedAt,
  };
}

async function readSupabase(): Promise<BillingBoard> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("billing_submissions")
    .select("*")
    .order("period_end", { ascending: false })
    .order("submitted_at", { ascending: false });

  if (error) throw error;

  return normalizeBillingBoard({
    submissions: ((data || []) as SubmissionRow[]).map(rowToSubmission),
  });
}

export async function readBillingBoard(): Promise<BillingBoard> {
  if (isSupabaseConfigured()) {
    return readSupabase();
  }
  return readLocal();
}

export async function createBillingSubmission(
  input: CreateBillingSubmissionInput,
): Promise<BillingSubmission> {
  const now = new Date().toISOString();
  const submission = normalizeSubmission({
    id: createBillingId(),
    memberId: input.memberId,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    fileUrl: input.fileUrl,
    fileName: input.fileName,
    activities: input.activities,
    notes: input.notes || "",
    status: "submitted",
    submittedAt: now,
    createdAt: now,
    updatedAt: now,
  });

  if (isSupabaseConfigured()) {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("billing_submissions").insert(submissionToRow(submission));
    if (error) throw error;
    return submission;
  }

  const board = await readLocal();
  board.submissions.unshift(submission);
  await writeLocal(board);
  return submission;
}

export async function archiveBillingSubmission(id: string): Promise<BillingSubmission> {
  const now = new Date().toISOString();

  if (isSupabaseConfigured()) {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("billing_submissions")
      .update({ archived_at: now, updated_at: now })
      .eq("id", id)
      .select("*")
      .single();

    if (error) throw error;
    return rowToSubmission(data as SubmissionRow);
  }

  const board = await readLocal();
  let archived: BillingSubmission | null = null;
  const submissions = board.submissions.map((item) => {
    if (item.id !== id) return item;
    archived = { ...item, archivedAt: now, updatedAt: now };
    return archived;
  });
  if (!archived) {
    throw new Error("Cuenta de cobro no encontrada");
  }
  await writeLocal({ submissions });
  return archived;
}

export async function deleteBillingSubmission(id: string) {
  if (isSupabaseConfigured()) {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("billing_submissions")
      .select("archived_at")
      .eq("id", id)
      .single();

    if (error) throw error;
    if (!data?.archived_at) {
      throw new Error("Solo se pueden eliminar cuentas archivadas");
    }

    const { error: deleteError } = await supabase
      .from("billing_submissions")
      .delete()
      .eq("id", id);
    if (deleteError) throw deleteError;
    return;
  }

  const board = await readLocal();
  const target = board.submissions.find((item) => item.id === id);
  if (!target) {
    throw new Error("Cuenta de cobro no encontrada");
  }
  if (!target.archivedAt) {
    throw new Error("Solo se pueden eliminar cuentas archivadas");
  }
  await writeLocal({
    submissions: board.submissions.filter((item) => item.id !== id),
  });
}
