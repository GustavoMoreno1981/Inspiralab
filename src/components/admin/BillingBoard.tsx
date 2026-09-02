"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BillingAssistant } from "@/components/admin/BillingAssistant";
import { BillingActivitiesEditor } from "@/components/admin/BillingActivitiesEditor";
import { BillingPaymentReceiptUpload } from "@/components/admin/BillingPaymentReceiptUpload";
import { AdminFooter } from "@/components/admin/AdminFooter";
import { AdminLanguageSwitcher } from "@/components/admin/AdminLanguageSwitcher";
import { MemberAvatar } from "@/components/admin/MemberAvatar";
import { useToast } from "@/components/admin/AdminToast";
import { useAdminLanguage } from "@/lib/i18n/AdminLanguageContext";
import type { BillingSubmission } from "@/lib/billing/types";
import type { Activity, TeamMember } from "@/lib/tasks/types";

function formatDate(iso: string) {
  if (!iso) return "—";
  return iso.split("-").reverse().join("/");
}

function formatPeriod(start: string, end: string) {
  return `${formatDate(start)} – ${formatDate(end)}`;
}

function monthKeyFromSubmission(submission: BillingSubmission): string {
  const raw = submission.periodEnd || submission.periodStart || submission.submittedAt.slice(0, 10);
  return raw.slice(0, 7);
}

function formatMonthLabel(monthKey: string, locale: "es" | "en"): string {
  const [year, month] = monthKey.split("-").map(Number);
  if (!year || !month) return monthKey;
  return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "es-CO", {
    month: "long",
    year: "numeric",
  }).format(new Date(year, month - 1, 1));
}

type MemberMonthGroup = {
  memberId: string;
  months: Array<{ monthKey: string; submissions: BillingSubmission[] }>;
  totalCount: number;
};

function groupSubmissionsByMemberAndMonth(
  submissions: BillingSubmission[],
  membersById: Map<string, TeamMember>,
): MemberMonthGroup[] {
  const byMember = new Map<string, Map<string, BillingSubmission[]>>();

  for (const submission of submissions) {
    const monthKey = monthKeyFromSubmission(submission);
    if (!byMember.has(submission.memberId)) {
      byMember.set(submission.memberId, new Map());
    }
    const monthMap = byMember.get(submission.memberId)!;
    const list = monthMap.get(monthKey) || [];
    list.push(submission);
    monthMap.set(monthKey, list);
  }

  const groups: MemberMonthGroup[] = [];

  for (const [memberId, monthMap] of byMember) {
    const months = [...monthMap.entries()]
      .map(([monthKey, items]) => ({
        monthKey,
        submissions: items.sort((a, b) => {
          const byEnd = b.periodEnd.localeCompare(a.periodEnd);
          if (byEnd !== 0) return byEnd;
          return b.submittedAt.localeCompare(a.submittedAt);
        }),
      }))
      .sort((a, b) => b.monthKey.localeCompare(a.monthKey));

    groups.push({
      memberId,
      months,
      totalCount: months.reduce((sum, month) => sum + month.submissions.length, 0),
    });
  }

  return groups.sort((a, b) => {
    const nameA = membersById.get(a.memberId)?.name || "";
    const nameB = membersById.get(b.memberId)?.name || "";
    return nameA.localeCompare(nameB, "es");
  });
}

function monthFolderId(memberId: string, monthKey: string) {
  return `${memberId}::${monthKey}`;
}

type ApiResponse = {
  submissions: BillingSubmission[];
  members: TeamMember[];
  taskActivities?: Activity[];
  isAdmin: boolean;
};

