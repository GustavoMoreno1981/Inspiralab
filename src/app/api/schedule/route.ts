import { NextResponse } from "next/server";
import { getApprovalBudgetContext } from "@/lib/accounting/approval-budget";
import { getSession, requireModule } from "@/lib/auth/server";
import { canAccessModule } from "@/lib/auth/session";
import { syncApprovedSessionsToAccounting } from "@/lib/accounting/from-schedule";
import {
  readAccountingBoard,
  writeAccountingBoard,
} from "@/lib/accounting/store";
import { readFollowUpBoard } from "@/lib/followup/store";
import { syncEvaluationsForSessions } from "@/lib/followup/store";
import {
  readScheduleBeneficiaries,
  readScheduleBoard,
  writeScheduleBoard,
} from "@/lib/schedule/store";
import { normalizeBoard, type ScheduleBoard } from "@/lib/schedule/types";

function canUseSchedule(session: NonNullable<Awaited<ReturnType<typeof getSession>>>) {
  return (
    canAccessModule(session.role, "cronograma") ||
    canAccessModule(session.role, "talleres") ||
    canAccessModule(session.role, "contabilidad") ||
    canAccessModule(session.role, "sitio")
  );
}

export async function GET() {
  const session = await getSession();
  if (!session || !canUseSchedule(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [board, beneficiaries] = await Promise.all([
    readScheduleBoard(),
    readScheduleBeneficiaries(),
  ]);

  const approvalBudget =
    session.role === "admin" ? await getApprovalBudgetContext() : null;

  return NextResponse.json({
    sessions: board.sessions,
    beneficiaries,
    canApproveProposals: session.role === "admin",
    approvalBudget,
  });
}

function scheduleSaveErrorMessage(error: unknown): string {
  const raw =
    error instanceof Error
      ? error.message
      : error &&
          typeof error === "object" &&
          "message" in error &&
          typeof (error as { message: unknown }).message === "string"
        ? (error as { message: string }).message
        : "";

  if (
    raw.includes("workshop_sessions_status_check") ||
    raw.includes("23514")
  ) {
    if (raw.includes("rejected") || raw.toLowerCase().includes("rechaz")) {
      return (
        "Supabase aún no acepta el estado «rechazada». " +
        "Ejecuta en el SQL Editor el archivo supabase/add-schedule-rejected.sql " +
        "(tabla workshop_sessions) y vuelve a rechazar la propuesta."
      );
    }
    return (
      "Supabase aún no acepta el estado «pendiente de aprobación». " +
      "Ejecuta en el SQL Editor el archivo supabase/add-schedule-pending-approval.sql " +
      "(tabla workshop_sessions) y vuelve a enviar la propuesta."
    );
  }

  if (raw) return raw;
  return "No se pudo guardar en Supabase";
}

export async function PUT(request: Request) {
  const session = (await requireModule("cronograma")) || (await getSession());
  if (!session || !canUseSchedule(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as ScheduleBoard | null;
  if (!body || !Array.isArray(body.sessions)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  try {
    const previousBoard = await readScheduleBoard();
    const normalized = normalizeBoard(body);

    if (session.role !== "admin") {
      const blocked = normalized.sessions.some((nextSession) => {
        const previous = previousBoard.sessions.find((item) => item.id === nextSession.id);
        return (
          previous?.status === "pending_approval" &&
          (nextSession.status === "scheduled" || nextSession.status === "rejected")
        );
      });
      if (blocked) {
        return NextResponse.json(
          {
            error:
              "Solo el perfil de administración puede aprobar o rechazar propuestas del cronograma.",
          },
          { status: 403 },
        );
      }
    }

    await writeScheduleBoard(normalized);
    try {
      await syncEvaluationsForSessions(normalized.sessions.map((item) => item.id));
    } catch (error) {
      console.warn("syncEvaluationsForSessions failed:", error);
    }
    try {
      const { synced } = await syncApprovedSessionsToAccounting(
        previousBoard.sessions,
        normalized.sessions,
        {
          readAccountingBoard,
          writeAccountingBoard,
          readFollowUpBoard,
        },
      );
      return NextResponse.json({ ok: true, accountingSynced: synced });
    } catch (error) {
      console.error("syncApprovedSessionsToAccounting failed:", error);
      return NextResponse.json({
        ok: true,
        accountingSynced: 0,
        accountingWarning:
          "La propuesta se guardó, pero no se pudo crear la actividad en contabilidad.",
      });
    }
  } catch (error) {
    const message = scheduleSaveErrorMessage(error);
    console.error("writeScheduleBoard failed:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
