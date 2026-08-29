import { NextResponse } from "next/server";
import { requireModule } from "@/lib/auth/server";
import {
  isValidPin,
  resetPrivatePin,
  type PrivateItemType,
} from "@/lib/tasks/private-auth";
import { readTasksBoardFull } from "@/lib/tasks/store";
import { canViewPrivateItem, isPrivateItem } from "@/lib/tasks/types";

type Body = {
  itemType?: PrivateItemType;
  itemId?: string;
  motherName?: string;
  petName?: string;
  birthYear?: string;
  newPin?: string;
};

export async function POST(request: Request) {
  const session = await requireModule("tareas");
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as Body | null;
  const itemType = body?.itemType;
  const itemId = body?.itemId?.trim() || "";
  const newPin = body?.newPin?.trim() || "";

  if ((itemType !== "activity" && itemType !== "bank") || !itemId) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }
  if (!isValidPin(newPin)) {
    return NextResponse.json(
      { error: "La nueva clave debe tener exactamente 4 dígitos" },
      { status: 400 },
    );
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

  const ok = await resetPrivatePin(itemType, itemId, {
    motherName: body?.motherName || "",
    petName: body?.petName || "",
    birthYear: body?.birthYear || "",
  }, newPin);

  if (!ok) {
    return NextResponse.json(
      { error: "Las respuestas no coinciden. Revisa e intenta de nuevo." },
      { status: 401 },
    );
  }

  if (itemType === "activity") {
    const activity = board.activities.find((entry) => entry.id === itemId);
    if (!activity) {
      return NextResponse.json({ error: "Ítem no encontrado" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, itemType, itemId, activity });
  }

  const bankItem = board.bank.find((entry) => entry.id === itemId);
  if (!bankItem) {
    return NextResponse.json({ error: "Ítem no encontrado" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, itemType, itemId, bankItem });
}
