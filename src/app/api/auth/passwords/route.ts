import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/server";
import { readCredentials, writeCredentials } from "@/lib/auth/credentials";

export async function GET() {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const credentials = await readCredentials();
  return NextResponse.json({
    adminPassword: credentials.adminPassword,
    memberPassword: credentials.memberPassword,
    updatedAt: credentials.updatedAt || null,
  });
}

export async function PUT(request: Request) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as
    | { adminPassword?: string; memberPassword?: string }
    | null;

  if (!body) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const adminPassword = body.adminPassword?.trim() || "";
  const memberPassword = body.memberPassword?.trim() || "";

  if (!adminPassword || !memberPassword) {
    return NextResponse.json(
      { error: "Ambas contraseñas son obligatorias" },
      { status: 400 },
    );
  }

  if (adminPassword.length < 6 || memberPassword.length < 6) {
    return NextResponse.json(
      { error: "Cada contraseña debe tener al menos 6 caracteres" },
      { status: 400 },
    );
  }

  try {
    const credentials = await writeCredentials({ adminPassword, memberPassword });
    return NextResponse.json({
      ok: true,
      adminPassword: credentials.adminPassword,
      memberPassword: credentials.memberPassword,
      updatedAt: credentials.updatedAt,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No se pudieron guardar las contraseñas";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
