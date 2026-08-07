"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  COST_CATEGORIES,
  EXPENSE_CATEGORIES,
  activityBalanceCop,
  activityTotalCop,
  createId,
  emptyActivityCosts,
  emptyBoard,
  formatCop,
  formatUsdFromCop,
  getYearSummary,
  toCop,
  type AccountingBoard,
  type Activity,
  type AttachmentFile,
  type CostCategory,
  type ExpenseCategory,
  type OperationalExpense,
} from "@/lib/accounting/types";
import { AdminFooter } from "@/components/admin/AdminFooter";
import { AccountingReports } from "@/components/admin/AccountingReports";
import { BUDGET_WARNING_PERCENT, getBudgetAlarm } from "@/lib/alarms";

type Tab = "summary" | "budget" | "beneficiaries" | "activities" | "expenses" | "reports";

function numInput(value: string) {
  const cleaned = value.replace(/[^\d.]/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function activityAttachments(activity: Activity) {
  return COST_CATEGORIES.flatMap((cat) =>
    (activity.costs[cat.value]?.files || []).map((file) => ({
      ...file,
      category: cat.label,
    })),
  );
}

async function uploadSupport(file: File): Promise<AttachmentFile | null> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch("/api/upload", { method: "POST", body: form });
  if (!res.ok) {
    alert("No se pudo subir el soporte");
    return null;
  }
  const data = (await res.json()) as { url: string; name?: string };
  return {
    id: createId("file"),
    url: data.url,
    name: data.name || file.name,
  };
}

export function AccountingBoard() {
  const router = useRouter();
  const [board, setBoard] = useState<AccountingBoard>(emptyBoard());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [tab, setTab] = useState<Tab>("summary");
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const yearOptions = useMemo(() => {
    const start = 2025;
    const end = Math.max(2035, currentYear + 5);
    const years: number[] = [];
    for (let y = start; y <= end; y += 1) years.push(y);
    // Incluir años que ya existan en presupuestos guardados
    for (const budget of board.budgets) {
      if (!years.includes(budget.year)) years.push(budget.year);
    }
    return years.sort((a, b) => a - b);
  }, [board.budgets, currentYear]);

  const [budgetYear, setBudgetYear] = useState(currentYear);
  const [budgetUsd, setBudgetUsd] = useState("");
  const [budgetSalariesUsd, setBudgetSalariesUsd] = useState("");
  const [budgetRate, setBudgetRate] = useState("4000");
  const [budgetNotes, setBudgetNotes] = useState("");
  const [editingBudgetId, setEditingBudgetId] = useState<string | null>(null);

  const [beneficiaryName, setBeneficiaryName] = useState("");
  const [beneficiaryContact, setBeneficiaryContact] = useState("");
  const [beneficiaryNotes, setBeneficiaryNotes] = useState("");

  const [activityTitle, setActivityTitle] = useState("");
  const [activityBeneficiaryId, setActivityBeneficiaryId] = useState("");
  const [activityDate, setActivityDate] = useState(new Date().toISOString().slice(0, 10));
  const [activityRate, setActivityRate] = useState("4000");
  const [activityReceived, setActivityReceived] = useState("");
  const [activityNotes, setActivityNotes] = useState("");
  const [activityCosts, setActivityCosts] = useState(emptyActivityCosts());
  const [editingActivityId, setEditingActivityId] = useState<string | null>(null);
  const [uploadingCost, setUploadingCost] = useState<CostCategory | null>(null);
  const [invoicesActivityId, setInvoicesActivityId] = useState<string | null>(null);

  const [expenseTitle, setExpenseTitle] = useState("");
  const [expenseCategory, setExpenseCategory] = useState<ExpenseCategory>("equipment");
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().slice(0, 10));
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseRate, setExpenseRate] = useState("4000");
  const [expenseNotes, setExpenseNotes] = useState("");
  const [expenseFiles, setExpenseFiles] = useState<AttachmentFile[]>([]);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [uploadingExpense, setUploadingExpense] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/accounting", { cache: "no-store" });
    if (res.ok) {
      const data = (await res.json()) as AccountingBoard;
      setBoard(data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const summary = useMemo(() => getYearSummary(board, year), [board, year]);

  const budgetCopPreview = useMemo(() => {
    return toCop(numInput(budgetUsd), numInput(budgetRate) || 4000);
  }, [budgetUsd, budgetRate]);

  const salariesCopPreview = useMemo(() => {
    return toCop(numInput(budgetSalariesUsd), numInput(budgetRate) || 4000);
  }, [budgetSalariesUsd, budgetRate]);

  function resetBudgetForm() {
    setEditingBudgetId(null);
    setBudgetYear(year);
    setBudgetUsd("");
    setBudgetSalariesUsd("");
    setBudgetRate(String(summary.budget?.usdRate || 4000));
    setBudgetNotes("");
  }

  function editBudget(budget: (typeof board.budgets)[number]) {
    setEditingBudgetId(budget.id);
    setBudgetYear(budget.year);
    setBudgetRate(String(budget.usdRate || 4000));
    setBudgetUsd(
      budget.usdRate > 0 ? String(Number((budget.amountCop / budget.usdRate).toFixed(2))) : "",
    );
    setBudgetSalariesUsd(
      budget.usdRate > 0
        ? String(Number(((budget.salariesCop || 0) / budget.usdRate).toFixed(2)))
        : "",
    );
    setBudgetNotes(budget.notes || "");
    setYear(budget.year);
  }

  async function persist(next: AccountingBoard) {
    setSaving(true);
    setStatusMsg("");
    const res = await fetch("/api/accounting", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next),
    });
    setSaving(false);
    if (res.ok) {
      setBoard(next);
      setStatusMsg("Guardado");
      window.setTimeout(() => setStatusMsg(""), 1800);
      return true;
    }
    const payload = (await res.json().catch(() => null)) as { error?: string } | null;
    setStatusMsg(payload?.error || "Error al guardar");
    return false;
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  function saveBudget(event: FormEvent) {
    event.preventDefault();
    const amountUsd = numInput(budgetUsd);
    const salariesUsd = numInput(budgetSalariesUsd);
    const usdRate = numInput(budgetRate) || 4000;
    if (amountUsd <= 0) {
      alert("Indica el monto en dólares");
      return;
    }
    const amountCop = toCop(amountUsd, usdRate);
    const salariesCop = toCop(salariesUsd, usdRate);
    const now = new Date().toISOString();

    const sameYear = board.budgets.find(
      (item) => item.year === budgetYear && item.id !== editingBudgetId,
    );
    if (sameYear) {
      alert(`Ya existe un presupuesto para ${budgetYear}`);
      return;
    }

    const existing = editingBudgetId
      ? board.budgets.find((item) => item.id === editingBudgetId)
      : board.budgets.find((item) => item.year === budgetYear);

    const nextBudgets = existing
      ? board.budgets.map((item) =>
          item.id === existing.id
            ? {
                ...item,
                year: budgetYear,
                amountCop,
                salariesCop,
                usdRate,
                notes: budgetNotes.trim(),
                updatedAt: now,
              }
            : item,
        )
      : [
          {
            id: createId("budget"),
            year: budgetYear,
            amountCop,
            salariesCop,
            usdRate,
            notes: budgetNotes.trim(),
            createdAt: now,
            updatedAt: now,
          },
          ...board.budgets,
        ];

    void persist({ ...board, budgets: nextBudgets }).then((ok) => {
      if (!ok) return;
      setYear(budgetYear);
      setEditingBudgetId(null);
      setBudgetUsd("");
      setBudgetSalariesUsd("");
      setBudgetNotes("");
      setBudgetRate(String(usdRate));
      setBudgetYear(budgetYear);
    });
  }

  function removeBudget(id: string) {
    if (!window.confirm("¿Eliminar este presupuesto?")) return;
    void persist({
      ...board,
      budgets: board.budgets.filter((item) => item.id !== id),
    });
    if (editingBudgetId === id) resetBudgetForm();
  }

  function addBeneficiary(event: FormEvent) {
    event.preventDefault();
    if (!beneficiaryName.trim()) return;
    const next = {
      ...board,
      beneficiaries: [
        ...board.beneficiaries,
        {
          id: createId("ben"),
          name: beneficiaryName.trim(),
          contact: beneficiaryContact.trim(),
          notes: beneficiaryNotes.trim(),
          createdAt: new Date().toISOString(),
        },
      ],
    };
    void persist(next);
    setBeneficiaryName("");
    setBeneficiaryContact("");
    setBeneficiaryNotes("");
  }

  function removeBeneficiary(id: string) {
    if (board.activities.some((item) => item.beneficiaryId === id)) {
      alert("No se puede eliminar: tiene actividades asociadas.");
      return;
    }
    if (!window.confirm("¿Eliminar beneficiario?")) return;
    void persist({
      ...board,
      beneficiaries: board.beneficiaries.filter((item) => item.id !== id),
    });
  }

  function resetActivityForm() {
    setEditingActivityId(null);
    setActivityTitle("");
    setActivityBeneficiaryId(board.beneficiaries[0]?.id || "");
    setActivityDate(new Date().toISOString().slice(0, 10));
    setActivityRate(String(summary.budget?.usdRate || 4000));
    setActivityReceived("");
    setActivityNotes("");
    setActivityCosts(emptyActivityCosts());
  }

  function editActivity(activity: Activity) {
    setEditingActivityId(activity.id);
    setActivityTitle(activity.title);
    setActivityBeneficiaryId(activity.beneficiaryId);
    setActivityDate(activity.date);
    setActivityRate(String(activity.usdRate || 4000));
    setActivityReceived(String(activity.receivedCop || ""));
    setActivityNotes(activity.notes || "");
    setActivityCosts({
      materials: {
        amountCop: activity.costs.materials.amountCop,
        files: [...activity.costs.materials.files],
      },
      logistics: {
        amountCop: activity.costs.logistics.amountCop,
        files: [...activity.costs.logistics.files],
      },
      collaborations: {
        amountCop: activity.costs.collaborations.amountCop,
        files: [...activity.costs.collaborations.files],
      },
      contingencies: {
        amountCop: activity.costs.contingencies.amountCop,
        files: [...activity.costs.contingencies.files],
      },
    });
    setTab("activities");
  }

  async function saveActivity(event: FormEvent) {
    event.preventDefault();
    if (!activityTitle.trim()) return;
    const beneficiaryId = activityBeneficiaryId || board.beneficiaries[0]?.id || "";
    if (!beneficiaryId) {
      alert("Selecciona un beneficiario");
      return;
    }
    const now = new Date().toISOString();
    const payload: Activity = {
      id: editingActivityId || createId("act"),
      beneficiaryId,
      title: activityTitle.trim(),
      date: activityDate,
      usdRate: numInput(activityRate) || 4000,
      receivedCop: numInput(activityReceived),
      costs: activityCosts,
      notes: activityNotes.trim(),
      createdAt:
        board.activities.find((item) => item.id === editingActivityId)?.createdAt || now,
      updatedAt: now,
    };

    const activities = editingActivityId
      ? board.activities.map((item) => (item.id === editingActivityId ? payload : item))
      : [payload, ...board.activities];

    const ok = await persist({ ...board, activities });
    if (ok) resetActivityForm();
  }

  function removeActivity(id: string) {
    if (!window.confirm("¿Eliminar esta actividad?")) return;
    void persist({
      ...board,
      activities: board.activities.filter((item) => item.id !== id),
    });
    if (editingActivityId === id) resetActivityForm();
    if (invoicesActivityId === id) setInvoicesActivityId(null);
  }

  function printActivityReport(activity: Activity) {
    const beneficiary =
      board.beneficiaries.find((item) => item.id === activity.beneficiaryId)?.name || "—";
    const spent = activityTotalCop(activity);
    const received = activity.receivedCop || 0;
    const balance = activityBalanceCop(activity);
    const attachments = activityAttachments(activity);

    const costRows = COST_CATEGORIES.map((cat) => {
      const bucket = activity.costs[cat.value];
      const amount = bucket?.amountCop || 0;
      const files = (bucket?.files || [])
        .map(
          (file) =>
            `<div><a href="${escapeHtml(file.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(file.name)}</a></div>`,
        )
        .join("") || "—";
      return `<tr>
        <td>${escapeHtml(cat.label)}</td>
        <td>${escapeHtml(formatCop(amount))}</td>
        <td>${escapeHtml(formatUsdFromCop(amount, activity.usdRate))}</td>
        <td>${files}</td>
      </tr>`;
    }).join("");

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Informe actividad — ${escapeHtml(activity.title)}</title>
  <style>
    body { font-family: Arial, Helvetica, sans-serif; color: #111; padding: 28px; }
    h1 { font-size: 20px; margin: 0 0 8px; }
    h2 { font-size: 14px; margin: 22px 0 8px; }
    p { margin: 0 0 6px; font-size: 13px; color: #444; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 8px; }
    th, td { border: 1px solid #ccc; padding: 8px; text-align: left; vertical-align: top; word-break: break-word; }
    th { background: #f3f3f3; font-size: 10px; text-transform: uppercase; }
    a { color: #e00d45; }
    .ok { color: #177245; font-weight: 700; }
    .bad { color: #e00d45; font-weight: 700; }
    @media print { body { padding: 0; } @page { margin: 12mm; } }
  </style>
</head>
<body>
  <h1>Informe de actividad</h1>
  <p><strong>Taller:</strong> ${escapeHtml(activity.title)}</p>
  <p><strong>Beneficiario:</strong> ${escapeHtml(beneficiary)}</p>
  <p><strong>Fecha:</strong> ${escapeHtml(activity.date)}</p>
  <p><strong>Tipo de cambio:</strong> ${escapeHtml(String(activity.usdRate))} COP por 1 USD</p>
  ${activity.notes ? `<p><strong>Notas:</strong> ${escapeHtml(activity.notes)}</p>` : ""}

  <h2>Cruce recibido vs gastado</h2>
  <table>
    <thead>
      <tr>
        <th>Concepto</th>
        <th>COP</th>
        <th>USD</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>Dinero dispuesto / recibido</td>
        <td>${escapeHtml(formatCop(received))}</td>
        <td>${escapeHtml(formatUsdFromCop(received, activity.usdRate))}</td>
      </tr>
      <tr>
        <td>Gastado en el taller</td>
        <td>${escapeHtml(formatCop(spent))}</td>
        <td>${escapeHtml(formatUsdFromCop(spent, activity.usdRate))}</td>
      </tr>
      <tr>
        <td>${balance >= 0 ? "Sobrante" : "Faltante"}</td>
        <td class="${balance >= 0 ? "ok" : "bad"}">${escapeHtml(formatCop(Math.abs(balance)))}</td>
        <td class="${balance >= 0 ? "ok" : "bad"}">${escapeHtml(formatUsdFromCop(Math.abs(balance), activity.usdRate))}</td>
      </tr>
    </tbody>
  </table>

  <h2>Costos por rubro</h2>
  <table>
    <thead>
      <tr>
        <th>Rubro</th>
        <th>COP</th>
        <th>USD</th>
        <th>Facturas</th>
      </tr>
    </thead>
    <tbody>${costRows}</tbody>
  </table>

  <h2>Facturas adjuntas (${attachments.length})</h2>
  ${
    attachments.length
      ? `<ul>${attachments
          .map(
            (file) =>
              `<li>${escapeHtml(file.category)}: <a href="${escapeHtml(file.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(file.name)}</a></li>`,
          )
          .join("")}</ul>`
      : "<p>Sin facturas adjuntas.</p>"
  }
</body>
</html>`;

    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, "_blank");
    if (!win) {
      URL.revokeObjectURL(url);
      alert("Permite ventanas emergentes para imprimir el informe");
      return;
    }
    window.setTimeout(() => {
      try {
        win.focus();
        win.print();
      } catch {
        // manual print
      }
    }, 400);
    window.setTimeout(() => URL.revokeObjectURL(url), 120000);
  }

  async function addCostFile(category: CostCategory, file: File) {
    setUploadingCost(category);
    const uploaded = await uploadSupport(file);
    setUploadingCost(null);
    if (!uploaded) return;
    setActivityCosts((prev) => ({
      ...prev,
      [category]: {
        ...prev[category],
        files: [...prev[category].files, uploaded],
      },
    }));
  }

  function removeCostFile(category: CostCategory, fileId: string) {
    setActivityCosts((prev) => ({
      ...prev,
      [category]: {
        ...prev[category],
        files: prev[category].files.filter((item) => item.id !== fileId),
      },
    }));
  }

  function resetExpenseForm() {
    setEditingExpenseId(null);
    setExpenseTitle("");
    setExpenseCategory("equipment");
    setExpenseDate(new Date().toISOString().slice(0, 10));
    setExpenseAmount("");
    setExpenseRate(String(summary.budget?.usdRate || 4000));
    setExpenseNotes("");
    setExpenseFiles([]);
  }

  function editExpense(expense: OperationalExpense) {
    setEditingExpenseId(expense.id);
    setExpenseTitle(expense.title);
    setExpenseCategory(expense.category);
    setExpenseDate(expense.date);
    setExpenseAmount(String(expense.amountCop || ""));
    setExpenseRate(String(expense.usdRate || 4000));
    setExpenseNotes(expense.notes || "");
    setExpenseFiles([...expense.files]);
    setTab("expenses");
  }

  async function saveExpense(event: FormEvent) {
    event.preventDefault();
    if (!expenseTitle.trim()) return;
    const now = new Date().toISOString();
    const payload: OperationalExpense = {
      id: editingExpenseId || createId("exp"),
      category: expenseCategory,
      title: expenseTitle.trim(),
      date: expenseDate,
      amountCop: numInput(expenseAmount),
      usdRate: numInput(expenseRate) || 4000,
      files: expenseFiles,
      notes: expenseNotes.trim(),
      createdAt:
        board.expenses.find((item) => item.id === editingExpenseId)?.createdAt || now,
      updatedAt: now,
    };
    const expenses = editingExpenseId
      ? board.expenses.map((item) => (item.id === editingExpenseId ? payload : item))
      : [payload, ...board.expenses];
    const ok = await persist({ ...board, expenses });
    if (ok) resetExpenseForm();
  }

  function removeExpense(id: string) {
    if (!window.confirm("¿Eliminar este gasto operativo?")) return;
    void persist({
      ...board,
      expenses: board.expenses.filter((item) => item.id !== id),
    });
    if (editingExpenseId === id) resetExpenseForm();
  }

  async function addExpenseFile(file: File) {
    setUploadingExpense(true);
    const uploaded = await uploadSupport(file);
    setUploadingExpense(false);
    if (!uploaded) return;
    setExpenseFiles((prev) => [...prev, uploaded]);
  }

  const yearActivities = board.activities.filter((item) => item.date.startsWith(String(year)));
  const yearExpenses = board.expenses.filter((item) => item.date.startsWith(String(year)));
  const activityDraftTotal = Object.values(activityCosts).reduce(
    (acc, item) => acc + (item.amountCop || 0),
    0,
  );
  const activityDraftReceived = numInput(activityReceived);
  const activityDraftBalance = activityDraftReceived - activityDraftTotal;

  if (loading) {
    return <div className="p-10 text-sm text-[color:var(--muted)]">Cargando contabilidad...</div>;
  }

  return (
    <div className="flex min-h-[100svh] flex-col bg-[color:var(--mist)]">
      <header className="sticky top-0 z-20 border-b border-[color:var(--line)] bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-4 md:px-8">
          <div>
            <p className="font-[family-name:var(--font-display)] text-lg font-bold text-[color:var(--accent)]">
              Contabilidad
            </p>
            <p className="text-xs text-[color:var(--muted)]">
              {saving ? "Guardando..." : statusMsg || "Presupuesto anual y control de costos"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 text-xs font-semibold text-[color:var(--muted)]">
              Año
              <select
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="border border-[color:var(--line)] bg-white px-2 py-1.5 text-sm text-[color:var(--ink)]"
              >
                {[...yearOptions].map((y) => (
                  <option key={y} value={y}>
                    {y}
                    {board.budgets.some((b) => b.year === y) ? " · con presupuesto" : ""}
                  </option>
                ))}
              </select>
            </label>
            <Link href="/admin" className="border border-[color:var(--line)] px-3 py-2 text-xs font-semibold">
              Panel
            </Link>
            <button
              type="button"
              onClick={() => void logout()}
              className="border border-[color:var(--line)] px-3 py-2 text-xs font-semibold"
            >
              Salir
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-8 pb-12 md:px-8">
        <div className="mb-6 flex flex-wrap gap-2 border border-[color:var(--line)] bg-white p-1 w-fit">
          {(
            [
              ["summary", "Resumen"],
              ["budget", "Presupuesto"],
              ["beneficiaries", "Beneficiarios"],
              ["activities", "Actividades"],
              ["expenses", "Gastos operativos"],
              ["reports", "Reportes"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`px-3 py-2 text-sm font-semibold ${
                tab === id ? "bg-[color:var(--accent)] text-white" : ""
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "summary" && (
          <section className="space-y-5">
            <div>
              <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold">
                Control {year}
              </h1>
                <p className="mt-2 text-sm text-[color:var(--muted)]">
                  Del presupuesto sale lo dispuesto a talleres, salarios y operativos. En cada
                  taller se cruza lo recibido con lo gastado.
                </p>
              </div>

            {(() => {
              const budgetAlarm = getBudgetAlarm(board, year);
              if (!budgetAlarm || budgetAlarm.level === "ok") return null;
              const critical = budgetAlarm.level === "critical";
              return (
                <div
                  className={`border-l-4 bg-white px-4 py-3 border border-[color:var(--line)] ${
                    critical ? "border-l-[#dc2626]" : "border-l-[#ca8a04]"
                  }`}
                >
                  <p className="font-semibold">
                    {critical
                      ? "Alarma: presupuesto anual excedido"
                      : `Alarma: cerca del tope (≥${BUDGET_WARNING_PERCENT}%)`}
                  </p>
                  <p className="mt-1 text-sm text-[color:var(--muted)]">{budgetAlarm.message}</p>
                </div>
              );
            })()}

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {[
                { label: "Presupuesto", cop: summary.totalCop },
                { label: "Salarios", cop: summary.salariesCop },
                {
                  label: "Dispuesto a talleres",
                  cop: summary.activitiesReceivedCop,
                },
                {
                  label: "Operativos",
                  cop: summary.expensesCop,
                },
                { label: "Disponible", cop: summary.availableCop },
              ].map((card) => (
                <div key={card.label} className="border border-[color:var(--line)] bg-white p-4">
                  <p className="text-[10px] font-semibold uppercase text-[color:var(--muted)]">
                    {card.label}
                  </p>
                  <p className="mt-2 font-[family-name:var(--font-display)] text-xl font-bold">
                    {formatUsdFromCop(card.cop, summary.budget?.usdRate || 4000)}
                  </p>
                  <p className="text-sm text-[color:var(--muted)]">{formatCop(card.cop)}</p>
                </div>
              ))}
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {[
                {
                  label: "Recibido en talleres",
                  cop: summary.activitiesReceivedCop,
                },
                {
                  label: "Gastado en talleres",
                  cop: summary.activitiesSpentCop,
                },
                {
                  label:
                    summary.activitiesBalanceCop >= 0
                      ? "Sobrante (cruce)"
                      : "Faltante (cruce)",
                  cop: Math.abs(summary.activitiesBalanceCop),
                },
              ].map((card) => (
                <div key={card.label} className="border border-[color:var(--line)] bg-white p-4">
                  <p className="text-[10px] font-semibold uppercase text-[color:var(--muted)]">
                    {card.label}
                  </p>
                  <p className="mt-2 font-[family-name:var(--font-display)] text-lg font-bold">
                    {formatUsdFromCop(card.cop, summary.budget?.usdRate || 4000)}
                  </p>
                  <p className="text-sm text-[color:var(--muted)]">{formatCop(card.cop)}</p>
                </div>
              ))}
            </div>

            <div className="border border-[color:var(--line)] bg-white p-4">
              <div className="mb-2 flex justify-between text-xs font-semibold">
                <span className="text-[color:var(--muted)]">Uso del presupuesto</span>
                <span>{summary.usedPercent}%</span>
              </div>
              <div className="h-2 bg-[color:var(--mist)]">
                <div
                  className={`h-full transition-all ${
                    summary.usedPercent > 100
                      ? "bg-[#dc2626]"
                      : summary.usedPercent >= BUDGET_WARNING_PERCENT
                        ? "bg-[#ca8a04]"
                        : "bg-[color:var(--accent)]"
                  }`}
                  style={{ width: `${Math.min(summary.usedPercent, 100)}%` }}
                />
              </div>
              <p className="mt-3 text-sm text-[color:var(--muted)]">
                {summary.activitiesCount} actividades · {summary.expensesCount} gastos
                operativos · {board.beneficiaries.length} beneficiarios
              </p>
            </div>

            {!summary.budget ? (
              <div className="border border-[color:var(--line)] bg-white p-6">
                <p className="text-sm text-[color:var(--muted)]">
                  Aún no hay presupuesto para {year}.
                </p>
                <button
                  type="button"
                  onClick={() => setTab("budget")}
                  className="mt-3 text-sm font-semibold text-[color:var(--accent)]"
                >
                  Crear presupuesto
                </button>
              </div>
            ) : null}
          </section>
        )}

        {tab === "budget" && (
          <section className="grid gap-6 lg:grid-cols-[380px_1fr]">
            <form onSubmit={saveBudget} className="h-fit space-y-3 border border-[color:var(--line)] bg-white p-5">
              <div className="flex items-start justify-between gap-3">
                <h2 className="font-[family-name:var(--font-display)] text-xl font-bold">
                  {editingBudgetId ? "Editar presupuesto" : "Nuevo presupuesto"}
                </h2>
                {editingBudgetId ? (
                  <button
                    type="button"
                    onClick={resetBudgetForm}
                    className="text-xs font-semibold text-[color:var(--muted)]"
                  >
                    Cancelar
                  </button>
                ) : null}
              </div>

              <label className="block space-y-1">
                <span className="text-xs font-semibold uppercase text-[color:var(--muted)]">
                  Año del presupuesto
                </span>
                <select
                  value={budgetYear}
                  onChange={(e) => setBudgetYear(Number(e.target.value))}
                  className="w-full border border-[color:var(--line)] px-3 py-2 text-sm"
                >
                  {yearOptions.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block space-y-1">
                <span className="text-xs font-semibold uppercase text-[color:var(--muted)]">
                  Monto en USD
                </span>
                <input
                  required
                  value={budgetUsd}
                  onChange={(e) => setBudgetUsd(e.target.value)}
                  placeholder="Ej: 12000"
                  className="w-full border border-[color:var(--line)] px-3 py-2 text-sm"
                />
              </label>

              <label className="block space-y-1">
                <span className="text-xs font-semibold uppercase text-[color:var(--muted)]">
                  Salarios en USD (valor general)
                </span>
                <input
                  value={budgetSalariesUsd}
                  onChange={(e) => setBudgetSalariesUsd(e.target.value)}
                  placeholder="Ej: 3000"
                  className="w-full border border-[color:var(--line)] px-3 py-2 text-sm"
                />
              </label>

              <label className="block space-y-1">
                <span className="text-xs font-semibold uppercase text-[color:var(--muted)]">
                  Tipo de cambio (COP por 1 USD)
                </span>
                <input
                  required
                  value={budgetRate}
                  onChange={(e) => setBudgetRate(e.target.value)}
                  className="w-full border border-[color:var(--line)] px-3 py-2 text-sm"
                />
              </label>

              <div className="space-y-1 text-sm text-[color:var(--muted)]">
                <p>
                  Presupuesto en pesos:{" "}
                  <span className="font-semibold text-[color:var(--ink)]">
                    {formatCop(budgetCopPreview)}
                  </span>
                </p>
                <p>
                  Salarios en pesos:{" "}
                  <span className="font-semibold text-[color:var(--ink)]">
                    {formatCop(salariesCopPreview)}
                  </span>
                </p>
              </div>

              <label className="block space-y-1">
                <span className="text-xs font-semibold uppercase text-[color:var(--muted)]">
                  Nota
                </span>
                <textarea
                  value={budgetNotes}
                  onChange={(e) => setBudgetNotes(e.target.value)}
                  rows={3}
                  placeholder="Ej: Fondo anual Inspiralab"
                  className="w-full border border-[color:var(--line)] px-3 py-2 text-sm"
                />
              </label>

              <button
                type="submit"
                className="w-full bg-[color:var(--accent)] py-2.5 text-sm font-semibold text-white"
              >
                {editingBudgetId ? "Actualizar presupuesto" : "Crear presupuesto"}
              </button>
            </form>

            <div className="overflow-x-auto border border-[color:var(--line)] bg-white">
              <div className="border-b border-[color:var(--line)] px-4 py-3">
                <h3 className="font-[family-name:var(--font-display)] text-lg font-bold">
                  Presupuestos creados
                </h3>
              </div>
              <table className="min-w-full text-left text-sm">
                <thead className="bg-[color:var(--mist)]/70 text-[10px] font-semibold uppercase text-[color:var(--muted)]">
                  <tr>
                    <th className="px-3 py-3">Año</th>
                    <th className="px-3 py-3">Presupuesto USD</th>
                    <th className="px-3 py-3">Salarios USD</th>
                    <th className="px-3 py-3">Presupuesto COP</th>
                    <th className="px-3 py-3">Salarios COP</th>
                    <th className="px-3 py-3">Nota</th>
                    <th className="px-3 py-3">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[color:var(--line)]">
                  {board.budgets.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-3 py-8 text-center text-[color:var(--muted)]">
                        Aún no hay presupuestos. Créalos a la izquierda.
                      </td>
                    </tr>
                  ) : (
                    [...board.budgets]
                      .sort((a, b) => a.year - b.year)
                      .map((budget) => (
                        <tr key={budget.id} className="align-top">
                          <td className="px-3 py-3 font-semibold">{budget.year}</td>
                          <td className="px-3 py-3">
                            {formatUsdFromCop(budget.amountCop, budget.usdRate)}
                          </td>
                          <td className="px-3 py-3">
                            {formatUsdFromCop(budget.salariesCop || 0, budget.usdRate)}
                          </td>
                          <td className="px-3 py-3">{formatCop(budget.amountCop)}</td>
                          <td className="px-3 py-3">{formatCop(budget.salariesCop || 0)}</td>
                          <td className="px-3 py-3 text-[color:var(--muted)]">
                            {budget.notes || "—"}
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex gap-3">
                              <button
                                type="button"
                                onClick={() => editBudget(budget)}
                                className="text-xs font-semibold text-[color:var(--accent)]"
                              >
                                Editar
                              </button>
                              <button
                                type="button"
                                onClick={() => removeBudget(budget.id)}
                                className="text-xs font-semibold text-[color:var(--muted)]"
                              >
                                Eliminar
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {tab === "beneficiaries" && (
          <section className="grid gap-6 lg:grid-cols-[340px_1fr]">
            <form onSubmit={addBeneficiary} className="h-fit space-y-3 border border-[color:var(--line)] bg-white p-5">
              <h2 className="font-[family-name:var(--font-display)] text-xl font-bold">
                Nuevo beneficiario
              </h2>
              <input
                required
                placeholder="Nombre (ej: Ángeles Custodios)"
                value={beneficiaryName}
                onChange={(e) => setBeneficiaryName(e.target.value)}
                className="w-full border border-[color:var(--line)] px-3 py-2 text-sm"
              />
              <input
                placeholder="Contacto"
                value={beneficiaryContact}
                onChange={(e) => setBeneficiaryContact(e.target.value)}
                className="w-full border border-[color:var(--line)] px-3 py-2 text-sm"
              />
              <textarea
                placeholder="Notas"
                value={beneficiaryNotes}
                onChange={(e) => setBeneficiaryNotes(e.target.value)}
                rows={3}
                className="w-full border border-[color:var(--line)] px-3 py-2 text-sm"
              />
              <button
                type="submit"
                className="w-full bg-[color:var(--accent)] py-2.5 text-sm font-semibold text-white"
              >
                Agregar beneficiario
              </button>
            </form>

            <div className="border border-[color:var(--line)] bg-white">
              {board.beneficiaries.length === 0 ? (
                <p className="p-6 text-sm text-[color:var(--muted)]">Aún no hay beneficiarios.</p>
              ) : (
                <ul className="divide-y divide-[color:var(--line)]">
                  {board.beneficiaries.map((item) => {
                    const count = board.activities.filter((a) => a.beneficiaryId === item.id).length;
                    return (
                      <li key={item.id} className="flex items-start justify-between gap-4 p-4">
                        <div>
                          <p className="font-semibold">{item.name}</p>
                          <p className="text-sm text-[color:var(--muted)]">
                            {item.contact || "Sin contacto"} · {count} actividades
                          </p>
                          {item.notes ? (
                            <p className="mt-1 text-xs text-[color:var(--muted)]">{item.notes}</p>
                          ) : null}
                        </div>
                        <button
                          type="button"
                          onClick={() => removeBeneficiary(item.id)}
                          className="text-xs font-semibold text-[color:var(--accent)]"
                        >
                          Eliminar
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </section>
        )}

        {tab === "activities" && (
          <section className="space-y-6">
            <form onSubmit={(e) => void saveActivity(e)} className="space-y-4 border border-[color:var(--line)] bg-white p-5">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <h2 className="font-[family-name:var(--font-display)] text-xl font-bold">
                  {editingActivityId ? "Editar actividad" : "Nueva actividad / taller"}
                </h2>
                {editingActivityId ? (
                  <button
                    type="button"
                    onClick={resetActivityForm}
                    className="text-sm font-semibold text-[color:var(--muted)]"
                  >
                    Cancelar edición
                  </button>
                ) : null}
              </div>

              {board.beneficiaries.length === 0 ? (
                <p className="text-sm text-[color:var(--muted)]">
                  Primero crea beneficiarios.{" "}
                  <button
                    type="button"
                    onClick={() => setTab("beneficiaries")}
                    className="font-semibold text-[color:var(--accent)]"
                  >
                    Ir a Beneficiarios
                  </button>
                </p>
              ) : (
                <>
                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="block space-y-1">
                      <span className="text-xs font-semibold uppercase text-[color:var(--muted)]">
                        Nombre del taller
                      </span>
                      <input
                        required
                        value={activityTitle}
                        onChange={(e) => setActivityTitle(e.target.value)}
                        placeholder="Ej: El sueño que nos une"
                        className="w-full border border-[color:var(--line)] px-3 py-2 text-sm"
                      />
                    </label>
                    <label className="block space-y-1">
                      <span className="text-xs font-semibold uppercase text-[color:var(--muted)]">
                        Beneficiario
                      </span>
                      <select
                        required
                        value={activityBeneficiaryId || board.beneficiaries[0]?.id || ""}
                        onChange={(e) => setActivityBeneficiaryId(e.target.value)}
                        className="w-full border border-[color:var(--line)] px-3 py-2 text-sm"
                      >
                        {board.beneficiaries.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block space-y-1">
                      <span className="text-xs font-semibold uppercase text-[color:var(--muted)]">
                        Fecha del taller
                      </span>
                      <input
                        type="date"
                        required
                        value={activityDate}
                        onChange={(e) => setActivityDate(e.target.value)}
                        className="w-full border border-[color:var(--line)] px-3 py-2 text-sm"
                      />
                    </label>
                    <label className="block space-y-1">
                      <span className="text-xs font-semibold uppercase text-[color:var(--muted)]">
                        Tipo de cambio
                      </span>
                      <input
                        value={activityRate}
                        onChange={(e) => setActivityRate(e.target.value)}
                        className="w-full border border-[color:var(--line)] px-3 py-2 text-sm"
                      />
                    </label>
                    <label className="block space-y-1 md:col-span-2">
                      <span className="text-xs font-semibold uppercase text-[color:var(--muted)]">
                        Dinero dispuesto / recibido para el taller (COP)
                      </span>
                      <input
                        required
                        value={activityReceived}
                        onChange={(e) => setActivityReceived(e.target.value)}
                        placeholder="Ej: 2000000 — sale del presupuesto anual"
                        className="w-full border border-[color:var(--line)] px-3 py-2 text-sm outline-none focus:border-[color:var(--accent)]"
                      />
                      <span className="block text-xs text-[color:var(--muted)]">
                        Equivale a{" "}
                        {formatUsdFromCop(
                          numInput(activityReceived),
                          numInput(activityRate) || 4000,
                        )}
                        . Sobre este monto se ajustan los gastos del taller.
                      </span>
                    </label>
                  </div>

                  <p className="text-sm text-[color:var(--muted)]">
                    En cada rubro puedes adjuntar facturas o soportes (PDF o imagen).
                  </p>

                  <div className="grid gap-3 md:grid-cols-2">
                    {COST_CATEGORIES.map((cat) => (
                      <div key={cat.value} className="space-y-2 border border-[color:var(--line)] p-3">
                        <p className="text-sm font-bold">{cat.label}</p>
                        <input
                          type="number"
                          min={0}
                          value={activityCosts[cat.value].amountCop || ""}
                          onChange={(e) =>
                            setActivityCosts((prev) => ({
                              ...prev,
                              [cat.value]: {
                                ...prev[cat.value],
                                amountCop: numInput(e.target.value),
                              },
                            }))
                          }
                          placeholder="Costo COP"
                          className="w-full border border-[color:var(--line)] px-3 py-2 text-sm"
                        />
                        <p className="text-xs text-[color:var(--muted)]">
                          {formatUsdFromCop(
                            activityCosts[cat.value].amountCop,
                            numInput(activityRate) || 4000,
                          )}
                        </p>

                        <div className="space-y-2 border border-dashed border-[color:var(--line)] bg-[color:var(--mist)]/40 p-2">
                          <p className="text-[10px] font-semibold uppercase text-[color:var(--muted)]">
                            Facturas / soportes
                          </p>
                          <label className="flex cursor-pointer items-center justify-center border border-[color:var(--line)] bg-white px-3 py-2 text-xs font-semibold text-[color:var(--accent)]">
                            {uploadingCost === cat.value
                              ? "Subiendo..."
                              : "+ Adjuntar factura"}
                            <input
                              type="file"
                              accept="image/*,application/pdf"
                              disabled={uploadingCost === cat.value}
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) void addCostFile(cat.value, file);
                                e.target.value = "";
                              }}
                              className="hidden"
                            />
                          </label>
                          {activityCosts[cat.value].files.length === 0 ? (
                            <p className="text-[11px] text-[color:var(--muted)]">
                              Sin archivos aún
                            </p>
                          ) : (
                            <ul className="space-y-1">
                              {activityCosts[cat.value].files.map((file) => (
                                <li
                                  key={file.id}
                                  className="flex items-center justify-between gap-2 text-xs"
                                >
                                  <a
                                    href={file.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="truncate font-semibold text-[color:var(--accent)]"
                                  >
                                    {file.name}
                                  </a>
                                  <button
                                    type="button"
                                    onClick={() => removeCostFile(cat.value, file.id)}
                                    className="shrink-0 text-[color:var(--muted)]"
                                  >
                                    Quitar
                                  </button>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="grid gap-3 border border-[color:var(--line)] bg-[color:var(--mist)]/50 p-4 sm:grid-cols-3">
                    <div>
                      <p className="text-xs font-semibold uppercase text-[color:var(--muted)]">
                        Recibido
                      </p>
                      <p className="font-[family-name:var(--font-display)] text-base font-bold">
                        {formatCop(activityDraftReceived)}
                      </p>
                      <p className="text-xs text-[color:var(--muted)]">
                        {formatUsdFromCop(
                          activityDraftReceived,
                          numInput(activityRate) || 4000,
                        )}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase text-[color:var(--muted)]">
                        Gastado
                      </p>
                      <p className="font-[family-name:var(--font-display)] text-base font-bold">
                        {formatCop(activityDraftTotal)}
                      </p>
                      <p className="text-xs text-[color:var(--muted)]">
                        {formatUsdFromCop(activityDraftTotal, numInput(activityRate) || 4000)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase text-[color:var(--muted)]">
                        Cruce {activityDraftBalance >= 0 ? "(sobra)" : "(falta)"}
                      </p>
                      <p
                        className={`font-[family-name:var(--font-display)] text-base font-bold ${
                          activityDraftBalance >= 0
                            ? "text-[#177245]"
                            : "text-[color:var(--accent)]"
                        }`}
                      >
                        {formatCop(Math.abs(activityDraftBalance))}
                      </p>
                      <p className="text-xs text-[color:var(--muted)]">
                        {formatUsdFromCop(
                          Math.abs(activityDraftBalance),
                          numInput(activityRate) || 4000,
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-end gap-3">
                    <button
                      type="submit"
                      className="bg-[color:var(--accent)] px-5 py-2.5 text-sm font-semibold text-white"
                    >
                      {editingActivityId ? "Actualizar actividad" : "Guardar actividad"}
                    </button>
                  </div>

                  <textarea
                    placeholder="Notas del taller"
                    value={activityNotes}
                    onChange={(e) => setActivityNotes(e.target.value)}
                    rows={2}
                    className="w-full border border-[color:var(--line)] px-3 py-2 text-sm"
                  />
                </>
              )}
            </form>

            <div className="overflow-x-auto border border-[color:var(--line)] bg-white">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-[color:var(--mist)]/70 text-[10px] font-semibold uppercase text-[color:var(--muted)]">
                  <tr>
                    <th className="px-3 py-3">Taller</th>
                    <th className="px-3 py-3">Beneficiario</th>
                    <th className="px-3 py-3">Fecha</th>
                    <th className="px-3 py-3">Recibido</th>
                    <th className="px-3 py-3">Gastado</th>
                    <th className="px-3 py-3">Cruce</th>
                    <th className="px-3 py-3">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[color:var(--line)]">
                  {yearActivities.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-3 py-8 text-center text-[color:var(--muted)]">
                        No hay actividades en {year}.
                      </td>
                    </tr>
                  ) : (
                    yearActivities.map((activity) => {
                      const beneficiary = board.beneficiaries.find(
                        (item) => item.id === activity.beneficiaryId,
                      );
                      const spent = activityTotalCop(activity);
                      const received = activity.receivedCop || 0;
                      const balance = activityBalanceCop(activity);
                      return (
                        <tr key={activity.id}>
                          <td className="px-3 py-3 font-semibold">{activity.title}</td>
                          <td className="px-3 py-3">{beneficiary?.name || "—"}</td>
                          <td className="whitespace-nowrap px-3 py-3">{activity.date}</td>
                          <td className="px-3 py-3">
                            <div>{formatCop(received)}</div>
                            <div className="text-xs text-[color:var(--muted)]">
                              {formatUsdFromCop(received, activity.usdRate)}
                            </div>
                          </td>
                          <td className="px-3 py-3">
                            <div>{formatCop(spent)}</div>
                            <div className="text-xs text-[color:var(--muted)]">
                              {formatUsdFromCop(spent, activity.usdRate)}
                            </div>
                          </td>
                          <td className="px-3 py-3">
                            <div
                              className={`font-semibold ${
                                balance >= 0
                                  ? "text-[#177245]"
                                  : "text-[color:var(--accent)]"
                              }`}
                            >
                              {balance >= 0 ? "Sobra " : "Falta "}
                              {formatCop(Math.abs(balance))}
                            </div>
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex flex-wrap gap-x-3 gap-y-1">
                              <button
                                type="button"
                                onClick={() => setInvoicesActivityId(activity.id)}
                                className="text-xs font-semibold text-[color:var(--accent)]"
                              >
                                Ver facturas
                              </button>
                              <button
                                type="button"
                                onClick={() => printActivityReport(activity)}
                                className="text-xs font-semibold text-[color:var(--accent)]"
                              >
                                Imprimir informe
                              </button>
                              <button
                                type="button"
                                onClick={() => editActivity(activity)}
                                className="text-xs font-semibold text-[color:var(--accent)]"
                              >
                                Editar
                              </button>
                              <button
                                type="button"
                                onClick={() => removeActivity(activity.id)}
                                className="text-xs font-semibold text-[color:var(--muted)]"
                              >
                                Eliminar
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {tab === "expenses" && (
          <section className="space-y-6">
            <form onSubmit={(e) => void saveExpense(e)} className="space-y-4 border border-[color:var(--line)] bg-white p-5">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <h2 className="font-[family-name:var(--font-display)] text-xl font-bold">
                  {editingExpenseId ? "Editar gasto operativo" : "Nuevo gasto operativo"}
                </h2>
                {editingExpenseId ? (
                  <button
                    type="button"
                    onClick={resetExpenseForm}
                    className="text-sm font-semibold text-[color:var(--muted)]"
                  >
                    Cancelar edición
                  </button>
                ) : null}
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <label className="block space-y-1">
                  <span className="text-xs font-semibold uppercase text-[color:var(--muted)]">
                    Concepto
                  </span>
                  <input
                    required
                    value={expenseTitle}
                    onChange={(e) => setExpenseTitle(e.target.value)}
                    placeholder="Ej: Internet oficina"
                    className="w-full border border-[color:var(--line)] px-3 py-2 text-sm"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-xs font-semibold uppercase text-[color:var(--muted)]">
                    Categoría
                  </span>
                  <select
                    value={expenseCategory}
                    onChange={(e) => setExpenseCategory(e.target.value as ExpenseCategory)}
                    className="w-full border border-[color:var(--line)] px-3 py-2 text-sm"
                  >
                    {EXPENSE_CATEGORIES.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block space-y-1">
                  <span className="text-xs font-semibold uppercase text-[color:var(--muted)]">
                    Fecha
                  </span>
                  <input
                    type="date"
                    required
                    value={expenseDate}
                    onChange={(e) => setExpenseDate(e.target.value)}
                    className="w-full border border-[color:var(--line)] px-3 py-2 text-sm"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-xs font-semibold uppercase text-[color:var(--muted)]">
                    Monto COP
                  </span>
                  <input
                    required
                    value={expenseAmount}
                    onChange={(e) => setExpenseAmount(e.target.value)}
                    className="w-full border border-[color:var(--line)] px-3 py-2 text-sm"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-xs font-semibold uppercase text-[color:var(--muted)]">
                    Tipo de cambio
                  </span>
                  <input
                    value={expenseRate}
                    onChange={(e) => setExpenseRate(e.target.value)}
                    className="w-full border border-[color:var(--line)] px-3 py-2 text-sm"
                  />
                </label>
                <div className="space-y-1">
                  <span className="text-xs font-semibold uppercase text-[color:var(--muted)]">
                    Soportes
                  </span>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    disabled={uploadingExpense}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void addExpenseFile(file);
                      e.target.value = "";
                    }}
                    className="block w-full text-xs"
                  />
                  <ul className="space-y-1">
                    {expenseFiles.map((file) => (
                      <li key={file.id} className="flex items-center justify-between gap-2 text-xs">
                        <a
                          href={file.url}
                          target="_blank"
                          rel="noreferrer"
                          className="truncate font-semibold text-[color:var(--accent)]"
                        >
                          {file.name}
                        </a>
                        <button
                          type="button"
                          onClick={() =>
                            setExpenseFiles((prev) => prev.filter((item) => item.id !== file.id))
                          }
                          className="text-[color:var(--muted)]"
                        >
                          Quitar
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <p className="text-sm text-[color:var(--muted)]">
                Equivale a{" "}
                {formatUsdFromCop(numInput(expenseAmount), numInput(expenseRate) || 4000)}
              </p>

              <textarea
                placeholder="Notas"
                value={expenseNotes}
                onChange={(e) => setExpenseNotes(e.target.value)}
                rows={2}
                className="w-full border border-[color:var(--line)] px-3 py-2 text-sm"
              />

              <button
                type="submit"
                className="bg-[color:var(--accent)] px-5 py-2.5 text-sm font-semibold text-white"
              >
                {editingExpenseId ? "Actualizar gasto" : "Guardar gasto"}
              </button>
            </form>

            <div className="overflow-x-auto border border-[color:var(--line)] bg-white">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-[color:var(--mist)]/70 text-[10px] font-semibold uppercase text-[color:var(--muted)]">
                  <tr>
                    <th className="px-3 py-3">Concepto</th>
                    <th className="px-3 py-3">Categoría</th>
                    <th className="px-3 py-3">Fecha</th>
                    <th className="px-3 py-3">COP</th>
                    <th className="px-3 py-3">USD</th>
                    <th className="px-3 py-3">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[color:var(--line)]">
                  {yearExpenses.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-3 py-8 text-center text-[color:var(--muted)]">
                        No hay gastos operativos en {year}.
                      </td>
                    </tr>
                  ) : (
                    yearExpenses.map((expense) => (
                      <tr key={expense.id}>
                        <td className="px-3 py-3 font-semibold">{expense.title}</td>
                        <td className="px-3 py-3">
                          {EXPENSE_CATEGORIES.find((item) => item.value === expense.category)
                            ?.label || expense.category}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3">{expense.date}</td>
                        <td className="px-3 py-3">{formatCop(expense.amountCop)}</td>
                        <td className="px-3 py-3">
                          {formatUsdFromCop(expense.amountCop, expense.usdRate)}
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex gap-3">
                            <button
                              type="button"
                              onClick={() => editExpense(expense)}
                              className="text-xs font-semibold text-[color:var(--accent)]"
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              onClick={() => removeExpense(expense.id)}
                              className="text-xs font-semibold text-[color:var(--muted)]"
                            >
                              Eliminar
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {tab === "reports" && <AccountingReports board={board} year={year} />}
      </main>

      <AdminFooter />

      {invoicesActivityId &&
        (() => {
          const activity = board.activities.find((item) => item.id === invoicesActivityId);
          if (!activity) return null;
          const attachments = activityAttachments(activity);
          return (
            <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
              <div className="w-full max-w-lg space-y-4 border border-[color:var(--line)] bg-white p-5 shadow-xl">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-[family-name:var(--font-display)] text-xl font-bold">
                      Facturas
                    </h2>
                    <p className="mt-1 text-sm text-[color:var(--muted)]">{activity.title}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setInvoicesActivityId(null)}
                    className="text-sm font-semibold text-[color:var(--muted)]"
                  >
                    Cerrar
                  </button>
                </div>

                {attachments.length === 0 ? (
                  <p className="text-sm text-[color:var(--muted)]">
                    Esta actividad no tiene facturas adjuntas.
                  </p>
                ) : (
                  <ul className="divide-y divide-[color:var(--line)] border border-[color:var(--line)]">
                    {attachments.map((file) => (
                      <li
                        key={`${file.category}-${file.id}`}
                        className="flex items-center justify-between gap-3 px-3 py-3"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">{file.name}</p>
                          <p className="text-xs text-[color:var(--muted)]">{file.category}</p>
                        </div>
                        <a
                          href={file.url}
                          target="_blank"
                          rel="noreferrer"
                          className="shrink-0 text-xs font-semibold text-[color:var(--accent)]"
                        >
                          Abrir
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          );
        })()}
    </div>
  );
}
