import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/server";
import { canAccessModule } from "@/lib/auth/session";
import { readContent, writeContent } from "@/lib/content/store";
import type { SiteContent } from "@/lib/i18n/dictionaries";

export async function GET() {
  const content = await readContent();
  return NextResponse.json(content);
}

export async function PUT(request: Request) {
  const session = await getSession();
  if (
    !session ||
    (!canAccessModule(session.role, "sitio") &&
      !canAccessModule(session.role, "talleres"))
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as SiteContent | null;
  if (!body?.en || !body?.es) {
    return NextResponse.json({ error: "Invalid content" }, { status: 400 });
  }

  await writeContent(body);
  return NextResponse.json({ ok: true });
}
