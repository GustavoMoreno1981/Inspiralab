import { promises as fs } from "fs";
import path from "path";
import { Resend } from "resend";
import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase/admin";
import { readScheduleBoard } from "@/lib/schedule/store";
import type { WorkshopSession } from "@/lib/schedule/types";

export const REMINDER_DAYS = [5, 3, 1] as const;
export type ReminderDaysBefore = (typeof REMINDER_DAYS)[number];

export const DEFAULT_REMINDER_RECIPIENTS = [
  "admin@inspiralab.org",
  "saul@techno-coatings.com",
  "DianaRodriguezartist@gmail.com",
];

const DATA_DIR = path.join(process.cwd(), "data");
const LOG_PATH = path.join(DATA_DIR, "schedule-reminder-log.json");

type ReminderLogEntry = {
  key: string;
  sessionId: string;
  daysBefore: number;
  sessionDate: string;
  sentAt: string;
};

type DueReminder = {
  session: WorkshopSession;
  daysBefore: ReminderDaysBefore;
  key: string;
};

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/** Fecha local YYYY-MM-DD en America/Bogota. */
export function todayInBogota(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const year = parts.find((p) => p.type === "year")?.value || "1970";
  const month = parts.find((p) => p.type === "month")?.value || "01";
  const day = parts.find((p) => p.type === "day")?.value || "01";
  return `${year}-${month}-${day}`;
}

function daysBetween(fromIso: string, toIso: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fromIso) || !/^\d{4}-\d{2}-\d{2}$/.test(toIso)) {
    return null;
  }
  const from = Date.UTC(
    Number(fromIso.slice(0, 4)),
    Number(fromIso.slice(5, 7)) - 1,
    Number(fromIso.slice(8, 10)),
  );
  const to = Date.UTC(
    Number(toIso.slice(0, 4)),
    Number(toIso.slice(5, 7)) - 1,
    Number(toIso.slice(8, 10)),
  );
  return Math.round((to - from) / 86_400_000);
}

function formatDateEs(iso: string) {
  if (!iso) return "—";
  return iso.split("-").reverse().join("/");
}

function sessionLabel(session: WorkshopSession) {
  if (session.kind === "event") {
    return session.eventName || session.title || "Evento";
  }
  return session.title || "Taller";
}

function reminderKey(sessionId: string, daysBefore: number, sessionDate: string) {
  return `${sessionId}:${daysBefore}:${sessionDate}`;
}

export function getReminderRecipients(): string[] {
  const raw = process.env.SCHEDULE_REMINDER_EMAILS || "";
  const fromEnv = raw
    .split(/[,;\s]+/)
    .map((item) => item.trim())
    .filter(Boolean);
  return fromEnv.length ? fromEnv : [...DEFAULT_REMINDER_RECIPIENTS];
}

async function readLocalLog(): Promise<ReminderLogEntry[]> {
  try {
    const raw = await fs.readFile(LOG_PATH, "utf8");
    const data = JSON.parse(raw) as { entries?: ReminderLogEntry[] };
    return Array.isArray(data.entries) ? data.entries : [];
  } catch {
    return [];
  }
}

async function writeLocalLog(entries: ReminderLogEntry[]) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(
    LOG_PATH,
    JSON.stringify({ entries }, null, 2),
    "utf8",
  );
}

async function loadSentKeys(): Promise<Set<string>> {
  if (isSupabaseConfigured()) {
    try {
      const supabase = getSupabaseAdmin();
      const { data, error } = await supabase
        .from("schedule_reminder_log")
        .select("reminder_key");
      if (error) throw error;
      return new Set(
        ((data || []) as Array<{ reminder_key: string | null }>)
          .map((row) => row.reminder_key || "")
          .filter(Boolean),
      );
    } catch (error) {
      console.warn(
        "schedule_reminder_log no disponible; usando log local.",
        error instanceof Error ? error.message : error,
      );
    }
  }
  const entries = await readLocalLog();
  return new Set(entries.map((item) => item.key));
}

