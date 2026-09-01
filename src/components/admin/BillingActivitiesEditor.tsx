"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/components/admin/AdminToast";
import { useAdminLanguage } from "@/lib/i18n/AdminLanguageContext";

type BillingActivitiesEditorProps = {
  submissionId: string;
  activities: string[];
  editable?: boolean;
  onUpdated: () => void | Promise<void>;
};

export function BillingActivitiesEditor({
  submissionId,
  activities,
  editable = true,
  onUpdated,
}: BillingActivitiesEditorProps) {
  const toast = useToast();
  const { t } = useAdminLanguage();
  const p = t.billing;
  const [items, setItems] = useState(activities);
  const [newActivity, setNewActivity] = useState("");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setItems(activities);
    setEditingIndex(null);
    setEditValue("");
  }, [activities, submissionId]);

  async function persist(nextActivities: string[]) {
    setSaving(true);
    try {
      const res = await fetch(`/api/billing?id=${encodeURIComponent(submissionId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "updateActivities",
          activities: nextActivities,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error || p.updateActivitiesError);
      }
      setItems(nextActivities);
      toast.success(p.activitiesUpdated);
      await onUpdated();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : p.updateActivitiesError);
    } finally {
      setSaving(false);
    }
  }

  async function handleAdd() {
    const value = newActivity.trim();
    if (!value) return;
    await persist([...items, value]);
    setNewActivity("");
  }

  function startEdit(index: number) {
    setEditingIndex(index);
    setEditValue(items[index] || "");
  }

  function cancelEdit() {
    setEditingIndex(null);
    setEditValue("");
  }

  async function saveEdit(index: number) {
    const value = editValue.trim();
    if (!value) return;
    const next = [...items];
    next[index] = value;
    await persist(next);
    cancelEdit();
  }

  async function handleDelete(index: number) {
    if (items.length <= 1) {
      toast.error(p.activityRequired);
      return;
    }
    if (!window.confirm(p.deleteActivityConfirm)) return;
    const next = items.filter((_, itemIndex) => itemIndex !== index);
    await persist(next);
    if (editingIndex === index) cancelEdit();
  }

  return (
    <div className="mt-3">
      <p className="text-[10px] font-bold uppercase tracking-wide text-[color:var(--muted)]">
        {p.activitiesTitle}
      </p>
      <ol className="mt-2 space-y-2">
        {items.map((line, index) => (
          <li
            key={`${submissionId}-${index}`}
            className="flex items-start gap-2 border border-[color:var(--line)]/60 bg-[color:var(--mist)]/30 px-2 py-2"
          >
            <span className="mt-1 text-xs font-semibold text-[color:var(--muted)]">
              {index + 1}.
            </span>
            {editingIndex === index ? (
              <div className="min-w-0 flex-1 space-y-2">
                <input
                  value={editValue}
                  onChange={(event) => setEditValue(event.target.value)}
                  className="w-full border border-[color:var(--line)] bg-white px-2 py-1 text-sm"
                  disabled={saving}
                />
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={saving || !editValue.trim()}
                    onClick={() => void saveEdit(index)}
                    className="bg-[color:var(--accent)] px-2 py-1 text-[10px] font-semibold text-white disabled:opacity-50"
                  >
                    {t.common.save}
                  </button>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={cancelEdit}
                    className="border border-[color:var(--line)] px-2 py-1 text-[10px] font-semibold"
                  >
                    {t.common.cancel}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <p className="min-w-0 flex-1 text-sm text-[color:var(--ink)]">{line}</p>
                {editable ? (
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => startEdit(index)}
                      className="text-[10px] font-semibold text-[color:var(--accent)] disabled:opacity-50"
                    >
                      {t.common.edit}
                    </button>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => void handleDelete(index)}
                      className="text-[10px] font-semibold text-[color:var(--muted)] disabled:opacity-50"
                    >
                      {t.common.delete}
                    </button>
                  </div>
                ) : null}
              </>
            )}
          </li>
        ))}
      </ol>

      {editable ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <input
            value={newActivity}
            onChange={(event) => setNewActivity(event.target.value)}
            placeholder={p.activityPlaceholder}
            className="min-w-[220px] flex-1 border border-[color:var(--line)] bg-white px-3 py-2 text-sm"
            disabled={saving}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void handleAdd();
              }
            }}
          />
          <button
            type="button"
            disabled={saving || !newActivity.trim()}
            onClick={() => void handleAdd()}
            className="border border-[color:var(--line)] px-3 py-2 text-xs font-semibold disabled:opacity-50"
          >
            {p.addActivity}
          </button>
        </div>
      ) : null}
    </div>
  );
}
