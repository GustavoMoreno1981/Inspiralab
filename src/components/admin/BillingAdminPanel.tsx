"use client";

import { useEffect, useMemo, useState } from "react";
import { MemberAvatar } from "@/components/admin/MemberAvatar";
import { BillingActivitiesEditor } from "@/components/admin/BillingActivitiesEditor";
import { BillingShareWhatsAppModal } from "@/components/admin/BillingShareWhatsAppModal";
import { useToast } from "@/components/admin/AdminToast";
import { useAdminLanguage } from "@/lib/i18n/AdminLanguageContext";
import type { BillingSubmission } from "@/lib/billing/types";
import type { TeamMember } from "@/lib/tasks/types";

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

type BillingAdminPanelProps = {
  onBack?: () => void;
};

export function BillingAdminPanel({ onBack }: BillingAdminPanelProps) {
  const toast = useToast();
  const { t } = useAdminLanguage();
  const p = t.billing;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submissions, setSubmissions] = useState<BillingSubmission[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [archivedMemberId, setArchivedMemberId] = useState<string | null>(null);
  const [shareSubmission, setShareSubmission] = useState<BillingSubmission | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/billing", { cache: "no-store" });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error || p.loadError);
      }
      const data = (await res.json()) as ApiResponse;
      setSubmissions(Array.isArray(data.submissions) ? data.submissions : []);
      setMembers(Array.isArray(data.members) ? data.members : []);
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

  const activeSubmissions = useMemo(
    () => submissions.filter((item) => !item.archivedAt),
    [submissions],
  );

  const archivedSubmissions = useMemo(
    () => submissions.filter((item) => item.archivedAt),
    [submissions],
  );

  const activeByMember = useMemo(() => {
    const map = new Map<string, BillingSubmission[]>();
    for (const submission of activeSubmissions) {
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
  }, [activeSubmissions, membersById]);

  const archivedByMember = useMemo(() => {
    const map = new Map<string, BillingSubmission[]>();
    for (const submission of archivedSubmissions) {
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
  }, [archivedSubmissions, membersById]);

  const archivedModalMember = archivedMemberId
    ? membersById.get(archivedMemberId)
    : undefined;
  const archivedModalSubmissions = archivedMemberId
    ? archivedByMember.find(([id]) => id === archivedMemberId)?.[1] || []
    : [];

  async function handleArchive(id: string) {
    if (!window.confirm(p.archiveConfirm)) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/billing?id=${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "archive" }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error || p.archiveError);
      }
      toast.success(p.archivedSuccess);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : p.archiveError);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm(p.deleteConfirm)) return;
    const wasLastInModal =
      archivedMemberId !== null &&
      archivedModalSubmissions.length === 1 &&
      archivedModalSubmissions[0]?.id === id;
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
      if (wasLastInModal) setArchivedMemberId(null);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : p.deleteError);
    } finally {
      setSaving(false);
    }
  }

  function renderSubmissionCard(
    submission: BillingSubmission,
    options: { showArchive?: boolean; showDelete?: boolean } = {},
  ) {
    const { showArchive = false, showDelete = false } = options;
    const canEditActivities = !submission.archivedAt;
    const member = membersById.get(submission.memberId);
    return (
      <li
        key={submission.id}
        className="border border-[color:var(--line)] bg-white px-3 py-3"
      >
        <div className="flex items-start gap-3 border-b border-[color:var(--line)]/60 pb-3">
          <MemberAvatar
            name={member?.name || p.unknownMember}
            photo={member?.photo}
            size="md"
          />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-[color:var(--ink)]">
              {p.receiptMember.replace("{name}", member?.name || p.unknownMember)}
            </p>
            <p className="mt-1 text-sm font-bold text-[color:var(--ink)]">
              {formatPeriod(submission.periodStart, submission.periodEnd)}
            </p>
            <p className="mt-0.5 text-xs text-[color:var(--muted)]">
              {p.submittedOn} {formatDate(submission.submittedAt.slice(0, 10))}
            </p>
            {submission.archivedAt ? (
              <p className="mt-0.5 text-xs text-[color:var(--muted)]">
                {p.archivedOn} {formatDate(submission.archivedAt.slice(0, 10))}
              </p>
            ) : null}
          </div>
          {submission.fileUrl || submission.paymentReceiptUrl ? (
            <div className="flex shrink-0 flex-col gap-1">
              {submission.fileUrl ? (
                <a
                  href={submission.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="border border-[color:var(--line)] px-2 py-1 text-[10px] font-semibold"
                >
                  {p.viewInvoice}
                </a>
              ) : null}
              {submission.paymentReceiptUrl ? (
                <a
                  href={submission.paymentReceiptUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-800"
                >
                  {p.viewPaymentReceipt}
                </a>
              ) : (
                <span className="border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] font-semibold text-amber-800">
                  {p.paymentReceiptPending}
                </span>
              )}
              {submission.fileUrl ? (
                <button
                  type="button"
                  onClick={() => setShareSubmission(submission)}
                  className="bg-[#25D366] px-2 py-1 text-[10px] font-semibold text-white"
                >
                  {p.shareWhatsAppButton}
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
        <BillingActivitiesEditor
          submissionId={submission.id}
          activities={submission.activities}
          editable={canEditActivities}
          onUpdated={load}
        />
        {showArchive || showDelete ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {showArchive ? (
              <button
                type="button"
                disabled={saving}
                onClick={() => void handleArchive(submission.id)}
                className="border border-[color:var(--line)] px-2 py-1 text-[10px] font-semibold text-[color:var(--ink)] disabled:opacity-50"
              >
                {p.archiveButton}
              </button>
            ) : null}
            {showDelete ? (
              <button
                type="button"
                disabled={saving}
                onClick={() => void handleDelete(submission.id)}
                className="border border-red-200 px-2 py-1 text-[10px] font-semibold text-red-700 disabled:opacity-50"
              >
                {t.common.delete}
              </button>
            ) : null}
          </div>
        ) : null}
      </li>
    );
  }

  if (loading) {
    return <p className="text-sm text-[color:var(--muted)]">{p.loading}</p>;
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold text-[color:var(--ink)]">
            {p.title}
          </h1>
          <p className="mt-2 max-w-xl text-sm text-[color:var(--muted)]">
            {p.adminPanelHint}
          </p>
        </div>
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="border border-[color:var(--line)] px-3 py-2 text-xs font-semibold"
          >
            {t.accounting.backToAccounting}
          </button>
        ) : null}
      </div>

      <section className="space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-[color:var(--ink)]">{p.activeSection}</h2>
          <p className="mt-1 text-xs text-[color:var(--muted)]">{p.submissionsRecordHint}</p>
        </div>
        {activeByMember.length === 0 ? (
          <p className="text-sm text-[color:var(--muted)]">{p.adminEmpty}</p>
        ) : (
          activeByMember.map(([memberId, memberSubmissions]) => {
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
                    <h3 className="text-lg font-bold text-[color:var(--ink)]">
                      {member?.name || p.unknownMember}
                    </h3>
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
                  {memberSubmissions.map((submission) =>
                    renderSubmissionCard(submission, { showArchive: true }),
                  )}
                </ul>
              </section>
            );
          })
        )}
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-[color:var(--ink)]">{p.archivedSection}</h2>
          <p className="mt-1 text-xs text-[color:var(--muted)]">{p.archivedSectionHint}</p>
        </div>
        {archivedByMember.length === 0 ? (
          <p className="text-sm text-[color:var(--muted)]">{p.archivedEmpty}</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {archivedByMember.map(([memberId, memberSubmissions]) => {
              const member = membersById.get(memberId);
              return (
                <button
                  key={memberId}
                  type="button"
                  onClick={() => setArchivedMemberId(memberId)}
                  className="flex items-center gap-4 border border-[color:var(--line)] bg-white p-4 text-left transition-colors hover:border-[color:var(--accent)]"
                >
                  <MemberAvatar
                    name={member?.name || p.unknownMember}
                    photo={member?.photo}
                    size="lg"
                  />
                  <div className="min-w-0">
                    <p className="font-semibold text-[color:var(--ink)]">
                      {member?.name || p.unknownMember}
                    </p>
                    <p className="mt-1 text-xs text-[color:var(--muted)]">
                      {memberSubmissions.length}{" "}
                      {memberSubmissions.length === 1
                        ? p.submissionSingular
                        : p.submissionPlural}{" "}
                      {p.archivedLabel}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {archivedMemberId ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div className="flex max-h-[85vh] w-full max-w-2xl flex-col border border-[color:var(--line)] bg-white shadow-xl">
            <div className="flex items-start justify-between gap-3 border-b border-[color:var(--line)] p-5">
              <div className="flex items-center gap-3">
                <MemberAvatar
                  name={archivedModalMember?.name || p.unknownMember}
                  photo={archivedModalMember?.photo}
                  size="lg"
                />
                <div>
                  <h2 className="font-[family-name:var(--font-display)] text-xl font-bold">
                    {p.archivedModalTitle.replace(
                      "{name}",
                      archivedModalMember?.name || p.unknownMember,
                    )}
                  </h2>
                  <p className="mt-1 text-sm text-[color:var(--muted)]">
                    {archivedModalSubmissions.length}{" "}
                    {archivedModalSubmissions.length === 1
                      ? p.submissionSingular
                      : p.submissionPlural}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setArchivedMemberId(null)}
                className="text-sm font-semibold text-[color:var(--muted)]"
              >
                {t.common.close}
              </button>
            </div>
            <ul className="space-y-3 overflow-y-auto p-5">
              {archivedModalSubmissions.map((submission) =>
                renderSubmissionCard(submission, { showDelete: true }),
              )}
            </ul>
          </div>
        </div>
      ) : null}

      <BillingShareWhatsAppModal
        open={Boolean(shareSubmission)}
        submission={shareSubmission}
        memberName={
          shareSubmission
            ? membersById.get(shareSubmission.memberId)?.name || p.unknownMember
            : ""
        }
        member={
          shareSubmission ? membersById.get(shareSubmission.memberId) : undefined
        }
        members={members}
        onClose={() => setShareSubmission(null)}
      />
    </div>
  );
}
