"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BillingAssistant } from "@/components/admin/BillingAssistant";
import { AdminFooter } from "@/components/admin/AdminFooter";
import { AdminLanguageSwitcher } from "@/components/admin/AdminLanguageSwitcher";
import { MemberAvatar } from "@/components/admin/MemberAvatar";
import { ScheduleSidebarAccordion } from "@/components/admin/ScheduleSidebarAccordion";
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

type ApiResponse = {
  submissions: BillingSubmission[];
  members: TeamMember[];
  isAdmin: boolean;
};

export function BillingBoard() {
  const router = useRouter();
  const toast = useToast();
  const { t } = useAdminLanguage();
  const p = t.billing;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submissions, setSubmissions] = useState<BillingSubmission[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [taskActivities, setTaskActivities] = useState<Activity[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [billingRes, tasksRes] = await Promise.all([
        fetch("/api/billing", { cache: "no-store" }),
        fetch("/api/tasks", { cache: "no-store" }),
      ]);
      if (billingRes.status === 401 || tasksRes.status === 401) {
        router.push("/login");
        return;
      }
      if (!billingRes.ok) {
        const data = (await billingRes.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error || p.loadError);
      }
      const data = (await billingRes.json()) as ApiResponse;
      setSubmissions(Array.isArray(data.submissions) ? data.submissions : []);
      setMembers(Array.isArray(data.members) ? data.members : []);
      setIsAdmin(Boolean(data.isAdmin));

      if (tasksRes.ok) {
        const tasksData = (await tasksRes.json()) as { activities?: Activity[] };
        setTaskActivities(Array.isArray(tasksData.activities) ? tasksData.activities : []);
      } else {
        setTaskActivities([]);
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

  const groupedByMember = useMemo(() => {
    const map = new Map<string, BillingSubmission[]>();
    for (const submission of submissions) {
      const list = map.get(submission.memberId) || [];
      list.push(submission);
      map.set(submission.memberId, list);
    }
    for (const [, list] of map) {
      list.sort((a, b) => {
        const byEnd = b.periodEnd.localeCompare(a.periodEnd);
        if (byEnd !== 0) return byEnd;
        return b.submittedAt.localeCompare(a.submittedAt);
      });
    }
    return [...map.entries()].sort((a, b) => {
      const nameA = membersById.get(a[0])?.name || "";
      const nameB = membersById.get(b[0])?.name || "";
      return nameA.localeCompare(nameB, "es");
    });
  }, [submissions, membersById]);

  async function handleSubmit(input: {
    memberId: string;
    periodStart: string;
    periodEnd: string;
    fileUrl: string;
    fileName: string;
    activities: string[];
  }) {
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
      toast.success(p.savedSuccess);
      await load();
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : p.saveError);
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm(p.deleteConfirm)) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/billing?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error || p.deleteError);
      }
      toast.success(p.deletedSuccess);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : p.deleteError);
    } finally {
      setSaving(false);
    }
  }

  function renderSubmissionCard(submission: BillingSubmission) {
    return (
      <li
        key={submission.id}
        className="border border-[color:var(--line)] bg-white px-3 py-3"
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-sm font-bold text-[color:var(--ink)]">
              {formatPeriod(submission.periodStart, submission.periodEnd)}
            </p>
            <p className="mt-0.5 text-xs text-[color:var(--muted)]">
              {p.submittedOn} {formatDate(submission.submittedAt.slice(0, 10))}
            </p>
          </div>
          <a
            href={submission.fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="border border-[color:var(--line)] px-2 py-1 text-[10px] font-semibold"
          >
            {p.viewInvoice}
          </a>
        </div>
        <div className="mt-3">
          <p className="text-[10px] font-bold uppercase tracking-wide text-[color:var(--muted)]">
            {p.activitiesTitle}
          </p>
          <ol className="mt-1 list-decimal space-y-0.5 pl-5 text-sm text-[color:var(--ink)]">
            {submission.activities.map((line, index) => (
              <li key={`${submission.id}-${index}`}>{line}</li>
            ))}
          </ol>
        </div>
        {isAdmin ? (
          <div className="mt-3">
            <button
              type="button"
              disabled={saving}
              onClick={() => void handleDelete(submission.id)}
              className="border border-red-200 px-2 py-1 text-[10px] font-semibold text-red-700 disabled:opacity-50"
            >
              {t.common.delete}
            </button>
          </div>
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
        {loading ? (
          <p className="text-sm text-[color:var(--muted)]">{p.loading}</p>
        ) : isAdmin ? (
          <div className="space-y-4">
            {groupedByMember.length === 0 ? (
              <p className="text-sm text-[color:var(--muted)]">{p.adminEmpty}</p>
            ) : (
              groupedByMember.map(([memberId, memberSubmissions]) => {
                const member = membersById.get(memberId);
                return (
                  <section
                    key={memberId}
                    className="border border-[color:var(--line)] bg-white p-4"
                  >
                    <div className="flex items-center gap-3 border-b border-[color:var(--line)] pb-3">
                      <MemberAvatar
                        name={member?.name || "—"}
                        photo={member?.photo}
                        size="lg"
                      />
                      <div>
                        <h2 className="text-lg font-bold text-[color:var(--ink)]">
                          {member?.name || p.unknownMember}
                        </h2>
                        {member?.role ? (
                          <p className="text-sm text-[color:var(--muted)]">{member.role}</p>
                        ) : null}
                        <p className="mt-0.5 text-xs text-[color:var(--muted)]">
                          {memberSubmissions.length}{" "}
                          {memberSubmissions.length === 1 ? p.submissionSingular : p.submissionPlural}
                        </p>
                      </div>
                    </div>
                    <ul className="mt-4 space-y-3">
                      {memberSubmissions.map((submission) => renderSubmissionCard(submission))}
                    </ul>
                  </section>
                );
              })
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="border border-[color:var(--line)] bg-white p-6">
              <p className="text-sm leading-relaxed text-[color:var(--ink)]">{p.memberIntro}</p>
            </div>

            {submissions.length > 0 ? (
              <ScheduleSidebarAccordion
                title={p.mySubmissions}
                count={submissions.length}
                defaultOpen={false}
                isEmpty={false}
              >
                <ul className="space-y-3">
                  {submissions.map((submission) => renderSubmissionCard(submission))}
                </ul>
              </ScheduleSidebarAccordion>
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
