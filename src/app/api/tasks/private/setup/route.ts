import { NextResponse } from "next/server";
import { requireModule } from "@/lib/auth/server";
import {
  emptyPrivateSecurityAnswers,
  getPrivateSecurityQuestionKeys,
  isValidPin,
  savePrivateAuth,
  type PrivateItemType,
} from "@/lib/tasks/private-auth";
import { isSecurityQuestionKey, type SecurityQuestionKey } from "@/lib/tasks/security-questions";
import { readTasksBoardFull } from "@/lib/tasks/store";
import { isPrivateItem } from "@/lib/tasks/types";

type Body = {
  itemType?: PrivateItemType;
  itemId?: string;
  pin?: string;
  questionKeys?: string[];
  answers?: Record<string, string>;
  motherName?: string;
  petName?: string;
  birthYear?: string;
  age?: string;
  spouseName?: string;
  schoolName?: string;
};

function parseSetupBody(body: Body | null) {
  const questionKeys = (body?.questionKeys || []).filter(
    (key): key is SecurityQuestionKey => isSecurityQuestionKey(key),
  );
  const answers = emptyPrivateSecurityAnswers();

  if (body?.answers && typeof body.answers === "object") {
    for (const [key, value] of Object.entries(body.answers)) {
      if (isSecurityQuestionKey(key)) {
        answers[key] = String(value || "");
      }
    }
  }

  const legacyValues: Partial<Record<SecurityQuestionKey, string | undefined>> = {
    motherName: body?.motherName,
    petName: body?.petName,
    birthYear: body?.birthYear,
    age: body?.age,
    spouseName: body?.spouseName,
    schoolName: body?.schoolName,
  };

  for (const key of questionKeys) {
    if (!answers[key] && legacyValues[key]) {
      answers[key] = String(legacyValues[key]);
    }
  }

  return { questionKeys, answers };
}

export async function POST(request: Request) {
  const session = await requireModule("tareas");
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as Body | null;
  const itemType = body?.itemType;
  const itemId = body?.itemId?.trim() || "";
  const pin = body?.pin?.trim() || "";
  const setup = parseSetupBody(body);

  if ((itemType !== "activity" && itemType !== "bank") || !itemId) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }
  if (!isValidPin(pin)) {
    return NextResponse.json(
      { error: "La clave debe tener exactamente 4 dígitos" },
      { status: 400 },
    );
  }

  const board = await readTasksBoardFull();
  const item =
    itemType === "activity"
      ? board.activities.find((activity) => activity.id === itemId)
      : board.bank.find((bankItem) => bankItem.id === itemId);

  if (!item || !isPrivateItem(item)) {
    return NextResponse.json({ error: "Ítem no encontrado o no es privado" }, { status: 404 });
  }

  try {
    await savePrivateAuth(itemType, itemId, pin, {
      questionKeys: setup.questionKeys,
      answers: setup.answers,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo guardar la clave";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function GET(request: Request) {
  const session = await requireModule("tareas");
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const itemType = searchParams.get("itemType");
  const itemId = searchParams.get("itemId")?.trim() || "";

  if ((itemType !== "activity" && itemType !== "bank") || !itemId) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const questionKeys = await getPrivateSecurityQuestionKeys(itemType, itemId);
  return NextResponse.json({ ok: true, questionKeys });
}
