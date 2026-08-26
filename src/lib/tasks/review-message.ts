import type { ReviewMessage, ReviewResponseValue } from "./types";

export const REVIEW_POLL_OPTIONS: Array<{ value: ReviewResponseValue; label: string }> =
  [
    { value: "yes", label: "Sí" },
    { value: "no", label: "No" },
    { value: "pending", label: "Pendiente" },
    { value: "call", label: "Llamada" },
  ];

export function reviewResponseLabel(value: ReviewResponseValue | null | undefined) {
  return (
    REVIEW_POLL_OPTIONS.find((item) => item.value === value)?.label || "Sin respuesta"
  );
}

export function latestReviewResponse(messages: ReviewMessage[] | undefined) {
  if (!messages?.length) return null;
  for (const message of messages) {
    if (message.response) {
      return {
        value: message.response,
        at: message.responseAt || message.createdAt,
        by: message.responseBy || "",
        messageId: message.id,
      };
    }
  }
  return null;
}

export function buildReviewWhatsAppText({
  activityTitle,
  senderName,
  body,
  url,
}: {
  activityTitle: string;
  senderName: string;
  body: string;
  url: string;
}) {
  const sender = senderName.trim() || "Inspiralab";
  const lines = [
    "Solicitud de revisión de actividad",
    "",
    `De: ${sender}`,
    `Actividad «${activityTitle.trim() || "Sin título"}».`,
  ];

  if (body.trim()) {
    lines.push("", body.trim());
  }

  if (url.trim()) {
    lines.push("", `Puedes revisar aquí: ${url.trim()}`);
  }

  lines.push("", "Gracias por su revisión. Quedo atento.");

  return lines.join("\n");
}
