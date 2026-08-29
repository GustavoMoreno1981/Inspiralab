"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useToast } from "@/components/admin/AdminToast";
import { daysUntilDue } from "@/lib/alarms";
import {
  formatPsalmLines,
  formatQuoteLine,
  pickDailyPsalm,
  pickDailyQuote,
} from "@/lib/daily-inspiration";
import { useAdminLanguage } from "@/lib/i18n/AdminLanguageContext";
import { formatAdmin, getTaskStatuses } from "@/lib/i18n/admin";
import type { AdminDictionary, AdminLocale } from "@/lib/i18n/admin/types";
import {
  type Activity,
  type TaskStatus,
  type TasksBoard,
  type TeamMember,
} from "@/lib/tasks/types";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatDayLabel(locale: AdminLocale, iso = new Date()) {
  return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "es-CO", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(iso);
}

function formatShort(date: string) {
  if (!date) return "—";
  const [y, m, d] = date.split("-");
  if (!y || !m || !d) return date;
  return `${d}/${m}/${y}`;
}

function absoluteUrl(path: string) {
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;
  if (typeof window === "undefined") return path;
  return `${window.location.origin}${path.startsWith("/") ? path : `/${path}`}`;
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");
}

function formatDaysLeft(t: AdminDictionary, finishedDate: string) {
  const days = daysUntilDue(finishedDate);
  if (days === null) return t.briefing.noEndDate;
  if (days < 0) {
    const n = Math.abs(days);
    return n === 1 ? t.briefing.dueYesterday : formatAdmin(t.briefing.overdueDays, { days: n });
  }
  if (days === 0) return t.briefing.dueToday;
  if (days === 1) return t.briefing.oneDayLeft;
  return formatAdmin(t.briefing.daysLeft, { days });
}

function latestNote(activity: Activity) {
  const notes = activity.notes || [];
  if (!notes.length) return "";
  return [...notes].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]?.text || "";
}

function memberActivities(board: TasksBoard, memberId: string) {
  return board.activities.filter((activity) =>
    (activity.assigneeIds || []).includes(memberId),
  );
}

function coAssignees(
  activity: Activity,
  memberId: string,
  members: TeamMember[],
): TeamMember[] {
  return (activity.assigneeIds || [])
    .filter((id) => id !== memberId)
    .map((id) => members.find((m) => m.id === id))
    .filter(Boolean) as TeamMember[];
}

type MemberDigest = {
  member: TeamMember;
  pendingCount: number;
  /** Actividades no terminadas que aún no están en proceso ni en revisión (ej. en espera / pausa). */
  pendingQueued: Activity[];
  inProgress: Activity[];
  pendingReview: Activity[];
};

function statusLabel(t: AdminDictionary, status: TaskStatus) {
  return getTaskStatuses(t).find((item) => item.value === status)?.label || status;
}

function latestReview(activity: Activity) {
  const messages = activity.reviewMessages || [];
  if (!messages.length) return null;
  return [...messages].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
}

function reviewLink(activity: Activity) {
  const review = latestReview(activity);
  return (
    (review?.url || "").trim() ||
    (activity.processUrl || "").trim() ||
    (activity.deliverableUrl || "").trim()
  );
}

function reviewersLabel(t: AdminDictionary, activity: Activity) {
  const review = latestReview(activity);
  if (review?.recipientNames?.length) {
    return review.recipientNames.join(", ");
  }
  return t.briefing.noReviewerYet;
}

function getMemberDigests(board: TasksBoard): MemberDigest[] {
  return board.members
    .map((member) => {
      const mine = memberActivities(board, member.id);
      const pendingCount = mine.filter((activity) => activity.status !== "done").length;
      const inProgress = mine.filter((activity) => activity.status === "in_progress");
      const pendingReview = mine.filter(
        (activity) => activity.status === "pending_review",
      );
      const pendingQueued = mine.filter(
        (activity) =>
          activity.status !== "done" &&
          activity.status !== "in_progress" &&
          activity.status !== "pending_review",
      );
      return { member, pendingCount, pendingQueued, inProgress, pendingReview };
    })
    .sort((a, b) => a.member.name.localeCompare(b.member.name));
}

function hasActivityDetail(row: MemberDigest) {
  return (
    row.pendingQueued.length > 0 ||
    row.inProgress.length > 0 ||
    row.pendingReview.length > 0
  );
}

