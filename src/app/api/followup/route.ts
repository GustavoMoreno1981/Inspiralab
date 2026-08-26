import { NextResponse } from "next/server";
import { getSession, requireModule } from "@/lib/auth/server";
import { canAccessModule } from "@/lib/auth/session";
import {
  readFollowUpBoard,
  syncEvaluationsForSessions,
  writeFollowUpBoard,
} from "@/lib/followup/store";
import { normalizeBoard, type FollowUpBoard } from "@/lib/followup/types";
import {
  readScheduleBeneficiaries,
  readScheduleBoard,
} from "@/lib/schedule/store";

function canUseFollowUp(session: NonNullable<Awaited<ReturnType<typeof getSession>>>) {
  return (
    canAccessModule(session.role, "seguimiento") ||
    canAccessModule(session.role, "cronograma") ||
    canAccessModule(session.role, "talleres") ||
    canAccessModule(session.role, "tareas") ||
    canAccessModule(session.role, "sitio")
  );
}

export async function GET() {
  const session = await getSession();
  if (!session || !canUseFollowUp(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [schedule, beneficiaries] = await Promise.all([
    readScheduleBoard(),
    readScheduleBeneficiaries(),
  ]);

  try {
    await syncEvaluationsForSessions(schedule.sessions.map((item) => item.id));
  } catch (error) {
    console.warn("syncEvaluationsForSessions on GET failed:", error);
  }

  const board = await readFollowUpBoard();

  return NextResponse.json({
    evaluations: board.evaluations,
    sessions: schedule.sessions,
    beneficiaries,
  });
}

export async function PUT(request: Request) {
  const session =
    (await requireModule("seguimiento")) || (await getSession());
  if (!session || !canUseFollowUp(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as FollowUpBoard | null;
  if (!body || !Array.isArray(body.evaluations)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  try {
    const normalized = normalizeBoard(body);
    await writeFollowUpBoard(normalized);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No se pudo guardar en Supabase";
    console.error("writeFollowUpBoard failed:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
