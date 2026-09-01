import type { BillingSubmission } from "@/lib/billing/types";

function formatDate(iso: string) {
  if (!iso) return "—";
  return iso.split("-").reverse().join("/");
}

export function buildBillingWhatsAppText(
  submission: Pick<
    BillingSubmission,
    "periodStart" | "periodEnd" | "submittedAt" | "activities" | "fileUrl" | "fileName"
  >,
  memberName: string,
) {
  const lines = [
    `*Cuenta de cobro — Inspiralab*`,
    "",
    `Integrante: ${memberName}`,
    `Periodo: ${formatDate(submission.periodStart)} – ${formatDate(submission.periodEnd)}`,
    `Enviada el: ${formatDate(submission.submittedAt.slice(0, 10))}`,
    "",
    "*Actividades realizadas:*",
    ...submission.activities.map((line, index) => `${index + 1}. ${line}`),
  ];

  if (submission.fileUrl) {
    lines.push("", "*Archivo adjunto:*", submission.fileUrl);
    if (submission.fileName) {
      lines.push(`(${submission.fileName})`);
    }
  }

  return lines.join("\n");
}

export function whatsAppShareHref(phoneDigits: string, text: string) {
  const base = phoneDigits ? `https://wa.me/${phoneDigits}` : "https://wa.me/";
  return `${base}?text=${encodeURIComponent(text)}`;
}
