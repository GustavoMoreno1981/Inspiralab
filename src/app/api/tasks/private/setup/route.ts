import { NextResponse } from "next/server";
import { requireModule } from "@/lib/auth/server";
import {
  isValidPin,
  savePrivateAuth,
  type PrivateItemType,
} from "@/lib/tasks/private-auth";
import { readTasksBoard } from "@/lib/tasks/store";
import { canViewPrivateItem, isPrivateItem } from "@/lib/tasks/types";

type Body = {
  itemType?: PrivateItemType;
  itemId?: string;
  pin?: string;
  motherName?: string;
  petName?: string;
  birthYear?: string;
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

  if ((itemType !== "activity" && itemType !== "bank") || !itemId) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }
  if (!isValidPin(pin)) {
    return NextResponse.json(
      { error: "La clave debe tener exactamente 4 dígitos" },
      { status: 400 },
    );
  }

  const board = await readTasksBoard();
  const item =
    itemType === "activity"
      ? board.activities.find((activity) => activity.id === itemId)
      : board.bank.find((bankItem) => bankItem.id === itemId);

  if (!item || !isPrivateItem(item)) {
    return NextResponse.json({ error: "Ítem no encontrado o no es privado" }, { status: 404 });
  }

  const viewerId = session.memberId || "";
  if (!canViewPrivateItem(item, viewerId)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  try {
    await savePrivateAuth(itemType, itemId, pin, {
      motherName: body?.motherName || "",
      petName: body?.petName || "",
      birthYear: body?.birthYear || "",
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo guardar la clave";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
