import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/server";
import { modulesForRole } from "@/lib/auth/session";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ authenticated: false });
  }

  return NextResponse.json({
    authenticated: true,
    role: session.role,
    memberId: session.memberId || null,
    name: session.name || null,
    email: session.email || null,
    modules: modulesForRole(session.role),
  });
}