async function markSent(entries: ReminderLogEntry[]) {
  if (!entries.length) return;

  if (isSupabaseConfigured()) {
    try {
      const supabase = getSupabaseAdmin();
      const { error } = await supabase.from("schedule_reminder_log").upsert(
        entries.map((item) => ({
          reminder_key: item.key,
          session_id: item.sessionId,
          days_before: item.daysBefore,
          session_date: item.sessionDate,
          sent_at: item.sentAt,
        })),
        { onConflict: "reminder_key" },
      );
      if (!error) return;
      console.warn(
        "No se pudo guardar schedule_reminder_log en Supabase; fallback local.",
        error.message,
      );
    } catch (error) {
      console.warn(
        "Error guardando log de recordatorios en Supabase:",
        error instanceof Error ? error.message : error,
      );
    }
  }

  const current = await readLocalLog();
  const byKey = new Map(current.map((item) => [item.key, item]));
  for (const entry of entries) byKey.set(entry.key, entry);
  await writeLocalLog([...byKey.values()]);
}

export function findDueReminders(
  sessions: WorkshopSession[],
  todayIso: string,
  sentKeys: Set<string>,
): DueReminder[] {
  const due: DueReminder[] = [];
  for (const session of sessions) {
    if (session.status !== "scheduled" || !session.date) continue;
    const daysUntil = daysBetween(todayIso, session.date);
    if (daysUntil === null) continue;
    if (!REMINDER_DAYS.includes(daysUntil as ReminderDaysBefore)) continue;
    const daysBefore = daysUntil as ReminderDaysBefore;
    const key = reminderKey(session.id, daysBefore, session.date);
    if (sentKeys.has(key)) continue;
    due.push({ session, daysBefore, key });
  }
  return due.sort((a, b) => {
    if (a.daysBefore !== b.daysBefore) return b.daysBefore - a.daysBefore;
    return a.session.date.localeCompare(b.session.date);
  });
}

function buildEmailHtml(due: DueReminder[], todayIso: string) {
  const groups = REMINDER_DAYS.map((days) => ({
    days,
    items: due.filter((item) => item.daysBefore === days),
  })).filter((group) => group.items.length);

  const sections = groups
    .map((group) => {
      const rows = group.items
        .map(({ session }) => {
          const kind = session.kind === "event" ? "Evento" : "Taller";
          const time =
            session.startTime || session.endTime
              ? `${session.startTime || "—"}${session.endTime ? ` – ${session.endTime}` : ""}`
              : "Sin hora";
          return `<tr>
            <td style="padding:8px 0;border-bottom:1px solid #eee;"><strong>${escapeHtml(
              sessionLabel(session),
            )}</strong><br/><span style="color:#666;font-size:13px;">${kind}</span></td>
            <td style="padding:8px 0;border-bottom:1px solid #eee;">${escapeHtml(
              formatDateEs(session.date),
            )}</td>
            <td style="padding:8px 0;border-bottom:1px solid #eee;">${escapeHtml(time)}</td>
            <td style="padding:8px 0;border-bottom:1px solid #eee;">${escapeHtml(
              session.location || "—",
            )}</td>
            <td style="padding:8px 0;border-bottom:1px solid #eee;">${escapeHtml(
              session.coach || "—",
            )}</td>
          </tr>`;
        })
        .join("");

      return `<h2 style="font-size:16px;margin:28px 0 10px;border-bottom:1px solid #ddd;padding-bottom:6px;">
        Faltan ${group.days} ${group.days === 1 ? "día" : "días"}
      </h2>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <thead>
          <tr>
            <th align="left" style="padding:6px 0;color:#666;">Actividad</th>
            <th align="left" style="padding:6px 0;color:#666;">Fecha</th>
            <th align="left" style="padding:6px 0;color:#666;">Horario</th>
            <th align="left" style="padding:6px 0;color:#666;">Lugar</th>
            <th align="left" style="padding:6px 0;color:#666;">Coach</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="es">
<body style="font-family:Georgia,serif;color:#1a1a1a;max-width:720px;margin:0 auto;padding:24px;line-height:1.5;">
  <p style="color:#e00d45;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;font-size:12px;margin:0;">Inspiralab</p>
  <h1 style="font-size:24px;margin:8px 0 4px;">Recordatorio de cronograma</h1>
  <p style="color:#666;margin:0 0 20px;">Fecha de revisión: ${escapeHtml(
    formatDateEs(todayIso),
  )} (hora Colombia)</p>
  <p>Estos talleres y eventos programados están próximos. Revisa logística, materiales y confirmaciones.</p>
  ${sections}
  <p style="margin-top:32px;color:#888;font-size:12px;">Correo automático del módulo Cronograma · Inspiralab</p>
</body>
</html>`;
}

function buildEmailText(due: DueReminder[], todayIso: string) {
  const lines = [
    "Inspiralab — Recordatorio de cronograma",
    `Fecha de revisión: ${formatDateEs(todayIso)}`,
    "",
  ];
  for (const days of REMINDER_DAYS) {
    const items = due.filter((item) => item.daysBefore === days);
    if (!items.length) continue;
    lines.push(`--- Faltan ${days} ${days === 1 ? "día" : "días"} ---`);
    for (const { session } of items) {
      const kind = session.kind === "event" ? "Evento" : "Taller";
      lines.push(
        `• ${sessionLabel(session)} (${kind}) · ${formatDateEs(session.date)} · ${
          session.startTime || "sin hora"
        } · ${session.location || "sin lugar"} · Coach: ${session.coach || "—"}`,
      );
    }
    lines.push("");
  }
  return lines.join("\n");
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function subjectFor(due: DueReminder[]) {
  const counts = REMINDER_DAYS.map(
    (days) => due.filter((item) => item.daysBefore === days).length,
  );
  const parts: string[] = [];
  if (counts[0]) parts.push(`${counts[0]} a 5 días`);
  if (counts[1]) parts.push(`${counts[1]} a 3 días`);
  if (counts[2]) parts.push(`${counts[2]} a 1 día`);
  return `Recordatorio cronograma Inspiralab (${parts.join(", ")})`;
}

async function sendReminderEmail(due: DueReminder[], todayIso: string) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      "Falta RESEND_API_KEY en .env.local. Crea una cuenta en resend.com y agrega la clave.",
    );
  }

  const from =
    process.env.RESEND_FROM_EMAIL?.trim() ||
    "Inspiralab <onboarding@resend.dev>";
  const recipients = getReminderRecipients();
  if (!recipients.length) {
    throw new Error("No hay destinatarios configurados para recordatorios");
  }

  const resend = new Resend(apiKey);
  const { data, error } = await resend.emails.send({
    from,
    to: recipients,
    subject: subjectFor(due),
    html: buildEmailHtml(due, todayIso),
    text: buildEmailText(due, todayIso),
  });

  if (error) {
    throw new Error(error.message || "Error al enviar correo con Resend");
  }

  return { id: data?.id || null, recipients };
}

