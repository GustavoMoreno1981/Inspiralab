"use client";

import { useEffect, useMemo, useState } from "react";
import type { Activity, ReviewMessage, TeamMember } from "@/lib/tasks/types";
import { createId } from "@/lib/tasks/types";
import { useToast } from "@/components/admin/AdminToast";

function firstName(fullName: string) {
  const part = fullName.trim().split(/\s+/).filter(Boolean)[0];
  return part || fullName.trim() || "equipo";
}

function buildReviewText({
  activityTitle,
  recipientName,
  senderName,
  body,
  url,
}: {
  activityTitle: string;
  recipientName: string;
  senderName: string;
  body: string;
  url: string;
}) {
  const recipientFirst = firstName(recipientName);
  const senderFull = senderName.trim() || "Inspiralab";

  const lines = [
    `Hola ${recipientFirst}, espero que te encuentres muy bien. 🌷`,
    "",
    `${senderFull} te envía este mensaje con el fin de solicitarte, cuando tengas un momento, que revises el avance de la actividad "${activityTitle}".`,
    "",
    "Nos gustaría saber cómo va el proceso y si la actividad ya está lista o si aún hace falta algo para poder apoyarte en lo que necesites.",
  ];

  if (body.trim()) {
    lines.push("", body.trim());
  }
  if (url.trim()) {
    lines.push("", `Puedes revisar aquí: ${url.trim()}`);
  }

  lines.push(
    "",
    "Muchas gracias por tu compromiso y dedicación.",
    "",
    "Un abrazo,",
    senderFull,
    "Inspiralab",
  );

  return lines.join("\n");
}

function resolveDefaultSenderId(
  members: TeamMember[],
  sessionMemberId?: string,
  sessionName?: string,
) {
  if (sessionMemberId && members.some((member) => member.id === sessionMemberId)) {
    return sessionMemberId;
  }
  const normalized = (sessionName || "").trim().toLowerCase();
  if (normalized && normalized !== "administrador" && normalized !== "equipo") {
    const match = members.find((member) => member.name.trim().toLowerCase() === normalized);
    if (match) return match.id;
  }
  return members[0]?.id || "";
}

export function ReviewMessageModal({
  open,
  activity,
  members,
  sessionMemberId,
  sessionName,
  onClose,
  onSent,
}: {
  open: boolean;
  activity: Activity | null;
  members: TeamMember[];
  sessionMemberId?: string;
  sessionName?: string;
  onClose: () => void;
  onSent: (message: ReviewMessage) => void;
}) {
  const toast = useToast();
  const [senderId, setSenderId] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [body, setBody] = useState("");
  const [url, setUrl] = useState("");

  useEffect(() => {
    if (!open || !activity) return;
    setSenderId(resolveDefaultSenderId(members, sessionMemberId, sessionName));
    setSelectedIds(activity.assigneeIds?.length ? [...activity.assigneeIds] : []);
    setBody("");
    setUrl(activity.processUrl || activity.deliverableUrl || "");
  }, [open, activity, members, sessionMemberId, sessionName]);

  const sender = useMemo(
    () => members.find((member) => member.id === senderId) || null,
    [members, senderId],
  );
  const senderFullName = sender?.name?.trim() || "";

  const selectedMembers = useMemo(
    () => members.filter((member) => selectedIds.includes(member.id)),
    [members, selectedIds],
  );

  const personalizedMessages = useMemo(() => {
    if (!activity || !senderFullName) return [];
    return selectedMembers.map((member) => ({
      member,
      text: buildReviewText({
        activityTitle: activity.title,
        recipientName: member.name,
        senderName: senderFullName,
        body,
        url,
      }),
    }));
  }, [activity, selectedMembers, senderFullName, body, url]);

  const preview = useMemo(() => {
    if (!senderFullName) {
      return "Elige quién envía el mensaje para que la otra persona sepa de parte de quién es.";
    }
    if (!personalizedMessages.length) {
      return "Selecciona a quién debe revisar para ver la vista previa.";
    }
    if (personalizedMessages.length === 1) {
      return personalizedMessages[0].text;
    }
    return personalizedMessages
      .map((item) => `— Para ${item.member.name} —\n\n${item.text}`)
      .join("\n\n————————\n\n");
  }, [personalizedMessages, senderFullName]);

  if (!open || !activity) return null;

  function toggleMember(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  }

  function selectAll() {
    setSelectedIds(members.map((member) => member.id));
  }

  function clearAll() {
    setSelectedIds([]);
  }

  function saveHistory(channel: ReviewMessage["channel"], fullText: string) {
    const message: ReviewMessage = {
      id: createId("review"),
      recipientIds: selectedIds,
      recipientNames: selectedMembers.map((member) => member.name),
      body: body.trim(),
      url: url.trim(),
      fullText,
      createdAt: new Date().toISOString(),
      channel,
    };
    onSent(message);
  }

  async function copyText() {
    if (!senderFullName) {
      toast.error("Elige quién envía el mensaje");
      return;
    }
    if (!personalizedMessages.length) {
      toast.error("Selecciona al menos un integrante");
      return;
    }
    try {
      await navigator.clipboard.writeText(preview);
      saveHistory("copied", preview);
      toast.success("Mensaje copiado y guardado en el historial");
    } catch {
      toast.error("No se pudo copiar. Selecciona el texto manualmente.");
    }
  }

  function sendWhatsApp() {
    if (!senderFullName) {
      toast.error("Elige quién envía el mensaje");
      return;
    }
    if (!personalizedMessages.length) {
      toast.error("Selecciona al menos un integrante");
      return;
    }

    const first = personalizedMessages[0];
    const href = `https://wa.me/?text=${encodeURIComponent(first.text)}`;
    window.open(href, "_blank", "noopener,noreferrer");
    saveHistory("whatsapp", preview);

    if (personalizedMessages.length > 1) {
      void navigator.clipboard.writeText(preview).then(
        () =>
          toast.success(
            `WhatsApp abierto para ${first.member.name}. Los demás mensajes quedaron copiados.`,
          ),
        () =>
          toast.success(
            `WhatsApp abierto para ${first.member.name}. Copia el resto desde la vista previa.`,
          ),
      );
      return;
    }

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
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">
              Quién envía este mensaje
            </span>
            <select
              value={senderId}
              onChange={(e) => setSenderId(e.target.value)}
              className="w-full border border-[color:var(--line)] bg-white px-3 py-2.5 text-sm outline-none focus:border-[color:var(--accent)]"
            >
              <option value="">Selecciona tu nombre…</option>
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                  {member.role ? ` · ${member.role}` : ""}
                </option>
              ))}
            </select>
            <p className="text-xs text-[color:var(--muted)]">
              Así la persona que revisa sabrá claramente de parte de quién es la solicitud.
            </p>
          </label>

          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">
                Quién debe revisar
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
              Nota adicional (opcional)
            </span>
            <textarea
              rows={3}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="w-full border border-[color:var(--line)] px-3 py-2 text-sm outline-none focus:border-[color:var(--accent)]"
              placeholder="Detalle extra si lo necesitas…"
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
            El mensaje lleva tu nombre completo para que sepa quién lo pide. Si hay varias personas,
            WhatsApp abre el primero y el resto queda copiado.
          </p>
        </div>
      </div>
    </div>
  );
}
