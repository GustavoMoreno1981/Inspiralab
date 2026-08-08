"use client";

import { useEffect, useMemo, useState } from "react";
import type { Activity, ReviewMessage, TeamMember } from "@/lib/tasks/types";
import { createId } from "@/lib/tasks/types";
import { useToast } from "@/components/admin/AdminToast";

function buildReviewText({
  activityTitle,
  recipientNames,
  body,
  url,
}: {
  activityTitle: string;
  recipientNames: string[];
  body: string;
  url: string;
}) {
  const to =
    recipientNames.length > 0 ? recipientNames.join(", ") : "todo el equipo";
  const lines = [
    "Hola a todo el equipo,",
    `este mensaje va dirigido a: ${to}.`,
    "",
    `Por favor revisar la actividad: "${activityTitle}".`,
  ];
  if (body.trim()) {
    lines.push("", body.trim());
  }
  if (url.trim()) {
    lines.push("", `URL para revisar: ${url.trim()}`);
  }
  lines.push("", "— Inspiralab");
  return lines.join("\n");
}

export function ReviewMessageModal({
  open,
  activity,
  members,
  onClose,
  onSent,
}: {
  open: boolean;
  activity: Activity | null;
  members: TeamMember[];
  onClose: () => void;
  onSent: (message: ReviewMessage) => void;
}) {
  const toast = useToast();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [body, setBody] = useState(
    "Por favor revisar el avance y confirmar si está listo o qué falta.",
  );
  const [url, setUrl] = useState("");

  useEffect(() => {
    if (!open || !activity) return;
    setSelectedIds(activity.assigneeIds?.length ? [...activity.assigneeIds] : []);
    setBody("Por favor revisar el avance y confirmar si está listo o qué falta.");
    setUrl(activity.processUrl || activity.deliverableUrl || "");
  }, [open, activity]);

  const selectedMembers = useMemo(
    () => members.filter((member) => selectedIds.includes(member.id)),
    [members, selectedIds],
  );

  const preview = useMemo(() => {
    if (!activity) return "";
    return buildReviewText({
      activityTitle: activity.title,
      recipientNames: selectedMembers.map((m) => m.name),
      body,
      url,
    });
  }, [activity, selectedMembers, body, url]);

  if (!open || !activity) return null;

  function toggleMember(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  }

  function selectAll() {
    setSelectedIds(members.map((m) => m.id));
  }

  function clearAll() {
    setSelectedIds([]);
  }

  function saveHistory(channel: ReviewMessage["channel"]) {
    const message: ReviewMessage = {
      id: createId("review"),
      recipientIds: selectedIds,
      recipientNames: selectedMembers.map((m) => m.name),
      body: body.trim(),
      url: url.trim(),
      fullText: preview,
      createdAt: new Date().toISOString(),
      channel,
    };
    onSent(message);
  }

  async function copyText() {
    try {
      await navigator.clipboard.writeText(preview);
      saveHistory("copied");
      toast.success("Mensaje copiado y guardado en el historial");
    } catch {
      toast.error("No se pudo copiar. Selecciona el texto manualmente.");
    }
  }

  function sendWhatsApp() {
    if (selectedIds.length === 0) {
      toast.error("Selecciona al menos un integrante");
      return;
    }
    const href = `https://wa.me/?text=${encodeURIComponent(preview)}`;
    window.open(href, "_blank", "noopener,noreferrer");
    saveHistory("whatsapp");
    toast.success("Mensaje listo para WhatsApp y guardado en el historial");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="review-modal-title"
        className="max-h-[92svh] w-full max-w-xl overflow-y-auto border border-[color:var(--line)] bg-white p-5 shadow-xl md:p-6"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2
              id="review-modal-title"
              className="font-[family-name:var(--font-display)] text-xl font-bold"
            >
              Mensaje de revisión
            </h2>
            <p className="mt-1 text-sm text-[color:var(--muted)]">
              Actividad:{" "}
              <span className="font-semibold text-[color:var(--ink)]">{activity.title}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="border border-[color:var(--line)] px-2.5 py-1 text-sm font-semibold"
          >
            Cerrar
          </button>
        </div>

        <div className="mt-5 space-y-4">
          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">
                Este mensaje va dirigido a
              </p>
              <div className="flex gap-2 text-xs font-semibold">
                <button type="button" onClick={selectAll} className="text-[color:var(--accent)]">
                  Todos
                </button>
                <button type="button" onClick={clearAll} className="text-[color:var(--muted)]">
                  Ninguno
                </button>
              </div>
            </div>
            {members.length === 0 ? (
              <p className="text-sm text-[color:var(--muted)]">No hay integrantes en el equipo.</p>
            ) : (
              <ul className="grid gap-2 sm:grid-cols-2">
                {members.map((member) => {
                  const checked = selectedIds.includes(member.id);
                  return (
                    <li key={member.id}>
                      <label
                        className={`flex cursor-pointer items-center gap-2 border px-3 py-2 text-sm ${
                          checked
                            ? "border-[color:var(--accent)] bg-[#fff1f4]"
                            : "border-[color:var(--line)] bg-white"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleMember(member.id)}
                        />
                        <span className="min-w-0">
                          <span className="block font-semibold">{member.name}</span>
                          {member.role ? (
                            <span className="block text-xs text-[color:var(--muted)]">
                              {member.role}
                            </span>
                          ) : null}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <label className="block space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">
              Mensaje adicional
            </span>
            <textarea
              rows={4}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="w-full border border-[color:var(--line)] px-3 py-2 text-sm outline-none focus:border-[color:var(--accent)]"
              placeholder="Detalle de lo que deben revisar..."
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">
              URL (opcional)
            </span>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://..."
              className="w-full border border-[color:var(--line)] px-3 py-2 text-sm outline-none focus:border-[color:var(--accent)]"
            />
          </label>

          <div className="border border-[color:var(--line)] bg-[color:var(--mist)] p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[color:var(--muted)]">
              Vista previa del mensaje
            </p>
            <pre className="mt-2 whitespace-pre-wrap font-sans text-sm text-[color:var(--ink)]">
              {preview}
            </pre>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void copyText()}
              className="border border-[color:var(--line)] px-4 py-2.5 text-sm font-semibold"
            >
              Copiar texto
            </button>
            <button
              type="button"
              onClick={sendWhatsApp}
              className="bg-[#25D366] px-4 py-2.5 text-sm font-semibold text-white"
            >
              Enviar por WhatsApp
            </button>
          </div>
          <p className="text-xs text-[color:var(--muted)]">
            WhatsApp abrirá el chat para que elijas el grupo o contacto. Al enviar, el mensaje queda
            en el historial de la actividad.
          </p>
        </div>
      </div>
    </div>
  );
}
