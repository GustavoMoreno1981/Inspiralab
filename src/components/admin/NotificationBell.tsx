"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { getBellNotifications, type TaskAlarm } from "@/lib/alarms";
import { TaskSemaphore } from "@/components/admin/AdminAlarms";
import { useAdminLanguage } from "@/lib/i18n/AdminLanguageContext";
import { getTaskAlarmReasonLabel } from "@/lib/i18n/admin";
import type { TasksBoard } from "@/lib/tasks/types";

const SEEN_KEY = "inspiralab-notif-seen";

function notificationKey(alarm: TaskAlarm) {
  return `${alarm.activityId}:${alarm.reason}`;
}

function loadSeen(): Set<string> {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((item): item is string => typeof item === "string"));
  } catch {
    return new Set();
  }
}

function saveSeen(keys: Set<string>) {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify([...keys]));
  } catch {
    // el aviso sigue visible en esta visita
  }
}

function BellIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
      <path
        d="M6 9a6 6 0 1112 0c0 7 3 7 3 9H3c0-2 3-2 3-9z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M10 20a2 2 0 004 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function NotificationBell({
  tasksBoard,
  loading = false,
}: {
  tasksBoard: TasksBoard | null;
  loading?: boolean;
}) {
  const { t } = useAdminLanguage();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState<Set<string> | null>(null);

  const items = useMemo(
    () => (tasksBoard ? getBellNotifications(tasksBoard, t) : []),
    [tasksBoard, t],
  );

  useEffect(() => {
    setSeen(loadSeen());
  }, []);

  useEffect(() => {
    if (!open) return;
    function onPointer(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("mousedown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const unseen = seen
    ? items.filter((item) => !seen.has(notificationKey(item))).length
    : 0;

  useEffect(() => {
    if (!open || !seen) return;
    const merged = new Set(seen);
    let changed = false;
    for (const item of items) {
      const key = notificationKey(item);
      if (!merged.has(key)) {
        merged.add(key);
        changed = true;
      }
    }
    if (!changed) return;
    setSeen(merged);
    saveSeen(merged);
  }, [open, items, seen]);

  function toggle() {
    setOpen((current) => !current);
  }

  function showAlarms() {
    setOpen(false);
    document.getElementById("alarmas")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const badge = unseen > 9 ? "9+" : String(unseen);

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={unseen > 0 ? `${t.alarms.bell} (${unseen})` : t.alarms.bell}
        title={t.alarms.bell}
        className="relative inline-flex items-center justify-center border border-[color:var(--line)] px-2.5 py-2 text-[color:var(--ink)] hover:border-[color:var(--accent)] hover:text-[color:var(--accent)]"
      >
        <BellIcon />
        {unseen > 0 && (
          <span className="absolute -right-1.5 -top-1.5 min-w-4 rounded-full bg-[color:var(--accent)] px-1 text-center text-[10px] font-bold leading-4 text-white">
            {badge}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={t.alarms.bell}
          className="absolute right-0 z-40 mt-2 w-[min(22rem,calc(100vw-2.5rem))] border border-[color:var(--line)] bg-white shadow-xl"
        >
          <div className="border-b border-[color:var(--line)] px-4 py-3">
            <p className="font-semibold text-[color:var(--ink)]">{t.alarms.bell}</p>
            <p className="text-xs text-[color:var(--muted)]">{t.alarms.reasons.pending_review}</p>
          </div>

          {loading ? (
            <p className="px-4 py-6 text-sm text-[color:var(--muted)]">{t.alarms.loading}</p>
          ) : items.length === 0 ? (
            <p className="px-4 py-6 text-sm text-[color:var(--muted)]">{t.alarms.bellEmpty}</p>
          ) : (
            <ul className="max-h-80 divide-y divide-[color:var(--line)] overflow-y-auto">
              {items.map((alarm) => (
                <li key={notificationKey(alarm)}>
                  <Link
                    href={`/admin/tareas?actividad=${encodeURIComponent(alarm.activityId)}`}
                    onClick={() => setOpen(false)}
                    className="flex items-start gap-2 px-4 py-3 hover:bg-[color:var(--mist)]"
                  >
                    <span className="mt-1">
                      <TaskSemaphore level={alarm.level} />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-[color:var(--ink)]">
                        {alarm.title.trim() || t.private.lockedPrivate}
                      </span>
                      <span className="mt-0.5 block text-xs text-[color:var(--muted)]">
                        {getTaskAlarmReasonLabel(t, alarm.reason)}
                        {alarm.assignees.length
                          ? ` · ${alarm.assignees.map((member) => member.name).join(", ")}`
                          : ""}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}

          <div className="border-t border-[color:var(--line)] px-4 py-3">
            <button
              type="button"
              onClick={showAlarms}
              className="text-sm font-semibold text-[color:var(--accent)]"
            >
              {t.alarms.bellSeeAlarms}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
