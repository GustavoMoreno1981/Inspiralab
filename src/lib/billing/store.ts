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
  type UpdateBillingPaymentReceiptInput,
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
  payment_receipt_url?: string | null;
  payment_receipt_name?: string | null;
  payment_receipt_at?: string | null;
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
    paymentReceiptUrl: row.payment_receipt_url || "",
    paymentReceiptName: row.payment_receipt_name || "",
    paymentReceiptAt: row.payment_receipt_at || null,
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
    payment_receipt_url: item.paymentReceiptUrl,
    payment_receipt_name: item.paymentReceiptName,
    payment_receipt_at: item.paymentReceiptAt,
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
    let { error } = await supabase.from("billing_submissions").insert(submissionToRow(submission));
    if (
      error &&
      (error.code === "PGRST204" ||
        String(error.message || "").includes("payment_receipt"))
    ) {
      const row = submissionToRow(submission);
      const {
        payment_receipt_url: _u,
        payment_receipt_name: _n,
        payment_receipt_at: _a,
        ...legacyRow
      } = row;
      ({ error } = await supabase.from("billing_submissions").insert(legacyRow));
    }
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

export async function updateBillingSubmissionActivities(
  id: string,
  activities: string[],
): Promise<BillingSubmission> {
  const normalized = activities.map((line) => String(line).trim()).filter(Boolean);
  if (normalized.length === 0) {
    throw new Error("Debe haber al menos una actividad");
  }

  const now = new Date().toISOString();

  if (isSupabaseConfigured()) {
    const supabase = getSupabaseAdmin();
    const { data: existing, error: readError } = await supabase
      .from("billing_submissions")
      .select("*")
      .eq("id", id)
      .single();

    if (readError) throw readError;
    if (!existing) throw new Error("Cuenta de cobro no encontrada");
    if (existing.archived_at) {
      throw new Error("No se pueden editar cuentas archivadas");
    }

    const { data, error } = await supabase
      .from("billing_submissions")
      .update({ activities: normalized, updated_at: now })
      .eq("id", id)
      .select("*")
      .single();

    if (error) throw error;
    return rowToSubmission(data as SubmissionRow);
  }

  const board = await readLocal();
  let updated: BillingSubmission | null = null;
  const submissions = board.submissions.map((item) => {
    if (item.id !== id) return item;
    if (item.archivedAt) {
      throw new Error("No se pueden editar cuentas archivadas");
    }
    updated = { ...item, activities: normalized, updatedAt: now };
    return updated;
  });
  if (!updated) {
    throw new Error("Cuenta de cobro no encontrada");
  }
  await writeLocal({ submissions });
  return updated;
}

export async function updateBillingPaymentReceipt(
  id: string,
  input: UpdateBillingPaymentReceiptInput,
): Promise<BillingSubmission> {
  const paymentReceiptUrl = String(input.paymentReceiptUrl || "").trim();
  const paymentReceiptName = String(input.paymentReceiptName || "").trim() || "recibo-de-pago";
  if (!paymentReceiptUrl) {
    throw new Error("Falta el archivo del recibo de pago");
  }

  const now = new Date().toISOString();

  if (isSupabaseConfigured()) {
    const supabase = getSupabaseAdmin();
    const { data: existing, error: readError } = await supabase
      .from("billing_submissions")
      .select("*")
      .eq("id", id)
      .single();

    if (readError) throw readError;
    if (!existing) throw new Error("Cuenta de cobro no encontrada");
    if (existing.archived_at) {
      throw new Error("No se puede subir recibo en cuentas archivadas");
    }

    let { data, error } = await supabase
      .from("billing_submissions")
      .update({
        payment_receipt_url: paymentReceiptUrl,
        payment_receipt_name: paymentReceiptName,
        payment_receipt_at: now,
        status: "paid",
        updated_at: now,
      })
      .eq("id", id)
      .select("*")
      .single();

    if (
      error &&
      (error.code === "PGRST204" ||
        String(error.message || "").includes("payment_receipt"))
    ) {
      throw new Error(
        "Supabase aún no tiene columnas de recibo de pago. Ejecuta supabase/add-billing-payment-receipt.sql.",
      );
    }
    if (error) throw error;
    return rowToSubmission(data as SubmissionRow);
  }

  const board = await readLocal();
  let updated: BillingSubmission | null = null;
  const submissions = board.submissions.map((item) => {
    if (item.id !== id) return item;
    if (item.archivedAt) {
      throw new Error("No se puede subir recibo en cuentas archivadas");
    }
    updated = {
      ...item,
      paymentReceiptUrl,
      paymentReceiptName,
      paymentReceiptAt: now,
      status: "paid",
      updatedAt: now,
    };
    return updated;
  });
  if (!updated) {
    throw new Error("Cuenta de cobro no encontrada");
  }
  await writeLocal({ submissions });
  return updated;
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
