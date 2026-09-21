import { NextResponse } from "next/server";
import { requireAdmin, requireSession } from "@/lib/auth/server";
import { readAdminSettings, writeAdminSettings } from "@/lib/admin/settings";

export async function GET() {
  const session = await requireSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const settings = await readAdminSettings();
  return NextResponse.json({
    bitacoraUrl: settings.bitacoraUrl,
    updatedAt: settings.updatedAt || null,
  });
}

export async function PUT(request: Request) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as
    | { bitacoraUrl?: string }
    | null;

  if (!body || typeof body.bitacoraUrl !== "string") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const bitacoraUrl = body.bitacoraUrl.trim();
  if (bitacoraUrl) {
    try {
      const parsed = new URL(bitacoraUrl);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return NextResponse.json(
          { error: "La URL de bitácora debe empezar con http:// o https://" },
          { status: 400 },
        );
      }
    } catch {
      return NextResponse.json(
        { error: "La URL de bitácora no es válida" },
        { status: 400 },
      );
    }
  }

  try {
    const settings = await writeAdminSettings({ bitacoraUrl });
    return NextResponse.json({
      ok: true,
      bitacoraUrl: settings.bitacoraUrl,
      updatedAt: settings.updatedAt,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No se pudo guardar la configuración";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