function isClearDay(row: MemberDigest) {
  return row.pendingCount === 0 && !hasActivityDetail(row);
}

function truncateNote(note: string) {
  return note.length > 160 ? `${note.slice(0, 157).trimEnd()}…` : note;
}

function appendActivityLines(
  lines: string[],
  activity: Activity,
  memberId: string,
  members: TeamMember[],
  t: AdminDictionary,
  options?: { reviewMode?: boolean },
) {
  const partners = coAssignees(activity, memberId, members);
  const note = latestNote(activity);
  const reviewMode = Boolean(options?.reviewMode);

  lines.push(`- *${activity.title}*`);
  if (reviewMode) {
    lines.push(`  ${t.briefing.reviews}: ${reviewersLabel(t, activity)}`);
  }
  if (partners.length) {
    lines.push(
      `  ${reviewMode ? t.briefing.team : t.briefing.with}: ${partners.map((person) => person.name).join(", ")}`,
    );
  }
  if (reviewMode) {
    const link = reviewLink(activity);
    lines.push(link ? `  Link: ${link}` : `  Link: ${t.briefing.pdfNoReviewUrl}`);
  }
  lines.push(
    `  ${t.briefing.delivery}: ${formatShort(activity.finishedDate)} · ${formatDaysLeft(t, activity.finishedDate)}`,
  );
  if (note) {
    lines.push(`  ${t.briefing.note}: ${truncateNote(note)}`);
  }
}

function buildWhatsAppDigest(
  board: TasksBoard,
  todayLabel: string,
  t: AdminDictionary,
  locale: AdminLocale,
) {
  const rows = getMemberDigests(board);
  const quote = pickDailyQuote(new Date(), locale);
  const psalm = pickDailyPsalm(new Date(), locale);
  const lines: string[] = [
    `*${t.briefing.whatsappTitle}*`,
    todayLabel,
    "",
    formatQuoteLine(quote),
    "",
    t.briefing.whatsappGreeting,
    t.briefing.whatsappIntro,
    "",
  ];

  if (!rows.length) {
    lines.push(t.briefing.whatsappNoOne);
  } else {
    for (const row of rows) {
      lines.push(`*${row.member.name}*`);
      lines.push(
        `${t.briefing.pending}: *${row.pendingCount}*  |  ${t.briefing.inProgress}: *${row.inProgress.length}*  |  ${t.briefing.pendingReview}: *${row.pendingReview.length}*`,
      );

      if (row.pendingQueued.length) {
        lines.push("");
        lines.push(`*${t.briefing.pending}*`);
        for (const activity of row.pendingQueued) {
          const partners = coAssignees(activity, row.member.id, board.members);
          const note = latestNote(activity);
          lines.push(`- *${activity.title}* (${statusLabel(t, activity.status)})`);
          if (partners.length) {
            lines.push(`  ${t.briefing.with}: ${partners.map((person) => person.name).join(", ")}`);
          }
          lines.push(
            `  ${t.briefing.delivery}: ${formatShort(activity.finishedDate)} · ${formatDaysLeft(t, activity.finishedDate)}`,
          );
          if (note) {
            lines.push(`  ${t.briefing.note}: ${truncateNote(note)}`);
          }
        }
      }

      if (row.inProgress.length) {
        lines.push("");
        lines.push(`*${t.briefing.inProgress}*`);
        for (const activity of row.inProgress) {
          appendActivityLines(lines, activity, row.member.id, board.members, t);
        }
      }

      if (row.pendingReview.length) {
        lines.push("");
        lines.push(`*${t.briefing.pendingReview}*`);
        for (const activity of row.pendingReview) {
          appendActivityLines(lines, activity, row.member.id, board.members, t, {
            reviewMode: true,
          });
        }
      }

      if (isClearDay(row)) {
        lines.push(t.briefing.clearDay);
      } else if (!hasActivityDetail(row)) {
        lines.push(t.briefing.nothingToList);
      }

      lines.push("");
    }
  }

  lines.push(t.briefing.whatsappPanel);
  lines.push("");
  lines.push(...formatPsalmLines(psalm));
  return lines.join("\n").trim();
}

