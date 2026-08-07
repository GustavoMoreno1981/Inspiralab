"use client";

import { useEffect, useState } from "react";
import { AdminAlarms } from "@/components/admin/AdminAlarms";
import { AdminDailyBriefing } from "@/components/admin/AdminDailyBriefing";
import {
  emptyBoard as emptyAccountingBoard,
  type AccountingBoard,
} from "@/lib/accounting/types";
import type { TasksBoard } from "@/lib/tasks/types";

export function AdminOpsPanel({ canAccounting = false }: { canAccounting?: boolean }) {
  const [tasksBoard, setTasksBoard] = useState<TasksBoard | null>(null);
  const [accounting, setAccounting] = useState<AccountingBoard>(emptyAccountingBoard());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const tasksPromise = fetch("/api/tasks", { cache: "no-store" });
      const accountingPromise = canAccounting
        ? fetch("/api/accounting", { cache: "no-store" })
        : Promise.resolve(null);

      const [tasksRes, accountingRes] = await Promise.all([tasksPromise, accountingPromise]);
      if (cancelled) return;

      if (tasksRes.ok) {
        setTasksBoard((await tasksRes.json()) as TasksBoard);
      } else {
        setTasksBoard({ members: [], tasks: [] });
      }

      if (accountingRes?.ok) {
        setAccounting((await accountingRes.json()) as AccountingBoard);
      }

      setLoading(false);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [canAccounting]);

  return (
    <>
      <AdminAlarms
        tasksBoard={tasksBoard}
        accounting={accounting}
        loading={loading}
        showBudget={canAccounting}
      />
      <AdminDailyBriefing board={tasksBoard} loading={loading} />
    </>
  );
}