export function BillingBoard() {
  const router = useRouter();
  const toast = useToast();
  const { t, locale } = useAdminLanguage();
  const p = t.billing;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submissions, setSubmissions] = useState<BillingSubmission[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [taskActivities, setTaskActivities] = useState<Activity[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [expandedMembers, setExpandedMembers] = useState<Set<string>>(new Set());
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/billing", { cache: "no-store" });
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error || p.loadError);
      }
      const data = (await res.json()) as ApiResponse;
      setSubmissions(Array.isArray(data.submissions) ? data.submissions : []);
      setMembers(Array.isArray(data.members) ? data.members : []);
      setTaskActivities(
        Array.isArray(data.taskActivities) ? data.taskActivities : [],
      );
      setIsAdmin(Boolean(data.isAdmin));
      if (Boolean(data.isAdmin)) {
        router.replace("/admin/contabilidad?billing=1");
        return;
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : p.loadError);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const membersById = useMemo(() => {
    const map = new Map<string, TeamMember>();
    for (const member of members) map.set(member.id, member);
    return map;
  }, [members]);

  const groupedSubmissions = useMemo(
    () => groupSubmissionsByMemberAndMonth(submissions, membersById),
    [submissions, membersById],
  );

  useEffect(() => {
    if (!groupedSubmissions.length) return;
    setExpandedMembers(new Set(groupedSubmissions.map((group) => group.memberId)));
    setExpandedMonths(
      new Set(
        groupedSubmissions.flatMap((group) => {
          const latestMonth = group.months[0]?.monthKey;
          return latestMonth ? [monthFolderId(group.memberId, latestMonth)] : [];
        }),
      ),
    );
  }, [groupedSubmissions]);

  function toggleMember(memberId: string) {
    setExpandedMembers((prev) => {
      const next = new Set(prev);
      if (next.has(memberId)) next.delete(memberId);
      else next.add(memberId);
      return next;
    });
  }

  function toggleMonth(memberId: string, monthKey: string) {
    const id = monthFolderId(memberId, monthKey);
    setExpandedMonths((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSubmit(input: {
    memberId: string;
    periodStart: string;
    periodEnd: string;
    fileUrl: string;
    fileName: string;
    activities: string[];
  }): Promise<BillingSubmission | null> {
    setSaving(true);
    try {
      const res = await fetch("/api/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error || p.saveError);
      }
      const data = (await res.json()) as { submission?: BillingSubmission };
      toast.success(p.savedSuccess);
      await load();
      return data.submission || null;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : p.saveError);
      return null;
    } finally {
      setSaving(false);
    }
  }

  function renderSubmissionCard(submission: BillingSubmission, compact = false) {
    const member = membersById.get(submission.memberId);
    return (
      <li
        key={submission.id}
        className="border border-[color:var(--line)] bg-[color:var(--paper)] px-3 py-3"
      >
        <div className="flex items-start gap-3 border-b border-[color:var(--line)]/60 pb-3">
          {!compact ? (
            <MemberAvatar
              name={member?.name || p.unknownMember}
              photo={member?.photo}
              size="md"
            />
          ) : null}
          <div className="min-w-0 flex-1">
            {!compact ? (
              <p className="text-sm font-semibold text-[color:var(--ink)]">
                {p.receiptMember.replace("{name}", member?.name || p.unknownMember)}
              </p>
            ) : null}
            <p className={`text-sm font-bold text-[color:var(--ink)] ${compact ? "" : "mt-1"}`}>
              {formatPeriod(submission.periodStart, submission.periodEnd)}
            </p>
            <p className="mt-0.5 text-xs text-[color:var(--muted)]">
              {p.submittedOn} {formatDate(submission.submittedAt.slice(0, 10))}
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <span className="border border-[color:var(--line)] bg-white px-2 py-1 text-[10px] font-semibold text-[color:var(--muted)]">
              {p.invoiceSent}
            </span>
            {submission.paymentReceiptAt ? (
              <span className="border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-800">
                {p.paymentReceiptSent}
              </span>
            ) : null}
          </div>
        </div>
        <BillingActivitiesEditor
          submissionId={submission.id}
          activities={submission.activities}
          editable={!submission.archivedAt}
          onUpdated={load}
        />
        {!submission.archivedAt ? (
          <BillingPaymentReceiptUpload
            submissionId={submission.id}
            hasReceipt={Boolean(submission.paymentReceiptAt)}
            onUploaded={load}
          />
        ) : null}
      </li>
    );
  }

  return (
    <div className="flex min-h-[100svh] flex-col bg-[color:var(--mist)]">
      <header className="border-b border-[color:var(--line)] bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-5 py-5 md:px-8">
          <div>
            <p className="font-[family-name:var(--font-display)] text-xl font-bold text-[color:var(--accent)]">
              Inspiralab
            </p>
            <p className="text-sm text-[color:var(--muted)]">{p.title}</p>
            <p className="mt-1 text-[11px] text-[color:var(--muted)]">{p.subtitle}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <AdminLanguageSwitcher />
            <Link
              href="/admin"
              className="border border-[color:var(--line)] px-3 py-2 text-xs font-semibold"
            >
              {t.common.panel}
            </Link>
            <Link
              href="/"
              className="border border-[color:var(--line)] px-3 py-2 text-xs font-semibold text-[color:var(--ink)]"
            >
              {t.common.viewSite}
            </Link>
            {!isAdmin ? (
              <button
                type="button"
                onClick={() => setAssistantOpen(true)}
                className="bg-[color:var(--accent)] px-3 py-2 text-xs font-semibold text-white"
              >
                {p.uploadButton}
              </button>
            ) : null}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-8 pb-16 md:px-8">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold text-[color:var(--ink)]">
            {p.title}
          </h1>
          <p className="mt-2 max-w-xl text-sm text-[color:var(--muted)]">{p.subtitle}</p>
        </div>

        <div className="mt-8">
        {isAdmin || loading ? (
          <p className="text-sm text-[color:var(--muted)]">{p.loading}</p>
        ) : (
          <div className="space-y-4">
            <div className="border border-[color:var(--line)] bg-white p-6">
              <p className="text-sm leading-relaxed text-[color:var(--ink)]">{p.memberIntro}</p>
            </div>

            {submissions.length > 0 ? (
              <section className="border border-[color:var(--line)] bg-white p-4">
                <h2 className="text-sm font-semibold text-[color:var(--ink)]">
                  {p.submissionsRecord}
                </h2>
                <p className="mt-1 text-xs text-[color:var(--muted)]">
                  {p.groupedRecordHint}
                </p>
                <div className="mt-4 space-y-3">
                  {groupedSubmissions.map((group) => {
                    const member = membersById.get(group.memberId);
                    const memberOpen = expandedMembers.has(group.memberId);
                    return (
                      <section
                        key={group.memberId}
                        className="border border-[color:var(--line)] bg-[color:var(--paper)]"
                      >
                        <button
                          type="button"
                          onClick={() => toggleMember(group.memberId)}
                          className="flex w-full items-center gap-3 px-3 py-3 text-left"
                        >
                          <span
                            className="text-xs text-[color:var(--muted)]"
                            aria-hidden
                          >
                            {memberOpen ? "▾" : "▸"}
                          </span>
                          <MemberAvatar
                            name={member?.name || p.unknownMember}
                            photo={member?.photo}
                            size="md"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-bold text-[color:var(--ink)]">
                              {member?.name || p.unknownMember}
                            </p>
                            {member?.role ? (
                              <p className="text-xs text-[color:var(--muted)]">{member.role}</p>
                            ) : null}
                            <p className="mt-0.5 text-[11px] text-[color:var(--muted)]">
                              {group.totalCount}{" "}
                              {group.totalCount === 1
                                ? p.submissionSingular
                                : p.submissionPlural}
                            </p>
                          </div>
                        </button>

                        {memberOpen ? (
                          <div className="space-y-2 border-t border-[color:var(--line)] px-3 pb-3 pt-2">
                            {group.months.map((monthGroup) => {
                              const folderId = monthFolderId(group.memberId, monthGroup.monthKey);
                              const monthOpen = expandedMonths.has(folderId);
                              return (
                                <div
                                  key={folderId}
                                  className="border border-[color:var(--line)] bg-white"
                                >
                                  <button
                                    type="button"
                                    onClick={() =>
                                      toggleMonth(group.memberId, monthGroup.monthKey)
                                    }
                                    className="flex w-full items-center gap-2 px-3 py-2.5 text-left"
                                  >
                                    <span
                                      className="text-xs text-[color:var(--muted)]"
                                      aria-hidden
                                    >
                                      {monthOpen ? "▾" : "▸"}
                                    </span>
                                    <span className="text-base" aria-hidden>
                                      📁
                                    </span>
                                    <div className="min-w-0 flex-1">
                                      <p className="text-sm font-semibold capitalize text-[color:var(--ink)]">
                                        {formatMonthLabel(monthGroup.monthKey, locale)}
                                      </p>
                                      <p className="text-[11px] text-[color:var(--muted)]">
                                        {monthGroup.submissions.length}{" "}
                                        {monthGroup.submissions.length === 1
                                          ? p.submissionSingular
                                          : p.submissionPlural}
                                      </p>
                                    </div>
                                  </button>
                                  {monthOpen ? (
                                    <ul className="space-y-2 border-t border-[color:var(--line)]/60 px-2 pb-2 pt-2">
                                      {monthGroup.submissions.map((submission) =>
                                        renderSubmissionCard(submission, true),
                                      )}
                                    </ul>
                                  ) : null}
                                </div>
                              );
                            })}
                          </div>
                        ) : null}
                      </section>
                    );
                  })}
                </div>
              </section>
            ) : null}
          </div>
        )}
        </div>
      </main>

      <AdminFooter />

      <BillingAssistant
        open={assistantOpen}
        members={members}
        taskActivities={taskActivities}
        saving={saving}
        onClose={() => {
          setAssistantOpen(false);
          void load();
        }}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