function MemberPhoto({
  name,
  photo,
  size = "md",
}: {
  name: string;
  photo?: string;
  size?: "md" | "lg";
}) {
  const box = size === "lg" ? "h-16 w-16" : "h-12 w-12";
  const [broken, setBroken] = useState(false);
  const src = (photo || "").trim();
  if (src && !broken) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name}
        className={`${box} shrink-0 rounded-full object-cover`}
        onError={() => setBroken(true)}
      />
    );
  }
  return (
    <div
      className={`flex ${box} shrink-0 items-center justify-center rounded-full bg-[color:var(--mist)] text-sm font-semibold text-[color:var(--muted)]`}
    >
      {initials(name) || "?"}
    </div>
  );
}

export function AdminDailyBriefing({
  board,
  loading,
}: {
  board: TasksBoard | null;
  loading?: boolean;
}) {
  const toast = useToast();
  const { t, locale } = useAdminLanguage();
  const rows = useMemo(() => (board ? getMemberDigests(board) : []), [board]);
  const totalInProgress = rows.reduce((acc, row) => acc + row.inProgress.length, 0);
  const totalPendingReview = rows.reduce(
    (acc, row) => acc + row.pendingReview.length,
    0,
  );
  const totalPending = rows.reduce((acc, row) => acc + row.pendingCount, 0);
  const todayLabel = formatDayLabel(locale);
  const dailyQuote = useMemo(() => pickDailyQuote(new Date(), locale), [locale]);
  const dailyPsalm = useMemo(() => pickDailyPsalm(new Date(), locale), [locale]);

  function shareWhatsApp() {
    if (!board) return;
    const text = buildWhatsAppDigest(board, todayLabel, t, locale);
    const href = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(href, "_blank", "noopener,noreferrer");
    toast.success(t.briefing.whatsappReady);
  }

  function renderActivityBlock(
    activity: Activity,
    memberId: string,
    reviewMode: boolean,
  ) {
    const partners = board ? coAssignees(activity, memberId, board.members) : [];
    const note = latestNote(activity);
    const link = reviewLink(activity);
    return `
      <li>
        <strong>${escapeHtml(activity.title)}</strong>
        ${
          reviewMode
            ? `<span class="meta">${t.briefing.reviews}: ${escapeHtml(reviewersLabel(t, activity))}</span>`
            : ""
        }
        ${
          partners.length
            ? `<span class="meta">${reviewMode ? t.briefing.team : t.briefing.with}: ${escapeHtml(partners.map((p) => p.name).join(", "))}</span>`
            : ""
        }
        ${
          reviewMode
            ? link
              ? `<span class="meta">Link: <a href="${escapeHtml(link)}">${escapeHtml(link)}</a></span>`
              : `<span class="meta">Link: ${escapeHtml(t.briefing.pdfNoReviewUrl)}</span>`
            : ""
        }
        <span class="meta">${t.briefing.delivery} ${escapeHtml(formatShort(activity.finishedDate))} · ${escapeHtml(formatDaysLeft(t, activity.finishedDate))}</span>
        ${note ? `<span class="meta">${t.briefing.note}: ${escapeHtml(note)}</span>` : ""}
      </li>`;
  }

  function exportPdf() {
    const quote = pickDailyQuote(new Date(), locale);
    const psalm = pickDailyPsalm(new Date(), locale);
    const peopleHtml = rows.length
      ? rows
          .map((row) => {
            const photo = absoluteUrl(row.member.photo || "");
            const photoBlock = photo
              ? `<img class="photo" src="${escapeHtml(photo)}" alt="${escapeHtml(row.member.name)}" />`
              : `<div class="photo placeholder">${escapeHtml(initials(row.member.name) || "?")}</div>`;

            const pendingHtml = row.pendingQueued.length
              ? `<h3>${escapeHtml(t.briefing.pending)}</h3><ul>${row.pendingQueued
                  .map((activity) => {
                    const partners = coAssignees(
                      activity,
                      row.member.id,
                      board?.members || [],
                    );
                    const note = latestNote(activity);
                    return `
                      <li>
                        <strong>${escapeHtml(activity.title)}</strong>
                        <span class="meta">${escapeHtml(statusLabel(t, activity.status))}</span>
                        ${
                          partners.length
                            ? `<span class="meta">${t.briefing.with}: ${escapeHtml(partners.map((p) => p.name).join(", "))}</span>`
                            : ""
                        }
                        <span class="meta">${t.briefing.delivery} ${escapeHtml(formatShort(activity.finishedDate))} · ${escapeHtml(formatDaysLeft(t, activity.finishedDate))}</span>
                        ${note ? `<span class="meta">${t.briefing.note}: ${escapeHtml(note)}</span>` : ""}
                      </li>`;
                  })
                  .join("")}</ul>`
              : "";
            const inProgressHtml = row.inProgress.length
              ? `<h3>${escapeHtml(t.briefing.inProgress)}</h3><ul>${row.inProgress
                  .map((activity) => renderActivityBlock(activity, row.member.id, false))
                  .join("")}</ul>`
              : "";
            const reviewHtml = row.pendingReview.length
              ? `<h3>${escapeHtml(t.briefing.pendingReview)}</h3><ul>${row.pendingReview
                  .map((activity) => renderActivityBlock(activity, row.member.id, true))
                  .join("")}</ul>`
              : "";
            const emptyHtml = isClearDay(row)
              ? `<p class="meta">${escapeHtml(t.briefing.clearDay)}</p>`
              : !hasActivityDetail(row)
                ? `<p class="meta">${escapeHtml(t.briefing.nothingToList)}</p>`
                : "";

            return `
              <article class="person">
                <div class="head">
                  ${photoBlock}
                  <div>
                    <h2>${escapeHtml(row.member.name)}</h2>
                    <p class="role">${escapeHtml(row.member.role || t.briefing.memberRole)} · ${formatAdmin(t.briefing.pendingCount, { count: row.pendingCount, inProgress: row.inProgress.length, review: row.pendingReview.length })}</p>
                  </div>
                </div>
                ${pendingHtml}
                ${inProgressHtml}
                ${reviewHtml}
                ${emptyHtml}
              </article>`;
          })
          .join("")
      : `<p class="empty">${escapeHtml(t.briefing.pdfNoOne)}</p>`;

    const html = `<!DOCTYPE html>
<html lang="${locale}">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(t.briefing.pdfTitle)} — ${escapeHtml(todayLabel)}</title>
  <style>
    body {
      font-family: Georgia, "Times New Roman", serif;
      color: #1a1a1a;
      padding: 36px 40px;
      max-width: 720px;
      margin: 0 auto;
      line-height: 1.45;
    }
    .letter-head { margin-bottom: 28px; }
    .brand { font-family: Arial, Helvetica, sans-serif; color: #e00d45; font-weight: 700; font-size: 13px; letter-spacing: 0.04em; text-transform: uppercase; margin: 0 0 18px; }
    .salute { font-size: 22px; margin: 0 0 8px; }
    .motto { font-size: 16px; font-style: italic; margin: 0 0 6px; color: #333; }
    .author { font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #777; margin: 0 0 14px; }
    .intro { font-family: Arial, Helvetica, sans-serif; font-size: 13px; color: #555; margin: 0 0 8px; }
    .date { font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #777; margin: 0 0 28px; }
    .psalm { margin-top: 24px; padding-top: 14px; border-top: 1px solid #eee; }
    .psalm-ref { font-family: Arial, Helvetica, sans-serif; font-size: 12px; font-weight: 700; color: #e00d45; margin: 0 0 6px; }
    .psalm-text { font-size: 15px; font-style: italic; margin: 0; color: #333; }
    .person {
      border-top: 1px solid #ddd;
      padding: 18px 0;
      page-break-inside: avoid;
    }
    .head { display: flex; gap: 14px; align-items: center; margin-bottom: 10px; }
    .photo { width: 64px; height: 64px; object-fit: cover; border-radius: 999px; background: #f3f3f3; }
    .photo.placeholder {
      display: flex; align-items: center; justify-content: center;
      font-family: Arial, Helvetica, sans-serif; font-weight: 700; color: #888; font-size: 16px;
    }
    h2 { font-family: Arial, Helvetica, sans-serif; font-size: 16px; margin: 0; }
    h3 { font-family: Arial, Helvetica, sans-serif; font-size: 12px; margin: 14px 0 6px; color: #e00d45; text-transform: uppercase; letter-spacing: 0.04em; }
    .role { font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #666; margin: 2px 0 0; }
    ul { margin: 0; padding-left: 18px; font-family: Arial, Helvetica, sans-serif; font-size: 13px; }
    li { margin: 0 0 10px; }
    li strong { display: block; }
    .meta { display: block; color: #666; font-size: 11px; margin-top: 2px; }
    a { color: #e00d45; word-break: break-all; }
    .empty { font-family: Arial, Helvetica, sans-serif; color: #666; }
    .footer { margin-top: 28px; font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #888; border-top: 1px solid #eee; padding-top: 12px; }
    @media print {
      body { padding: 0; }
      @page { margin: 14mm; size: portrait; }
    }
  </style>
</head>
<body>
  <div class="letter-head">
    <p class="brand">Inspiralab</p>
    <p class="motto">“${escapeHtml(quote.text)}”</p>
    <p class="author">— ${escapeHtml(quote.author)}</p>
    <p class="salute">${escapeHtml(t.briefing.pdfGreeting)}</p>
    <p class="intro">${escapeHtml(t.briefing.pdfIntro)}</p>
    <p class="date">${escapeHtml(todayLabel)}</p>
  </div>
  ${peopleHtml}
  <div class="psalm">
    <p class="psalm-ref">${escapeHtml(psalm.reference)}</p>
    <p class="psalm-text">${escapeHtml(psalm.text)}</p>
  </div>
  <p class="footer">${escapeHtml(formatAdmin(t.briefing.pdfFooter, { members: rows.length, pending: totalPending, inProgress: totalInProgress, review: totalPendingReview }))}</p>
</body>
</html>`;

    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, "_blank");
    if (!win) {
      URL.revokeObjectURL(url);
      alert(t.briefing.allowPopups);
      return;
    }
    window.setTimeout(() => {
      try {
        win.focus();
        win.print();
      } catch {
        // imprimir manualmente
      }
    }, 500);
    window.setTimeout(() => URL.revokeObjectURL(url), 120_000);
  }

  if (loading) {
    return (
      <section className="mt-10 border border-[color:var(--line)] bg-white p-5">
        <p className="text-sm text-[color:var(--muted)]">{t.briefing.loading}</p>
      </section>
    );
  }

  return (
    <section className="mt-10 space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-2xl font-bold text-[color:var(--ink)]">
            {t.briefing.title}
          </h2>
          <p className="mt-1 text-sm text-[color:var(--muted)]">
            {t.briefing.subtitle} {todayLabel}.
          </p>
          <p className="mt-2 text-sm italic text-[color:var(--ink)]">
            “{dailyQuote.text}” — {dailyQuote.author}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/admin/tareas"
            className="border border-[color:var(--line)] bg-white px-3 py-2 text-xs font-semibold"
          >
            {t.briefing.viewTasks}
          </Link>
          <button
            type="button"
            onClick={exportPdf}
            className="border border-[color:var(--line)] bg-white px-3 py-2 text-xs font-semibold"
          >
            {t.briefing.exportPdf}
          </button>
          <button
            type="button"
            onClick={shareWhatsApp}
            disabled={!board}
            className="bg-[#25D366] px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
          >
            {t.briefing.shareWhatsApp}
          </button>
        </div>
      </div>

      <p className="border border-[color:var(--line)] bg-white px-4 py-3 text-sm text-[color:var(--ink)]">
        <span className="font-semibold text-[color:var(--accent)]">
          {dailyPsalm.reference}
        </span>
        <span className="mt-1 block italic text-[color:var(--muted)]">
          {dailyPsalm.text}
        </span>
      </p>

      {rows.length === 0 ? (
        <div className="border border-[color:var(--line)] bg-white px-4 py-8 text-center text-sm text-[color:var(--muted)]">
          {t.briefing.noMembers}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {rows.map(({ member, pendingCount, pendingQueued, inProgress, pendingReview }) => {
            const clear = pendingCount === 0 && !pendingQueued.length && !inProgress.length && !pendingReview.length;
            return (
            <article
              key={member.id}
              className="border border-[color:var(--line)] bg-white p-4"
            >
              <div className="flex items-center gap-3">
                <MemberPhoto name={member.name} photo={member.photo} />
                <div className="min-w-0">
                  <p className="truncate font-semibold text-[color:var(--ink)]">
                    {member.name}
                  </p>
                  <p className="truncate text-xs text-[color:var(--muted)]">
                    {formatAdmin(t.briefing.pendingCount, {
                      count: pendingCount,
                      inProgress: inProgress.length,
                      review: pendingReview.length,
                    })}
                  </p>
                </div>
              </div>

              <div className="mt-4 space-y-4 border-t border-[color:var(--line)] pt-3">
                {pendingQueued.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-[color:var(--muted)]">
                      {t.briefing.pending}
                    </p>
                    <ul className="space-y-3">
                      {pendingQueued.map((activity) => {
                        const partners = board
                          ? coAssignees(activity, member.id, board.members)
                          : [];
                        const note = latestNote(activity);
                        return (
                          <li key={activity.id}>
                            <p className="text-sm font-semibold text-[color:var(--ink)]">
                              {activity.title}
                            </p>
                            <p className="text-xs text-[color:var(--muted)]">
                              {statusLabel(t, activity.status)}
                            </p>
                            {partners.length > 0 ? (
                              <p className="text-xs text-[color:var(--muted)]">
                                {t.briefing.with}: {partners.map((p) => p.name).join(", ")}
                              </p>
                            ) : null}
                            <p className="text-xs text-[color:var(--muted)]">
                              {t.briefing.delivery} {formatShort(activity.finishedDate)} ·{" "}
                              {formatDaysLeft(t, activity.finishedDate)}
                            </p>
                            {note ? (
                              <p className="mt-1 text-xs text-[color:var(--ink)]">
                                {t.briefing.note}: {note}
                              </p>
                            ) : null}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ) : null}

                {inProgress.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-[color:var(--accent)]">
                      {t.briefing.inProgress}
                    </p>
                    <ul className="space-y-3">
                      {inProgress.map((activity) => {
                        const partners = board
                          ? coAssignees(activity, member.id, board.members)
                          : [];
                        const note = latestNote(activity);
                        return (
                          <li key={activity.id}>
                            <p className="text-sm font-semibold text-[color:var(--ink)]">
                              {activity.title}
                            </p>
                            {partners.length > 0 ? (
                              <p className="text-xs text-[color:var(--muted)]">
                                {t.briefing.with}: {partners.map((p) => p.name).join(", ")}
                              </p>
                            ) : null}
                            <p className="text-xs text-[color:var(--muted)]">
                              {t.briefing.delivery} {formatShort(activity.finishedDate)} ·{" "}
                              {formatDaysLeft(t, activity.finishedDate)}
                            </p>
                            {note ? (
                              <p className="mt-1 text-xs text-[color:var(--ink)]">
                                {t.briefing.note}: {note}
                              </p>
                            ) : null}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ) : null}

                {pendingReview.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-[#a16207]">
                      {t.briefing.pendingReview}
                    </p>
                    <ul className="space-y-3">
                      {pendingReview.map((activity) => {
                        const partners = board
                          ? coAssignees(activity, member.id, board.members)
                          : [];
                        const note = latestNote(activity);
                        const link = reviewLink(activity);
                        return (
                          <li key={activity.id}>
                            <p className="text-sm font-semibold text-[color:var(--ink)]">
                              {activity.title}
                            </p>
                            <p className="text-xs text-[color:var(--muted)]">
                              {t.briefing.reviews}: {reviewersLabel(t, activity)}
                            </p>
                            {partners.length > 0 ? (
                              <p className="text-xs text-[color:var(--muted)]">
                                {t.briefing.team}: {partners.map((p) => p.name).join(", ")}
                              </p>
                            ) : null}
                            {link ? (
                              <a
                                href={link}
                                target="_blank"
                                rel="noreferrer"
                                className="break-all text-xs font-semibold text-[color:var(--accent)] underline-offset-2 hover:underline"
                              >
                                {link}
                              </a>
                            ) : (
                              <p className="text-xs text-[color:var(--muted)]">
                                {t.briefing.noReviewUrl}
                              </p>
                            )}
                            <p className="text-xs text-[color:var(--muted)]">
                              {t.briefing.delivery} {formatShort(activity.finishedDate)} ·{" "}
                              {formatDaysLeft(t, activity.finishedDate)}
                            </p>
                            {note ? (
                              <p className="mt-1 text-xs text-[color:var(--ink)]">
                                {t.briefing.note}: {note}
                              </p>
                            ) : null}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ) : null}

                {clear ? (
                  <p className="text-sm text-[color:var(--muted)]">
                    {t.briefing.clearDay}
                  </p>
                ) : !pendingQueued.length &&
                  !inProgress.length &&
                  !pendingReview.length ? (
                  <p className="text-sm text-[color:var(--muted)]">
                    {t.briefing.nothingToList}
                  </p>
                ) : null}
              </div>
            </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
