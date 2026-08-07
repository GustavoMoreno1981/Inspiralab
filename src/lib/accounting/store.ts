import { promises as fs } from "fs";
import path from "path";
import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase/admin";
import {
  emptyActivityCosts,
  emptyBoard,
  type AccountingBoard,
  type Activity,
  type AnnualBudget,
  type AttachmentFile,
  type Beneficiary,
  type CostCategory,
  type OperationalExpense,
} from "./types";

const DATA_DIR = path.join(process.cwd(), "data");
const ACCOUNTING_PATH = path.join(DATA_DIR, "accounting.json");

type BudgetRow = {
  id: string;
  year: number;
  amount_cop: number | string;
  salaries_cop?: number | string | null;
  usd_rate: number | string;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type BeneficiaryRow = {
  id: string;
  name: string;
  contact: string | null;
  notes: string | null;
  created_at: string;
};

type ActivityRow = {
  id: string;
  beneficiary_id: string;
  title: string;
  activity_date: string;
  usd_rate: number | string;
  received_cop?: number | string | null;
  materials_cop: number | string;
  logistics_cop: number | string;
  collaborations_cop: number | string;
  contingencies_cop: number | string;
  materials_files: AttachmentFile[] | null;
  logistics_files: AttachmentFile[] | null;
  collaborations_files: AttachmentFile[] | null;
  contingencies_files: AttachmentFile[] | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type ExpenseRow = {
  id: string;
  category: OperationalExpense["category"];
  title: string;
  expense_date: string;
  amount_cop: number | string;
  usd_rate: number | string;
  files: AttachmentFile[] | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

function num(value: unknown) {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function files(value: unknown): AttachmentFile[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as AttachmentFile;
      if (!row.id || !row.url) return null;
      return { id: String(row.id), name: String(row.name || "archivo"), url: String(row.url) };
    })
    .filter(Boolean) as AttachmentFile[];
}

function normalizeBoard(data: Partial<AccountingBoard> | null): AccountingBoard {
  return {
    budgets: Array.isArray(data?.budgets)
      ? data.budgets.map((item) => ({
          id: item.id,
          year: Number(item.year),
          amountCop: num(item.amountCop),
          salariesCop: num(item.salariesCop),
          usdRate: num(item.usdRate) || 4000,
          notes: item.notes || "",
          createdAt: item.createdAt || "",
          updatedAt: item.updatedAt || "",
        }))
      : [],
    beneficiaries: Array.isArray(data?.beneficiaries)
      ? data.beneficiaries.map((item) => ({
          id: item.id,
          name: item.name || "",
          contact: item.contact || "",
          notes: item.notes || "",
          createdAt: item.createdAt || "",
        }))
      : [],
    activities: Array.isArray(data?.activities)
      ? data.activities.map((item) => {
          const costs = emptyActivityCosts();
          (Object.keys(costs) as CostCategory[]).forEach((key) => {
            costs[key] = {
              amountCop: num(item.costs?.[key]?.amountCop),
              files: files(item.costs?.[key]?.files),
            };
          });
          return {
            id: item.id,
            beneficiaryId: item.beneficiaryId,
            title: item.title || "",
            date: item.date || "",
            usdRate: num(item.usdRate) || 4000,
            receivedCop: num(item.receivedCop),
            costs,
            notes: item.notes || "",
            createdAt: item.createdAt || "",
            updatedAt: item.updatedAt || "",
          };
        })
      : [],
    expenses: Array.isArray(data?.expenses)
      ? data.expenses.map((item) => ({
          id: item.id,
          category: item.category || "other",
          title: item.title || "",
          date: item.date || "",
          amountCop: num(item.amountCop),
          usdRate: num(item.usdRate) || 4000,
          files: files(item.files),
          notes: item.notes || "",
          createdAt: item.createdAt || "",
          updatedAt: item.updatedAt || "",
        }))
      : [],
  };
}

async function readLocal(): Promise<AccountingBoard> {
  try {
    const raw = await fs.readFile(ACCOUNTING_PATH, "utf8");
    return normalizeBoard(JSON.parse(raw) as AccountingBoard);
  } catch {
    return emptyBoard();
  }
}

async function writeLocal(board: AccountingBoard) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(ACCOUNTING_PATH, JSON.stringify(normalizeBoard(board), null, 2), "utf8");
}

async function readSupabase(): Promise<AccountingBoard> {
  const supabase = getSupabaseAdmin();
  const [budgetsRes, beneficiariesRes, activitiesRes, expensesRes] = await Promise.all([
    supabase.from("accounting_budgets").select("*").order("year", { ascending: false }),
    supabase.from("accounting_beneficiaries").select("*").order("created_at", { ascending: true }),
    supabase.from("accounting_activities").select("*").order("activity_date", { ascending: false }),
    supabase.from("accounting_expenses").select("*").order("expense_date", { ascending: false }),
  ]);

  if (budgetsRes.error) throw budgetsRes.error;
  if (beneficiariesRes.error) throw beneficiariesRes.error;
  if (activitiesRes.error) throw activitiesRes.error;
  if (expensesRes.error) throw expensesRes.error;

  const budgets: AnnualBudget[] = ((budgetsRes.data || []) as BudgetRow[]).map((row) => ({
    id: row.id,
    year: Number(row.year),
    amountCop: num(row.amount_cop),
    salariesCop: num(row.salaries_cop),
    usdRate: num(row.usd_rate) || 4000,
    notes: row.notes || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));

  const beneficiaries: Beneficiary[] = ((beneficiariesRes.data || []) as BeneficiaryRow[]).map(
    (row) => ({
      id: row.id,
      name: row.name,
      contact: row.contact || "",
      notes: row.notes || "",
      createdAt: row.created_at,
    }),
  );

  const activities: Activity[] = ((activitiesRes.data || []) as ActivityRow[]).map((row) => ({
    id: row.id,
    beneficiaryId: row.beneficiary_id,
    title: row.title,
    date: row.activity_date,
    usdRate: num(row.usd_rate) || 4000,
    receivedCop: num(row.received_cop),
    costs: {
      materials: { amountCop: num(row.materials_cop), files: files(row.materials_files) },
      logistics: { amountCop: num(row.logistics_cop), files: files(row.logistics_files) },
      collaborations: {
        amountCop: num(row.collaborations_cop),
        files: files(row.collaborations_files),
      },
      contingencies: {
        amountCop: num(row.contingencies_cop),
        files: files(row.contingencies_files),
      },
    },
    notes: row.notes || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));

  const expenses: OperationalExpense[] = ((expensesRes.data || []) as ExpenseRow[]).map((row) => ({
    id: row.id,
    category: row.category,
    title: row.title,
    date: row.expense_date,
    amountCop: num(row.amount_cop),
    usdRate: num(row.usd_rate) || 4000,
    files: files(row.files),
    notes: row.notes || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));

  return { budgets, beneficiaries, activities, expenses };
}

async function writeSupabase(board: AccountingBoard) {
  const supabase = getSupabaseAdmin();
  const normalized = normalizeBoard(board);

  const deletes = await Promise.all([
    supabase.from("accounting_activities").delete().neq("id", "__never__"),
    supabase.from("accounting_expenses").delete().neq("id", "__never__"),
    supabase.from("accounting_beneficiaries").delete().neq("id", "__never__"),
    supabase.from("accounting_budgets").delete().neq("id", "__never__"),
  ]);
  for (const res of deletes) {
    if (res.error) throw res.error;
  }

  if (normalized.budgets.length) {
    const { error } = await supabase.from("accounting_budgets").insert(
      normalized.budgets.map((item) => ({
        id: item.id,
        year: item.year,
        amount_cop: item.amountCop,
        salaries_cop: item.salariesCop || 0,
        usd_rate: item.usdRate,
        notes: item.notes || "",
        created_at: item.createdAt || new Date().toISOString(),
        updated_at: item.updatedAt || new Date().toISOString(),
      })),
    );
    if (error) throw error;
  }

  if (normalized.beneficiaries.length) {
    const { error } = await supabase.from("accounting_beneficiaries").insert(
      normalized.beneficiaries.map((item) => ({
        id: item.id,
        name: item.name,
        contact: item.contact || "",
        notes: item.notes || "",
        created_at: item.createdAt || new Date().toISOString(),
      })),
    );
    if (error) throw error;
  }

  if (normalized.activities.length) {
    const { error } = await supabase.from("accounting_activities").insert(
      normalized.activities.map((item) => ({
        id: item.id,
        beneficiary_id: item.beneficiaryId,
        title: item.title,
        activity_date: item.date,
        usd_rate: item.usdRate,
        received_cop: item.receivedCop || 0,
        materials_cop: item.costs.materials.amountCop,
        logistics_cop: item.costs.logistics.amountCop,
        collaborations_cop: item.costs.collaborations.amountCop,
        contingencies_cop: item.costs.contingencies.amountCop,
        materials_files: item.costs.materials.files,
        logistics_files: item.costs.logistics.files,
        collaborations_files: item.costs.collaborations.files,
        contingencies_files: item.costs.contingencies.files,
        notes: item.notes || "",
        created_at: item.createdAt || new Date().toISOString(),
        updated_at: item.updatedAt || new Date().toISOString(),
      })),
    );
    if (error) throw error;
  }

  if (normalized.expenses.length) {
    const { error } = await supabase.from("accounting_expenses").insert(
      normalized.expenses.map((item) => ({
        id: item.id,
        category: item.category,
        title: item.title,
        expense_date: item.date,
        amount_cop: item.amountCop,
        usd_rate: item.usdRate,
        files: item.files,
        notes: item.notes || "",
        created_at: item.createdAt || new Date().toISOString(),
        updated_at: item.updatedAt || new Date().toISOString(),
      })),
    );
    if (error) throw error;
  }
}

export async function readAccountingBoard(): Promise<AccountingBoard> {
  if (isSupabaseConfigured()) {
    try {
      return await readSupabase();
    } catch (error) {
      console.error("Supabase accounting read failed, using local fallback:", error);
      return readLocal();
    }
  }
  return readLocal();
}

export async function writeAccountingBoard(board: AccountingBoard) {
  const normalized = normalizeBoard(board);
  if (isSupabaseConfigured()) {
    await writeSupabase(normalized);
    return;
  }
  await writeLocal(normalized);
}
