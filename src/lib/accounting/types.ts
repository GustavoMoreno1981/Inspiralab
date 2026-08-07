export type CostCategory =
  | "materials"
  | "logistics"
  | "collaborations"
  | "contingencies";

export type ExpenseCategory = "equipment" | "internet" | "tools" | "other";

export type AttachmentFile = {
  id: string;
  name: string;
  url: string;
};

export type CostBucket = {
  amountCop: number;
  files: AttachmentFile[];
};

export type AnnualBudget = {
  id: string;
  year: number;
  amountCop: number;
  salariesCop: number;
  usdRate: number;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type Beneficiary = {
  id: string;
  name: string;
  contact: string;
  notes: string;
  createdAt: string;
};

export type Activity = {
  id: string;
  beneficiaryId: string;
  title: string;
  date: string;
  usdRate: number;
  /** Dinero dispuesto/enviado para el taller (sale del presupuesto anual). */
  receivedCop: number;
  costs: Record<CostCategory, CostBucket>;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type OperationalExpense = {
  id: string;
  category: ExpenseCategory;
  title: string;
  date: string;
  amountCop: number;
  usdRate: number;
  files: AttachmentFile[];
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type AccountingBoard = {
  budgets: AnnualBudget[];
  beneficiaries: Beneficiary[];
  activities: Activity[];
  expenses: OperationalExpense[];
};

export const COST_CATEGORIES: { value: CostCategory; label: string }[] = [
  { value: "materials", label: "Materiales" },
  { value: "logistics", label: "Logística" },
  { value: "collaborations", label: "Colaboraciones" },
  { value: "contingencies", label: "Imprevistos" },
];

export const EXPENSE_CATEGORIES: { value: ExpenseCategory; label: string }[] = [
  { value: "equipment", label: "Equipos" },
  { value: "internet", label: "Internet" },
  { value: "tools", label: "Herramientas / software" },
  { value: "other", label: "Otros" },
];

export function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function emptyCostBucket(): CostBucket {
  return { amountCop: 0, files: [] };
}

export function emptyActivityCosts(): Record<CostCategory, CostBucket> {
  return {
    materials: emptyCostBucket(),
    logistics: emptyCostBucket(),
    collaborations: emptyCostBucket(),
    contingencies: emptyCostBucket(),
  };
}

export function emptyBoard(): AccountingBoard {
  return { budgets: [], beneficiaries: [], activities: [], expenses: [] };
}

export function toUsd(amountCop: number, usdRate: number) {
  if (!usdRate || usdRate <= 0) return 0;
  return amountCop / usdRate;
}

export function toCop(amountUsd: number, usdRate: number) {
  if (!usdRate || usdRate <= 0) return 0;
  return Math.round(amountUsd * usdRate);
}

export function activityTotalCop(activity: Activity) {
  return (
    (activity.costs.materials?.amountCop || 0) +
    (activity.costs.logistics?.amountCop || 0) +
    (activity.costs.collaborations?.amountCop || 0) +
    (activity.costs.contingencies?.amountCop || 0)
  );
}

export function activityBalanceCop(activity: Activity) {
  return (activity.receivedCop || 0) - activityTotalCop(activity);
}

export function formatCop(value: number) {
  return `${new Intl.NumberFormat("es-CO", {
    maximumFractionDigits: 0,
  }).format(Math.round(value || 0))} COP`;
}

/** USD cuando el valor original ya viene en dólares. */
export function formatUsd(value: number) {
  return `${new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0)} USD`;
}

/**
 * COP → USD con los decimales necesarios para que
 * dólares × tipo de cambio = mismos pesos.
 */
export function formatUsdFromCop(amountCop: number, usdRate: number) {
  const cop = Math.round(amountCop || 0);
  if (!usdRate || usdRate <= 0) return "0.00 USD";
  if (cop === 0) return "0.00 USD";

  const exact = cop / usdRate;
  for (let decimals = 2; decimals <= 10; decimals += 1) {
    const factor = 10 ** decimals;
    const rounded = Math.round((exact + Number.EPSILON) * factor) / factor;
    if (Math.round(rounded * usdRate) === cop) {
      return `${new Intl.NumberFormat("en-US", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      }).format(rounded)} USD`;
    }
  }

  return `${new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 10,
  }).format(exact)} USD`;
}

export function getYearSummary(board: AccountingBoard, year: number) {
  const budget = board.budgets.find((item) => item.year === year) || null;
  const activities = board.activities.filter((item) =>
    item.date.startsWith(String(year)),
  );
  const expenses = board.expenses.filter((item) =>
    item.date.startsWith(String(year)),
  );

  const activitiesReceivedCop = activities.reduce(
    (acc, item) => acc + (item.receivedCop || 0),
    0,
  );
  const activitiesSpentCop = activities.reduce(
    (acc, item) => acc + activityTotalCop(item),
    0,
  );
  const activitiesBalanceCop = activitiesReceivedCop - activitiesSpentCop;
  const expensesCop = expenses.reduce((acc, item) => acc + (item.amountCop || 0), 0);
  const salariesCop = budget?.salariesCop || 0;
  // Del presupuesto anual sale: salarios + dinero dispuesto a talleres + gastos operativos
  const spentCop = salariesCop + activitiesReceivedCop + expensesCop;
  const totalCop = budget?.amountCop || 0;
  const availableCop = totalCop - spentCop;
  const rate = budget?.usdRate || 4000;

  const workshopCostsByCategory = COST_CATEGORIES.map((cat) => {
    const amountCop = activities.reduce(
      (acc, item) => acc + (item.costs[cat.value]?.amountCop || 0),
      0,
    );
    return {
      category: cat.value,
      label: cat.label,
      amountCop,
      amountUsd: toUsd(amountCop, rate),
    };
  });

  const expensesByCategory = EXPENSE_CATEGORIES.map((cat) => {
    const amountCop = expenses
      .filter((item) => item.category === cat.value)
      .reduce((acc, item) => acc + (item.amountCop || 0), 0);
    return {
      category: cat.value,
      label: cat.label,
      amountCop,
      amountUsd: toUsd(amountCop, rate),
    };
  });

  /** Partidas que salen del presupuesto anual (para gráfico / tabla). */
  const budgetAllocation = [
    {
      key: "salaries",
      label: "Salarios",
      amountCop: salariesCop,
      amountUsd: toUsd(salariesCop, rate),
    },
    {
      key: "workshops",
      label: "Dispuesto a talleres",
      amountCop: activitiesReceivedCop,
      amountUsd: toUsd(activitiesReceivedCop, rate),
    },
    {
      key: "expenses",
      label: "Gastos operativos",
      amountCop: expensesCop,
      amountUsd: toUsd(expensesCop, rate),
    },
    {
      key: "available",
      label: "Disponible",
      amountCop: availableCop,
      amountUsd: toUsd(availableCop, rate),
    },
  ] as const;

  return {
    budget,
    year,
    rate,
    totalCop,
    salariesCop,
    activitiesCop: activitiesReceivedCop,
    activitiesReceivedCop,
    activitiesSpentCop,
    activitiesBalanceCop,
    expensesCop,
    spentCop,
    availableCop,
    usedPercent: totalCop > 0 ? Math.round((spentCop / totalCop) * 100) : 0,
    totalUsd: toUsd(totalCop, rate),
    salariesUsd: toUsd(salariesCop, rate),
    spentUsd: toUsd(spentCop, rate),
    availableUsd: toUsd(availableCop, rate),
    activitiesCount: activities.length,
    expensesCount: expenses.length,
    workshopCostsByCategory,
    expensesByCategory,
    budgetAllocation,
  };
}

export type BeneficiaryYearReport = {
  beneficiary: Beneficiary;
  workshopsCount: number;
  donationCop: number;
  donationUsd: number;
  spentCop: number;
  spentUsd: number;
  activities: Activity[];
};

/** Informe por beneficiario en un año (donación = recibido; gastado = rubros). */
export function getBeneficiaryReports(
  board: AccountingBoard,
  year: number,
): BeneficiaryYearReport[] {
  const rate = board.budgets.find((b) => b.year === year)?.usdRate || 4000;
  const yearActivities = board.activities.filter((item) =>
    item.date.startsWith(String(year)),
  );

  return board.beneficiaries
    .map((beneficiary) => {
      const activities = yearActivities.filter(
        (item) => item.beneficiaryId === beneficiary.id,
      );
      const donationCop = activities.reduce(
        (acc, item) => acc + (item.receivedCop || 0),
        0,
      );
      const spentCop = activities.reduce(
        (acc, item) => acc + activityTotalCop(item),
        0,
      );
      return {
        beneficiary,
        workshopsCount: activities.length,
        donationCop,
        donationUsd: toUsd(donationCop, rate),
        spentCop,
        spentUsd: toUsd(spentCop, rate),
        activities,
      };
    })
    .filter((row) => row.workshopsCount > 0 || row.donationCop > 0)
    .sort((a, b) => b.donationCop - a.donationCop);
}
