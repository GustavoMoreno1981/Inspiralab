import { NextResponse } from "next/server";
import { requireModule } from "@/lib/auth/server";
import { readTasksBoard, readTasksBoardUnfiltered, writeTasksBoard } from "@/lib/tasks/store";
import {
  countPendingBankByMember,
  redactPrivateBoard,
  type TasksBoard,
} from "@/lib/tasks/types";

export async function GET(request: Request) {
  const session = await requireModule("tareas");
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const viewerParam = new URL(request.url).searchParams.get("viewer")?.trim() || "";
  const viewerMemberId = session.memberId || viewerParam || undefined;
  const board = await readTasksBoard(viewerMemberId);
  let bankPendingCountByMember: Record<string, number> | undefined;
  if (session.role === "admin" && !viewerMemberId) {
    const fullBoard = await readTasksBoardUnfiltered();
    bankPendingCountByMember = countPendingBankByMember(fullBoard.bank, fullBoard.members);
  }
  return NextResponse.json({
    ...redactPrivateBoard(board),
    ...(bankPendingCountByMember ? { bankPendingCountByMember } : {}),
  });
}

export async function PUT(request: Request) {
  const session = await requireModule("tareas");
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as (TasksBoard & {
    _deletedActivityIds?: string[];
    _deletedBankIds?: string[];
  }) | null;
  if (!body || !Array.isArray(body.members) || !Array.isArray(body.activities)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const deletedActivityIds = Array.isArray(body._deletedActivityIds) ? body._deletedActivityIds : [];
  const deletedBankIds = Array.isArray(body._deletedBankIds) ? body._deletedBankIds : [];

  const payload: TasksBoard = {
    members: body.members,
    activities: body.activities,
    bank: Array.isArray(body.bank) ? body.bank : [],
  };

  try {
    await writeTasksBoard(payload, {
      allowAuthEdit: session.role === "admin",
      deletedActivityIds,
      deletedBankIds,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : error && typeof error === "object" && "message" in error
          ? String((error as { message?: string }).message || "No se pudo guardar en Supabase")
          : "No se pudo guardar en Supabase";
    console.error("writeTasksBoard failed:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
