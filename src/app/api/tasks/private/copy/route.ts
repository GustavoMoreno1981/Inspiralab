import { NextResponse } from "next/server";
import { requireModule } from "@/lib/auth/server";
import { copyPrivateAuth, type PrivateItemType } from "@/lib/tasks/private-auth";
import { readTasksBoard } from "@/lib/tasks/store";
import { canViewPrivateItem, isPrivateItem } from "@/lib/tasks/types";

type Body = {
  fromType?: PrivateItemType;
  fromId?: string;
  toType?: PrivateItemType;
  toId?: string;
};

export async function POST(request: Request) {
  const session = await requireModule("tareas");
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as Body | null;
  const fromType = body?.fromType;
  const fromId = body?.fromId?.trim() || "";
  const toType = body?.toType;
  const toId = body?.toId?.trim() || "";

  if (
    !fromType ||
    !toType ||
    !fromId ||
    !toId ||
    (fromType !== "activity" && fromType !== "bank") ||
    (toType !== "activity" && toType !== "bank")
  ) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const board = await readTasksBoard(session.memberId || undefined);
  const viewerId = session.memberId || "";

  const fromItem =
    fromType === "activity"
      ? board.activities.find((activity) => activity.id === fromId)
      : board.bank.find((item) => item.id === fromId);
  const toItem =
    toType === "activity"
      ? board.activities.find((activity) => activity.id === toId)
      : board.bank.find((item) => item.id === toId);

  if (!fromItem || !toItem || !isPrivateItem(fromItem) || !isPrivateItem(toItem)) {
    return NextResponse.json({ error: "Ítems no válidos" }, { status: 404 });
  }

  if (!canViewPrivateItem(fromItem, viewerId) || !canViewPrivateItem(toItem, viewerId)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  try {
    const copied = await copyPrivateAuth(fromType, fromId, toType, toId);
    if (!copied) {
      return NextResponse.json({ error: "No hay clave para copiar" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo copiar la clave";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
