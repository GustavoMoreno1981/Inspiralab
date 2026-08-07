import { NextResponse } from "next/server";
import { requireModule } from "@/lib/auth/server";
import { readAccountingBoard, writeAccountingBoard } from "@/lib/accounting/store";
import type { AccountingBoard } from "@/lib/accounting/types";

export async function GET() {
  const session = await requireModule("contabilidad");
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const board = await readAccountingBoard();
  return NextResponse.json(board);
}

export async function PUT(request: Request) {
  const session = await requireModule("contabilidad");
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as AccountingBoard | null;
  if (
    !body ||
    !Array.isArray(body.budgets) ||
    !Array.isArray(body.beneficiaries) ||
    !Array.isArray(body.activities) ||
    !Array.isArray(body.expenses)
  ) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  try {
    await writeAccountingBoard(body);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No se pudo guardar en Supabase";
    console.error("writeAccountingBoard failed:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
