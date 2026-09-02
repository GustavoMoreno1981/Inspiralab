export type BillingSubmissionStatus = "submitted" | "reviewed" | "paid";

export type BillingSubmission = {
  id: string;
  memberId: string;
  periodStart: string;
  periodEnd: string;
  fileUrl: string;
  fileName: string;
  paymentReceiptUrl: string;
  paymentReceiptName: string;
  paymentReceiptAt: string | null;
  activities: string[];
  notes: string;
  status: BillingSubmissionStatus;
  archivedAt: string | null;
  submittedAt: string;
  createdAt: string;
  updatedAt: string;
};

export type BillingBoard = {
  submissions: BillingSubmission[];
};

export function createBillingId() {
  return `bill_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function emptyBillingBoard(): BillingBoard {
  return { submissions: [] };
}

export function normalizeBillingBoard(data: Partial<BillingBoard> | null): BillingBoard {
  return {
    submissions: Array.isArray(data?.submissions)
      ? data.submissions.map(normalizeSubmission)
      : [],
  };
}

function normalizeStatus(value: unknown): BillingSubmissionStatus {
  if (value === "reviewed" || value === "paid") return value;
  return "submitted";
}

export function normalizeSubmission(item: Partial<BillingSubmission>): BillingSubmission {
  const now = new Date().toISOString();
  return {
    id: String(item.id || createBillingId()),
    memberId: String(item.memberId || ""),
    periodStart: String(item.periodStart || ""),
    periodEnd: String(item.periodEnd || ""),
    fileUrl: String(item.fileUrl || ""),
    fileName: String(item.fileName || ""),
    paymentReceiptUrl: String(item.paymentReceiptUrl || ""),
    paymentReceiptName: String(item.paymentReceiptName || ""),
    paymentReceiptAt:
      typeof item.paymentReceiptAt === "string" && item.paymentReceiptAt
        ? item.paymentReceiptAt
        : null,
    activities: Array.isArray(item.activities)
      ? item.activities.map((line) => String(line).trim()).filter(Boolean)
      : [],
    notes: String(item.notes || ""),
    status: normalizeStatus(item.status),
    archivedAt:
      typeof item.archivedAt === "string" && item.archivedAt ? item.archivedAt : null,
    submittedAt: String(item.submittedAt || now),
    createdAt: String(item.createdAt || now),
    updatedAt: String(item.updatedAt || now),
  };
}

export type UpdateBillingPaymentReceiptInput = {
  paymentReceiptUrl: string;
  paymentReceiptName: string;
};

export type CreateBillingSubmissionInput = {
  memberId: string;
  periodStart: string;
  periodEnd: string;
  fileUrl: string;
  fileName: string;
  activities: string[];
  notes?: string;
};