export type ReminderRunResult = {
  today: string;
  dueCount: number;
  sent: boolean;
  skipped: boolean;
  message: string;
  emailId?: string | null;
  recipients?: string[];
  items?: Array<{
    sessionId: string;
    title: string;
    date: string;
    daysBefore: number;
  }>;
};

export async function runScheduleReminders(
  options?: { dryRun?: boolean; now?: Date },
): Promise<ReminderRunResult> {
  const today = todayInBogota(options?.now);
  const board = await readScheduleBoard();
  const sentKeys = await loadSentKeys();
  const due = findDueReminders(board.sessions, today, sentKeys);

  const items = due.map((item) => ({
    sessionId: item.session.id,
    title: sessionLabel(item.session),
    date: item.session.date,
    daysBefore: item.daysBefore,
  }));

  if (!due.length) {
    return {
      today,
      dueCount: 0,
      sent: false,
      skipped: true,
      message: "No hay recordatorios pendientes para hoy",
      items: [],
    };
  }

  if (options?.dryRun) {
    return {
      today,
      dueCount: due.length,
      sent: false,
      skipped: true,
      message: `Dry run: ${due.length} recordatorio(s) pendientes`,
      recipients: getReminderRecipients(),
      items,
    };
  }

  const email = await sendReminderEmail(due, today);
  const sentAt = new Date().toISOString();
  await markSent(
    due.map((item) => ({
      key: item.key,
      sessionId: item.session.id,
      daysBefore: item.daysBefore,
      sessionDate: item.session.date,
      sentAt,
    })),
  );

  return {
    today,
    dueCount: due.length,
    sent: true,
    skipped: false,
    message: `Correo enviado con ${due.length} recordatorio(s)`,
    emailId: email.id,
    recipients: email.recipients,
    items,
  };
}

export function reminderLogId() {
  return `log-${Date.now()}-${pad(Math.floor(Math.random() * 100))}`;
}
