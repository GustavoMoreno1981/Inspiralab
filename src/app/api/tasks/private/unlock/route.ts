import { NextResponse } from "next/server";
import { requireModule } from "@/lib/auth/server";
import { verifyPrivatePin, type PrivateItemType } from "@/lib/tasks/private-auth";
import { readTasksBoardFull } from "@/lib/tasks/store";
import { canViewPrivateItem, isPrivateItem } from "@/lib/tasks/types";

type Body = {
  itemType?: PrivateItemType;
  itemId?: string;
  pin?: string;
};

export async function POST(request: Request) {
  const session = await requireModule("tareas");
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as Body | null;
  const itemType = body?.itemType;
  const itemId = body?.itemId?.trim() || "";
  const pin = body?.pin?.trim() || "";

  if ((itemType !== "activity" && itemType !== "bank") || !itemId || !pin) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const board = await readTasksBoardFull(session.memberId || undefined);
  const item =
    itemType === "activity"
      ? board.activities.find((activity) => activity.id === itemId)
      : board.bank.find((bankItem) => bankItem.id === itemId);

  if (!item || !isPrivateItem(item)) {
    return NextResponse.json({ error: "Ítem no encontrado" }, { status: 404 });
  }

  const viewerId = session.memberId || "";
  if (!canViewPrivateItem(item, viewerId)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const ok = await verifyPrivatePin(itemType, itemId, pin);
  if (!ok) {
    return NextResponse.json({ error: "Clave incorrecta" }, { status: 401 });
  }

  if (itemType === "activity") {
    const activity = board.activities.find((entry) => entry.id === itemId);
    if (!activity) {
      return NextResponse.json({ error: "Ítem no encontrado" }, { status: 404 });
    }
    return NextResponse.json({
      ok: true,
      itemType,
      itemId,
      activity,
    });
  }

  const bankItem = board.bank.find((entry) => entry.id === itemId);
  if (!bankItem) {
    return NextResponse.json({ error: "Ítem no encontrado" }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    itemType,
    itemId,
    bankItem,
  });
}
